import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
import mimetypes

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
