import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from python.cases import router as cases_router
from python.chat_store import ChatStore
from python.knowledge.vectors import openai_key
from python.mcp_server import server as mcp_server
from python.routers import router
from python.session_manager import SessionManager
from python.storage import ObjectStorage
from mcp.server.transport_security import TransportSecuritySettings


def create_app(manager: SessionManager | None = None) -> FastAPI:
    # MCP server with read-only tools for ZUSia (user data via the PUE token, current screen, parameters, documents).
    # Stateless JSON over Streamable HTTP; every request carries the user's token, so no MCP sessions are needed.
    # Host checks are off because the service runs behind the dev proxy / Caddy under different host names.
    mcp_app = mcp_server.streamable_http_app(
        streamable_http_path = '/',
        stateless_http = True,
        json_response = True,
        transport_security = TransportSecuritySettings(enable_dns_rebinding_protection = False))

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        async with mcp_server.session_manager.run():
            yield

    app = FastAPI(title = 'ZUSia API', lifespan = lifespan)
    origins = [origin.strip() for origin in os.getenv('CORS_ORIGINS', '*').split(',') if origin.strip()]
    app.add_middleware(CORSMiddleware,
                       allow_origins = origins,
                       allow_credentials = False,
                       allow_methods = ['GET', 'POST', 'PUT', 'DELETE'],
                       allow_headers = ['Content-Type', 'Authorization', 'X-Zusia-Session', 'Mcp-Protocol-Version'])
    # MinIO / S3 for attachments and case documents (None → files stay in SQLite / are not kept)
    app.state.storage = ObjectStorage.from_env()
    app.state.sessions = manager or SessionManager(store = ChatStore(storage = app.state.storage))
    app.include_router(router)
    app.include_router(cases_router)
    app.mount('/mcp', mcp_app)

    @app.get('/health', tags = ['health'])
    async def health() -> dict[str, str | bool]:
        # `assistant` tells the frontend whether chat / case import can work (OpenAI key configured).
        return {'status': 'ok',
                'assistant': bool(openai_key()),
                'storage': app.state.storage is not None}

    return app

app = create_app()