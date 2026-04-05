from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware, rate_limit_exceeded_handler
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.health import router as health_router
from app.api.v1.agent import router as agent_router
from app.api.v1.auth import router as auth_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.rag import router as rag_router
from app.api.v1.feedback import router as feedback_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.init import init_db
from app.db.session import get_engine, close_engine
from app.exceptions import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.timing import TimingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.auth import AuthMiddleware


log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(log_level=settings.log_level, json_logs=settings.json_logs)
    log.info("app_startup", app=settings.app_name, env=settings.app_env)
    # Fail fast — if DB is down the app must not start silently.
    await init_db(get_engine())
    log.info("database_initialized")
    yield
    await close_engine()
    log.info("app_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    if settings.app_env == "prod":
        docs_kwargs = {"openapi_url": None, "docs_url": None, "redoc_url": None}
    else:
        docs_kwargs = {}

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Production-ready Agentic AI service with RAG, multi-agent orchestration, memory, and tool execution",
        lifespan=lifespan,
        **docs_kwargs,
    )

    # ── Exception handlers ─────────────────────────────────
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)

    # ── Middleware (outermost last = runs first) ───────────
    app.add_middleware(RequestIDMiddleware)     # sets request_id on every log
    app.add_middleware(TimingMiddleware)        # logs duration_ms, endpoint
    app.add_middleware(RateLimitMiddleware)     # IP-based rate limiting
    app.add_middleware(AuthMiddleware)          # JWT auth
    app.add_middleware(SecurityHeadersMiddleware)  # X-Frame, CSP, etc.

    origins = [str(o) for o in settings.cors_origins]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # ── Routes ──────────────────────────────────────────────
    app.include_router(health_router)
    app.include_router(agent_router)
    app.include_router(auth_router)
    app.include_router(rag_router)
    app.include_router(conversations_router)
    app.include_router(feedback_router)

    return app


app = create_app()
