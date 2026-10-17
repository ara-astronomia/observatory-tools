# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Observatory planning tools for the Frasso Sabino Observatory. Single-page application served by a FastAPI backend.

## Commands

### Local development

```bash
# Sync dependencies (creates/updates .venv automatically)
uv sync

# Run backend with hot-reload
uv run uvicorn backend.main:app --reload --port 8000
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger)
# → http://localhost:8000/redoc
```

Add a dependency: `uv add <package>` — updates `pyproject.toml` and `uv.lock` in one step.

### Docker

```bash
docker-compose up -d        # start
docker-compose down         # stop (DB and backups persisted in ./tools/data, mounted on /app/data)
docker-compose up --build   # rebuild after pyproject.toml/uv.lock changes
```

### Tests and catalog import

```bash
uv run pytest -q                              # backend + import scripts
node --test tests/test_catalog_identity.js    # catalogue de-duplication (frontend)

# Refresh catalogues already in the DB (backup in BACKUP_DIR, re-runnable)
uv run python scripts/import_openngc.py --dry-run   # also import_landolt50.py, import_messier.py
```

No linter is configured.

## Architecture

### Backend (`backend/`)

FastAPI app (`main.py`) that:
- Initialises the SQLite DB on startup via `init_db()`, then `seed_catalogs()` imports any missing catalogue from `data/catalogs/` (`CATALOG_DIR`) using `scripts/import_*.py`. A seed failure is logged and the app starts anyway; `SKIP_CATALOG_SEED=1` disables it (set by the tests). The DB is generated, not versioned
- Mounts the entire `frontend/` directory as `/static`
- Serves `frontend/index.html` at `/`
- Exposes two router groups under `/api/`

**Data layer** (`db/database.py`): SQLAlchemy + SQLite at `DB_PATH` (default `backend/db/observatory.db`). Two ORM models:
- `CatalogObject` — celestial objects, user-defined or imported (name, alias, RA in decimal hours, Dec in decimal degrees, type, source, notes). The import scripts also create raw tables (`openngc_records`, `landolt50_photometry`)
- `SkyMeasurement` — sky background measurements (filter, sky in e⁻/px/s, airmass, moon conditions, seeing)

**Schemas** (`models/schemas.py`): Pydantic v2 models with `from_attributes = True` for ORM compatibility.

**Routers**:
- `catalog.py` — `GET /` user objects only; `GET /staralt` user + Landolt + Messier; `GET /openngc?source=ngc|addendum`; `GET /search` over imported catalogues; `POST`/`DELETE` only on user objects, rejecting duplicate names (HTTP 409)
- `skydb.py` — CRUD for sky measurements + `GET /stats` (mean/median/std per filter, split by lunar phase) + `GET /predict` (inverse-distance-weighted estimate from stored measurements)

### Frontend (`frontend/`)

Vanilla JS SPA — no build step, no framework. `index.html` is the shell; page content is loaded at boot from `templates/page-*.html` via `fetch('/static/templates/...')`.

**JS module responsibilities** (all files are global scope, loaded in order via `<script>` tags):
- `settings.js` — site/telescope/camera settings shared by all tabs (localStorage)
- `astro-utils.js` — all astronomical math: JD, GMST, Alt/Az, Sun/Moon positions (Meeus ch.47), twilight search, angular distance
- `catalog.js` — built-in catalogue + DB catalogues via `/api/catalog/staralt`, search, de-duplication across catalogues
- `staralt.js` — StarAlt tab: altitude/azimuth plot over the night
- `staralt-night.js` — StarAlt list of objects visible during the night; loads OpenNGC on demand
- `snr.js` — SNR Analyzer tab: signal-to-noise ratio calculation
- `snr-calibration.js` — empirical star-peak calibration per filter for the SNR Analyzer
- `etc.js` — Exposure Time Calculator tab; calls `etcSkyAutoFill()` on boot to pre-fill sky background from the DB via `/api/skydb/predict`
- `skymonitor.js` — Sky Monitor tab: log and visualise sky background measurements; exposes `initSkyMonitor()`
- `app.js` — boot sequence (`window.onload`), tab navigation, orchestrates module init order

**Boot order matters**: `loadPageTemplates()` must complete before any module's `init*` function is called, because templates inject the DOM nodes those functions reference.

### Reference hardware (Frasso Sabino)

- Camera: Moravian C3-26000M — Sony IMX571, 3.76 µm pixel, 51 000 e⁻ FWC (LCG), 16-bit ADC
- Telescope: 369 mm f/6.8, 2509 mm focal length → 0.309 arcsec/px at 1×1
- Zero-point (R filter): ZP = 20.4 mag @ 369 mm (calibrated on M67); scales as `ZP(D) = 20.4 + 5·log10(D/369)`

These values are the defaults in the ETC and SNR calculators; the user can override them in the UI.

## Key conventions

- RA is stored and passed in **decimal hours** (0–24); Dec in **decimal degrees** (−90 to +90).
- Sky background unit throughout is **e⁻/px/s** (electrons per pixel per second), not ADU.
- Filters supported by the DB: `B`, `V`, `R`, `I`, `rp`, `gp`.
- `source` field on `CatalogObject`: `"builtin"` for the hardcoded catalogue in JS, `"user"` for objects saved by the user, `"landolt50"`, `"messier"`, `"openngc_ngc"`, `"openngc_addendum"` for imported catalogues. The API exposes all of them for reading but creates/deletes only `"user"` rows.
