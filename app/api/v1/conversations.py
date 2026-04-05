from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Conversation, Message
from app.db.session import db_session

router = APIRouter(prefix="/v1/conversations", tags=["conversations"])


class CreateConversationRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: str

    model_config = {"from_attributes": True}


class GetConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: str
    updated_at: str
    messages: list[MessageOut]


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    session: AsyncSession = Depends(db_session),
):
    stmt = select(Conversation).order_by(Conversation.updated_at.desc())
    result = await session.execute(stmt)
    conversations = result.scalars().all()
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in conversations
    ]


@router.get("/{conversation_id}", response_model=GetConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    session: AsyncSession = Depends(db_session),
):
    result = await session.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    result = await session.execute(stmt)
    messages = result.scalars().all()

    return GetConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ],
    )


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    req: CreateConversationRequest | None = None,
    session: AsyncSession = Depends(db_session),
):
    title = req.title if req and req.title else "New conversation"
    conv = Conversation(title=title)
    session.add(conv)
    await session.commit()
    await session.refresh(conv)

    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.put("/{conversation_id}/title", response_model=ConversationOut)
async def update_conversation_title(
    conversation_id: uuid.UUID,
    req: CreateConversationRequest,
    session: AsyncSession = Depends(db_session),
):
    if not req.title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    result = await session.execute(update(Conversation).where(Conversation.id == conversation_id).values(title=req.title))  # noqa: E501
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await session.commit()
    result = await session.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    session: AsyncSession = Depends(db_session),
):
    result = await session.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await session.delete(conv)
    await session.commit()


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: uuid.UUID,
    session: AsyncSession = Depends(db_session),
):
    result = await session.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]
