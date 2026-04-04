from __future__ import annotations

from app.llm.client import LLMClient


async def embed_texts(settings, texts: list[str]) -> list[list[float]]:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for embeddings")
    client = LLMClient(settings)
    return await client.embeddings(texts)

