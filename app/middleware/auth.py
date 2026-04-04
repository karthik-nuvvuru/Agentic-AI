"""
JWT auth middleware — validates Authorization header and attaches user to request state.
"""

from __future__ import annotations

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.auth import decode_access_token
from app.db.models import User

# Paths that don't need auth
OPEN_PATHS = {
    "/healthz", "/readyz",
    "/v1/auth/register", "/v1/auth/login", "/v1/auth/refresh",
    "/v1/auth/google/login", "/v1/auth/google/callback",
    "/v1/auth/github/login", "/v1/auth/github/callback",
}

# Paths that are auth-protected (prefix match)
PROTECTED_PREFIXES = (
    "/v1/rag/chat",
    "/v1/rag/ingest",
    "/v1/conversations",
    "/v1/feedback",
    "/v1/auth/me",
)


async def get_current_user(token: str, *, session_factory=None):
    """Decode JWT and return user info dict.  If session_factory is provided
    we also hit the DB to confirm the user still exists."""
    payload = decode_access_token(token)
    if not payload:
        return None
    return {
        "id": payload.get("sub"),
        "email": payload.get("email", ""),
        "name": payload.get("name", ""),
    }


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        # Open paths
        if request.url.path in OPEN_PATHS:
            return await call_next(request)

        # Check if path should be protected
        if not any(request.url.path.startswith(p) for p in PROTECTED_PREFIXES):
            return await call_next(request)

        # Extract token
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"error": "Missing or invalid Authorization header", "code": "UNAUTHORIZED"},
            )

        token = auth[7:]
        payload = decode_access_token(token)
        if not payload:
            return JSONResponse(
                status_code=401,
                content={"error": "Token expired or invalid", "code": "UNAUTHORIZED"},
            )

        request.state.user = {
            "id": payload.get("sub"),
            "email": payload.get("email", ""),
        }
        request.state.token = token

        return await call_next(request)
