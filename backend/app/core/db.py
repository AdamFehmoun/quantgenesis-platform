import os
from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine


def _normalize_db_url(url: str) -> str:
    # Railway's Postgres plugin (and Heroku) inject `postgres://` or
    # `postgresql://`. SQLAlchemy then defaults to psycopg2, which isn't
    # installed — we ship psycopg v3. Force the driver suffix.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _normalize_db_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://qg_user:qg_password@db:5432/quantgenesis",
    )
)

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)


_ADDITIVE_MIGRATIONS: tuple[str, ...] = (
    # B-LOGS-SANDBOX (S3 / Task 2): extend the SandboxLog row with the full
    # metrics envelope. SQLModel.metadata.create_all() only CREATEs tables —
    # existing rows on Railway need an explicit ADD COLUMN. Idempotent.
    "ALTER TABLE sandbox_logs ADD COLUMN IF NOT EXISTS max_drawdown_pct DOUBLE PRECISION",
    "ALTER TABLE sandbox_logs ADD COLUMN IF NOT EXISTS total_return_pct DOUBLE PRECISION",
    "ALTER TABLE sandbox_logs ADD COLUMN IF NOT EXISTS trades_count INTEGER",
    # Drift fix: code_hash landed in Mathis' commit c7ca780 but was never
    # applied to the prod table (older provisioning). Inserts blow up without
    # it. Added nullable to coexist with pre-c7ca780 rows.
    "ALTER TABLE sandbox_logs ADD COLUMN IF NOT EXISTS code_hash VARCHAR",
    "CREATE INDEX IF NOT EXISTS ix_sandbox_logs_code_hash ON sandbox_logs(code_hash)",
    # Drift fix: the old table provisions sharpe / drawdown / return as NOT NULL,
    # but the official model treats them as Optional (ERROR runs have no metrics).
    # Relaxing the constraint keeps insertions correct without rewriting history.
    "ALTER TABLE sandbox_logs ALTER COLUMN sharpe_ratio DROP NOT NULL",
    "ALTER TABLE sandbox_logs ALTER COLUMN max_drawdown_pct DROP NOT NULL",
    "ALTER TABLE sandbox_logs ALTER COLUMN total_return_pct DROP NOT NULL",
    # Arbitrage 2026-06-06 : suppression des doublons `drawdown` / `num_trades`
    # (et de l'ancien `return`) côté modèle. Les colonnes peuvent encore exister
    # en prod, provisionnées par une ancienne version. On les relâche en NULLable
    # pour que les INSERT (qui ne les mentionnent plus) ne tombent pas sur un
    # NOT NULL constraint. On ne DROP PAS la colonne ici : trop risqué tant que
    # rien ne garantit qu'aucun consommateur historique ne la lit encore.
    "ALTER TABLE sandbox_logs ALTER COLUMN drawdown DROP NOT NULL",
    "ALTER TABLE sandbox_logs ALTER COLUMN num_trades DROP NOT NULL",
    'ALTER TABLE sandbox_logs ALTER COLUMN "return" DROP NOT NULL',
)


def init_db() -> None:
    import app.models  # noqa: F401  ensure models are registered before create_all

    SQLModel.metadata.create_all(engine)

    # Light additive migrations. We don't pull Alembic for a handful of nullable
    # columns, but we still need the prod table to gain them at boot. Each
    # statement is wrapped in its own transaction : Postgres aborts the whole
    # transaction on the first failing statement, so a single shared `begin()`
    # would silently skip every migration after the first miss. Per-statement
    # isolation keeps each migration fail-open and idempotent.
    from sqlalchemy import text

    for stmt in _ADDITIVE_MIGRATIONS:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            # SQLite (local test setups) doesn't grok IF NOT EXISTS on ADD
            # COLUMN ; Postgres barks on ALTER COLUMN x DROP NOT NULL when the
            # legacy column was never provisioned. Fail open in both cases :
            # the migration is purely advisory, the model+create_all is truth.
            pass


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
