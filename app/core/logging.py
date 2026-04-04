"""Structured logging via structlog.

Every log line automatically includes:
  • request_id  (from middleware / contextvar)
  • user_id     (bound manually after auth)
  • duration_ms (bound by timing middleware)
  • endpoint    (path of the current request)
"""
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog


def configure_logging(*, log_level: str = "INFO", json_logs: bool = True) -> None:
    logging.basicConfig(
        format="%(message)s", stream=sys.stdout, level=logging.getLevelName(log_level)
    )

    shared_procs: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if json_logs:
        shared_procs.append(structlog.processors.dict_tracebacks)
        shared_procs.append(structlog.processors.JSONRenderer())
    else:
        shared_procs.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=shared_procs,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
