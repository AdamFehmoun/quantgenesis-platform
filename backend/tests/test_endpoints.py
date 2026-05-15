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
    resp = client.get("/api/strategies/", params={"limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert body["limit"] == 5
    assert body["offset"] == 0
    assert body["count"] >= 1
    assert any(item["intent"] == "List probe strategy" for item in body["items"])


def test_strategies_get_missing_returns_404(client: TestClient) -> None:
    resp = client.get(f"/api/strategies/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_strategies_get_invalid_uuid_returns_422(client: TestClient) -> None:
    resp = client.get("/api/strategies/not-a-uuid")
    assert resp.status_code == 422


def test_strategies_post_missing_intent_returns_422(client: TestClient) -> None:
    resp = client.post("/api/strategies/", json={})
    assert resp.status_code == 422
