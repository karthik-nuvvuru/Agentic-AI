from __future__ import annotations

from app.agent.graph import (
    build_chat_graph,
    build_research_graph,
    build_autonomous_graph,
    build_rag_graph,
)
from app.llm.client import LLMClient
from app.core.config import Settings

_grafs: dict[str, object] = {}


def get_graph(mode: str, *, settings: Settings, llm: LLMClient | None = None) -> object:
    key = f"{mode}_{settings.openai_model}"
    if key not in _grafs:
        builders: dict[str, callable] = {
            "chat": build_chat_graph,
            "research": build_research_graph,
            "autonomous": build_autonomous_graph,
            "rag": build_rag_graph,
        }
        builder = builders.get(mode, build_chat_graph)
        _grafs[key] = builder(settings=settings, llm=llm)
    return _grafs[key]
