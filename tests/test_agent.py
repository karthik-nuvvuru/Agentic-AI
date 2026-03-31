from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_agent_run_returns_503_without_key(monkeypatch):
    # Ensure we don't accidentally require a real key in CI.
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    app = create_app()
    client = TestClient(app)
    r = client.post("/v1/agent/run", json={"prompt": "hello"})
    assert r.status_code == 503

