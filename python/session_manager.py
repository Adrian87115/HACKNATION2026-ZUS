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

    def create(self, persist: bool = False) -> str:
        """Start a chat. Without the user's consent (`persist=False`) it lives only in memory and is gone after a restart."""
        with self.lock:
            bot = self._bot()
            session_id = str(uuid.uuid4())
            chat = bot.create_chat()
            if persist:
                self.store.create_chat(session_id)
            self._cache(session_id, {
                "chat": chat,
                "history": [],
                "turns": [],
                "persist": persist,
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
                "turns": [],
                "persist": True,
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
            session = self.sessions.get(session_id)
            persist = session["persist"] if session is not None else True
            if persist:
                self.store.append_turn(
                    session_id,
                    user_content,
                    assistant_content,
                    attachment_mime,
                    attachment,
                )
            if session is not None:
                session["history"].extend([
                    {"role": "user", "content": user_content},
                    {"role": "assistant", "content": assistant_content},
                ])
                if not persist:
                    # kept in memory only, so the chat can still be saved if the user agrees later
                    session["turns"].append((user_content, assistant_content, attachment_mime, attachment))

    def set_persist(self, session_id: str, persist: bool) -> None:
        """Save the conversation (with the user's consent) or remove the saved copy (consent withdrawn)."""
        with self.lock:
            session = self.get(session_id)
            if persist == session["persist"]:
                return
            if persist:
                self.store.create_chat(session_id)
                for turn in session["turns"]:
                    self.store.append_turn(session_id, *turn)
                session["turns"] = []
            else:
                self.store.delete_chat(session_id)
                # the conversation goes on in memory; keep the files so it can be saved again
                session["turns"] = self._turns_from_history(session)
            session["persist"] = persist

    @staticmethod
    def _turns_from_history(session: dict) -> list[tuple]:
        history = session["history"]
        return [
            (history[i]["content"], history[i + 1]["content"], None, None)
            for i in range(0, len(history) - 1, 2)
        ]

    def delete(self, session_id: str) -> None:
        with self.lock:
            in_memory = self.sessions.pop(session_id, None) is not None
            if not self.store.delete_chat(session_id) and not in_memory:
                raise KeyNotFoundError


class KeyNotFoundError(Exception):
    pass
