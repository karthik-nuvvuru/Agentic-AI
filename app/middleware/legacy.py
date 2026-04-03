from __future__ import annotations

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.cache.ratelimit import is_rate_limited, rate_limit_remaining
from app.core.config import get_settings

log = structlog.get_logger(__name__)

# Paths exempt from rate limiting
_SKIP_RL = {"/healthz", "/readyz"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in _SKIP_RL:
            return await call_next(request)

        settings = get_settings()
        client_id = request.client.host if request.client else "unknown"

        try:
            limited = await is_rate_limited(client_id, rpm=settings.rate_limit_rpm)
        except Exception:
            return await call_next(request)

        if limited:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)
        return response


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Logs request duration and attaches timing header."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        response.headers["X-Request-MS"] = f"{duration_ms:.1f}"

        if request.url.path not in ("/healthz", "/readyz"):
            log.info(
                "request_complete",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=round(duration_ms, 1),
            )

        return response
