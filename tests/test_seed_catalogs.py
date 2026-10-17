"""The first run must create a mounted database and seed it from bundled files."""

import os
from pathlib import Path
import sqlite3
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def test_seed_creates_missing_database_directory(tmp_path):
    db_path = tmp_path / "mounted" / "nested" / "observatory.db"
    env = dict(os.environ, DB_PATH=str(db_path), CATALOG_DIR=str(ROOT / "data/catalogs"))
    subprocess.run(
        [sys.executable, "-c", "from backend.db.database import init_db, seed_catalogs; init_db(); seed_catalogs()"],
        cwd=ROOT, env=env, check=True, capture_output=True, text=True, timeout=90,
    )
    with sqlite3.connect(db_path) as db:
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert db.execute("SELECT COUNT(*) FROM openngc_records").fetchone()[0] == 14034
        assert db.execute("SELECT COUNT(*) FROM catalog WHERE source='openngc_ngc'").fetchone()[0] == 13309
        assert db.execute("SELECT COUNT(*) FROM catalog WHERE source='messier'").fetchone()[0] == 110
        assert db.execute("SELECT COUNT(*) FROM catalog WHERE source='landolt50'").fetchone()[0] == 335
