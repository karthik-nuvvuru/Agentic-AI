from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AgentState(BaseModel):
    """Evolution of an agent run — passed through graph nodes."""

    prompt: str
    plan: str = ""
    plan_steps: list[dict[str, Any]] = Field(default_factory=list)
    draft: str = ""
    critique: str = ""
    output: str = ""
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    memories: list[dict[str, Any]] = Field(default_factory=list)
    error: str = ""
    iteration: int = 0
    max_iterations: int = 5


class AgentRunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=50_000)
    mode: Literal["chat", "research", "autonomous", "rag"] = "chat"
    conversation_id: str | None = None
    conversation_history: list[dict[str, str]] = Field(default_factory=list)
    context: str | None = None
    use_advanced_model: bool = False
    top_k: int = Field(default=8, ge=1, le=50)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    output: str
    run_id: str
    mode: str
    model: str
    plan: str = ""
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    sources: list[dict[str, Any]] = Field(default_factory=list)
    memories_used: list[dict[str, Any]] = Field(default_factory=list)
    token_usage: dict[str, int] = Field(default_factory=dict)
    cost_cents: float = 0
    latency_ms: float = 0


class AgentMode(str):
    CHAT = "chat"
    RESEARCH = "research"
    AUTONOMOUS = "autonomous"
    RAG = "rag"
