"""Request-ID middleware — generates a UUID per request, attaches to
structlog context so every log line carries `request_id`."""
from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request

import structlog

_REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        # Use caller's request-id if present, otherwise mint a new one
        request_id = (
            request.headers.get(_REQUEST_ID_HEADER)
            or uuid.uuid4().hex
        )

        structlog.contextvars.bind_contextvars(request_id=request_id)
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers[_REQUEST_ID_HEADER] = request_id
        return response
