import logging
import os
import sys
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session

from app.core.db import get_session
from app.models.strategy import Strategy

logger = logging.getLogger(__name__)

# B-SANDBOX: ensure project root is importable so `from sandbox.executor` resolves
# inside the Docker container (sandbox is mounted at /app/sandbox via compose).
_PROJECT_ROOT = os.getenv("PROJECT_ROOT", "/app")
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


_STATUS_MAP = {"SUCCESS": "success", "REJECTED": "rejected", "ERROR": "error"}

_METRIC_KEYS = ("sharpe_ratio", "max_drawdown_pct", "total_return_pct", "num_trades", "win_rate_pct")


def _run_agents_pipeline(intent: str) -> dict[str, Any]:
    """Lazy bridge to the agents repo `run_pipeline`."""
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


def _run_sandbox_backtest(code: str) -> dict[str, Any]:
    """Lazy bridge to Mathis' sandbox executor. Isolated for testability."""
    try:
        from sandbox.executor import run_backtest as _run_backtest  # type: ignore[import-not-found]
    except ImportError as exc:
        logger.warning("sandbox.executor unavailable: %s", exc)
        return {"status": "ERROR", "stderr": f"sandbox.executor import failed: {exc}"}

    try:
        return _run_backtest(code)
    except Exception as exc:  # executor wraps errors but never trust an external module
        logger.warning("sandbox.executor raised: %s", exc)
        return {"status": "ERROR", "stderr": str(exc)}


def _build_metrics(backtest_result: dict[str, Any] | None) -> dict[str, float | int]:
    """Shape the metrics object expected by the frontend, rounded to 2 decimals."""
    result = backtest_result or {}
    return {
        "sharpe_ratio": round(float(result.get("sharpe_ratio", 0.0) or 0.0), 2),
        "max_drawdown_pct": round(float(result.get("max_drawdown_pct", 0.0) or 0.0), 2),
        "total_return_pct": round(float(result.get("total_return_pct", 0.0) or 0.0), 2),
        "num_trades": int(result.get("num_trades", 0) or 0),
        "win_rate_pct": round(float(result.get("win_rate_pct", 0.0) or 0.0), 2),
    }


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

    if raw_status == "ERROR":
        raise HTTPException(
            status_code=500,
            detail=error_message or "Agents pipeline failed with no error message.",
        )

    final_spec = pipeline_result.get("final_spec") or {}
    compliance_log = pipeline_result.get("compliance_log")
    status = _STATUS_MAP.get(raw_status, "error")

    # B-SANDBOX: dispatch the generated code to Mathis' E2B executor when the
    # agents approved the spec. Skip on REJECTED to avoid burning sandbox time.
    backtest_result: dict[str, Any] | None = None
    if status == "success":
        code = (
            pipeline_result.get("claude_code_instructions")
            or final_spec.get("claude_code_instructions")
            or ""
        )
        if code:
            backtest_result = _run_sandbox_backtest(code)
        else:
            logger.warning("No claude_code_instructions returned by agents; skipping backtest.")

    metrics = _build_metrics(backtest_result)

    strategy = Strategy(
        intent=intent,
        status=status,
        result_json={**pipeline_result, "metrics": metrics} if pipeline_result else {"metrics": metrics},
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)

    return {
        "id": str(strategy.id),
        "status": status,
        "intent": intent,
        "created_at": strategy.created_at.isoformat(),
        "final_spec": final_spec or None,
        "compliance_log": compliance_log,
        "metrics": metrics,
        "backtest": backtest_result,
        "error": error_message,
        "pipeline": pipeline_result,
    }
