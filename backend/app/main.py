from typing import Any

from fastapi import Body, FastAPI, HTTPException, Query

from app.services.data_service import get_ohlcv

app = FastAPI(title="QuantGenesis Backend")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/pipeline/run")
async def run_pipeline(payload: dict[str, Any] = Body(...)) -> dict[str, str]:
    intent = payload.get("intent", "No intent provided")
    return {"status": "received", "intent": intent}


@app.get("/api/data/ohlcv")
def ohlcv(
    symbol: str = Query("BTCUSDT"),
    interval: str = Query("1d"),
    limit: int = Query(10, ge=1, le=1000),
) -> dict[str, Any]:
    result = get_ohlcv(symbol, interval, limit)
    if isinstance(result, str):
        raise HTTPException(status_code=502, detail=result)

    df = result.copy()
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "symbol": symbol,
        "interval": interval,
        "count": len(df),
        "candles": df.to_dict(orient="records"),
    }
