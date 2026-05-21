import time
import uuid

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
