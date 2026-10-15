// Calibrazione empirica del picco stellare per filtro.
// Ogni misura usa un'immagine calibrata 1×1: magnitudine, picco sopra fondo,
// FWHM della stessa immagine. Il modello del profilo è quello usato da SNR.
const SNR_CAL_STORAGE_KEY='observatory-tools:snr-calibration:v2';
const SNR_CAL_LEGACY_KEY='observatory-tools:snr-calibration:v1';
const SNR_CAL_FILTERS=['B','V','R','I','gp','rp'];
const SNR_CAL_MAX_ROWS=500;
let snrCalProfiles=Object.create(null);
let snrCalData=Object.fromEntries(SNR_CAL_FILTERS.map(f=>[f,[]]));
let snrCalRevision=Object.fromEntries(SNR_CAL_FILTERS.map(f=>[f,0]));
let snrCalOrigin=null;

function snrCalSanitizeRows(rows){
  if(!Array.isArray(rows))return[];
  return rows.slice(0,SNR_CAL_MAX_ROWS).filter(r=>r&&typeof r==='object').map(r=>({
    mag:String(r.mag??'').slice(0,40),
    flux:String(r.flux??'').slice(0,40),
    fwhm:String(r.fwhm??'').slice(0,40)
  }));
}
function snrCalEscape(value){
  return String(value).replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function snrCalEmptyProfile(){
  return Object.fromEntries(SNR_CAL_FILTERS.map(f=>[f,[]]));
}
function snrCalSanitizeProfile(filters){
  const profile=snrCalEmptyProfile();
  for(const filter of SNR_CAL_FILTERS)profile[filter]=snrCalSanitizeRows(filters?.[filter]);
  return profile;
}
function snrCalSelectProfile(){
  const key=settingsSetupKey();
  if(!snrCalProfiles[key])snrCalProfiles[key]=snrCalEmptyProfile();
  snrCalData=snrCalProfiles[key];
  snrCalRevision=Object.fromEntries(SNR_CAL_FILTERS.map(f=>[f,0]));
  snrCalOrigin=null;
  document.getElementById('n-cal-setup').textContent=
    key==='legacy'?'Configurazione iniziale':'Configurazione attuale da Impostazioni';
  snrCalRender();
}
function snrCalOnSettingsChanged(){
  const wasCalibrated=!!snrCalOrigin;
  snrCalSelectProfile();
  if(wasCalibrated){
    document.getElementById('n-sig').value=80;
    document.getElementById('n-sig-v').value=80;
  }
  document.getElementById('n-cal-import-status').textContent=
    'Configurazione cambiata: misure precedenti conservate nel loro profilo.';
  document.getElementById('n-sig-origin').textContent=wasCalibrated
    ?'Stima precedente rimossa: applica una calibrazione del nuovo profilo.'
    :'Segnale manuale da ricontrollare per la nuova configurazione.';
}
function snrCalSave(){
  try{
    localStorage.setItem(SNR_CAL_STORAGE_KEY,JSON.stringify({version:2,profiles:snrCalProfiles}));
    document.getElementById('n-cal-storage').textContent='Salvataggio automatico in questo browser';
  }catch(e){
    document.getElementById('n-cal-storage').textContent='Salvataggio locale non disponibile: esporta i dati prima di chiudere';
  }
}
function snrCalInit(){
  try{
    const saved=JSON.parse(localStorage.getItem(SNR_CAL_STORAGE_KEY)||'null');
    if(saved?.version===2&&saved.profiles&&typeof saved.profiles==='object'){
      for(const [key,filters] of Object.entries(saved.profiles)){
        if(key.length<1000)snrCalProfiles[key]=snrCalSanitizeProfile(filters);
      }
    }else{
      const old=JSON.parse(localStorage.getItem(SNR_CAL_LEGACY_KEY)||'null');
      if(old?.version===1&&old.filters)
        snrCalProfiles.legacy=snrCalSanitizeProfile(old.filters);
    }
  }catch(e){
    document.getElementById('n-cal-storage').textContent='Dati locali non leggibili: puoi importare un file JSON';
  }
  snrCalSelectProfile();
}
function snrCalFilterChanged(){
  snrCalRender();
  snrUpdate();
}
function snrCalRender(){
  const filter=document.getElementById('n-filter').value;
  document.getElementById('n-cal-filter').textContent=document.getElementById('n-filter').selectedOptions[0].textContent;
  const rows=snrCalData[filter];
  const body=document.getElementById('n-cal-rows');
  body.innerHTML=rows.length?rows.map((row,index)=>`
    <tr>
      <td><input type="number" step="0.01" min="-40" max="40" value="${snrCalEscape(row.mag)}" aria-label="Magnitudine di catalogo misura ${index+1}" oninput="snrCalCell(${index},'mag',this.value)"></td>
      <td><input type="number" step="any" min="0" value="${snrCalEscape(row.flux)}" aria-label="Picco stella misura ${index+1} in elettroni per pixel al secondo" oninput="snrCalCell(${index},'flux',this.value)"></td>
      <td><input type="number" step="0.01" min="0.01" max="60" value="${snrCalEscape(row.fwhm)}" aria-label="FWHM misura ${index+1} in arcsec" oninput="snrCalCell(${index},'fwhm',this.value)"></td>
      <td class="snr-cal-residual" data-index="${index}">—</td>
      <td><button type="button" class="snr-cal-remove" aria-label="Elimina misura ${index+1}" onclick="snrCalRemove(${index})">×</button></td>
    </tr>`).join(''):'<tr><td colspan="5" class="snr-cal-empty">Nessuna misura per questo filtro. Aggiungi la prima riga.</td></tr>';
  snrCalRefresh();
}
function snrCalAdd(){
  const filter=document.getElementById('n-filter').value;
  if(snrCalData[filter].length>=SNR_CAL_MAX_ROWS){
    document.getElementById('n-cal-status').textContent='Limite di 500 misure per filtro.';
    return;
  }
  snrCalData[filter].push({mag:'',flux:'',fwhm:''});
  snrCalRevision[filter]++;
  snrCalSave();
  snrCalRender();
  document.querySelector('#n-cal-rows tr:last-child input')?.focus();
}
function snrCalRemove(index){
  const filter=document.getElementById('n-filter').value;
  if(!snrCalData[filter][index])return;
  snrCalData[filter].splice(index,1);
  snrCalRevision[filter]++;
  snrCalSave();
  snrCalRender();
}
function snrCalCell(index,field,value){
  const filter=document.getElementById('n-filter').value;
  const row=snrCalData[filter][index];
  if(!row||!['mag','flux','fwhm'].includes(field))return;
  row[field]=value;
  snrCalRevision[filter]++;
  snrCalSave();
  snrCalRefresh();
}
function snrCalValidRows(filter){
  const valid=[];
  let incomplete=0;
  for(const [index,row] of snrCalData[filter].entries()){
    if(!row.mag&&!row.flux&&!row.fwhm)continue;
    const mag=Number(row.mag),flux=Number(row.flux),fwhm=Number(row.fwhm);
    if(row.mag!==''&&row.flux!==''&&row.fwhm!==''&&
       Number.isFinite(mag)&&mag>=-40&&mag<=40&&
       Number.isFinite(flux)&&flux>0&&flux<=1e12&&
       Number.isFinite(fwhm)&&fwhm>0&&fwhm<=60){
      valid.push({index,mag,flux,fwhm});
    }else incomplete++;
  }
  return{valid,incomplete};
}
function snrCalPeakFraction(fwhm,plateScale){
  const sigmaPx=fwhm/plateScale/2.354820045;
  return Math.pow(snrErf(0.5/(Math.SQRT2*sigmaPx)),2);
}
// Relazione fisica Ftot = F0 · 10^(-0.4 mag).
// Fit ai minimi quadrati nel logaritmo: stima del solo F0, lasciando fissa
// la pendenza -0.4. Questo evita pendenze arbitrarie con pochi dati.
function snrCalFit(rows,plateScale){
  if(!rows.length)return null;
  const offsets=rows.map(r=>Math.log10(r.flux/snrCalPeakFraction(r.fwhm,plateScale))+0.4*r.mag);
  const intercept=offsets.reduce((sum,x)=>sum+x,0)/offsets.length;
  const rmsDex=Math.sqrt(offsets.reduce((sum,x)=>sum+(x-intercept)**2,0)/offsets.length);
  return{
    intercept,rmsDex,count:rows.length,
    minMag:Math.min(...rows.map(r=>r.mag)),
    maxMag:Math.max(...rows.map(r=>r.mag))
  };
}
function snrCalPredict(fit,mag,fwhm,plateScale){
  return Math.pow(10,fit.intercept-0.4*mag)*snrCalPeakFraction(fwhm,plateScale);
}
function snrCalEstimate(){
  const filter=document.getElementById('n-filter').value;
  const{valid,incomplete}=snrCalValidRows(filter);
  const fit=snrCalFit(valid,plate(1));
  const input=document.getElementById('n-cal-target');
  const mag=Number(input.value);
  const seeing=Number(document.getElementById('n-seeing').value);
  const targetValid=input.value!==''&&Number.isFinite(mag)&&mag>=-40&&mag<=40;
  const flux=fit&&targetValid?snrCalPredict(fit,mag,seeing,plate(1)):null;
  return{filter,valid,incomplete,fit,mag,seeing,flux,
    usable:Number.isFinite(flux)&&flux>0&&flux<=1e12};
}
function snrCalFormatFlux(flux){
  if(flux<0.000001||flux>=1e9)return flux.toExponential(3);
  return flux.toLocaleString('it-IT',{maximumFractionDigits:6});
}
function snrCalRefresh(){
  const status=document.getElementById('n-cal-status');
  if(!status)return;
  const c=snrCalEstimate();
  const count=c.valid.length;
  let message=count+' '+(count===1?'misura valida':'misure valide');
  if(c.incomplete)message+=' · '+c.incomplete+' incomplete o non valide';
  if(c.fit){
    message+=' · fit: log₁₀(F totale) = '+c.fit.intercept.toFixed(3)+' − 0,4 × mag';
    if(count>1)message+=' · dispersione RMS '+((Math.pow(10,c.fit.rmsDex)-1)*100).toFixed(1)+'%';
    else message+=' · un solo punto: dispersione non verificabile';
    if(count>1&&c.fit.rmsDex>0.08)message+=' · dispersione alta: verifica seeing, saturazione e misure';
  }else message+=' · inserisci mag, picco e FWHM della stessa immagine';
  status.textContent=message;
  for(const cell of document.querySelectorAll('.snr-cal-residual')){
    const row=c.valid.find(r=>r.index===Number(cell.dataset.index));
    if(!row||!c.fit||count<2){
      cell.textContent='—';
      cell.classList.remove('wa');
      continue;
    }
    const expected=snrCalPredict(c.fit,row.mag,row.fwhm,plate(1));
    const delta=(row.flux/expected-1)*100;
    cell.textContent=(delta>=0?'+':'')+delta.toFixed(1)+'%';
    cell.classList.toggle('wa',Math.abs(delta)>20);
  }
  const result=document.getElementById('n-cal-result');
  if(c.usable){
    let detail='Picco stimato per mag '+c.mag.toFixed(2)+' nel filtro '+document.getElementById('n-cal-filter').textContent+': '+snrCalFormatFlux(c.flux)+' e⁻/px/s con FWHM '+c.seeing.toFixed(2)+'″.';
    if(c.fit.count>1&&(c.mag<c.fit.minMag||c.mag>c.fit.maxMag))detail+=' Fuori dall’intervallo delle magnitudini misurate: stima estrapolata.';
    result.textContent=detail;
  }else{
    result.textContent=c.fit?'Inserisci una magnitudine valida per ottenere la stima.':'La stima sarà disponibile dopo almeno una misura completa.';
  }
  document.getElementById('n-cal-apply').disabled=!c.usable;
  const origin=document.getElementById('n-sig-origin');
  const otherFilter=snrCalOrigin&&snrCalOrigin.filter!==c.filter;
  const stale=snrCalOrigin&&!otherFilter&&(
    snrCalOrigin.revision!==snrCalRevision[c.filter]||
    snrCalOrigin.seeing!==c.seeing||snrCalOrigin.plateScale!==plate(1));
  origin.classList.toggle('wa',!!(otherFilter||stale));
  if(!snrCalOrigin)origin.textContent='Segnale impostato manualmente.';
  else if(otherFilter)origin.textContent='Segnale corrente stimato per un altro filtro ('+snrCalOrigin.filter+'). Applica la stima del filtro selezionato.';
  else if(stale)origin.textContent='Calibrazione o FWHM modificato dopo l’ultima stima: premi di nuovo “Usa nel calcolo”.';
  else origin.textContent='Segnale da calibrazione '+c.filter+', mag '+snrCalOrigin.mag.toFixed(2)+'.';
}
function snrCalApply(){
  const c=snrCalEstimate();
  if(!c.usable)return;
  const value=Number(c.flux.toPrecision(8));
  const slider=document.getElementById('n-sig');
  slider.min=Math.min(0.000001,value);
  slider.max=Math.max(500,Math.ceil(value));
  slider.step='any';
  slider.value=value;
  document.getElementById('n-sig-v').value=value;
  snrCalOrigin={
    filter:c.filter,mag:c.mag,seeing:c.seeing,
    plateScale:plate(1),revision:snrCalRevision[c.filter]
  };
  snrUpdate();
}
function snrCalManualSignal(){snrCalOrigin=null;}
function snrCalExport(){
  const payload={version:2,profiles:snrCalProfiles};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='snr-calibrazione-filtri.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function snrCalImport(event){
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    if(file.size>1024*1024)throw new Error('Il file supera 1 MB.');
    const payload=JSON.parse(await file.text());
    let profiles;
    if(payload.version===1&&payload.filters)profiles={legacy:payload.filters};
    else if(payload.version===2&&payload.profiles&&typeof payload.profiles==='object')
      profiles=payload.profiles;
    else throw new Error('Formato JSON di calibrazione non riconosciuto.');
    let imported=0;
    for(const [key,filters] of Object.entries(profiles)){
      if(key.length>1000||!filters||typeof filters!=='object')continue;
      if(!snrCalProfiles[key])snrCalProfiles[key]=snrCalEmptyProfile();
      for(const filter of SNR_CAL_FILTERS){
        const incoming=snrCalSanitizeRows(filters[filter]);
        const target=snrCalProfiles[key][filter];
        const existing=new Set(target.map(r=>JSON.stringify(r)));
        for(const row of incoming){
          const rowKey=JSON.stringify(row);
          if(!existing.has(rowKey)&&target.length<SNR_CAL_MAX_ROWS){
            target.push(row);existing.add(rowKey);imported++;
          }
        }
        snrCalRevision[filter]++;
      }
    }
    snrCalSave();
    snrCalRender();
    document.getElementById('n-cal-import-status').textContent=
      imported+' righe importate nei rispettivi profili.';
  }catch(e){
    document.getElementById('n-cal-import-status').textContent=e.message||'Impossibile importare il file.';
  }finally{event.target.value='';}
}
