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
docker-compose down         # stop (DB persisted in named volume observatory_db)
docker-compose up --build   # rebuild after pyproject.toml/uv.lock changes
```

There is no test suite and no linter configured.

## Architecture

### Backend (`backend/`)

FastAPI app (`main.py`) that:
- Initialises the SQLite DB on startup via `init_db()`
- Mounts the entire `frontend/` directory as `/static`
- Serves `frontend/index.html` at `/`
- Exposes two router groups under `/api/`

**Data layer** (`db/database.py`): SQLAlchemy + SQLite at `backend/db/observatory.db`. Two ORM models:
- `CatalogObject` — user-defined celestial objects (name, RA in decimal hours, Dec in decimal degrees, type, notes)
- `SkyMeasurement` — sky background measurements (filter, sky in e⁻/px/s, airmass, moon conditions, seeing)

**Schemas** (`models/schemas.py`): Pydantic v2 models with `from_attributes = True` for ORM compatibility.

**Routers**:
- `catalog.py` — CRUD for user catalog objects; rejects duplicates by name (HTTP 409)
- `skydb.py` — CRUD for sky measurements + `GET /stats` (mean/median/std per filter, split by lunar phase) + `GET /predict` (inverse-distance-weighted estimate from stored measurements)

### Frontend (`frontend/`)

Vanilla JS SPA — no build step, no framework. `index.html` is the shell; page content is loaded at boot from `templates/page-*.html` via `fetch('/static/templates/...')`.

**JS module responsibilities** (all files are global scope, loaded in order via `<script>` tags):
- `astro-utils.js` — all astronomical math: JD, GMST, Alt/Az, Sun/Moon positions (Meeus ch.47), twilight search, angular distance
- `catalog.js` — built-in Messier/NGC catalogue + user catalogue via `/api/catalog`
- `staralt.js` — StarAlt tab: altitude/azimuth plot over the night
- `snr.js` — SNR Analyzer tab: signal-to-noise ratio calculation
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
- `source` field on `CatalogObject`: `"builtin"` for the hardcoded catalogue in JS, `"user"` for DB-backed objects. The API only exposes/modifies `"user"` rows.
