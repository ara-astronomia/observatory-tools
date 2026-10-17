"""Import the complete Messier catalogue into the local StarAlt SQLite database.

Coordinates are J2000. See data/catalogs/README.md for source and licence.
Usage: python scripts/import_messier.py [--dry-run] [--db PATH]
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

try:
    from scripts._common import CATALOG_DIR, DEFAULT_DB, angle, make_backup
except ModuleNotFoundError:  # eseguito come `python scripts/import_messier.py`
    from _common import CATALOG_DIR, DEFAULT_DB, angle, make_backup

SOURCE = CATALOG_DIR / "messier-j2000.csv"
SOURCE_URLS = {
    "OpenNGC": "https://github.com/mattiaverga/OpenNGC",
    "KPNO_NOIRLab": "https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/Messier/messier_catalog.html",
}


def read_catalog(path: Path) -> list[dict[str, str | float]]:
    with path.open(encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        expected = {"messier", "ra_j2000", "dec_j2000", "alias", "obj_type", "source_ref"}
        if set(reader.fieldnames or ()) != expected:
            raise ValueError(f"Colonne CSV inattese: {reader.fieldnames}")
        rows = []
        for record in reader:
            number = int(record["messier"].removeprefix("M"))
            if record["messier"] != f"M{number}" or not 1 <= number <= 110:
                raise ValueError(f"Nome Messier non valido: {record['messier']!r}")
            if record["source_ref"] not in SOURCE_URLS or not record["obj_type"].strip():
                raise ValueError(f"Metadati mancanti per {record['messier']}")
            rows.append({
                "name": record["messier"],
                "alias": record["alias"].strip() or None,
                "obj_type": record["obj_type"].strip(),
                "ra_h": angle(record["ra_j2000"], ra=True),
                "dec_d": angle(record["dec_j2000"], ra=False),
                "notes": f"Coordinate J2000; fonte: {SOURCE_URLS[record['source_ref']]}",
            })
    if len(rows) != 110 or {row["name"] for row in rows} != {f"M{i}" for i in range(1, 111)}:
        raise ValueError("Il CSV deve contenere M1–M110 esattamente una volta")
    return rows


def import_rows(connection: sqlite3.Connection, rows: list[dict[str, str | float]]) -> tuple[int, int]:
    inserted = updated = 0
    connection.execute("BEGIN IMMEDIATE")
    try:
        connection.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_messier_name
            ON catalog(name) WHERE source = 'messier'
        """)
        for row in rows:
            existing = connection.execute(
                "SELECT id FROM catalog WHERE source='messier' AND name=?", (row["name"],)
            ).fetchone()
            if existing:
                connection.execute("""
                    UPDATE catalog SET alias=?, obj_type=?, ra_h=?, dec_d=?, notes=? WHERE id=?
                """, (row["alias"], row["obj_type"], row["ra_h"], row["dec_d"], row["notes"], existing[0]))
                updated += 1
            else:
                created_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(" ")
                connection.execute("""
                    INSERT INTO catalog(name, alias, obj_type, ra_h, dec_d, source, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, 'messier', ?, ?)
                """, (row["name"], row["alias"], row["obj_type"], row["ra_h"], row["dec_d"], row["notes"], created_at))
                inserted += 1
        total = connection.execute("SELECT COUNT(*) FROM catalog WHERE source='messier'").fetchone()[0]
        if total != 110:
            raise ValueError(f"Attesi 110 oggetti nel database, trovati {total}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return inserted, updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    rows = read_catalog(args.source)
    print(f"Catalogo Messier valido: {len(rows)} oggetti, da M1 a M110")
    if args.dry_run:
        return
    if not args.db.is_file():
        raise SystemExit(f"Database non trovato: {args.db}")
    with sqlite3.connect(args.db, timeout=30) as connection:
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise SystemExit("Il database non supera PRAGMA integrity_check")
        backup = make_backup(connection, args.db, "messier")
        inserted, updated = import_rows(connection, rows)
    print(f"Importazione completata: {inserted} inseriti, {updated} aggiornati; backup: {backup}")


if __name__ == "__main__":
    main()
