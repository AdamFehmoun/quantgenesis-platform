from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_pipeline_run(client: TestClient) -> None:
    intent = "Buy BTC when RSI < 30"
    resp = client.post("/api/pipeline/run", json={"intent": intent})
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == intent
    assert "id" in body and body["id"]
    assert body["status"] == "received"


def test_ohlcv(client: TestClient) -> None:
    resp = client.get("/api/data/ohlcv", params={"symbol": "BTCUSDT", "interval": "1d", "limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "BTCUSDT"
    assert body["count"] == 5
    assert isinstance(body["candles"], list) and len(body["candles"]) == 5
    candle = body["candles"][0]
    for field in ("timestamp", "open", "high", "low", "close", "volume"):
        assert field in candle
