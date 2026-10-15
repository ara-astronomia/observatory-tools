// Configurazione locale condivisa da StarAlt, ETC, SNR Analyzer e Sky Monitor.
const OBS_SETTINGS_KEY='observatory-tools:settings:v1';
const OBS_SETTINGS_DEFAULTS={
  site:{lat:42.27,lon:12.80,elevM:460,timeZone:'Europe/Rome'},
  telescope:{diameterMm:500,focalMm:4000},
  camera:{
    model:'Moravian C3-26000M',sensor:'Sony IMX571 BSI',
    pixelUm:3.76,widthPx:6252,heightPx:4176,adcBits:16,
    darkCurrent:0.2,nativeBin:2,
    gainModes:[
      {label:'0 dB · 1×',gainNum:0,ePerADU:0.80,rn:3.51,fwc:52800},
      {label:'9.7 dB · 3×',gainNum:2749,ePerADU:0.26,rn:3.15,fwc:17000},
      {label:'9.7 dB HCG · 3×',gainNum:2750,ePerADU:0.26,rn:1.46,fwc:17000},
      {label:'36 dB · 63×',gainNum:4030,ePerADU:0.012,rn:1.28,fwc:800}
    ]
  }
};
let obsSettings=structuredClone(OBS_SETTINGS_DEFAULTS);

function settingsGet(){return obsSettings;}
function settingsNum(value,min,max,name,integer=false){
  const n=Number(value);
  if(value===''||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))
    throw new Error(name+': valore non valido.');
  return n;
}
function settingsValidated(raw){
  const site=raw?.site||{},tel=raw?.telescope||{},cam=raw?.camera||{};
  const timeZone=String(site.timeZone||'').trim();
  try{new Intl.DateTimeFormat('en-US',{timeZone});}catch(e){throw new Error('Fuso orario IANA non valido.');}
  const gainModes=cam.gainModes;
  if(!Array.isArray(gainModes)||gainModes.length<1||gainModes.length>8)
    throw new Error('Servono da 1 a 8 modalità gain.');
  const modes=gainModes.map((g,i)=>{
    const label=String(g.label||'').trim();
    if(!label||label.length>60)throw new Error('Etichetta gain '+(i+1)+' non valida.');
    return{
      label,gainNum:settingsNum(g.gainNum,0,100000,'Gain # '+(i+1),true),
      ePerADU:settingsNum(g.ePerADU,0.000001,1000,'e⁻/ADU '+(i+1)),
      rn:settingsNum(g.rn,0.0001,1000,'Rumore di lettura '+(i+1)),
      fwc:settingsNum(g.fwc,1,1e9,'FWC '+(i+1))
    };
  });
  const model=String(cam.model||'').trim(),sensor=String(cam.sensor||'').trim();
  if(!model||model.length>80||!sensor||sensor.length>80)
    throw new Error('Nome camera e sensore obbligatori (massimo 80 caratteri).');
  return{
    site:{
      lat:settingsNum(site.lat,-90,90,'Latitudine'),
      lon:settingsNum(site.lon,-180,180,'Longitudine'),
      elevM:settingsNum(site.elevM,-500,10000,'Altitudine'),
      timeZone
    },
    telescope:{
      diameterMm:settingsNum(tel.diameterMm,50,5000,'Diametro'),
      focalMm:settingsNum(tel.focalMm,100,30000,'Lunghezza focale')
    },
    camera:{
      model,sensor,
      pixelUm:settingsNum(cam.pixelUm,0.1,100,'Dimensione pixel'),
      widthPx:settingsNum(cam.widthPx,1,50000,'Larghezza sensore',true),
      heightPx:settingsNum(cam.heightPx,1,50000,'Altezza sensore',true),
      adcBits:settingsNum(cam.adcBits,8,32,'Bit ADC',true),
      darkCurrent:settingsNum(cam.darkCurrent,0,1000,'Dark current'),
      nativeBin:settingsNum(cam.nativeBin,1,2,'Binning in camera',true),
      gainModes:modes
    }
  };
}
function settingsSetupKey(value=obsSettings){
  const s=value.site,t=value.telescope,c=value.camera;
  const fingerprint=[s.lat,s.lon,s.elevM,t.diameterMm,t.focalMm,c.model,c.sensor,c.pixelUm,c.widthPx,c.heightPx,c.adcBits];
  const base=OBS_SETTINGS_DEFAULTS;
  const b=[base.site.lat,base.site.lon,base.site.elevM,base.telescope.diameterMm,base.telescope.focalMm,
    base.camera.model,base.camera.sensor,base.camera.pixelUm,base.camera.widthPx,base.camera.heightPx,base.camera.adcBits];
  return JSON.stringify(fingerprint)===JSON.stringify(b)?'legacy':'v1:'+JSON.stringify(fingerprint);
}
function settingsPlateScale(bin=1){
  return 206265*obsSettings.camera.pixelUm/1000*bin/obsSettings.telescope.focalMm;
}
function settingsAdcMax(){return Math.pow(2,obsSettings.camera.adcBits)-1;}
function settingsFileMiB(bin=1){
  const c=obsSettings.camera;
  const bytes=c.adcBits<=16?2:4;
  return c.widthPx*c.heightPx*bytes/(bin*bin*1048576);
}
function settingsEscape(value){
  return String(value).replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function settingsLoad(){
  try{
    const stored=JSON.parse(localStorage.getItem(OBS_SETTINGS_KEY)||'null');
    if(stored)obsSettings=settingsValidated(stored);
  }catch(e){
    document.getElementById('settings-status').textContent='Impostazioni locali non leggibili: uso i valori iniziali. '+e.message;
  }
}
function settingsRenderForm(value=obsSettings){
  const s=value.site,t=value.telescope,c=value.camera;
  const fields={
    'set-lat':s.lat,'set-lon':s.lon,'set-elev':s.elevM,'set-timezone':s.timeZone,
    'set-diameter':t.diameterMm,'set-focal':t.focalMm,
    'set-camera':c.model,'set-sensor':c.sensor,'set-pixel':c.pixelUm,
    'set-width':c.widthPx,'set-height':c.heightPx,'set-adc':c.adcBits,
    'set-dark':c.darkCurrent,'set-native-bin':c.nativeBin
  };
  for(const[id,value]of Object.entries(fields))document.getElementById(id).value=value;
  settingsRenderGainRows(value.camera.gainModes);
  settingsUpdatePreview();
}
function settingsRenderGainRows(modes=obsSettings.camera.gainModes){
  document.getElementById('set-gain-rows').innerHTML=modes.map((g,i)=>`
    <tr>
      <td><input type="text" maxlength="60" value="${settingsEscape(g.label)}" aria-label="Nome modalità gain ${i+1}"></td>
      <td><input type="number" step="1" min="0" value="${g.gainNum}" aria-label="Gain numero modalità ${i+1}"></td>
      <td><input type="number" step="any" min="0.0001" value="${g.rn}" aria-label="Rumore lettura modalità ${i+1}"></td>
      <td><input type="number" step="any" min="1" value="${g.fwc}" aria-label="FWC modalità ${i+1}"></td>
      <td><input type="number" step="any" min="0.000001" value="${g.ePerADU}" aria-label="Elettroni per ADU modalità ${i+1}"></td>
      <td><button type="button" class="snr-cal-remove" aria-label="Elimina modalità gain ${i+1}" onclick="settingsRemoveGain(${i})">×</button></td>
    </tr>`).join('');
}
function settingsReadDraft(){
  const get=id=>document.getElementById(id).value;
  const rows=[...document.querySelectorAll('#set-gain-rows tr')];
  return{
    site:{lat:get('set-lat'),lon:get('set-lon'),elevM:get('set-elev'),timeZone:get('set-timezone')},
    telescope:{diameterMm:get('set-diameter'),focalMm:get('set-focal')},
    camera:{
      model:get('set-camera'),sensor:get('set-sensor'),pixelUm:get('set-pixel'),
      widthPx:get('set-width'),heightPx:get('set-height'),adcBits:get('set-adc'),
      darkCurrent:get('set-dark'),nativeBin:get('set-native-bin'),
      gainModes:rows.map(row=>{
        const input=row.querySelectorAll('input');
        return{label:input[0].value,gainNum:input[1].value,rn:input[2].value,
          fwc:input[3].value,ePerADU:input[4].value};
      })
    }
  };
}
function settingsAddGain(){
  const body=document.getElementById('set-gain-rows');
  if(body.rows.length>=8)return;
  const row=body.insertRow();
  const labels=['Nome modalità','Gain #','σ_r','FWC','e⁻/ADU'];
  const types=['text','number','number','number','number'];
  const values=['Nuova modalità','0','3','10000','1'];
  for(let i=0;i<5;i++){
    const cell=row.insertCell();
    const input=document.createElement('input');
    input.type=types[i];input.value=values[i];input.setAttribute('aria-label',labels[i]+' nuova modalità');
    if(i)input.step='any';
    cell.appendChild(input);
  }
  const cell=row.insertCell(),button=document.createElement('button');
  button.type='button';button.className='snr-cal-remove';button.textContent='×';
  button.setAttribute('aria-label','Elimina nuova modalità gain');
  button.onclick=()=>row.remove();
  cell.appendChild(button);
  row.querySelector('input')?.focus();
}
function settingsRemoveGain(index){
  const rows=document.querySelectorAll('#set-gain-rows tr');
  if(rows.length<=1){
    document.getElementById('settings-status').textContent='Deve restare almeno una modalità gain.';
    return;
  }
  rows[index]?.remove();
}
function settingsUpdatePreview(){
  const diameter=Number(document.getElementById('set-diameter').value);
  const focal=Number(document.getElementById('set-focal').value);
  const pixel=Number(document.getElementById('set-pixel').value);
  const el=document.getElementById('settings-preview');
  if(!(diameter>0&&focal>0&&pixel>0)){el.textContent='Inserisci diametro, focale e pixel validi.';return;}
  const scale=206265*pixel/1000/focal;
  el.textContent='Rapporto focale f/'+(focal/diameter).toFixed(2)+' · scala 1×1 '+scale.toFixed(3)+'″/px';
}
function settingsRenderBindings(){
  const s=obsSettings.site,t=obsSettings.telescope,c=obsSettings.camera;
  const write=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  write('s-site-summary',s.lat.toFixed(3)+'°, '+s.lon.toFixed(3)+'° · '+s.elevM+' m s.l.m. · '+s.timeZone);
  write('e-optics-summary','Ø '+t.diameterMm+' mm · '+t.focalMm+' mm · f/'+(t.focalMm/t.diameterMm).toFixed(2));
  write('e-focal-shown',t.focalMm);
  write('n-focal-shown',t.focalMm);
  write('n-camera-model',c.model);
  write('n-camera-sensor',c.sensor);
  write('n-camera-pixel',c.pixelUm.toFixed(2)+' µm');
  write('n-camera-adc',c.adcBits+' bit');
  write('e-camera-model',c.model+' · '+c.sensor);
  write('e-camera-pixel',c.pixelUm.toFixed(2)+' µm');
  write('e-camera-adc',c.adcBits+' bit');
  write('sky-setup-summary',s.lat.toFixed(3)+'°, '+s.lon.toFixed(3)+'° · '+s.elevM+' m · Ø '+t.diameterMm+' / '+t.focalMm+' mm · '+c.model+' · '+c.pixelUm.toFixed(2)+' µm');
  if(typeof snrRenderGainButtons==='function')snrRenderGainButtons();
  if(typeof etcRenderGainButtons==='function')etcRenderGainButtons();
  if(typeof etcRenderBinningOptions==='function')etcRenderBinningOptions();
}
function settingsInit(){
  settingsLoad();
  document.getElementById('n-dc').value=obsSettings.camera.darkCurrent;
  document.getElementById('e-dc').value=obsSettings.camera.darkCurrent;
  const dcSlider=document.getElementById('n-dc');
  dcSlider.max=Math.max(5,obsSettings.camera.darkCurrent);
  document.getElementById('n-dc-v').max=dcSlider.max;
  settingsRenderForm();
  settingsRenderBindings();
}
function settingsSave(){
  const status=document.getElementById('settings-status');
  try{
    const next=settingsValidated(settingsReadDraft());
    const oldKey=settingsSetupKey();
    const oldDark=obsSettings.camera.darkCurrent;
    obsSettings=next;
    if(oldDark!==next.camera.darkCurrent){
      const dcSlider=document.getElementById('n-dc');
      dcSlider.max=Math.max(5,next.camera.darkCurrent);
      dcSlider.value=next.camera.darkCurrent;
      document.getElementById('n-dc-v').max=dcSlider.max;
      document.getElementById('e-dc').value=next.camera.darkCurrent;
    }
    let saved=true;
    try{localStorage.setItem(OBS_SETTINGS_KEY,JSON.stringify(next));}
    catch(e){saved=false;}
    settingsRenderForm();
    settingsRenderBindings();
    if(typeof initStarAltTimezone==='function')initStarAltTimezone(true);
    if(document.getElementById('s-resultArea')?.style.display==='block' && typeof sCompute==='function')sCompute();
    if(typeof snrCalOnSettingsChanged==='function'&&oldKey!==settingsSetupKey())snrCalOnSettingsChanged();
    if(typeof snrUpdate==='function')snrUpdate();
    if(typeof etcCompute==='function')etcCompute();
    if(typeof skySettingsChanged==='function')skySettingsChanged();
    if(oldKey!==settingsSetupKey()&&typeof etcSkyAutoFill==='function')etcSkyAutoFill().then(()=>etcCompute());
    status.textContent=saved?'Impostazioni applicate alle schede e salvate in questo browser.':'Modifiche applicate, ma il browser non le ha salvate. Esporta il JSON.';
  }catch(e){status.textContent=e.message;}
}
function settingsExport(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,settings:obsSettings},null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='observatory-impostazioni.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function settingsImport(event){
  const file=event.target.files?.[0];
  if(!file)return;
  try{
    if(file.size>1024*1024)throw new Error('File troppo grande.');
    const payload=JSON.parse(await file.text());
    if(payload.version!==1||!payload.settings)throw new Error('Formato impostazioni non riconosciuto.');
    const imported=settingsValidated(payload.settings);
    settingsRenderForm(imported);
    settingsSave();
  }catch(e){document.getElementById('settings-status').textContent=e.message;}
  finally{event.target.value='';}
}
