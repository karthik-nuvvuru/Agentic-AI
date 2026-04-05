"""Rate-limiting middleware using existing Redis cache layer."""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.cache.ratelimit import is_rate_limited
from app.core.config import get_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        # Skip health checks
        if request.url.path in ("/health", "/healthz", "/ready", "/readyz"):
            return await call_next(request)

        settings = get_settings()
        client_id = request.client.host if request.client else "unknown"

        try:
            limited = await is_rate_limited(client_id, rpm=settings.rate_limit_rpm)
        except Exception:
            # If Redis is down, let requests through (fail-open)
            return await call_next(request)

        if limited:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded. Please try again later.",
                    "code": "RATE_LIMITED",
                    "request_id": getattr(request.state, "request_id", "<missing>"),
                },
                headers={"Retry-After": "60"},
            )

        return await call_next(request)


# Stub handler — actual limit enforcement is in the middleware above
async def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded. Please try again later.",
            "code": "RATE_LIMITED",
            "request_id": getattr(request.state, "request_id", "<missing>"),
        },
        headers={"Retry-After": "60"},
    )
