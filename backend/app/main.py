from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import data, pipeline, strategies
from app.core.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="QuantGenesis Backend", lifespan=lifespan)

app.include_router(pipeline.router)
app.include_router(data.router)
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
