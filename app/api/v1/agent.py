from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent.models import AgentRunRequest, AgentRunResponse, AgentState
from app.agent.graph import build_chat_graph
from app.core.config import get_settings
from app.llm.client import LLMClient

router = APIRouter(prefix="/v1/agent", tags=["agent"])


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(req: AgentRunRequest):
    settings = get_settings()
    run_id = uuid.uuid4().hex
    llm = LLMClient(settings)

    try:
        builder = {
            "chat": build_chat_graph,
        }.get(req.mode, build_chat_graph)
        graph = builder(settings=settings, llm=llm)
        state = AgentState(prompt=req.prompt)
        out = await graph.ainvoke(state)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {e}") from e

    output = str(out.output) if isinstance(out, AgentState) else str(out.get("output", "") if isinstance(out, dict) else out)

    return AgentRunResponse(
        output=output,
        run_id=run_id,
        mode=req.mode,
        model=settings.openai_model,
    )


@router.post("/stream")
async def stream_agent(req: AgentRunRequest):
    settings = get_settings()
    run_id = uuid.uuid4().hex

    async def gen():
        yield f"event: meta\ndata: {json.dumps({'run_id': run_id})}\n\n"
        try:
            llm = LLMClient(settings)
            builder = {
                "chat": build_chat_graph,
            }.get(req.mode, build_chat_graph)
            graph = builder(settings=settings, llm=llm)
            state = AgentState(prompt=req.prompt)
            out = await graph.ainvoke(state)
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            return

        output = out.output if isinstance(out, AgentState) else str(out.get("output", "") if isinstance(out, dict) else out)
        yield f"event: result\ndata: {json.dumps({'output': output})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
