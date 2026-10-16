"""API dei cataloghi StarAlt: oggetti locali, OpenNGC e ricerca."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, case
import re
from typing import List

from backend.db.database import get_db
from backend.db.database import CatalogObject as CatalogORM
from backend.models.schemas import CatalogObject, CatalogObjectBrief, CatalogObjectCreate

router = APIRouter()


@router.get("/", response_model=List[CatalogObject])
def get_catalog_objects(db: Session = Depends(get_db)):
    """Restituisce oggetti utente, Messier e standard Landolt per StarAlt."""
    return db.query(CatalogORM).filter(
        CatalogORM.source.in_(("user", "landolt50", "messier"))
    ).order_by(CatalogORM.id).all()


@router.get("/openngc", response_model=List[CatalogObjectBrief])
def get_openngc_objects(source: str = Query(pattern="^(ngc|addendum)$"), db: Session = Depends(get_db)):
    """Catalogo OpenNGC compatto, caricato solo quando StarAlt lo richiede."""
    selected = "openngc_ngc" if source == "ngc" else "openngc_addendum"
    return db.query(CatalogORM).filter(CatalogORM.source == selected).order_by(CatalogORM.id).all()


@router.get("/search", response_model=List[CatalogObjectBrief])
def search_openngc(q: str = Query(min_length=2, max_length=80),
                   limit: int = Query(default=30, ge=1, le=50),
                   db: Session = Depends(get_db)):
    """Ricerca NGC/IC e addendum senza caricare l'intero catalogo nel browser."""
    term = q.strip()
    if len(term) < 2:
        return []
    match = re.fullmatch(r"(NGC|IC|ESO|HCG|MWSC|Mel|PGC|UGC|Cl|B|C|H|M)\s*0*(\d+)(.*)", term, re.I)
    if match:
        prefix, number, suffix = match.groups()
        prefix = "Melotte" if prefix.lower() == "mel" else prefix.upper() if prefix.lower() != "cl" else "Cl"
        term = f"{prefix}{'' if prefix == 'M' else ' '}{int(number)}{suffix}"
    term = term.replace("%", "").replace("_", "").strip()
    if not term:
        return []
    starts = f"{term}%"
    alias_token = f"% · {term}%"
    exact = CatalogORM.name.ilike(term)
    return db.query(CatalogORM).filter(
        CatalogORM.source.in_(("openngc_ngc", "openngc_addendum")),
        or_(CatalogORM.name.ilike(starts),
            CatalogORM.alias.ilike(starts),
            CatalogORM.alias.ilike(alias_token),
            CatalogORM.obj_type.ilike(f"%{term}%")),
    ).order_by(case((exact, 0), (CatalogORM.name.ilike(starts), 1), else_=2), CatalogORM.name).limit(limit).all()



@router.post("/", response_model=CatalogObject, status_code=201)
def create_catalog_object(obj: CatalogObjectCreate, db: Session = Depends(get_db)):
    """Aggiunge un nuovo oggetto al catalogo utente."""
    # Controlla duplicati per nome
    existing = db.query(CatalogORM).filter(
        CatalogORM.name == obj.name,
        CatalogORM.source == "user"
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Oggetto '{obj.name}' già presente nel catalogo")

    db_obj = CatalogORM(
        name=obj.name,
        alias=obj.alias,
        obj_type=obj.obj_type,
        ra_h=obj.ra_h,
        dec_d=obj.dec_d,
        notes=obj.notes,
        source="user",
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.delete("/{obj_id}", status_code=204)
def delete_catalog_object(obj_id: int, db: Session = Depends(get_db)):
    """Elimina un oggetto utente dal catalogo."""
    obj = db.query(CatalogORM).filter(
        CatalogORM.id == obj_id,
        CatalogORM.source == "user"
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Oggetto non trovato")
    db.delete(obj)
    db.commit()
