"""Dynamic tool registry with schema validation, permissions, and audit logging."""
from __future__ import annotations

import json
import time
import uuid
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import structlog

log = structlog.get_logger(__name__)


@dataclass
class ToolSchema:
    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema
    metadata_: dict[str, Any] = field(default_factory=dict)
    requires_permission: bool = False
    timeout_seconds: int = 30


@dataclass
class ToolExecution:
    tool_name: str
    arguments: dict[str, Any]
    result: str
    success: bool
    duration_ms: float
    run_id: str = ""
    timestamp: float = field(default_factory=time.time)


def _python_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Python code to execute",
            },
            "timeout": {
                "type": "integer",
                "description": "Execution timeout in seconds",
                "default": 30,
            },
        },
        "required": ["code"],
    }


def _financial_calc_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "operation": {"type": "string", "enum": ["compound_interest", "npv", "irr", "roi", "mortgage"]},
            "principal": {"type": "number"},
            "rate": {"type": "number"},
            "time": {"type": "number"},
            "cash_flows": {"type": "array", "items": {"type": "number"}},
            "down_payment": {"type": "number"},
            "term_years": {"type": "number"},
        },
        "required": ["operation"],
    }


def _database_query_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "SQL query to execute"},
        },
        "required": ["query"],
    }


class BaseTool(ABC):
    def __init__(self, schema: ToolSchema):
        self.schema = schema
        self._audit_log: list[ToolExecution] = []

    @abstractmethod
    async def execute(self, arguments: dict[str, Any]) -> str:
        ...

    async def run(self, arguments: dict[str, Any]) -> ToolExecution:
        start = time.monotonic()
        try:
            result = await self.execute(arguments)
            exec_record = ToolExecution(
                tool_name=self.schema.name,
                arguments=arguments,
                result=result,
                success=True,
                duration_ms=(time.monotonic() - start) * 1000,
            )
            self._audit_log.append(exec_record)
            log.info("tool_execution", tool=self.schema.name, success=True, duration_ms=exec_record.duration_ms)
            return exec_record
        except Exception as e:
            duration = (time.monotonic() - start) * 1000
            exec_record = ToolExecution(
                tool_name=self.schema.name,
                arguments=arguments,
                result=str(e),
                success=False,
                duration_ms=duration,
            )
            self._audit_log.append(exec_record)
            log.error("tool_execution_failed", tool=self.schema.name, error=str(e))
            return exec_record

    def get_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.schema.name,
                "description": self.schema.description,
                "parameters": self.schema.parameters,
            },
        }


class PythonExecutorTool(BaseTool):
    async def execute(self, arguments: dict[str, Any]) -> str:
        code = arguments.get("code", "")
        allowed_modules = {"math", "datetime", "json", "statistics", "decimal", "itertools", "collections", "functools", "random", "string"}
        # Validate no dangerous imports
        unsafe_modules = {"os", "sys", "subprocess", "shutil", "socket", "http", "urllib", "requests", "importlib"}
        for unsafe in unsafe_modules:
            if f"import {unsafe}" in code or f"from {unsafe}" in code:
                raise ValueError(f"Module '{unsafe}' is not allowed in sandbox")

        local_ns: dict = {}
        global_ns = {
            "print": lambda x=None: str(x),
            "__builtins__": {
                "int": int, "float": float, "str": str, "list": list,
                "dict": dict, "set": set, "tuple": tuple, "len": len,
                "sum": sum, "max": max, "min": min, "abs": abs,
                "round": round, "sorted": sorted, "range": range,
                "enumerate": enumerate, "zip": zip, "map": map, "filter": filter,
                "isinstance": isinstance, "type": type, "bool": bool,
                "iter": iter, "next": next, "reversed": reversed,
                "any": any, "all": all,
            },
        }
        try:
            import math
            import datetime
            import statistics
            global_ns["math"] = math
            global_ns["datetime"] = datetime
            global_ns["statistics"] = statistics

            captured = []
            def _print(*args):
                captured.append(" ".join(str(a) for a in args))

            global_ns["print"] = _print
            exec(code, global_ns, local_ns)
            output = captured[-1] if captured else str(local_ns)
            return output
        except Exception as e:
            raise RuntimeError(f"Execution error: {e}") from e


class FinancialCalculatorTool(BaseTool):
    async def execute(self, arguments: dict[str, Any]) -> str:
        op = arguments["operation"]
        import math as _math
        if op == "compound_interest":
            p = arguments.get("principal", 0)
            r = arguments.get("rate", 0)
            t = arguments.get("time", 0)
            n = arguments.get("compounds_per_year", 12)
            result = p * (1 + r / n) ** (n * t)
            return json.dumps({"final_amount": round(result, 2), "interest_earned": round(result - p, 2)})
        elif op == "roi":
            gain = arguments.get("gain", 0)
            cost = arguments.get("cost", 1)
            roi = ((gain - cost) / cost) * 100
            return json.dumps({"roi_percent": round(roi, 2)})
        elif op == "mortgage":
            p = arguments.get("principal", arguments.get("down_payment", 0))
            r = arguments.get("rate", 0) / 12
            n = arguments.get("term_years", 30) * 12
            if r == 0:
                m = p / n
            else:
                m = p * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
            return json.dumps({"monthly_payment": round(m, 2)})
        elif op == "npv":
            rate = arguments.get("rate", 0)
            cfs = arguments.get("cash_flows", [])
            npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cfs))
            return json.dumps({"npv": round(npv, 2)})
        else:
            raise ValueError(f"Unknown operation: {op}")


class ToolAuditLog:
    def __init__(self):
        self._entries: list[ToolExecution] = []

    def record(self, entry: ToolExecution):
        self._entries.append(entry)

    def get_recent(self, limit: int = 50) -> list[dict[str, Any]]:
        return [
            {
                "tool": e.tool_name,
                "arguments": e.arguments,
                "success": e.success,
                "duration_ms": round(e.duration_ms, 2),
                "timestamp": e.timestamp,
            }
            for e in self._entries[-limit:]
        ]


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, BaseTool] = {}
        self.audit_log = ToolAuditLog()

    def register(self, tool: BaseTool):
        self._tools[tool.schema.name] = tool

    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, Any]]:
        return [t.get_schema() for t in self._tools.values()]

    def get_openai_tools(self) -> list[dict[str, Any]]:
        return [t.get_schema() for t in self._tools.values()]

    async def execute(self, tool_name: str, arguments: dict[str, Any], user_permissions: list[str] | None = None) -> ToolExecution:
        tool = self._tools.get(tool_name)
        if not tool:
            raise ValueError(f"Tool not found: {tool_name}")
        if tool.schema.requires_permission and user_permissions and tool_name not in user_permissions:
            raise PermissionError(f"No permission for tool: {tool_name}")
        result = await tool.run(arguments)
        self.audit_log.record(result)
        return result

    def get_default_registry() -> ToolRegistry:
        registry = ToolRegistry()
        registry.register(PythonExecutorTool(ToolSchema(
            name="python_executor",
            description="Execute Python code in a sandboxed environment. Only safe imports allowed (math, datetime, statistics, json).",
            parameters=_python_schema(),
            requires_permission=True,
        )))
        registry.register(FinancialCalculatorTool(ToolSchema(
            name="financial_calculator",
            description="Perform financial calculations: compound interest, ROI, NPV, mortgage payments.",
            parameters=_financial_calc_schema(),
            requires_permission=False,
        )))
        return registry


_default = ToolRegistry.get_default_registry()


def get_registry() -> ToolRegistry:
    return _default


def list_tools() -> list[dict[str, Any]]:
    return _default.list_tools()


def get_openai_tools() -> list[dict[str, Any]]:
    return _default.get_openai_tools()
