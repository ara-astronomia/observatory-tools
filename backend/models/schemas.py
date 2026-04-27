"""
models/schemas.py — Pydantic models per validazione API
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ── Catalogo ─────────────────────────────────────────────────────

class CatalogObjectBase(BaseModel):
    name: str = Field(..., description="Nome principale es. 'M42'")
    alias: Optional[str] = Field(None, description="Nome alternativo es. 'Grande Nebulosa di Orione'")
    obj_type: Optional[str] = Field(None, description="Tipo es. 'Nebulosa', 'Galassia'")
    ra_h: float = Field(..., ge=0, lt=24, description="Ascensione retta in ore decimali")
    dec_d: float = Field(..., ge=-90, le=90, description="Declinazione in gradi decimali")
    notes: Optional[str] = Field(None, description="Note libere")

class CatalogObjectCreate(CatalogObjectBase):
    pass

class CatalogObject(CatalogObjectBase):
    id: int
    source: Literal["builtin", "user"] = "user"
    created_at: datetime

    class Config:
        from_attributes = True


# ── Sky Monitor ───────────────────────────────────────────────────

class SkyMeasurementBase(BaseModel):
    filter_name: Literal["B", "V", "R", "I", "rp", "gp"] = Field(..., description="Filtro fotometrico")
    sky_e: float = Field(..., gt=0, description="Fondo cielo in e⁻/px/s")
    airmass_obj: float = Field(..., ge=1.0, le=5.0, description="Airmass dell'oggetto")
    airmass_moon: Optional[float] = Field(None, ge=1.0, le=5.0, description="Airmass della Luna")
    moon_illum: float = Field(..., ge=0, le=100, description="Illuminazione Luna %")
    moon_dist: float = Field(..., ge=0, le=180, description="Distanza Luna dall'oggetto (gradi)")
    seeing: Optional[float] = Field(None, gt=0, description="Seeing FWHM in arcsec")
    notes: Optional[str] = None

class SkyMeasurementCreate(SkyMeasurementBase):
    observed_at: Optional[datetime] = Field(None, description="Data/ora osservazione (default: now)")

class SkyMeasurement(SkyMeasurementBase):
    id: int
    observed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
