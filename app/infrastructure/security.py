"""AI Security: prompt injection detection, input/output validation, context sanitization."""
from __future__ import annotations

import re
import string

INJECTION_SIGNATURES = [
    # Direct instruction injection
    r"(?i)ignore\s+previous\s+instructions",
    r"(?i)ignore\s+all\s+instructions\s+above",
    r"(?i)system\s*:\s*.*(?:forget|ignore)",
    r"(?i)you\s+are\s+now",
    r"(?i)new\s+instructions\s*:",
    r"(?i)system\s+override",
    r"(?i)disregard\s+(the\s+)?(previous\s+)?instructions?",
    # Role-based attacks
    r"(?i)from\s+now\s+on\s*,?\s+(you|your)",
    r"(?i)act\s+as\s+(?:a|an)\s+(?:ai|system|developer|admin)",
    r"(?i)pretend\s+to\s+be",
    r"(?i)dan\s+mode",
    # Encoding / escaping attacks
    r"(?:\\u[0-9a-fA-F]{4})+",
    r"(?:%[0-9a-fA-F]{2}){3,}",
    # Prompt extraction attempts
    r"(?i)(what|repeat|show|print)\s+(your|the)\s+(system\s+prompt|original\s+prompt|instructions)",
    r"(?i)repeat\s+everything\s+above",
    r"(?i)output\s+your\s+(initial|original)\s+(prompt|instructions|context)",
]

_COMPILED = [re.compile(p) for p in INJECTION_SIGNATURES]

# Input validation limits
MAX_INPUT_LENGTH = 50_000
MAX_REPEATED_CHARS = 100  # "aaaaaa..." spam
MAX_SPECIAL_CHAR_RATIO = 0.4  # ratio of non-alphanumeric chars


class PromptInjectionGuard:
    """Detect prompt injection attempts in user messages."""

    def __init__(self, *, threshold: float = 0.5):
        self.threshold = threshold

    def analyze(self, text: str) -> dict:
        """Return risk score (0.0-1.0) and flags."""
        risk_score = 0.0
        flags = []

        # Check injection signatures
        sig_count = 0
        for pattern in _COMPILED:
            if pattern.search(text):
                sig_count += 1

        if sig_count > 0:
            risk_score += min(0.5, sig_count * 0.25)
            flags.append(f"injection_signatures_detected:{sig_count}")

        # Check repeated characters (potential buffer attack)
        if self._has_repeated_chars(text):
            risk_score += 0.3
            flags.append("repeated_character_attack")

        # Check high special character ratio
        if self._has_high_special_chars(text):
            risk_score += 0.2
            flags.append("high_special_char_ratio")

        # Check URL density
        url_count = len(re.findall(r"https?://\S+", text))
        if url_count > 5:
            risk_score += 0.15
            flags.append(f"high_url_density:{url_count}")

        risk_score = min(1.0, risk_score)

        return {
            "risk_score": round(risk_score, 2),
            "flagged": risk_score >= self.threshold,
            "flags": flags,
        }

    def is_safe(self, text: str) -> bool:
        return not self.analyze(text)["flagged"]

    def _has_repeated_chars(self, text: str) -> bool:
        """Detect long runs of the same character."""
        if len(text) < MAX_REPEATED_CHARS:
            return False
        for c in set(text):
            if c * MAX_REPEATED_CHARS in text:
                return True
        return False

    def _has_high_special_chars(self, text: str) -> bool:
        """Detect if input is mostly special characters."""
        if not text.strip():
            return False
        alnum_count = sum(1 for c in text if c.isalnum() or c.isspace())
        return (len(text) - alnum_count) / len(text) > MAX_SPECIAL_CHAR_RATIO


class InputValidator:
    """Validate user input for production safety."""

    @staticmethod
    def validate_message(text: str) -> tuple[bool, list[str]]:
        errors = []
        if not text or not text.strip():
            errors.append("empty_input")
        if len(text) > MAX_INPUT_LENGTH:
            errors.append(f"input_too_long:{len(text)}>{MAX_INPUT_LENGTH}")
        if InputValidator._looks_like_xss(text):
            errors.append("potential_xss")
        return len(errors) == 0, errors

    @staticmethod
    def _looks_like_xss(text: str) -> bool:
        xss_patterns = [
            r"<script[^>]*>",
            r"javascript\s*:",
            r"on\w+\s*=",
            r"<img\s+[^>]*onerror",
            r"<svg\s+[^>]*onload",
            r"<iframe",
        ]
        return any(re.search(p, text, re.IGNORECASE) for p in xss_patterns)
