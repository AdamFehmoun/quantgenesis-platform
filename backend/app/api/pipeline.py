from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session

from app.core.db import get_session
from app.models.strategy import Strategy

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.post("/run")
async def run_pipeline(
    payload: dict[str, Any] = Body(...),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    intent = payload.get("intent")
    if not intent or not isinstance(intent, str):
        raise HTTPException(status_code=422, detail="Field 'intent' is required (string).")

    strategy = Strategy(intent=intent, status="received")
    session.add(strategy)
    session.commit()
    session.refresh(strategy)

    return {
        "id": str(strategy.id),
        "status": strategy.status,
        "intent": strategy.intent,
        "created_at": strategy.created_at.isoformat(),
    }
