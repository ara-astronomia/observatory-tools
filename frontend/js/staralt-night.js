// Elenco osservabile della notte, con caricamento differito del catalogo OpenNGC.
let sNightEntries=[];
let sNightFiltered=[];
let sNightRendered=0;
let sNightTwilight=null;
let sNightContext=null;
let sNightLoading=false;
let sNightRefreshTimer=null;
const S_NIGHT_PAGE_SIZE=120;

function sNightClock(hour){
  const minutes=((Math.round(hour*60)%1440)+1440)%1440;
  return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}

function sNightObjects(kind){
  const main=getCatalog();
  if(kind==='messier')return main.filter(o=>o.source==='messier');
  if(kind==='landolt')return main.filter(o=>o.source==='landolt50');
  if(kind==='ngc')return [...(OPENNGC_CATALOG.ngc||[]),...(OPENNGC_CATALOG.addendum||[])];
  if(kind==='addendum')return OPENNGC_CATALOG.addendum||[];
  if(kind==='all')return dedupeCatalogObjects([...main,...(OPENNGC_CATALOG.ngc||[]),...(OPENNGC_CATALOG.addendum||[])]);
  return main.filter(o=>o.source!=='landolt50');
}

function sNightVisibility(object,samples,context){
  const ra=Number(object.r),dec=Number(object.d);
  if(!Number.isFinite(ra)||!Number.isFinite(dec))return null;
  const decRad=dec*D2R,raRad=ra*15*D2R;
  const base=Math.sin(decRad)*context.sinLat;
  const factor=Math.cos(decRad)*context.cosLat;
  const altitudeSin=sample=>base+factor*Math.cos(sample.lst-raRad);
  let previous=altitudeSin(samples[0]);
  let start=previous>=context.sinMinAlt?samples[0].hour:null;
  let maxSin=previous,maxHour=samples[0].hour;
  const windows=[];
  for(let i=1;i<samples.length;i++){
    const current=altitudeSin(samples[i]);
    if(current>maxSin){maxSin=current;maxHour=samples[i].hour;}
    if((previous>=context.sinMinAlt)!==(current>=context.sinMinAlt)){
      const fraction=(context.sinMinAlt-previous)/(current-previous);
      const crossing=samples[i-1].hour+fraction*(samples[i].hour-samples[i-1].hour);
      if(current>=context.sinMinAlt)start=crossing;
      else if(start!==null){windows.push([start,crossing]);start=null;}
    }
    previous=current;
  }
  if(start!==null)windows.push([start,samples.at(-1).hour]);
  const hours=windows.reduce((sum,[begin,end])=>sum+end-begin,0);
  if(hours<1/60)return null;
  const maxAlt=Math.asin(Math.max(-1,Math.min(1,maxSin)))*R2D;
  return {object,windows,hours,maxAlt,maxHour};
}

function sNightRefresh(){
  if(sNightLoading)return;
  const root=document.getElementById('s-night-panel');
  const dateText=document.getElementById('s-obsdate')?.value;
  if(!root||!dateText)return;
  const kind=document.getElementById('s-night-kind').value;
  if(((kind==='ngc'||kind==='all')&&!OPENNGC_CATALOG.ngc) ||
     ((kind==='ngc'||kind==='addendum'||kind==='all')&&!OPENNGC_CATALOG.addendum)){
    sNightSelectCatalog();
    return;
  }
  const date=sGetDate();
  const {lat,lon}=settingsGet().site;
  const tz=Number(document.getElementById('s-tz').value);
  const minAltText=document.getElementById('s-minalt').value;
  const minAlt=minAltText===''?20:Number(minAltText);
  if(![lat,lon,tz,minAlt].every(Number.isFinite)){
    document.getElementById('s-night-summary').textContent='Fuso orario o altitudine minima non validi.';
    return;
  }
  const jdNoon=jdLocalNoon(date,tz);
  const dusk=findSolarCrossing(jdNoon,lat,lon,-18,12,30,false);
  const dawn=findSolarCrossing(jdNoon,lat,lon,-18,24,36,true);
  if(dusk===null||dawn===null||dawn<=dusk){
    sNightContext=null;
    sNightEntries=[];
    document.getElementById('s-night-summary').textContent='Notte astronomica non disponibile per questa data e questo sito.';
    document.getElementById('s-night-rows').replaceChildren();
    return;
  }
  const count=Math.ceil((dawn-dusk)*12); // massimo cinque minuti tra campioni
  const samples=Array.from({length:count+1},(_,i)=>{
    const hour=dusk+(dawn-dusk)*i/count;
    const jd=jdNoon+(hour-12)/24;
    return {hour,lst:(gmst(jd)+lon)*D2R};
  });
  const latRad=lat*D2R;
  const context={date,tz,minAlt,sinLat:Math.sin(latRad),cosLat:Math.cos(latRad),sinMinAlt:Math.sin(minAlt*D2R)};
  sNightContext=context;
  sNightTwilight={dusk,dawn};
  sNightEntries=sNightObjects(kind).map(o=>sNightVisibility(o,samples,context)).filter(Boolean)
    .sort((a,b)=>b.hours-a.hours||b.maxAlt-a.maxAlt||a.object.n.localeCompare(b.object.n,'it'));
  sNightRender();
}

function sNightAppendRows(){
  const list=document.getElementById('s-night-rows');
  if(!list||sNightRendered>=sNightFiltered.length)return;
  const fragment=document.createDocumentFragment();
  for(const entry of sNightFiltered.slice(sNightRendered,sNightRendered+S_NIGHT_PAGE_SIZE)){
    const row=document.createElement('button');row.type='button';row.className='s-night-row';
    const name=document.createElement('span');name.className='s-night-name';
    const title=document.createElement('strong');title.textContent=entry.object.n;
    const detail=document.createElement('small');detail.textContent=`${entry.object.a||entry.object.t||''}${entry.object.source==='landolt50'?' · Landolt +50':''}`;
    name.append(title,detail);
    const windowText=document.createElement('span');windowText.className='s-night-windows';
    windowText.textContent=entry.windows.map(([begin,end])=>`${sNightClock(begin)}–${sNightClock(end)}`).join(' · ');
    const minutes=Math.round(entry.hours*60);
    const duration=document.createElement('span');duration.textContent=minutes<60?`${minutes} min`:`${entry.hours.toFixed(1)} h`;
    const altitude=document.createElement('span');altitude.textContent=`${entry.maxAlt.toFixed(0)}°`;
    const peak=document.createElement('span');peak.textContent=sNightClock(entry.maxHour);
    row.append(name,windowText,duration,altitude,peak);
    row.addEventListener('click',()=>{
      selectObj(entry.object.n,entry.object.r,entry.object.d,entry.object.a||entry.object.n);
      sCompute();
      document.querySelector('#s-resultArea .chart-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    fragment.append(row);
  }
  sNightRendered+=fragment.childElementCount;
  list.append(fragment);
}

function sNightRender(){
  const list=document.getElementById('s-night-rows');
  if(!list||!sNightContext)return;
  const query=document.getElementById('s-night-search').value.trim().toLocaleLowerCase('it');
  const minHours=Number(document.getElementById('s-night-duration').value)/60;
  sNightFiltered=sNightEntries.filter(({object,hours})=>
    hours>=minHours&&(!query||[object.n,object.a,object.t].some(value=>String(value||'').toLocaleLowerCase('it').includes(query)))
  );
  const {date,tz,minAlt}=sNightContext;
  document.getElementById('s-night-summary').textContent=
    `${sNightFiltered.length} ${sNightFiltered.length===1?'oggetto':'oggetti'} · ${date.toLocaleDateString('it-IT')} · notte astronomica ${sNightClock(sNightTwilight.dusk)}–${sNightClock(sNightTwilight.dawn)} (UTC${tz>=0?'+':''}${tz}) · alt. ≥ ${minAlt}°`;
  list.replaceChildren();
  list.scrollTop=0;
  sNightRendered=0;
  if(!sNightFiltered.length){
    const empty=document.createElement('div');empty.className='s-night-empty';
    empty.textContent='Nessun oggetto soddisfa questi criteri.';list.append(empty);
  }else sNightAppendRows();
}

async function sNightSelectCatalog(){
  const kind=document.getElementById('s-night-kind').value;
  const needed=(kind==='ngc'||kind==='all')?['ngc','addendum']:kind==='addendum'?['addendum']:[];
  if(!needed.length){sNightRefresh();return;}
  if(sNightLoading)return;
  sNightLoading=true;
  document.getElementById('s-night-summary').textContent=`Caricamento catalogo ${kind==='addendum'?'Addendum':'NGC/IC'}…`;
  document.getElementById('s-night-rows').replaceChildren();
  try{
    await Promise.all(needed.map(loadOpenNgcCatalog));
    sNightLoading=false;
    if(document.getElementById('s-night-kind').value===kind)sNightRefresh();
    else sNightSelectCatalog();
  }catch(error){
    sNightLoading=false;
    document.getElementById('s-night-summary').textContent='Impossibile caricare il catalogo NGC/IC.';
    console.error(error);
  }
}

function sNightScheduleRefresh(){
  clearTimeout(sNightRefreshTimer);
  const kind=document.getElementById('s-night-kind').value;
  if(['ngc','addendum','all'].includes(kind))sNightRefreshTimer=setTimeout(sNightRefresh,180);
  else sNightRefresh();
}

function initStarAltNightList(){
  for(const id of ['s-obsdate','s-tz','s-minalt']){
    const control=document.getElementById(id);
    control?.addEventListener('input',sNightScheduleRefresh);
    control?.addEventListener('change',()=>{
      clearTimeout(sNightRefreshTimer);
      sNightRefresh();
      if(document.getElementById('s-resultArea')?.style.display==='block')sCompute();
    });
  }
  document.getElementById('s-night-kind')?.addEventListener('change',sNightSelectCatalog);
  for(const id of ['s-night-search','s-night-duration'])
    document.getElementById(id)?.addEventListener(id==='s-night-search'?'input':'change',sNightRender);
  document.getElementById('s-night-rows')?.addEventListener('scroll',event=>{
    const list=event.currentTarget;
    if(list.scrollTop+list.clientHeight>=list.scrollHeight-list.clientHeight)sNightAppendRows();
  });
  sNightRefresh();
}
