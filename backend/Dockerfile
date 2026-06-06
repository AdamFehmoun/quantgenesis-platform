FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Dep-cache layer: only invalidated when pyproject.toml changes.
# - Main deps (FastAPI, SQLModel, etc.) toujours installées
# - Dev group (pytest, pytest-cov, httpx) installé par défaut pour permettre
#   `docker compose run --rm backend pytest` sans hack `pip install` à la volée.
#   Les 3 paquets dev pèsent ~20 MB, négligeable face à pandas/yfinance.
# - Pour une image strictement prod (Railway prod-only) : `--build-arg INSTALL_DEV=0`.
ARG INSTALL_DEV=1
COPY backend/pyproject.toml .
RUN uv pip install --system --no-cache -r pyproject.toml \
    && uv pip install --system --no-cache "anthropic>=0.40.0" "python-dotenv>=1.0.0" \
    && if [ "$INSTALL_DEV" = "1" ]; then \
         uv pip install --system --no-cache "pytest>=8.0" "pytest-cov>=5.0" "httpx>=0.27"; \
       fi

# B-RAILWAY: build context is the repo root so sandbox/ ships with the image.
# `from sandbox.executor import run_backtest` resolves because /app is on sys.path.
COPY backend/ .
COPY sandbox/ ./sandbox/
COPY agents/ ./agents/

# Shell form so $PORT is expanded at container runtime. `exec` replaces the
# shell with uvicorn so SIGTERM from Railway/Docker reaches uvicorn directly
# for a clean shutdown. Railway injects PORT dynamically; 8000 is the fallback
# for local `docker run` without --env PORT.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
