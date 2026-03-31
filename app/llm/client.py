from __future__ import annotations

from openai import AsyncOpenAI

from app.core.config import Settings


def normalize_openai_base_url(base_url: str) -> str:
    lowered = base_url.rstrip("/").lower()
    for suffix in ("/chat/completions", "/v1/chat/completions"):
        if lowered.endswith(suffix):
            return base_url.rstrip("/")[: -len(suffix)]
    return base_url.rstrip("/")


def get_openai_client(settings: Settings) -> AsyncOpenAI:
    base_url = settings.openai_base_url
    if base_url:
        base_url = normalize_openai_base_url(base_url)

    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=base_url,
        timeout=settings.request_timeout_s,
    )

