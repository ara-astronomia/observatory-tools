// ═══════════════════════════════════════════════════════════════
// staralt.js — Tab StarAlt: altitudine oggetti, Luna, osservabilità
// Dipende da: astro-utils.js, catalog.js
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
function catalogSourceBadge(source){
  const labels={user:'utente',landolt50:'Landolt +50',messier:'Messier',openngc_ngc:'NGC/IC',openngc_addendum:'Addendum'};
  if(!labels[source])return null;
  const badge=document.createElement('span');
  badge.className=`catalog-source-badge catalog-source-${source}`;
  badge.textContent=labels[source];
  return badge;
}
let catalogSearchSeq=0;
let catalogSearchTimer=null;
function renderCatalogMatches(matches,emptyText='Nessun risultato'){
  const list=document.getElementById('s-catList');
  const content=document.createDocumentFragment();
  if(!matches.length){
    const empty=document.createElement('div');
    empty.className='catalog-item catalog-empty';
    empty.textContent=emptyText;
    content.append(empty);
  }
  for(const o of matches){
    const row=document.createElement('button');
    row.type='button';
    row.className='catalog-item';
    const title=document.createElement('span');
    const name=document.createElement('span');name.className='ci-name';name.textContent=o.n;
    title.append(name);
    if(o.a){const alias=document.createElement('span');alias.className='ci-type';alias.textContent=` ${o.a}`;title.append(alias);}
    const badge=catalogSourceBadge(o.source);
    if(badge)title.append(' ',badge);
    const details=document.createElement('span');
    const type=document.createElement('span');type.className='ci-type';type.textContent=o.t||'';
    const coords=document.createElement('span');coords.className='ci-coords';
    coords.textContent=` RA ${Number(o.r).toFixed(3)}h Dec ${Number(o.d)>=0?'+':''}${Number(o.d).toFixed(2)}°`;
    details.append(type,coords);
    row.append(title,details);
    row.addEventListener('click',()=>selectObj(o.n,o.r,o.d,o.a||o.n));
    content.append(row);
  }
  list.replaceChildren(content);
}
function filterCatalog(){
  const q=document.getElementById('s-catSearch').value.trim();
  const seq=++catalogSearchSeq;
  clearTimeout(catalogSearchTimer);
  if(!q){document.getElementById('s-catList').replaceChildren();return;}
  const lower=q.toLowerCase();
  const local=getCatalog().filter(o=>o.n.toLowerCase().includes(lower)||(o.a||'').toLowerCase().includes(lower)||(o.t||'').toLowerCase().includes(lower)).slice(0,30);
  renderCatalogMatches(local,q.length>=2?'Ricerca NGC/IC…':'Nessun risultato');
  if(q.length<2)return;
  catalogSearchTimer=setTimeout(async()=>{
    try{
      const remote=await searchOpenNgc(q);
      if(seq!==catalogSearchSeq)return;
      const preferRemote=/^(ngc|ic|eso|hcg|mwsc|mel|pgc|ugc|cl|b\d|c\d|h\d)/i.test(q);
      const combined=dedupeCatalogObjects(preferRemote?[...remote,...local]:[...local,...remote]).slice(0,30);
      renderCatalogMatches(combined);
    }catch(error){
      if(seq===catalogSearchSeq)renderCatalogMatches(local);
      console.warn('Ricerca NGC/IC non disponibile:',error);
    }
  },180);
}
function selectObj(name,ra,dec,full){
  catalogSearchSeq++;
  clearTimeout(catalogSearchTimer);
  document.getElementById('s-ra').value=parseFloat(ra).toFixed(4);
  document.getElementById('s-dec').value=parseFloat(dec).toFixed(4);
  document.getElementById('s-objname').value=name;
  document.getElementById('s-catSearch').value='';
  document.getElementById('s-catList').replaceChildren();
  const result=document.getElementById('s-objResult');
  result.style.display='block';
  const nameLine=document.createElement('div');nameLine.className='obj-name';nameLine.textContent=name;
  const coordsLine=document.createElement('div');coordsLine.className='obj-coords';
  coordsLine.textContent=`${full} · RA ${parseFloat(ra).toFixed(4)}h · Dec ${parseFloat(dec)>=0?'+':''}${parseFloat(dec).toFixed(4)}°`;
  result.replaceChildren(nameLine,coordsLine);
}
let sChart=null;
let sTzManual=false;
function sEveningOffset(dateStr,timeZone){
  const [y,m,d]=dateStr.split('-').map(Number);
  const eveningUtc=new Date(Date.UTC(y,m-1,d,18));
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(eveningUtc).map(p=>[p.type,p.value]));
  const localStamp=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),
    Number(parts.hour),Number(parts.minute));
  return(localStamp-eveningUtc.getTime())/3600000;
}
function initStarAltTimezone(force=false){
  const dateEl=document.getElementById('s-obsdate'),tzEl=document.getElementById('s-tz');
  if(!dateEl||!tzEl)return;
  if(force)sTzManual=false;
  const apply=()=>{
    if(!sTzManual&&dateEl.value)
      tzEl.value=sEveningOffset(dateEl.value,settingsGet().site.timeZone);
  };
  if(!dateEl.dataset.timezoneBound){
    tzEl.addEventListener('input',()=>{sTzManual=true;});
    dateEl.addEventListener('change',apply);
    dateEl.dataset.timezoneBound='1';
  }
  apply();
}
function sGetDate(){const v=document.getElementById('s-obsdate').value;if(v){const[y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d,12);}const n=new Date();n.setHours(12,0,0,0);return n;}
function sComputeTonight(){sCompute();}
function sCompute(startH,endH){
  const ra_h=parseRA(document.getElementById('s-ra').value),dec_d=parseDec(document.getElementById('s-dec').value);
  if(isNaN(ra_h)||isNaN(dec_d)){alert('Inserisci RA e Dec validi');return;}
  const{lat,lon}=settingsGet().site;
  const tz=+document.getElementById('s-tz').value;
  const minAltText=document.getElementById('s-minalt').value;
  const minAlt=minAltText===''?20:+minAltText;
  const objname=document.getElementById('s-objname').value||'Oggetto';
  const date=sGetDate(),tw=findTwilight(date,lat,lon,tz);
  const h0=startH!==undefined?startH:tw.sunset,h1=endH!==undefined?endH:tw.sunrise;
  const jdNoon=jdLocalNoon(date,tz);
  const N=240,times=[],alts=[],moonAlts=[],moonDists=[],sunAlts=[],labels=[];
  for(let i=0;i<=N;i++){
    const h=h0+(h1-h0)*i/N,J=jdNoon+(h-12)/24;
    alts.push(+altaz(ra_h,dec_d,lat,lon,J).alt.toFixed(2));
    const mp=moonPos(J);moonAlts.push(+altaz(mp.ra_h,mp.dec_d,lat,lon,J).alt.toFixed(2));
    moonDists.push(+angDist(ra_h,dec_d,mp.ra_h,mp.dec_d).toFixed(1));
    sunAlts.push(+sunAlt(J,lat,lon).toFixed(2));times.push(h);
    labels.push(fmtH(h));
  }
  let transitH=null,maxAlt=-90;
  for(let i=0;i<=N;i++)if(alts[i]>maxAlt){maxAlt=alts[i];transitH=times[i];}
  let obsStart=null,obsEnd=null;
  for(let i=0;i<=N;i++)if(alts[i]>=minAlt&&sunAlts[i]<=-18){if(obsStart===null)obsStart=times[i];obsEnd=times[i];}
  const midJ=jdNoon+((tw.dusk+tw.dawn)/2-12)/24,mi=moonIllum(midJ);
  let minDist=999;for(let i=0;i<=N;i++)if(sunAlts[i]<=-18&&moonDists[i]<minDist)minDist=moonDists[i];
  const nowJ=jd(new Date()),{alt:nowAlt,az:nowAz}=altaz(ra_h,dec_d,lat,lon,nowJ);
  staraltLastAlt=nowAlt;
  function fmtH(h){const minutes=((Math.round(h*60)%1440)+1440)%1440;return`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
  const mxC=maxAlt>=60?'alt-now':maxAlt>=30?'alt-mid':'alt-low',nwC=nowAlt>=minAlt?'alt-now':nowAlt>=0?'alt-mid':'alt-low';
  document.getElementById('s-infoGrid').innerHTML=`
    <div class="info-card"><div class="ic-label">Alt. ora</div><div class="ic-val ${nwC}">${nowAlt.toFixed(1)}°</div><div class="ic-sub">Az ${nowAz.toFixed(1)}°</div></div>
    <div class="info-card"><div class="ic-label">Alt. massima</div><div class="ic-val ${mxC}">${maxAlt.toFixed(1)}°</div><div class="ic-sub">Transito ${fmtH(transitH)}</div></div>
    <div class="info-card"><div class="ic-label">Notte astron.</div><div class="ic-val" style="font-size:14px">${fmtH(tw.dusk)}</div><div class="ic-sub">→ ${fmtH(tw.dawn)}</div></div>`;
  const iC=mi.illum<25?'moon-ok':mi.illum<60?'moon-warn':'moon-bad',dC=minDist>30?'moon-ok':minDist>15?'moon-warn':'moon-bad';
  document.getElementById('s-moonGrid').innerHTML=`
    <div class="info-card moon-card"><div class="ic-label">Fase lunare</div><div class="ic-val" style="font-size:14px">${phaseIcon(mi.phase)} ${phaseName(mi.phase)}</div><div class="ic-sub">a metà notte</div></div>
    <div class="info-card moon-card"><div class="ic-label">Illuminazione</div><div class="ic-val ${iC}">${mi.illum}%</div><div class="ic-sub">${mi.illum<25?'favorevole':mi.illum<60?'accettabile':'critica'}</div></div>
    <div class="info-card moon-card"><div class="ic-label">Dist. min. notte</div><div class="ic-val ${dC}">${minDist<999?minDist.toFixed(1)+'°':'—'}</div><div class="ic-sub">${minDist>30?'sicura':minDist>15?'borderline':'troppo vicina'}</div></div>
    <div class="info-card moon-card"><div class="ic-label">Elong. ☀-☽</div><div class="ic-val" style="font-size:16px">${mi.elong}°</div><div class="ic-sub">Sole — Luna</div></div>`;
  document.getElementById('s-chartTitle').textContent=`ALTITUDINE — ${objname.toUpperCase()} · ${date.toLocaleDateString('it-IT')} · ora del fuso impostato (UTC${tz>=0?'+':''}${tz})`;
  if(sChart)sChart.destroy();
  const nightPlugin={id:'ns',beforeDraw(chart){
    const{ctx:c,chartArea:{left,right,top,bottom},scales}=chart;
    function xOf(h){return scales.x.getPixelForValue(Math.max(0,Math.min(N,(h-h0)/(h1-h0)*N)));}
    c.save();
    c.fillStyle='rgba(15,30,60,0.72)';c.fillRect(left,top,xOf(tw.dusk)-left,bottom-top);c.fillRect(xOf(tw.dawn),top,right-xOf(tw.dawn),bottom-top);
    let mUp=false,mS=null;for(let i=0;i<=N;i++){const h=h0+(h1-h0)*i/N,up=moonAlts[i]>0&&sunAlts[i]<=-6;if(up&&!mUp){mS=h;mUp=true;}if(!up&&mUp){c.fillStyle='rgba(232,213,160,0.07)';c.fillRect(xOf(mS),top,xOf(h)-xOf(mS),bottom-top);mUp=false;}}
    if(mUp){c.fillStyle='rgba(232,213,160,0.07)';c.fillRect(xOf(mS),top,xOf(h1)-xOf(mS),bottom-top);}
    if(obsStart!==null){c.fillStyle='rgba(80,224,144,0.07)';c.fillRect(xOf(obsStart),top,xOf(obsEnd)-xOf(obsStart),bottom-top);}
    c.strokeStyle='rgba(240,192,96,0.22)';c.setLineDash([4,4]);c.lineWidth=1;const yM=scales.y.getPixelForValue(minAlt);c.beginPath();c.moveTo(left,yM);c.lineTo(right,yM);c.stroke();
    if(transitH!==null){c.strokeStyle='rgba(240,192,96,0.55)';c.setLineDash([6,3]);c.lineWidth=1.5;const xT=xOf(transitH);c.beginPath();c.moveTo(xT,top);c.lineTo(xT,bottom);c.stroke();}
    c.restore();
  },afterDraw(chart){
    const{ctx:c,chartArea:{left,right,top,bottom}}=chart;
    c.save();
    c.font="10px 'Space Mono', monospace";
    c.lineWidth=2;
    c.setLineDash([4,3]);
    for(const marker of [
      {x:left+1,color:'#f0a060',label:`Tramonto ${fmtH(tw.sunset)}`,align:'left',textX:left+7},
      {x:right-1,color:'#7ec8ff',label:`Alba ${fmtH(tw.sunrise)}`,align:'right',textX:right-7}
    ]){
      c.strokeStyle=marker.color;
      c.beginPath();c.moveTo(marker.x,top);c.lineTo(marker.x,bottom);c.stroke();
      c.fillStyle=marker.color;c.textAlign=marker.align;
      c.fillText(marker.label,marker.textX,top+14);
    }
    c.restore();
  }};
  // Plugin crosshair verticale
  const crosshairPlugin={
    id:'crosshair',
    afterDraw(chart){
      if(chart._crosshairX===undefined) return;
      const{ctx:c,chartArea:{top,bottom}}=chart;
      c.save();
      c.strokeStyle='rgba(150,190,255,0.35)';
      c.lineWidth=1;c.setLineDash([4,3]);
      c.beginPath();c.moveTo(chart._crosshairX,top);c.lineTo(chart._crosshairX,bottom);c.stroke();
      c.restore();
    }
  };

  // Calcola illuminazione Luna in percentuale per ogni step
  const moonIllumArr=times.map(h=>{
    const J=jdNoon+(h-12)/24;
    return moonIllum(J).illum;
  });
  // Airmass per ogni step (solo se alt>0)
  const airmassArr=alts.map(a=>a>5?+(1/Math.cos((90-a)*D2R)).toFixed(3):null);

  sChart=new Chart(document.getElementById('s-altChart'),{type:'line',plugins:[nightPlugin,crosshairPlugin],
    data:{labels,datasets:[
      {label:objname,data:alts,borderColor:'#4a9eff',backgroundColor:'rgba(74,158,255,0.07)',fill:true,tension:0.4,pointRadius:0,borderWidth:2.5},
      {label:'Luna',data:moonAlts,borderColor:'rgba(232,213,160,0.75)',backgroundColor:'rgba(232,213,160,0.04)',fill:true,tension:0.4,pointRadius:0,borderWidth:1.5,borderDash:[5,3]}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:320},
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      onHover:(evt,els,chart)=>{
        const tt=document.getElementById('s-tooltip');
        if(!evt.native){tt.style.display='none';chart._crosshairX=undefined;chart.update('none');return;}
        const rect=chart.canvas.getBoundingClientRect();
        const x=evt.native.clientX-rect.left;
        const{chartArea:{left,right,top,bottom}}=chart;
        if(x<left||x>right){tt.style.display='none';chart._crosshairX=undefined;chart.update('none');return;}
        // indice più vicino
        const frac=(x-left)/(right-left);
        const idx=Math.round(frac*N);
        const i=Math.max(0,Math.min(N,idx));
        const alt=alts[i], mAlt=moonAlts[i], mDist=moonDists[i];
        const illum=moonIllumArr[i];
        const am=airmassArr[i];
        const altColor=alt>=minAlt?'#50e090':alt>=0?'#f0c060':'#ff6060';
        const amStr=am!==null?am.toFixed(2):'—';
        tt.innerHTML=
          `<span style="color:#7ec8ff;font-weight:700">${labels[i]}</span><br>`+
          `<span style="color:#888">oggetto</span> <span style="color:${altColor}">${alt.toFixed(1)}°</span><br>`+
          `<span style="color:#888">airmass </span> <span style="color:#cce4ff">${amStr}</span><br>`+
          `<span style="color:#888">luna alt</span> <span style="color:#e8d5a0">${mAlt.toFixed(1)}°</span><br>`+
          `<span style="color:#888">illum.  </span> <span style="color:#e8d5a0">${illum}%</span><br>`+
          `<span style="color:#888">dist.☽  </span> <span style="color:#e8d5a0">${mDist.toFixed(1)}°</span>`;
        // posizione tooltip
        const canvasW=right-left, tipW=160;
        const tipX=x+16+tipW>rect.width?x-tipW-16:x+16;
        const tipY=Math.max(top,Math.min(bottom-120,evt.native.clientY-rect.top-40));
        tt.style.left=tipX+'px'; tt.style.top=tipY+'px'; tt.style.display='block';
        chart._crosshairX=x; chart.update('none');
      },
      scales:{x:{ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"},maxTicksLimit:13,autoSkip:true},grid:{color:'rgba(100,160,255,0.06)'}},y:{min:-10,max:92,ticks:{color:'rgba(150,190,255,0.5)',font:{size:10,family:"'Space Mono',monospace"},callback:v=>v+'°'},grid:{color:'rgba(100,160,255,0.06)'}}}}});

  // Nascondi tooltip quando il mouse lascia il canvas
  document.getElementById('s-altChart').addEventListener('mouseleave',()=>{
    const tt=document.getElementById('s-tooltip');
    tt.style.display='none';
    if(sChart){sChart._crosshairX=undefined;sChart.update('none');}
  });
  const owDiv=document.getElementById('s-obsWindowDiv');
  const dStr=minDist<999?`<div class="moon-dist-line">⌖ Dist. min. Luna: <strong>${minDist.toFixed(1)}°</strong> — ${minDist>30?'✓ sicura':minDist>15?'⚠ borderline':'✗ troppo vicina'}</div>`:'';
  if(obsStart!==null){const dur=obsEnd-obsStart,dh=Math.floor(dur),dm=Math.round((dur-dh)*60);owDiv.innerHTML=`<div class="ow-title">Finestra osservativa</div><div>${fmtH(obsStart)} → ${fmtH(obsEnd)} &nbsp;·&nbsp; durata <strong>${dh}h ${dm}m</strong></div><div class="transit-line">Transito: ${fmtH(transitH)} &nbsp;·&nbsp; alt. max: ${maxAlt.toFixed(1)}°</div>${dStr}`;}
  else{owDiv.innerHTML=`<div class="ow-title" style="color:var(--red)">Oggetto non osservabile questa notte</div><div>Non raggiunge ${minAlt}° durante la notte. Alt. max: ${maxAlt.toFixed(1)}°</div>${dStr}`;}
  owDiv.style.display='block';
  document.getElementById('s-noResult').style.display='none';
  document.getElementById('s-resultArea').style.display='block';
}

// ══════════════════════════════════════════════════════════════════
// SNR ANALYZER
// ── Form aggiungi nuovo oggetto ───────────────────────────────────

function initAddObjectForm() {
  const container = document.getElementById('s-add-obj-form');
  if (!container) return;

  container.innerHTML = `
    <div style="font-size:11px;color:var(--text2);font-family:var(--mono);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">
      Aggiungi al catalogo
    </div>
    <div class="field">
      <label>Nome oggetto *</label>
      <input type="text" id="new-obj-name" placeholder="es. NGC 3115">
    </div>
    <div class="field">
      <label>Alias / nome comune</label>
      <input type="text" id="new-obj-alias" placeholder="es. Spindle Galaxy">
    </div>
    <div class="field">
      <label>Tipo</label>
      <input type="text" id="new-obj-type" placeholder="es. Galassia, Nebulosa…">
    </div>
    <div class="row2">
      <div class="field">
        <label>RA (hh mm ss o hh.hh)</label>
        <input type="text" id="new-obj-ra" placeholder="10 05 14">
      </div>
      <div class="field">
        <label>Dec (±dd mm ss o ±dd.dd)</label>
        <input type="text" id="new-obj-dec" placeholder="-07 43 07">
      </div>
    </div>
    <div class="field">
      <label>Note</label>
      <input type="text" id="new-obj-notes" placeholder="Osservazioni, riferimenti…">
    </div>
    <div id="new-obj-feedback" style="font-size:11px;font-family:var(--mono);margin-bottom:6px;min-height:16px;"></div>
    <button class="btn btn-sec" onclick="saveNewObject()" style="margin-top:0;">
      + Salva nel catalogo
    </button>`;
}

async function saveNewObject() {
  const name   = document.getElementById('new-obj-name')?.value.trim();
  const alias  = document.getElementById('new-obj-alias')?.value.trim();
  const type   = document.getElementById('new-obj-type')?.value.trim();
  const raStr  = document.getElementById('new-obj-ra')?.value.trim();
  const decStr = document.getElementById('new-obj-dec')?.value.trim();
  const notes  = document.getElementById('new-obj-notes')?.value.trim();
  const fb     = document.getElementById('new-obj-feedback');

  if (!name) { fb.textContent = 'Il nome è obbligatorio'; fb.style.color = 'var(--red)'; return; }

  const ra_h  = parseRA(raStr);
  const dec_d = parseDec(decStr);
  if (isNaN(ra_h) || isNaN(dec_d)) {
    fb.textContent = 'RA o Dec non validi'; fb.style.color = 'var(--red)';
    return;
  }

  const obj = {
    name,
    alias:    alias  || null,
    obj_type: type   || null,
    ra_h,
    dec_d,
    notes:    notes  || null,
  };

  fb.textContent = 'Salvataggio…'; fb.style.color = 'var(--text2)';

  try {
    const saved = await saveUserObject(obj);
    fb.textContent = `✓ "${saved.name}" salvato nel catalogo`; fb.style.color = 'var(--green)';
    // Pre-popola i campi principali con il nuovo oggetto
    selectObj(saved.n, saved.r, saved.d, saved.a || saved.n);
    if(typeof sNightRefresh==='function')sNightRefresh();
    // Reset form
    ['new-obj-name','new-obj-alias','new-obj-type','new-obj-ra','new-obj-dec','new-obj-notes']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  } catch(e) {
    fb.textContent = `✗ ${e.message}`; fb.style.color = 'var(--red)';
  }
}

// Precompila RA/Dec del form "aggiungi" con i valori già inseriti nei campi principali
function syncAddFormFromMain() {
  const ra = document.getElementById('s-ra')?.value;
  const dec = document.getElementById('s-dec')?.value;
  const name = document.getElementById('s-objname')?.value;
  if (ra)   { const el = document.getElementById('new-obj-ra');   if(el && !el.value) el.value = ra; }
  if (dec)  { const el = document.getElementById('new-obj-dec');  if(el && !el.value) el.value = dec; }
  if (name) { const el = document.getElementById('new-obj-name'); if(el && !el.value) el.value = name; }
}
