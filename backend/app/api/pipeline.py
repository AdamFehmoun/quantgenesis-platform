import logging
import os
import sys
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlmodel import Session

from app.core.db import get_session
from app.core.rate_limit import limiter
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
    if status == "success":
        # On récupère le code généré par l'agent Codeur
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
            # --- MATHIS S3 : BOUCLE RETRY ET FALLBACK ---
            MAX_RETRIES = 2
            attempt = 0
            success = False
            
            while attempt <= MAX_RETRIES and not success:
                attempt += 1
                logger.info(f"[Sandbox] Exécution tentative {attempt}/{MAX_RETRIES + 1}")
                
                backtest_result = _run_sandbox_backtest(code, spread=spread)
                
                # On considère le run comme un succès s'il y a un retour de la sandbox avec SUCCESS
                if backtest_result and backtest_result.get('status') == 'SUCCESS':
                    success = True
                    logger.info(f"[Sandbox] Tentative {attempt} réussie.")
                else:
                    error_type = backtest_result.get('error', 'unknown') if backtest_result else "unknown"
                    logger.warning(f"[Sandbox] Échec tentative {attempt}. Raison: {error_type}")
                    
                    # Règle de sécurité : On ne retry jamais si c'est une violation de sécurité
                    if error_type == 'security_violation':
                        logger.error("[Sandbox] Violation de sécurité détectée, annulation immédiate des retries.")
                        break
            
            # Si toutes les tentatives échouent (erreurs de syntaxe ou crash du code)
            if not success:
                logger.warning("[Sandbox] Toutes les tentatives ont échoué. Déclenchement du signal FALLBACK.")
                # On renvoie un résultat formaté pour indiquer à Paul qu'il doit déclencher son template
                backtest_result = {
                    'status': 'FALLBACK',
                    'error': 'all_retries_failed',
                    'fallback_required': True,
                    'execution_time_ms': 0
                }
            # ----------------------------------------------
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