"""RAG API — hybrid search, streaming SSE, async ingestion, rich citations."""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from app.cache.rag import get_cached_response, set_cached_response
from app.core.config import get_settings
from app.db.models import (
    Chunk,
    Conversation,
    Document,
    IngestJob,
    Message,
)
from app.db.session import db_session
from app.llm.client import count_tokens, estimate_cost_cents, LLMClient
from app.rag.agent import generate_answer, generate_title
from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts
from app.rag.retrieval import hybrid_search

from fastapi.responses import StreamingResponse

# ---------------------------------------------------------------------------
# Router + logger
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/v1/rag", tags=["rag"])

log = structlog.get_logger(__name__)

AUTOGEN_TITLE_LIMIT = 5

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class IngestTextRequest(BaseModel):
    source: str = Field(min_length=1, max_length=500)
    text: str = Field(min_length=1, max_length=2_000_000)


class IngestResponse(BaseModel):
    document_id: str
    chunks_added: int


class AsyncIngestResponse(BaseModel):
    job_id: str


class IngestJobOut(BaseModel):
    job_id: str
    source: str
    status: str
    progress: float
    document_id: str | None = None
    chunks_added: int = 0
    error: str | None = None

    model_config = {"from_attributes": True}


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


class ChatResult:
    """Holds everything needed after retrieval — reused by chat and stream."""
    def __init__(
        self,
        chunks: list[Chunk],
        doc_sources: dict,           # doc_id -> source str
        context: str,
        sources_payload: list[dict],
        conversation_id: str,
        conversation_history: list[dict[str, str]],
    ):
        self.chunks = chunks
        self.doc_sources = doc_sources
        self.context = context
        self.sources_payload = sources_payload
        self.conversation_id = conversation_id
        self.conversation_history = conversation_history


# ---------------------------------------------------------------------------
# Shared: ingest a file's text into the DB (background task)
# ---------------------------------------------------------------------------
async def _do_ingest(
    text: str,
    source: str,
    job_id: str,
) -> None:
    """Chunk, embed, and store — used by BackgroundTasks."""
    from app.db.session import get_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker

    settings = get_settings()
    engine = get_engine()
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        chunks = chunk_text(text, chunk_size=settings.rag_chunk_size, overlap=settings.rag_chunk_overlap)
        if not chunks:
            await session.execute(
                update(IngestJob).where(IngestJob.id == uuid.UUID(job_id)).values(
                    status="failed", error="No content to ingest"
                )
            )
            await session.commit()
            return

        doc = Document(source=source)
        session.add(doc)
        await session.flush()

        embeddings = await embed_texts(settings, [c.text for c in chunks])
        for c, emb in zip(chunks, embeddings, strict=True):
            session.add(Chunk(document_id=doc.id, idx=c.idx, content=c.text, embedding=emb))

        await session.commit()

        # Update job status (separate session)
        async with factory() as s2:
            await s2.execute(
                update(IngestJob).where(IngestJob.id == uuid.UUID(job_id)).values(
                    status="done",
                    progress=1.0,
                    document_id=doc.id,
                    chunks_added=len(chunks),
                )
            )
            await s2.commit()


# ---------------------------------------------------------------------------
# Shared: hybrid retrieval + context builder (used by both endpoints)
# ---------------------------------------------------------------------------
async def _build_chat_context(
    session: AsyncSession,
    settings,
    message: str,
    conversation_id: str,
    top_k: int,
) -> ChatResult:
    """Embed query, hybrid search, resolve doc metadata, build context string."""
    query_emb = (await embed_texts(settings, [message]))[0]
    chunks = await hybrid_search(
        session,
        settings=settings,
        query_embedding=query_emb,
        query_text=message,
        top_k=top_k,
    )

    # Resolve document sources
    doc_ids = {c.document_id for c in chunks}
    doc_sources: dict = {}
    if doc_ids:
        res = await session.execute(select(Document).where(Document.id.in_(doc_ids)))
        for d in res.scalars().all():
            doc_sources[d.id] = d.source

    # Build context with citation markers
    context = "\n\n".join(f"[{i+1}] {c.content}" for i, c in enumerate(chunks))

    # History
    history_result = await session.execute(
        select(Message)
        .where(Message.conversation_id == uuid.UUID(conversation_id))
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    recent = list(reversed(history_result.scalars().all()))

    # Source payload for SSE with rich citations
    sources_payload = []
    for i, c in enumerate(chunks, start=1):
        dsrc = doc_sources.get(c.document_id, "")
        page = c.page_number if hasattr(c, "page_number") else None
        if page is None:
            page = c.metadata_.get("page") if hasattr(c, "metadata_") and c.metadata_ else None
        sources_payload.append({
            "chunk_id": str(c.id),
            "document_id": str(c.document_id),
            "source": dsrc,
            "doc_name": dsrc,
            "page": page,
            "idx": c.idx,
            "number": i,
        })

    return ChatResult(
        chunks=chunks,
        doc_sources=doc_sources,
        context=context,
        sources_payload=sources_payload,
        conversation_id=conversation_id,
        conversation_history=[{"role": m.role, "content": m.content} for m in recent],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

# ── Sync text ingestion (quick dev use) ──────────────────────────────────
@router.post("/ingest/text", response_model=IngestResponse)
async def ingest_text(
    req: IngestTextRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    chks = chunk_text(req.text, chunk_size=settings.rag_chunk_size, overlap=settings.rag_chunk_overlap)
    if not chks:
        raise HTTPException(status_code=400, detail="No content to ingest")

    doc = Document(source=req.source)
    session.add(doc)
    await session.flush()

    embeddings = await embed_texts(settings, [c.text for c in chks])
    for c, emb in zip(chks, embeddings, strict=True):
        session.add(Chunk(document_id=doc.id, idx=c.idx, content=c.text, embedding=emb))

    await session.commit()
    return IngestResponse(document_id=str(doc.id), chunks_added=len(chks))


# ── Async file ingestion ─────────────────────────────────────────────────
@router.post("/ingest/file", response_model=AsyncIngestResponse, status_code=202)
async def ingest_file(
    bg: BackgroundTasks,
    source: str | None = Query(default=None),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(db_session),
):
    """Start async file ingestion — returns job_id immediately."""
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

    chks = chunk_text(text)
    if not chks:
        raise HTTPException(status_code=400, detail="No content to ingest")

    src = source or file.filename or "unknown"

    # Create job record
    job = IngestJob(source=src)
    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Defer heavy work to background
    bg.add_task(_do_ingest, text, src, str(job.id))

    return AsyncIngestResponse(job_id=str(job.id))


# ── Job status ────────────────────────────────────────────────────────────
@router.get("/ingest/status/{job_id}", response_model=IngestJobOut)
async def get_ingest_status(
    job_id: uuid.UUID,
    session: AsyncSession = Depends(db_session),
):
    """Check ingestion job progress."""
    result = await session.execute(select(IngestJob).where(IngestJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return IngestJobOut(
        job_id=str(job.id),
        source=job.source,
        status=job.status,
        progress=job.progress,
        document_id=str(job.document_id),
        chunks_added=job.chunks_added,
        error=job.error,
    )


# ── Document listing ─────────────────────────────────────────────────────
@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(db_session),
):
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
        DocumentOut(id=row[0], source=row[1], created_at=row[2].isoformat(), chunk_count=row[3])
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


@router.get("/stats", status_code=200)
async def rag_stats(session: AsyncSession = Depends(db_session)):
    docs = await session.execute(select(func.count(Document.id)))
    chks = await session.execute(select(func.count(Chunk.id)))
    return {"documents": docs.scalar() or 0, "chunks": chks.scalar() or 0}


# ── Chat (non-streaming) ─────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse, status_code=200)
async def rag_chat(
    req: ChatRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

    # Try cache first
    if not req.conversation_id:
        cached = await get_cached_response(req.message, req.top_k)
        if cached:
            cached["conversation_id"] = req.conversation_id or str(uuid.uuid4())
            return ChatResponse(**cached)

    conversation_id = req.conversation_id or str(uuid.uuid4())

    # Create conversation if needed
    if not req.conversation_id:
        session.add(Conversation(id=uuid.UUID(conversation_id), title="New conversation"))
    else:
        result = await session.execute(select(Conversation).where(Conversation.id == uuid.UUID(conversation_id)))
        existing_conv = result.scalar_one_or_none()
        if not existing_conv:
            session.add(Conversation(id=uuid.UUID(conversation_id), title="New conversation"))
    await session.commit()

    # Hybrid retrieval + context
    ctx = await _build_chat_context(session, settings, req.message, conversation_id, req.top_k)

    # Save user message
    user_msg = Message(conversation_id=uuid.UUID(conversation_id), role="user", content=req.message)
    session.add(user_msg)
    await session.commit()

    # Generate answer with enriched context
    answer = await generate_answer(
        settings=settings,
        context=ctx.context,
        conversation_history=ctx.conversation_history,
        last_message=req.message,
    )

    # Save assistant response
    assistant_msg = Message(conversation_id=uuid.UUID(conversation_id), role="assistant", content=answer)
    session.add(assistant_msg)
    await session.commit()

    # Auto-title
    if len(ctx.conversation_history) < AUTOGEN_TITLE_LIMIT:
        try:
            title = await generate_title(settings=settings, first_message=req.message)
            await session.execute(
                update(Conversation).where(Conversation.id == uuid.UUID(conversation_id)).values(title=title)
            )
            await session.commit()
        except Exception as e:
            log.warning("autogen_title_failed", error=str(e), conversation_id=conversation_id)

    response = ChatResponse(
        conversation_id=conversation_id,
        message_id=str(assistant_msg.id),
        answer=answer,
        sources=ctx.sources_payload,
    )

    # Cache
    try:
        await set_cached_response(req.message, req.top_k, {
            "message_id": str(assistant_msg.id),
            "answer": answer,
            "sources": ctx.sources_payload,
        })
    except Exception as e:
        log.warning("cache_write_failed", error=str(e), conversation_id=conversation_id)

    return response


# ── Chat streaming ───────────────────────────────────────────────────────
@router.post("/chat/stream")
async def rag_chat_stream(
    req: ChatRequest,
    request: Request,
    session: AsyncSession = Depends(db_session),
):
    """SSE streaming with hybrid search, rich citations, token usage."""
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

    client = LLMClient(settings)
    conversation_id = req.conversation_id or str(uuid.uuid4())
    run_id = uuid.uuid4().hex[:16]

    # Create conversation
    if not req.conversation_id:
        session.add(Conversation(id=uuid.UUID(conversation_id), title="New conversation"))
    else:
        result = await session.execute(select(Conversation).where(Conversation.id == uuid.UUID(conversation_id)))
        if not result.scalar_one_or_none():
            session.add(Conversation(id=uuid.UUID(conversation_id), title="New conversation"))
    await session.commit()

    # Hybrid retrieval + context
    ctx = await _build_chat_context(session, settings, req.message, conversation_id, req.top_k)

    # Save user message
    session.add(Message(conversation_id=uuid.UUID(conversation_id), role="user", content=req.message))
    await session.commit()

    _sse = _sse_event

    async def generate():
        """Zero-buffering SSE generator with disconnect detection."""
        if await request.is_disconnected():
            return

        yield _sse("sources", {"sources": ctx.sources_payload})
        yield _sse("conversation_id", {"conversation_id": conversation_id})

        if await request.is_disconnected():
            return

        if ctx.chunks:
            yield _sse("thinking", {"content": "Searching documents..."})

        messages: list[dict[str, str]] = [
            {"role": "system", "content": (
                "You are a knowledgeable AI assistant powered by RAG. "
                "Use the provided context to answer accurately. "
                "Cite sources inline as [1], [2], etc. when referencing specific information."
            )},
            {"role": "system", "content": f"Relevant context:\n{ctx.context}"},
            *ctx.conversation_history,
            {"role": "user", "content": req.message},
        ]

        full_prompt = "\n".join(m["content"] for m in messages)
        input_tokens = count_tokens(full_prompt, model=settings.openai_model)

        # Emit citations
        for src in ctx.sources_payload:
            if await request.is_disconnected():
                return
            yield _sse("citation", {
                "source": {
                    "title": src["doc_name"] or src["source"],
                    "page": src.get("page"),
                    "number": src["number"],
                }
            })

        # Stream tokens
        output_tokens = 0
        full_content = ""

        try:
            async for event in client.stream_tokens(messages=messages, model=settings.openai_model):
                # Disconnect gate every 8 tokens
                if output_tokens % 8 == 0 and await request.is_disconnected():
                    log.info("stream_client_disconnected", run_id=run_id)
                    return

                etype = event.get("type")

                if etype == "token":
                    token = event["content"]
                    full_content += token
                    output_tokens += 1
                    yield _sse("token", {"content": token})

                elif etype == "done":
                    usage = event.get("usage", {})
                    final_prompt = usage.get("prompt_tokens", input_tokens)
                    final_completion = usage.get("completion_tokens", output_tokens)
                    total = final_prompt + final_completion
                    cost = estimate_cost_cents(final_prompt, final_completion, settings.openai_model)

                    log.info(
                        "stream_complete",
                        run_id=run_id,
                        model=settings.openai_model,
                        prompt_tokens=final_prompt,
                        completion_tokens=final_completion,
                        total_tokens=total,
                        cost_cents=cost,
                    )

                    # Persist
                    try:
                        session.add(Message(
                            conversation_id=uuid.UUID(conversation_id),
                            role="assistant",
                            content=full_content,
                        ))
                        await session.commit()
                    except Exception as e:
                        log.warning("stream_message_save_failed", error=str(e))
                        try:
                            await session.rollback()
                        except Exception:
                            pass

                    yield _sse("done", {
                        "usage": {
                            "input": final_prompt,
                            "output": final_completion,
                            "total": total,
                            "cost_cents": cost,
                        },
                        "run_id": run_id,
                    })
                    return

                elif etype == "tool_use":
                    yield _sse("tool_use", {"tool": event.get("tool", ""), "arguments": event.get("arguments", "")})

                elif etype == "error":
                    yield _sse("error", {"message": event.get("message", "Unknown error")})
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
            "X-Accel-Buffering": "no",
        },
    )


# ── SSE event formatter ──────────────────────────────────────────────────
def _sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
