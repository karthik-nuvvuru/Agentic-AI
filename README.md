# Agentic-AI

Production-ready FastAPI service scaffold using LangGraph.

## Quickstart (local)

1) Copy env template:

```bash
cp .env.example .env
```

2) Set `OPENAI_API_KEY` in `.env`.

3) Install and run:

```bash
poetry install
poetry run uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `POST /v1/agent/run`
- `POST /v1/agent/stream` (SSE)

## Docker

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up --build
```

Frontend will be on `http://localhost:3000` and API on `http://localhost:8000`.