"""Rate-limiting middleware using slowapi (in-memory, token-bucket).

• Public endpoints: 60 req/min per IP
• Authenticated endpoints: 200 req/min per user-ID
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import get_settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],  # we apply decorators per-route
    storage_uri="memory://",
    headers_enabled=True,
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Attach rate-limit headers; actual enforcement is via slowapi decorators."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> JSONResponse | None:
        return await call_next(request)


# ── Custom JSON error for rate-limit exceeded ──────────────────────
async def rate_limit_exceeded_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "<missing>")
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded. Please try again later.",
            "code": "RATE_LIMITED",
            "request_id": request_id,
        },
        headers={"Retry-After": "60"},
    )
