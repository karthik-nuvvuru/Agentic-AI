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

    app_name: str = "agentic-ai"
    app_env: Literal["local", "dev", "staging", "prod"] = "local"
    log_level: str = "INFO"
    json_logs: bool = True

    cors_origins: list[AnyHttpUrl] = Field(default_factory=list)

    llm_provider: Literal["openai_compatible"] = "openai_compatible"
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 2048
    openai_embeddings_model: str = "text-embedding-3-small"

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/agentic"
    rag_chunk_size: int = 900
    rag_chunk_overlap: int = 150
    rag_top_k: int = 6

    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "change-me-in-prod-use-openssl-rand-hex-32"
    jwt_ttl_seconds: int = 86400  # 24 hours
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    frontend_url: str = "http://localhost:3000"

    request_timeout_s: float = 60.0
    max_concurrency: int = 32

    rate_limit_rpm: int = 60  # requests per minute


@lru_cache
def get_settings() -> Settings:
    return Settings()
