from typing import Any

from fastapi import APIRouter, Body

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.post("/run")
async def run_pipeline(payload: dict[str, Any] = Body(...)) -> dict[str, str]:
    intent = payload.get("intent", "No intent provided")
    return {"status": "received", "intent": intent}
