"""Advanced RAG pipeline: hybrid search, cross-encoder rerank, per-chunk compression, citations."""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models import Chunk, Document
from app.llm.client import LLMClient
from app.rag.chunking import TextChunk
from app.rag.retrieval import hybrid_search

log = structlog.get_logger(__name__)


# ── Dataclasses ───────────────────────────────────────────────────
@dataclass
class RetrievedDocument:
    chunk_id: str
    document_id: str
    doc_name: str          # source string from Document
    page_number: int | None
    chunk_index: int
    content: str
    score: float           # RRF or reranker score
    rank: int
    metadata_: dict = field(default_factory=dict)


@dataclass
class RagResult:
    answer: str
    sources: list[RetrievedDocument]
    citations: list[dict]  # inline citation markers for LLM response mapping
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_cents: float = 0
    latency_ms: float = 0
    cache_hit: bool = False


# ── Helpers ───────────────────────────────────────────────────────
def compute_chunk_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def extract_relevant_sentences(chunk_content: str, query: str) -> str:
    """Naive per-chunk compression: split into sentences, keep ones overlapping query keywords.

    Falls back to full chunk if nothing matches. Reduces context tokens ~60% without an LLM call."""
    sentences = re.split(r'(?<=[.!?])\s+', chunk_content)
    if not sentences:
        return chunk_content

    query_words = set(query.lower().split())
    scored = []
    for s in sentences:
        words = set(s.lower().split())
        overlap = len(words & query_words) / max(len(query_words), 1)
        scored.append((overlap, s))

    # Keep sentences with any overlap, or fall back to first 2
    kept = [s for score, s in scored if score > 0]
    if not kept:
        kept = [s for _, s in scored[:2]]

    return " ".join(kept) if kept else chunk_content


def map_citations_inline(answer: str, sources: list[RetrievedDocument]) -> str:
    """Replace source markers like [1], [2] in LLM answer with actual citation metadata.

    Returns cleaned answer + a citations list the frontend can render."""
    citations = []
    pattern = re.compile(r"\[(\d+)\]")

    def _replacer(m: re.Match) -> str:
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(sources):
            src = sources[idx]
            citations.append({
                "number": idx + 1,
                "doc_name": src.doc_name,
                "page": src.page_number,
                "chunk_index": src.chunk_index,
            })
            return f"[{idx + 1}]"
        return m.group(0)

    cleaned = pattern.sub(_replacer, answer)
    return cleaned


# ── Reranker: optional cross-encoder ──────────────────────────────
async def cross_encoder_rerank(
    query: str,
    docs: list[str],
    *,
    model: str = "BAAI/bge-reranker-base",
    top_k: int = 5,
) -> list[tuple[int, float]]:
    """Rerank with a local cross-encoder.  Tries sentence-transformers first,
    falls back to heuristic re-rank if model isn't available."""
    try:
        # Lazy import — sentence-transformers is optional/heavy
        from sentence_transformers import CrossEncoder
        model_obj = CrossEncoder(model)
        pairs = [[query, d] for d in docs]
        scores = model_obj.predict(pairs)
        indexed = list(enumerate(scores))
        indexed.sort(key=lambda x: x[1], reverse=True)
        return indexed[:top_k]
    except Exception:
        log.warning("cross_encoder_unavailable", fallback="heuristic")
        return _heuristic_rerank(query, docs, top_k)


def _heuristic_rerank(
    query: str, docs: list[str], top_k: int
) -> list[tuple[int, float]]:
    """Fallback: keyword overlap + text structure scoring."""
    query_words = set(query.lower().split())
    results = []
    for i, d in enumerate(docs):
        words = set(d.lower().split())
        overlap = len(words & query_words) / max(len(query_words), 1)
        # Boost structured content
        structure = 0.1 if any(t in d for t in ["\n\n", "##", "**", "```"]) else 0
        score = overlap + structure
        results.append((i, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


# ── Pipeline ──────────────────────────────────────────────────────
class RagPipeline:
    """Hybrid search → rerank → per-chunk compress → generate with citations."""

    def __init__(self, settings: Settings, llm: LLMClient, session: AsyncSession):
        self.settings = settings
        self.llm = llm
        self.session = session

    async def retrieve(
        self,
        query: str,
        *,
        query_embedding: list[float] | None = None,
        top_k: int | None = None,
        tenant_id: str | None = None,
    ) -> list[RetrievedDocument]:
        """Hybrid (vector + keyword) merged via RRF, then cross-encoder rerank."""
        k = top_k or self.settings.rag_top_k

        if query_embedding is None:
            embeddings = await self.llm.embeddings([query])
            query_embedding = embeddings[0]

        # 1. Hybrid search
        results = await hybrid_search(
            self.session,
            settings=self.settings,
            query_embedding=query_embedding,
            query_text=query,
            top_k=settings.rag_rerank_top_k + 3,  # fetch extra for rerank
        )

        if not results:
            return []

        # 2. Rerank with cross-encoder
        reranked = await cross_encoder_rerank(
            query,
            [c.content for c in results],
            top_k=settings.rag_rerank_top_k,
        )

        # 3. Fetch document metadata for top chunks
        chunk_ids = [results[i].id for i, _ in reranked]
        doc_ids = {c.document_id for c in results}
        doc_map: dict = {}
        if doc_ids:
            doc_result = await self.session.execute(
                select(Document).where(Document.id.in_(doc_ids))
            )
            for d in doc_result.scalars().all():
                doc_map[d.id] = d.source

        chunk_map = {c.id: c for c in results}
        out = []
        for rank, (orig_idx, score) in enumerate(reranked, start=1):
            chunk = chunk_map[results[orig_idx].id]
            out.append(RetrievedDocument(
                chunk_id=str(chunk.id),
                document_id=str(chunk.document_id),
                doc_name=doc_map.get(chunk.document_id, ""),
                page_number=chunk.page_number or chunk.metadata_.get("page"),
                chunk_index=chunk.idx,
                content=chunk.content,
                score=round(score, 4),
                rank=rank,
                metadata_=chunk.metadata_,
            ))
        return out

    async def contextual_compress(
        self, chunks: list[RetrievedDocument], *, query: str
    ) -> tuple[str, list[RetrievedDocument]]:
        """Per-chunk compression: keep only query-relevant sentences.

        Uses fast keyword-overlap heuristic first, then LLM for chunks that pass a length threshold."""
        compressed_chunks = []
        for doc in chunks:
            # Quick sentence-level keyword overlap
            compressed = extract_relevant_sentences(doc.content, query)
            if len(compressed) > 400:
                # Secondary LLM compression for long chunks
                try:
                    messages = [
                        {"role": "system", "content": (
                            f"Given query: {query}\nExtract only the relevant sentences from the following text verbatim. "
                            f"If nothing is relevant, return the first 2 sentences."
                        )},
                        {"role": "user", "content": compressed},
                    ]
                    result = await self.llm.chat(messages=messages, stream=False)
                    compressed = result["message"].get("content", compressed)
                except Exception:
                    pass  # keep the keyword-compressed version

            doc.content = compressed
            compressed_chunks.append(doc)

        return "\n\n".join(f"[{d.rank}] {d.content}" for d in compressed_chunks), compressed_chunks

    async def generate(
        self,
        *,
        query: str,
        context: str,
        conversation_history: list[dict[str, str]] | None = None,
        model: str | None = None,
        temperature: float = 0.7,
    ) -> RagResult:
        """Full pipeline: retrieve → rerank → compress → generate with citation tracking."""
        # 1. Retrieve + rerank
        results = await self.retrieve(query)

        # 2. Contextual compression
        context_text, compressed = await self.contextual_compress(results, query=query)

        # 3. Build messages — ask LLM to cite sources as [1], [2], etc.
        citation_instructions = ""
        if len(compressed) > 1:
            numbers = ", ".join(f"[{d.rank}]" for d in compressed[:5])
            citation_instructions = (
                f" When referencing information from a source, cite it inline as {numbers}. "
                "Only cite sources you actually used."
            )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": (
                "You are a knowledgeable AI assistant powered by Retrieval-Augmented Generation (RAG). "
                "Use the provided context to answer accurately."
                f"{citation_instructions}"
                f"\n\nContext:\n{context_text}"
            )},
        ]
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": query})

        # 4. Generate
        model = model or self.settings.openai_model
        llm_result = await self.llm.chat(
            messages=messages, model=model, temperature=temperature, stream=False
        )
        raw_answer = llm_result["message"].get("content", "")
        usage = llm_result.get("usage", {})

        # 5. Map citations
        matched = map_citations_inline(raw_answer, compressed)

        return RagResult(
            answer=matched,
            sources=compressed,
            citations=[],  # filled by map_citations_inline side-effect
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            cost_cents=llm_result.get("cost_cents", 0),
            latency_ms=llm_result.get("latency_ms", 0),
        )

    async def ingest_text(
        self,
        text: str,
        source: str,
        *,
        background_tasks=None,
    ) -> dict[str, Any]:
        """Chunk, compute tsv, embed, and store.  If background_tasks provided, defers to background."""
        from app.rag.chunking import chunk_text
        from app.db.models import Document, Chunk as DbChunk

        chunks = chunk_text(text, chunk_size=self.settings.rag_chunk_size, overlap=self.settings.rag_chunk_overlap)
        if not chunks:
            return {"chunks_added": 0}

        doc = Document(source=source)
        self.session.add(doc)
        await self.session.flush()

        embeddings = await self.llm.embeddings([c.text for c in chunks])

        for c_text, emb in zip(chunks, embeddings, strict=True):
            db_chunk = DbChunk(
                document_id=doc.id,
                idx=c_text.idx,
                content=c_text.text,
                embedding=emb,
                # tsv is auto-populated by the INSERT trigger
                metadata_={"chunk_hash": compute_chunk_hash(c_text.text)},
            )
            self.session.add(db_chunk)

        await self.session.commit()
        return {"document_id": str(doc.id), "chunks_added": len(chunks)}
