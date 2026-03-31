from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_healthz_ok():
    app = create_app()
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_readyz_present():
    app = create_app()
    client = TestClient(app)
    r = client.get("/readyz")
    assert r.status_code == 200
    body = r.json()
    assert "status" in body
    assert "llm_ready" in body
