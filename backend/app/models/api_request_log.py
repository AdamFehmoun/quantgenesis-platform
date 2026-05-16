import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class APIRequestLog(SQLModel, table=True):
    __tablename__ = "api_request_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    client_ip: Optional[str] = Field(default=None, nullable=True, index=True)
    method: str = Field(nullable=False)
    path: str = Field(nullable=False, index=True)
    status_code: int = Field(nullable=False, index=True)
    execution_time_seconds: float = Field(nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
