from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from app.db.models import Message
from app.db.session import db_session

router = APIRouter(prefix="/v1/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    message_id: str = Field(..., description="UUID of the assistant message")
    score: int = Field(
        ..., ge=0, le=1, description="0 = thumbs-down, 1 = thumbs-up"
    )


class FeedbackOut(BaseModel):
    success: bool


@router.post("/submit", response_model=FeedbackOut)
async def submit_feedback(
    req: FeedbackRequest,
    session: AsyncSession = Depends(db_session),
):
    stmt = (
        update(Message)
        .where(Message.id == req.message_id)
        .values(feedback_score=req.score)
    )
    result = await session.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    await session.commit()
    return FeedbackOut(success=True)
