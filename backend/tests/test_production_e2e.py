"""B-E2E-PROD — End-to-end smoke test against the live Railway deployment.

This module is intentionally NOT collected by the default pytest run: it issues
real HTTPS calls to the production API, consumes LLM tokens and E2B sandbox
minutes, and a single full execution takes 5+ minutes because three consecutive
POST /api/pipeline/run calls each take ~2 minutes on Railway.

Run it explicitly when validating a deploy:

    cd backend
    PROD_E2E=1 .venv/bin/python -m pytest tests/test_production_e2e.py -s -v

Or via the CLI entrypoint:

    PROD_E2E=1 .venv/bin/python tests/test_production_e2e.py

The script asserts:
  * GET /health             → 200, {"status": "ok"}
  * GET /api/strategies/    → 200, list payload
  * GET /api/logs           → 200, list payload
  * 3× POST /api/pipeline/run with intent "RSI Bitcoin"
        → 200, full spec returned each time, latencies recorded

Each POST runs end-to-end through the agents pipeline + E2B sandbox, so the
client uses a 180s timeout to absorb the ~2-minute backend turnaround.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

import httpx
import pytest

PROD_BASE_URL = "https://quantgenesis-platform-production.up.railway.app"
PIPELINE_TIMEOUT_SECONDS = 180.0
READ_ONLY_TIMEOUT_SECONDS = 30.0
PIPELINE_INTENT = "RSI Bitcoin"
PIPELINE_CALL_COUNT = 3

# Pytest collection gate — opt-in only, to keep CI cheap and deterministic.
_RUN_PROD = os.environ.get("PROD_E2E") == "1"
pytestmark = pytest.mark.skipif(
    not _RUN_PROD,
    reason="Set PROD_E2E=1 to run production E2E tests (real network, LLM tokens, E2B minutes).",
)


def _print(msg: str) -> None:
    print(msg, flush=True)


@pytest.fixture(scope="module")
def prod_client() -> httpx.Client:
    """One HTTP client shared across all production assertions, large timeout."""
    with httpx.Client(
        base_url=PROD_BASE_URL,
        timeout=httpx.Timeout(PIPELINE_TIMEOUT_SECONDS, connect=10.0),
        follow_redirects=True,
        headers={"User-Agent": "qg-prod-e2e/1.0"},
    ) as client:
        yield client


def test_health_endpoint(prod_client: httpx.Client) -> None:
    """GET /health must return 200 and the canonical {'status': 'ok'} payload."""
    resp = prod_client.get("/health", timeout=READ_ONLY_TIMEOUT_SECONDS)
    assert resp.status_code == 200, f"unexpected status {resp.status_code}: {resp.text[:200]}"
    body = resp.json()
    assert body == {"status": "ok"}, f"unexpected health payload: {body!r}"
    _print(f"[OK] /health -> 200 {body}")


def test_list_strategies(prod_client: httpx.Client) -> None:
    """GET /api/strategies/ must return a JSON list (possibly empty)."""
    resp = prod_client.get("/api/strategies/", timeout=READ_ONLY_TIMEOUT_SECONDS)
    assert resp.status_code == 200, f"unexpected status {resp.status_code}: {resp.text[:200]}"
    body = resp.json()
    assert isinstance(body, list), f"strategies endpoint must return a list, got {type(body).__name__}"
    _print(f"[OK] /api/strategies/ -> 200, {len(body)} strategies")


def test_list_logs(prod_client: httpx.Client) -> None:
    """GET /api/logs must return a JSON list of request log rows."""
    resp = prod_client.get("/api/logs", timeout=READ_ONLY_TIMEOUT_SECONDS)
    assert resp.status_code == 200, f"unexpected status {resp.status_code}: {resp.text[:200]}"
    body = resp.json()
    assert isinstance(body, list), f"logs endpoint must return a list, got {type(body).__name__}"
    _print(f"[OK] /api/logs -> 200, {len(body)} log rows")


def _assert_full_spec(body: dict[str, Any], call_idx: int) -> None:
    """Validate that the POST /api/pipeline/run response carries a complete spec.

    The frontend contract requires: id, status, intent, created_at, metrics with
    the 5 canonical keys. final_spec is allowed to be None on REJECTED runs but
    the run we trigger ("RSI Bitcoin") is expected to succeed.
    """
    required_top_level = {"id", "status", "intent", "created_at", "metrics", "backtest_params"}
    missing = required_top_level - set(body.keys())
    assert not missing, f"call #{call_idx}: response missing top-level keys: {sorted(missing)}"

    assert body["intent"] == PIPELINE_INTENT, (
        f"call #{call_idx}: intent echo mismatch: {body['intent']!r}"
    )
    assert body["status"] in {"success", "rejected"}, (
        f"call #{call_idx}: unexpected status {body['status']!r}"
    )

    metrics = body["metrics"]
    assert isinstance(metrics, dict), (
        f"call #{call_idx}: metrics must be a dict, got {type(metrics).__name__}"
    )
    required_metrics = {
        "sharpe_ratio",
        "max_drawdown_pct",
        "total_return_pct",
        "num_trades",
        "win_rate_pct",
    }
    missing_metrics = required_metrics - set(metrics.keys())
    assert not missing_metrics, (
        f"call #{call_idx}: metrics missing keys: {sorted(missing_metrics)}"
    )
    for key in required_metrics:
        assert isinstance(metrics[key], (int, float)), (
            f"call #{call_idx}: metrics[{key!r}] must be numeric, got {type(metrics[key]).__name__}"
        )


def test_pipeline_run_three_consecutive_calls(prod_client: httpx.Client) -> None:
    """Fire 3 consecutive POST /api/pipeline/run calls, all must return a full spec.

    This is the headline acceptance criterion for B-E2E-PROD: the production
    pipeline can sustain three back-to-back end-to-end runs without falling over
    (rate limiter is 5/hour so 3 fits comfortably under the cap).
    """
    latencies_ms: list[int] = []
    for i in range(1, PIPELINE_CALL_COUNT + 1):
        started = time.monotonic()
        _print(f"[..] POST /api/pipeline/run #{i} (intent={PIPELINE_INTENT!r}) — up to {PIPELINE_TIMEOUT_SECONDS:.0f}s")
        resp = prod_client.post(
            "/api/pipeline/run",
            json={"intent": PIPELINE_INTENT},
            timeout=PIPELINE_TIMEOUT_SECONDS,
        )
        elapsed_ms = int((time.monotonic() - started) * 1000)
        latencies_ms.append(elapsed_ms)

        assert resp.status_code == 200, (
            f"call #{i}: expected 200, got {resp.status_code}: {resp.text[:300]}"
        )
        body = resp.json()
        _assert_full_spec(body, i)
        _print(
            f"[OK] /api/pipeline/run #{i} -> 200 in {elapsed_ms} ms "
            f"(status={body['status']}, sharpe={body['metrics']['sharpe_ratio']})"
        )

    avg_ms = sum(latencies_ms) // len(latencies_ms)
    _print(f"[SUMMARY] 3/3 runs OK | latencies(ms)={latencies_ms} | avg={avg_ms} ms")


def _run_cli() -> int:
    """Standalone runner so the file can be executed without pytest."""
    os.environ.setdefault("PROD_E2E", "1")
    print(f"=== B-E2E-PROD — target: {PROD_BASE_URL} ===", flush=True)
    failed: list[str] = []
    with httpx.Client(
        base_url=PROD_BASE_URL,
        timeout=httpx.Timeout(PIPELINE_TIMEOUT_SECONDS, connect=10.0),
        follow_redirects=True,
        headers={"User-Agent": "qg-prod-e2e/1.0"},
    ) as client:
        for name, fn in (
            ("health", test_health_endpoint),
            ("strategies", test_list_strategies),
            ("logs", test_list_logs),
            ("pipeline_x3", test_pipeline_run_three_consecutive_calls),
        ):
            try:
                fn(client)
                print(f"[PASS] {name}", flush=True)
            except AssertionError as exc:
                failed.append(name)
                print(f"[FAIL] {name}: {exc}", flush=True)
            except httpx.HTTPError as exc:
                failed.append(name)
                print(f"[FAIL] {name}: HTTP error: {exc}", flush=True)

    if failed:
        print(f"=== FAILED: {failed} ===", flush=True)
        return 1
    print("=== ALL CHECKS PASSED ===", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(_run_cli())
