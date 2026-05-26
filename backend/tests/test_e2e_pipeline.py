"""End-to-end integration tests for POST /api/pipeline/run.

Uses the FastAPI TestClient to exercise the full stack in-process:
middlewares (CORS, rate limit, request logging), routing, payload validation,
DB session, agents-bridge call, and metrics shaping. The agents pipeline and
sandbox executor are stubbed to keep the test hermetic (no LLM tokens, no
network, no E2B credits).
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

_REQUIRED_METRIC_KEYS = {
    "sharpe_ratio",
    "max_drawdown_pct",
    "total_return_pct",
    "num_trades",
    "win_rate_pct",
}


@pytest.fixture
def stub_sandbox_backtest(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Replace the sandbox executor so /run never touches E2B."""
    from app.api import pipeline as pipeline_api

    canned_result = {
        "status": "SUCCESS",
        "sharpe_ratio": 1.42,
        "max_drawdown_pct": -8.3,
        "total_return_pct": 23.7,
        "num_trades": 17,
        "win_rate_pct": 58.8,
    }
    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: dict(canned_result),
    )
    return canned_result


def test_pipeline_run_happy_path(
    client: TestClient,
    stub_agents_pipeline: dict,
    stub_sandbox_backtest: dict,
) -> None:
    """Valid intent → 200 OK, success status, full metrics envelope."""
    resp = client.post("/api/pipeline/run", json={"intent": "RSI Bitcoin"})

    assert resp.status_code == 200, resp.text
    body = resp.json()

    # status — the API maps upstream "SUCCESS" to lowercase "success"
    assert "status" in body, "response must expose a 'status' field"
    assert body["status"].upper() == "SUCCESS", (
        f"expected status to indicate SUCCESS, got {body['status']!r}"
    )

    # metrics — required by the frontend contract
    assert "metrics" in body, "response must expose a 'metrics' object"
    metrics = body["metrics"]
    assert isinstance(metrics, dict), f"metrics must be a dict, got {type(metrics).__name__}"
    missing = _REQUIRED_METRIC_KEYS - set(metrics.keys())
    assert not missing, f"metrics missing required keys: {sorted(missing)}"

    # all metric values must be numeric
    for key in _REQUIRED_METRIC_KEYS:
        assert isinstance(metrics[key], (int, float)), (
            f"metrics[{key!r}] must be numeric, got {type(metrics[key]).__name__}"
        )

    # sanity-check: backtest metrics propagated from the (stubbed) sandbox
    assert metrics["sharpe_ratio"] == pytest.approx(1.42, abs=0.01)
    assert metrics["num_trades"] == 17

    # downstream contract sanity
    assert body["intent"] == "RSI Bitcoin"
    assert body["error"] is None


def test_pipeline_run_empty_intent_returns_422(client: TestClient) -> None:
    """Empty intent string → 422 Unprocessable Entity, no crash."""
    resp = client.post("/api/pipeline/run", json={"intent": ""})
    assert resp.status_code == 422, resp.text
    body = resp.json()
    assert "detail" in body
    assert "intent" in body["detail"].lower()


def test_pipeline_run_missing_intent_returns_422(client: TestClient) -> None:
    """Body without 'intent' key → 422, no crash."""
    resp = client.post("/api/pipeline/run", json={})
    assert resp.status_code == 422, resp.text


def test_pipeline_run_non_string_intent_returns_422(client: TestClient) -> None:
    """Non-string intent (int) → 422, no crash."""
    resp = client.post("/api/pipeline/run", json={"intent": 42})
    assert resp.status_code == 422, resp.text


def test_pipeline_run_spread_crypto(
    client: TestClient,
    stub_agents_pipeline: dict,
    stub_sandbox_backtest: dict,
) -> None:
    """Crypto-flavoured intent → spread = 0.0005, surfaced in backtest_params."""
    resp = client.post("/api/pipeline/run", json={"intent": "RSI on BTC and ETH"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["backtest_params"] == {"spread": 0.0005}
    assert body["spread"] == 0.0005


def test_pipeline_run_spread_us_equity(
    client: TestClient,
    stub_agents_pipeline: dict,
    stub_sandbox_backtest: dict,
) -> None:
    """US equity intent → spread = 0.0001 (default equity cost)."""
    resp = client.post("/api/pipeline/run", json={"intent": "Momentum on AAPL and SPY"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["backtest_params"] == {"spread": 0.0001}
    assert body["spread"] == 0.0001


def test_pipeline_run_passes_spread_to_executor(
    client: TestClient,
    stub_agents_pipeline: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The resolved spread must be forwarded to the sandbox executor call."""
    from app.api import pipeline as pipeline_api

    captured: dict[str, Any] = {}

    def _spy(code: str, spread: float = 0.0001) -> dict[str, Any]:
        captured["code"] = code
        captured["spread"] = spread
        return {"status": "SUCCESS"}

    monkeypatch.setattr(pipeline_api, "_run_sandbox_backtest", _spy)

    resp = client.post("/api/pipeline/run", json={"intent": "Bitcoin breakout"})
    assert resp.status_code == 200, resp.text
    assert captured["spread"] == 0.0005


def test_pipeline_run_agents_error_returns_500(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Upstream agents ERROR is surfaced as a 500 with the original message."""
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_agents_pipeline",
        lambda intent: {"status": "ERROR", "result": {}, "error": "LLM unavailable"},
    )
    resp = client.post("/api/pipeline/run", json={"intent": "RSI Bitcoin"})
    assert resp.status_code == 500, resp.text
    assert resp.json()["detail"] == "LLM unavailable"
