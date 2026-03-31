from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgentRunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=50_000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    output: str
    run_id: str


class AgentState(BaseModel):
    prompt: str
    plan: str = ""
    draft: str = ""
    critique: str = ""
    output: str = ""
