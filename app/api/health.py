from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings


router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz():
    return {"status": "ok"}


@router.get("/readyz")
async def readyz():
    s = get_settings()
    ready = bool(s.openai_api_key)
    return {"status": "ok" if ready else "not_ready", "llm_ready": ready}
