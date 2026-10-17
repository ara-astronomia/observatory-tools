"""Helpers shared by the catalog import scripts."""

from __future__ import annotations

from datetime import datetime, timezone
import math
import os
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = Path(os.getenv("CATALOG_DIR", ROOT / "data/catalogs"))
DEFAULT_DB = Path(os.getenv("DB_PATH", ROOT / "backend/db/observatory.db"))
# "HH:MM:SS.s" (OpenNGC, Messier) o "HH MM SS.s" (VizieR)
ANGLE_RE = re.compile(r"([+-]?)(\d{2})[: ](\d{2})[: ](\d{2}(?:\.\d+)?)")


def angle(value: str, *, ra: bool) -> float:
    match = ANGLE_RE.fullmatch(value.strip())
    if not match:
        raise ValueError(f"Coordinata non valida: {value!r}")
    sign, whole, minute, second = match.groups()
    whole, minute, second = int(whole), int(minute), float(second)
    # OpenNGC contiene secondi arrotondati a 60.
    if not 0 <= minute < 60 or not 0 <= second <= 60 or not math.isfinite(second):
        raise ValueError(f"Coordinata non valida: {value!r}")
    result = whole + minute / 60 + second / 3600
    if ra:
        if sign == "-" or not 0 <= result < 24:
            raise ValueError(f"RA non valida: {value!r}")
    elif result > 90:
        raise ValueError(f"Dec non valida: {value!r}")
    return -result if sign == "-" else result


def make_backup(connection: sqlite3.Connection, db_path: Path, label: str) -> Path:
    backup_dir = Path(os.getenv("BACKUP_DIR", ROOT / "backups"))
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_path = backup_dir / f"{db_path.stem}-before-{label}-{stamp}.db"
    with sqlite3.connect(backup_path) as backup:
        connection.backup(backup)
    return backup_path
