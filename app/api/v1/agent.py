from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent.graph import build_graph
from app.agent.models import AgentRunRequest, AgentRunResponse, AgentState
from app.core.config import get_settings


router = APIRouter(prefix="/v1/agent", tags=["agent"])


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(req: AgentRunRequest):
    settings = get_settings()
    run_id = uuid.uuid4().hex

    try:
        graph = build_graph(settings=settings)
        out = await graph.ainvoke(AgentState(prompt=req.prompt))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    if isinstance(out, AgentState):
        output = out.output
    elif isinstance(out, dict):
        output = str(out.get("output", ""))
    else:
        output = str(out)

    return AgentRunResponse(output=output, run_id=run_id)


@router.post("/stream")
async def stream_agent(req: AgentRunRequest):
    settings = get_settings()
    run_id = uuid.uuid4().hex

    async def gen():
        yield f"event: meta\ndata: {json.dumps({'run_id': run_id})}\n\n"
        await asyncio.sleep(0)
        try:
            graph = build_graph(settings=settings)
            out = await graph.ainvoke(AgentState(prompt=req.prompt))
        except RuntimeError as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            return

        if isinstance(out, AgentState):
            output = out.output
        elif isinstance(out, dict):
            output = str(out.get("output", ""))
        else:
            output = str(out)

        yield f"event: result\ndata: {json.dumps({'output': output})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
