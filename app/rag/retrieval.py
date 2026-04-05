"""Hybrid retrieval: vector + keyword merged via Reciprocal Rank Fusion."""
from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models import Chunk


K = 60  # RRF constant — smoothes rank gaps between the two retrievers
HYBRID_TOP_N = 20  # candidate pool from each retriever before merge


async def hybrid_search(
    session: AsyncSession,
    *,
    settings: Settings,
    query_embedding: list[float],
    query_text: str,
    top_k: int | None = None,
) -> list[Chunk]:
    """Run vector (pgvector cosine) AND keyword (PostgreSQL FTS) in parallel,
    then merge with Reciprocal Rank Fusion: score = 1/(rank_v + K) + 1/(rank_k + K).

    Returns top_k (default rag_top_k) sorted by RRF score descending."""
    k = top_k or settings.rag_top_k

    # ── 1. Vector search (top 20 candidates) ────────────────
    vec_stmt = (
        select(Chunk)
        .order_by(Chunk.embedding.cosine_distance(query_embedding))
        .limit(HYBRID_TOP_N)
    )
    vec_result = await session.execute(vec_stmt)
    vec_chunks: list[Chunk] = list(vec_result.scalars().all())

    # ── 2. Keyword search via tsvector (top 20 candidates) ──
    kw_stmt = (
        select(Chunk)
        .where(Chunk.tsv.isnot(None))
        .where(text("tsv::tsvector @@ websearch_to_tsquery('english', :q)"))
        .params(q=query_text)
        .order_by(text("ts_rank(tsv::tsvector, websearch_to_tsquery('english', :q)) DESC"))
        .params(q=query_text)
        .limit(HYBRID_TOP_N)
    )
    kw_result = await session.execute(kw_stmt)
    kw_chunks: list[Chunk] = list(kw_result.scalars().all())

    # ── 3. RRF merge ────────────────────────────────────────
    rrf_scores: dict[str, float] = {}
    seen: dict[str, Chunk] = {}

    for rank, c in enumerate(vec_chunks, start=1):
        cid = str(c.id)
        rrf_scores[cid] = rrf_scores.get(cid, 0) + 1.0 / (rank + K)
        seen.setdefault(cid, c)

    for rank, c in enumerate(kw_chunks, start=1):
        cid = str(c.id)
        rrf_scores[cid] = rrf_scores.get(cid, 0) + 1.0 / (rank + K)
        seen.setdefault(cid, c)

    ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:k]
    return [seen[cid] for cid, _ in ranked]


# ── Keep old function as thin wrapper for backward compat ────
async def similarity_search(
    session: AsyncSession,
    *,
    settings: Settings,
    query_embedding: list[float],
    top_k: int | None = None,
) -> list[Chunk]:
    """Backward-compatible alias — delegates to hybrid_search with query_text."""
    import warnings
    warnings.warn(
        "similarity_search is deprecated — use hybrid_search with query_text",
        DeprecationWarning,
    )
    return await hybrid_search(
        session,
        settings=settings,
        query_embedding=query_embedding,
        query_text="",
        top_k=top_k,
    )
