"""
Authentication configuration — JWT, password hashing, OAuth providers.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ------------------------------------------------------------------
# Settings (lazy import to avoid circular deps)
# ------------------------------------------------------------------
def _secret() -> str:
    from app.core.config import get_settings
    return get_settings().jwt_secret


def _ttl() -> int:
    from app.core.config import get_settings
    return get_settings().jwt_ttl_seconds


# ------------------------------------------------------------------
# Password helpers
# ------------------------------------------------------------------
def hash_password(raw: str) -> str:
    # bcrypt has a 72-byte hard limit; truncate and hash
    return pwd_ctx.hash(raw[:72])


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_ctx.verify(raw[:72], hashed)


# ------------------------------------------------------------------
# JWT helpers
# ------------------------------------------------------------------
def create_access_token(subject: str | uuid.UUID, extra: dict | None = None) -> str:
    secret = _secret()
    expire = datetime.now(timezone.utc) + timedelta(seconds=_ttl())
    payload: dict = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _secret(), algorithms=["HS256"])
    except JWTError:
        return None


def create_refresh_token(subject: str | uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode(
        {"sub": str(subject), "exp": expire, "type": "refresh"},
        _secret(),
        algorithm="HS256",
    )
