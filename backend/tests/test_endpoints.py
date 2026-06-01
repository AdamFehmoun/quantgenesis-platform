import time
import uuid

import pytest
from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ─────────────────────────────────────────────
# B-BRIDGE — pipeline endpoint
# ─────────────────────────────────────────────

def test_pipeline_run_returns_full_payload(
    client: TestClient,
    stub_agents_pipeline: dict,
) -> None:
    intent = "Buy BTC when RSI < 30"
    resp = client.post("/api/pipeline/run", json={"intent": intent})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["intent"] == intent
    assert body["status"] == "success"
    assert uuid.UUID(body["id"])  # valid UUID
    assert body["final_spec"]["strategy_name"] == "RSI Mean Reversion"
    assert body["compliance_log"]["ai_act_status"] == "compliant"
    assert body["error"] is None


def test_pipeline_run_rejects_missing_intent(client: TestClient) -> None:
    resp = client.post("/api/pipeline/run", json={})
    assert resp.status_code == 422


def test_pipeline_run_propagates_rejection(
    client: TestClient,
    monkeypatch,
) -> None:
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_agents_pipeline",
        lambda intent: {
            "status": "REJECTED",
            "result": {"final_spec": None, "compliance_log": None, "status": "REJECTED"},
            "error": "Faisabilité trop faible",
        },
    )
    resp = client.post("/api/pipeline/run", json={"intent": "garbage strategy"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "rejected"
    assert body["error"] == "Faisabilité trop faible"


# ─────────────────────────────────────────────
# B-03 / B-05 — OHLCV + Redis cache
# ─────────────────────────────────────────────

def test_ohlcv_returns_expected_shape(
    client: TestClient,
    fake_binance,
    fake_redis,
) -> None:
    resp = client.get(
        "/api/data/ohlcv",
        params={"symbol": "BTCUSDT", "interval": "1d", "limit": 5},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "BTCUSDT"
    assert body["count"] == 5
    assert len(body["candles"]) == 5
    candle = body["candles"][0]
    for field in ("timestamp", "open", "high", "low", "close", "volume"):
        assert field in candle
    # UTC ISO format with Z suffix
    assert candle["timestamp"].endswith("Z")


def test_ohlcv_cache_miss_then_hit(
    client: TestClient,
    fake_binance,
    fake_redis,
) -> None:
    params = {"symbol": "BTCUSDT", "interval": "1d", "limit": 3}

    r1 = client.get("/api/data/ohlcv", params=params)
    assert r1.status_code == 200
    assert fake_binance["calls"] == 1  # miss → 1 Binance call
    assert fake_redis.setex_calls == 1  # written to cache

    t0 = time.perf_counter()
    r2 = client.get("/api/data/ohlcv", params=params)
    elapsed_ms = (time.perf_counter() - t0) * 1_000

    assert r2.status_code == 200
    assert fake_binance["calls"] == 1  # still 1 → 2nd call served from cache
    assert r2.json() == r1.json()
    assert elapsed_ms < 50, f"cache hit too slow: {elapsed_ms:.2f}ms"


# ─────────────────────────────────────────────
# B-12 (J8) — yfinance dispatch for US equities
# ─────────────────────────────────────────────

_OHLCV_CANDLE_KEYS = {"timestamp", "open", "high", "low", "close", "volume"}


def test_ohlcv_yfinance_spy_auto_routed(
    client: TestClient,
    fake_yfinance,
) -> None:
    """SPY symbol auto-routes to yfinance and emits the Binance JSON shape."""
    resp = client.get("/api/data/ohlcv", params={"symbol": "SPY", "limit": 10})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["symbol"] == "SPY"
    assert body["source"] == "yfinance"
    assert body["count"] == 10
    assert len(body["candles"]) == 10
    candle = body["candles"][0]
    missing = _OHLCV_CANDLE_KEYS - set(candle.keys())
    assert not missing, f"candle missing required keys: {sorted(missing)}"
    assert candle["timestamp"].endswith("Z"), "timestamp must be UTC ISO8601 with Z suffix"
    assert isinstance(candle["open"], float)
    assert isinstance(candle["volume"], (int, float))
    assert fake_yfinance["calls"] == 1, "yfinance should be hit exactly once"


def test_ohlcv_btcusdt_still_routes_to_binance(
    client: TestClient,
    fake_binance,
    fake_redis,
) -> None:
    """Regression: crypto pairs (USDT suffix) still hit Binance, never yfinance."""
    resp = client.get("/api/data/ohlcv", params={"symbol": "BTCUSDT", "limit": 3})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "binance"
    assert fake_binance["calls"] == 1


def test_ohlcv_binance_error_502(
    client: TestClient,
    fake_redis,
    monkeypatch,
) -> None:
    from app.services import data_service

    def _bad_get(*args, **kwargs):
        class R:
            status_code = 503
            def json(self):
                return {}
        return R()

    monkeypatch.setattr(data_service.requests, "get", _bad_get)
    resp = client.get("/api/data/ohlcv", params={"limit": 2})
    assert resp.status_code == 502


# ─────────────────────────────────────────────
# B-10 — Strategies CRUD
# ─────────────────────────────────────────────

def test_strategies_create_and_get(client: TestClient) -> None:
    payload = {
        "intent": "Momentum BTC drawdown < 10%",
        "status": "pending",
        "result_json": {"strategy_name": "Momentum BTC", "params": {"lookback": 20}},
    }
    create = client.post("/api/strategies/", json=payload)
    assert create.status_code == 201, create.text
    created = create.json()
    assert uuid.UUID(created["id"])
    assert created["intent"] == payload["intent"]
    assert created["status"] == "pending"
    assert created["result_json"]["strategy_name"] == "Momentum BTC"

    fetched = client.get(f"/api/strategies/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created


def test_strategies_list_returns_recent(client: TestClient) -> None:
    client.post("/api/strategies/", json={"intent": "List probe strategy"})
    resp = client.get("/api/strategies/")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert any(item["intent"] == "List probe strategy" for item in body)


# ─────────────────────────────────────────────
# B-S2-02 — GET / list shape: id, intent, status, created_at, metrics
# ─────────────────────────────────────────────

_REQUIRED_LIST_KEYS = {"id", "intent", "status", "created_at", "metrics"}
_REQUIRED_METRICS_KEYS = {
    "sharpe_ratio",
    "max_drawdown_pct",
    "total_return_pct",
    "num_trades",
    "win_rate_pct",
}


def test_strategies_list_item_has_required_fields(client: TestClient) -> None:
    """Every listed strategy must expose the contract Maxime depends on."""
    metrics_blob = {
        "sharpe_ratio": 1.85,
        "max_drawdown_pct": -7.4,
        "total_return_pct": 31.2,
        "num_trades": 22,
        "win_rate_pct": 61.1,
    }
    client.post(
        "/api/strategies/",
        json={
            "intent": "B-S2-02 contract probe",
            "status": "success",
            "result_json": {"metrics": metrics_blob, "final_spec": {"strategy_name": "x"}},
        },
    )

    resp = client.get("/api/strategies/")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list) and body, "list must be non-empty after seed"

    probe = next(
        (item for item in body if item.get("intent") == "B-S2-02 contract probe"),
        None,
    )
    assert probe is not None, "seeded strategy missing from list response"

    # contract: all 5 top-level keys present on every list item
    missing = _REQUIRED_LIST_KEYS - set(probe.keys())
    assert not missing, f"list item missing keys: {sorted(missing)}"

    # metrics: full 5-key block, populated from result_json.metrics
    assert isinstance(probe["metrics"], dict)
    missing_metrics = _REQUIRED_METRICS_KEYS - set(probe["metrics"].keys())
    assert not missing_metrics, f"metrics missing keys: {sorted(missing_metrics)}"
    assert probe["metrics"]["sharpe_ratio"] == 1.85
    assert probe["metrics"]["num_trades"] == 22


def test_strategies_list_item_defaults_metrics_when_absent(client: TestClient) -> None:
    """Legacy rows without a metrics block must still expose zeroed metrics."""
    client.post(
        "/api/strategies/",
        json={"intent": "B-S2-02 no-metrics probe", "result_json": {"other": "data"}},
    )
    resp = client.get("/api/strategies/")
    assert resp.status_code == 200
    body = resp.json()
    probe = next(
        (item for item in body if item.get("intent") == "B-S2-02 no-metrics probe"),
        None,
    )
    assert probe is not None
    assert set(probe["metrics"].keys()) == _REQUIRED_METRICS_KEYS
    assert all(v in (0, 0.0) for v in probe["metrics"].values())


def test_strategies_delete_returns_204(client: TestClient) -> None:
    create = client.post("/api/strategies/", json={"intent": "To be deleted"})
    assert create.status_code == 201
    sid = create.json()["id"]

    delete = client.delete(f"/api/strategies/{sid}")
    assert delete.status_code == 204
    assert delete.content == b""

    # Subsequent fetch must 404
    assert client.get(f"/api/strategies/{sid}").status_code == 404


def test_strategies_delete_missing_returns_404(client: TestClient) -> None:
    resp = client.delete(f"/api/strategies/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_strategies_delete_invalid_uuid_returns_422(client: TestClient) -> None:
    resp = client.delete("/api/strategies/not-a-uuid")
    assert resp.status_code == 422


def test_strategies_get_missing_returns_404(client: TestClient) -> None:
    resp = client.get(f"/api/strategies/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_strategies_get_invalid_uuid_returns_422(client: TestClient) -> None:
    resp = client.get("/api/strategies/not-a-uuid")
    assert resp.status_code == 422


def test_strategies_post_missing_intent_returns_422(client: TestClient) -> None:
    resp = client.post("/api/strategies/", json={})
    assert resp.status_code == 422


# ─────────────────────────────────────────────
# B-S2-05 — GET /api/logs (observability for demo)
# ─────────────────────────────────────────────

_REQUIRED_LOG_KEYS = {
    "id",
    "client_ip",
    "method",
    "path",
    "status_code",
    "execution_time_seconds",
    "created_at",
}


def test_logs_returns_recent_requests_with_full_contract(client: TestClient) -> None:
    """GET /api/logs must surface the last requests with the 7 demo fields."""
    # Generate some traffic so the middleware persists rows. Middleware writes
    # in a starlette BackgroundTask after the response returns; TestClient drives
    # that task synchronously in-process.
    client.get("/health")
    client.get("/api/strategies/")

    resp = client.get("/api/logs?limit=10")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list)
    assert body, "logs list should be non-empty after seed traffic"
    assert len(body) <= 10, "limit must cap the result set"

    # Each row exposes the full contract
    sample = body[0]
    missing = _REQUIRED_LOG_KEYS - set(sample.keys())
    assert not missing, f"log row missing keys: {sorted(missing)}"
    assert isinstance(sample["execution_time_seconds"], (int, float))
    assert sample["execution_time_seconds"] >= 0
    assert sample["created_at"].count("T") == 1, "created_at must be ISO8601"

    # Order: created_at DESC — the head is the most recent timestamp
    timestamps = [row["created_at"] for row in body]
    assert timestamps == sorted(timestamps, reverse=True), "logs must be DESC by created_at"


def test_logs_respects_limit_query_param(client: TestClient) -> None:
    # Spam a few cheap GETs to ensure at least 3 rows in the table
    for _ in range(3):
        client.get("/health")
    resp = client.get("/api/logs?limit=2")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) <= 2


# ─────────────────────────────────────────────
# B-LOGS-SANDBOX (S3 / Task 3) — GET /api/logs/sandbox metrics envelope
# ─────────────────────────────────────────────

def test_logs_sandbox_returns_metrics_envelope(
    client: TestClient,
    stub_agents_pipeline,
    monkeypatch,
) -> None:
    """One pipeline run must surface a row at /api/logs/sandbox with the
    new `metrics{}` sub-object exposing the full backtest envelope.
    """
    from app.api import pipeline as pipeline_api

    # Stub the sandbox with a fully-populated result matching the new executor
    # contract (raw fractions under `drawdown`/`return`, num_trades int).
    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {
            "status": "SUCCESS",
            "sharpe_ratio": 1.42,
            "drawdown": -0.083,        # raw fraction → -8.3%
            "return": 0.237,            # raw fraction → +23.7%
            "num_trades": 17,
            "execution_time_ms": 1234,
            "memory_used_mb": 64.5,
        },
    )

    run = client.post("/api/pipeline/run", json={"intent": "RSI BTC for sandbox log test"})
    assert run.status_code == 200, run.text

    resp = client.get("/api/logs/sandbox?limit=5")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list) and body, "expected at least one sandbox log row"

    sample = body[0]

    # Top-level audit / execution fields
    for top_key in (
        "id",
        "status",
        "error_type",
        "execution_time_ms",
        "memory_used_mb",
        "code_hash",
        "metrics",
        "created_at",
    ):
        assert top_key in sample, f"missing top-level key: {top_key}"

    # Metrics sub-object (B-LOGS-SANDBOX S3 / Task 3)
    metrics = sample["metrics"]
    assert isinstance(metrics, dict)
    for metric_key in ("sharpe_ratio", "max_drawdown_pct", "total_return_pct", "trades_count"):
        assert metric_key in metrics, f"metrics missing key: {metric_key}"

    assert metrics["sharpe_ratio"] == pytest.approx(1.42, abs=0.01)
    # Raw fraction → pct conversion is the contract bridge
    assert metrics["max_drawdown_pct"] == pytest.approx(-8.3, abs=0.05)
    assert metrics["total_return_pct"] == pytest.approx(23.7, abs=0.05)
    assert metrics["trades_count"] == 17


def test_logs_sandbox_metrics_nullable_on_error_run(
    client: TestClient,
    stub_agents_pipeline,
    monkeypatch,
) -> None:
    """An ERROR sandbox run must still produce a log row, with null metrics
    rather than spurious zeros (so the frontend can render 'n/a')."""
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {
            "status": "ERROR",
            "error": "code_crash",
            "execution_time_ms": 42,
        },
    )

    client.post("/api/pipeline/run", json={"intent": "Broken strategy AAPL"})

    resp = client.get("/api/logs/sandbox?limit=5")
    assert resp.status_code == 200
    body = resp.json()
    assert body, "expected at least one sandbox log row even on ERROR"

    # Find a row tagged as ERROR (most recent matching)
    error_rows = [r for r in body if r["status"] == "ERROR"]
    assert error_rows, "expected an ERROR row from the broken run"
    err = error_rows[0]
    assert err["error_type"] == "code_crash"
    assert err["metrics"]["sharpe_ratio"] is None
    assert err["metrics"]["max_drawdown_pct"] is None
    assert err["metrics"]["total_return_pct"] is None
    assert err["metrics"]["trades_count"] is None


# ─────────────────────────────────────────────
# B-DEMO — 3 sequential pipeline runs (stability for the Lilian demo)
# ─────────────────────────────────────────────

def test_pipeline_run_three_consecutive_runs_stay_stable(
    client: TestClient,
    stub_agents_pipeline,
    monkeypatch,
) -> None:
    """Three sequential POSTs must each succeed and persist a strategy row.

    Acceptance: backend doesn't crash, no connection leak, no thread leak, every
    response carries a populated final_spec + metrics envelope (Railway-grade
    stability for the Lilian demo).
    """
    import threading
    import time

    from app.api import pipeline as pipeline_api
    from app.core.db import engine

    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {
            "status": "SUCCESS",
            "sharpe_ratio": 1.10,
            "max_drawdown_pct": -5.0,
            "total_return_pct": 12.5,
            "num_trades": 9,
            "win_rate_pct": 55.5,
        },
    )

    intents = [
        "RSI Bitcoin breakout",
        "Mean reversion ETH 1h",
        "Momentum SPY drawdown 8%",
    ]

    # Baselines BEFORE the burst — anything still elevated afterwards is a leak.
    pool_before = engine.pool.checkedout()
    threads_before = threading.active_count()

    ids: list[str] = []
    latencies_ms: list[float] = []

    for intent in intents:
        t0 = time.perf_counter()
        resp = client.post("/api/pipeline/run", json={"intent": intent})
        latencies_ms.append((time.perf_counter() - t0) * 1_000)

        assert resp.status_code == 200, f"intent={intent!r} -> {resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["status"] == "success"
        assert body["intent"] == intent
        assert isinstance(body.get("final_spec"), dict) and body["final_spec"], (
            f"intent={intent!r} returned empty final_spec"
        )
        assert body["metrics"]["sharpe_ratio"] == 1.10
        # B-S2-01 contract must hold under burst load too
        assert "backtest_params" in body and "spread" in body["backtest_params"]
        ids.append(body["id"])

    # Every run produced a distinct persisted strategy id
    assert len(set(ids)) == 3, f"expected 3 unique strategy ids, got {ids}"

    # B-DEMO: every run must complete fast on the demo path (stubbed sandbox).
    # The 5 s ceiling is generous — any single run blowing past it means
    # something is blocking on shared state (lock, connection wait, GC stall).
    assert max(latencies_ms) < 5_000, f"latency spike detected: {latencies_ms}"

    # ── DB pool: no checked-out connection should survive the burst ──
    pool_after = engine.pool.checkedout()
    assert pool_after <= pool_before, (
        f"connection leak: pool.checkedout went from {pool_before} → {pool_after}"
    )

    # ── Threads: the request-logging BackgroundTask must not leak workers ──
    # Allow a small drift (±2) for the test runner's own bookkeeping threads.
    threads_after = threading.active_count()
    assert threads_after <= threads_before + 2, (
        f"thread leak: active_count went from {threads_before} → {threads_after}"
    )

    # Strategies table is reachable right after the burst — proves no leaked
    # session / dangling transaction from the loop.
    listed = client.get("/api/strategies/")
    assert listed.status_code == 200
    listed_ids = {item["id"] for item in listed.json()}
    assert set(ids).issubset(listed_ids), "all three runs must be persisted"

    # ── Observability: /api/logs surfaces the three POSTs we just issued ──
    # (B-S2-05 sanity check piggy-backed on the burst, since the middleware
    # writes via a Starlette BackgroundTask which TestClient flushes inline.)
    logs_resp = client.get("/api/logs?limit=50")
    assert logs_resp.status_code == 200
    log_paths = [row["path"] for row in logs_resp.json()]
    assert log_paths.count("/api/pipeline/run") >= 3, (
        f"expected ≥3 /api/pipeline/run rows in logs, got paths={log_paths}"
    )
