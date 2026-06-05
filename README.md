# Observatory Tools — Frasso Sabino

Strumenti di pianificazione osservativa per l'osservatorio di Frasso Sabino.

## Struttura del progetto

```
observatory-tools/
├── Dockerfile
├── docker-compose.yml        ← sviluppo/build locale
├── docker-compose.prod.yml   ← produzione (usa immagine da registry)
├── pyproject.toml            ← dipendenze (uv)
│
├── backend/                  ← FastAPI + Python 3.13
│   ├── main.py               ← entry point, serve frontend statico
│   ├── routers/
│   │   ├── catalog.py        ← CRUD catalogo oggetti utente
│   │   └── skydb.py          ← CRUD + stats + predict fondo cielo
│   ├── models/
│   │   └── schemas.py        ← Pydantic models
│   └── db/
│       ├── database.py       ← SQLAlchemy + SQLite
│       └── observatory.db    ← DB di seed (incluso nel repo)
│
├── frontend/                 ← Vanilla JS, servito da FastAPI
│   ├── index.html            ← shell app
│   ├── css/
│   ├── js/
│   │   ├── astro-utils.js    ← JD, Alt/Az, Sole, Luna (Meeus)
│   │   ├── catalog.js        ← catalogo Messier/NGC + oggetti utente
│   │   ├── staralt.js        ← tab StarAlt
│   │   ├── snr.js            ← tab SNR Analyzer
│   │   ├── etc.js            ← tab ETC
│   │   ├── skymonitor.js     ← tab Sky Monitor
│   │   └── app.js            ← navigazione + boot
│   ├── templates/
│   └── icons/                ← icone SVG (favicon, Heimdall)
│
└── tests/                    ← pytest (18 test unitari)
    ├── conftest.py
    ├── test_health.py
    ├── test_catalog.py
    └── test_skydb.py
```

## Sviluppo locale

```bash
# Installa dipendenze (crea .venv con Python 3.13)
uv sync

# Avvia con hot-reload
uv run uvicorn backend.main:app --reload --port 8000
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger)

# Esegui i test
uv run pytest -v

# Aggiungi una dipendenza
uv add <pacchetto>
```

## Deploy

### Docker — build locale

```bash
docker-compose up -d        # build + avvio
docker-compose down         # stop
docker-compose up --build   # rebuild dopo modifiche
```

Il DB SQLite è montato come bind mount su `./tools/data/observatory.db` (crea la directory prima del primo avvio):

```bash
mkdir -p tools/data
```

### Docker — produzione

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Usa l'immagine `araroma/observatory-tools` pubblicata su Docker Hub dalla CI.

## CI/CD

| Workflow | Trigger | Cosa fa |
|---|---|---|
| `ci.yml` | ogni push e PR | esegue `pytest` su Python 3.13 |
| `docker-build.yml` | push su `main`, tag `v*`, label `build-docker` su PR | build multi-arch (`amd64` + `arm64`) e push su Docker Hub |

## API

Documentazione interattiva su `/docs` (Swagger) e `/redoc`.

```
GET  /api/health              → health check
GET  /api/catalog/            → catalogo oggetti utente
POST /api/catalog/            → aggiungi oggetto
DEL  /api/catalog/{id}        → elimina oggetto

GET  /api/skydb/              → misure fondo cielo
POST /api/skydb/              → aggiungi misura
GET  /api/skydb/stats         → statistiche per filtro e fase lunare
GET  /api/skydb/predict       → stima sky date le condizioni
DEL  /api/skydb/{id}          → elimina misura
```

La variabile d'ambiente `DB_PATH` sovrascrive il path del DB (default: `backend/db/observatory.db`).

## Camera di riferimento

**Moravian C3-26000M** — Sony IMX571 BSI  
Pixel: 3.76 µm · FWC: 51 000 e⁻ (LCG) · ADC: 16 bit

## Telescopio di riferimento

**369 mm f/6.8** → focale 2509 mm → plate scale 0.309 arcsec/px (1×1)  
Aggiornabile dai campi "Diametro" e "Rapporto focale" nell'ETC.

## Zero-point di riferimento (filtro R)

ZP = 20.4 mag @ 369 mm — calibrato su M67  
Il ZP scala automaticamente con il diametro: `ZP(D) = ZP_ref + 5·log10(D/369)`
