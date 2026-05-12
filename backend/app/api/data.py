from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services.data_service import get_ohlcv

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/ohlcv")
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
