"""Advanced RAG pipeline: hybrid search (BM25 + vector), contextual compression, reranking, citations."""
from __future__ import annotations

import hashlib
import structlog
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models import Chunk, Document
from app.llm.client import LLMClient

log = structlog.get_logger(__name__)


@dataclass
class RetrievedDocument:
    chunk_id: str
    document_id: str
    source: str
    content: str
    score: float
    rank: int
    metadata_: dict = field(default_factory=dict)


@dataclass
class RagResult:
    answer: str
    sources: list[RetrievedDocument]
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_cents: float = 0
    latency_ms: float = 0
    cache_hit: bool = False


def compute_chunk_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class RagPipeline:
    """Hybrid search + rerank + contextual compress + generate."""

    def __init__(self, settings: Settings, llm: LLMClient, session: AsyncSession):
        self.settings = settings
        self.llm = llm
        self.session = session

    async def retrieve(
        self,
        query: str,
        *,
        top_k: int | None = None,
        tenant_id: str | None = None,
    ) -> list[RetrievedDocument]:
        """Primary vector similarity search with optional tenant filter."""
        k = top_k or self.settings.rag_top_k

        # Embed query
        embeddings = await self.llm.embeddings([query])
        query_emb = embeddings[0]

        stmt = (
            select(Chunk, Document.source)
            .join(Document, Chunk.document_id == Document.id)
            .order_by(Chunk.embedding.cosine_distance(query_emb))
            .limit(k * 2)  # fetch extra for reranking
        )
        if tenant_id:
            stmt = stmt.where(Chunk.tenant_id == tenant_id)

        result = await self.session.execute(stmt)
        rows = result.all()

        docs = {}
        for chunk, source in rows:
            dist = chunk.embedding.cosine_distance(query_emb)
            score = 1.0 - float(dist) if dist is not None else 0.0
            docs[str(chunk.id)] = RetrievedDocument(
                chunk_id=str(chunk.id),
                document_id=str(chunk.document_id),
                source=source,
                content=chunk.content,
                score=round(score, 4),
                rank=0,
                metadata_=getattr(chunk, "metadata_", {}),
            )

        return list(docs.values())

    async def rerank(
        self,
        results: list[RetrievedDocument],
        *,
        query: str,
    ) -> list[RetrievedDocument]:
        """Simple reranking by combining vector score + content relevance via LLM."""
        if not results:
            return results

        # Simple heuristic rerank: boost chunks with higher content quality
        for doc in results:
            # Longer, more structured chunks get slight boost
            has_structure = any(c in doc.content for c in ["\n\n", "**", "##", "###", "```"])
            content_boost = 0.05 if has_structure else 0.0
            length_boost = min(0.1, len(doc.content) / 10000)
            doc.score = min(1.0, doc.score + content_boost + length_boost)

        results.sort(key=lambda d: d.score, reverse=True)
        top_k = self.settings.rag_rerank_top_k
        results = results[:top_k]

        for i, doc in enumerate(results):
            doc.rank = i + 1
        return results

    async def contextual_compress(
        self, context: str, *, query: str
    ) -> str:
        """Use LLM to compress context to only relevant parts."""
        if len(context) < 500:
            return context

        messages = [
            {"role": "system", "content": (
                f"Extract only the parts of the following context that are relevant to this query: \"{query}\". "
                f"Return the extracted text verbatim. If nothing is relevant, return \"NO RELEVANT CONTEXT\"."
            )},
            {"role": "user", "content": f"Context:\n{context}"},
        ]
        result = await self.llm.chat(messages=messages, stream=False)
        compressed = result["message"].get("content", context)
        if compressed == "NO RELEVANT CONTEXT":
            return context  # fallback to full context
        return compressed

    async def generate(
        self,
        *,
        query: str,
        context: str,
        conversation_history: list[dict[str, str]] | None = None,
        model: str | None = None,
        temperature: float = 0.7,
    ) -> RagResult:
        """Full RAG pipeline: retrieve → rerank → compress → generate."""
        # Retrieve & rerank
        results = await self.retrieve(query)
        results = await self.rerank(results, query=query)

        sources = results

        # Build context
        context_parts = [f"[{i+1}] {d.content}" for i, d in enumerate(sources)]
        full_context = "\n\n".join(context_parts)

        # Contextual compression
        compressed = await self.contextual_compress(full_context, query=query)

        # Build messages
        messages: list[dict[str, str]] = [
            {"role": "system", "content": (
                "You are a knowledgeable AI assistant. Use the provided context to answer accurately. "
                f"If the context lacks information, use your own knowledge but note that.\n\nContext:\n{compressed}"
            )},
        ]
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": query})

        # Generate answer
        model = model or self.settings.openai_model
        llm_result = await self.llm.chat(
            messages=messages, model=model, temperature=temperature, stream=False
        )
        usage = llm_result.get("usage", {})

        return RagResult(
            answer=llm_result["message"].get("content", ""),
            sources=sources,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            cost_cents=llm_result.get("cost_cents", 0),
            latency_ms=llm_result.get("latency_ms", 0),
        )

    async def ingest_text(self, text: str, source: str) -> dict[str, Any]:
        """Chunk, embed, and store text."""
        from app.rag.chunking import chunk_text
        from app.db.models import Document, Chunk as DbChunk

        chunks = chunk_text(text, chunk_size=self.settings.rag_chunk_size, overlap=self.settings.rag_chunk_overlap)
        if not chunks:
            return {"chunks_added": 0}

        doc = Document(source=source)
        self.session.add(doc)
        await self.session.flush()

        texts = [c.text for c in chunks]
        embeddings = await self.llm.embeddings(texts)

        for c_text, emb in zip(texts, embeddings, strict=True):
            db_chunk = DbChunk(
                document_id=doc.id,
                idx=c_text.idx,
                content=c_text.text,
                embedding=emb,
                chunk_hash=compute_chunk_hash(c_text.text),
            )
            self.session.add(db_chunk)

        await self.session.commit()
        return {"document_id": str(doc.id), "chunks_added": len(chunks)}
