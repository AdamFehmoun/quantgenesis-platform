from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import data, pipeline, strategies
from app.core.db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="QuantGenesis Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(pipeline.router)
app.include_router(data.router)
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
