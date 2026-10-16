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
│   │   ├── catalog.py        ← oggetti utente, Messier, Landolt e OpenNGC
│   │   └── skydb.py          ← CRUD + stats + predict fondo cielo
│   ├── models/
│   │   └── schemas.py        ← Pydantic models
│   └── db/
│       └── database.py       ← SQLAlchemy + SQLite
│
├── frontend/                 ← Vanilla JS, servito da FastAPI
│   ├── index.html            ← shell app
│   ├── css/
│   ├── js/
│   │   ├── astro-utils.js    ← JD, Alt/Az, Sole, Luna (Meeus)
│   │   ├── catalog.js        ← cataloghi StarAlt e ricerca OpenNGC
│   │   ├── staralt.js        ← tab StarAlt
│   │   ├── snr.js            ← tab SNR Analyzer
│   │   ├── etc.js            ← tab ETC
│   │   ├── skymonitor.js     ← tab Sky Monitor
│   │   └── app.js            ← navigazione + boot
│   ├── templates/
│   └── icons/                ← icone SVG (favicon, Heimdall)
│
├── data/catalogs/           ← sorgenti testuali dei cataloghi
├── scripts/                 ← importatori ripetibili e seed iniziale
└── tests/                   ← 24 test Python e 2 test JavaScript
    ├── conftest.py
    ├── test_health.py
    ├── test_catalog.py
    ├── test_skydb.py
    ├── test_openngc.py
    ├── test_seed_catalogs.py
    └── test_catalog_identity.js
```

## Sviluppo locale

```bash
# Installa dipendenze (crea .venv con Python 3.13)
uv sync

# Avvia con hot-reload
uv run uvicorn backend.main:app --reload --port 8001
# → http://localhost:8001
# → http://localhost:8001/docs  (Swagger)

# Esegui i test
uv run pytest -v
node --test tests/test_catalog_identity.js

# Aggiungi una dipendenza
uv add <pacchetto>
```

## Deploy

### Docker — build locale

```bash
docker compose up -d        # build + avvio
docker compose down         # stop
docker compose up --build   # rebuild dopo modifiche
```

Il volume `./tools/data:/app/data` conserva il database SQLite e i backup.
Le sorgenti dei cataloghi sono incluse nell’immagine in `/app/catalogs`, fuori
dal volume. Al primo avvio l’app crea il database e importa i cataloghi; non è
necessario creare `tools/data` manualmente.

### Docker — produzione

```bash
docker compose -f docker-compose.prod.yml up -d
```

Usa l’immagine `araroma/observatory-tools:main` pubblicata su Docker Hub dalla
CI dopo i push sul branch `main`. Le modifiche di questa PR saranno disponibili
in tale immagine dopo il merge e la pubblicazione del nuovo build.

## CI/CD

| Workflow | Trigger | Cosa fa |
|---|---|---|
| `ci.yml` | ogni push e PR | esegue 24 test Python su Python 3.13 e 2 test JavaScript su Node 22 |
| `docker-build.yml` | push su `main`, tag `v*`, label `build-docker` su PR | build multi-arch (`amd64` + `arm64`) e push su Docker Hub |

## API

Documentazione interattiva su `/docs` (Swagger) e `/redoc`.

```
GET  /api/health              → health check
GET  /api/catalog/            → solo oggetti aggiunti dall’utente
GET  /api/catalog/staralt     → oggetti utente, Messier e Landolt +50
GET  /api/catalog/openngc?source=ngc|addendum → NGC/IC o addendum, su richiesta
GET  /api/catalog/search?q=M40             → ricerca Messier, Landolt, NGC/IC e addendum
POST /api/catalog/            → aggiungi oggetto
DEL  /api/catalog/{id}        → elimina oggetto

GET  /api/skydb/              → misure fondo cielo
POST /api/skydb/              → aggiungi misura
GET  /api/skydb/stats         → statistiche per filtro e fase lunare
GET  /api/skydb/predict       → stima sky date le condizioni
DEL  /api/skydb/{id}          → elimina misura
```

La variabile d’ambiente `DB_PATH` sovrascrive il path del DB (default locale:
`backend/db/observatory.db`; in Docker: `/app/data/observatory.db`). `CATALOG_DIR`
indica la directory delle sorgenti (default locale: `data/catalogs`; in Docker:
`/app/catalogs`). `BACKUP_DIR` indica la destinazione dei backup degli import.

## Camera di riferimento

La scheda **Impostazioni** concentra sito, ottica e camera per StarAlt, ETC, SNR Analyzer e Sky Monitor. La focale effettiva può essere modificata quando si installa un riduttore. Le impostazioni sono salvate nel browser e si possono esportare/importare come JSON. Le calibrazioni SNR e le misure Sky Monitor restano associate alla configurazione con cui sono state raccolte.

Valori iniziali della camera: **Moravian C3-26000M** — Sony IMX571 BSI.
Pixel: 3.76 µm · FWC: 52 800 e⁻ (0 dB) · ADC: 16 bit

## Telescopio di riferimento

**500 mm f/8** → focale 4000 mm → scala 0.194 arcsec/px (1×1).
Diametro e focale effettiva si aggiornano nella scheda Impostazioni.

## Zero-point di riferimento (filtro R)

Il valore predefinito dell'ETC è provvisorio: ZP_ref = 20.8 mag a 369 mm.
Scala con il diametro secondo la relazione ZP(D) = ZP_ref + 5·log10(D/369).
Per risultati quantitativi va sostituito con uno zero point misurato sulla
configurazione reale; il valore calibrato inserito nell'ETC è usato direttamente.

## Catalogo Landolt +50 in StarAlt

Il file `data/catalogs/landolt-2013-plus50-vizier.tsv` conserva le 349 righe
originali di [CDS J/AJ/146/131](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/146/131)
(Landolt 2013, *AJ* 146:131). Lo script importa solo le 335 stelle della
tabella settentrionale: le 14 stelle equatoriali sono escluse. L'importazione salva le
coordinate J2000 nella tabella `catalog` e le magnitudini UBVRI nella tabella
`landolt50_photometry`, assieme ai dati originali e al numero di misure.

```bash
uv run python scripts/import_landolt50.py --dry-run
uv run python scripts/import_landolt50.py
```

Lo script crea un backup in `backups/`, non modifica gli oggetti utente ed è
ripetibile senza duplicati. Le 242 stelle con almeno cinque misure sono marcate
come standard; 17 con quattro misure sono supplementari e 76 con tre o meno
misure sono candidate. Tutte restano ricercabili in StarAlt.

## Catalogo Messier in StarAlt

Il database generato localmente contiene tutti i 110 oggetti Messier, con coordinate J2000,
identificazioni alternative e tipo. StarAlt offre il filtro **Messier** nella lista
degli oggetti visibili; l’elenco scorre all’interno del riquadro. La visibilità
continua a dipendere dalla notte, dal sito e dall’altitudine minima scelti.

Per rigenerare le righe del database senza duplicati:

```bash
uv run python scripts/import_messier.py --dry-run
uv run python scripts/import_messier.py
```

Provenienza dei dati, licenza e scelta per M102 sono documentate in
[`data/catalogs/README.md`](data/catalogs/README.md).

## Catalogo NGC/IC e addendum in StarAlt

I file originali forniti sono conservati in `data/catalogs/openngc/`: `NGC.csv`
(13.970 righe, comprendente NGC e IC) e `addendum.csv` (64 righe). L’importazione locale conserva le 14.034 righe originali nella tabella
`openngc_records`; 13.371 oggetti con posizione valida e utilizzabili per il
puntamento sono anche nella tabella `catalog`. Le altre 663 righe, tra duplicati,
oggetti inesistenti e M40 già presente in Messier, restano consultabili come
dati originali, ma non compaiono nella lista di osservazione.

In StarAlt i filtri **NGC / IC + Addendum** e **Addendum** mostrano gli oggetti visibili
per la data, il sito, l'altitudine e la durata minima scelti. La prima voce
comprende entrambi i file; la seconda mostra solo l'addendum. **Tutti** li
include assieme agli altri cataloghi. Il catalogo esteso si carica solo quando
serve; la ricerca dell'oggetto interroga il database e la lista della notte
aggiunge righe durante lo scorrimento. La risposta dell’endpoint OpenNGC contiene
comunque tutte le voci della sorgente richiesta: lo scorrimento progressivo
riguarda la visualizzazione nel browser. Se il grafico è aperto, le modifiche
a data, fuso orario o altitudine minima aggiornano anche il calcolo del grafico.

Per validare e rigenerare l'importazione senza duplicati:

```bash
uv run python scripts/import_openngc.py --dry-run
uv run python scripts/import_openngc.py
```

Lo script esegue un backup SQLite in `backups/` prima di modificare il database.
Provenienza e licenza dei dati sono indicate in
[`data/catalogs/README.md`](data/catalogs/README.md).

### Database delle installazioni Docker

Il database SQLite non è versionato. Al primo avvio l'app crea il database nel
volume `tools/data/` e importa i cataloghi dai file di testo inclusi
nell’immagine, in `/app/catalogs`. Le installazioni esistenti mantengono oggetti
e misure utente. Chi aggiorna un checkout che versionava il vecchio database
deve conservare una copia del proprio file `backend/db/observatory.db` prima di
aggiornare e usare `tools/data/observatory.db` per il database Docker.
Per aggiornare i cataloghi di un database già in uso, ricrea l'immagine con i
nuovi CSV, poi esegui gli import nel container (che ha accesso in scrittura al
volume). I backup vengono salvati in `tools/data/backups/`:

```bash
docker compose up -d --build
docker compose exec -T observatory-tools python scripts/import_landolt50.py --dry-run
docker compose exec -T observatory-tools python scripts/import_messier.py --dry-run
docker compose exec -T observatory-tools python scripts/import_openngc.py --dry-run
docker compose exec -T observatory-tools python scripts/import_landolt50.py
docker compose exec -T observatory-tools python scripts/import_messier.py
docker compose exec -T observatory-tools python scripts/import_openngc.py
```

Per `docker-compose.prod.yml`, sostituisci `docker compose` con
`docker compose -f docker-compose.prod.yml`. In caso di aggiornamento dei CSV,
usa un'immagine di produzione che includa quei file aggiornati.
