import base64
import logging
import mimetypes
from pathlib import Path

from openai import OpenAI

from python.case_schemas import CaseExtraction
from python.config import setting
from python.knowledge import KnowledgeBase
from python.knowledge.vectors import openai_key
from python.mcp_server import screens
from python.zusia_tools import McpTools, UserContext

logger = logging.getLogger(__name__)

DEFAULT_MODEL = 'gpt-5.4-mini'
# Reasoning models (gpt-5…, o…) think before answering; ignored for other models. In the chat it must be „none”:
# gpt-5.4 models do not combine function tools (MCP) with reasoning in /v1/chat/completions – and it is the fastest.
# Reading case documents uses no tools, so it may think a little.
DEFAULT_REASONING_EFFORT = 'none'
DEFAULT_CASE_REASONING_EFFORT = 'low'
# Transient OpenAI errors (rate limit, overload, connection problems) are retried by the SDK with backoff.
MAX_RETRIES = 3
TIMEOUT_SECONDS = 120
# How many rounds of tool calls (MCP) the model may make before it has to answer.
MAX_TOOL_ROUNDS = 4


class Chat:
    """One conversation: the user's messages (with attachments) and ZUSia's answers in the OpenAI chat format.
    The system instruction is not stored – it is built anew for every turn (see ZUSia._turn_config)."""

    def __init__(self, messages: list[dict] | None = None):
        self.messages = list(messages or [])


def _data_url(data: bytes, mime: str) -> str:
    return f'data:{mime};base64,{base64.b64encode(data).decode()}'


def user_message(text: str, attachments: list[tuple[bytes, str]] = ()) -> dict:
    """A user turn: text plus images (image_url) and PDFs (file), both sent inline as base64."""
    content = [{'type': 'text', 'text': text}] if text.strip() else []
    for data, mime in attachments:
        if mime == 'application/pdf':
            content.append({'type': 'file', 'file': {'filename': 'dokument.pdf', 'file_data': _data_url(data, mime)}})
        else:
            content.append({'type': 'image_url', 'image_url': {'url': _data_url(data, mime)}})
    return {'role': 'user', 'content': content or ''}


class ZUSia:
    def __init__(self):
        api_key = openai_key()

        if not api_key:
            raise RuntimeError('OpenAI API key (OPENAI_API_KEY / OPEN_AI_KEY) is not configured')

        self.client = OpenAI(api_key = api_key, max_retries = MAX_RETRIES, timeout = TIMEOUT_SECONDS)

        self.model = setting('ZUSIA_MODEL', DEFAULT_MODEL)
        self.reasoning_effort = setting('ZUSIA_REASONING_EFFORT', DEFAULT_REASONING_EFFORT)
        self.case_reasoning_effort = setting('ZUSIA_CASE_REASONING_EFFORT', DEFAULT_CASE_REASONING_EFFORT)

        file_path = Path(__file__).resolve().parent / 'zusia_persona.txt'

        with open(file_path, 'r', encoding = 'utf-8') as file:
            self.persona = file.read()

        self.knowledge = KnowledgeBase()
        self.tools = McpTools()

    def create_chat(self, history = None) -> Chat:
        """A new conversation, or one restored from saved turns (rows with role, content and an optional attachment)."""
        messages = []
        for row in history or []:
            if row['role'] == 'user':
                attachment = [(row['attachment'], row['attachment_mime'])] if row['attachment'] is not None else []
                messages.append(user_message(row['content'] or '', attachment))
            else:
                messages.append({'role': 'assistant', 'content': row['content'] or ''})
        return Chat(messages)

    def _reasoning(self, effort: str | None) -> dict:
        return {'reasoning_effort': effort} if effort and self.model.startswith(('gpt-5', 'o')) else {}

    def _complete(self, messages: list[dict], tools: list[dict] | None = None, tool_choice: str = 'auto'):
        kwargs = self._reasoning(self.reasoning_effort)
        if tools:
            kwargs.update(tools = tools, tool_choice = tool_choice)
        return self.client.chat.completions.create(model = self.model, messages = messages, **kwargs)

    def _turn_config(self, question: str, user: UserContext | None = None) -> tuple[str, list[dict]]:
        """System instruction for one turn: the persona, the verified data that matches the question and how to reach
        the user's own data – through the MCP tools (account, applications, current screen…), called on demand."""
        data = self.knowledge.context(question)
        instruction = f'{self.persona}\n\n<|PROTECTED_INTERNAL_DATA|>\n{data}\n</|PROTECTED_INTERNAL_DATA|>'
        tools = []
        if user is not None:
            screen = screens.get(user.session_id)
            where = screen.split('\n', 1)[0] if screen else 'nieznany'
            signed_in = 'tak' if user.pue_token else 'nie'
            instruction += f'\n\n<|USER_CONTEXT|>\n{USER_CONTEXT_RULES}\n\nZalogowany: {signed_in}. {where}\n</|USER_CONTEXT|>'
            # we run the calls ourselves through MCP with the user's token
            tools = self.tools.declarations()
        return instruction, tools

    def _send(self, chat: Chat, message: dict, instruction: str, tools: list[dict], user: UserContext | None) -> str:
        """Send one user turn; when the model asks for tools, run them via MCP and give it the results.
        Only the user's message and the final answer are kept in the chat history (not the tool data)."""
        messages = [{'role': 'system', 'content': instruction}, *chat.messages, message]
        response = self._complete(messages, tools)
        rounds = 0
        while (calls := response.choices[0].message.tool_calls) and user is not None:
            logger.info('ZUSia calls MCP tools: %s', ', '.join(c.function.name for c in calls))
            messages.append({'role': 'assistant', 'content': response.choices[0].message.content,
                             'tool_calls': [{'id': c.id, 'type': 'function',
                                             'function': {'name': c.function.name, 'arguments': c.function.arguments}}
                                            for c in calls]})
            messages += self.tools.call(calls, user)
            rounds += 1
            # tool budget used up – the model has to answer with what is known
            response = self._complete(messages, tools, 'none' if rounds >= MAX_TOOL_ROUNDS else 'auto')

        reply = response.choices[0].message.content or ''
        if reply:
            chat.messages += [message, {'role': 'assistant', 'content': reply}]
        return reply

    def text(self, chat, message, user: UserContext | None = None):
        instruction, tools = self._turn_config(message, user)
        return self._send(chat, user_message(message), instruction, tools, user)

    def img(self, chat, message = '', img_path = None, image_bytes = None, mime_type = None, user: UserContext | None = None):
        if img_path:
            mime_type, _ = mimetypes.guess_type(img_path)

            with open(img_path, 'rb') as f:
                image_bytes = f.read()

        attachments = [(image_bytes, mime_type or 'image/jpeg')] if image_bytes is not None else []
        instruction, tools = self._turn_config(message, user)
        return self._send(chat, user_message(message, attachments), instruction, tools, user)

    def pdf(self, chat, message = '', pdf_bytes = None, user: UserContext | None = None):
        if pdf_bytes is None:
            raise ValueError('PDF data is required')

        instruction, tools = self._turn_config(message, user)
        return self._send(chat, user_message(message, [(pdf_bytes, 'application/pdf')]), instruction, tools, user)

    def extract_case(self, files: list[tuple[bytes, str]]) -> CaseExtraction:
        """Read the documents of one benefit case (PDFs / scans) and return structured data for the calculators."""
        if not files:
            raise ValueError('At least one document is required')

        message = user_message('Odczytaj dane z powyższych dokumentów jednej sprawy.', files)
        # documents first, then the instruction – the same order as before
        message['content'] = message['content'][1:] + message['content'][:1]
        kwargs = self._reasoning(self.case_reasoning_effort)
        response = self.client.chat.completions.parse(
            model = self.model,
            messages = [{'role': 'system', 'content': CASE_EXTRACTION_PROMPT}, message],
            response_format = CaseExtraction,
            **kwargs)

        result = response.choices[0].message
        if isinstance(result.parsed, CaseExtraction):
            return result.parsed
        if not result.content:
            raise RuntimeError(result.refusal or 'The model returned an empty response')
        return CaseExtraction.model_validate_json(result.content)


USER_CONTEXT_RULES = """Masz narzędzia (MCP) do danych WYŁĄCZNIE zalogowanej osoby i do tego, co widzi na ekranie:
get_user_profile, get_insurance, get_contributions, calculate_my_benefit_basis, get_sick_leaves, get_benefits,
get_applications, get_circumstances, get_current_screen, a także get_benefit_parameters i search_documents.
- Gdy pytanie dotyczy sytuacji użytkownika („mój zasiłek”, „czy dostanę”, „moje składki”), najpierw pobierz potrzebne dane
  narzędziami – nie zgaduj i nie proś o dane, które możesz pobrać. Powiedz wprost, na podstawie czego odpowiadasz.
- Gdy pytanie dotyczy „tego”, co widzi (formularz wniosku, wynik, dokument na stronie), wywołaj get_current_screen,
  odnieś się do konkretnych pól i wartości, wskaż braki i sprawdź uprawnienia z danymi z konta i przepisami.
- Nie masz dostępu do danych innych osób i niczego nie zmieniasz ani nie wysyłasz – wyjaśnij, gdzie użytkownik zrobi to sam.
- „Okoliczności” to deklaracja użytkownika, nie dane ZUS. Dokumenty wgrane przez użytkownika są pomocnicze – przy
  rozbieżności rozstrzygają dane z konta ZUS. Nie podawaj pełnego numeru PESEL ani numeru konta."""


CASE_EXTRACTION_PROMPT = """Jesteś asystentem ZUS, który odczytuje dokumenty jednej sprawy o zasiłek chorobowy lub macierzyński
(np. ZAM, ZUR, ZAO, Z-3, Z-3a, ZAS-53, ZAS-12, e-ZLA, poświadczenie ubezpieczenia chorobowego, zrzuty z systemu ZUS,
zaświadczenia lekarskie, decyzje ZUS) i zwracasz dane w podanym schemacie JSON.

Zasady:
- Odczytuj wyłącznie to, co jest w dokumentach. Jeśli informacji nie ma lub jest nieczytelna – zwróć null (albo pustą listę).
  Nigdy nie zgaduj i nie uzupełniaj danych „typowymi” wartościami.
- Daty zapisuj jako YYYY-MM-DD, miesiące jako YYYY-MM. Kwoty jako liczby w złotych (kropka dziesiętna, bez spacji).
- Wynagrodzenie z Z-3 to kwoty BRUTTO za poszczególne miesiące – wpisz je do salary_months.gross_salary.
  Przy umowie zlecenia i działalności wpisz podstawę wymiaru składki do salary_months.contribution_basis.
- Premie kwartalne i roczne wypisz osobno (quarterly_bonuses_last_4_quarters, annual_bonuses_last_year), jeśli są wyszczególnione.
- employment_type: umowa o pracę = employee, umowa zlecenia = contract, pozarolnicza działalność = business.
  insurance_kind: umowa o pracę = mandatory; zlecenie i działalność (dobrowolne ubezpieczenie chorobowe) = voluntary.
- sickness_insured ustal na podstawie poświadczenia ubezpieczenia / zrzutów z systemu; jeśli brak dowodu – null.
- leave_periods: okresy urlopów lub zasiłku macierzyńskiego z wniosków i Z-3 (macierzyński, rodzicielski, ojcowski,
  uzupełniający, na warunkach macierzyńskiego) wraz z rodzicem, który z nich korzysta.
- incapacity_periods: okresy z e-ZLA lub ZAS-53; pregnancy_code_b = true, gdy zaświadczenie ma kod „B”.
- zus_decision: jeśli dokumenty zawierają informację, czy świadczenie przyznano (i w jakiej kwocie) – wpisz ją.
- summary oraz warnings pisz prostym językiem po polsku. W warnings wymień brakujące dokumenty lub dane,
  niespójności oraz ryzyka utraty prawa do zasiłku (np. brak ubezpieczenia w dniu porodu, podwyższenie podstawy w ciąży,
  zadłużenie składkowe).
"""

