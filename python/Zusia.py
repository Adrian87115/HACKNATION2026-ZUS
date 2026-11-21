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

        self.client = genai.Client(api_key = api_key)

        # self.model = 'gemini-4-hydrogen'
        self.model = 'gemini-3.1-flash-lite'

        file_path = Path() / 'python' / 'zusia_persona.txt'

        with open(file_path, 'r', encoding = 'utf-8') as file:
            self.persona = file.read()

    def create_chat(self):
        chat = self.client.chats.create(model = self.model,
                                        config = types.GenerateContentConfig(system_instruction = self.persona))
        return chat

    def text(self, chat, message):
        response = chat.send_message(message)
        return response.text

    def img(self, chat, message = '', img_path = None):
        parts = [types.Part.from_text(text = message)]
    
        if img_path:
            mime_type, _ = mimetypes.guess_type(img_path)

            with open(img_path, 'rb') as f:
                image_bytes = f.read()

            parts.append(types.Part.from_bytes(data = image_bytes, mime_type = mime_type or 'image/jpeg'))
            
        response = chat.send_message(parts)
        return response.text

bot = ZUSia()
chat = bot.create_chat()
print(bot.text(chat, ''))