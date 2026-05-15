import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.db import get_session
from app.models.strategy import Strategy

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


def _serialize(strategy: Strategy) -> dict[str, Any]:
    return {
        "id": str(strategy.id),
        "intent": strategy.intent,
        "status": strategy.status,
        "result_json": strategy.result_json,
        "created_at": strategy.created_at.isoformat(),
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
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    stmt = select(Strategy).order_by(Strategy.created_at.desc()).offset(offset).limit(limit)
    rows = session.exec(stmt).all()
    return {
        "count": len(rows),
        "limit": limit,
        "offset": offset,
        "items": [_serialize(s) for s in rows],
    }


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
