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
    cors_origins: list[AnyHttpUrl] = Field(default_factory=list)
    frontend_url: str = "http://localhost:3000"

    # ── LLM ─────────────────────────────────────────────
    llm_provider: Literal["openai_compatible"] = "openai_compatible"
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_advanced_model: str = "gpt-4o"
    openai_cheap_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 4096
    openai_embeddings_model: str = "text-embedding-3-small"
    openai_embeddings_model_large: str = "text-embedding-3-large"

    # ── Database ────────────────────────────────────────
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/agentic"
    database_pool_size: int = 20
    database_max_overflow: int = 40

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
        ...,
        min_length=32,
        description="Must be set in production — run: openssl rand -hex 32",
    )
    jwt_ttl_seconds: int = 86400
    jwt_refresh_ttl_seconds: int = 604800
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    # ── Rate limiting ──────────────────────────────────
    rate_limit_rpm: int = 60
    rate_limit_rpm_auth: int = 200
    rate_limit_redis_key_prefix: str = "ai:ratelimit"

    # ── Stripe / Billing ───────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = Field(
        ...,
        description="Required for webhook verification",
    )

    # ── Agent ───────────────────────────────────────────
    agent_max_iterations: int = 5
    agent_timeout_seconds: int = 120

    # ── Observability ──────────────────────────────────
    otel_enabled: bool = False
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    langfuse_enabled: bool = False
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    # ── Request ────────────────────────────────────────
    request_timeout_s: float = 120.0
    max_concurrency: int = 64

    # ── Encryption ─────────────────────────────────────
    document_encryption_key: str = Field(
        ...,
        min_length=32,
        description="Must be set in production — run: openssl rand -base64 32",
    )

    # ── File Upload ────────────────────────────────────
    upload_max_size_mb: int = 50
    upload_dir: str = "/data/uploads"
    supported_file_types: list[str] = Field(default_factory=lambda: [
        "pdf", "docx", "doc", "csv", "txt", "html", "htm"
    ])


@lru_cache
def get_settings() -> Settings:
    return Settings()
