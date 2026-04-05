from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App ─────────────────────────────────────────────
    app_name: str = "Agentic AI"
    app_env: Literal["local", "dev", "staging", "prod"] = "local"
    log_level: str = "INFO"
    json_logs: bool = True

    # ── CORS ────────────────────────────────────────────
    cors_origins: list[AnyHttpUrl] = Field(default_factory=lambda: [
        "http://localhost:3000",
        "http://localhost:5173",
    ])

    # ── LLM ─────────────────────────────────────────────
    openai_api_key: str = ""
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_advanced_model: str = "gpt-4o"
    openai_cheap_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 4096
    openai_embeddings_model: str = "text-embedding-3-small"
    openai_embeddings_model_large: str = "text-embedding-3-large"

    # ── Database ────────────────────────────────────────
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/agentic"

    # ── RAG ─────────────────────────────────────────────
    rag_chunk_size: int = 900
    rag_chunk_overlap: int = 150
    rag_top_k: int = 8
    rag_rerank_top_k: int = 5
    rag_hybrid_blend_alpha: float = 0.7

    # ── Redis ───────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_max_connections: int = 50

    # ── Auth ────────────────────────────────────────────
    jwt_secret: str = Field(
        default="change-me-in-prod-use-openssl-rand-hex-32",
        min_length=32,
    )

    # ── Rate limiting ──────────────────────────────────
    rate_limit_rpm: int = 60
    rate_limit_rpm_auth: int = 200

    # ── Stripe ──────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # ── OAuth ───────────────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    # ── Request ────────────────────────────────────────
    request_timeout_s: float = 120.0
    max_concurrency: int = 64

    # ── File Upload ────────────────────────────────────
    upload_max_size_mb: int = 50
    upload_dir: str = "/data/uploads"
    supported_file_types: list[str] = Field(default_factory=lambda: [
        "pdf", "docx", "doc", "csv", "txt", "html", "htm"
    ])

    # ── Cloudflare R2 ──────────────────────────────────
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_endpoint_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
