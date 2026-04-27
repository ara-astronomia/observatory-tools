// ═══════════════════════════════════════════════════════════════
// app.js — Navigazione tra tab e inizializzazione
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.getElementById('btn-'+name).classList.add('active');
}

// ══════════════════════════════════════════════════════════════════
// SHARED ASTRONOMY UTILS

// boot: see loadPageTemplates() + window.onload below


// ── Caricamento template HTML delle pagine ────────────────────────
async function loadPageTemplates() {
  const pages = ['staralt', 'snr', 'etc', 'help'];
  await Promise.all(pages.map(async pid => {
    try {
      const resp = await fetch(`/static/templates/page-${pid}.html`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const html = await resp.text();
      document.getElementById(`page-${pid}`).innerHTML = html;
    } catch(e) {
      console.error(`Errore caricamento page-${pid}:`, e);
    }
  }));
}

// initSkyMonitor() è definita in skymonitor.js

// ── Boot ──────────────────────────────────────────────────────────
window.onload = async function() {
  // Imposta data di oggi
  const t = new Date();
  const dateStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;

  // Carica i template HTML delle pagine
  await loadPageTemplates();

  // Ora che il DOM è popolato, inizializza i moduli
  const obsdate = document.getElementById('s-obsdate');
  if (obsdate) obsdate.value = dateStr;

  // Sky Monitor: carica template e inizializza
  try {
    const smResp = await fetch('/static/templates/page-skymonitor.html');
    if (smResp.ok) {
      document.getElementById('page-skymonitor').innerHTML = await smResp.text();
    }
  } catch(e) { console.warn('Template skymonitor non caricato:', e); }
  if (typeof initSkyMonitor === 'function') await initSkyMonitor();

  // Inizializza form aggiungi oggetto
  if (typeof initAddObjectForm === 'function') initAddObjectForm();

  // Carica catalogo utente dall'API (silenzioso se non disponibile)
  if (typeof loadUserCatalog === 'function') await loadUserCatalog();

  // Inizializza SNR con valori di default
  if (typeof snrUpdate === 'function') snrUpdate();

  // Tenta auto-fill sky nell'ETC (richiede DB popolato e airmass impostato)
  if (typeof etcSkyAutoFill === 'function') etcSkyAutoFill().then(() => {
    if (typeof etcCompute === 'function') etcCompute();
  });
};
