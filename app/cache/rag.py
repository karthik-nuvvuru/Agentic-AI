from __future__ import annotations

import hashlib
import json
import structlog

import redis.asyncio as aioredis

from app.cache import _get_redis_url

log = structlog.get_logger(__name__)

_CACHE_PREFIX = "rag:chat:"
_DEFAULT_TTL = 3600  # 1 hour


def _cache_key(message: str, top_k: int) -> str:
    raw = f"msg={message}|k={top_k}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:12]
    return f"{_CACHE_PREFIX}{digest}"


async def get_cached_response(
    message: str,
    top_k: int,
    *,
    redis: aioredis.Redis | None = None,
) -> dict | None:
    """Return a cached chat response dict, or None on miss / no redis."""
    try:
        client = redis or aioredis.from_url(
            _get_redis_url(), encoding="utf-8", decode_responses=True
        )
        val = await client.get(_cache_key(message, top_k))
    except aioredis.ConnectionError:
        return None
    except Exception:
        return None
    if val:
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return None
    return None


async def set_cached_response(
    message: str,
    top_k: int,
    payload: dict,
    ttl: int = _DEFAULT_TTL,
    *,
    redis: aioredis.Redis | None = None,
) -> None:
    """Store a chat response in the cache with a TTL."""
    try:
        client = redis or aioredis.from_url(
            _get_redis_url(), encoding="utf-8", decode_responses=True
        )
        await client.setex(_cache_key(message, top_k), ttl, json.dumps(payload))
    except Exception as e:
        log.warning("cache_set_failed", error=str(e))


async def invalidate_cache(key: str | None = None) -> None:
    """Invalidate a single key or all RAG cache entries."""
    try:
        client = aioredis.from_url(_get_redis_url(), decode_responses=True)
        if key:
            await client.delete(key)
        else:
            async for k in client.scan_iter(f"{_CACHE_PREFIX}*"):
                await client.delete(k)
    except Exception:
        pass
