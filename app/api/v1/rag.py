from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Chunk, Conversation, Document, Message
from app.db.session import db_session
from app.rag.agent import generate_answer, generate_title
from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts
from app.rag.retrieval import similarity_search

router = APIRouter(prefix="/v1/rag", tags=["rag"])

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
    stmt = select(Document).order_by(desc(Document.created_at)).limit(limit).offset(offset)
    result = await session.execute(stmt)
    docs = result.scalars().all()

    out = []
    for d in docs:
        cnt = await session.execute(select(Chunk).where(Chunk.document_id == d.id))
        count = len(cnt.scalars().all())
        out.append(
            DocumentOut(
                id=d.id,
                source=d.source,
                created_at=d.created_at.isoformat(),
                chunk_count=count,
            )
        )
    return out


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
    doc_count = await session.execute(select(Document))
    chunk_count = await session.execute(select(Chunk))
    conv_count = await session.execute(select(Conversation))
    msg_count = await session.execute(select(Message))

    return {
        "documents": len(doc_count.scalars().all()),
        "chunks": len(chunk_count.scalars().all()),
        "conversations": len(conv_count.scalars().all()),
        "messages": len(msg_count.scalars().all()),
    }


@router.post("/chat", response_model=ChatResponse)
async def rag_chat(
    req: ChatRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

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
        except Exception:
            pass

    sources = [
        {
            "chunk_id": str(c.id),
            "document_id": str(c.document_id),
            "source": doc_sources.get(c.document_id, ""),
            "idx": c.idx,
        }
        for c in chunks
    ]

    return ChatResponse(
        conversation_id=conversation_id,
        message_id=str(assistant_msg.id),
        answer=answer,
        sources=sources,
    )


@router.post("/chat/stream")
async def rag_chat_stream(
    req: ChatRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

    from app.llm.client import get_openai_client

    openai_client = get_openai_client(settings)

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

    doc_ids = {c.document_id for c in chunks}
    doc_sources = {}
    if doc_ids:
        res = await session.execute(select(Document).where(Document.id.in_(doc_ids)))
        for d in res.scalars().all():
            doc_sources[d.id] = d.source

    context = "\n\n".join(f"[{i+1}] {c.content}" for i, c in enumerate(chunks))

    # Build conversation history
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

    sources_payload = [
        {
            "chunk_id": str(c.id),
            "document_id": str(c.document_id),
            "source": doc_sources.get(c.document_id, ""),
            "idx": c.idx,
        }
        for c in chunks
    ]

    async def generate():
        yield f"event: sources\ndata: {json.dumps(sources_payload)}\n\n"
        yield f"event: conversation_id\ndata: {json.dumps({'conversation_id': conversation_id})}\n\n"

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

        full_content = ""
        stream = await openai_client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            max_tokens=settings.openai_max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_content += token
                yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"

        # Save assistant response
        assistant_msg = Message(
            conversation_id=uuid.UUID(conversation_id),
            role="assistant",
            content=full_content,
        )
        session.add(assistant_msg)
        await session.commit()

        # Auto-generate title
        try:
            title_resp = await openai_client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Generate a very short (2-5 words) title. Return ONLY the title.",
                    },
                    {"role": "user", "content": req.message},
                ],
                max_tokens=20,
            )
            title = (title_resp.choices[0].message.content or "New conversation").strip().strip('"')
            if title:
                await session.execute(
                    update(Conversation).where(Conversation.id == uuid.UUID(conversation_id)).values(title=title)
                )
                await session.commit()
        except Exception:
            pass

        yield f"event: done\ndata: {json.dumps({'message_id': str(assistant_msg.id)})}\n\n"

    from fastapi.responses import StreamingResponse
    return StreamingResponse(generate(), media_type="text/event-stream")
