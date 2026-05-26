from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.data_service import get_ohlcv, get_ohlcv_yfinance

router = APIRouter(prefix="/api/data", tags=["data"])

_CRYPTO_QUOTE_SUFFIXES = ("USDT", "USDC", "BUSD", "FDUSD", "TUSD")


def _detect_source(symbol: str) -> Literal["binance", "yfinance"]:
    """B-12 (J8): auto-route by symbol shape.

    Crypto pairs on Binance carry a fiat-stable quote suffix (BTCUSDT, ETHUSDC...).
    Anything else (SPY, AAPL, TSLA) is treated as a US equity and goes to yfinance.
    Callers can still pin a source explicitly via the `source` query param.
    """
    s = (symbol or "").upper()
    for suffix in _CRYPTO_QUOTE_SUFFIXES:
        if s.endswith(suffix) and len(s) > len(suffix):
            return "binance"
    return "yfinance"


@router.get("/ohlcv")
def ohlcv(
    symbol: str = Query("BTCUSDT"),
    interval: str = Query("1d"),
    limit: int = Query(10, ge=1, le=1000),
    source: Optional[Literal["binance", "yfinance"]] = Query(None),
) -> dict[str, Any]:
    resolved = source or _detect_source(symbol)

    if resolved == "yfinance":
        result = get_ohlcv_yfinance(symbol, limit)
    else:
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
        "source": resolved,
    }
