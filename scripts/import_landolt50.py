"""Import Landolt (2013) northern standards from CDS VizieR into StarAlt.

Source: J/AJ/146/131/standards, Table 2 (335 northern stars).
The 14 equatorial Table 3 stars in the source file are deliberately excluded.

Usage: python scripts/import_landolt50.py [--dry-run] [--db PATH]
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/catalogs/landolt-2013-plus50-vizier.tsv"
DEFAULT_DB = Path(os.getenv("DB_PATH", ROOT / "backend/db/observatory.db"))
SOURCE_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/AJ/146/131/standards&-out.all&-out.max=9999"
SOURCE_CITATION = "Landolt (2013), AJ 146:131, Table 2; CDS J/AJ/146/131"


def angle(parts: str, is_ra: bool) -> float:
    pieces = parts.strip().split()
    if len(pieces) != 3:
        raise ValueError(f"Coordinata non valida: {parts!r}")
    first, minute, second = pieces
    sign = -1 if first.startswith("-") else 1
    whole = abs(int(first))
    minute, second = int(minute), float(second)
    if not 0 <= minute < 60 or not 0 <= second < 60:
        raise ValueError(f"Coordinata non valida: {parts!r}")
    value = whole + minute / 60 + second / 3600
    if is_ra:
        if sign < 0 or not 0 <= value < 24:
            raise ValueError(f"RA non valida: {parts!r}")
        return value
    if value > 90:
        raise ValueError(f"Dec non valida: {parts!r}")
    return sign * value


def number(row: dict[str, str], column: str) -> float | None:
    raw = row[column].strip()
    if not raw:
        return None
    value = float(raw)
    if not math.isfinite(value):
        raise ValueError(f"Valore non finito in {column}: {raw}")
    return value


def read_standards(path: Path) -> list[dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    header_pos = next(i for i, line in enumerate(lines) if line.startswith("recno\t"))
    header = lines[header_pos].split("\t")
    # VizieR puts one units line and one separator line after the header.
    rows = [
        {key: value.strip() for key, value in row.items()}
        for row in csv.DictReader(lines[header_pos + 3 :], fieldnames=header, delimiter="\t")
    ]
    if len(rows) != 349:
        raise ValueError(f"Attese 349 righe CDS (335 nord + 14 equatore), trovate {len(rows)}")
    northern = [row for row in rows if angle(row["DEJ2000"], False) > 20]
    if len(northern) != 335 or len({row["Name"] for row in northern}) != 335:
        raise ValueError("La selezione delle 335 stelle settentrionali non è univoca")
    for row in northern:
        angle(row["RAJ2000"], True)
        if number(row, "<Vmag>") is None:
            raise ValueError(f"Magnitudine V assente per {row['Name']}")
    return northern


def photometry(row: dict[str, str]) -> tuple[float | None, ...]:
    v = number(row, "<Vmag>")
    bv, ub = number(row, "<B-V>"), number(row, "<U-B>")
    vr, ri, vi = number(row, "<V-R>"), number(row, "<R-I>"), number(row, "<V-I>")
    b = v + bv if bv is not None else None
    u = b + ub if b is not None and ub is not None else None
    r = v - vr if vr is not None else None
    i = r - ri if r is not None and ri is not None else (v - vi if vi is not None else None)
    return tuple(round(value, 3) if value is not None else None for value in (u, b, v, r, i))


def quality(n_obs: int) -> str:
    if n_obs >= 5:
        return "standard"
    if n_obs == 4:
        return "supplementary"
    return "candidate"


def make_backup(connection: sqlite3.Connection, db_path: Path) -> Path:
    backup_dir = Path(os.getenv("BACKUP_DIR", ROOT / "backups"))
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_path = backup_dir / f"{db_path.stem}-before-landolt50-{stamp}.db"
    with sqlite3.connect(backup_path) as backup:
        connection.backup(backup)
    return backup_path


def import_rows(connection: sqlite3.Connection, rows: list[dict[str, str]]) -> tuple[int, int]:
    connection.execute("BEGIN IMMEDIATE")
    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS landolt50_photometry (
                catalog_id INTEGER PRIMARY KEY REFERENCES catalog(id) ON DELETE CASCADE,
                designation TEXT NOT NULL UNIQUE,
                u_mag REAL, b_mag REAL, v_mag REAL NOT NULL, r_mag REAL, i_mag REAL,
                n_obs INTEGER NOT NULL, n_nights INTEGER NOT NULL,
                quality TEXT NOT NULL,
                source_record_json TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_landolt50_name
            ON catalog(name) WHERE source = 'landolt50'
        """)
        inserted = updated = 0
        for row in rows:
            name = row["Name"]
            ra_h = angle(row["RAJ2000"], True)
            dec_d = angle(row["DEJ2000"], False)
            u, b, v, r, i = photometry(row)
            n_obs, n_nights = int(row["No"]), int(row["Nn"])
            grade = quality(n_obs)
            obj_type = {
                "standard": "Landolt +50 · standard",
                "supplementary": "Landolt +50 · supplementare",
                "candidate": "Landolt +50 · candidato",
            }[grade]
            mags = " · ".join(
                f"{band}={mag:.3f}" for band, mag in (("U", u), ("B", b), ("V", v), ("R_C", r), ("I_C", i))
                if mag is not None
            )
            notes = f"{SOURCE_CITATION}; J2000; {mags}; {n_obs} misure su {n_nights} notti; qualità: {grade}"
            alias = f"V={v:.3f} · {n_obs} misure"
            existing = connection.execute(
                "SELECT id FROM catalog WHERE source = 'landolt50' AND name = ?", (name,)
            ).fetchone()
            if existing:
                catalog_id = existing[0]
                connection.execute("""
                    UPDATE catalog SET alias=?, obj_type=?, ra_h=?, dec_d=?, notes=? WHERE id=?
                """, (alias, obj_type, ra_h, dec_d, notes, catalog_id))
                updated += 1
            else:
                now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(" ")
                cursor = connection.execute("""
                    INSERT INTO catalog(name, alias, obj_type, ra_h, dec_d, source, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, 'landolt50', ?, ?)
                """, (name, alias, obj_type, ra_h, dec_d, notes, now))
                catalog_id = cursor.lastrowid
                inserted += 1
            connection.execute("""
                INSERT INTO landolt50_photometry
                (catalog_id, designation, u_mag, b_mag, v_mag, r_mag, i_mag,
                 n_obs, n_nights, quality, source_record_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(catalog_id) DO UPDATE SET
                  designation=excluded.designation, u_mag=excluded.u_mag,
                  b_mag=excluded.b_mag, v_mag=excluded.v_mag,
                  r_mag=excluded.r_mag, i_mag=excluded.i_mag,
                  n_obs=excluded.n_obs, n_nights=excluded.n_nights,
                  quality=excluded.quality, source_record_json=excluded.source_record_json
            """, (catalog_id, name, u, b, v, r, i, n_obs, n_nights, grade,
                  json.dumps(row, ensure_ascii=False, sort_keys=True)))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return inserted, updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Database SQLite di StarAlt")
    parser.add_argument("--source", type=Path, default=SOURCE, help="TSV originale CDS/VizieR")
    parser.add_argument("--dry-run", action="store_true", help="Verifica il TSV senza cambiare il DB")
    args = parser.parse_args()
    rows = read_standards(args.source)
    counts = {grade: sum(quality(int(row["No"])) == grade for row in rows)
              for grade in ("standard", "supplementary", "candidate")}
    print(f"Landolt +50: {len(rows)} stelle nord, qualità {counts}; fonte: {SOURCE_URL}")
    if args.dry_run:
        return
    if not args.db.is_file():
        raise SystemExit(f"Database non trovato: {args.db}")
    with sqlite3.connect(args.db, timeout=30) as connection:
        connection.execute("PRAGMA foreign_keys=ON")
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise SystemExit("Il database non supera PRAGMA integrity_check")
        backup = make_backup(connection, args.db)
        inserted, updated = import_rows(connection, rows)
        total = connection.execute("SELECT COUNT(*) FROM catalog WHERE source='landolt50'").fetchone()[0]
        photo = connection.execute("SELECT COUNT(*) FROM landolt50_photometry").fetchone()[0]
        if total != 335 or photo != 335:
            raise RuntimeError(f"Conteggio finale inatteso: catalog={total}, fotometria={photo}")
        print(f"Importazione completata: {inserted} inserite, {updated} aggiornate; backup: {backup}")


if __name__ == "__main__":
    main()
