-- ──────────────────────────────────────────────────────────────────────
-- Neon PostgreSQL + pgvector setup
-- Run once per project:  psql 'postgresql://...' -f setup.sql
-- ──────────────────────────────────────────────────────────────────────

-- 1. Enable pgvector extension (Neon supports it natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. GIN index for hybrid keyword search (tsvector auto-populated by trigger)
CREATE INDEX IF NOT EXISTS ix_chunks_tsv ON chunks USING GIN(tsv);

-- 3. Connection limits — Neon free tier = 2 vCPU, 2 GB RAM
--     Set max_connections if needed (default 100)
-- ALTER SYSTEM SET max_connections = 50;

-- 4. Verify extension loaded
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
