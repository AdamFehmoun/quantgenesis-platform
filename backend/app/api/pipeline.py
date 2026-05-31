import hashlib
import logging
import os
import sys
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlmodel import Session

from app.core.db import get_session
from app.core.rate_limit import limiter
from app.models.sandbox_log import SandboxLog
from app.models.strategy import Strategy

logger = logging.getLogger(__name__)

_PROJECT_ROOT = os.getenv("PROJECT_ROOT", "/app")
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


_STATUS_MAP = {"SUCCESS": "success", "REJECTED": "rejected", "ERROR": "error"}

_METRIC_KEYS = ("sharpe_ratio", "max_drawdown_pct", "total_return_pct", "num_trades", "win_rate_pct")

_SPREAD_EQUITY_US = 0.0001
_SPREAD_CRYPTO = 0.0005

_CRYPTO_TOKENS = frozenset({
    "btc", "eth", "sol", "bnb", "xrp", "ada", "doge", "dot", "avax", "matic",
    "ltc", "bch", "link", "atom", "trx", "usdt", "usdc", "busd",
    "bitcoin", "ethereum", "crypto", "altcoin", "binance", "coinbase",
})


def _resolve_spread(intent: str) -> float:
    """Pick a spread based on the asset class hinted by the intent."""
    tokens = {tok.strip(".,:;!?()[]{}\"'").lower() for tok in intent.split()}
    if tokens & _CRYPTO_TOKENS:
        return _SPREAD_CRYPTO
    return _SPREAD_EQUITY_US


def _run_agents_pipeline(intent: str) -> dict[str, Any]:
    """Lazy bridge to the agents repo run_pipeline."""
    import sys
    import os
    agents_path = os.environ.get("AGENTS_PATH", "/app/agents")
    app_root = os.path.dirname(agents_path)
    if app_root not in sys.path:
        sys.path.insert(0, app_root)
    if agents_path not in sys.path:
        sys.path.insert(0, agents_path)

    try:
        from api import run_pipeline as _agents_run_pipeline  # type: ignore[import-not-found]
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Agents pipeline unavailable (AGENTS_PATH={agents_path!r}): {exc}",
        ) from exc

    return _agents_run_pipeline(intent, verbose=False)


def _run_sandbox_backtest(code: str, spread: float = _SPREAD_EQUITY_US) -> dict[str, Any]:
    """Lazy bridge to Mathis' sandbox executor. Isolated for testability."""
    try:
        from sandbox.executor import run_backtest as _run_backtest  # type: ignore[import-not-found]
    except ImportError as exc:
        logger.warning("sandbox.executor unavailable: %s", exc)
        return {"status": "ERROR", "stderr": f"sandbox.executor import failed: {exc}"}

    try:
        return _run_backtest(code, spread=spread)
    except TypeError:
        return _run_backtest(code)
    except Exception as exc:
        logger.warning("sandbox.executor raised: %s", exc)
        return {"status": "ERROR", "stderr": str(exc)}


def _persist_sandbox_log(
    session: Session,
    code: str,
    backtest_result: dict[str, Any] | None,
) -> None:
    """B-LOGS-SANDBOX: persist one row per sandbox run.

    Aligned on Mathis' official SandboxLog schema (commit c7ca780):
      - status, execution_time_ms, code_hash, memory_used_mb : NOT NULL
      - sharpe_ratio, error_type                             : nullable

    code_hash = sha256(code)[:32] so identical runs share the same hash for
    correlation. memory_used_mb defaults to 0.0 (NOT NULL in the table).

    Never raises — sandbox logging is observability, not the critical path.
    """
    if not backtest_result:
        return
    try:
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()[:32]
        raw_sharpe = backtest_result.get("sharpe_ratio")
        sharpe = float(raw_sharpe) if raw_sharpe is not None else None
        row = SandboxLog(
            status=str(backtest_result.get("status", "UNKNOWN")),
            error_type=backtest_result.get("error"),
            sharpe_ratio=sharpe,
            execution_time_ms=int(backtest_result.get("execution_time_ms", 0) or 0),
            memory_used_mb=float(backtest_result.get("memory_used_mb") or 0.0),
            code_hash=code_hash,
        )
        session.add(row)
        session.commit()
    except Exception as exc:
        logger.warning("Failed to persist SandboxLog: %s", exc)
        session.rollback()


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
@limiter.limit("5/hour")
def run_pipeline(
    request: Request,
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

    spread = _resolve_spread(intent)
    backtest_params = {"spread": spread}

    backtest_result: dict[str, Any] | None = None
    executed_code: str | None = None
    if status == "success":
        code = pipeline_result.get("claude_code_instructions") or final_spec.get(
            "claude_code_instructions"
        )
        if code:
            code += """
# --- Injections Metrics QuantGenesis ---
print(f'SHARPE:{float(pf.sharpe_ratio()):.4f}')
print(f'DRAWDOWN:{float(pf.max_drawdown()):.4f}')
print(f'RETURN:{float(pf.total_return()):.4f}')
print(f'TRADES:{int(pf.trades.count() if hasattr(pf, "trades") else 0)}')
"""
            executed_code = code
            backtest_result = _run_sandbox_backtest(code, spread=spread)
        else:
            logger.warning("No claude_code_instructions returned by agents; skipping backtest.")

    metrics = _build_metrics(backtest_result)

    strategy_payload: dict[str, Any] = {"metrics": metrics, "backtest_params": backtest_params}
    if pipeline_result:
        strategy_payload = {**pipeline_result, **strategy_payload}

    strategy = Strategy(
        intent=intent,
        status=status,
        result_json=strategy_payload,
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)

    # B-LOGS-SANDBOX: persist one row per sandbox run (best-effort, won't raise).
    # Skipped on REJECTED runs (executed_code is None) — SandboxLog only tracks
    # actual sandbox executions, not pipeline-level rejections.
    if executed_code is not None:
        _persist_sandbox_log(session, executed_code, backtest_result)

    return {
        "id": str(strategy.id),
        "status": status,
        "intent": intent,
        "created_at": strategy.created_at.isoformat(),
        "final_spec": final_spec or None,
        "compliance_log": compliance_log,
        "metrics": metrics,
        "backtest": backtest_result,
        "backtest_params": backtest_params,
        "spread": spread,
        "error": error_message,
        "pipeline": pipeline_result,
    }
