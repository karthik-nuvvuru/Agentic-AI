from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1.agent import router as agent_router
from app.api.v1.rag import router as rag_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.init import init_db
from app.db.session import get_engine


log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(log_level=settings.log_level, json_logs=settings.json_logs)
    log.info("startup", app_env=settings.app_env)
    try:
        await init_db(get_engine())
        log.info("db_initialized")
    except Exception as e:  # noqa: BLE001
        log.error("db_init_failed", error=str(e))
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(o) for o in settings.cors_origins],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health_router)
    app.include_router(agent_router)
    app.include_router(rag_router)
    return app


app = create_app()
