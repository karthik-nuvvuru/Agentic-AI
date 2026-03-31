from __future__ import annotations

from app.core.config import Settings
from app.llm.client import get_openai_client


async def embed_texts(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for embeddings")

    client = get_openai_client(settings)
    resp = await client.embeddings.create(model=settings.openai_embeddings_model, input=texts)
    return [d.embedding for d in resp.data]

