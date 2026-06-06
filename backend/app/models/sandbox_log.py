import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class SandboxLog(SQLModel, table=True):
    __tablename__ = "sandbox_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    status: str = Field(nullable=False, index=True)
    execution_time_ms: int = Field(nullable=False)

    memory_used_mb: float = Field(default=0.0)
    code_hash: str = Field(nullable=False, index=True)

    # Métriques de performance — toutes Optional : ERROR/FALLBACK runs n'en ont pas.
    # Noms canoniques (arbitrage du 06/06/2026) :
    #   max_drawdown_pct (et plus `drawdown`)
    #   total_return_pct (et plus `return`)
    #   trades_count     (et plus `num_trades`)
    sharpe_ratio: Optional[float] = Field(default=None)
    max_drawdown_pct: Optional[float] = Field(default=None)
    total_return_pct: Optional[float] = Field(default=None)
    trades_count: Optional[int] = Field(default=None)

    error_type: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
