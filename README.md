# Observatory Tools — Frasso Sabino

Strumenti di pianificazione osservativa per l'osservatorio di Frasso Sabino.

## Struttura del progetto

```
observatory-tools/
├── Dockerfile
├── docker-compose.yml
├── README.md
│
├── backend/                    ← FastAPI
│   ├── main.py                 ← entry point, serve frontend statico
│   ├── requirements.txt
│   ├── routers/
│   │   ├── catalog.py          ← CRUD catalogo oggetti utente
│   │   └── skydb.py            ← CRUD + stats fondo cielo
│   ├── models/
│   │   └── schemas.py          ← Pydantic models
│   └── db/
│       └── database.py         ← SQLAlchemy + SQLite
│
└── frontend/                   ← Vanilla JS, servito da FastAPI
    ├── index.html              ← shell app
    ├── css/
    │   └── main.css
    ├── js/
    │   ├── astro-utils.js      ← JD, Alt/Az, Sole, Luna (Meeus)
    │   ├── catalog.js          ← catalogo Messier/NGC + oggetti utente
    │   ├── staralt.js          ← tab StarAlt
    │   ├── snr.js              ← tab SNR Analyzer
    │   ├── etc.js              ← tab ETC
    │   ├── skymonitor.js       ← tab Sky Monitor (Step 3)
    │   └── app.js              ← navigazione + boot
    └── templates/
        ├── page-staralt.html
        ├── page-snr.html
        └── page-etc.html
```

## Roadmap

| Step | Stato | Descrizione |
|------|-------|-------------|
| 1 | ✅ | Refactor frontend in file separati |
| 2 | ✅ | Scheletro FastAPI + Docker |
| 3 | 🔜 | Sky Monitor DB (misure fondo cielo) |
| 4 | 🔜 | Catalogo utente via API attiva |
| 5 | 🔜 | Integrazione ETC ← sky medio dal DB |

## Deploy

### Sviluppo locale

```bash
cd observatory-tools
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
# → http://localhost:8000
```

### Docker

```bash
docker-compose up -d
# → http://localhost:8000
```

### Heimdall

Aggiungere nel portale Heimdall con URL `http://<host>:8000`.
Le label nel `docker-compose.yml` configurano automaticamente nome e icona.

## API

Documentazione interattiva disponibile su `/docs` (Swagger) e `/redoc`.

```
GET  /api/health              → health check
GET  /api/catalog/            → catalogo oggetti utente
POST /api/catalog/            → aggiungi oggetto
DEL  /api/catalog/{id}        → elimina oggetto

GET  /api/skydb/              → misure fondo cielo
POST /api/skydb/              → aggiungi misura
GET  /api/skydb/stats         → statistiche per filtro
GET  /api/skydb/predict       → stima sky date le condizioni
```

## Camera di riferimento

**Moravian C3-26000M** — Sony IMX571 BSI  
Pixel: 3.76 µm · FWC: 51 000 e⁻ (LCG) · ADC: 16 bit

## Telescopio di riferimento

**369 mm f/6.8** → focale 2509 mm → plate scale 0.309 arcsec/px (1×1)  
Aggiornabile dai campi "Diametro" e "Rapporto focale" nell'ETC.

## Zero-point di riferimento (filtro R)

ZP = 20.4 mag @ 369 mm — calibrato su M67  
Il ZP scala automaticamente con il diametro: `ZP(D) = ZP_ref + 5·log10(D/369)`
