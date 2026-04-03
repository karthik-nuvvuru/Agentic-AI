from __future__ import annotations

from fastapi import APIRouter

from app.cache.ratelimit import rate_limit_remaining
from app.core.config import get_settings


router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz():
    return {"status": "ok"}


@router.get("/readyz")
async def readyz():
    s = get_settings()
    llm_ready = bool(s.openai_api_key)

    try:
        remaining = await rate_limit_remaining("health_check")
        redis_ready = remaining >= 0
    except Exception:
        redis_ready = False

    return {
        "status": "ok" if (llm_ready and redis_ready) else "not_ready",
        "llm_ready": llm_ready,
        "redis_ready": redis_ready,
    }
