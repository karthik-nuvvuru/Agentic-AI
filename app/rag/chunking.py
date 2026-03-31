from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    idx: int
    text: str


def chunk_text(text: str, *, chunk_size: int, overlap: int) -> list[TextChunk]:
    text = text.strip()
    if not text:
        return []

    if overlap >= chunk_size:
        raise ValueError("overlap must be < chunk_size")

    chunks: list[TextChunk] = []
    start = 0
    idx = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(TextChunk(idx=idx, text=chunk))
            idx += 1
        if end == n:
            break
        start = max(0, end - overlap)

    return chunks

