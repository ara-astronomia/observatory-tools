# Provenienza dei cataloghi

## Landolt +50

`landolt-2013-plus50-vizier.tsv` è un estratto della tabella di standard
fotometrici di [Landolt (2013), *AJ* 146:131, catalogo CDS
J/AJ/146/131](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/146/131).
Conserva le 349 righe originali dell’estrazione; l’importatore seleziona le
335 stelle settentrionali e ne registra coordinate J2000, magnitudini UBVRI,
numero di misure e dati originali. Le 14 righe equatoriali restano nel TSV.

Per questo catalogo valgono le [condizioni d’uso di
VizieR](https://cds.unistra.fr/vizier-org/licences_vizier.html): uso scientifico
con citazione della pubblicazione originale e di CDS/VizieR; gli altri usi
dipendono dai diritti della fonte. Non attribuiamo ai dati Landolt la licenza
CC BY-SA di OpenNGC.

```bash
uv run python scripts/import_landolt50.py --dry-run
uv run python scripts/import_landolt50.py
```

L’importatore crea un backup SQLite e aggiorna le righe già presenti senza
duplicarle.

## Messier (M1–M110)

`messier-j2000.csv` contiene le coordinate equatoriali J2000, le identificazioni alternative e le classi dei 110 oggetti Messier. Le voci M1–M101 e M103–M110 sono un estratto trasformato dei file `NGC.csv` e `addendum.csv` di [OpenNGC](https://github.com/mattiaverga/OpenNGC), creato da Mattia Verga e distribuito con licenza [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Sono state selezionate le voci Messier, normalizzate le sigle NGC/IC e tradotte in italiano le classi degli oggetti. Le coordinate sono quelle pubblicate da OpenNGC.

M102 è associato a NGC 5866 (Spindle Galaxy), secondo la convenzione del [catalogo Messier di Kitt Peak/NOIRLab](https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/Messier/messier_catalog.html). La sua identificazione storica è controversa; OpenNGC lo considera una ripetizione di M101. Questa scelta mantiene 110 posizioni distinte per la pianificazione osservativa.

Per ricreare o aggiornare i dati nel database locale:

```bash
uv run python scripts/import_messier.py --dry-run
uv run python scripts/import_messier.py
```

Lo script valida tutte le 110 voci, crea un backup SQLite e aggiorna le righe già importate senza duplicarle.

## OpenNGC (NGC/IC e addendum)

`openngc/NGC.csv` e `openngc/addendum.csv` sono le copie integrali dei due file
[OpenNGC](https://github.com/mattiaverga/OpenNGC) forniti per l'importazione,
distribuiti con licenza [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Contengono rispettivamente 13.970 e 64 righe. Il primo file include sia NGC
sia IC; il secondo comprende ulteriori cataloghi e designazioni.

Lo script `scripts/import_openngc.py` conserva ogni colonna originale come JSON
nella tabella `openngc_records`, con riferimento alla riga importata in
`catalog` quando disponibile. Per StarAlt normalizza i nomi, conserva nomi
comuni e sigle Messier come alias, traduce i tipi e converte RA/Dec J2000 in
ore e gradi. Sono utilizzabili 13.371 oggetti. Le 663 righe non inserite in
`catalog` restano nei dati originali: duplicati, oggetti inesistenti e M40,
già presente nel catalogo Messier. Le esclusioni evitano puntamenti ambigui o
impossibili e un doppione nella lista.

Per ripetere l'importazione sul database locale:

```bash
uv run python scripts/import_openngc.py --dry-run
uv run python scripts/import_openngc.py
```

Il comando di importazione crea prima un backup del database e aggiorna le
righe OpenNGC già presenti senza duplicarle.

I file OpenNGC e il CSV Messier derivato sono distribuiti alle condizioni
indicate in [`OPENNGC-LICENSE.md`](OPENNGC-LICENSE.md). Il database SQLite è
generato localmente e non viene versionato.
