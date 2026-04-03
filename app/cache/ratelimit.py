from __future__ import annotations

import time

import redis.asyncio as aioredis

from app.cache import _get_redis_url

_PREFIX = "rl:"
_DEFAULT_RPM = 60  # requests per minute


def _rate_key(client_id: str) -> str:
    return f"{_PREFIX}{client_id}"


async def is_rate_limited(
    client_id: str,
    rpm: int = _DEFAULT_RPM,
    *,
    redis: aioredis.Redis | None = None,
) -> bool:
    """Return True if the client has exceeded *rpm* requests in the current
    sliding window of 60 seconds.  Uses a simple sorted-set so we can
    evict expired entries atomically."""
    try:
        client = redis or aioredis.from_url(
            _get_redis_url(), encoding="utf-8", decode_responses=True
        )
    except Exception:
        return False

    key = _rate_key(client_id)
    now = time.time()
    window = now - 60.0

    pipe = client.pipeline()
    # Remove entries older than the window
    pipe.zremrangebyscore(key, 0, window)
    # Count current window
    pipe.zcard(key)
    # Add this request
    pipe.zadd(key, {f"{now}:{id(object())}": now})
    # Set expiry so the key auto-deletes
    pipe.expire(key, 120)
    results = await pipe.execute()

    request_count = results[1]
    return request_count > rpm


async def rate_limit_remaining(
    client_id: str,
    rpm: int = _DEFAULT_RPM,
    *,
    redis: aioredis.Redis | None = None,
) -> int:
    """Return how many requests are left in the current window."""
    try:
        client = redis or aioredis.from_url(
            _get_redis_url(), encoding="utf-8", decode_responses=True
        )
    except Exception:
        return rpm

    key = _rate_key(client_id)
    now = time.time()
    window = now - 60.0
    count = await client.zcount(key, window, now)
    return max(0, rpm - count)
