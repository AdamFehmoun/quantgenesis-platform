import logging
import os
import sys
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session

from app.core.db import get_session
from app.models.strategy import Strategy

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


_STATUS_MAP = {"SUCCESS": "success", "REJECTED": "rejected", "ERROR": "error"}


def _run_agents_pipeline(intent: str) -> dict[str, Any]:
    """Lazy bridge to the agents repo `run_pipeline`.

    Isolated as a module-level function so tests can monkeypatch it without
    needing the agents codebase on PYTHONPATH.
    """
    agents_path = os.getenv("AGENTS_PATH", "/home/berkant/quantgenesis-agents")
    if agents_path and agents_path not in sys.path:
        sys.path.insert(0, agents_path)

    try:
        from api import run_pipeline as _agents_run_pipeline  # type: ignore[import-not-found]
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Agents pipeline unavailable (AGENTS_PATH={agents_path!r}): {exc}",
        ) from exc

    return _agents_run_pipeline(intent, verbose=False)


@router.post("/run")
def run_pipeline(
    payload: dict[str, Any] = Body(...),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    intent = payload.get("intent")
    if not intent or not isinstance(intent, str):
        raise HTTPException(status_code=422, detail="Field 'intent' is required (string).")

    agents_response = _run_agents_pipeline(intent)
    raw_status = (agents_response or {}).get("status", "ERROR")
    pipeline_result = (agents_response or {}).get("result") or {}
    error_message = (agents_response or {}).get("error")

    final_spec = pipeline_result.get("final_spec")
    compliance_log = pipeline_result.get("compliance_log")
    status = _STATUS_MAP.get(raw_status, "error")

    strategy = Strategy(
        intent=intent,
        status=status,
        result_json=pipeline_result if pipeline_result else None,
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)

    return {
        "id": str(strategy.id),
        "status": status,
        "intent": intent,
        "created_at": strategy.created_at.isoformat(),
        "final_spec": final_spec,
        "compliance_log": compliance_log,
        "error": error_message,
        "pipeline": pipeline_result,
    }
