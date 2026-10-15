// ═══════════════════════════════════════════════════════════════
// snr.js — Tab SNR Analyzer: binning, campionamento, saturazione
// Camera e ottica configurate in Impostazioni
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
const SNR_APERTURE_FWHM=1.4;
function getFocal(){return settingsGet().telescope.focalMm;}
let snrCharts={};
let curSnrTab='snr';
let snrGainIdx=0;
function snrGain(){return settingsGet().camera.gainModes[snrGainIdx];}
function snrRenderGainButtons(){
  const modes=settingsGet().camera.gainModes;
  snrGainIdx=Math.min(snrGainIdx,modes.length-1);
  document.getElementById('n-gain-btns').innerHTML=modes.map((g,i)=>
    '<button class="gain-btn'+(i===snrGainIdx?' active':'')+'" onclick="setGain('+i+')">'+
    settingsEscape(g.label)+' · '+g.ePerADU+' e⁻/ADU</button>'
  ).join('');
  snrSyncGainInfo();
}
function snrSyncGainInfo(){
  const g=snrGain();
  const rnSlider=document.getElementById('n-rn');
  rnSlider.min=0;
  rnSlider.max=Math.max(8,g.rn);
  document.getElementById('n-rn-v').min=rnSlider.min;
  document.getElementById('n-rn-v').max=rnSlider.max;
  rnSlider.value=g.rn;
  document.getElementById('n-rn-v').value=g.rn.toFixed(2);
  document.getElementById('n-rn-auto').textContent=g.rn.toFixed(2)+' e⁻';
  document.getElementById('n-fwc-auto').textContent=g.fwc.toLocaleString('it-IT')+' e⁻';
  document.getElementById('n-eadu-auto').textContent=g.ePerADU;
  document.getElementById('n-off-auto').textContent=g.gainNum;
  document.querySelector('#n-badge-fwc span').textContent=g.fwc.toLocaleString('it-IT')+' e⁻';
}
function setGain(idx){
  if(!settingsGet().camera.gainModes[idx])return;
  snrGainIdx=idx;
  document.querySelectorAll('#n-gain-btns .gain-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));
  snrSyncGainInfo();
  snrUpdate();
}

function snrNumberChanged(id,editing=false){
  const slider=document.getElementById(id);
  const number=document.getElementById(id+'-v');
  if(number.value===''){if(!editing)snrUpdate();return;}
  const value=Number(number.value);
  if(!Number.isFinite(value)){if(!editing)snrUpdate();return;}
  if(id==='n-sig'){
    if(value<=0){if(!editing)number.value=slider.value;return;}
    slider.min=Math.min(0.000001,value);
    slider.max=Math.max(500,Math.ceil(value));
    slider.step='any';
    snrCalManualSignal();
    slider.value=value;
  }else slider.value=Math.min(Number(slider.max),Math.max(Number(slider.min),value));
  snrUpdate(editing?id:null);
}

function snrTab(name){
  ['snr','sampling','sat','strategy'].forEach(t=>{
    document.getElementById('snr-tab-'+t).style.display=t===name?'':'none';
  });
  document.querySelectorAll('.snr-tab').forEach((b,i)=>b.classList.toggle('active',['snr','sampling','sat','strategy'][i]===name));
  curSnrTab=name;
  snrUpdate();
}

function snrGetP(){
  const sig=+document.getElementById('n-sig').value;
  const t=+document.getElementById('n-exp').value;
  return{
    sig,sky:+document.getElementById('n-sky').value,
    rn:+document.getElementById('n-rn').value,dc:+document.getElementById('n-dc').value,
    seeing:+document.getElementById('n-seeing').value,
    filter:document.getElementById('n-filter').selectedOptions[0].textContent,
    t,staradu:sig*t/snrGain().ePerADU
  };
}
function plate(n){return settingsPlateScale(n);}

// Profilo gaussiano centrato nel pixel/blocco; il segnale inserito è il picco 1×1,
// già sottratto del fondo. Questa approssimazione richiede il FWHM della stessa ripresa.
function snrErf(x){
  const t=1/(1+0.3275911*x);
  return 1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
}
function snrPsf(p){
  const sigmaPx=p.seeing/plate(1)/2.354820045;
  const peakFraction=Math.pow(snrErf(0.5/(Math.SQRT2*sigmaPx)),2);
  return{sigmaPx,peakFraction};
}
function snrStarRateInSquare(n,p){
  const{sigmaPx,peakFraction}=snrPsf(p);
  const blockFraction=Math.pow(snrErf(n/(2*Math.SQRT2*sigmaPx)),2);
  return p.sig*blockFraction/peakFraction;
}
function snrOutputPixel(n,p){
  // Il segnale segue la PSF. La varianza di n² letture native si somma;
  // nell’Average il rumore del valore medio è invece σ_r/n.
  const star=snrStarRateInSquare(n,p)*p.t;
  const skyDark=(p.sky+p.dc)*n*n*p.t;
  const readVariance=n*n*p.rn*p.rn;
  return star/Math.sqrt(star+skyDark+readVariance);
}
function snrAverageReadNoise(n,p){return p.rn/n;}
function snrApertureModel(p){
  const{sigmaPx,peakFraction}=snrPsf(p);
  const radiusPx=SNR_APERTURE_FWHM*p.seeing/plate(1);
  const enclosedFraction=1-Math.exp(-radiusPx*radiusPx/(2*sigmaPx*sigmaPx));
  const starRate=p.sig*enclosedFraction/peakFraction;
  const nativePixels=Math.PI*radiusPx*radiusPx;
  const star=starRate*p.t;
  const skyDark=(p.sky+p.dc)*nativePixels*p.t;
  // Assumiamo rumore di lettura per pixel nativo anche nel binning
  // in camera (Average); eventuali differenze si calibreranno su immagini.
  const readVariance=nativePixels*p.rn*p.rn;
  return{snr:star/Math.sqrt(star+skyDark+readVariance),nativePixels,starRate};
}
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

function snrUpdate(editingId=null){
  const p=snrGetP();
  const gain=snrGain();
  const adcMax=settingsAdcMax();
  const ap=snrApertureModel(p);
  const pixelElectrons=(p.sig+p.sky+p.dc)*p.t;
  const saturated=pixelElectrons>=gain.fwc || p.staradu>=adcMax;
  const warning=document.getElementById('n-acq-warning');
  warning.style.display=saturated?'':'none';
  if(saturated)warning.innerHTML=`<span class="er">Pixel saturo nel modello 1×1: ${pixelElectrons.toLocaleString('it-IT',{maximumFractionDigits:1})} e⁻ su FWC ${gain.fwc.toLocaleString('it-IT')} e⁻${p.staradu>=adcMax?' (oltre ADC)':''}. I risultati SNR presuppongono un pixel non saturo.</span>`;
  if(editingId!=='n-sig')document.getElementById('n-sig-v').value=p.sig;
  if(editingId!=='n-seeing')document.getElementById('n-seeing-v').value=p.seeing.toFixed(2);
  if(editingId!=='n-sky')document.getElementById('n-sky-v').value=p.sky;
  if(editingId!=='n-rn')document.getElementById('n-rn-v').value=p.rn.toFixed(2);
  if(editingId!=='n-dc')document.getElementById('n-dc-v').value=p.dc.toFixed(4);
  if(editingId!=='n-exp')document.getElementById('n-exp-v').value=p.t;
  document.getElementById('n-staradu-v').value=p.staradu.toFixed(0);

  const tEq=(p.rn*p.rn)/(p.sky+p.dc);
  const regime=p.t>5*tEq?'sky-limited':p.t<0.5*tEq?'read-limited':'misto';

  if(curSnrTab==='snr'){
    const camera2=settingsGet().camera.nativeBin===2;
    const modes=[
      {label:'1×1',n:1,color:'rgba(74,158,255,0.7)'},
      ...(camera2?[
        {label:'Camera 2×2 Avg',n:2,color:'rgba(74,158,255,0.7)'},
        {label:'Camera 2×2 + SW2',n:4,color:'rgba(80,224,144,0.75)'}
      ]:[]),
      {label:'SW 2×2',n:2,color:'rgba(216,90,48,0.65)'},
      {label:'SW 3×3',n:3,color:'rgba(216,90,48,0.65)'},
      {label:'SW 4×4',n:4,color:'rgba(216,90,48,0.65)'}
    ];
    const labels=modes.map(m=>m.label),vals=modes.map(m=>snrOutputPixel(m.n,p));
    const colors=modes.map(m=>m.color);
    mkBarChart('n-snr-chart',labels,[{data:vals,backgroundColor:colors,borderRadius:4,borderWidth:0}]);
    document.getElementById('n-snr-cards').innerHTML=`
      <div class="metric-card"><div class="mc-label">t_eq (pareggio)</div><div class="mc-val">${tEq.toFixed(2)}s</div><div class="mc-sub">σ²_r / (cielo + dark)</div></div>
      <div class="metric-card"><div class="mc-label">Regime</div><div class="mc-val" style="font-size:13px;color:${regime==='sky-limited'?'var(--green)':regime==='read-limited'?'var(--red)':'var(--gold)'}">${regime}</div><div class="mc-sub">t=${p.t}s</div></div>
      <div class="metric-card"><div class="mc-label">SNR in apertura</div><div class="mc-val">${ap.snr.toFixed(1)}</div><div class="mc-sub">r = ${SNR_APERTURE_FWHM} × FWHM</div></div>
      <div class="metric-card"><div class="mc-label">SNR pixel 4×4</div><div class="mc-val">${snrOutputPixel(4,p).toFixed(1)}</div><div class="mc-sub">vs 1×1: ${(snrOutputPixel(4,p)/snrOutputPixel(1,p)).toFixed(2)}×</div></div>
      <div class="metric-card"><div class="mc-label">σ_r media 2×2</div><div class="mc-val">${snrAverageReadNoise(2,p).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} e⁻</div><div class="mc-sub">per valore medio · 1×1: ${p.rn.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} e⁻</div></div>`;
    const binDescription=camera2
      ? 'Il 2×2 in camera usa Average; i binning superiori sono software (INDIGO o elaborazione). Le coppie camera 2×2 / SW 2×2 e camera 2×2 + SW 2×2 / SW 4×4 coincidono nel modello delle letture indipendenti.'
      : 'La camera è configurata per il solo 1×1; tutti i binning successivi sono software (INDIGO o elaborazione).';
    document.getElementById('n-regime-info').innerHTML=`Filtro <span class="hi">${p.filter}</span> · ${binDescription} Il grafico mostra l'SNR del pixel centrale risultante: cresce perché raccoglie una zona più ampia della PSF. Su un valore medio 2×2 il rumore di lettura è σ_r/2 se si mediano quattro pixel letti indipendentemente. Un'eventuale differenza fisica del binning in camera richiede misure delle immagini bias. L'SNR della stella nell'apertura fissa (r = ${SNR_APERTURE_FWHM} × FWHM, circa ${ap.nativePixels.toFixed(0)} pixel 1×1) è ${ap.snr.toFixed(1)} in tutte le modalità. La calibrazione empirica entra nel calcolo quando premi «Usa nel calcolo SNR»; non viene applicata estinzione automatica.`;
  }

  if(curSnrTab==='sampling'){
    const bins=[1,2,4,6,8];
    const scales=bins.map(n=>plate(n));
    const nyq=p.seeing/2,opt=p.seeing/3;
    mkChart('n-samp-chart',bins.map(n=>n+'×'+n),[
      {data:scales,borderColor:'#4a9eff',backgroundColor:'rgba(74,158,255,0.1)',tension:0.3,pointRadius:5,fill:false,borderWidth:2},
      {data:bins.map(()=>nyq),borderColor:'rgba(255,96,96,0.6)',borderDash:[6,3],pointRadius:0,fill:false,borderWidth:1},
      {data:bins.map(()=>opt),borderColor:'rgba(80,224,144,0.6)',borderDash:[6,3],pointRadius:0,fill:false,borderWidth:1},
    ],{yl:'arcsec/px'});
    document.getElementById('n-samp-cards').innerHTML=bins.map(n=>{
      const sc=plate(n);
      const stato=sc<opt?'<span class="wa">iper</span>':sc<=nyq?'<span class="ok">ottimale</span>':'<span class="er">sotto</span>';
      return`<div class="metric-card"><div class="mc-label">${n}×${n}</div><div class="mc-val">${sc.toFixed(3)}"</div><div class="mc-sub">${stato} · ${(p.seeing/sc).toFixed(1)} px/FWHM</div></div>`;
    }).join('');
    document.getElementById('n-samp-info').innerHTML=(settingsGet().camera.nativeBin===2
      ? 'Camera 2×2 Average + SW 2×2'
      : 'SW 4×4 da acquisizione 1×1')+
      ` = equiv. 4×4 → <span class="hi">${plate(4).toFixed(3)}"/px</span>. Seeing impostato: ${p.seeing.toFixed(2)}". Linea rossa = limite Nyquist (FWHM/2), verde = FWHM/3.`;
  }

  if(curSnrTab==='sat'){
    document.getElementById('n-sat-ref').textContent=p.staradu.toLocaleString('it-IT',{maximumFractionDigits:0});
    document.getElementById('n-sat-fwc').textContent=gain.fwc.toLocaleString('it-IT');
    const bins=[1,2,3,4];
    let barsHtml='';
    const sumVals=[],avgVals=[];
    bins.forEach(n=>{
      const sv=snrStarRateInSquare(n,p)*p.t/gain.ePerADU,av=sv/(n*n);
      sumVals.push(sv);avgVals.push(av);
      const spct=Math.min(sv/adcMax*100,100),apct=Math.min(av/adcMax*100,100);
      const sumOverflow=sv>adcMax;
      const sc=saturated?'var(--red)':sumOverflow?'var(--gold)':'var(--green)';
      const ac=saturated?'var(--red)':'var(--green)';
      barsHtml+=`<div class="satbar-wrap">
        <div class="satbar-label">SW ${n}×${n} Sum: <span style="color:${sc};font-weight:500">${sv.toLocaleString('it-IT',{maximumFractionDigits:0})} ADU${saturated?' [pixel saturo]':sumOverflow?' [overflow ADC]':''}</span></div>
        <div class="satbar-track"><div class="satbar-fill" style="width:${spct.toFixed(1)}%;background:${sc}"></div><span class="satbar-text" style="color:${sc}">${spct.toFixed(0)}%</span></div>
        <div class="satbar-label" style="margin-top:4px">SW ${n}×${n} Avg: <span style="color:${ac};font-weight:500">${av.toLocaleString('it-IT',{maximumFractionDigits:0})} ADU${saturated?' [pixel saturo]':''}</span></div>
        <div class="satbar-track"><div class="satbar-fill" style="width:${apct.toFixed(1)}%;background:${ac}"></div><span class="satbar-text" style="color:${ac}">${apct.toFixed(0)}%</span></div>
      </div>`;
    });
    document.getElementById('n-sat-bars').innerHTML=barsHtml;
    mkBarChart('n-sat-chart',bins.map(n=>'SW '+n+'×'+n),[
      {label:'Sum',data:sumVals.map(v=>Math.min(v,adcMax*1.1)),backgroundColor:'rgba(216,90,48,0.65)',borderRadius:4,borderWidth:0},
      {label:'Avg',data:avgVals,backgroundColor:'rgba(74,158,255,0.65)',borderRadius:4,borderWidth:0}
    ]);
    document.getElementById('n-sat-info').innerHTML=`Carica stimata nel pixel di picco: <span class="hi">${pixelElectrons.toLocaleString('it-IT',{maximumFractionDigits:1})} e⁻</span> (stella + cielo + dark) su ${gain.fwc.toLocaleString('it-IT')} e⁻ di FWC. ${saturated?'<span class="er">Il pixel è già saturo in acquisizione: riduci esposizione o gain.</span>':'<span class="ok">Il pixel non è saturo in acquisizione.</span>'} Le somme SW stimano la stella in un blocco centrato sulla PSF; non crescono semplicemente come n². Le barre escludono cielo e bias, quindi l'overflow reale della somma può arrivare prima.`;
  }

  if(curSnrTab==='strategy'){
    const camera2=settingsGet().camera.nativeBin===2;
    const acqBin=camera2?2:1,postBin=camera2?2:4;
    const sc4=plate(4),pxFwhm=p.seeing/sc4;
    const c=settingsGet().camera;
    document.getElementById('n-strat-cards').innerHTML=`
      <div class="metric-card"><div class="mc-label">Acquisizione esempio</div><div class="mc-val" style="font-size:14px">Camera ${acqBin}×${acqBin}</div><div class="mc-sub">${camera2?'Average':'nativo'} · ${plate(acqBin).toFixed(3)}"/px</div></div>
      <div class="metric-card"><div class="mc-label">Bin SW INDIGO/post</div><div class="mc-val" style="font-size:14px">SW ${postBin}×${postBin}</div><div class="mc-sub">Average · equiv. 4×4</div></div>
      <div class="metric-card"><div class="mc-label">Scala finale</div><div class="mc-val ok">${sc4.toFixed(3)}"</div><div class="mc-sub">${pxFwhm.toFixed(1)} px/FWHM</div></div>
      <div class="metric-card"><div class="mc-label">SNR in apertura</div><div class="mc-val">${ap.snr.toFixed(1)}</div><div class="mc-sub">stessa apertura del confronto</div></div>
      <div class="metric-card"><div class="mc-label">File stimato</div><div class="mc-val ok">${settingsFileMiB(acqBin).toFixed(1)} MiB</div><div class="mc-sub">vs ${settingsFileMiB(1).toFixed(1)} MiB (1×1)</div></div>
      <div class="metric-card"><div class="mc-label">Overflow software</div><div class="mc-val ok">evitato</div><div class="mc-sub">Average; controlla FWC</div></div>`;
    document.getElementById('n-strat-formula').textContent=`Scala = 206265 × (${c.pixelUm}µm × 4) / ${getFocal()}mm = ${sc4.toFixed(4)} arcsec/px`;
    document.getElementById('n-strat-info').innerHTML=`SNR stimato nella stessa apertura: <span class="hi">${ap.snr.toFixed(2)}</span>. La combinazione ${camera2?'camera 2×2 + SW 2×2':'camera 1×1 + SW 4×4'} modifica campionamento e dimensione dei file; il modello non le attribuisce un guadagno SNR. Con seeing ${p.seeing.toFixed(2)}", la scala finale dà ${pxFwhm.toFixed(1)} px/FWHM. Controlla saturazione e campionamento prima di sceglierla.`;
  }
  if(typeof snrCalRefresh==='function')snrCalRefresh();
}

// ══════════════════════════════════════════════════════════════════
// ETC — Exposure Time Calculator