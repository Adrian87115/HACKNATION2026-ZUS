import os
import sqlite3
from contextlib import closing
from pathlib import Path


class ChatStore:
    """Small SQLite store for chat sessions, turns, and optional attachments."""

    def __init__(self, database_path: str | Path | None = None):
        configured_path = database_path or os.getenv("ZUSIA_DB_PATH")
        self.path = Path(configured_path) if configured_path else Path(__file__).resolve().parent / "zusia.sqlite3"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with closing(self._connect()) as connection, connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.execute("""
                CREATE TABLE IF NOT EXISTS chats (
                    session_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            connection.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL REFERENCES chats(session_id) ON DELETE CASCADE,
                    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    attachment_mime TEXT,
                    attachment BLOB
                )
            """)
            connection.execute(
                "CREATE INDEX IF NOT EXISTS messages_by_chat ON messages(session_id, id)"
            )

    def create_chat(self, session_id: str) -> None:
        with closing(self._connect()) as connection, connection:
            connection.execute("INSERT INTO chats (session_id) VALUES (?)", (session_id,))

    def get_chat(self, session_id: str) -> list[dict] | None:
        with closing(self._connect()) as connection, connection:
            exists = connection.execute(
                "SELECT 1 FROM chats WHERE session_id = ?", (session_id,)
            ).fetchone()
            if exists is None:
                return None
            rows = connection.execute(
                "SELECT role, content, attachment_mime, attachment FROM messages "
                "WHERE session_id = ? ORDER BY id",
                (session_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def append_turn(
        self,
        session_id: str,
        user_content: str,
        assistant_content: str,
        attachment_mime: str | None = None,
        attachment: bytes | None = None,
    ) -> None:
        with closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT INTO messages (session_id, role, content, attachment_mime, attachment) "
                "VALUES (?, 'user', ?, ?, ?)",
                (session_id, user_content, attachment_mime, attachment),
            )
            connection.execute(
                "INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)",
                (session_id, assistant_content),
            )

    def delete_chat(self, session_id: str) -> bool:
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute("DELETE FROM chats WHERE session_id = ?", (session_id,))
            return cursor.rowcount > 0
