import hashlib
import json
import logging
import os
import sys
from typing import Any

import redis
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlmodel import Session

from app.core.db import get_session
from app.core.rate_limit import limiter
from app.models.sandbox_log import SandboxLog
from app.models.strategy import Strategy
from app.services.data_service import _get_redis

logger = logging.getLogger(__name__)

_PROJECT_ROOT = os.getenv("PROJECT_ROOT", "/app")
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


_STATUS_MAP = {"SUCCESS": "success", "REJECTED": "rejected", "ERROR": "error"}

# Canonical metric envelope (arbitrage du 06/06/2026) :
#   max_drawdown_pct / total_return_pct / trades_count.
_METRIC_KEYS = (
    "sharpe_ratio",
    "max_drawdown_pct",
    "total_return_pct",
    "trades_count",
    "win_rate_pct",
)

# Backtest status surfaced in `backtest.status` (contrat Maxime) :
#   SUCCESS  — exécution réelle, métriques fiables (non nulles)
#   FALLBACK — retries épuisés, template a pris le relais : métriques null
#   ERROR    — exécution KO, pas de métriques (null également)
_BACKTEST_SUCCESS = "SUCCESS"
_BACKTEST_FALLBACK = "FALLBACK"
_BACKTEST_ERROR = "ERROR"

_SPREAD_EQUITY_US = 0.0001
_SPREAD_CRYPTO = 0.0005

_CRYPTO_TOKENS = frozenset({
    "btc", "eth", "sol", "bnb", "xrp", "ada", "doge", "dot", "avax", "matic",
    "ltc", "bch", "link", "atom", "trx", "usdt", "usdc", "busd",
    "bitcoin", "ethereum", "crypto", "altcoin", "binance", "coinbase",
})


def _pipeline_cache_key(intent: str) -> str:
    """Cache key for a full /run response, keyed on the normalized intent."""
    norm = intent.lower().strip()
    return "pipeline:" + hashlib.sha256(norm.encode()).hexdigest()


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
        return {"status": _BACKTEST_ERROR, "stderr": f"sandbox.executor import failed: {exc}"}

    try:
        return _run_backtest(code, spread=spread)
    except TypeError:
        return _run_backtest(code)
    except Exception as exc:
        logger.warning("sandbox.executor raised: %s", exc)
        return {"status": _BACKTEST_ERROR, "stderr": str(exc)}


def _optional_float(value: Any) -> float | None:
    """Coerce a sandbox-reported metric to float, preserving None for missing data.

    The frontend distinguishes "no data" (null) from "exactly zero" (0.0),
    so we must not silently default to 0.0 here.
    """
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_backtest_metrics(backtest_result: dict[str, Any] | None) -> dict[str, Any]:
    """Reconcile the two executor shapes onto the canonical envelope.

    Mathis' executor emits raw fractions under `drawdown` / `return` (pf.max_drawdown()
    and pf.total_return() return 0..1 floats). Older callers — and our frontend
    contract — expect `max_drawdown_pct` / `total_return_pct` in percent, and
    `trades_count` (anciennement `num_trades`). Accepts either shape.

    Returns a dict with potentially-null floats so the persistence layer can tell
    "missing" apart from "exactly zero".
    """
    src = backtest_result or {}

    def _pct(key_pct: str, key_raw: str) -> float | None:
        if src.get(key_pct) is not None:
            return _optional_float(src[key_pct])
        raw = _optional_float(src.get(key_raw))
        return None if raw is None else raw * 100.0

    # trades_count : accepte les deux noms en entrée (rétro-compat sandbox).
    trades_raw = src.get("trades_count")
    if trades_raw is None:
        trades_raw = src.get("num_trades")

    return {
        "sharpe_ratio": _optional_float(src.get("sharpe_ratio")),
        "max_drawdown_pct": _pct("max_drawdown_pct", "drawdown"),
        "total_return_pct": _pct("total_return_pct", "return"),
        "trades_count": _optional_int(trades_raw),
    }


def _classify_backtest_status(backtest_result: dict[str, Any] | None) -> str:
    """Coerce le statut brut renvoyé par la sandbox vers le contrat Maxime.

    Trois valeurs publiques : SUCCESS, FALLBACK, ERROR. Tout statut inconnu est
    remonté comme ERROR (fail-safe : on ne ment pas au front).
    """
    if not backtest_result:
        return _BACKTEST_ERROR
    raw = str(backtest_result.get("status") or "").upper()
    if raw == _BACKTEST_SUCCESS:
        return _BACKTEST_SUCCESS
    if raw == _BACKTEST_FALLBACK:
        return _BACKTEST_FALLBACK
    return _BACKTEST_ERROR


def _persist_sandbox_log(
    session: Session,
    code: str,
    backtest_result: dict[str, Any] | None,
) -> None:
    """B-LOGS-SANDBOX: persist one row per sandbox run.

    Aligned on Mathis' official SandboxLog schema (commit c7ca780) extended in
    S3 / Task 2 with the canonical metrics envelope :
      - status, execution_time_ms, code_hash, memory_used_mb : NOT NULL
      - sharpe_ratio, error_type                             : nullable
      - max_drawdown_pct, total_return_pct, trades_count     : nullable

    code_hash = sha256(code)[:32] so identical runs share the same hash for
    correlation. memory_used_mb defaults to 0.0 (NOT NULL in the table).

    Never raises — sandbox logging is observability, not the critical path.
    """
    if not backtest_result:
        return
    try:
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()[:32]
        normalized = _normalize_backtest_metrics(backtest_result)
        row = SandboxLog(
            status=str(backtest_result.get("status", "UNKNOWN")),
            error_type=backtest_result.get("error"),
            sharpe_ratio=normalized["sharpe_ratio"],
            max_drawdown_pct=normalized["max_drawdown_pct"],
            total_return_pct=normalized["total_return_pct"],
            trades_count=normalized["trades_count"],
            execution_time_ms=int(backtest_result.get("execution_time_ms", 0) or 0),
            memory_used_mb=float(backtest_result.get("memory_used_mb") or 0.0),
            code_hash=code_hash,
        )
        session.add(row)
        session.commit()
    except Exception as exc:
        logger.warning("Failed to persist SandboxLog: %s", exc)
        session.rollback()


def _build_metrics(
    backtest_result: dict[str, Any] | None,
    backtest_status: str,
) -> dict[str, float | int | None]:
    """Shape l'enveloppe metrics renvoyée au frontend.

    Règle FALLBACK / ERROR : on remonte explicitement `None` pour toutes les
    métriques numériques au lieu de zéros trompeurs. Le frontend a déjà la
    logique pour afficher "n/a" quand un champ est null. Le contrat de clés
    (5 champs) reste constant pour ne pas casser les sérialisations existantes.
    """
    if backtest_status != _BACKTEST_SUCCESS:
        return {
            "sharpe_ratio": None,
            "max_drawdown_pct": None,
            "total_return_pct": None,
            "trades_count": None,
            "win_rate_pct": None,
        }

    normalized = _normalize_backtest_metrics(backtest_result)
    result = backtest_result or {}
    win_rate = _optional_float(result.get("win_rate_pct"))
    return {
        "sharpe_ratio": round(normalized["sharpe_ratio"], 2) if normalized["sharpe_ratio"] is not None else None,
        "max_drawdown_pct": round(normalized["max_drawdown_pct"], 2) if normalized["max_drawdown_pct"] is not None else None,
        "total_return_pct": round(normalized["total_return_pct"], 2) if normalized["total_return_pct"] is not None else None,
        "trades_count": normalized["trades_count"],
        "win_rate_pct": round(win_rate, 2) if win_rate is not None else None,
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

    # Demo-day cache: identical intents (e.g. "RSI Bitcoin") replay an instant,
    # free response instead of re-running the LLM agents + ~40s sandbox. Reuses
    # data_service._get_redis() — same client, graceful no-op when Redis is down.
    cache_client = _get_redis()
    if cache_client is not None:
        try:
            cached = cache_client.get(_pipeline_cache_key(intent))
            if cached:
                return json.loads(cached)
        except (redis.RedisError, ValueError) as exc:
            logger.warning("Pipeline cache read failed: %s", exc)

    try:
        agents_response = _run_agents_pipeline(intent)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Agents pipeline crashed for intent=%r", intent)
        raise HTTPException(status_code=500, detail=f"Agents pipeline crashed: {exc}") from exc

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
    # Code stratégie PROPRE (sans la plomberie d'injection print/CHART_DATA),
    # exposé tel quel à la White-Box du front (backtest.generated_code).
    generated_code: str | None = None
    # `last_sandbox_result` garde la dernière réponse brute de la sandbox pour
    # la persistance SandboxLog (audit). `backtest_result` peut être réécrit
    # en FALLBACK pour l'enveloppe API. Voir la boucle plus bas.
    last_sandbox_result: dict[str, Any] | None = None
    if status == "success":
        # On récupère le code généré par l'agent Codeur
        from agents.codeur import generate_code
        _codeur_out = generate_code(spec=final_spec, user_intent=intent)
        code = _codeur_out["code"]
        # On capture le code PROPRE ici, AVANT l'injection de plomberie
        # (print metrics + CHART_DATA) faite juste en dessous sur `code`.
        generated_code = code or None

        if code:
            code += """
# --- Injections Metrics QuantGenesis ---
print(f'SHARPE:{float(pf.sharpe_ratio()):.4f}')
print(f'DRAWDOWN:{float(pf.max_drawdown()):.4f}')
print(f'RETURN:{float(pf.total_return()):.4f}')
print(f'TRADES:{int(pf.trades.count() if hasattr(pf, "trades") else 0)}')
print(f'WINRATE:{float(pf.trades.win_rate() * 100):.2f}')

# --- Injection chart_data (série temporelle pour graphe front, Maxime) ---
# Sous-échantillonnage stride uniforme : borne dure ~200 points, robuste à
# n'importe quelle fréquence (1h crypto -> 1d equity), pas de biais d'agrégation
# (le pic de drawdown est préservé, ce qu'un resample.mean() lisserait).
import json as _qg_json
try:
    _qg_val = pf.value()
    _qg_dd = pf.drawdown()
    _qg_n = len(_qg_val)
    _QG_TARGET = 200
    _qg_step = max(1, _qg_n // _QG_TARGET)
    _qg_val_ds = _qg_val.iloc[::_qg_step].fillna(0.0)
    _qg_dd_ds = _qg_dd.iloc[::_qg_step].fillna(0.0)
    _qg_chart = [
        {
            'date': _qg_idx.strftime('%Y-%m-%d'),
            'value': float(_qg_v),
            'drawdown': float(_qg_d) * 100.0,
        }
        for _qg_idx, _qg_v, _qg_d in zip(_qg_val_ds.index, _qg_val_ds.values, _qg_dd_ds.values)
    ]
    print('CHART_DATA:' + _qg_json.dumps(_qg_chart))
except Exception as _qg_exc:
    print(f'CHART_DATA_ERROR:{type(_qg_exc).__name__}: {_qg_exc}')
"""
            executed_code = code
            # --- MATHIS S3 : BOUCLE RETRY ET FALLBACK ---
            # On garde séparés :
            #   - `last_sandbox_result` : le DERNIER retour brut de la sandbox
            #     (audit / SandboxLog → garde la vraie cause d'erreur)
            #   - `backtest_result`     : l'enveloppe renvoyée au frontend
            #     (passe à FALLBACK si retries épuisés, contrat Maxime)
            MAX_RETRIES = 2
            attempt = 0
            success = False

            while attempt <= MAX_RETRIES and not success:
                attempt += 1
                logger.info(f"[Sandbox] Exécution tentative {attempt}/{MAX_RETRIES + 1}")

                try:
                    last_sandbox_result = _run_sandbox_backtest(code, spread=spread)
                except Exception as exc:
                    logger.exception("[Sandbox] Tentative %s crashée", attempt)
                    last_sandbox_result = {"status": _BACKTEST_ERROR, "error": f"executor_crashed: {exc}"}

                # On considère le run comme un succès s'il y a un retour de la sandbox avec SUCCESS
                if last_sandbox_result and last_sandbox_result.get('status') == _BACKTEST_SUCCESS:
                    success = True
                    logger.info(f"[Sandbox] Tentative {attempt} réussie.")
                else:
                    error_type = last_sandbox_result.get('error', 'unknown') if last_sandbox_result else "unknown"
                    logger.warning(f"[Sandbox] Échec tentative {attempt}. Raison: {error_type}")

                    # Règle de sécurité : On ne retry jamais si c'est une violation de sécurité
                    if error_type == 'security_violation':
                        logger.error("[Sandbox] Violation de sécurité détectée, annulation immédiate des retries.")
                        break

            if success:
                backtest_result = last_sandbox_result
            else:
                # Toutes les tentatives ont échoué : on renvoie un signal FALLBACK
                # explicite au front (Maxime affiche un badge dédié + métriques null),
                # mais on conserve la dernière erreur sandbox pour l'audit (SandboxLog).
                logger.warning("[Sandbox] Toutes les tentatives ont échoué. Déclenchement du signal FALLBACK.")
                last_error = (last_sandbox_result or {}).get("error") or "all_retries_failed"
                backtest_result = {
                    "status": _BACKTEST_FALLBACK,
                    "error": last_error,
                    "fallback_required": True,
                    "execution_time_ms": (last_sandbox_result or {}).get("execution_time_ms", 0) or 0,
                }
            # ----------------------------------------------
        else:
            logger.warning("No claude_code_instructions returned by agents; skipping backtest.")

    backtest_status = _classify_backtest_status(backtest_result) if executed_code else _BACKTEST_ERROR

    # On enrichit backtest_result avec le status canonique pour que le frontend
    # le voie tel quel dans `body.backtest.status` (contrat explicite Maxime).
    if backtest_result is not None:
        backtest_result = {**backtest_result, "status": backtest_status}
        # WHITE-BOX (jury) : on expose le code stratégie PROPRE sous
        # backtest.generated_code (clé lue par WhiteBox.tsx). Ajouté ICI, avant
        # la construction du payload ET la mise en cache Redis, donc embarqué
        # dans l'objet caché → les futurs HIT l'auront aussi. En FALLBACK le
        # code reste présent (il a bien été généré) ; en l'absence de code
        # (REJECTED/skip) backtest_result vaut None, le champ est simplement
        # absent et rien ne crashe.
        if generated_code:
            backtest_result["generated_code"] = generated_code

    metrics = _build_metrics(backtest_result, backtest_status)

    # chart_data (Maxime) : série temporelle pour le graphe de performance.
    # Exposée UNIQUEMENT en SUCCESS — en FALLBACK/ERROR on n'a pas de pf réel,
    # le front affiche un placeholder plutôt qu'une courbe trompeuse.
    chart_data: list[dict] | None = None
    if backtest_status == _BACKTEST_SUCCESS and isinstance(backtest_result, dict):
        raw_chart = backtest_result.get("chart_data")
        if isinstance(raw_chart, list):
            chart_data = raw_chart

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
    # On persiste le DERNIER retour sandbox réel (last_sandbox_result) plutôt
    # que l'enveloppe FALLBACK : l'audit doit garder la vraie cause d'échec
    # (status ERROR + error_type code_crash / security_violation / …), pas
    # le badge UI. Sur succès, last_sandbox_result == backtest_result.
    if executed_code is not None:
        _persist_sandbox_log(session, executed_code, last_sandbox_result or backtest_result)

    response_payload = {
        "id": str(strategy.id),
        "status": status,
        "intent": intent,
        "created_at": strategy.created_at.isoformat(),
        "final_spec": final_spec or None,
        "compliance_log": compliance_log,
        "metrics": metrics,
        "backtest": backtest_result,
        "backtest_params": backtest_params,
        "chart_data": chart_data,
        "spread": spread,
        "error": error_message,
        "pipeline": pipeline_result,
    }

    # Only cache genuinely successful runs: a FALLBACK/ERROR backtest is a
    # degraded result we must not replay for 48h. backtest_result is None on
    # rejected/skipped runs, so this also guards those out.
    if (
        cache_client is not None
        and backtest_result is not None
        and backtest_result.get("status") == "SUCCESS"
    ):
        try:
            cache_client.setex(
                _pipeline_cache_key(intent),
                172800,  # TTL 48h
                json.dumps(response_payload),
            )
        except (redis.RedisError, TypeError) as exc:
            logger.warning("Pipeline cache write failed: %s", exc)

    return response_payload
