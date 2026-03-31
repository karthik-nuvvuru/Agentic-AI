from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Chunk, Document
from app.db.session import db_session
from app.rag.chunking import chunk_text
from app.rag.embeddings import embed_texts
from app.rag.retrieval import similarity_search


router = APIRouter(prefix="/v1/rag", tags=["rag"])


class IngestTextRequest(BaseModel):
    source: str = Field(min_length=1, max_length=500)
    text: str = Field(min_length=1, max_length=2_000_000)


class IngestResponse(BaseModel):
    document_id: str
    chunks_added: int


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=50_000)
    top_k: int | None = Field(default=None, ge=1, le=50)


class ChatResponse(BaseModel):
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


@router.post("/chat", response_model=ChatResponse)
async def rag_chat(
    req: ChatRequest,
    session: AsyncSession = Depends(db_session),
):
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required for chat")

    query_emb = (await embed_texts(settings, [req.message]))[0]
    chunks = await similarity_search(session, settings=settings, query_embedding=query_emb, top_k=req.top_k)

    # Pull document sources
    doc_ids = {c.document_id for c in chunks}
    docs = {}
    if doc_ids:
        res = await session.execute(select(Document).where(Document.id.in_(doc_ids)))
        for d in res.scalars().all():
            docs[d.id] = d.source

    context = "\n\n".join(f"[{i+1}] {c.content}" for i, c in enumerate(chunks))

    from app.llm.client import get_openai_client

    client = get_openai_client(settings)
    resp = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant. Use ONLY the provided context to answer. "
                    "If the answer is not in the context, say you don't know."
                ),
            },
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion:\n{req.message}"},
        ],
        max_tokens=settings.openai_max_tokens,
    )

    answer = resp.choices[0].message.content or ""
    sources = [
        {
            "chunk_id": str(c.id),
            "document_id": str(c.document_id),
            "source": docs.get(c.document_id, ""),
            "idx": c.idx,
        }
        for c in chunks
    ]
    return ChatResponse(answer=answer, sources=sources)

