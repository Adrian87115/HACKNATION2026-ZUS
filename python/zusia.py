import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
import mimetypes

from python.case_schemas import CaseExtraction

class ZUSia:
    def __init__(self):
        load_dotenv()
        api_key = os.getenv('ZUS_API_KEY')

        if not api_key:
            raise RuntimeError('ZUS_API_KEY is not configured')

        self.client = genai.Client(api_key = api_key)

        # self.model = 'gemini-4-hydrogen'
        self.model = 'gemini-3.1-flash-lite'

        file_path = Path(__file__).resolve().parent / 'zusia_persona.txt'

        with open(file_path, 'r', encoding = 'utf-8') as file:
            self.persona = file.read()

    def create_chat(self, history = None):
        chat = self.client.chats.create(model = self.model,
                                        config = types.GenerateContentConfig(system_instruction = self.persona),
                                        history = history)
        return chat

    def text(self, chat, message):
        response = chat.send_message(message)
        return response.text

    def img(self, chat, message = '', img_path = None, image_bytes = None, mime_type = None):
        parts = [types.Part.from_text(text = message)]

        if img_path:
            mime_type, _ = mimetypes.guess_type(img_path)

            with open(img_path, 'rb') as f:
                image_bytes = f.read()

        if image_bytes is not None:
            parts.append(types.Part.from_bytes(data = image_bytes, mime_type = mime_type or 'image/jpeg'))

        response = chat.send_message(parts)
        return response.text

    def pdf(self, chat, message = '', pdf_bytes = None):
        parts = []
        
        if message.strip():
            parts.append(types.Part.from_text(text = message))

        if pdf_bytes is None:
            raise ValueError('PDF data is required')

        parts.append(types.Part.from_bytes(data = pdf_bytes, mime_type = 'application/pdf'))
        response = chat.send_message(parts)
        return response.text

    def extract_case(self, files: list[tuple[bytes, str]]) -> CaseExtraction:
        """Read the documents of one benefit case (PDFs / scans) and return structured data for the calculators."""
        if not files:
            raise ValueError('At least one document is required')

        parts = [types.Part.from_bytes(data = data, mime_type = mime) for data, mime in files]
        parts.append(types.Part.from_text(text = 'Odczytaj dane z powyższych dokumentów jednej sprawy.'))

        response = self.client.models.generate_content(
            model = self.model,
            contents = parts,
            config = types.GenerateContentConfig(system_instruction = CASE_EXTRACTION_PROMPT,
                                                 response_mime_type = 'application/json',
                                                 response_schema = CaseExtraction,
                                                 temperature = 0))

        if isinstance(response.parsed, CaseExtraction):
            return response.parsed
        if not response.text:
            raise RuntimeError('The model returned an empty response')
        return CaseExtraction.model_validate_json(response.text)


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

