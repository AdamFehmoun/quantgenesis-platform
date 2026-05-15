import json
import logging
import os
from typing import Any, Union

import pandas as pd
import redis
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CACHE_TTL_SECONDS = 3600

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis | None:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
            _redis_client.ping()
        except redis.RedisError as exc:
            logger.warning("Redis unavailable (%s): caching disabled", exc)
            _redis_client = None
    return _redis_client


def _cache_key(symbol: str, interval: str, limit: int) -> str:
    return f"ohlcv:{symbol}:{interval}:{limit}"


def get_ohlcv(symbol: str, interval: str, limit: int = 365) -> Union[pd.DataFrame, str]:
    """
    Récupère les données OHLCV depuis Binance avec cache Redis.
    B-03 : DataFrame open/high/low/close/volume/timestamp UTC.
    B-05 : Cache Redis SETEX (TTL 1h), 2e appel < 50ms.
    """
    key = _cache_key(symbol, interval, limit)
    client = _get_redis()

    if client is not None:
        try:
            cached = client.get(key)
            if cached:
                records = json.loads(cached)
                df = pd.DataFrame(records)
                df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
                return df
        except (redis.RedisError, ValueError) as exc:
            logger.warning("Cache read failed for %s: %s", key, exc)

    url = "https://api.binance.com/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    response = requests.get(url, params=params, timeout=10)

    if response.status_code != 200:
        return f"Erreur API: {response.status_code}"

    raw = response.json()
    df = pd.DataFrame(
        raw,
        columns=[
            "timestamp", "open", "high", "low", "close", "volume",
            "close_time", "quote_asset_volume", "number_of_trades",
            "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume", "ignore",
        ],
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True).dt.as_unit("ns")
    df = df[["timestamp", "open", "high", "low", "close", "volume"]]
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col])

    if client is not None:
        try:
            payload = df.copy()
            payload["timestamp"] = payload["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            client.setex(key, CACHE_TTL_SECONDS, json.dumps(payload.to_dict(orient="records")))
        except redis.RedisError as exc:
            logger.warning("Cache write failed for %s: %s", key, exc)

    return df


def get_ohlcv_yfinance(symbol: str, limit: int = 10) -> Union[dict[str, Any], str]:
    """B-12: fetch US-equity OHLCV via yfinance, formatted to the canonical
    {symbol, timeframe, data} contract. Returns an error string on failure."""
    try:
        hist = yf.Ticker(symbol).history(period="1mo", interval="1d", auto_adjust=False)
    except Exception as exc:  # yfinance raises various network/parse errors
        return f"yfinance error: {exc}"

    if hist is None or hist.empty:
        return f"No data returned for symbol {symbol!r}"

    hist = hist.tail(limit)

    records: list[dict[str, Any]] = []
    for ts, row in hist.iterrows():
        ts_utc = ts.tz_convert("UTC") if ts.tzinfo is not None else ts.tz_localize("UTC")
        records.append({
            "timestamp": ts_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
        })

    return {"symbol": symbol, "timeframe": "1d", "data": records}


if __name__ == "__main__":
    print(get_ohlcv("BTCUSDT", "1d", 5))
