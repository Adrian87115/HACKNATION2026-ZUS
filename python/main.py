import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from python.cases import router as cases_router
from python.chat_store import ChatStore
from python.routers import router
from python.session_manager import SessionManager
from python.storage import ObjectStorage

load_dotenv()

def create_app(manager: SessionManager | None = None) -> FastAPI:
    app = FastAPI(title = 'ZUSia API')
    origins = [origin.strip() for origin in os.getenv('CORS_ORIGINS', '*').split(',') if origin.strip()]
    app.add_middleware(CORSMiddleware,
                       allow_origins = origins,
                       allow_credentials = False,
                       allow_methods = ['GET', 'POST', 'DELETE'],
                       allow_headers = ['Content-Type'])
    # MinIO / S3 for attachments and case documents (None → files stay in SQLite / are not kept)
    app.state.storage = ObjectStorage.from_env()
    app.state.sessions = manager or SessionManager(store = ChatStore(storage = app.state.storage))
    app.include_router(router)
    app.include_router(cases_router)

    @app.get('/health', tags = ['health'])
    async def health() -> dict[str, str]:
        return {'status': 'ok'}

    return app

app = create_app()