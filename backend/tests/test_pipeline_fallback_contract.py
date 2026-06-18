"""B-S3 / Task 4 — Contrat JSON de fallback du pipeline.

Tests E2E hermétiques (sandbox + agents stubbés) qui verrouillent le contrat
backend ↔ frontend défini avec Maxime :

  * `body.backtest.status` ∈ {SUCCESS, FALLBACK, ERROR}
  * `body.metrics` expose toujours les 5 clés canoniques
      (sharpe_ratio, max_drawdown_pct, total_return_pct, trades_count, win_rate_pct)
  * Sur SUCCESS, les métriques sont numériques
  * Sur FALLBACK / ERROR, les métriques sont toutes `None`
    (jamais 0.0 trompeur — le frontend doit pouvoir afficher "n/a")

Couvre aussi la robustesse de l'endpoint /api/pipeline/run :
  * 422 quand `intent` est manquant / vide / mauvais type
  * 500 catché quand la pipeline d'agents crash en interne
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

_REQUIRED_METRIC_KEYS = {
    "sharpe_ratio",
    "max_drawdown_pct",
    "total_return_pct",
    "trades_count",
    "win_rate_pct",
}

_VALID_BACKTEST_STATUSES = {"SUCCESS", "FALLBACK", "ERROR"}


def _assert_metrics_shape(metrics: Any) -> None:
    """Le contrat de clés est constant, indépendamment du status."""
    assert isinstance(metrics, dict), f"metrics doit être un dict, reçu {type(metrics).__name__}"
    missing = _REQUIRED_METRIC_KEYS - set(metrics.keys())
    assert not missing, f"metrics manquent les clés : {sorted(missing)}"


# ─────────────────────────────────────────────
# Task 4 — Chemin SUCCESS
# ─────────────────────────────────────────────


def test_pipeline_run_success_contract(
    client: TestClient,
    stub_agents_pipeline: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Run SUCCESS : backtest.status=SUCCESS, métriques numériques cohérentes."""
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {
            "status": "SUCCESS",
            "sharpe_ratio": 1.42,
            "max_drawdown_pct": -8.3,
            "total_return_pct": 23.7,
            # On envoie volontairement avec l'ancien nom pour vérifier que la
            # rétro-compat du normalizer côté ENTRÉE tient (sandbox executor
            # peut encore émettre num_trades).
            "num_trades": 17,
            "win_rate_pct": 58.8,
            "execution_time_ms": 1234,
            "memory_used_mb": 64.5,
        },
    )

    resp = client.post("/api/pipeline/run", json={"intent": "RSI Bitcoin success path"})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Statut pipeline (top-level)
    assert body["status"] == "success"
    assert body["intent"] == "RSI Bitcoin success path"

    # Contrat backtest.status
    assert "backtest" in body and isinstance(body["backtest"], dict)
    assert body["backtest"]["status"] == "SUCCESS"
    assert body["backtest"]["status"] in _VALID_BACKTEST_STATUSES

    # Contrat metrics : 5 clés, valeurs numériques
    _assert_metrics_shape(body["metrics"])
    metrics = body["metrics"]
    assert metrics["sharpe_ratio"] == pytest.approx(1.42, abs=0.01)
    assert metrics["max_drawdown_pct"] == pytest.approx(-8.3, abs=0.05)
    assert metrics["total_return_pct"] == pytest.approx(23.7, abs=0.05)
    assert metrics["trades_count"] == 17
    assert metrics["win_rate_pct"] == pytest.approx(58.8, abs=0.05)
    for key in _REQUIRED_METRIC_KEYS:
        assert isinstance(metrics[key], (int, float)), (
            f"metrics[{key!r}] doit être numérique sur SUCCESS, reçu {metrics[key]!r}"
        )


def test_pipeline_run_success_normalizes_raw_fractions(
    client: TestClient,
    stub_agents_pipeline: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La sandbox peut émettre `drawdown`/`return` en fractions brutes.

    Le normalizer doit les convertir en pourcentage et alimenter les clés
    canoniques `max_drawdown_pct`/`total_return_pct`/`trades_count`.
    """
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {
            "status": "SUCCESS",
            "sharpe_ratio": 1.10,
            "drawdown": -0.05,      # raw fraction → -5.0%
            "return": 0.125,        # raw fraction → +12.5%
            "num_trades": 9,
        },
    )

    resp = client.post("/api/pipeline/run", json={"intent": "Momentum SPY raw fractions"})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    metrics = body["metrics"]
    assert metrics["max_drawdown_pct"] == pytest.approx(-5.0, abs=0.01)
    assert metrics["total_return_pct"] == pytest.approx(12.5, abs=0.01)
    assert metrics["trades_count"] == 9


# ─────────────────────────────────────────────
# Task 4 — Chemin FALLBACK
# ─────────────────────────────────────────────


def test_pipeline_run_fallback_contract(
    client: TestClient,
    stub_agents_pipeline: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Run FALLBACK : 3 tentatives sandbox échouent → backtest.status=FALLBACK
    et toutes les métriques null (jamais des zéros trompeurs)."""
    from app.api import pipeline as pipeline_api

    # La sandbox renvoie systématiquement une erreur de syntaxe → retries épuisés.
    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {
            "status": "ERROR",
            "error": "code_crash",
            "execution_time_ms": 42,
        },
    )

    resp = client.post("/api/pipeline/run", json={"intent": "Strat qui casse en sandbox"})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Pipeline-level status reste success (les agents ont terminé proprement),
    # mais l'exécution du backtest est tombée en FALLBACK.
    assert body["status"] == "success"

    # Contrat backtest.status
    assert isinstance(body["backtest"], dict)
    assert body["backtest"]["status"] == "FALLBACK"
    assert body["backtest"].get("fallback_required") is True

    # Contrat metrics : 5 clés présentes, toutes None (pas de zéros)
    _assert_metrics_shape(body["metrics"])
    for key in _REQUIRED_METRIC_KEYS:
        assert body["metrics"][key] is None, (
            f"metrics[{key!r}] doit être None en FALLBACK, reçu {body['metrics'][key]!r}"
        )


def test_pipeline_run_fallback_no_security_violation_retries(
    client: TestClient,
    stub_agents_pipeline: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Une security_violation court-circuite la boucle de retries → FALLBACK direct.

    Régression-guard : Mathis avait demandé qu'on ne retry jamais une violation
    de sécurité ; on vérifie ici que le statut canonique reste FALLBACK et que
    les métriques sont bien null.
    """
    from app.api import pipeline as pipeline_api

    call_count = {"n": 0}

    def _fake_sandbox(code: str, spread: float = 0.0001) -> dict[str, Any]:
        call_count["n"] += 1
        return {
            "status": "ERROR",
            "error": "security_violation",
            "execution_time_ms": 1,
        }

    monkeypatch.setattr(pipeline_api, "_run_sandbox_backtest", _fake_sandbox)

    resp = client.post("/api/pipeline/run", json={"intent": "Strat dangereuse os.system"})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert call_count["n"] == 1, (
        f"security_violation doit court-circuiter les retries, "
        f"appels observés : {call_count['n']}"
    )
    assert body["backtest"]["status"] == "FALLBACK"
    assert all(body["metrics"][k] is None for k in _REQUIRED_METRIC_KEYS)


# ─────────────────────────────────────────────
# Task 3 — Robustesse HTTP de /api/pipeline/run
# ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"intent": ""},
        {"intent": None},
        {"intent": 42},
        {"intent": ["RSI", "BTC"]},
    ],
)
def test_pipeline_run_returns_422_on_bad_intent(
    client: TestClient,
    payload: dict[str, Any],
) -> None:
    """Tout intent manquant / vide / mauvais type est rejeté en 422, jamais 500."""
    resp = client.post("/api/pipeline/run", json=payload)
    assert resp.status_code == 422, (
        f"payload={payload!r} doit renvoyer 422, reçu {resp.status_code}: {resp.text[:200]}"
    )
    assert "intent" in resp.json()["detail"].lower()


def test_pipeline_run_catches_agents_pipeline_crash(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Une exception non gérée côté agents → 500 propre, pas un 500 FastAPI brut."""
    from app.api import pipeline as pipeline_api

    def _boom(intent: str) -> dict[str, Any]:
        raise RuntimeError("LLM provider down")

    monkeypatch.setattr(pipeline_api, "_run_agents_pipeline", _boom)

    resp = client.post("/api/pipeline/run", json={"intent": "RSI Bitcoin"})
    assert resp.status_code == 500, resp.text
    detail = resp.json()["detail"]
    assert "Agents pipeline crashed" in detail
    assert "LLM provider down" in detail


def test_pipeline_run_agents_error_status_maps_to_500(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`status=ERROR` côté agents (sans exception) → 500 avec le message original."""
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_agents_pipeline",
        lambda intent: {"status": "ERROR", "result": {}, "error": "Anthropic timeout"},
    )

    resp = client.post("/api/pipeline/run", json={"intent": "RSI Bitcoin"})
    assert resp.status_code == 500, resp.text
    assert resp.json()["detail"] == "Anthropic timeout"
