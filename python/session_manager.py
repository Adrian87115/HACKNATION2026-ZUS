import threading
import uuid
from collections import OrderedDict

from google.genai import types

from python.chat_store import ChatStore
from python.zusia import ZUSia


class SessionManager:
    def __init__(self, bot_factory=None, max_sessions: int = 100, store: ChatStore | None = None):
        if max_sessions < 1:
            raise ValueError("max_sessions must be at least 1")

        self.bot_factory = bot_factory or ZUSia
        self.max_sessions = max_sessions
        self.store = store or ChatStore()
        self.bot = None
        self.sessions = OrderedDict()
        self.lock = threading.RLock()

    def _bot(self) -> ZUSia:
        if self.bot is None:
            self.bot = self.bot_factory()
        return self.bot

    def get_bot(self) -> ZUSia:
        with self.lock:
            return self._bot()

    def _cache(self, session_id: str, session: dict) -> dict:
        self.sessions[session_id] = session
        self.sessions.move_to_end(session_id)
        while len(self.sessions) > self.max_sessions:
            self.sessions.popitem(last=False)
        return session

    def create(self) -> str:
        with self.lock:
            bot = self._bot()
            session_id = str(uuid.uuid4())
            chat = bot.create_chat()
            self.store.create_chat(session_id)
            self._cache(session_id, {
                "chat": chat,
                "history": [],
                "turn_lock": threading.Lock(),
            })
            return session_id

    def get(self, session_id: str) -> dict:
        with self.lock:
            session = self.sessions.get(session_id)
            if session is not None:
                self.sessions.move_to_end(session_id)
                return session

            rows = self.store.get_chat(session_id)
            if rows is None:
                raise KeyNotFoundError

            history = []
            display_history = []
            for row in rows:
                role = "user" if row["role"] == "user" else "model"
                parts = []
                if row["content"]:
                    parts.append(types.Part.from_text(text=row["content"]))
                if row["attachment"] is not None:
                    parts.append(types.Part.from_bytes(
                        data=row["attachment"],
                        mime_type=row["attachment_mime"],
                    ))
                history.append(types.Content(role=role, parts=parts))
                display_history.append({"role": row["role"], "content": row["content"]})

            chat = self._bot().create_chat(history=history)
            return self._cache(session_id, {
                "chat": chat,
                "history": display_history,
                "turn_lock": threading.Lock(),
            })

    def append_turn(
        self,
        session_id: str,
        user_content: str,
        assistant_content: str,
        attachment_mime: str | None = None,
        attachment: bytes | None = None,
    ) -> None:
        with self.lock:
            self.store.append_turn(
                session_id,
                user_content,
                assistant_content,
                attachment_mime,
                attachment,
            )
            session = self.sessions.get(session_id)
            if session is not None:
                session["history"].extend([
                    {"role": "user", "content": user_content},
                    {"role": "assistant", "content": assistant_content},
                ])

    def delete(self, session_id: str) -> None:
        with self.lock:
            if not self.store.delete_chat(session_id):
                raise KeyNotFoundError
            self.sessions.pop(session_id, None)


class KeyNotFoundError(Exception):
    pass
