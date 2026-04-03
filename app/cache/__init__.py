from __future__ import annotations

from functools import lru_cache

import redis.asyncio as aioredis

from app.core.config import get_settings


@lru_cache
def _get_redis_url() -> str:
    settings = get_settings()
    return settings.redis_url


async def get_redis() -> aioredis.Redis:
    url = _get_redis_url()
    return aioredis.from_url(
        url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
        retry_on_timeout=True,
        health_check_interval=30,
    )
