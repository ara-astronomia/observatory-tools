// ═══════════════════════════════════════════════════════════════
// etc.js — Tab ETC: Exposure Time Calculator
// Gain presets IMX571, ZP fotometrico, airmass, apertura PSF
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════

// Stato condiviso StarAlt → ETC
let staraltLastAlt=null;
// {label, gainNum, ePerADU, rn, fwc}
// Aggiorna badge focale e ricalcola quando cambiano diametro/f-ratio
function etcOpticsChanged(){
  const d=+document.getElementById('e-diam').value||369;
  const f=+document.getElementById('e-fratio').value||6.8;
  const focal=Math.round(d*f);
  const es=document.getElementById('e-focal-shown');
  if(es) es.textContent=focal;
  const ns=document.getElementById('n-focal-shown');
  if(ns) ns.textContent=focal;
  etcCompute();
}

const GAIN_PRESETS=[
  {label:'G=0 · LCG',   gainNum:0,    ePerADU:0.80,  rn:3.51, fwc:52800},
  {label:'G=2749 · HCG',gainNum:2749, ePerADU:0.26,  rn:3.15, fwc:17000},
  {label:'G=2750 · HCG LN',gainNum:2750,ePerADU:0.26,rn:1.46, fwc:17000},
  {label:'G=4030 · HDR',gainNum:4030, ePerADU:0.012, rn:1.28, fwc:800},
];
let etcGainIdx=0;

// Parametri filtro: {k: estinzione mag/airmass, zpTheo: ZP teorico mag}
// La QE è già inglobata nel ZP calibrato — non entra nel calcolo.
// zp_teorico in e⁻/s/px per mag=0 (Vega), sistema setup Frasso Sabino 150mm f/5
// Derivato da: F0_Vega * QE * Area_eff * T_ottica / plate_scale²
// Area specchio 150mm: π*(75mm)²=17671mm²=176.71cm²
// T_ottica stimata ~0.75 (specchi + filtro)
// plate_scale 1×1: 0.301arcsec/px → px area = 0.0906arcsec²
// F0_Vega in fotoni/s/cm²/nm: B~1300, V~980, R~700, I~450 (appross.)
// ZP in mag per cui il sistema dà 1 e⁻/s in 1px — valore indicativo, va calibrato
const FILTER_PARAMS={
  B:  {qe_ref:55, k:0.25, zpTheo:19.8, label:'B (Johnson)'},
  V:  {qe_ref:80, k:0.15, zpTheo:20.5, label:'V (Johnson)'},
  R:  {qe_ref:91, k:0.10, zpTheo:20.8, label:'R (Cousins)'},
  I:  {qe_ref:75, k:0.07, zpTheo:20.2, label:'I (Cousins)'},
  rp: {qe_ref:89, k:0.10, zpTheo:20.7, label:"r' (Sloan)"},
  gp: {qe_ref:70, k:0.18, zpTheo:20.3, label:"g' (Sloan)"},
};

function etcSetGain(idx){
  etcGainIdx=idx;
  const g=GAIN_PRESETS[idx];
  document.getElementById('e-rn-auto').textContent=g.rn.toFixed(2);
  document.getElementById('e-fwc-auto').textContent=g.fwc.toLocaleString();
  document.getElementById('e-eadu-auto').textContent=g.ePerADU;
  document.getElementById('e-gain-num').textContent=g.gainNum;
  document.querySelectorAll('#e-gain-btns .gain-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));
  etcCompute();
}

function etcFilterChanged(){
  const f=document.getElementById('e-filter').value;
  const fp=FILTER_PARAMS[f];
  etcSkyAutoFill().then(() => etcCompute());
}

function etcAirmassFromAlt(){
  const alt=+document.getElementById('e-altdeg').value;
  if(alt>0&&alt<=90){
    const X=1/Math.cos((90-alt)*D2R);
    document.getElementById('e-airmass').value=X.toFixed(3);
  }
  etcSkyAutoFill().then(() => etcCompute());
}

// Importa altitudine corrente da StarAlt (se calcolato)
function etcImportFromStaralt(){
  if(staraltLastAlt===null){
    alert('Calcola prima un oggetto in StarAlt.');return;
  }
  document.getElementById('e-altdeg').value=staraltLastAlt.toFixed(1);
  etcAirmassFromAlt();
}

// ── Aggiornamento automatico sky dal DB ───────────────────────────
// Chiamata ogni volta che cambiano filtro, airmass o condizioni lunari.
// Se skyPredict() (definita in skymonitor.js) restituisce un valore,
// aggiorna il campo sky e ricalcola. Se il DB non ha dati sufficienti
// lascia il valore corrente invariato (non sovrascrive mai misure manuali
// se l'utente ha disabilitato l'auto-fill).

let skyAutoFillEnabled = true;   // toggle dall'utente

async function etcSkyAutoFill() {
  if (!skyAutoFillEnabled) return;
  if (typeof skyPredict !== 'function') return;

  const filter   = document.getElementById('e-filter')?.value;
  const airmass  = parseFloat(document.getElementById('e-airmass')?.value);
  const moonIllumEl = document.querySelector('#s-moonGrid .moon-card:nth-child(2) .ic-val');
  const moonDistEl  = document.querySelector('#s-moonGrid .moon-card:nth-child(3) .ic-val');
  const moonIllum   = parseFloat(moonIllumEl?.textContent) || 0;
  const moonDist    = parseFloat(moonDistEl?.textContent)  || 90;

  if (!filter || isNaN(airmass)) return;

  const result = await skyPredict(filter, airmass, moonIllum, moonDist);
  if (!result || result.sky_e === null) return;

  const skyEl = document.getElementById('e-sky');
  if (!skyEl) return;

  skyEl.value = result.sky_e.toFixed(3);

  // Mostra indicatore che il valore viene dal DB
  const indEl = document.getElementById('e-sky-source');
  if (indEl) {
    indEl.textContent = `← DB (${result.n_used} mis., filtro ${filter}, X=${airmass.toFixed(2)})`;
    indEl.style.color = 'var(--green)';
  }
}

function etcCompute(){
  const g=GAIN_PRESETS[etcGainIdx];
  const rn=g.rn;
  const fwc=g.fwc;
  const dc=+document.getElementById('e-dc').value;
  const sky=+document.getElementById('e-sky').value;
  const bin=+document.getElementById('e-bin').value;
  const mag=+document.getElementById('e-mag').value;
  const airmass=+document.getElementById('e-airmass').value;
  const seeing=+document.getElementById('e-seeing').value;
  const apFwhm=+document.getElementById('e-ap-fwhm').value;
  const snrStack=+document.getElementById('e-snr-stack').value;
  const tExpMax=+document.getElementById('e-texp-max').value;
  const nSub=+document.getElementById('e-nsub').value;
  const zpOverride=+document.getElementById('e-zp-override').value;
  const filtKey=document.getElementById('e-filter').value;
  const fp=FILTER_PARAMS[filtKey];

  // plate scale: 206265 * pixel_mm * bin / focal_mm (focale da diametro × f/)
  const focal=getFocal();
  const plateScale=206265*0.00376*bin/focal;

  // FWHM in pixel e apertura fotometrica
  const fwhmPx=seeing/plateScale;
  const apRadPx=apFwhm*fwhmPx;
  const npix=Math.round(Math.PI*apRadPx*apRadPx);

  document.getElementById('e-fwhm-px').textContent=fwhmPx.toFixed(1);
  document.getElementById('e-ap-px').textContent=apRadPx.toFixed(1);
  document.getElementById('e-npix-auto').textContent=npix;

  // Estinzione atmosferica
  const k=fp.k;
  const dMag=k*airmass;
  const magEff=mag+dMag;
  document.getElementById('e-k-shown').textContent=k.toFixed(2);
  document.getElementById('e-ext-shown').textContent='+'+dMag.toFixed(3)+' mag';

  // ZP base (calibrato su dRef=369mm). Scala con il diametro corrente:
  // ZP(D) = ZP_ref + 5*log10(D/D_ref)  [relazione area telescopio]
  const dRef=369; // diametro di riferimento della calibrazione ZP (mm)
  const diam=+document.getElementById('e-diam').value||369;
  const zpBase=zpOverride!==0?zpOverride:fp.zpTheo;
  const zpUsed=zpBase + 5*Math.log10(diam/dRef);
  document.getElementById('e-zp-shown').textContent=
    zpUsed.toFixed(3)+' (base '+zpBase.toFixed(2)+(Math.abs(diam-dRef)>0.5?' ΔD='+(zpUsed-zpBase>0?'+':'')+(zpUsed-zpBase).toFixed(3):'')+')';

  // Flusso totale stella [e⁻/s] — ZP scalato include la superficie raccoglitrice
  const S=Math.pow(10,(zpUsed-magEff)/2.5);
  document.getElementById('e-flux-est').textContent=S.toFixed(2);

  // Rumore nell'apertura
  const SKYtot=sky*bin*bin*npix;
  const DCtot=dc*bin*bin*npix;
  const RN2tot=rn*rn*npix;

  if(S<=0){
    document.getElementById('etc-no-result').style.display='block';
    document.getElementById('etc-no-result').textContent='Flusso nullo — controlla ZP e magnitudine.';
    document.getElementById('etc-result').style.display='none'; return;
  }

  // ── LOGICA PRINCIPALE ─────────────────────────────────────────
  // Domanda: qual è il tSub ottimale per raggiungere snrStack con N sub minimi?
  // Caso 1: il sub ottimale (1 sub = SNR_target) è ≤ tExpMax → usalo
  // Caso 2: il sub ottimale > tExpMax → usa tExpMax come vincolo e accumula N sub
  //
  // tSub_ottimale = tempo per cui 1 sub raggiunge snrStack (se non ci fosse il vincolo)
  // tSub_usato = min(tSub_ottimale, tExpMax)
  // N_necessari = ceil((snrStack / SNR_sub)²)

  function snrAt(t){return S*t/Math.sqrt(S*t+(SKYtot+DCtot)*t+RN2tot);}
  function tForSNR(snrT){
    const sn2=snrT*snrT, A=S*S, B=-sn2*(S+SKYtot+DCtot), C=-sn2*RN2tot;
    const disc=B*B-4*A*C;
    return disc>=0?(-B+Math.sqrt(disc))/(2*A):null;
  }

  const tOptimale=tForSNR(snrStack);
  const tSub=tOptimale!==null && tOptimale<=tExpMax ? tOptimale : tExpMax;
  const snrSub=snrAt(tSub);
  // epsilon per evitare ceil spurio da floating point (es. snrSub=577.99 vs snrStack=577)
  const nNeeded=Math.ceil(Math.pow(snrStack/snrSub,2)-1e-9);
  const tTotalNeeded=nNeeded*tSub;
  const snrConNVerifica=snrSub*Math.sqrt(nSub);
  const vincolato=tOptimale===null||tOptimale>tExpMax;

  // Saturazione: confronta segnale nel PIXEL DI PICCO della PSF con FWC
  // PSF gaussiana: f_picco = 1/(2π·σ_px²), σ_px = FWHM_px/2.355
  const sigPx=fwhmPx/2.355;
  const fPicco=1/(2*Math.PI*sigPx*sigPx);
  const sPiccoPerSub=S*fPicco*tSub;
  const satPct=sPiccoPerSub/fwc*100;
  const satWarn=satPct>90?`<span style="color:var(--red)">⚠ picco satura ${satPct.toFixed(0)}% FWC</span>`
                :satPct>60?`<span style="color:var(--gold)">${satPct.toFixed(0)}% FWC picco — attenzione</span>`
                :`<span style="color:var(--green)">${satPct.toFixed(0)}% FWC picco ✓</span>`;

  // Budget rumore
  const nSig=Math.sqrt(S*tSub), nSky=Math.sqrt(SKYtot*tSub);
  const nDark=Math.sqrt(DCtot*tSub), nRead=Math.sqrt(RN2tot);
  const nTot=Math.sqrt(nSig*nSig+nSky*nSky+nDark*nDark+nRead*nRead);
  const pSig=nSig/nTot*100, pSky=nSky/nTot*100, pDark=nDark/nTot*100, pRead=nRead/nTot*100;
  const regime=nSky>nRead*2?'sky-limited':'read-limited';

  function fmtT(s){if(s<120)return`${Math.round(s)}s`;if(s<3600)return`${Math.round(s/60)}′`;return`${(s/3600).toFixed(1)}h`;}
  function noiseBar(label,pct,color){return`<div class="noise-bar-wrap"><div class="noise-bar-label"><span>${label}</span><span>${pct.toFixed(1)}%</span></div><div class="noise-bar-track"><div class="noise-bar-fill" style="width:${Math.min(pct,100).toFixed(1)}%;background:${color}"></div></div></div>`;}

  // Card 1: tSub
  document.getElementById('e-res-sub').textContent=Math.round(tSub);
  document.getElementById('e-res-sub-snr').innerHTML=
    `SNR/sub: ${snrSub.toFixed(0)}<br>${satWarn}`+
    (vincolato?`<br><span style="color:var(--gold)">⚠ vincolato da tExpMax</span>`:'');

  // Card 2: N sub necessari per SNR target
  document.getElementById('e-res-nsub').textContent=nNeeded;
  document.getElementById('e-res-total-sub').innerHTML=
    `${fmtT(tTotalNeeded)} totali<br>SNR stack: ${(snrSub*Math.sqrt(nNeeded)).toFixed(0)}`;

  // Card 3: SNR con N verifica
  document.getElementById('e-res-snr-nsub').textContent=Math.round(snrConNVerifica);
  document.getElementById('e-res-nsub-detail').innerHTML=
    `${nSub} sub × ${Math.round(tSub)}s<br>${fmtT(nSub*tSub)} totali`+
    (snrConNVerifica>=snrStack
      ?`<br><span style="color:var(--green)">✓ target raggiunto</span>`
      :`<br><span style="color:var(--gold)">mancano ${nNeeded-nSub} sub</span>`);

  document.getElementById('e-noise-bars').innerHTML=
    noiseBar('Segnale stella (Poisson)',pSig,'#4a9eff')+
    noiseBar('Fondo cielo (sky)',pSky,'#f0c060')+
    noiseBar('Dark current',pDark,'rgba(150,190,255,0.35)')+
    noiseBar('Lettura (σ_r)',pRead,'#ff6060');

  document.getElementById('e-breakdown').innerHTML=`
    <div class="etc-row"><span class="etc-row-label">Filtro</span><span class="etc-row-val">${fp.label}</span></div>
    <div class="etc-row"><span class="etc-row-label">Gain</span><span class="etc-row-val">${g.label} · σ_r=${g.rn} e⁻ · FWC=${g.fwc.toLocaleString()} e⁻</span></div>
    <div class="etc-row"><span class="etc-row-label">mag → mag_eff</span><span class="etc-row-val">${mag.toFixed(2)} + ${dMag.toFixed(3)} (k·X) = ${magEff.toFixed(3)}</span></div>
    <div class="etc-row"><span class="etc-row-label">Flusso stella S</span><span class="etc-row-val">${S.toFixed(1)} e⁻/s · ZP=${zpUsed.toFixed(3)} (${diam}mm, ref ${dRef}mm)</span></div>
    <div class="etc-row"><span class="etc-row-label">Apertura</span><span class="etc-row-val">r=${apRadPx.toFixed(1)} px · N=${npix} px · FWHM=${fwhmPx.toFixed(1)} px</span></div>
    <div class="etc-row"><span class="etc-row-label">Plate scale</span><span class="etc-row-val">${plateScale.toFixed(4)} arcsec/px (${bin}×${bin}) · focale ${focal}mm</span></div>
    <div class="etc-row"><span class="etc-row-label">Regime</span><span class="etc-row-val" style="color:${regime==='sky-limited'?'var(--green)':'var(--red)'}">${regime}</span></div>
    <div class="etc-row"><span class="etc-row-label">Segnale totale sub</span><span class="etc-row-val">${(S*tSub).toFixed(0)} e⁻ (apertura intera)</span></div>
    <div class="etc-row"><span class="etc-row-label">Segnale pixel picco</span><span class="etc-row-val">${sPiccoPerSub.toFixed(0)} e⁻ — ${satPct.toFixed(1)}% FWC</span></div>
    <div class="etc-row"><span class="etc-row-label">tSub ottimale (no vincolo)</span><span class="etc-row-val">${tOptimale!==null?fmtT(tOptimale):'> tExpMax'}</span></div>
    <div class="etc-row"><span class="etc-row-label">tSub usato</span><span class="etc-row-val">${Math.round(tSub)}s ${vincolato?'(vincolato da tExpMax)':'(ottimale)'}</span></div>`;

  document.getElementById('e-stack-info').innerHTML=
    `<div class="stack-title">Riepilogo sessione</div>`+
    `SNR target finale: <strong>${snrStack}</strong> &nbsp;·&nbsp; `+
    `Sub necessari: <strong>${nNeeded}</strong> × ${Math.round(tSub)}s = <strong>${fmtT(tTotalNeeded)}</strong><br>`+
    (zpOverride===0?'<span style="font-size:10px;color:var(--text2)">ZP teorico non calibrato — risultati indicativi. Calibra con stelle Landolt.</span>':
    '<span style="font-size:10px;color:var(--green)">✓ ZP calibrato da osservazione reale.</span>');

  document.getElementById('etc-no-result').style.display='none';
  document.getElementById('etc-result').style.display='block';
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════