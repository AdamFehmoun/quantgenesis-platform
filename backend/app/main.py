from fastapi import FastAPI

from app.api import data, pipeline

app = FastAPI(title="QuantGenesis Backend")

app.include_router(pipeline.router)
app.include_router(data.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
