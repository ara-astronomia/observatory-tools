"""
Observatory Tools — FastAPI Backend
Frasso Sabino Observatory
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from backend.routers import catalog, skydb
from backend.db.database import init_db

app = FastAPI(
    title="Observatory Tools",
    description="Strumenti di pianificazione osservativa — Frasso Sabino",
    version="0.2.0",
)

# ── Init DB ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()

# ── Static frontend ───────────────────────────────────────────────
FRONTEND = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(FRONTEND / "index.html")

# ── Health check ──────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "observatory-tools", "version": "0.2.0"}

# ── Routers ───────────────────────────────────────────────────────
app.include_router(catalog.router, prefix="/api/catalog", tags=["catalog"])
app.include_router(skydb.router,   prefix="/api/skydb",   tags=["skydb"])
