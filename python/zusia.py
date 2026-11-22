import logging
import mimetypes
import time
from pathlib import Path

from google import genai
from google.genai import errors, types

from python.case_schemas import CaseExtraction
from python.config import setting
from python.knowledge import KnowledgeBase
from python.mcp_server import screens
from python.zusia_tools import McpTools, UserContext

logger = logging.getLogger(__name__)

# Transient Gemini errors worth retrying: rate limit, overload ("high demand"), gateway problems.
RETRYABLE_STATUS = {429, 500, 503, 504}
MAX_ATTEMPTS = 3
# How many rounds of tool calls (MCP) the model may make before it has to answer.
MAX_TOOL_ROUNDS = 4

class ZUSia:
    def __init__(self):
        api_key = setting('ZUS_API_KEY')

        if not api_key:
            raise RuntimeError('ZUS_API_KEY is not configured')

        self.client = genai.Client(api_key = api_key)

        self.model = setting('ZUSIA_MODEL', 'gemini-3.1-flash-lite')

        file_path = Path(__file__).resolve().parent / 'zusia_persona.txt'

        with open(file_path, 'r', encoding = 'utf-8') as file:
            self.persona = file.read()

        self.knowledge = KnowledgeBase()
        self.tools = McpTools()

    def create_chat(self, history = None):
        chat = self.client.chats.create(model = self.model,
                                        config = types.GenerateContentConfig(system_instruction = self.persona),
                                        history = history)
        return chat

    @staticmethod
    def _retry(call):
        """Run a Gemini call, retrying transient errors with exponential backoff (1 s, 2 s)."""
        delay = 1.0
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                return call()
            except errors.APIError as exc:
                if getattr(exc, 'code', None) not in RETRYABLE_STATUS or attempt == MAX_ATTEMPTS:
                    raise
                logger.warning('Gemini returned %s – retrying in %.0f s (attempt %d/%d)', exc.code, delay, attempt, MAX_ATTEMPTS)
                time.sleep(delay)
                delay *= 2

    def _turn_config(self, question: str, user: UserContext | None = None) -> types.GenerateContentConfig:
        """System instruction for one turn: the persona, the verified data that matches the question and how to reach
        the user's own data – through the MCP tools (account, applications, current screen…), called on demand."""
        data = self.knowledge.context(question)
        declarations = self.tools.declarations()
        instruction = f'{self.persona}\n\n<|PROTECTED_INTERNAL_DATA|>\n{data}\n</|PROTECTED_INTERNAL_DATA|>'
        if user is not None:
            screen = screens.get(user.session_id)
            where = screen.split('\n', 1)[0] if screen else 'nieznany'
            signed_in = 'tak' if user.pue_token else 'nie'
            instruction += f'\n\n<|USER_CONTEXT|>\n{USER_CONTEXT_RULES}\n\nZalogowany: {signed_in}. {where}\n</|USER_CONTEXT|>'
        config = types.GenerateContentConfig(system_instruction = instruction)
        if declarations:
            config.tools = [types.Tool(function_declarations = declarations)]
            # we run the calls ourselves through MCP with the user's token
            config.automatic_function_calling = types.AutomaticFunctionCallingConfig(disable = True)
        return config

    def _send(self, chat, content, config: types.GenerateContentConfig, user: UserContext | None) -> str:
        """Send one user turn; when the model asks for tools, run them via MCP and give it the results."""
        response = self._retry(lambda: chat.send_message(content, config = config))
        for _ in range(MAX_TOOL_ROUNDS):
            calls = response.function_calls
            if not calls or user is None:
                break
            logger.info('ZUSia calls MCP tools: %s', ', '.join(c.name for c in calls))
            results = self.tools.call(calls, user)
            response = self._retry(lambda: chat.send_message(results, config = config))
        if response.function_calls:
            # tool budget used up – ask for an answer with what is known
            final = types.GenerateContentConfig(system_instruction = config.system_instruction)
            response = self._retry(lambda: chat.send_message('Odpowiedz teraz na podstawie zebranych danych.', config = final))
        return response.text

    def text(self, chat, message, user: UserContext | None = None):
        config = self._turn_config(message, user)
        return self._send(chat, message, config, user)

    def img(self, chat, message = '', img_path = None, image_bytes = None, mime_type = None, user: UserContext | None = None):
        parts = [types.Part.from_text(text = message)]

        if img_path:
            mime_type, _ = mimetypes.guess_type(img_path)

            with open(img_path, 'rb') as f:
                image_bytes = f.read()

        if image_bytes is not None:
            parts.append(types.Part.from_bytes(data = image_bytes, mime_type = mime_type or 'image/jpeg'))

        config = self._turn_config(message, user)
        return self._send(chat, parts, config, user)

    def pdf(self, chat, message = '', pdf_bytes = None, user: UserContext | None = None):
        parts = []

        if message.strip():
            parts.append(types.Part.from_text(text = message))

        if pdf_bytes is None:
            raise ValueError('PDF data is required')

        parts.append(types.Part.from_bytes(data = pdf_bytes, mime_type = 'application/pdf'))
        config = self._turn_config(message, user)
        return self._send(chat, parts, config, user)

    def extract_case(self, files: list[tuple[bytes, str]]) -> CaseExtraction:
        """Read the documents of one benefit case (PDFs / scans) and return structured data for the calculators."""
        if not files:
            raise ValueError('At least one document is required')

        parts = [types.Part.from_bytes(data = data, mime_type = mime) for data, mime in files]
        parts.append(types.Part.from_text(text = 'Odczytaj dane z powyższych dokumentów jednej sprawy.'))

        response = self._retry(lambda: self.client.models.generate_content(
            model = self.model,
            contents = parts,
            config = types.GenerateContentConfig(system_instruction = CASE_EXTRACTION_PROMPT,
                                                 response_mime_type = 'application/json',
                                                 response_schema = CaseExtraction,
                                                 temperature = 0)))

        if isinstance(response.parsed, CaseExtraction):
            return response.parsed
        if not response.text:
            raise RuntimeError('The model returned an empty response')
        return CaseExtraction.model_validate_json(response.text)


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

