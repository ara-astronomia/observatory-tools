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
def get_user_catalog(db: Session = Depends(get_db)):
    """Mantiene il contratto originale: solo oggetti aggiunti dall'utente."""
    return db.query(CatalogORM).filter(CatalogORM.source == "user").order_by(CatalogORM.id).all()


@router.get("/staralt", response_model=List[CatalogObject])
def get_staralt_catalog(db: Session = Depends(get_db)):
    """Catalogo piccolo usato all'avvio di StarAlt."""
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
    """Ricerca nei cataloghi importati senza caricare OpenNGC nel browser."""
    term = q.strip()
    if len(term) < 2:
        return []
    match = re.fullmatch(r"(NGC|IC|ESO|HCG|MWSC|Mel|PGC|UGC|Cl|B|C|H|M)\s*0*(\d+)(.*)", term, re.I)
    if match:
        prefix, number, suffix = match.groups()
        prefix = "Melotte" if prefix.lower() == "mel" else prefix.upper() if prefix.lower() != "cl" else "Cl"
        number, suffix, gap = int(number), suffix.strip(), "" if prefix == "M" else " "
        # OpenNGC keeps letter suffixes attached (IC 186A) and NED ones spaced (IC 186 NED03).
        terms = [f"{prefix}{gap}{number}{suffix}"]
        if suffix and gap:
            terms.append(f"{prefix}{gap}{number} {suffix}")
    else:
        terms = [term]
    terms = [t.replace("%", "").replace("_", "").strip() for t in terms]
    terms = [t for t in terms if t]
    if not terms:
        return []
    starts = [f"{t}%" for t in terms]
    # Le designazioni (C9, M1) cercano l'alias solo per prefisso, così "C 9" non trova "IC 9";
    # i nomi comuni anche a metà alias ("Veil" → "Eastern Veil").
    alias = starts if match else [f"%{terms[0]}%"]
    exact = or_(*[CatalogORM.name.ilike(t) for t in terms])
    prefix_match = or_(*[CatalogORM.name.ilike(s) for s in starts])
    return db.query(CatalogORM).filter(
        CatalogORM.source.in_(("landolt50", "messier", "openngc_ngc", "openngc_addendum")),
        or_(prefix_match,
            or_(*[CatalogORM.alias.ilike(a) for a in alias]),
            CatalogORM.obj_type.ilike(f"%{terms[0]}%")),
    ).order_by(case((exact, 0), (prefix_match, 1), else_=2), CatalogORM.name).limit(limit).all()



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
