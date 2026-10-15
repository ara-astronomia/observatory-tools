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
  const pages = ['staralt', 'snr', 'etc', 'settings', 'help'];
  await Promise.all(pages.map(async pid => {
    try {
      const resp = await fetch(`/static/templates/page-${pid}.html?v=20261015m`);
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
  // Carica i template HTML delle pagine
  await loadPageTemplates();

  // Ora che il DOM è popolato, carica la configurazione condivisa
  if (typeof settingsInit === 'function') settingsInit();
  const obsdate = document.getElementById('s-obsdate');
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:settingsGet().site.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  if (obsdate) obsdate.value = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  if (typeof initStarAltTimezone === 'function') initStarAltTimezone();

  // Sky Monitor: carica template e inizializza
  try {
    const smResp = await fetch('/static/templates/page-skymonitor.html?v=20261015m');
    if (smResp.ok) {
      document.getElementById('page-skymonitor').innerHTML = await smResp.text();
    }
  } catch(e) { console.warn('Template skymonitor non caricato:', e); }
  if (typeof settingsRenderBindings === 'function') settingsRenderBindings();
  if (typeof initSkyMonitor === 'function') await initSkyMonitor();

  // Inizializza form aggiungi oggetto
  if (typeof initAddObjectForm === 'function') initAddObjectForm();

  // Carica catalogo utente dall'API (silenzioso se non disponibile)
  if (typeof loadUserCatalog === 'function') await loadUserCatalog();

  // Inizializza SNR e le misure di calibrazione salvate nel browser
  if (typeof snrCalInit === 'function') snrCalInit();
  if (typeof snrUpdate === 'function') snrUpdate();

  // Tenta auto-fill sky nell'ETC (richiede DB popolato e airmass impostato)
  if (typeof etcSkyAutoFill === 'function') etcSkyAutoFill().then(() => {
    if (typeof etcCompute === 'function') etcCompute();
  });
};
