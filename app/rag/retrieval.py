from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models import Chunk


async def similarity_search(
    session: AsyncSession,
    *,
    settings: Settings,
    query_embedding: list[float],
    top_k: int | None = None,
) -> list[Chunk]:
    k = top_k or settings.rag_top_k
    stmt = (
        select(Chunk)
        .order_by(Chunk.embedding.cosine_distance(query_embedding))  # type: ignore[attr-defined]
        .limit(k)
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())

