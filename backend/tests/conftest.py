import json
from typing import Any

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import limiter
from app.main import app
from app.services import data_service


@pytest.fixture(autouse=True)
def _disable_rate_limit() -> None:
    """slowapi shares a single in-memory bucket per (key, route) across the
    whole pytest session, which causes spurious 429s once multiple tests hit
    the same rate-limited endpoint. Disable for tests; rate-limit behaviour is
    covered by a dedicated curl-based check, not pytest."""
    previous = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = previous


_BINANCE_FIXTURE_ROWS = [
    [
        1_700_000_000_000 + i * 86_400_000,  # open time ms (UTC)
        f"{50_000 + i}",  # open
        f"{50_500 + i}",  # high
        f"{49_500 + i}",  # low
        f"{50_250 + i}",  # close
        f"{100 + i}",  # volume
        1_700_000_000_000 + (i + 1) * 86_400_000 - 1,  # close time
        "0", 0, "0", "0", "0",
    ]
    for i in range(5)
]


class _FakeResponse:
    def __init__(self, status_code: int, payload: Any) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> Any:
        return self._payload


class _FakeRedis:
    """Minimal Redis stand-in supporting get/setex/ping for cache tests."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.get_calls = 0
        self.setex_calls = 0

    def ping(self) -> bool:
        return True

    def get(self, key: str) -> str | None:
        self.get_calls += 1
        return self.store.get(key)

    def setex(self, key: str, ttl: int, value: str) -> bool:
        self.setex_calls += 1
        self.store[key] = value
        return True


@pytest.fixture(autouse=True)
def _reset_redis_singleton() -> None:
    """Ensure each test starts with a fresh redis client singleton."""
    data_service._redis_client = None
    yield
    data_service._redis_client = None


@pytest.fixture(autouse=True)
def _stub_sandbox_backtest_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Never let pytest touch the real E2B sandbox.

    The default stub returns an ERROR envelope so tests that don't care about
    metrics still observe pipeline.py's zero-metric fallback. Tests that need
    a SUCCESS backtest (e.g. test_e2e_pipeline.py) install their own override
    via the `stub_sandbox_backtest` fixture, which monkeypatch happily replaces.
    """
    from app.api import pipeline as pipeline_api

    monkeypatch.setattr(
        pipeline_api,
        "_run_sandbox_backtest",
        lambda code, spread=0.0001: {"status": "ERROR", "stderr": "sandbox stubbed in tests"},
    )


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> _FakeRedis:
    fake = _FakeRedis()
    monkeypatch.setattr(data_service, "_get_redis", lambda: fake)
    return fake


@pytest.fixture
def fake_binance(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    counter = {"calls": 0}

    def _fake_get(url: str, params: dict | None = None, timeout: int | None = None):
        counter["calls"] += 1
        limit = int((params or {}).get("limit", 5))
        return _FakeResponse(200, _BINANCE_FIXTURE_ROWS[:limit])

    monkeypatch.setattr(data_service.requests, "get", _fake_get)
    return counter


@pytest.fixture
def stub_agents_pipeline(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Replace the agents bridge so /api/pipeline/run never hits LLMs."""
    from app.api import pipeline as pipeline_api

    canned_result = {
        "status": "SUCCESS",
        "pipeline_start": "2026-05-14T08:00:00+00:00",
        "pipeline_end": "2026-05-14T08:00:05+00:00",
        "user_intent": "stub",
        "final_spec": {
            "strategy_name": "RSI Mean Reversion",
            "claude_code_instructions": "Implement RSI(14) entries.",
        },
        "compliance_log": {"ai_act_status": "compliant", "checks": ["bias", "transparency"]},
        "claude_code_instructions": "Implement RSI(14) entries.",
        "critique_result": "APPROVED",
        "warnings": [],
        "trace": {},
    }
    canned_envelope = {"status": "SUCCESS", "result": canned_result, "error": None}

    monkeypatch.setattr(
        pipeline_api,
        "_run_agents_pipeline",
        lambda intent: json.loads(json.dumps(canned_envelope)),
    )
    return canned_envelope


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c
