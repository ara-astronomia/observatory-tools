"""
routers/catalog.py — API catalogo oggetti utente
GET  /api/catalog        → lista oggetti utente
POST /api/catalog        → aggiungi nuovo oggetto
DELETE /api/catalog/{id} → elimina oggetto utente
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.db.database import get_db
from backend.db.database import CatalogObject as CatalogORM
from backend.models.schemas import CatalogObject, CatalogObjectCreate

router = APIRouter()


@router.get("/", response_model=List[CatalogObject])
def get_user_catalog(db: Session = Depends(get_db)):
    """Restituisce tutti gli oggetti aggiunti dall'utente."""
    return db.query(CatalogORM).filter(CatalogORM.source == "user").all()


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
