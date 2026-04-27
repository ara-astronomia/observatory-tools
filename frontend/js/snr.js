// ═══════════════════════════════════════════════════════════════
// snr.js — Tab SNR Analyzer: binning, campionamento, saturazione
// Camera: Moravian C3-26000M / Sony IMX571
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
const FWC=51000,ADC_MAX=65535,PIXEL_MM=0.00376,SEEING_MIN=2.5,SEEING_MAX=3.0;
// Focale dinamica: letta dai campi ETC se disponibili, altrimenti default 2509mm
function getFocal(){
  const d=+document.getElementById('e-diam')?.value||369;
  const f=+document.getElementById('e-fratio')?.value||6.8;
  return Math.round(d*f);
}
let snrCharts={};
let curSnrTab='snr';

function snrTab(name){
  ['snr','sampling','sat','strategy'].forEach(t=>{
    document.getElementById('snr-tab-'+t).style.display=t===name?'':'none';
  });
  document.querySelectorAll('.snr-tab').forEach((b,i)=>b.classList.toggle('active',['snr','sampling','sat','strategy'][i]===name));
  curSnrTab=name;
  snrUpdate();
}

function snrGetP(){
  return{sig:+document.getElementById('n-sig').value,sky:+document.getElementById('n-sky').value,rn:+document.getElementById('n-rn').value,dc:+document.getElementById('n-dc').value,t:+document.getElementById('n-exp').value,staradu:+document.getElementById('n-staradu').value};
}
function snrHW(n,p){const S=p.sig*n*n*p.t;return S/Math.sqrt(S+p.sky*n*n*p.t+p.dc*n*n*p.t+p.rn*p.rn);}
function snrSW(n,p){const S=p.sig*n*n*p.t;return S/Math.sqrt(S+p.sky*n*n*p.t+p.dc*n*n*p.t+n*n*p.rn*p.rn);}
function snrHW2SW(sw,p){const N=2*sw,S=p.sig*N*N*p.t;return S/Math.sqrt(S+p.sky*N*N*p.t+p.dc*N*N*p.t+sw*sw*p.rn*p.rn);}
function plate(n){return 206265*PIXEL_MM*n/getFocal();}
function mkChart(id,labels,datasets,opts){
  if(snrCharts[id])snrCharts[id].destroy();
  const ctx=document.getElementById(id);if(!ctx)return;
  snrCharts[id]=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:250},plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(100,160,255,0.06)'},ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"}}},y:{grid:{color:'rgba(100,160,255,0.06)'},ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"},callback:opts.yCb||undefined},title:{display:!!opts.yl,text:opts.yl||'',color:'rgba(150,190,255,0.5)',font:{size:10}}}}}});
}
function mkBarChart(id,labels,datasets){
  if(snrCharts[id])snrCharts[id].destroy();
  const ctx=document.getElementById(id);if(!ctx)return;
  snrCharts[id]=new Chart(ctx,{type:'bar',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:250},plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(100,160,255,0.06)'},ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"}}},y:{grid:{color:'rgba(100,160,255,0.06)'},ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"}}}}}});
}

function snrUpdate(){
  const p=snrGetP();
  document.getElementById('n-sig-v').textContent=p.sig;
  document.getElementById('n-sky-v').textContent=p.sky;
  document.getElementById('n-rn-v').textContent=p.rn.toFixed(1);
  document.getElementById('n-dc-v').textContent=p.dc.toFixed(1);
  document.getElementById('n-exp-v').textContent=p.t;
  document.getElementById('n-staradu-v').textContent=p.staradu.toLocaleString();

  const tEq=(p.rn*p.rn)/p.sky;
  const regime=p.t>5*tEq?'sky-limited':p.t<0.5*tEq?'read-limited':'misto';

  if(curSnrTab==='snr'){
    const labels=['1×1 HW','2×2 HW','HW2+SW2','2×2 SW','3×3 SW','4×4 SW'];
    const vals=[snrHW(1,p),snrHW(2,p),snrHW2SW(2,p),snrSW(2,p),snrSW(3,p),snrSW(4,p)];
    const colors=['rgba(74,158,255,0.7)','rgba(74,158,255,0.7)','rgba(80,224,144,0.75)','rgba(216,90,48,0.65)','rgba(216,90,48,0.65)','rgba(216,90,48,0.65)'];
    mkBarChart('n-snr-chart',labels,[{data:vals,backgroundColor:colors,borderRadius:4,borderWidth:0}]);
    document.getElementById('n-snr-cards').innerHTML=`
      <div class="metric-card"><div class="mc-label">t_eq (pareggio)</div><div class="mc-val">${tEq.toFixed(2)}s</div><div class="mc-sub">σ²_r / sky</div></div>
      <div class="metric-card"><div class="mc-label">Regime</div><div class="mc-val" style="font-size:13px;color:${regime==='sky-limited'?'var(--green)':regime==='read-limited'?'var(--red)':'var(--gold)'}">${regime}</div><div class="mc-sub">t=${p.t}s</div></div>
      <div class="metric-card"><div class="mc-label">SNR 1×1 HW</div><div class="mc-val">${snrHW(1,p).toFixed(1)}</div><div class="mc-sub">base</div></div>
      <div class="metric-card"><div class="mc-label">HW2×2+SW2×2</div><div class="mc-val ok">+${((snrHW2SW(2,p)/snrSW(4,p)-1)*100).toFixed(1)}%</div><div class="mc-sub">vs SW4×4 puro</div></div>`;
    document.getElementById('n-regime-info').innerHTML=`Regime: <span style="color:${regime==='sky-limited'?'var(--green)':regime==='read-limited'?'var(--red)':'var(--gold)'}">${regime}</span>. Il binning HW 2×2 + SW 2×2 supera il SW 4×4 puro di <span class="ok">+${((snrHW2SW(2,p)/snrSW(4,p)-1)*100).toFixed(1)}%</span> sull'SNR — vantaggio più marcato con σ_r alto o esposizioni brevi.`;
  }

  if(curSnrTab==='sampling'){
    const bins=[1,2,4,6,8];
    const scales=bins.map(n=>plate(n));
    const nyqLo=SEEING_MIN/2,nyqHi=SEEING_MAX/2,optLo=SEEING_MIN/3,optHi=SEEING_MAX/3;
    mkChart('n-samp-chart',bins.map(n=>n+'×'+n),[
      {data:scales,borderColor:'#4a9eff',backgroundColor:'rgba(74,158,255,0.1)',tension:0.3,pointRadius:5,fill:false,borderWidth:2},
      {data:bins.map(()=>nyqLo),borderColor:'rgba(255,96,96,0.6)',borderDash:[6,3],pointRadius:0,fill:false,borderWidth:1},
      {data:bins.map(()=>nyqHi),borderColor:'rgba(255,96,96,0.4)',borderDash:[3,3],pointRadius:0,fill:false,borderWidth:1},
      {data:bins.map(()=>optLo),borderColor:'rgba(80,224,144,0.6)',borderDash:[6,3],pointRadius:0,fill:false,borderWidth:1},
      {data:bins.map(()=>optHi),borderColor:'rgba(80,224,144,0.4)',borderDash:[3,3],pointRadius:0,fill:false,borderWidth:1},
    ],{yl:'arcsec/px'});
    document.getElementById('n-samp-cards').innerHTML=bins.map(n=>{
      const sc=plate(n);
      const stato=sc<optLo?'<span class="wa">iper</span>':sc<=nyqHi?'<span class="ok">ottimale</span>':'<span class="er">sotto</span>';
      return`<div class="metric-card"><div class="mc-label">${n}×${n}</div><div class="mc-val">${sc.toFixed(3)}"</div><div class="mc-sub">${stato} · ${(SEEING_MIN/sc).toFixed(1)}–${(SEEING_MAX/sc).toFixed(1)} px/FWHM</div></div>`;
    }).join('');
    document.getElementById('n-samp-info').innerHTML=`<span class="hi">HW 2×2 + SW 2×2 = equiv. 4×4 → ${plate(4).toFixed(3)}"</span>/px — zona Nyquist per seeing ${SEEING_MIN}"–${SEEING_MAX}". Linee rosse = limite Nyquist, verdi = ottimale (seeing/3).`;
  }

  if(curSnrTab==='sat'){
    document.getElementById('n-sat-ref').textContent=p.staradu.toLocaleString();
    const bins=[1,2,3,4];
    let barsHtml='';
    const sumVals=[],avgVals=[];
    bins.forEach((n,i)=>{
      const sv=p.staradu*n*n,av=p.staradu;
      sumVals.push(sv);avgVals.push(av);
      const spct=Math.min(sv/ADC_MAX*100,100),apct=Math.min(av/ADC_MAX*100,100);
      const sc=sv>ADC_MAX?'var(--red)':sv>FWC?'var(--gold)':'var(--green)';
      const ac=av>FWC?'var(--gold)':'var(--green)';
      barsHtml+=`<div class="satbar-wrap">
        <div class="satbar-label">SW ${n}×${n} Sum: <span style="color:${sc};font-weight:500">${Math.min(sv,999999).toLocaleString()} ADU${sv>ADC_MAX?' [OVERFLOW]':sv>FWC?' [sat. fisica]':''}</span></div>
        <div class="satbar-track"><div class="satbar-fill" style="width:${spct.toFixed(1)}%;background:${sc}"></div><span class="satbar-text" style="color:${sc}">${spct.toFixed(0)}%</span></div>
        <div class="satbar-label" style="margin-top:4px">SW ${n}×${n} Avg: <span style="color:${ac};font-weight:500">${av.toLocaleString()} ADU${av>FWC?' [sat. fisica]':''}</span></div>
        <div class="satbar-track"><div class="satbar-fill" style="width:${apct.toFixed(1)}%;background:${ac}"></div><span class="satbar-text" style="color:${ac}">${apct.toFixed(0)}%</span></div>
      </div>`;
    });
    document.getElementById('n-sat-bars').innerHTML=barsHtml;
    mkBarChart('n-sat-chart',bins.map(n=>'SW '+n+'×'+n),[
      {label:'Sum',data:sumVals.map(v=>Math.min(v,ADC_MAX*1.1)),backgroundColor:'rgba(216,90,48,0.65)',borderRadius:4,borderWidth:0},
      {label:'Avg',data:avgVals,backgroundColor:'rgba(74,158,255,0.65)',borderRadius:4,borderWidth:0}
    ]);
    document.getElementById('n-sat-info').innerHTML=`Soglia sicura Sum 2×2: ≤ <span class="hi">${Math.floor(ADC_MAX/4).toLocaleString()} ADU</span> in acquisizione. Con Average non c'è mai overflow ADU — limite unico: FWC fisico a 51 000 e⁻. <span class="ok">→ Usare sempre Average.</span>`;
  }

  if(curSnrTab==='strategy'){
    const sc4=plate(4),pxFwhm=((SEEING_MIN+SEEING_MAX)/2)/sc4;
    document.getElementById('n-strat-cards').innerHTML=`
      <div class="metric-card"><div class="mc-label">Acquisizione</div><div class="mc-val" style="font-size:14px">HW 2×2</div><div class="mc-sub">Average · 0.602"/px</div></div>
      <div class="metric-card"><div class="mc-label">Bin SW post</div><div class="mc-val" style="font-size:14px">SW 2×2</div><div class="mc-sub">Average · equiv. 4×4</div></div>
      <div class="metric-card"><div class="mc-label">Scala finale</div><div class="mc-val ok">${sc4.toFixed(3)}"</div><div class="mc-sub">${pxFwhm.toFixed(1)} px/FWHM</div></div>
      <div class="metric-card"><div class="mc-label">σ_r effettivo</div><div class="mc-val">${(2*p.rn).toFixed(1)} e⁻</div><div class="mc-sub">SW 2×2 su HW 2×2</div></div>
      <div class="metric-card"><div class="mc-label">File size</div><div class="mc-val ok">12.7 MB</div><div class="mc-sub">vs 50.9 MB (1×1)</div></div>
      <div class="metric-card"><div class="mc-label">Overflow ADU</div><div class="mc-val ok">impossibile</div><div class="mc-sub">Average preserva scala</div></div>`;
    const focal4=getFocal();document.getElementById('n-strat-formula').textContent=`Scala = 206265 × (3.76µm × 4) / ${focal4}mm = ${sc4.toFixed(4)} arcsec/px`;
    document.getElementById('n-strat-info').innerHTML=`SNR con questa strategia: <span class="hi">${snrHW2SW(2,p).toFixed(2)}</span> — miglioramento del <span class="ok">+${((snrHW2SW(2,p)/snrHW(1,p)-1)*100).toFixed(1)}%</span> rispetto al 1×1. Non fare SW 3×3 su HW 2×2 (equiv. 6×6 = ${plate(6).toFixed(3)}"/px): con seeing ${SEEING_MIN}"–${SEEING_MAX}" avresti ${(SEEING_MIN/plate(6)).toFixed(1)}–${(SEEING_MAX/plate(6)).toFixed(1)} px/FWHM → sottocampionamento.`;
  }
}

// ══════════════════════════════════════════════════════════════════
// ETC — Exposure Time Calculator