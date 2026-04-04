"""Multi-workflow agent orchestration: chat, research, autonomous, RAG."""
from __future__ import annotations

import uuid
import structlog
from langgraph.graph import END, StateGraph

from app.agent.models import AgentState, AgentMode
from app.core.config import Settings
from app.llm.client import LLMClient

log = structlog.get_logger(__name__)


def _normalize_openai_base_url(base_url: str) -> str:
    lowered = base_url.rstrip("/").lower()
    for suffix in ("/chat/completions", "/v1/chat/completions"):
        if lowered.endswith(suffix):
            return base_url.rstrip("/")[: -len(suffix)]
    return base_url.rstrip("/")


def _build_llm(settings: Settings) -> LLMClient:
    return LLMClient(settings)


# ── Chat Agent (single-turn, direct answer) ──────────────────────────────

def build_chat_graph(*, settings: Settings, llm: LLMClient | None = None) -> object:
    if llm is None:
        llm_agent = LLMClient(settings)
    else:
        llm_agent = llm

    async def respond(state: AgentState) -> AgentState:
        messages = [
            {"role": "system", "content": "You are a helpful AI assistant. Provide clear, concise, accurate answers."},
            {"role": "user", "content": state.prompt},
        ]
        model = settings.openai_model if not state.use_advanced_model else settings.openai_advanced_model
        result = await llm_agent.chat(messages=messages, model=model, stream=False)
        state.output = result["message"].get("content", "")
        state.token_usage = result.get("usage", {})
        state.cost_cents = result.get("cost_cents", 0)
        state.latency_ms = result.get("latency_ms", 0)
        return state

    g = StateGraph(AgentState)
    g.add_node("respond", respond)
    g.set_entry_point("respond")
    g.add_edge("respond", END)
    return g.compile()


# ── Research Agent (plan → gather → synthesize) ──────────────────────────

def build_research_graph(*, settings: Settings, llm: LLMClient | None = None) -> object:
    if llm is None:
        llm_agent = LLMClient(settings)
    else:
        llm_agent = llm

    async def planner(state: AgentState) -> AgentState:
        messages = [
            {"role": "system", "content": (
                "You are a planning agent for research tasks. "
                "Break the user's question into 3-5 concrete research steps. "
                "Return JSON with 'steps' array, each having 'title' and 'goal'."
            )},
            {"role": "user", "content": state.prompt},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.plan = result["message"].get("content", "")
        return state

    async def gather(state: AgentState) -> AgentState:
        messages = [
            {"role": "system", "content": (
                "You are a research assistant. Gather detailed information addressing each step of the plan. "
                "Be thorough and cite when possible."
            )},
            {"role": "user", "content": f"Question: {state.prompt}\n\nPlan:\n{state.plan}"},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.draft = result["message"].get("content", "")
        return state

    async def synthesize(state: AgentState) -> AgentState:
        messages = [
            {"role": "system", "content": (
                "Synthesize the research findings into a coherent, well-structured answer. "
                "Include key insights and actionable conclusions."
            )},
            {"role": "user", "content": f"Question: {state.prompt}\n\nResearch:\n{state.draft}"},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.output = result["message"].get("content", "")
        return state

    g = StateGraph(AgentState)
    g.add_node("plan", planner)
    g.add_node("gather", gather)
    g.add_node("synthesize", synthesize)
    g.set_entry_point("plan")
    g.add_edge("plan", "gather")
    g.add_edge("gather", "synthesize")
    g.add_edge("synthesize", END)
    return g.compile()


# ── Autonomous Agent (plan → execute → reflect loop) ─────────────────────

def build_autonomous_graph(*, settings: Settings, llm: LLMClient | None = None) -> object:
    if llm is None:
        llm_agent = LLMClient(settings)
    else:
        llm_agent = llm

    max_iter = settings.agent_max_iterations

    async def planner(state: AgentState) -> AgentState:
        messages = [
            {"role": "system", "content": (
                "You are a planning agent. Create a step-by-step plan to solve the user's request. "
                "Return a numbered list of steps."
            )},
            {"role": "user", "content": state.prompt},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.plan = result["message"].get("content", "")
        return state

    async def execute(state: AgentState) -> AgentState:
        messages = [
            {"role": "system", "content": (
                "You are an execution agent. Follow the plan step by step and produce a thorough response."
            )},
            {"role": "user", "content": f"Task:\n{state.prompt}\n\nPlan:\n{state.plan}"},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.draft = result["message"].get("content", "")
        return state

    async def reflect(state: AgentState) -> AgentState:
        state.iteration += 1
        messages = [
            {"role": "system", "content": (
                "You are a critic agent. Review the draft answer for correctness, completeness, and clarity. "
                "If it is good, respond with 'PASS'. Otherwise, list specific improvements needed."
            )},
            {"role": "user", "content": f"Task: {state.prompt}\nDraft:\n{state.draft}"},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.critique = result["message"].get("content", "")
        return state

    def should_continue(state: AgentState) -> str:
        if "PASS" in state.critique.upper() or state.iteration >= max_iter:
            state.output = state.draft
            return END
        # Re-execute with feedback
        return "execute"

    g = StateGraph(AgentState)
    g.add_node("plan", planner)
    g.add_node("execute", execute)
    g.add_node("reflect", reflect)
    g.set_entry_point("plan")
    g.add_edge("plan", "execute")
    g.add_edge("execute", "reflect")
    g.add_conditional_edge("reflect", should_continue, condition_end_is_fallthrough=True)
    return g.compile()


# ── RAG Agent (retrieve → generate → cite) ───────────────────────────────

def build_rag_graph(*, settings: Settings, llm: LLMClient | None = None) -> object:
    if llm is None:
        llm_agent = LLMClient(settings)
    else:
        llm_agent = llm

    async def retrieve(state: AgentState) -> AgentState:
        state.output = f"Retrieved context for: {state.prompt}"
        return state

    async def generate(state: AgentState) -> AgentState:
        context = state.plan or ""
        messages = [
            {"role": "system", "content": (
                "You are a RAG assistant. Use the provided context to answer accurately. "
                "If the context doesn't contain the answer, use your general knowledge but note that."
            )},
            {"role": "system", "content": f"Context:\n{context}" if context else "No specific context provided."},
            {"role": "user", "content": state.prompt},
        ]
        result = await llm_agent.chat(messages=messages, stream=False)
        state.output = result["message"].get("content", "")
        return state

    g = StateGraph(AgentState)
    g.add_node("retrieve", retrieve)
    g.add_node("generate", generate)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "generate")
    g.add_edge("generate", END)
    return g.compile()
