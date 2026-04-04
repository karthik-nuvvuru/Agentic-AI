"""Long-term memory system: episodic, semantic, procedural with embeddings."""
from __future__ import annotations

import datetime as dt
import uuid
import structlog
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Memory
from app.llm.client import LLMClient, count_tokens

log = structlog.get_logger(__name__)

MEMORY_TYPES = ["episodic", "semantic", "procedural"]

EPISODIC_SYSTEM_PROMPT = """You are a memory extraction agent. Extract key facts about the user from this conversation.
Focus on: preferences, goals, context, and important statements.
Return a JSON array of strings, each being one memory fact.
Only extract if the information is genuinely about the user. Return [] if nothing worth remembering."""

SEMANTIC_SYSTEM_PROMPT = """You are a knowledge extraction agent. Extract general knowledge or domain facts discussed in this conversation.
Return a JSON array of strings. Return [] if there are no notable facts."""


class MemoryStore:
    """Manages short and long-term user memory with relevance-based retrieval."""

    def __init__(self, session: AsyncSession, llm: LLMClient):
        self.session = session
        self.llm = llm

    async def remember(
        self,
        user_id: str,
        content: str,
        memory_type: str = "episodic",
        embedding: list[float] | None = None,
        metadata_: dict | None = None,
    ) -> Memory:
        mem = Memory(
            user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            memory_type=memory_type,
            content=content,
            embedding=embedding,
            relevance_score=1.0,
            metadata_=metadata_ or {},
        )
        self.session.add(mem)
        await self.session.commit()
        await self.session.refresh(mem)
        log.info("memory_stored", memory_type=memory_type, user_id=str(user_id))
        return mem

    async def recall(
        self,
        user_id: str,
        *,
        query: str,
        memory_types: list[str] | None = None,
        top_k: int = 5,
        min_relevance: float = 0.1,
    ) -> list[Memory]:
        """Retrieve relevant memories via embedding similarity."""
        types = memory_types or MEMORY_TYPES
        uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

        # Embed query
        embeddings = await self.llm.embeddings([query])
        query_emb = embeddings[0]

        stmt = (
            select(Memory)
            .where(
                Memory.user_id == uid,
                Memory.memory_type.in_(types),
                Memory.relevance_score >= min_relevance,
                Memory.embedding.isnot(None),
            )
            .order_by(Memory.embedding.cosine_distance(query_emb))
            .limit(top_k)
        )
        result = await self.session.execute(stmt)
        memories = list(result.scalars().all())

        # Bump access count & relevance
        for m in memories:
            m.access_count += 1
            m.relevance_score = min(10.0, m.relevance_score + 0.01)

        await self.session.commit()

        # Boost access_count so future queries know what's hot
        return memories

    async def forget(self, memory_id: str) -> bool:
        result = await self.session.execute(
            select(Memory).where(Memory.id == uuid.UUID(memory_id))
        )
        mem = result.scalar_one_or_none()
        if mem:
            await self.session.delete(mem)
            await self.session.commit()
            log.info("memory_deleted", memory_id=memory_id)
            return True
        return False

    async def list_memories(
        self,
        user_id: str,
        memory_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        stmt = select(Memory).where(Memory.user_id == uid)
        if memory_type:
            stmt = stmt.where(Memory.memory_type == memory_type)
        stmt = stmt.order_by(Memory.updated_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return [self._to_dict(m) for m in result.scalars().all()]

    async def update_relevance(self, memory_id: str, score: float) -> bool:
        await self.session.execute(
            update(Memory).where(Memory.id == uuid.UUID(memory_id)).values(
                relevance_score=score,
                updated_at=dt.datetime.now(dt.timezone.utc),
            )
        )
        await self.session.commit()
        return True

    async def decay_memories(self, user_id: str, max_age_days: int = 30, decay_rate: float = 0.05) -> int:
        """Reduce relevance scores of old, underused memories."""
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=max_age_days)
        stmt = select(Memory).where(
            Memory.user_id == uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            Memory.relevance_score > 0.1,
            Memory.access_count == 0,
            Memory.created_at < cutoff,
        )
        result = await self.session.execute(stmt)
        count = 0
        for m in result.scalars().all():
            m.relevance_score = max(0.0, m.relevance_score - decay_rate)
            count += 1
        if count:
            await self.session.commit()
        return count

    async def extract_and_store_memories(
        self,
        user_id: str,
        conversation_text: str,
        *,
        llm_model: str | None = None,
    ) -> list[Memory]:
        """Auto-extract memories from a conversation using LLM."""
        import json

        if count_tokens(conversation_text) > 8000:
            conversation_text = conversation_text[:4000]  # trim for extraction

        messages = [
            {"role": "system", "content": EPISODIC_SYSTEM_PROMPT},
            {"role": "user", "content": conversation_text},
        ]
        result = await self.llm.chat(messages=messages, model=llm_model, stream=False)
        content_text = result["message"].get("content", "[]")

        try:
            facts = json.loads(content_text)
        except json.JSONDecodeError:
            facts = []

        memories = []
        uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
        for fact in facts[:10]:  # cap at 10
            if not fact.strip():
                continue
            mem = Memory(
                user_id=uid,
                memory_type="episodic",
                content=fact,
                relevance_score=1.0,
            )
            self.session.add(mem)
            memories.append(mem)

        if memories:
            await self.session.commit()
            log.info("memories_extracted", count=len(memories))

        return memories

    def _to_dict(self, m: Memory) -> dict[str, Any]:
        return {
            "id": str(m.id),
            "type": m.memory_type,
            "content": m.content,
            "relevance_score": m.relevance_score,
            "access_count": m.access_count,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }
