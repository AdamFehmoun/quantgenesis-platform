import logging
import time
from typing import Optional

from sqlmodel import Session
from starlette.background import BackgroundTask
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.db import engine
from app.models.api_request_log import APIRequestLog

logger = logging.getLogger(__name__)


def _persist_log(
    client_ip: Optional[str],
    method: str,
    path: str,
    status_code: int,
    execution_time_seconds: float,
) -> None:
    try:
        with Session(engine) as session:
            session.add(
                APIRequestLog(
                    client_ip=client_ip,
                    method=method,
                    path=path,
                    status_code=status_code,
                    execution_time_seconds=execution_time_seconds,
                )
            )
            session.commit()
    except Exception:
        logger.exception("Failed to persist APIRequestLog (path=%s)", path)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start

        client_ip = request.client.host if request.client else None

        log_task = BackgroundTask(
            _persist_log,
            client_ip=client_ip,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            execution_time_seconds=elapsed,
        )
        existing = response.background
        if existing is None:
            response.background = log_task
        else:
            from starlette.background import BackgroundTasks

            tasks = BackgroundTasks(tasks=[existing, log_task])
            response.background = tasks

        return response
