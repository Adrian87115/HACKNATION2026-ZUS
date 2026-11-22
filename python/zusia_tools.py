"""ZUSia as an MCP client: lists the tools of the ZUSia MCP server (python/mcp_server.py) as Gemini function
declarations and executes the function calls the model makes, on behalf of the signed-in user.

The user's PUE token and the chat session id travel only in the HTTP headers of the MCP connection – the model
never sees them and cannot ask for anyone else's data.
"""
import asyncio
import json
import logging
import threading
from dataclasses import dataclass

import httpx2
from google.genai import types
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from python.config import setting

logger = logging.getLogger(__name__)


@dataclass(frozen = True)
class UserContext:
    """Who is asking and from which conversation (used for the MCP headers of one turn)."""
    session_id: str
    pue_token: str | None = None


class McpTools:
    def __init__(self, url: str | None = None):
        self.url = url or setting('ZUSIA_MCP_URL', 'http://127.0.0.1:8001/mcp/')
        self._declarations: list[types.FunctionDeclaration] | None = None
        self._lock = threading.Lock()

    def _client(self, user: UserContext | None = None) -> Client:
        headers = {}
        if user:
            headers['X-Zusia-Session'] = user.session_id
            if user.pue_token:
                headers['Authorization'] = f'Bearer {user.pue_token}'
        http = httpx2.AsyncClient(headers = headers, timeout = httpx2.Timeout(15.0))
        return Client(streamable_http_client(self.url, http_client = http))

    def declarations(self) -> list[types.FunctionDeclaration]:
        """Tool list from the MCP server (fetched once). Empty when the server is unreachable – ZUSia then answers without tools."""
        with self._lock:
            if self._declarations is None:
                try:
                    self._declarations = asyncio.run(self._list())
                    logger.info('ZUSia MCP tools: %s', ', '.join(d.name for d in self._declarations))
                except Exception:
                    logger.exception('MCP server unavailable at %s – answering without tools', self.url)
                    return []
            return self._declarations

    async def _list(self) -> list[types.FunctionDeclaration]:
        async with self._client() as client:
            result = await client.list_tools()
        return [types.FunctionDeclaration(name = t.name, description = t.description or '', parameters_json_schema = t.input_schema)
                for t in result.tools]

    def call(self, calls: list[types.FunctionCall], user: UserContext) -> list[types.Part]:
        """Run the model's function calls over one MCP connection and return the function responses."""
        return asyncio.run(self._call(calls, user))

    async def _call(self, calls: list[types.FunctionCall], user: UserContext) -> list[types.Part]:
        parts = []
        async with self._client(user) as client:
            for call in calls:
                try:
                    result = await client.call_tool(call.name, dict(call.args or {}))
                    if result.structured_content is not None:
                        payload = result.structured_content
                    else:
                        text = ''.join(getattr(c, 'text', '') for c in result.content)
                        try:
                            payload = json.loads(text)
                        except ValueError:
                            payload = {'tekst': text}
                    if result.is_error:
                        payload = {'blad': payload}
                except Exception:
                    logger.exception('MCP tool %s failed', call.name)
                    payload = {'blad': 'Nie udało się pobrać danych – odpowiedz bez nich i zaproponuj spróbowanie później.'}
                if not isinstance(payload, dict):
                    payload = {'wynik': payload}
                parts.append(types.Part.from_function_response(name = call.name, response = payload))
        return parts
