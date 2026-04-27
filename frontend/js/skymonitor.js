// ═══════════════════════════════════════════════════════════════
// skymonitor.js — Tab Sky Monitor
// DB fondo cielo per filtro, airmass, condizioni lunari
// API: /api/skydb  (FastAPI backend)
// ═══════════════════════════════════════════════════════════════

let skyData = [];
let skyChart = null;

const SKY_FILTERS = ['B','V','R','I','rp','gp'];
const FILTER_COLORS = {
  B:'#4a9eff', V:'#50e090', R:'#ff6060',
  I:'#e8d5a0', rp:'#ff9f50', gp:'#a78bfa'
};

// ── API ───────────────────────────────────────────────────────────

async function skyFetchAll() {
  try {
    const r = await fetch('/api/skydb/?limit=500');
    if (!r.ok) throw new Error(r.status);
    skyData = await r.json();
    return true;
  } catch(e) {
    console.warn('skydb API non disponibile:', e.message);
    skyData = [];
    return false;
  }
}

async function skyPost(payload) {
  const r = await fetch('/api/skydb/', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const err = await r.json().catch(()=>({}));
    throw new Error(err.detail || `Errore server: ${r.status}`);
  }
  return r.json();
}

async function skyPredict(filter, airmass, moonIllum, moonDist) {
  try {
    const p = new URLSearchParams({
      filter_name: filter,
      airmass: airmass.toFixed(3),
      moon_illum: moonIllum.toFixed(1),
      moon_dist: moonDist.toFixed(1)
    });
    const r = await fetch(`/api/skydb/predict?${p}`);
    if (!r.ok) return null;
    return r.json();
  } catch(e) { return null; }
}

// ── Importa da StarAlt ────────────────────────────────────────────

function skyImportFromStaralt() {
  if (staraltLastAlt === null) {
    skyShowFeedback('Calcola prima un oggetto in StarAlt', 'warn');
    return;
  }
  const alt = staraltLastAlt;
  const airmass = alt > 5 ? (1 / Math.cos((90 - alt) * D2R)) : null;

  const illumEl = document.querySelector('#s-moonGrid .moon-card:nth-child(2) .ic-val');
  const distEl  = document.querySelector('#s-moonGrid .moon-card:nth-child(3) .ic-val');
  const illum   = parseFloat(illumEl?.textContent);
  const dist    = parseFloat(distEl?.textContent);

  if (airmass) {
    const amEl = document.getElementById('sky-airmass');
    if (amEl) amEl.value = airmass.toFixed(3);
  }
  if (!isNaN(illum)) { const el=document.getElementById('sky-moon-illum'); if(el) el.value=illum.toFixed(1); }
  if (!isNaN(dist))  { const el=document.getElementById('sky-moon-dist');  if(el) el.value=dist.toFixed(1);  }

  skyShowFeedback('Valori importati da StarAlt ✓', 'ok');
}

// ── Salva misura ─────────────────────────────────────────────────

async function skySaveMeasurement() {
  const get = id => document.getElementById(id)?.value;
  const filter    = get('sky-filter');
  const sky_e     = parseFloat(get('sky-e'));
  const airmass   = parseFloat(get('sky-airmass'));
  const airMoon   = parseFloat(get('sky-airmass-moon'));
  const moonIllum = parseFloat(get('sky-moon-illum'));
  const moonDist  = parseFloat(get('sky-moon-dist'));
  const seeing    = parseFloat(get('sky-seeing'));
  const notes     = get('sky-notes')?.trim() || null;
  const obsDate   = get('sky-obs-date');
  const obsTime   = get('sky-obs-time');

  if (!filter || isNaN(sky_e) || sky_e <= 0)
    { skyShowFeedback('Filtro e fondo cielo obbligatori', 'err'); return; }
  if (isNaN(airmass) || airmass < 1)
    { skyShowFeedback('Airmass non valido (min 1.0)', 'err'); return; }
  if (isNaN(moonIllum) || isNaN(moonDist))
    { skyShowFeedback('Parametri Luna obbligatori', 'err'); return; }

  const observed_at = (obsDate && obsTime)
    ? new Date(`${obsDate}T${obsTime}:00`).toISOString()
    : null;

  skyShowFeedback('Salvataggio…', 'muted');
  try {
    const saved = await skyPost({
      filter_name: filter, sky_e, airmass_obj: airmass,
      airmass_moon: isNaN(airMoon) ? null : airMoon,
      moon_illum: moonIllum, moon_dist: moonDist,
      seeing: isNaN(seeing) ? null : seeing,
      notes, observed_at
    });
    skyData.unshift(saved);
    skyShowFeedback(`Misura id=${saved.id} salvata ✓`, 'ok');
    skyRenderTable();
    skyRenderChart();
    skyRenderStats();
    skyPushToETC(filter, sky_e);
  } catch(e) {
    skyShowFeedback(`✗ ${e.message}`, 'err');
  }
}

function skyShowFeedback(msg, type='muted') {
  const el = document.getElementById('sky-feedback');
  if (!el) return;
  const c = {ok:'var(--green)',err:'var(--red)',warn:'var(--gold)',muted:'var(--text2)'};
  el.style.color = c[type]||c.muted;
  el.textContent = msg;
}

function skyPushToETC(filter, sky_e) {
  const ef = document.getElementById('e-filter')?.value;
  const es = document.getElementById('e-sky');
  if (es && ef === filter) {
    es.value = sky_e.toFixed(3);
    if (typeof etcCompute === 'function') etcCompute();
  }
}

// ── Tabella ───────────────────────────────────────────────────────

function skyRenderTable() {
  const tbody = document.getElementById('sky-table-body');
  if (!tbody) return;
  const fSel = document.getElementById('sky-table-filter')?.value || 'all';
  const rows = fSel === 'all' ? skyData : skyData.filter(r => r.filter_name === fSel);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8"
      style="text-align:center;color:var(--text2);padding:20px;font-family:var(--mono);font-size:12px;">
      Nessuna misura${fSel !== 'all' ? ' per filtro '+fSel : ''}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.slice(0, 200).map(r => {
    const dt = r.observed_at
      ? new Date(r.observed_at).toLocaleString('it-IT',
          {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
      : '—';
    const moon = r.moon_illum < 10 ? '🌑' : r.moon_illum < 60 ? '🌓' : '🌕';
    return `<tr>
      <td style="color:${FILTER_COLORS[r.filter_name]||'var(--text)'};font-weight:700">${r.filter_name}</td>
      <td style="color:var(--accent2)">${r.sky_e.toFixed(3)}</td>
      <td>${r.airmass_obj.toFixed(3)}</td>
      <td>${moon} ${r.moon_illum.toFixed(0)}%</td>
      <td>${r.moon_dist.toFixed(1)}°</td>
      <td>${r.seeing ? r.seeing.toFixed(2)+'"' : '—'}</td>
      <td style="color:var(--text2);font-size:10px">${dt}</td>
      <td><button onclick="skyDeleteRow(${r.id})"
        style="background:none;border:none;color:var(--red);cursor:pointer;font-family:var(--mono);font-size:12px;">✕</button></td>
    </tr>`;
  }).join('');
}

async function skyDeleteRow(id) {
  if (!confirm('Eliminare questa misura?')) return;
  try {
    const r = await fetch(`/api/skydb/${id}`, {method:'DELETE'});
    if (!r.ok) throw new Error(r.status);
    skyData = skyData.filter(m => m.id !== id);
    skyRenderTable(); skyRenderChart(); skyRenderStats();
  } catch(e) { skyShowFeedback(`Errore: ${e.message}`, 'err'); }
}

// ── Grafico sky vs airmass ────────────────────────────────────────

function skyRenderChart() {
  const canvas = document.getElementById('sky-chart-canvas');
  if (!canvas) return;
  if (skyChart) { skyChart.destroy(); skyChart = null; }

  const fSel    = document.getElementById('sky-chart-filter')?.value || 'all';
  const moonSel = document.getElementById('sky-moon-filter')?.value  || 'all';

  const moonOk = r => {
    if (moonSel === 'dark')   return r.moon_illum < 10;
    if (moonSel === 'half')   return r.moon_illum >= 10 && r.moon_illum < 60;
    if (moonSel === 'bright') return r.moon_illum >= 60;
    return true;
  };

  const filters = fSel === 'all' ? SKY_FILTERS : [fSel];
  const datasets = filters.map(f => ({
    label: f,
    data: skyData.filter(r => r.filter_name === f && moonOk(r))
                 .map(r => ({x: r.airmass_obj, y: r.sky_e})),
    backgroundColor: (FILTER_COLORS[f]||'#888')+'bb',
    borderColor: FILTER_COLORS[f]||'#888',
    pointRadius: 5, pointHoverRadius: 8,
  })).filter(ds => ds.data.length > 0);

  if (!datasets.length) return;

  skyChart = new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color:'rgba(150,190,255,0.7)', font:{size:11,family:"'Space Mono',monospace"} }
        },
        tooltip: {
          callbacks: {
            label: item => {
              const r = skyData.find(m =>
                m.filter_name === item.dataset.label &&
                Math.abs(m.airmass_obj - item.raw.x) < 0.001
              );
              if (!r) return `${item.dataset.label}: X=${item.raw.x.toFixed(3)} sky=${item.raw.y.toFixed(3)}`;
              return [
                `${r.filter_name}  sky=${r.sky_e.toFixed(3)} e⁻/px/s`,
                `X=${r.airmass_obj.toFixed(3)}  ☽${r.moon_illum.toFixed(0)}%  ${r.moon_dist.toFixed(1)}°`,
                r.seeing ? `seeing=${r.seeing.toFixed(2)}"` : null
              ].filter(Boolean);
            }
          },
          backgroundColor:'rgba(6,10,20,0.97)',titleColor:'#7ec8ff',
          bodyColor:'#cce4ff',borderColor:'rgba(100,160,255,0.2)',borderWidth:0.5
        }
      },
      scales: {
        x: {
          title:{display:true,text:'Airmass X',color:'rgba(150,190,255,0.6)',font:{size:11}},
          grid:{color:'rgba(100,160,255,0.06)'},
          ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"}}
        },
        y: {
          title:{display:true,text:'Sky (e⁻/px/s)',color:'rgba(150,190,255,0.6)',font:{size:11}},
          grid:{color:'rgba(100,160,255,0.06)'},
          ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"}}
        }
      }
    }
  });
}

// ── Statistiche ───────────────────────────────────────────────────

function skyRenderStats() {
  const el = document.getElementById('sky-stats-container');
  if (!el) return;
  if (!skyData.length) {
    el.innerHTML = '<div style="color:var(--text2);font-family:var(--mono);font-size:12px;text-align:center;padding:16px;">Nessun dato</div>';
    return;
  }

  const st = arr => {
    if (!arr.length) return null;
    const n=arr.length, mean=arr.reduce((a,b)=>a+b,0)/n;
    const med=[...arr].sort((a,b)=>a-b)[Math.floor(n/2)];
    const std=Math.sqrt(arr.reduce((s,v)=>s+(v-mean)**2,0)/n);
    return {n, mean:mean.toFixed(3), med:med.toFixed(3), std:std.toFixed(3)};
  };
  const row = (icon,label,s) => !s ? '' :
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px solid var(--border);font-size:11px;font-family:var(--mono);">
      <span style="color:var(--text2)">${icon} ${label}</span>
      <span>μ=<span style="color:var(--accent2)">${s.mean}</span>
            med=<span style="color:var(--accent2)">${s.med}</span>
            σ=<span style="color:var(--text2)">${s.std}</span>
            <span style="color:var(--text2)">(n=${s.n})</span></span>
    </div>`;

  const filters = [...new Set(skyData.map(r=>r.filter_name))].sort();
  el.innerHTML = filters.map(f => {
    const fd = skyData.filter(r=>r.filter_name===f);
    return `<div style="background:var(--bg3);border:0.5px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
      <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:${FILTER_COLORS[f]||'var(--text)'};margin-bottom:6px;">
        Filtro ${f} — ${fd.length} misure
      </div>
      ${row('','Tutte le condizioni', st(fd.map(r=>r.sky_e)))}
      ${row('🌑','Luna assente (<10%)', st(fd.filter(r=>r.moon_illum<10).map(r=>r.sky_e)))}
      ${row('🌓','Mezza luna (10–60%)', st(fd.filter(r=>r.moon_illum>=10&&r.moon_illum<60).map(r=>r.sky_e)))}
      ${row('🌕','Luna piena (>60%)',  st(fd.filter(r=>r.moon_illum>=60).map(r=>r.sky_e)))}
    </div>`;
  }).join('') || '<div style="color:var(--text2);font-size:12px;font-family:var(--mono);">Nessun dato</div>';
}

// ── Predittore ────────────────────────────────────────────────────

async function skyRunPredict() {
  const get = id => document.getElementById(id)?.value;
  const filter  = get('sky-pred-filter');
  const airmass = parseFloat(get('sky-pred-airmass'));
  const illum   = parseFloat(get('sky-pred-illum'));
  const dist    = parseFloat(get('sky-pred-dist'));
  const out     = document.getElementById('sky-pred-result');
  if (!out) return;

  if (!filter||isNaN(airmass)||isNaN(illum)||isNaN(dist)) {
    out.innerHTML='<span style="color:var(--gold)">Compila tutti i campi</span>';
    return;
  }
  out.innerHTML='<span style="color:var(--text2)">Calcolo…</span>';
  const res = await skyPredict(filter, airmass, illum, dist);
  if (!res || res.sky_e === null) {
    out.innerHTML=`<span style="color:var(--gold)">${res?.message||'Dati insufficienti (< 3 misure)'}</span>`;
    return;
  }
  out.innerHTML=`
    <span style="color:var(--green);font-size:18px;font-weight:600;font-family:var(--mono)">${res.sky_e} e⁻/px/s</span>
    <span style="color:var(--text2);font-size:11px;font-family:var(--mono);margin-left:8px">(su ${res.n_used} misure)</span><br>
    <button onclick="skyApplyToETC('${filter}',${res.sky_e})" class="btn btn-sec"
      style="margin-top:8px;width:auto;padding:5px 16px;font-size:11px;">
      → Applica all'ETC (filtro ${filter})
    </button>`;
}

function skyApplyToETC(filter, sky_e) {
  const ef = document.getElementById('e-filter');
  const es = document.getElementById('e-sky');
  if (ef) ef.value = filter;
  if (es) es.value = sky_e.toFixed(3);
  if (typeof etcFilterChanged === 'function') etcFilterChanged();
  if (typeof etcCompute === 'function') etcCompute();
  if (typeof showPage === 'function') showPage('etc');
}

// ── Init ─────────────────────────────────────────────────────────

async function initSkyMonitor() {
  const page = document.getElementById('page-skymonitor');
  if (!page) return;

  const ok = await skyFetchAll();
  if (ok) {
    skyRenderTable();
    skyRenderChart();
    skyRenderStats();
  }

  // Event listeners sui selettori
  document.getElementById('sky-table-filter')?.addEventListener('change', skyRenderTable);
  document.getElementById('sky-chart-filter')?.addEventListener('change', skyRenderChart);
  document.getElementById('sky-moon-filter')?.addEventListener('change', skyRenderChart);
}
