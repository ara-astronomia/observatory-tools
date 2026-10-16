"""Import OpenNGC NGC.csv and addendum.csv into the local StarAlt database.

All source records are retained in openngc_records. Objects with valid coordinates,
excluding duplicate/nonexistent entries and the already-imported M40, are indexed
in catalog for StarAlt. See data/catalogs/README.md for licence and provenance.

Usage: python scripts/import_openngc.py [--dry-run] [--db PATH]
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data/catalogs/openngc"
DEFAULT_DB = Path(os.getenv("DB_PATH", ROOT / "backend/db/observatory.db"))
FILES = ("NGC.csv", "addendum.csv")
COLUMNS = {
    "Name", "Type", "RA", "Dec", "M", "NGC", "IC", "Identifiers", "Common names", "Sources"
}
TYPE_LABELS = {
    "*": "Stella", "**": "Stella doppia", "*Ass": "Associazione stellare",
    "OCl": "Ammasso aperto", "GCl": "Ammasso globulare", "Cl+N": "Ammasso e nebulosa",
    "G": "Galassia", "GPair": "Coppia di galassie", "GTrpl": "Tripla di galassie",
    "GGroup": "Gruppo di galassie", "PN": "Nebulosa planetaria",
    "HII": "Nebulosa H II", "DrkN": "Nebulosa oscura", "EmN": "Nebulosa a emissione",
    "Neb": "Nebulosa", "RfN": "Nebulosa a riflessione", "SNR": "Resto di supernova",
    "Nova": "Nova", "Other": "Altro", "Dup": "Duplicato", "NonEx": "Oggetto inesistente",
}
NAME_RE = re.compile(r"^(NGC|IC|ESO|HCG|MWSC|Mel|PGC|UGC|Cl|B|C|H|M)(\d+)(.*)$")
ANGLE_RE = re.compile(r"([+-]?)(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)")


def display_name(raw: str) -> str:
    match = NAME_RE.fullmatch(raw)
    if not match:
        raise ValueError(f"Designazione non riconosciuta: {raw!r}")
    prefix, number, suffix = match.groups()
    if prefix == "Mel":
        prefix = "Melotte"
    return f"{prefix}{'' if prefix == 'M' else ' '}{int(number)}{suffix}"


def angle(value: str, *, ra: bool) -> float:
    match = ANGLE_RE.fullmatch(value)
    if not match:
        raise ValueError(f"Coordinata non valida: {value!r}")
    sign, whole, minute, second = match.groups()
    whole, minute, second = int(whole), int(minute), float(second)
    if not 0 <= minute < 60 or not 0 <= second <= 60 or not math.isfinite(second):
        raise ValueError(f"Coordinata non valida: {value!r}")
    result = whole + minute / 60 + second / 3600
    if ra:
        if sign == "-" or not 0 <= result < 24:
            raise ValueError(f"RA non valida: {value!r}")
    elif result > 90:
        raise ValueError(f"Dec non valida: {value!r}")
    return -result if sign == "-" else result


def read_records(source_dir: Path) -> list[dict]:
    records = []
    for filename in FILES:
        with (source_dir / filename).open(encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source, delimiter=";")
            if not reader.fieldnames or not COLUMNS.issubset(reader.fieldnames):
                raise ValueError(f"Colonne mancanti in {filename}")
            rows = list(reader)
        if not rows:
            raise ValueError(f"{filename}: file vuoto")
        for row in rows:
            raw_name = row["Name"].strip()
            kind = row["Type"].strip()
            if kind not in TYPE_LABELS:
                raise ValueError(f"Tipo sconosciuto per {raw_name}: {kind!r}")
            if bool(row["RA"]) != bool(row["Dec"]):
                raise ValueError(f"Una sola coordinata per {raw_name}")
            ra_h = angle(row["RA"], ra=True) if row["RA"] else None
            dec_d = angle(row["Dec"], ra=False) if row["Dec"] else None
            if (ra_h is None or dec_d is None) and kind not in ("Dup", "NonEx"):
                raise ValueError(f"Coordinate mancanti per {raw_name}")
            name = display_name(raw_name)
            aliases = []
            if row["M"].strip() and not re.fullmatch(r"M\d+", name):
                aliases.append(f"M{int(row['M'])}")
            if row["Common names"].strip():
                aliases.append(row["Common names"].strip().replace(",", " · "))
            records.append({
                "raw_name": raw_name,
                "name": name,
                "source_file": filename,
                "source": "openngc_ngc" if filename == "NGC.csv" else "openngc_addendum",
                "kind": kind,
                "ra_h": ra_h,
                "dec_d": dec_d,
                "alias": " · ".join(aliases) or None,
                "obj_type": TYPE_LABELS[kind],
                "record_json": json.dumps(row, ensure_ascii=False, sort_keys=True),
                "include": kind not in ("Dup", "NonEx") and name != "M40",
            })
    if len({r["raw_name"] for r in records}) != len(records):
        raise ValueError("Designazioni originali duplicate")
    if len({r["name"] for r in records}) != len(records):
        raise ValueError("Designazioni normalizzate duplicate")
    return records


def make_backup(connection: sqlite3.Connection, db_path: Path) -> Path:
    backup_dir = Path(os.getenv("BACKUP_DIR", ROOT / "backups"))
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_path = backup_dir / f"{db_path.stem}-before-openngc-{stamp}.db"
    with sqlite3.connect(backup_path) as backup:
        connection.backup(backup)
    return backup_path


def import_records(connection: sqlite3.Connection, records: list[dict]) -> tuple[int, int]:
    inserted = updated = 0
    connection.execute("BEGIN IMMEDIATE")
    try:
        connection.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_openngc_name
            ON catalog(name) WHERE source IN ('openngc_ngc', 'openngc_addendum')
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS openngc_records (
                raw_name TEXT PRIMARY KEY,
                source_file TEXT NOT NULL,
                catalog_id INTEGER REFERENCES catalog(id),
                record_json TEXT NOT NULL
            )
        """)
        current_keys = {(row["source"], row["name"]) for row in records if row["include"]}
        existing_keys = connection.execute("""
            SELECT id, source, name FROM catalog
            WHERE source IN ('openngc_ngc', 'openngc_addendum')
        """).fetchall()
        for stale_id, source, name in existing_keys:
            if (source, name) not in current_keys:
                connection.execute("UPDATE openngc_records SET catalog_id=NULL WHERE catalog_id=?", (stale_id,))
                connection.execute("DELETE FROM catalog WHERE id=?", (stale_id,))
        catalog_ids = {(source, name): catalog_id for catalog_id, source, name in connection.execute("SELECT id, source, name FROM catalog WHERE source IN ('openngc_ngc', 'openngc_addendum')")}
        for row in records:
            catalog_id = None
            if row["include"]:
                existing = catalog_ids.get((row["source"], row["name"]))
                notes = f"OpenNGC {row['source_file']}; designazione originale {row['raw_name']}; J2000; CC BY-SA 4.0"
                if existing:
                    catalog_id = existing
                    connection.execute("""
                        UPDATE catalog SET alias=?, obj_type=?, ra_h=?, dec_d=?, notes=? WHERE id=?
                    """, (row["alias"], row["obj_type"], row["ra_h"], row["dec_d"], notes, catalog_id))
                    updated += 1
                else:
                    created_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(" ")
                    cursor = connection.execute("""
                        INSERT INTO catalog(name, alias, obj_type, ra_h, dec_d, source, notes, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (row["name"], row["alias"], row["obj_type"], row["ra_h"], row["dec_d"],
                          row["source"], notes, created_at))
                    catalog_id = cursor.lastrowid
                    catalog_ids[(row["source"], row["name"])] = catalog_id
                    inserted += 1
            connection.execute("""
                INSERT INTO openngc_records(raw_name, source_file, catalog_id, record_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(raw_name) DO UPDATE SET
                  source_file=excluded.source_file,
                  catalog_id=excluded.catalog_id,
                  record_json=excluded.record_json
            """, (row["raw_name"], row["source_file"], catalog_id, row["record_json"]))
        expected_catalog = sum(r["include"] for r in records)
        actual_catalog = connection.execute("""
            SELECT COUNT(*) FROM catalog WHERE source IN ('openngc_ngc', 'openngc_addendum')
        """).fetchone()[0]
        current_raw_names = {r["raw_name"] for r in records}
        for (raw_name,) in connection.execute("SELECT raw_name FROM openngc_records").fetchall():
            if raw_name not in current_raw_names:
                connection.execute("DELETE FROM openngc_records WHERE raw_name=?", (raw_name,))
        actual_raw = connection.execute("SELECT COUNT(*) FROM openngc_records").fetchone()[0]
        if actual_catalog != expected_catalog or actual_raw != len(records):
            raise ValueError(f"Conteggi inattesi: catalog={actual_catalog}, raw={actual_raw}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return inserted, updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    records = read_records(args.source_dir)
    by_file = {filename: sum(r["source_file"] == filename for r in records) for filename in FILES}
    in_catalog = sum(r["include"] for r in records)
    print(f"OpenNGC valido: {by_file}; {in_catalog} oggetti puntabili, {len(records)-in_catalog} righe solo originali")
    if args.dry_run:
        return
    if not args.db.is_file():
        raise SystemExit(f"Database non trovato: {args.db}")
    with sqlite3.connect(args.db, timeout=60) as connection:
        connection.execute("PRAGMA foreign_keys=ON")
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise SystemExit("Il database non supera PRAGMA integrity_check")
        backup = make_backup(connection, args.db)
        inserted, updated = import_records(connection, records)
    print(f"Importazione completata: {inserted} inseriti, {updated} aggiornati; backup: {backup}")


if __name__ == "__main__":
    main()
