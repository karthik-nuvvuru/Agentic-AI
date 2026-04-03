from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.api.health import router as health_router
from app.api.v1.agent import router as agent_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.rag import router as rag_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.init import init_db
from app.db.session import get_engine
from app.exceptions import global_exception_handler, validation_exception_handler
from app.middleware import RequestTimingMiddleware


log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(log_level=settings.log_level, json_logs=settings.json_logs)
    log.info("app_startup", app=settings.app_name, env=settings.app_env)
    try:
        await init_db(get_engine())
        log.info("database_initialized")
    except Exception as e:
        log.error("database_init_failed", error=str(e))
    yield
    log.info("app_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    if settings.app_env == "prod":
        docs_kwargs = {"openapi_url": None, "docs_url": None, "redoc_url": None}
    else:
        docs_kwargs = {}

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Production-ready Agentic AI service with RAG and LangGraph",
        lifespan=lifespan,
        **docs_kwargs,
    )

    app.add_middleware(RequestTimingMiddleware)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(o) for o in settings.cors_origins],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Exception handlers
    app.add_exception_handler(Exception, global_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)

    # Routes
    app.include_router(health_router)
    app.include_router(agent_router)
    app.include_router(rag_router)
    app.include_router(conversations_router)

    return app


app = create_app()
