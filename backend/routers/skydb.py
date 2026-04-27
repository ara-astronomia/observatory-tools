"""
routers/skydb.py — API Sky Monitor
GET  /api/skydb              → lista misure (con filtri opzionali)
POST /api/skydb              → aggiungi misura
GET  /api/skydb/stats        → statistiche per filtro e condizioni lunari
GET  /api/skydb/predict      → stima fondo cielo date le condizioni
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone
import math

from backend.db.database import get_db
from backend.db.database import SkyMeasurement as SkyORM
from backend.models.schemas import SkyMeasurement, SkyMeasurementCreate

router = APIRouter()


@router.get("/", response_model=List[SkyMeasurement])
def get_measurements(
    filter_name: Optional[str] = Query(None, description="Filtra per filtro es. 'R'"),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    q = db.query(SkyORM)
    if filter_name:
        q = q.filter(SkyORM.filter_name == filter_name)
    return q.order_by(SkyORM.observed_at.desc()).limit(limit).all()


@router.post("/", response_model=SkyMeasurement, status_code=201)
def add_measurement(m: SkyMeasurementCreate, db: Session = Depends(get_db)):
    db_m = SkyORM(
        filter_name  = m.filter_name,
        sky_e        = m.sky_e,
        airmass_obj  = m.airmass_obj,
        airmass_moon = m.airmass_moon,
        moon_illum   = m.moon_illum,
        moon_dist    = m.moon_dist,
        seeing       = m.seeing,
        notes        = m.notes,
        observed_at  = m.observed_at or datetime.now(timezone.utc),
    )
    db.add(db_m)
    db.commit()
    db.refresh(db_m)
    return db_m


@router.get("/stats")
def get_stats(
    filter_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Statistiche per filtro:
    - sky medio, mediano, std
    - separato per condizione lunare (assente <10%, quarto 10-60%, piena >60%)
    """
    q = db.query(SkyORM)
    if filter_name:
        q = q.filter(SkyORM.filter_name == filter_name)

    rows = q.all()
    if not rows:
        return {"count": 0, "filters": {}}

    def stats(values):
        if not values: return None
        n = len(values)
        mean = sum(values) / n
        median = sorted(values)[n // 2]
        std = math.sqrt(sum((v - mean)**2 for v in values) / n) if n > 1 else 0
        return {"n": n, "mean": round(mean, 3), "median": round(median, 3), "std": round(std, 3)}

    result = {}
    filters = set(r.filter_name for r in rows)
    for f in filters:
        frows = [r for r in rows if r.filter_name == f]
        result[f] = {
            "all":        stats([r.sky_e for r in frows]),
            "no_moon":    stats([r.sky_e for r in frows if r.moon_illum < 10]),
            "half_moon":  stats([r.sky_e for r in frows if 10 <= r.moon_illum < 60]),
            "full_moon":  stats([r.sky_e for r in frows if r.moon_illum >= 60]),
        }

    return {"count": len(rows), "filters": result}


@router.get("/predict")
def predict_sky(
    filter_name: str = Query(...),
    airmass: float = Query(..., ge=1.0, le=5.0),
    moon_illum: float = Query(..., ge=0, le=100),
    moon_dist: float = Query(..., ge=0, le=180),
    db: Session = Depends(get_db)
):
    """
    Stima il fondo cielo nelle condizioni date usando la media ponderata
    delle misure più simili nel DB.
    Restituisce None se il DB non ha abbastanza dati (< 3 misure).
    """
    rows = db.query(SkyORM).filter(SkyORM.filter_name == filter_name).all()
    if len(rows) < 3:
        return {"sky_e": None, "n_used": len(rows), "message": "Dati insufficienti (< 3 misure)"}

    # Distanza euclidea normalizzata nello spazio (airmass, moon_illum, moon_dist)
    def dist(r):
        da = (r.airmass_obj - airmass) / 2.0
        dm = (r.moon_illum - moon_illum) / 100.0
        dd = (r.moon_dist - moon_dist) / 180.0
        return math.sqrt(da**2 + dm**2 + dd**2)

    weighted = [(1 / (dist(r) + 0.01), r.sky_e) for r in rows]
    total_w = sum(w for w, _ in weighted)
    sky_pred = sum(w * v for w, v in weighted) / total_w

    return {
        "sky_e": round(sky_pred, 3),
        "n_used": len(rows),
        "filter": filter_name,
        "conditions": {"airmass": airmass, "moon_illum": moon_illum, "moon_dist": moon_dist}
    }


@router.delete("/{measurement_id}", status_code=204)
def delete_measurement(measurement_id: int, db: Session = Depends(get_db)):
    """Elimina una misura dal DB."""
    m = db.query(SkyORM).filter(SkyORM.id == measurement_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Misura non trovata")
    db.delete(m)
    db.commit()
