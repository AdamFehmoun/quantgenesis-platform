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


def init_db() -> None:
    import app.models  # noqa: F401  ensure models are registered before create_all

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
