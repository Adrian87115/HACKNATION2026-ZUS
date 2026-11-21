import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from python.routers import router
from python.session_manager import SessionManager

def create_app(manager: SessionManager | None = None) -> FastAPI:
    app = FastAPI(title = 'ZUSia API')
    origins = [origin.strip() for origin in os.getenv('CORS_ORIGINS', '*').split(',') if origin.strip()]
    app.add_middleware(CORSMiddleware,
                       allow_origins = origins,
                       allow_credentials = False,
                       allow_methods = ['GET', 'POST', 'DELETE'],
                       allow_headers = ['Content-Type'])
    app.state.sessions = manager or SessionManager()
    app.include_router(router)

    @app.get('/health', tags = ['health'])
    async def health() -> dict[str, str]:
        return {'status': 'ok'}

    return app

app = create_app()