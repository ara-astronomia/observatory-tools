"""
db/database.py — Configurazione SQLAlchemy + SQLite
"""

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Enum, inspect, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import enum
import os
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).parent / "observatory.db")))
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # necessario per SQLite con FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── ORM Models ────────────────────────────────────────────────────

class CatalogObject(Base):
    __tablename__ = "catalog"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False, index=True)
    alias      = Column(String, nullable=True)
    obj_type   = Column(String, nullable=True)
    ra_h       = Column(Float, nullable=False)
    dec_d      = Column(Float, nullable=False)
    source     = Column(String, default="user")   # "builtin" | "user"
    notes      = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SkyMeasurement(Base):
    __tablename__ = "sky_measurements"

    id           = Column(Integer, primary_key=True, index=True)
    setup_id     = Column(String, nullable=False, default="legacy", index=True)
    filter_name  = Column(String, nullable=False)
    sky_e        = Column(Float, nullable=False)
    airmass_obj  = Column(Float, nullable=False)
    airmass_moon = Column(Float, nullable=True)
    moon_illum   = Column(Float, nullable=False)
    moon_dist    = Column(Float, nullable=False)
    seeing       = Column(Float, nullable=True)
    notes        = Column(String, nullable=True)
    observed_at  = Column(DateTime, nullable=False,
                          default=lambda: datetime.now(timezone.utc))
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ── Utility ───────────────────────────────────────────────────────

def get_db():
    """Dependency injection per FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Crea le tabelle se non esistono."""
    Base.metadata.create_all(bind=engine)
    # Conserva le misure già presenti, attribuendole alla configurazione iniziale.
    columns = {c["name"] for c in inspect(engine).get_columns("sky_measurements")}
    if "setup_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE sky_measurements ADD COLUMN setup_id VARCHAR "
                "NOT NULL DEFAULT 'legacy'"
            ))
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sky_measurements_setup_id ON sky_measurements (setup_id)"))
