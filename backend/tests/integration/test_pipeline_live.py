"""B-S2-03 — End-to-end live integration test for POST /api/pipeline/run.

NOT collected by default: lives outside the pytest `testpaths` (tests/), and
is gated by the QG_RUN_LIVE_INTEGRATION env var so a regular `pytest tests/`
run never burns LLM tokens / E2B credits.

Usage (with the backend already running on localhost:8000):

    QG_RUN_LIVE_INTEGRATION=1 python -m pytest backend/tests/integration/ -v

Or run as a script:

    QG_RUN_LIVE_INTEGRATION=1 python backend/tests/integration/test_pipeline_live.py

Acceptance criteria (per the J8 brief):
- POST /api/pipeline/run {"intent": "RSI Bitcoin"} → HTTP 200
- Response contains non-empty real `final_spec` and `compliance_log`
- End-to-end latency under 120 seconds
"""

from __future__ import annotations

import os
import sys
import time

import pytest
import requests

BACKEND_URL = os.getenv("QG_BACKEND_URL", "http://localhost:8000")
DEADLINE_SECONDS = 120.0
LIVE = os.getenv("QG_RUN_LIVE_INTEGRATION") == "1"


pytestmark = pytest.mark.skipif(
    not LIVE,
    reason="set QG_RUN_LIVE_INTEGRATION=1 to run the live LLM/E2B integration test",
)


def test_pipeline_run_returns_real_spec_under_120s() -> None:
    """Real LLM run: agents pipeline must answer with a populated final_spec
    and compliance_log within the deadline."""
    t0 = time.perf_counter()
    resp = requests.post(
        f"{BACKEND_URL}/api/pipeline/run",
        json={"intent": "RSI Bitcoin"},
        timeout=DEADLINE_SECONDS,
    )
    elapsed = time.perf_counter() - t0

    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text[:500]}"
    assert elapsed < DEADLINE_SECONDS, f"too slow: {elapsed:.1f}s >= {DEADLINE_SECONDS}s"

    body = resp.json()
    assert body["status"] == "success", body

    # final_spec must be a real dict from the architect agent
    final_spec = body.get("final_spec")
    assert isinstance(final_spec, dict) and final_spec, "final_spec must be a non-empty dict"
    assert "claude_code_instructions" in final_spec or "architecture" in final_spec, (
        f"final_spec missing architect output keys: {sorted(final_spec.keys())}"
    )

    # compliance_log must be a real dict from the AI Act compliance agent
    compliance = body.get("compliance_log")
    assert isinstance(compliance, dict) and compliance, "compliance_log must be a non-empty dict"

    print(
        f"[B-S2-03] ✅ /api/pipeline/run answered in {elapsed:.1f}s "
        f"with strategy_id={body.get('id')}, status={body.get('status')}"
    )


if __name__ == "__main__":
    # Allow running as a plain script: `python test_pipeline_live.py`
    os.environ["QG_RUN_LIVE_INTEGRATION"] = "1"
    sys.exit(pytest.main([__file__, "-v", "-s"]))
