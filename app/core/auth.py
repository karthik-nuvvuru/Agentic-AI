"""
Authentication — JWT with short-lived access, rotating refresh, token blacklist.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── TTL settings ──────────────────────────────────────────────────
_ACCESS_TTL = timedelta(minutes=15)   # 15 min
_REFRESH_TTL = timedelta(days=7)      # 7 days


def _secret() -> str:
    return get_settings().jwt_secret


def _redis_client() -> aioredis.Redis:
    return aioredis.from_url(
        get_settings().redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
    )


# ── Password helpers ──────────────────────────────────────────────
def hash_password(raw: str) -> str:
    return pwd_ctx.hash(raw[:72])


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_ctx.verify(raw[:72], hashed)


# ── Access token (15 min, no refresh capability) ──────────────────
def create_access_token(subject: str | uuid.UUID, extra: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + _ACCESS_TTL
    payload: dict[str, object] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _secret(), algorithm="HS256")


# ── Refresh token (7 days, includes jti for rotation) ────────────
def create_refresh_token(subject: str | uuid.UUID) -> tuple[str, str]:
    """Returns (token_str, jti) so caller can persist the pair."""
    jti = uuid.uuid4().hex
    expire = datetime.now(timezone.utc) + _REFRESH_TTL
    payload: dict[str, object] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, _secret(), algorithm="HS256"), jti


# ── Decode ─────────────────────────────────────────────────────────
def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"])
    except JWTError:
        return None
    if payload.get("type") != "access":
        return None
    return payload


def decode_refresh_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _secret(), algorithms=["HS256"])
    except JWTError:
        return None


# ── Blacklist (stored in Redis) ───────────────────────────────────
_BLACKLIST_PREFIX = "auth:blacklist:"


async def blacklist_token(token: str, *, expire_seconds: int | None = None) -> None:
    """Add token to blacklist.  TTL defaults to token's remaining expiry."""
    try:
        r = _redis_client()
        key = f"{_BLACKLIST_PREFIX}{token}"
        if expire_seconds:
            await r.setex(key, expire_seconds, "1")
        else:
            # Default: 7 days (covers both access & refresh)
            await r.setex(key, 604800, "1")
    except Exception:
        pass  # Don't fail auth if Redis is down


async def is_blacklisted(token: str) -> bool:
    try:
        r = _redis_client()
        return bool(await r.exists(f"{_BLACKLIST_PREFIX}{token}"))
    except Exception:
        return False


async def blacklist_refresh_token(jti: str, ttl_seconds: int = 604800) -> None:
    """Blacklist a refresh token by its jti."""
    try:
        r = _redis_client()
        await r.setex(f"{_BLACKLIST_PREFIX}rt:{jti}", ttl_seconds, "1")
    except Exception:
        pass


async def is_refresh_blacklisted(jti: str) -> bool:
    try:
        r = _redis_client()
        return bool(await r.exists(f"{_BLACKLIST_PREFIX}rt:{jti}"))
    except Exception:
        return False
