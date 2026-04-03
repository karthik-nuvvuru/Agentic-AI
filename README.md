# Agentic AI — RAG-Powered Chat Assistant

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Material--UI-007FFF?style=for-the-badge&logo=mui&logoColor=white" alt="MUI" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue?style=flat-square" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/JWT-Auth-green?style=flat-square" alt="JWT" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT" />
</p>

---

## Overview

Agentic AI is a production-ready chat assistant powered by **Retrieval-Augmented Generation (RAG)**. Upload documents, ask questions, get intelligent source-attributed answers — all through a sleek, modern web interface.

### ✨ Features

| Category | Feature |
|----------|---------|
| **Authentication** | JWT-based auth with email/password, Google OAuth, GitHub OAuth |
| **RAG Pipeline** | Document ingestion, vector similarity search, contextual AI answers |
| **Streaming** | Real-time SSE streaming responses with token-by-token rendering |
| **Caching** | Redis-backed response dedup cache (SHA-256) with configurable TTL |
| **Rate Limiting** | Sliding-window rate limiter via Redis (configurable RPM) |
| **File Upload** | Drag-and-drop, multi-file support with progress indicators |
| **Conversations** | Persistent chat history with grouped timelines (Today, 7 days, etc.) |
| **Feedback** | Thumbs up/down on assistant responses for quality tracking |
| **UI/UX** | ChatGPT/Claude-inspired design, dark theme, markdown + code blocks |
| **Production** | Docker Compose, health checks, structured logging, nginx reverse proxy |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  React + Material-UI  │  Auth Context  │  SSE Client│    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │ HTTPS                              │
└─────────────────────────┼────────────────────────────────────┘
                          ▼
              ┌───────────────────────┐
              │    Nginx Reverse       │
              │       Proxy            │
              │   (port 3000/80)       │
              └───┬───────────┬───────┘
                  │ API       │ Static
                  │ /v1/*     │ Files
                  ▼           ▼
    ┌──────────────────┐  ┌─────────────────┐
    │  FastAPI Backend  │  │  React SPA      │
    │  (uvicorn :8000)  │  │  :3000          │
    └─┬──┬──┬──┬──┬──┬─┘  └─────────────────┘
      │  │  │  │  │  │
      │  │  │  │  │  ├──▶  LangGraph Agent
      │  │  │  │  ├──▶  OpenAI / LLM Client
      │  │  │  ├──▶  Embedding Model (text-embedding)
      │  │  │  ├──▶  RAG Pipeline (chunk → embed → retrieve → answer)
      │  │  ├──▶  Redis Cache (+ Rate Limiter)
      │  │  └──▶  JWT Auth Middleware
      │  └──▶  SQLAlchemy ORM
      ▼
  ┌──────────┐     ┌──────────┐
  │PostgreSQL│     │  Redis   │
  │+pgvector │     │ :6379    │
  └──────────┘     └──────────┘
```

### Component Flow

```
User: "What does the document say about X?"
  │
  ▼
[1] Auth Middleware ───▶ Validate JWT token
  │
  ▼
[2] Redis Cache Check ─▶ HIT? Return cached answer
  │                      MISS? Continue
  ▼
[3] Embed Query ───────▶ text-embedding-3-small
  │
  ▼
[4] Vector Search ─────▶ pgvector similarity (top_k=6)
  │                      returns document chunks
  ▼
[5] Build Context ─────▶ chunks → prompt template
  │
  ▼
[6] LLM Generation ───▶ GPT-4o-mini (streaming SSE)
  │
  ▼
[7] Cache & Save ─────▶ Store in Redis + save to DB
  │
  ▼
[8] Stream to Client ──▶ Real-time token streaming
```

---

## Quickstart

### Prerequisites

- **Docker** & **Docker Compose** (recommended)
- **Python 3.11+** (for local dev)
- **PostgreSQL 16** with pgvector (handled by Docker)
- An **OpenAI-compatible API key**

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/karthik-nuvvuru/Agentic-AI.git
cd Agentic-AI

# 2. Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY

# 3. Launch everything (API, Web, PostgreSQL, Redis)
docker compose up --build -d

# Frontend → http://localhost:3000
# API Docs → http://localhost:8000/docs
```

### Option 2: Local Development

```bash
# 1. Start supporting services
docker compose up -d db redis

# 2. Install Python dependencies
poetry install

# 3. Run database migrations
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/agentic \
  poetry run alembic upgrade head

# 4. Start the API
poetry run uvicorn app.main:app --reload

# 5. In another terminal, start the frontend
cd web
npm install
npm run dev
```

---

## Configuration

Edit `.env` with your settings:

```ini
# ── App ──────────────────────────────
APP_ENV=local
LOG_LEVEL=DEBUG
JSON_LOGS=false

# ── LLM (OpenAI-compatible) ──────────
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1    # or any compatible endpoint
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2048
OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small

# ── Database ───────────────────────────
DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/agentic

# ── Redis ──────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Auth (OAuth) ──────────────────────
JWT_SECRET=your-secret-key-change-in-prod
JWT_TTL_SECONDS=86400
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# ── Runtime ────────────────────────────
REQUEST_TIMEOUT_S=60
MAX_CONCURRENCY=32
RATE_LIMIT_RPM=60
```

---

## API Endpoints

### Authentication

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `POST` | `/v1/auth/register` | No | Create account |
| `POST` | `/v1/auth/login` | No | Sign in with email/password |
| `POST` | `/v1/auth/refresh` | No | Refresh access token |
| `GET`  | `/v1/auth/me` | Yes | Get current user info |
| `GET`  | `/v1/auth/google/login` | No | Start Google OAuth flow |
| `GET`  | `/v1/auth/google/callback` | No | Complete Google OAuth callback |
| `GET`  | `/v1/auth/github/login` | No | Start GitHub OAuth flow |
| `GET`  | `/v1/auth/github/callback` | No | Complete GitHub OAuth callback |

### RAG Chat

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `POST` | `/v1/rag/chat` | Yes | Chat with RAG (non-streaming) |
| `POST` | `/v1/rag/chat/stream` | Yes | Chat with RAG (SSE streaming) |

### Document Management

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `POST` | `/v1/rag/ingest/text` | Yes | Ingest raw text |
| `POST` | `/v1/rag/ingest/file` | Yes | Ingest PDF/TXT/MD file |
| `GET`  | `/v1/rag/documents` | Yes | List documents |
| `DELETE`| `/v1/rag/documents/{id}` | Yes | Delete document |
| `GET`  | `/v1/rag/stats` | Yes | RAG statistics |

### Conversations & Feedback

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `GET`  | `/v1/conversations` | Yes | List conversations |
| `POST` | `/v1/conversations` | Yes | Create conversation |
| `GET`  | `/v1/conversations/{id}` | Yes | Get conversation with messages |
| `DELETE`| `/v1/conversations/{id}` | Yes | Delete conversation |
| `POST` | `/v1/feedback/submit` | Yes | Submit thumbs up/down |

### Health

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `GET`  | `/healthz` | No | Basic health check |
| `GET`  | `/readyz` | No | Full readiness check (LLM + Redis) |

---

## Database Migrations (Alembic)

```bash
# Run all pending migrations
DATABASE_URL=postgresql+psycopg://postgres:postgres@db:5432/agentic \
  poetry run alembic upgrade head

# Create a new migration from model changes
poetry run alembic revision --autogenerate -m "describe changes"

# Rollback one migration
poetry run alembic downgrade -1

# View migration history
poetry run alembic history --verbose
```

### Current Migrations

| Migration | Description |
|-----------|-------------|
| `8d46490a` | Initial tables (users, documents, chunks, conversations, messages) |
| `43ff64d2` | Add owner_id FK to conversations, adjust user index |

---

## Project Structure

```
Agentic-AI/
├── alembic/                    # Database migrations
│   ├── env.py
│   └── versions/
├── app/
│   ├── api/v1/
│   │   ├── agent.py            # LangGraph agent endpoints
│   │   ├── auth.py             # JWT + OAuth routes
│   │   ├── conversations.py    # Conversation CRUD
│   │   ├── feedback.py         # Thumbs up/down
│   │   ├── rag.py              # RAG chat + ingestion
│   │   └── health.py           # Health/readiness
│   ├── cache/
│   │   ├── rag.py              # Response cache (SHA-256)
│   │   └── ratelimit.py        # Sliding-window rate limiter
│   ├── core/
│   │   ├── auth.py             # JWT helpers, password hashing
│   │   ├── config.py           # Pydantic Settings
│   │   └── logging.py          # Structured logging
│   ├── db/
│   │   ├── models.py           # SQLAlchemy ORM models
│   │   ├── session.py          # Async DB session
│   │   └── init.py             # DB initialization
│   ├── llm/
│   │   └── client.py           # OpenAI-compatible client
│   ├── middleware/
│   │   ├── auth.py             # JWT auth middleware
│   │   └── legacy.py           # Rate limit + timing middleware
│   └── rag/
│       ├── agent.py            # LLM answer generation
│       ├── chunking.py         # Document chunking
│       ├── embeddings.py       # Text embedding
│       └── retrieval.py        # Vector similarity search
├── web/
│   ├── src/
│   │   ├── App.tsx             # Main chat UI
│   │   ├── AuthScreen.tsx      # Login/signup screen
│   │   ├── auth.ts             # Auth token helpers
│   │   └── components/         # ScrollContainer, WelcomeScreen
│   └── Dockerfile
├── docker-compose.yml          # Dev + Prod docker compose
└── pyproject.toml              # Python dependencies
```

---

## Screenshots

### Login Screen
```
┌─────────────────────────────────────────┐
│                                         │
│          ┌───────────────────┐         │
│          │   🤖  Agentic AI   │         │
│          │ Welcome back —     │         │
│          │ sign in to continue│         │
│          │                    │         │
│          │ [Sign In] [Sign Up]│         │
│          │ [📧 Email]         │         │
│          │ [🔒 Password]  [👁]│         │
│          │ [  Sign In  →  ]   │         │
│          │ ─ Or continue with ─         │
│          │ [Google]  [GitHub]│         │
│          └───────────────────┘         │
│                                         │
└─────────────────────────────────────────┘
```

### Chat Interface
```
┌──────────────────────────────────────────┐
│ [+] 🤖 RAG Assistant  /  Document Chat  │ 👤
├──────────────────────────────────────────┤
│                                          │
│    Hey, what does the doc say?           │ ← (you)
│                                          │
│ 🤖 The document discusses...             │ ← (assistant)
│    [src 1] [src 2]  [Copy]               │
│                                          │
├──────────────────────────────────────────┤
│ [📎] Ask anything… or drop a file  [➤] │
└──────────────────────────────────────────┘
```

### Sidebar (Conversations)
```
┌────────────────────────┐
│ [+ New Chat]           │
│ ─────────────────────  │
│ Today                  │
│  > Document Analysis   │ ← (active)
│  > Quick question      │
│ Past 7 days            │
│  Meeting notes         │
│  Research on X         │
│ Older                  │
│  First conversation    │
│                        │
└────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **AI/ML** | OpenAI API, pgvector, sentence embeddings |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Cache** | Redis 7 (response cache + rate limiting) |
| **Auth** | JWT (python-jose), bcrypt, Authlib (OAuth) |
| **Frontend** | React 19, TypeScript, Material-UI, Vite |
| **Infra** | Docker Compose, Nginx reverse proxy |
| **Migrations** | Alembic (auto-generate from SQLAlchemy models) |

---

## License

MIT — see LICENSE file.

---

<p align="center">
  Made with ❤️ using FastAPI + React
</p>
