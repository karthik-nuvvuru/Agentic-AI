"""Global exception handlers — structured JSON responses with request_id."""
from __future__ import annotations

import structlog
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger(__name__)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "<missing>")


def _user_id(request: Request) -> str | None:
    user = getattr(request.state, "user", None)
    if isinstance(user, dict):
        return user.get("id")
    return None


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """FastAPI / Starlette HTTP errors → structured JSON."""
    request_id = _request_id(request)
    log.warning(
        "http_error",
        request_id=request_id,
        user_id=_user_id(request),
        path=request.url.path,
        status_code=exc.status_code,
        detail=exc.detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": f"HTTP_{exc.status_code}",
            "request_id": request_id,
        },
    )


async def validation_exception_handler(
    request: Request, exc: (RequestValidationError | PydanticValidationError)
) -> JSONResponse:
    """Pydantic validation errors → field-level details."""
    request_id = _request_id(request)
    log.warning(
        "validation_error",
        request_id=request_id,
        path=request.url.path,
        errors=exc.errors(),
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "code": "VALIDATION_ERROR",
            "request_id": request_id,
            "details": exc.errors(),
        },
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all — logs traceback, returns opaque 500 in prod."""
    request_id = _request_id(request)
    log.exception(
        "unhandled_exception",
        request_id=request_id,
        user_id=_user_id(request),
        path=request.url.path,
        error_type=type(exc).__name__,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "code": "INTERNAL_ERROR",
            "request_id": request_id,
        },
    )
