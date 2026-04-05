"""
Input validation & prompt injection detection.

All user-facing string inputs should pass through ``sanitize_input()`` before
hitting the LLM or database.
"""
from __future__ import annotations

import logging
import re

import structlog

logger = structlog.get_logger(__name__)

# ── Limits ──────────────────────────────────────────────────────────
MAX_MESSAGE_LENGTH = 32_000
MAX_FIELD_LENGTH = 500

# Control characters (except tab, newline, carriage return)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Null bytes
_NULL_BYTE_RE = re.compile(r"\x00")

# Prompt injection indicators (case-insensitive)
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+previous\s+instruction", re.IGNORECASE),
    re.compile(r"ignore\s+all\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(the\s+)?(previous\s+)?instructions?", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now|a|an)\s", re.IGNORECASE),
    re.compile(r"from\s+now\s+on\s*,?\s+you", re.IGNORECASE),
    re.compile(r"act\s+as\s+(?:a|an)\s+(?:ai|system|developer|admin)", re.IGNORECASE),
    re.compile(r"(what|repeat|show|print)\s+(your|the)\s+system\s+prompt", re.IGNORECASE),
    re.compile(r"(system|developer)\s+override", re.IGNORECASE),
]

# XML tag wrapper — isolates user input from the LLM system prompt
_USER_TAG_START = "<user_message>"
_USER_TAG_END = "</user_message>"


class SanitizationResult:
    """Holds sanitized text and any flags raised during processing."""
    def __init__(self, text: str, flagged: bool = False, reasons: list[str] | None = None):
        self.text = text
        self.flagged = flagged
        self.reasons = reasons or []


def sanitize_input(text: str, max_length: int = MAX_MESSAGE_LENGTH) -> SanitizationResult:
    """Validate, sanitize, and wrap user input.

    Returns SanitizationResult with:
    - ``text``: cleaned & XML-wrapped string (safe to pass to LLM)
    - ``flagged``: True if injection pattern detected
    - ``reasons``: list of reasons flagged
    """
    reasons: list[str] = []

    # 1. Null byte check — reject immediately
    if _NULL_BYTE_RE.search(text):
        reasons.append("null_byte_detected")
        return SanitizationResult(text="", flagged=True, reasons=reasons)

    # 2. Control character check — reject
    if _CONTROL_CHAR_RE.search(text):
        reasons.append("control_characters_detected")
        return SanitizationResult(text="", flagged=True, reasons=reasons)

    # 3. Strip and truncate
    cleaned = text.strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
        reasons.append(f"truncated_to_{max_length}_chars")

    # 4. Prompt injection scan — flag but don't block
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(cleaned):
            reasons.append(f"injection_pattern:{pattern.pattern}")
            logger.warning(
                "prompt_injection_flagged",
                pattern=pattern.pattern,
                input_length=len(cleaned),
            )
            return SanitizationResult(
                text=f"{_USER_TAG_START}{cleaned}{_USER_TAG_END}",
                flagged=True,
                reasons=reasons,
            )

    # 5. Wrap in XML tags for LLM isolation
    return SanitizationResult(
        text=f"{_USER_TAG_START}{cleaned}{_USER_TAG_END}",
        flagged=bool(reasons),
        reasons=reasons,
    )


# ── FastAPI validator hook (use as a dependency) ────────────────────
from fastapi import HTTPException, Request

async def validate_message_input(
    request: Request,
) -> None:
    """Drop-in dependency for routes that accept a ``message`` field.

    Raises 400 if body contains null bytes, control characters,
    or exceeds MAX_MESSAGE_LENGTH.
    """
    try:
        body = await request.body()
        raw = body.decode("utf-8", errors="replace")
    except Exception:
        return  # Let Pydantic handle malformed bodies

    if _NULL_BYTE_RE.search(raw):
        raise HTTPException(status_code=400, detail="Invalid input: null bytes not allowed")
    if _CONTROL_CHAR_RE.search(raw):
        raise HTTPException(status_code=400, detail="Invalid input: control characters not allowed")
