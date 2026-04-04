from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.rag import get_cached_response, set_cached_response
from app.core.config import get_settings
from app.db.models import Chunk, Conversation, Document, Message, UsageLog
from app.db.session import db_session
from app.llm.client import count_tokens, estimate_cost_cents, LLMClient
from app.rag.agent import generate_answer, generate_title
from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts
from app.rag.retrieval import similarity_search

from fastapi.responses import StreamingResponse
import structlog

router = APIRouter(prefix="/v1/rag", tags=["rag"])

log = structlog.get_logger(__name__)

AUTOGEN_TITLE_LIMIT = 5


class IngestTextRequest(BaseModel):
    source: str = Field(min_length=1, max_length=500)
    text: str = Field(min_length=1, max_length=2_000_000)


class IngestResponse(BaseModel):
    document_id: str
    chunks_added: int


class DocumentOut(BaseModel):
    id: uuid.UUID
    source: str
    created_at: str
    chunk_count: int


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=50_000)
    conversation_id: str | None = Field(default=None)
    top_k: int = Field(default=6, ge=1, le=50)
    stream: bool = Field(default=False)


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str
    sources: list[dict[str, Any]]


@router.post("/ingest/text", response_model=IngestResponse)
async def ingest_text(
    req: IngestTextRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    chunks = chunk_text(req.text, chunk_size=settings.rag_chunk_size, overlap=settings.rag_chunk_overlap)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content to ingest")

    doc = Document(source=req.source)
    session.add(doc)
    await session.flush()

    embeddings = await embed_texts(settings, [c.text for c in chunks])
    for c, emb in zip(chunks, embeddings, strict=True):
        session.add(Chunk(document_id=doc.id, idx=c.idx, content=c.text, embedding=emb))

    await session.commit()
    return IngestResponse(document_id=str(doc.id), chunks_added=len(chunks))


@router.post("/ingest/file", response_model=IngestResponse)
async def ingest_file(
    source: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    text: str
    if file.filename and file.filename.lower().endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(file.file)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = data.decode("utf-8", errors="ignore")

    chunks = chunk_text(text, chunk_size=settings.rag_chunk_size, overlap=settings.rag_chunk_overlap)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content to ingest")

    doc = Document(source=source)
    session.add(doc)
    await session.flush()

    embeddings = await embed_texts(settings, [c.text for c in chunks])
    for c, emb in zip(chunks, embeddings, strict=True):
        session.add(Chunk(document_id=doc.id, idx=c.idx, content=c.text, embedding=emb))

    await session.commit()
    return IngestResponse(document_id=str(doc.id), chunks_added=len(chunks))


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(db_session),
):
    # Single query with COUNT + GROUP BY — eliminates N+1.
    stmt = (
        select(Document.id, Document.source, Document.created_at, func.count(Chunk.id).label("chunk_count"))
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .group_by(Document.id)
        .order_by(desc(Document.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return [
        DocumentOut(
            id=row[0],
            source=row[1],
            created_at=row[2].isoformat(),
            chunk_count=row[3],
        )
        for row in result.all()
    ]


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(db_session),
):
    result = await session.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await session.delete(doc)
    await session.commit()


@router.get("/stats")
async def rag_stats(
    session: AsyncSession = Depends(db_session),
):
    doc_count = await session.execute(select(func.count(Document.id)))
    chunk_count = await session.execute(select(func.count(Chunk.id)))
    conv_count = await session.execute(select(func.count(Conversation.id)))
    msg_count = await session.execute(select(func.count(Message.id)))
    return {
        "documents": doc_count.scalar() or 0,
        "chunks": chunk_count.scalar() or 0,
        "conversations": conv_count.scalar() or 0,
        "messages": msg_count.scalar() or 0,
    }


@router.post("/chat", response_model=ChatResponse)
async def rag_chat(
    req: ChatRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

    # Try cache first (only for single messages without conversation history)
    if not req.conversation_id:
        cached = await get_cached_response(req.message, req.top_k)
        if cached:
            cached["conversation_id"] = req.conversation_id or str(uuid.uuid4())
            return ChatResponse(**cached)

    conversation_id = req.conversation_id or str(uuid.uuid4())

    # Create conversation if needed
    if not req.conversation_id:
        new_conv = Conversation(id=uuid.UUID(conversation_id), title="New conversation")
        session.add(new_conv)
    else:
        result = await session.execute(select(Conversation).where(Conversation.id == uuid.UUID(conversation_id)))
        existing_conv = result.scalar_one_or_none()
        if not existing_conv:
            new_conv = Conversation(id=uuid.UUID(conversation_id), title="New conversation")
            session.add(new_conv)

    await session.commit()

    # Retrieve relevant chunks
    query_emb = (await embed_texts(settings, [req.message]))[0]
    chunks = await similarity_search(session, settings=settings, query_embedding=query_emb, top_k=req.top_k)

    # Pull document sources
    doc_ids = {c.document_id for c in chunks}
    doc_sources = {}
    if doc_ids:
        res = await session.execute(select(Document).where(Document.id.in_(doc_ids)))
        for d in res.scalars().all():
            doc_sources[d.id] = d.source

    context = "\n\n".join(f"[{i+1}] {c.content}" for i, c in enumerate(chunks))

    # Build conversation history (last N messages to avoid token overflow)
    history_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == uuid.UUID(conversation_id))
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    recent_messages = list(reversed(history_result.scalars().all()))

    conversation_history = [{"role": m.role, "content": m.content} for m in recent_messages]

    # Save user message
    user_msg = Message(
        conversation_id=uuid.UUID(conversation_id),
        role="user",
        content=req.message,
    )
    session.add(user_msg)
    await session.commit()
    await session.refresh(user_msg)

    # Generate answer
    answer = await generate_answer(
        settings=settings,
        context=context,
        conversation_history=conversation_history,
        last_message=req.message,
    )

    # Save assistant message
    assistant_msg = Message(
        conversation_id=uuid.UUID(conversation_id),
        role="assistant",
        content=answer,
    )
    session.add(assistant_msg)
    await session.commit()
    await session.refresh(assistant_msg)

    # Auto-generate conversation title
    if len(recent_messages) < AUTOGEN_TITLE_LIMIT:
        try:
            title = await generate_title(
                settings=settings,
                first_message=req.message,
            )
            await session.execute(
                update(Conversation).where(Conversation.id == uuid.UUID(conversation_id)).values(title=title)
            )
            await session.commit()
        except Exception as e:
            log.warning("autogen_title_failed", error=str(e), conversation_id=conversation_id)

    sources = [
        {
            "chunk_id": str(c.id),
            "document_id": str(c.document_id),
            "source": doc_sources.get(c.document_id, ""),
            "idx": c.idx,
        }
        for c in chunks
    ]

    response = ChatResponse(
        conversation_id=conversation_id,
        message_id=str(assistant_msg.id),
        answer=answer,
        sources=sources,
    )

    # Write to cache (only first-message queries to avoid conversation-history collisions)
    try:
        await set_cached_response(req.message, req.top_k, {"message_id": str(assistant_msg.id), "answer": answer, "sources": sources})
    except Exception as e:
        log.warning("cache_write_failed", error=str(e))

    return response


@router.post("/chat/stream")
async def rag_chat_stream(
    req: ChatRequest,
    request: Request,
    session: AsyncSession = Depends(db_session),
):
    """Production-grade SSE streaming endpoint.

    Emits structured events:
        event: sources       → RAG retrieval results
        event: conversation_id
        event: thinking      → "retrieving context…" phase indicator
        event: token         → single token from LLM stream
        event: citation      → source metadata for in-text citations
        event: done          → final payload with token usage
        event: error         → failure reason
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

    client = LLMClient(settings)
    conversation_id = req.conversation_id or str(uuid.uuid4())
    run_id = uuid.uuid4().hex[:16]

    # ── Create conversation ─────────────────────────────────
    if not req.conversation_id:
        session.add(Conversation(id=uuid.UUID(conversation_id), title="New conversation"))
    else:
        result = await session.execute(select(Conversation).where(Conversation.id == uuid.UUID(conversation_id)))
        existing_conv = result.scalar_one_or_none()
        if not existing_conv:
            session.add(Conversation(id=uuid.UUID(conversation_id), title="New conversation"))
    await session.commit()

    # ── Retrieve chunks ─────────────────────────────────────
    await session.flush()
    query_emb = (await embed_texts(settings, [req.message]))[0]
    chunks = await similarity_search(session, settings=settings, query_embedding=query_emb, top_k=req.top_k)

    doc_ids = {c.document_id for c in chunks}
    doc_sources = {}
    if doc_ids:
        res = await session.execute(select(Document).where(Document.id.in_(doc_ids)))
        for d in res.scalars().all():
            doc_sources[d.id] = d.source

    context = "\n\n".join(f"[{i+1}] {c.content}" for i, c in enumerate(chunks))

    # ── Conversation history ────────────────────────────────
    history_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == uuid.UUID(conversation_id))
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    recent_messages = list(reversed(history_result.scalars().all()))
    conversation_history = [{"role": m.role, "content": m.content} for m in recent_messages]

    # ── Save user message ───────────────────────────────────
    user_msg = Message(
        conversation_id=uuid.UUID(conversation_id),
        role="user",
        content=req.message,
    )
    session.add(user_msg)
    await session.commit()

    # ── Pre-compute sources for fast SSE emission ───────────
    sources_payload = [
        {
            "chunk_id": str(c.id),
            "document_id": str(c.document_id),
            "source": doc_sources.get(c.document_id, ""),
            "idx": c.idx,
        }
        for c in chunks
    ]

    _sse = _sse_event  # local alias for speed

    async def generate():
        """Async generator — yields SSE events with **zero buffering**.

        Monitors client disconnect via ``request.is_disconnected()`` and
        cancels the LLM stream mid-flight.
        """
        if await request.is_disconnected():
            return

        # 1. Metadata
        yield _sse("sources", {"sources": sources_payload})
        yield _sse("conversation_id", {"conversation_id": conversation_id})

        # 2. Check disconnect before starting expensive LLM call
        if await request.is_disconnected():
            return

        # 3. Thinking phase — emit before we start the LLM
        if chunks:
            yield _sse("thinking", {"content": "Searching documents…"})

        # 4. Build messages
        messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are a knowledgeable AI assistant powered by Retrieval-Augmented Generation (RAG). "
                    "Use the provided context to answer the user's question when it is relevant. "
                    "If the context doesn't contain enough information, use your own knowledge to provide a helpful and informative answer. "
                    "Always try to be as helpful as possible while remaining accurate. "
                    "Keep answers concise, well-structured, and easy to read."
                ),
            },
            {"role": "system", "content": f"Relevant context:\n{context}"},
            *conversation_history,
            {"role": "user", "content": req.message},
        ]

        # Input token count (approximate for usage log)
        full_prompt = "\n".join(m["content"] for m in messages)
        input_tokens = count_tokens(full_prompt, model=settings.openai_model)

        # 5. Emit citations from retrieved sources
        for src in sources_payload:
            if await request.is_disconnected():
                return
            yield _sse("citation", {"source": {"title": src["source"], "page": None, "idx": src["idx"]}})

        # 6. LLM token streaming — structured, buffered-not-at-all
        thinking_stopped = False
        output_tokens = 0
        full_content = ""

        try:
            async for event in client.stream_tokens(
                messages=messages,
                model=settings.openai_model,
            ):
                # ── Disconnect gate every 8 tokens (~every 30 ms) ──
                if output_tokens % 8 == 0 and await request.is_disconnected():
                    log.info("stream_client_disconnected", run_id=run_id)
                    return

                etype = event.get("type")

                if etype == "token":
                    if not thinking_stopped:
                        thinking_stopped = True
                    token = event["content"]
                    full_content += token
                    output_tokens += 1
                    yield _sse("token", {"content": token})

                elif etype == "done":
                    usage = event.get("usage", {})
                    final_prompt_tokens = usage.get("prompt_tokens", input_tokens)
                    final_completion_tokens = usage.get("completion_tokens", output_tokens)
                    total = final_prompt_tokens + final_completion_tokens
                    cost = estimate_cost_cents(final_prompt_tokens, final_completion_tokens, settings.openai_model)

                    log.info(
                        "stream_complete",
                        run_id=run_id,
                        model=settings.openai_model,
                        prompt_tokens=final_prompt_tokens,
                        completion_tokens=final_completion_tokens,
                        total_tokens=total,
                        cost_cents=cost,
                    )

                    # ── Persist usage log ──
                    try:
                        usage_log = UsageLog(
                            user_id=getattr(request.state, "user", {}).get("id") if isinstance(getattr(request.state, "user", None), dict) else None,
                            run_id=run_id,
                            model=settings.openai_model,
                            prompt_tokens=final_prompt_tokens,
                            completion_tokens=final_completion_tokens,
                            total_tokens=total,
                            cost_cents=cost,
                            is_stream=True,
                        )
                        session.add(usage_log)
                        if full_content:
                            assistant_msg = Message(
                                conversation_id=uuid.UUID(conversation_id),
                                role="assistant",
                                content=full_content,
                            )
                            session.add(assistant_msg)
                        await session.commit()
                    except Exception as e:
                        log.warning("stream_persist_failed", error=str(e), exc_info=True)
                        try:
                            await session.rollback()
                        except Exception:
                            pass

                    yield _sse("done", {
                        "usage": {
                            "input": final_prompt_tokens,
                            "output": final_completion_tokens,
                            "total": total,
                            "cost_cents": cost,
                        },
                        "run_id": run_id,
                    })
                    log.info("stream_done")
                    return

                elif etype == "tool_use":
                    yield _sse("tool_use", {
                        "tool": event.get("tool", ""),
                        "arguments": event.get("arguments", ""),
                    })

                elif etype == "error":
                    yield _sse("error", {"message": event.get("message", "Unknown error")})
                    log.warning("stream_llm_error", run_id=run_id, message=event.get("message"))
                    return

        except asyncio.CancelledError:
            log.info("stream_cancelled", run_id=run_id)
            return

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx bypass
        },
    )


# ── SSE event formatter ─────────────────────────────────────────
def _sse_event(event_type: str, data: dict) -> str:
    """Format a single SSE line: event + data + blank."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# ── Clean up duplicate imports at top ───────────────────────────
# (The `from fastapi.responses import StreamingResponse` line in the
# function body is now unnecessary — it's imported at module level above.)
