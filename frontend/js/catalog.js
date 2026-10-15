// ═══════════════════════════════════════════════════════════════
// catalog.js — Catalogo oggetti celesti (Messier + NGC scelti)
// source: "builtin" — oggetti utente aggiunti via API /catalog
// ═══════════════════════════════════════════════════════════════

const CATALOG=[
  {n:"M1",a:"NGC 1952",t:"Nebulosa",r:5.5753,d:22.0145},{n:"M2",a:"NGC 7089",t:"Ammasso gl.",r:21.5575,d:-0.8233},
  {n:"M3",a:"NGC 5272",t:"Ammasso gl.",r:13.7033,d:28.3775},{n:"M4",a:"NGC 6121",t:"Ammasso gl.",r:16.3933,d:-26.5253},
  {n:"M5",a:"NGC 5904",t:"Ammasso gl.",r:15.3097,d:2.0817},{n:"M8",a:"NGC 6523",t:"Nebulosa",r:18.0617,d:-24.3833},
  {n:"M11",a:"NGC 6705",t:"Ammasso ap.",r:18.8511,d:-6.2711},{n:"M13",a:"NGC 6205",t:"Ammasso gl.",r:16.6947,d:36.4617},
  {n:"M15",a:"NGC 7078",t:"Ammasso gl.",r:21.4997,d:12.1667},{n:"M16",a:"NGC 6611",t:"Nebulosa",r:18.3131,d:-13.7869},
  {n:"M17",a:"NGC 6618",t:"Nebulosa",r:18.3456,d:-16.1756},{n:"M20",a:"NGC 6514",t:"Nebulosa",r:18.0433,d:-23.0333},
  {n:"M27",a:"NGC 6853",t:"Neb. planet.",r:19.9944,d:22.7211},{n:"M31",a:"NGC 224",t:"Galassia",r:0.7122,d:41.2689},
  {n:"M33",a:"NGC 598",t:"Galassia",r:1.5644,d:30.66},{n:"M42",a:"NGC 1976",t:"Nebulosa",r:5.5881,d:-5.3911},
  {n:"M45",a:"Pleiadi",t:"Ammasso ap.",r:3.7911,d:24.1047},{n:"M51",a:"NGC 5194",t:"Galassia",r:13.4978,d:47.195},
  {n:"M57",a:"NGC 6720",t:"Neb. planet.",r:18.8928,d:33.0289},{n:"M63",a:"NGC 5055",t:"Galassia",r:13.2644,d:42.0292},
  {n:"M81",a:"NGC 3031",t:"Galassia",r:9.9256,d:69.0653},{n:"M82",a:"NGC 3034",t:"Galassia",r:9.9281,d:69.6797},
  {n:"M87",a:"NGC 4486",t:"Galassia",r:12.5136,d:12.3911},{n:"M101",a:"NGC 5457",t:"Galassia",r:14.0531,d:54.3492},
  {n:"M104",a:"NGC 4594",t:"Galassia",r:12.6664,d:-11.6231},{n:"NGC 7000",a:"N. America",t:"Nebulosa",r:20.9744,d:44.5333},
  {n:"NGC 6992",a:"E. Veil",t:"Nebulosa",r:20.9567,d:31.7167},{n:"NGC 891",a:"",t:"Galassia",r:2.3806,d:42.3492},
  {n:"NGC 4565",a:"Needle",t:"Galassia",r:12.6019,d:25.9878},{n:"IC 434",a:"Horsehead",t:"Nebulosa",r:5.6833,d:-2.4667},
  {n:"IC 1805",a:"Heart",t:"Nebulosa",r:2.5333,d:61.45},{n:"IC 1848",a:"Soul",t:"Nebulosa",r:2.85,d:60.4167},
  {n:"NGC 1499",a:"California",t:"Nebulosa",r:4.0536,d:36.7833},{n:"NGC 2244",a:"Rosetta",t:"Ammasso ap.",r:6.5389,d:4.95},
  {n:"NGC 7293",a:"Helix",t:"Neb. planet.",r:22.4939,d:-20.8369},{n:"NGC 6888",a:"Crescent",t:"Nebulosa",r:20.2019,d:38.3567},
  {n:"M35",a:"NGC 2168",t:"Ammasso ap.",r:6.1481,d:24.3381},{n:"M44",a:"NGC 2632",t:"Ammasso ap.",r:8.6731,d:19.9833},
  {n:"M92",a:"NGC 6341",t:"Ammasso gl.",r:17.2853,d:43.1358},{n:"NGC 869",a:"h Persei",t:"Ammasso ap.",r:2.3194,d:57.1333},
  {n:"NGC 884",a:"χ Persei",t:"Ammasso ap.",r:2.3733,d:57.1333},{n:"M74",a:"NGC 628",t:"Galassia",r:1.6111,d:15.7836},
  {n:"M77",a:"NGC 1068",t:"Galassia",r:2.7119,d:-0.0133},{n:"M97",a:"NGC 3587",t:"Neb. planet.",r:11.2469,d:55.0181},
  {n:"IC 5070",a:"Pelican",t:"Nebulosa",r:20.8406,d:44.3569},{n:"NGC 7331",a:"",t:"Galassia",r:22.6178,d:34.4158},
  {n:"M36",a:"NGC 1960",t:"Ammasso ap.",r:5.6011,d:34.1353},{n:"M37",a:"NGC 2099",t:"Ammasso ap.",r:5.8761,d:32.5528},
  {n:"HD 189733 b", a:"V452 Vul (Transito profondo)", t:"Esopianeta", r:20.0122, d:22.7106},
  {n:"HD 209458 b", a:"Osiris (Pegaso)", t:"Esopianeta", r:22.0525, d:18.8842},
  {n:"TrES-3 b", a:"Ercole (V=12.4)", t:"Esopianeta", r:17.8771, d:37.5463},
  {n:"WASP-12 b", a:"Auriga (Hot Jupiter)", t:"Esopianeta", r:6.5083, d:29.6722},
  {n:"WASP-43 b", a:"Sestante (Periodo breve)", t:"Esopianeta", r:10.3228, d:-9.8064},
  {n:"HAT-P-1 b", a:"Lucerta (Stella doppia)", t:"Esopianeta", r:22.9579, d:38.6766},
  {n:"HAT-P-32 b", a:"Andromeda (V=11.3)", t:"Esopianeta", r:2.1364, d:46.6859},
  {n:"Qatar-1 b", a:"Dragone (V=12.8)", t:"Esopianeta", r:20.2251, d:65.1613},
  {n:"XO-2 N b", a:"Lince (Binaria)", t:"Esopianeta", r:7.8005, d:50.2205},
  {n:"KELT-9 b", a:"Cigno (Pianeta caldissimo)", t:"Esopianeta", r:20.0535, d:39.9388},
  {n:"SA 32", a:"Landolt Field", t:"Standard Star", r:12.8710, d:44.6936},
  {n:"SA 35", a:"Landolt Field", t:"Standard Star", r:15.8743, d:44.7133},
  {n:"SA 38", a:"Landolt Field", t:"Standard Star", r:12.8201, d:45.2615},
  {n:"SA 41", a:"Landolt Field", t:"Standard Star", r:21.8048, d:45.3403},
  {n:"SA 95", a:"Landolt Field", t:"Standard Star", r:3.8967, d:28.5255},
  {n:"SA 98", a:"Landolt Field", t:"Standard Star", r:6.8681, d:28.4419},
  {n:"SA 101", a:"Landolt Field", t:"Standard Star", r:9.9392, d:28.2542},
  {n:"SA 104", a:"Landolt Field", t:"Standard Star", r:12.7118, d:28.1883},
  {n:"SA 107", a:"Landolt Field", t:"Standard Star", r:15.6558, d:28.3247},
  {n:"SA 111", a:"Landolt Field", t:"Standard Star", r:19.5806, d:20.0833},
  {n:"SA 114", a:"Landolt Field", t:"Standard Star", r:22.7486, d:20.0617},
  {n:"SA 32 SF1", a:"Landolt Field", t:"Standard Star", r:12.8710, d:44.6936},
  {n:"SA 32 SF2", a:"Landolt Field", t:"Standard Star", r:12.8778, d:44.8050},
  {n:"SA 35 SF1", a:"Landolt Field", t:"Standard Star", r:15.8743, d:44.7133},
  {n:"SA 35 SF4", a:"Landolt Field", t:"Standard Star", r:15.8742, d:44.7119},
  {n:"SA 38 SF1", a:"Landolt Field", t:"Standard Star", r:12.8201, d:45.2615},
  {n:"SA 38 SF2", a:"Landolt Field", t:"Standard Star", r:12.8244, d:45.2811},
  {n:"SA 41 SF1", a:"Landolt Field", t:"Standard Star", r:21.8048, d:45.3403},
  {n:"SA 95 SF1", a:"Landolt Field", t:"Standard Star", r:3.8967, d:28.5255},
  {n:"SA 98 SF1", a:"Landolt Field", t:"Standard Star", r:6.8681, d:28.4419},
  {n:"SA 101 SF1", a:"Landolt Field", t:"Standard Star", r:9.9392, d:28.2542},
  {n:"SA 104 SF1", a:"Landolt Field", t:"Standard Star", r:12.7118, d:28.1883},
  {n:"SA 107 SF1", a:"Landolt Field", t:"Standard Star", r:15.6558, d:28.3247},
  {n:"SA 111 SF1", a:"Landolt Field", t:"Standard Star", r:19.5806, d:20.0833},
  {n:"GD 71", a:"Landolt Field", t:"Standard Star", r:5.8744, d:33.0283},
  {n:"GD 153", a:"Landolt Field", t:"Standard Star", r:12.9439, d:22.0250},
  {n:"GD 190", a:"Landolt Field", t:"Standard Star", r:15.9542, d:47.3817},
  {n:"GD 246", a:"Landolt Field", t:"Standard Star", r:22.8203, d:24.9083},
  {n:"HZ 44", a:"Landolt Field", t:"Standard Star", r:13.3934, d:36.1361},
  {n:"BIS131", a:"Dragone", t:"Carbon Star", r:18.31881, d:63.01636},
  {n:"BIS007", a:"Camaleopardis", t:"Red Giant Star", r:4.30006, d:71.23194},
  {n:"BIS184", a:"Camaleopardis", t:"Carbon Star", r:6.0593, d:67.54997},
  {n:"BIS198", a:"Camaleopardis", t:"Long Period Variable", r:8.89085, d:68.12531},
  {n:"BIS196", a:"Camaleopardis", t:"Mira Variable", r:7.90744, d:65.3149015},
];

// Le funzioni astronomiche condivise sono in astro-utils.js.

// Oggetti utente: caricati da API al boot
// TODO: fetch /api/catalog/user → mergeUserCatalog()
let USER_CATALOG = [];

function getCatalog() {
  return [...CATALOG, ...USER_CATALOG];
}

// ── Catalogo utente via API ───────────────────────────────────────

// Normalizza un oggetto dal formato API {name, ra_h, dec_d, alias, obj_type}
// al formato builtin {n, r, d, a, t} usato da tutto il frontend.
// Conserva anche i campi originali per l'API (id, source, created_at).
function normalizeApiObject(o) {
  return {
    // campi frontend (compatibili con CATALOG builtin)
    n: o.name,
    r: o.ra_h,
    d: o.dec_d,
    a: o.alias  || '',
    t: o.obj_type || 'Oggetto utente',
    // campi extra dall'API (per delete, display badge utente)
    id:         o.id,
    source:     o.source || 'user',
    notes:      o.notes  || '',
    created_at: o.created_at,
  };
}

async function loadUserCatalog() {
  try {
    const resp = await fetch('/api/catalog/');
    if (!resp.ok) return;
    const raw = await resp.json();
    USER_CATALOG = raw.map(normalizeApiObject);
    console.log(`Catalogo utente: ${USER_CATALOG.length} oggetti caricati`);
  } catch(e) {
    // Silenzioso: API non ancora attiva
    console.debug('API catalogo non disponibile:', e.message);
  }
}

async function saveUserObject(obj) {
  const resp = await fetch('/api/catalog/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(obj)
  });
  if (resp.status === 409) throw new Error('Oggetto già presente nel catalogo');
  if (!resp.ok) throw new Error(`Errore server: ${resp.status}`);
  const raw = await resp.json();
  const saved = normalizeApiObject(raw);
  USER_CATALOG.push(saved);
  return saved;
}

async function deleteUserObject(id) {
  const resp = await fetch(`/api/catalog/${id}`, {method: 'DELETE'});
  if (!resp.ok) throw new Error(`Errore eliminazione: ${resp.status}`);
  USER_CATALOG = USER_CATALOG.filter(o => o.id !== id);
}
