from __future__ import annotations

import json
from typing import Any

from app.core.config import Settings
from app.llm.client import LLMClient


def build_system_prompt(top_k: int = 6) -> str:
    return (
        "You are a knowledgeable AI assistant powered by Retrieval-Augmented Generation (RAG). "
        "Use the provided context to answer the user's question when it is relevant. "
        "If the context doesn't contain enough information, use your own knowledge to provide a helpful and informative answer. "
        "Always try to be as helpful as possible while remaining accurate. "
        "Keep answers concise, well-structured, and easy to read. "
        "Use markdown-style formatting when helpful (bullet points, bold, etc.)."
    )


def format_context(chunks: list[Any]) -> tuple[str, list[dict[str, Any]]]:
    ctx_parts = []
    sources = []
    for i, c in enumerate(chunks):
        ctx_parts.append(f"[{i+1}] {c.content}")
        src = getattr(c, "document", None)
        sources.append(
            {
                "source": src.source if src else "",
                "idx": c.idx,
            }
        )
    return "\n\n".join(ctx_parts), sources


async def generate_answer(
    *,
    settings: Settings,
    context: str,
    conversation_history: list[dict[str, str]],
    last_message: str,
) -> str:
    client = LLMClient(settings)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": build_system_prompt()},
    ]

    if context:
        messages.append(
            {
                "role": "system",
                "content": f"Relevant context from documents:\n{context}",
            }
        )

    messages.extend(conversation_history)
    messages.append({"role": "user", "content": last_message})

    resp = await client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        max_tokens=settings.openai_max_tokens,
    )
    return resp.choices[0].message.content or ""


async def generate_title(
    *,
    settings: Settings,
    first_message: str,
) -> str:
    client = LLMClient(settings)
    resp = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Generate a very short (2-5 words) title for this conversation. "
                    "Return ONLY the title, no quotes or explanation."
                ),
            },
            {"role": "user", "content": first_message},
        ],
        max_tokens=20,
    )
    title = (resp.choices[0].message.content or "New conversation").strip().strip('"')
    return title if title else "New conversation"
