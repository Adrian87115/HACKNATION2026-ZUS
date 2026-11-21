import logging
import os
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path

from python.storage import ObjectStorage, StorageError

logger = logging.getLogger(__name__)


class ChatStore:
    """Small SQLite store for chat sessions and turns.

    Attachments go to object storage (MinIO / S3) when configured – SQLite keeps only the object key.
    Without storage they are kept as BLOBs, as before.
    """

    def __init__(self, database_path: str | Path | None = None, storage: ObjectStorage | None = None):
        self.storage = storage
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
            # Migration: object-storage key for attachments (databases created before MinIO support).
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(messages)")}
            if "attachment_key" not in columns:
                connection.execute("ALTER TABLE messages ADD COLUMN attachment_key TEXT")

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
                "SELECT role, content, attachment_mime, attachment, attachment_key FROM messages "
                "WHERE session_id = ? ORDER BY id",
                (session_id,),
            ).fetchall()
        messages = [dict(row) for row in rows]
        for message in messages:
            key = message.pop("attachment_key")
            if key and message["attachment"] is None:
                message["attachment"] = self._load_attachment(key)
        return messages

    def _load_attachment(self, key: str) -> bytes | None:
        if self.storage is None:
            logger.warning("Attachment %s is in object storage, but storage is not configured", key)
            return None
        try:
            return self.storage.get(self.storage.attachments_bucket, key).data
        except StorageError:
            logger.exception("Could not load attachment %s", key)
            return None

    def append_turn(
        self,
        session_id: str,
        user_content: str,
        assistant_content: str,
        attachment_mime: str | None = None,
        attachment: bytes | None = None,
    ) -> None:
        attachment_key = None
        if attachment is not None and self.storage is not None:
            key = f"chats/{session_id}/{uuid.uuid4().hex}"
            try:
                self.storage.put(self.storage.attachments_bucket, key, attachment,
                                 attachment_mime or "application/octet-stream")
                attachment_key, attachment = key, None
            except StorageError:
                # Keep the conversation working – fall back to storing the file in SQLite.
                logger.exception("Could not upload attachment, keeping it in SQLite")

        with closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT INTO messages (session_id, role, content, attachment_mime, attachment, attachment_key) "
                "VALUES (?, 'user', ?, ?, ?, ?)",
                (session_id, user_content, attachment_mime, attachment, attachment_key),
            )
            connection.execute(
                "INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)",
                (session_id, assistant_content),
            )

    def delete_chat(self, session_id: str) -> bool:
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute("DELETE FROM chats WHERE session_id = ?", (session_id,))
            deleted = cursor.rowcount > 0
        if deleted and self.storage is not None:
            try:
                self.storage.delete_prefix(self.storage.attachments_bucket, f"chats/{session_id}/")
            except StorageError:
                logger.exception("Could not delete attachments of chat %s", session_id)
        return deleted
