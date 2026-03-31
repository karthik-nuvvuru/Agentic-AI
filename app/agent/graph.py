from __future__ import annotations

import uuid

import structlog
from langgraph.graph import END, StateGraph
from openai import AsyncOpenAI

from app.agent.models import AgentState
from app.core.config import Settings


log = structlog.get_logger(__name__)


def _normalize_openai_base_url(base_url: str) -> str:
    # Users often paste full endpoints like ".../chat/completions".
    # The OpenAI client appends "/chat/completions" internally, so strip it if present.
    lowered = base_url.rstrip("/").lower()
    for suffix in ("/chat/completions", "/v1/chat/completions"):
        if lowered.endswith(suffix):
            return base_url.rstrip("/")[: -len(suffix)]
    return base_url.rstrip("/")


def _get_client(settings: Settings) -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for LLM calls")

    base_url = settings.openai_base_url
    if base_url:
        base_url = _normalize_openai_base_url(base_url)

    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=base_url,
        timeout=settings.request_timeout_s,
    )


async def _chat(settings: Settings, client: AsyncOpenAI, *, system: str, user: str) -> str:
    resp = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=settings.openai_max_tokens,
    )
    msg = resp.choices[0].message
    return msg.content or ""


def build_graph(*, settings: Settings):
    client = _get_client(settings)

    async def planner(state: AgentState) -> AgentState:
        state.plan = await _chat(
            settings,
            client,
            system=(
                "You are a planning agent. Produce a concise step-by-step plan "
                "to answer the user prompt. Keep it short and actionable."
            ),
            user=state.prompt,
        )
        return state

    async def executor(state: AgentState) -> AgentState:
        state.draft = await _chat(
            settings,
            client,
            system=(
                "You are an execution agent. Use the plan to produce the best possible answer. "
                "Do not mention internal planning unless asked."
            ),
            user=f"User prompt:\n{state.prompt}\n\nPlan:\n{state.plan}",
        )
        return state

    async def critic(state: AgentState) -> AgentState:
        state.critique = await _chat(
            settings,
            client,
            system=(
                "You are a critic agent. Review the draft for correctness, clarity, and missing details. "
                "Return a short critique and specific improvements."
            ),
            user=f"User prompt:\n{state.prompt}\n\nDraft:\n{state.draft}",
        )
        return state

    async def finalizer(state: AgentState) -> AgentState:
        run_id = uuid.uuid4().hex
        log.info("agent_run", run_id=run_id)
        state.output = await _chat(
            settings,
            client,
            system=(
                "You are a final response agent. Improve the draft using the critique. "
                "Return ONLY the final answer."
            ),
            user=f"User prompt:\n{state.prompt}\n\nDraft:\n{state.draft}\n\nCritique:\n{state.critique}",
        )
        return state

    g: StateGraph = StateGraph(AgentState)
    g.add_node("planner", planner)
    g.add_node("executor", executor)
    g.add_node("critic", critic)
    g.add_node("finalizer", finalizer)
    g.set_entry_point("planner")
    g.add_edge("planner", "executor")
    g.add_edge("executor", "critic")
    g.add_edge("critic", "finalizer")
    g.add_edge("finalizer", END)
    return g.compile()
