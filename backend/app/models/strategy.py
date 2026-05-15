import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class Strategy(SQLModel, table=True):
    __tablename__ = "strategy"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    intent: str = Field(nullable=False)
    status: str = Field(default="pending", nullable=False, index=True)
    result_json: Optional[dict[str, Any]] = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
