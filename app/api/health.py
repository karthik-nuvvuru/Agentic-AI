from __future__ import annotations

import structlog
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine
from app.cache import _get_redis_url

import redis.asyncio as aioredis

router = APIRouter(tags=["health"])
log = structlog.get_logger(__name__)


@router.get("/health")
async def health():
    """Liveness probe — always returns 200 if the process is running."""
    return {"status": "ok"}


@router.get("/ready")
async def ready():
    """Readiness probe — verifies DB connection and Redis ping.

    Returns individual component statuses so a deployment orchestrator
    can tell *which* dependency is failing."""
    db_ok = False
    redis_ok = False
    details: list[str] = []

    # ── DB check ─────────────────────────────────────────────────
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        log.warning("healthz_db_check_failed", error=str(e))
        details.append(f"db: {e}")

    # ── Redis check ──────────────────────────────────────────────
    try:
        client = aioredis.from_url(
            _get_redis_url(),
            encoding="utf-8",
            decode_responses=True,
            max_connections=5,
            socket_connect_timeout=3,
        )
        pong = await client.ping()
        await client.aclose()
        redis_ok = bool(pong)
    except Exception as e:
        log.warning("healthz_redis_check_failed", error=str(e))
        details.append(f"redis: {e}")

    status = "ok" if (db_ok and redis_ok) else "degraded"
    return {
        "status": status,
        "db": db_ok,
        "redis": redis_ok,
        "detail": details or None,
    }
