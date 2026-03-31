from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.core.config import get_settings


def test_agent_run_returns_503_without_key(monkeypatch):
    # Ensure we don't accidentally require a real key in CI.
    monkeypatch.setenv("OPENAI_API_KEY", "")
    get_settings.cache_clear()

    app = create_app()
    client = TestClient(app)
    r = client.post("/v1/agent/run", json={"prompt": "hello"})
    assert r.status_code == 503

