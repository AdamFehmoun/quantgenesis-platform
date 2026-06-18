import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.strategy import Strategy

router = APIRouter()


_EMPTY_METRICS: dict[str, float | int] = {
    "sharpe_ratio": 0.0,
    "max_drawdown_pct": 0.0,
    "total_return_pct": 0.0,
    "trades_count": 0,
    "win_rate_pct": 0.0,
}


def _extract_metrics(result_json: Any) -> dict[str, float | int]:
    """Surface the metrics block stored under result_json.metrics.

    B-S2-02: the frontend history view must render metrics without null-checks,
    so we always return the canonical 5-key contract — falling back to zeros
    when a strategy was persisted before the metrics field existed.
    """
    if isinstance(result_json, dict):
        metrics = result_json.get("metrics")
        if isinstance(metrics, dict):
            return {**_EMPTY_METRICS, **metrics}
    return dict(_EMPTY_METRICS)


def _serialize(strategy: Strategy) -> dict[str, Any]:
    return {
        "id": str(strategy.id),
        "intent": strategy.intent,
        "status": strategy.status,
        "result_json": strategy.result_json,
        "metrics": _extract_metrics(strategy.result_json),
        "created_at": strategy.created_at.isoformat(),
    }


def _serialize_list_item(strategy: Strategy) -> dict[str, Any]:
    """Compact shape for GET / — no result_json blob, just the contract Maxime
    needs to render the history grid."""
    return {
        "id": str(strategy.id),
        "intent": strategy.intent,
        "status": strategy.status,
        "created_at": strategy.created_at.isoformat(),
        "metrics": _extract_metrics(strategy.result_json),
    }


@router.post("/", status_code=201)
def create_strategy(
    payload: dict[str, Any] = Body(...),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    intent = payload.get("intent")
    if not intent or not isinstance(intent, str):
        raise HTTPException(status_code=422, detail="Field 'intent' is required (string).")

    status = payload.get("status") or "pending"
    if not isinstance(status, str):
        raise HTTPException(status_code=422, detail="Field 'status' must be a string.")

    result_json = payload.get("result_json")
    if result_json is not None and not isinstance(result_json, dict):
        raise HTTPException(status_code=422, detail="Field 'result_json' must be an object.")

    strategy = Strategy(intent=intent, status=status, result_json=result_json)
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    return _serialize(strategy)


@router.get("/")
def list_strategies(
    session: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    """B-S2-02: return every persisted strategy with id, intent, status,
    created_at and the canonical metrics object — what the frontend needs
    for the history panel."""
    stmt = select(Strategy).order_by(Strategy.created_at.desc())
    return [_serialize_list_item(s) for s in session.exec(stmt).all()]


@router.get("/{strategy_id}")
def get_strategy(
    strategy_id: str,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        sid = uuid.UUID(strategy_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid UUID.") from exc

    strategy = session.get(Strategy, sid)
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found.")
    return _serialize(strategy)


@router.delete("/{strategy_id}", status_code=204)
def delete_strategy(
    strategy_id: str,
    session: Session = Depends(get_session),
) -> Response:
    try:
        sid = uuid.UUID(strategy_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid UUID.") from exc

    strategy = session.get(Strategy, sid)
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found.")

    session.delete(strategy)
    session.commit()
    return Response(status_code=204)
