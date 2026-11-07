import os
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel, create_engine, Session
from config import load_local_env

load_local_env()
_default_database_path = Path(__file__).resolve().with_name("geosentry.db")
_configured_database_url = os.getenv("GEOSENTRY_DATABASE_URL", "").strip()
if _configured_database_url:
    _parsed_database_url = make_url(_configured_database_url)
    if _parsed_database_url.get_backend_name() == "sqlite" and _parsed_database_url.database not in (None, ":memory:"):
        _database_path = Path(_parsed_database_url.database)
        if not _database_path.is_absolute():
            _parsed_database_url = _parsed_database_url.set(database=str((Path(__file__).resolve().parent / _database_path).resolve()))
    DATABASE_URL = _parsed_database_url
else:
    DATABASE_URL = make_url(f"sqlite:///{_default_database_path.as_posix()}")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.get_backend_name() == "sqlite" else {},
)

def create_db():
    SQLModel.metadata.create_all(engine)
    # Additive migration for existing SQLite databases; existing rows are preserved.
    columns = {column["name"] for column in inspect(engine).get_columns("device")}
    if "external_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE device ADD COLUMN external_id VARCHAR"))

def get_session():
    with Session(engine) as session:
        yield session
