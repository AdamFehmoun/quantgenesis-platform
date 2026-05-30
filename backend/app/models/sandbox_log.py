import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel

class SandboxLog(SQLModel, table=True):
    __tablename__ = "sandbox_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    status: str = Field(nullable=False, index=True)
    execution_time_ms: int = Field(nullable=False)
    
    # Ajouts demandés par la tâche M-14
    memory_used_mb: float = Field(default=0.0)
    code_hash: str = Field(nullable=False, index=True)
    
    # Tes excellentes initiatives
    sharpe_ratio: Optional[float] = Field(default=None)
    error_type: Optional[str] = Field(default=None)
    
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )