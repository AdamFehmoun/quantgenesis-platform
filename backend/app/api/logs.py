"""B-S2-05 — Read-only window over the api_request_logs table.

Exposes the last N HTTP requests captured by RequestLoggingMiddleware so the
demo and the on-call rotation can sanity-check live traffic without shelling
into the database.
"""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.api_request_log import APIRequestLog

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


@router.get("")
def list_request_logs(
    limit: int = Query(10, ge=1, le=100),
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    """Return the most recent API request logs, newest first."""
    stmt = select(APIRequestLog).order_by(APIRequestLog.created_at.desc()).limit(limit)
    return [_serialize(row) for row in session.exec(stmt).all()]
