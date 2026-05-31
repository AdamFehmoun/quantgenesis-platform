"""B-S2-05 / B-LOGS-SANDBOX — Read-only windows over the log tables.

- GET /api/logs          → api_request_logs (HTTP audit trail, captured by
                           RequestLoggingMiddleware).
- GET /api/logs/sandbox  → sandbox_logs (Sharpe/latency/memory captured by
                           pipeline.py after each E2B backtest run).

Both endpoints exist so the demo + Maxime's frontend can sanity-check live
activity without shelling into the database.
"""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.api_request_log import APIRequestLog
from app.models.sandbox_log import SandboxLog

router = APIRouter(prefix="/api/logs", tags=["logs"])


def _serialize(row: APIRequestLog) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "client_ip": row.client_ip,
        "method": row.method,
        "path": row.path,
        "status_code": row.status_code,
        "execution_time_seconds": row.execution_time_seconds,
        "created_at": row.created_at.isoformat(),
    }


def _serialize_sandbox(row: SandboxLog) -> dict[str, Any]:
    """B-LOGS-SANDBOX: canonical wire shape for the sandbox metrics row.

    Aligned strictly on the official SandboxLog schema (Mathis, commit c7ca780):
    audit triplet (status / error_type / created_at) + execution metrics
    (sharpe_ratio nullable, execution_time_ms, memory_used_mb) + code_hash
    so the frontend can correlate identical runs.
    """
    return {
        "id": str(row.id),
        "status": row.status,
        "error_type": row.error_type,
        "sharpe_ratio": row.sharpe_ratio,
        "execution_time_ms": row.execution_time_ms,
        "memory_used_mb": row.memory_used_mb,
        "code_hash": row.code_hash,
        "created_at": row.created_at.isoformat(),
    }


@router.get("")
def list_request_logs(
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    """Return the most recent API request logs, newest first."""
    stmt = select(APIRequestLog).order_by(APIRequestLog.created_at.desc()).limit(limit)
    return [_serialize(row) for row in session.exec(stmt).all()]


@router.get("/sandbox")
def list_sandbox_logs(
    limit: int = Query(20, ge=1, le=200),
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    """B-LOGS-SANDBOX: return the most recent sandbox execution rows.

    Each row carries the Sharpe ratio, latency and memory consumption of one
    E2B backtest run. Sorted newest-first so the frontend can render a live
    feed without server-side cursoring.
    """
    stmt = select(SandboxLog).order_by(SandboxLog.created_at.desc()).limit(limit)
    return [_serialize_sandbox(row) for row in session.exec(stmt).all()]
