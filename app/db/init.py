from __future__ import annotations

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.models import Base

log = structlog.get_logger(__name__)

_TSVECTOR_TRIGGER = """
CREATE OR REPLACE FUNCTION chunk_tsv_update() RETURNS trigger AS $$
BEGIN
    NEW.tsv := to_tsvector('english', coalesce(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tsv_chunks_trigger
    BEFORE INSERT OR UPDATE ON chunks
    FOR EACH ROW EXECUTE FUNCTION chunk_tsv_update();
"""


async def init_db(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        # Step 1: pgvector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # Step 2: Create tables (chunks table must exist before trigger)
        await conn.run_sync(Base.metadata.create_all)
        # Step 3: tsvector auto-update trigger
        await conn.execute(text(_TSVECTOR_TRIGGER))

