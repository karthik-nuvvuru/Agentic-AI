"""Multi-model LLM client with routing, fallbacks, cost tracking, and streaming."""
from __future__ import annotations

import asyncio
import time
import structlog
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from enum import Enum
from typing import Any

import tiktoken
from openai import AsyncOpenAI, APIError, APITimeoutError, APIConnectionError

from app.core.config import Settings

log = structlog.get_logger(__name__)

# ── Token / Cost Estimation ──────────────────────────────────────────────────

PRICING_PER_1M = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
}

_encoding_cache: dict[str, Any] = {}


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    try:
        if model not in _encoding_cache:
            _encoding_cache[model] = tiktoken.encoding_for_model(model)
        enc = _encoding_cache[model]
    except KeyError:
        enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))


def estimate_cost_cents(prompt_tokens: int, completion_tokens: int, model: str) -> float:
    pricing = PRICING_PER_1M.get(model, PRICING_PER_1M["gpt-4o-mini"])
    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]
    return round((input_cost + output_cost) * 100, 4)  # cents


# ── Route Decision ───────────────────────────────────────────────────────────

class RouteDecision(str, Enum):
    CHEAP = "cheap"
    ADVANCED = "advanced"
    DEFAULT = "default"


def decide_route(
    prompt: str,
    use_advanced: bool = False,
    token_threshold: int = 500,
    *,
    settings: Settings,
) -> RouteDecision:
    if use_advanced:
        return RouteDecision.ADVANCED
    tokens = count_tokens(prompt)
    if tokens > token_threshold:
        return RouteDecision.ADVANCED
    keywords = {"why", "how", "explain", "analyze", "reason", "compare", "evaluate"}
    if any(kw in prompt.lower() for kw in keywords):
        return RouteDecision.ADVANCED
    return RouteDecision.CHEAP


def resolve_model(route: RouteDecision, *, settings: Settings) -> str:
    if route == RouteDecision.ADVANCED:
        return settings.openai_advanced_model
    if route == RouteDecision.CHEAP:
        return settings.openai_cheap_model
    return settings.openai_model


# ── Client ───────────────────────────────────────────────────────────────────

def _build_client(settings: Settings) -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for LLM calls")
    base_url = settings.openai_base_url
    if base_url:
        lowered = base_url.rstrip("/").lower()
        for suffix in ("/chat/completions", "/v1/chat/completions"):
            if lowered.endswith(suffix):
                base_url = base_url.rstrip("/")[: -len(suffix)]
                break
        base_url = base_url.rstrip("/")
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=base_url if base_url else None,
        timeout=settings.request_timeout_s,
    )


class LLMClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = _build_client(settings)

    async def chat(
        self,
        *,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        stream: bool = False,
        max_tokens: int | None = None,
        tools: list[dict] | None = None,
    ) -> dict | AsyncGenerator[str, None]:
        model = model or self.settings.openai_model
        max_tokens = max_tokens or self.settings.openai_max_tokens

        if stream:
            return self._stream(messages=messages, model=model, temperature=temperature, max_tokens=max_tokens, tools=tools)
        return await self._complete(messages=messages, model=model, temperature=temperature, max_tokens=max_tokens, tools=tools)

    async def _complete(
        self,
        *,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        tools: list[dict] | None = None,
    ) -> dict:
        retries = 3
        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                start = time.monotonic()
                kwargs: dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if tools:
                    kwargs["tools"] = tools

                resp = await self.client.chat.completions.create(**kwargs)
                latency_ms = (time.monotonic() - start) * 1000

                choice = resp.choices[0]
                message = choice.message.to_dict()
                usage = resp.usage.to_dict() if resp.usage else {}
                prompt_tokens = usage.get("prompt_tokens", 0)
                completion_tokens = usage.get("completion_tokens", 0)
                cost = estimate_cost_cents(prompt_tokens, completion_tokens, model)

                log.info(
                    "llm_completion",
                    model=model,
                    latency_ms=round(latency_ms, 2),
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost_cents=cost,
                    attempt=attempt,
                )

                return {
                    "message": message,
                    "usage": usage,
                    "cost_cents": cost,
                    "latency_ms": round(latency_ms, 2),
                }
            except (APITimeoutError, APIConnectionError) as e:
                last_error = e
                log.warning("llm_retry", attempt=attempt, error=str(e))
                await __import__("asyncio").sleep(min(2**attempt, 10))
            except APIError as e:
                raise
        raise last_error or RuntimeError("LLM call failed after retries")

    async def stream_tokens(
        self,
        *,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        tools: list[dict] | None = None,
        cancel_scope: asyncio.CancelledError | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Yield structured SSE-ready dicts with zero buffering.

        Yields:
            {"type": "token",   "content": "..."}   per delta
            {"type": "done",    "usage": {...}}       final chunk (from stream_options)
            {"type": "error",   "message": "..."}     on LLM error

        Caller passes the Request object so we can call ``is_disconnected()``
        and abort the OpenAI stream mid-flight when the client drops.
        """
        model = model or self.settings.openai_model
        max_tokens = max_tokens or self.settings.openai_max_tokens

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if tools:
            kwargs["tools"] = tools

        try:
            stream = await self.client.chat.completions.create(**kwargs)
            async for c in stream:
                # ── final chunk carries usage ──
                if c.usage is not None:
                    usage = c.usage.to_dict() if c.usage else {}
                    prompt = usage.get("prompt_tokens", 0)
                    completion = usage.get("completion_tokens", 0)
                    yield {
                        "type": "done",
                        "usage": {
                            "prompt_tokens": prompt,
                            "completion_tokens": completion,
                            "total_tokens": prompt + completion,
                            "cost_cents": estimate_cost_cents(prompt, completion, model),
                        },
                    }
                    return

                delta = c.choices[0].delta if c.choices else None

                # ── tool use (parallel tool calling) ──
                if delta and delta.tool_calls:
                    for tc in delta.tool_calls:
                        if tc.function and tc.function.name:
                            yield {
                                "type": "tool_use",
                                "tool": tc.function.name,
                                "arguments": tc.function.arguments or "",
                                "index": tc.index,
                            }
                    continue

                # ── plain text token ──
                if delta and delta.content:
                    yield {"type": "token", "content": delta.content}

        except asyncio.CancelledError:
            yield {"type": "error", "message": "Client disconnected"}
            return
        except (APITimeoutError, APIConnectionError) as e:
            yield {"type": "error", "message": f"LLM connection error: {e}"}
            return
        except APIError as e:
            yield {"type": "error", "message": f"LLM API error: {e.message}"}
            return

    async def embeddings(self, texts: list[str], model: str | None = None) -> list[list[float]]:
        model = model or self.settings.openai_embeddings_model
        resp = await self.client.embeddings.create(input=texts, model=model)
        return [d.embedding for d in resp.data]
