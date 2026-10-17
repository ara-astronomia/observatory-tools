"""Regression checks for OpenNGC import and StarAlt catalog endpoints."""

import json
import sqlite3

from backend.db.database import CatalogObject, get_db
from backend.main import app
from scripts.import_openngc import SOURCE_DIR, import_records, read_records


def test_import_preserves_raw_records_and_is_repeatable():
    rows = read_records(SOURCE_DIR)
    selected = [next(row for row in rows if row["raw_name"] == name)
                for name in ("NGC0224", "B033", "IC0011")]
    with sqlite3.connect(":memory:") as db:
        db.execute("""
            CREATE TABLE catalog (
                id INTEGER PRIMARY KEY, name TEXT, alias TEXT, obj_type TEXT,
                ra_h REAL, dec_d REAL, source TEXT, notes TEXT, created_at TEXT
            )
        """)
        assert import_records(db, selected) == (2, 0)
        assert import_records(db, selected) == (0, 2)
        assert db.execute("SELECT COUNT(*) FROM catalog").fetchone()[0] == 2
        raw = db.execute("SELECT catalog_id, record_json FROM openngc_records WHERE raw_name='IC0011'").fetchone()
        assert raw[0] is None
        assert json.loads(raw[1])["Name"] == "IC0011"


def test_openngc_filter_and_search(client):
    override = app.dependency_overrides[get_db]()
    db = next(override)
    try:
        db.add_all([
            CatalogObject(name="NGC 224", ra_h=0.7123, dec_d=41.2691, source="openngc_ngc"),
            CatalogObject(name="B 33", alias="Horsehead Nebula", ra_h=5.6831,
                          dec_d=-2.4583, source="openngc_addendum"),
            CatalogObject(name="NGC 224", ra_h=0.7123, dec_d=41.2691, source="user"),
            CatalogObject(name="NGC 6992", alias="Eastern Veil · Network Nebula", ra_h=20.94,
                          dec_d=31.72, source="openngc_ngc"),
        ])
        db.commit()
    finally:
        override.close()

    ngc = client.get("/api/catalog/openngc?source=ngc")
    assert ngc.status_code == 200
    assert [row["name"] for row in ngc.json()] == ["NGC 224", "NGC 6992"]
    assert [row["name"] for row in client.get("/api/catalog/openngc?source=addendum").json()] == ["B 33"]
    assert [row["name"] for row in client.get("/api/catalog/search?q=NGC0224").json()] == ["NGC 224"]
    assert [row["name"] for row in client.get("/api/catalog/search?q=Horsehead").json()] == ["B 33"]
    assert [row["name"] for row in client.get("/api/catalog/search?q=Veil").json()] == ["NGC 6992"]


def test_import_synchronizes_removed_and_reclassified_records():
    rows = read_records(SOURCE_DIR)
    first = next(row for row in rows if row["raw_name"] == "NGC0224")
    second = next(row for row in rows if row["raw_name"] == "B033")
    with sqlite3.connect(":memory:") as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("""CREATE TABLE catalog (
            id INTEGER PRIMARY KEY, name TEXT, alias TEXT, obj_type TEXT,
            ra_h REAL, dec_d REAL, source TEXT, notes TEXT, created_at TEXT)""")
        import_records(db, [first, second])
        reclassified = dict(first, include=False)
        import_records(db, [reclassified])
        assert db.execute("SELECT COUNT(*) FROM catalog").fetchone()[0] == 0
        assert db.execute("SELECT raw_name, catalog_id FROM openngc_records").fetchall() == [(first["raw_name"], None)]
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []


def test_search_prefers_exact_name_and_respects_prefix(client):
    override = app.dependency_overrides[get_db]()
    db = next(override)
    try:
        db.add_all([
            CatalogObject(name="C 9", ra_h=1, dec_d=1, source="openngc_addendum"),
            CatalogObject(name="C 99", ra_h=1, dec_d=1, source="openngc_addendum"),
            CatalogObject(name="IC 9", ra_h=1, dec_d=1, source="openngc_ngc"),
        ])
        db.commit()
    finally:
        override.close()
    results = client.get("/api/catalog/search?q=C9").json()
    assert [row["name"] for row in results] == ["C 9", "C 99"]


def test_search_finds_suffixed_designations_with_spaces(client):
    override = app.dependency_overrides[get_db]()
    db = next(override)
    try:
        db.add_all([
            CatalogObject(name="IC 186", ra_h=1, dec_d=1, source="openngc_ngc"),
            CatalogObject(name="IC 186A", ra_h=1, dec_d=1, source="openngc_ngc"),
            CatalogObject(name="IC 186 NED03", ra_h=1, dec_d=1, source="openngc_ngc"),
        ])
        db.commit()
    finally:
        override.close()
    assert [row["name"] for row in client.get("/api/catalog/search?q=IC 186 A").json()] == ["IC 186A"]
    assert [row["name"] for row in client.get("/api/catalog/search?q=IC 186 NED03").json()] == ["IC 186 NED03"]
    assert [row["name"] for row in client.get("/api/catalog/search?q=IC 186NED03").json()] == ["IC 186 NED03"]
    assert [row["name"] for row in client.get("/api/catalog/search?q=IC186A").json()] == ["IC 186A"]


def test_staralt_endpoint_keeps_user_list_contract(client):
    override = app.dependency_overrides[get_db]()
    db = next(override)
    try:
        db.add_all([
            CatalogObject(name="M40", ra_h=12, dec_d=58, source="messier"),
            CatalogObject(name="F11", ra_h=1, dec_d=14, source="landolt50"),
            CatalogObject(name="Personal", ra_h=2, dec_d=40, source="user"),
        ])
        db.commit()
    finally:
        override.close()
    assert [row["name"] for row in client.get("/api/catalog/").json()] == ["Personal"]
    assert {row["name"] for row in client.get("/api/catalog/staralt").json()} == {"Personal", "F11", "M40"}
    assert [row["name"] for row in client.get("/api/catalog/search?q=M40").json()] == ["M40"]
