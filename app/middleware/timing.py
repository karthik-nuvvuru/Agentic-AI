"""Attach ``duration_ms`` to structlog context and emit a log at end of request."""
from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

import structlog

log = structlog.get_logger(__name__)


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)

        structlog.contextvars.bind_contextvars(
            duration_ms=duration_ms,
            endpoint=f"{request.method} {request.url.path}",
        )

        # Bind user_id from auth if available
        user = getattr(request.state, "user", None)
        if user and isinstance(user, dict):
            structlog.contextvars.bind_contextvars(user_id=user.get("id", ""))

        if request.url.path not in ("/healthz", "/readyz", "/health", "/ready"):
            log.info(
                "request_complete",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )

        response.headers["X-Request-MS"] = str(duration_ms)
        return response
