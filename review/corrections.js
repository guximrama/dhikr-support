(() => {
'use strict';
const API='https://dhiker-review-data.stormyguild1.chatgpt.site';
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('key')){const key=fragment.get('key');if(/^[A-Za-z0-9_-]{43}$/.test(key||''))sessionStorage.setItem('dhikr-review-key',key);history.replaceState(null,'',location.pathname+location.search);}
const key=sessionStorage.getItem('dhikr-review-key');
let session=null, content=null, current=null, records=[], initialized=false, loading=false, problem='', drafts=new Map();
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const fields=['arabic','transliteration','albanian','reference'];
const labels={arabic:'Arabisht',transliteration:'Transliterimi',albanian:'Shqip',reference:'Burimi'};
const statuses={pending:'Në pritje',accepted:'Pranuar',rejected:'Kthyer'};
const dirty=()=>[...drafts.values()].some(d=>d.dirty||d.inflight);
async function request(path,options={}){const response=await fetch(API+path,{...options,headers:{Authorization:`Bearer ${key}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});let body;try{body=await response.json();}catch{body={};}if(!response.ok){const error=new Error(response.status===409?'Konflikt. Të dhënat nuk u ruajtën.':response.status===401||response.status===403?'Lidhja e rishikimit nuk është e vlefshme.':'Kërkesa dështoi. Provoni përsëri.');error.status=response.status;throw error;}return body;}
function originals(part){return Object.fromEntries(fields.map(field=>[field,part[field]||'']));}
function originalDetails(part){const details=node('details');details.className='original-details';details.append(node('summary','Origjinali'));for(const field of fields){details.append(node('div',labels[field],'edit-label'));const value=node('p',part[field]||'—');value.lang=field==='arabic'&&part[field]?'ar':'sq';value.dir=field==='arabic'&&part[field]?'rtl':'ltr';if(field==='arabic'&&part[field])value.className='review-arabic';details.append(value);}return details;}
function arabicEditor(area,part,changed,draft){
 const box=node('div',undefined,'arabic-editor');
 const original=node('div',undefined,'arabic-original');
 original.append(node('span','Origjinali','arabic-caption'));
 const source=node('p',part.arabic||'—','review-arabic');source.lang='ar';source.dir='rtl';original.append(source);
 const controls=node('div',undefined,'arabic-controls');
 const toggle=node('button','Ndrysho arabishten');toggle.type='button';toggle.setAttribute('aria-pressed','false');
 const restore=node('button','Kthe origjinalin');restore.type='button';
 const notice=node('p','','arabic-notice');notice.setAttribute('role','status');
 const letters=value=>value.normalize('NFC').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/gu,' ').trim();
 let editing=false;
 const update=()=>{
  const differs=area.value!==(part.arabic||'');
  area.readOnly=!editing;toggle.textContent=editing?'Mbyll redaktimin':'Ndrysho arabishten';toggle.setAttribute('aria-pressed',String(editing));
  original.hidden=!editing&&!differs;
  restore.hidden=!differs;restore.disabled=draft.reloading;
  notice.hidden=!differs;
  notice.textContent=letters(area.value)!==letters(part.arabic||'')?'Shkronjat ose hapësirat ndryshojnë nga origjinali. Kontrolloji më sipër.':'Shenjat ose pikësimi ndryshojnë nga origjinali.';
 };
 toggle.onclick=()=>{editing=!editing;update();if(editing)area.focus();};
 restore.onclick=()=>{if(!confirm('Të rikthehet vetëm arabishtja origjinale?'))return;area.value=part.arabic||'';changed();};
 area.spellcheck=false;area.setAttribute('autocorrect','off');area.setAttribute('autocapitalize','off');area.setAttribute('autocomplete','off');
 controls.append(toggle,restore);box.append(original,controls,area,notice);update();
 return {box,update,toggle,restore};
}
function currentParts(){return (current.compositionIds?.length?current.compositionIds:[current.id]).map(id=>content.prayers.find(p=>p.id===id)).filter(Boolean);}
function fit(area){area.style.height='auto';area.style.height=Math.min(Math.max(area.scrollHeight,80),480)+'px';}
function fitVisible(){document.querySelectorAll('#corrections textarea').forEach(area=>{if(area.getClientRects().length)fit(area);});}
if(document.fonts){document.fonts.ready.then(fitVisible);document.fonts.addEventListener('loadingdone',fitVisible);}
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fitVisible,120);});
function render(){if(!content||!current)return;const mount=document.getElementById('corrections');if(!mount)return;mount.replaceChildren();const partsElement=document.getElementById('parts');partsElement.hidden=false;const reviewSection=mount.closest('.review-section');if(session)partsElement.after(reviewSection);else partsElement.before(reviewSection);
window.DhikrReviewUI.setShareURLProvider(session?.role==='reviewer' ? publicURL=>{const shareURL=new URL(publicURL);if(session?.role==='reviewer')shareURL.hash=new URLSearchParams({key}).toString();return shareURL.href;} : null,session?.role==='reviewer'?'Kopjo për redaktim':'Kopjo lidhjen');
if(!key){mount.append(node('p','Lidhja e redaktimit mungon.','review-message'));return;}
if(loading&&!session){mount.append(node('p','Duke ngarkuar…','review-message'));return;}
if(!session){mount.append(node('p',problem||'Duke ngarkuar…','review-message'));const retry=node('button','Rifresko');retry.onclick=()=>refresh();mount.append(retry);return;}
const toolbar=node('div',undefined,'corrections-toolbar');toolbar.append(node('span',session.name|| (session.role==='owner'?'Pronari':'Rishikuesi'),'review-person'));const refreshButton=node('button',loading?'Duke ngarkuar…':'Rifresko');refreshButton.disabled=loading;refreshButton.onclick=()=>refresh(true);toolbar.append(refreshButton);mount.append(toolbar);
if(problem)mount.append(node('p',problem,'review-error'));
if(session.role==='owner'){
 const pending=records.filter(r=>r.status==='pending');const ids=[...new Set(pending.map(r=>r.entryId))];if(ids.length){const picker=node('select');picker.setAttribute('aria-label','Korrigjimet në pritje');picker.append(new Option(`Në pritje (${pending.length})`,''));for(const id of ids){const prayer=content.prayers.find(p=>p.id===id);const section=content.sections.find(s=>s.id===prayer?.section);picker.append(new Option(`${section?.label||id} · ${prayer?.number||''}`,id));}picker.onchange=()=>{if(picker.value)window.DhikrReviewUI.selectPrayer(picker.value);};toolbar.prepend(picker);}
 const suggestions=records.filter(r=>r.entryId===current.id);if(!suggestions.length){mount.append(node('p','Nuk ka korrigjime.','review-message'));return;}document.getElementById('parts').hidden=true;
 for(const record of suggestions){const part=content.prayers.find(p=>p.id===record.partId);if(!part)continue;const card=node('section',undefined,'edit-part');card.append(node('h2',`${record.author==='reviewer_1'?'Revieweri':record.author||''} · ${statuses[record.status]||record.status}`,'edit-heading'));for(const field of fields){card.append(node('div',labels[field],'edit-label'));const text=node('p',record.fields[field]||'—','proposal-text');text.lang=field==='arabic'&&record.fields[field]?'ar':'sq';text.dir=field==='arabic'&&record.fields[field]?'rtl':'ltr';if(field==='arabic')text.classList.add('review-arabic');card.append(text);}card.append(originalDetails({...part,...record.originalFields}));const actions=node('div',undefined,'review-actions');for(const [label,status] of [['Prano','accepted'],['Kthe','rejected']]){const button=node('button',label);button.disabled=record.status===status;button.onclick=async()=>{button.disabled=true;try{const result=await request(`/api/corrections/${encodeURIComponent(record.id)}/review`,{method:'PATCH',body:JSON.stringify({status,version:record.version})});records=records.map(r=>r.id===record.id?result.correction:r);problem='';render();}catch(error){problem=error.message;render();}};actions.append(button);}card.append(actions);mount.append(card);}return;
}
document.getElementById('parts').hidden=true;
for(const [index,part] of currentParts().entries()) {
 const id=`${current.id}:${part.id}`;
 let draft=drafts.get(id);
 if(!draft){
  const record=records.find(r=>r.entryId===current.id&&r.partId===part.id);
  draft={id,entryId:current.id,partId:part.id,fields:{...(record?.fields||originals(part))},version:record?.version??null,dirty:false,inflight:false,composing:false,timer:null,retries:0,blocked:false,error:'',saved:false,generation:0,reloading:false,view:null};
  drafts.set(id,draft);
 }
 const card=node('section',undefined,'edit-part');
 if(currentParts().length>1)card.append(node('h2',`Pjesa ${index+1}`,'edit-heading'));
 const actions=node('div',undefined,'review-actions save-actions');
 const status=node('span','','save-status');status.setAttribute('role','status');
 const retry=node('button','Provo përsëri');
 retry.onclick=()=>{draft.retries=0;draft.error='';saveDraft(draft);};
 const reload=node('button','Ringarko');
 reload.onclick=async()=>{
  if(draft.inflight||draft.reloading||!confirm('Të hidhen poshtë ndryshimet e paruajtura për këtë pjesë?'))return;
  clearTimeout(draft.timer);
  const generation=draft.generation;draft.reloading=true;setReloadState(draft);updateStatus(draft);
  try {
   const result=await request(`/api/corrections?entryId=${encodeURIComponent(draft.entryId)}`);
   if(draft.generation!==generation)return;
   const record=result.corrections.find(r=>r.entryId===draft.entryId&&r.partId===draft.partId);
   draft.fields={...(record?.fields||originals(part))};draft.version=record?.version??null;
   draft.dirty=false;draft.blocked=false;draft.error='';draft.retries=0;draft.saved=false;
   if(draft.view)for(const field of fields){draft.view.areas[field].value=draft.fields[field]??'';fit(draft.view.areas[field]);}
   updateStatus(draft);
  }catch(error){draft.error=error.message;updateStatus(draft);}
  finally{draft.reloading=false;setReloadState(draft);updateStatus(draft);}
 };
 actions.append(status,retry,reload);card.append(actions);
 draft.view={status,retry,reload,areas:{},arabic:null};
 for(const field of fields){
  const label=node('label',labels[field],'edit-label');const area=node('textarea');
  area.value=draft.fields[field]??'';area.lang=field==='arabic'?'ar':'sq';area.dir=field==='arabic'?'rtl':'ltr';
  if(field==='arabic')area.className='review-arabic';area.setAttribute('aria-label',labels[field]);
  const changed=()=>{draft.fields[field]=area.value;draft.generation++;draft.dirty=true;draft.lastInputAt=Date.now();fit(area);draft.view?.arabic?.update();schedule(draft);};
  area.oninput=changed;
  area.addEventListener('compositionstart',()=>{draft.composing=true;clearTimeout(draft.timer);});
  area.addEventListener('compositionend',()=>{draft.composing=false;changed();});
  draft.view.areas[field]=area;
  if(field==='arabic'){
   const caption=node('div',labels[field],'edit-label');
   draft.view.arabic=arabicEditor(area,part,changed,draft);card.append(caption,draft.view.arabic.box);
  }else{label.append(area);card.append(label);}
  requestAnimationFrame(()=>fit(area));
 }
 setReloadState(draft);updateStatus(draft);card.append(originalDetails(part));mount.append(card);
}}
function setReloadState(draft){
 if(!draft.view)return;
 for(const area of Object.values(draft.view.areas))area.disabled=draft.reloading;
 draft.view.arabic?.update();
 if(draft.view.arabic)draft.view.arabic.toggle.disabled=draft.reloading;
 draft.view.retry.disabled=draft.reloading;
 draft.view.reload.disabled=draft.reloading||draft.inflight;
}
function updateStatus(draft){
 const view=draft.view;if(!view)return;
 view.arabic?.update();
 view.status.textContent=(draft.reloading?'Duke ngarkuar…':draft.error)|| (draft.inflight?'Duke ruajtur…':draft.dirty?'Në pritje të ruajtjes…':draft.saved?'Ruajtur':'Ruhet automatikisht');
 view.retry.hidden=!draft.error||draft.blocked||draft.inflight;
 view.reload.hidden=!draft.blocked;
 view.reload.disabled=draft.inflight||draft.reloading;
 view.retry.disabled=draft.reloading;
}
function schedule(draft,delay=700){
 clearTimeout(draft.timer);updateStatus(draft);
 if(draft.blocked||draft.composing||draft.inflight||draft.reloading||!draft.dirty)return;
 // New keystrokes do not silently restart a failed request's retry budget.
 if(draft.error&&draft.retries>3)return;
 draft.timer=setTimeout(()=>saveDraft(draft),delay);
}
async function saveDraft(draft,keepalive=false){
 clearTimeout(draft.timer);
 if(session?.role!=='reviewer'||draft.blocked||draft.composing||draft.inflight||draft.reloading||!draft.dirty)return;
 const submitted={...draft.fields};draft.inflight=true;draft.error='';updateStatus(draft);
 try{
  const result=await request('/api/corrections',{method:'POST',keepalive,body:JSON.stringify({entryId:draft.entryId,partId:draft.partId,fields:submitted,baseRevision:content.meta.contentRevision,version:draft.version})});
  if(!result.correction||result.correction.version==null)throw new Error('Përgjigjja e ruajtjes nuk është e vlefshme.');
  const correction=result.correction;records=records.filter(r=>r.id!==correction.id);records.push(correction);
  draft.version=correction.version;draft.saved=true;draft.retries=0;
  draft.dirty=fields.some(field=>draft.fields[field]!==submitted[field]);
 }catch(error){
  draft.error=error.message;draft.dirty=true;
  draft.blocked=[400,401,403,409,413].includes(error.status);
  if(!draft.blocked)draft.retries++;
 }finally{
  draft.inflight=false;updateStatus(draft);
  if(draft.dirty&&!draft.blocked&&!draft.composing){
   if(!draft.error)schedule(draft,Math.max(0,700-(Date.now()-(draft.lastInputAt||0))));
   else if(draft.retries<=3)schedule(draft,Math.min(1000*2**draft.retries,8000));
  }
 }
}
function flush(keepalive=false){
 for(const draft of drafts.values()){
  if(keepalive&&new TextEncoder().encode(JSON.stringify(draft.fields)).length>48000)continue;
  if(!draft.error)saveDraft(draft,keepalive);
 }
}
async function refresh(){
 if(loading)return;
 loading=true;problem='';
 const hadEditors=session?.role==='reviewer';
 const snapshots=new Map([...drafts].filter(([,d])=>!d.dirty&&!d.inflight&&!d.reloading&&!d.composing).map(([id,d])=>[id,{draft:d,version:d.version,generation:d.generation,fields:{...d.fields}}]));
 if(!hadEditors)render();
 try{
  if(!session)session=await request('/api/session');
  const result=await request('/api/corrections');records=result.corrections;
  // Reconcile only a draft that stayed clean and idle for the entire GET.
  for(const [id,before] of snapshots){
   const draft=drafts.get(id);
   if(draft!==before.draft||draft.dirty||draft.inflight||draft.reloading||draft.composing||draft.version!==before.version||draft.generation!==before.generation||fields.some(field=>draft.fields[field]!==before.fields[field]))continue;
   const record=records.find(r=>r.entryId===draft.entryId&&r.partId===draft.partId);
   const part=content.prayers.find(p=>p.id===draft.partId);
   if(!part)continue;
   draft.fields={...(record?.fields||originals(part))};draft.version=record?.version??null;
   draft.error='';draft.blocked=false;draft.retries=0;draft.saved=!!record;
   if(draft.view)for(const field of fields){const area=draft.view.areas[field];const value=draft.fields[field]??'';if(area.value!==value){area.value=value;fit(area);}}
   updateStatus(draft);
  }
 }catch(error){problem=error.message;}
 finally{
  loading=false;
  if(!hadEditors)render();
  else {
   let message=document.querySelector('#corrections .refresh-message');
   if(!message){message=node('span','','refresh-message review-message');document.querySelector('.corrections-toolbar')?.append(message);}
   message.textContent=problem;
  }
 }
}
function start(detail){const changed=current?.id!==detail.prayer?.id;content=detail.content;current=detail.prayer;if(changed){flush();for(const draft of drafts.values())draft.view=null;}if(!initialized){initialized=true;if(key)refresh();else render();}else if(changed)render();}
document.addEventListener('dhikr:ready',event=>start(event.detail));document.addEventListener('dhikr:prayerchange',event=>start(event.detail));
if(window.DhikrReviewUI?.getContent())start({content:window.DhikrReviewUI.getContent(),prayer:window.DhikrReviewUI.getSelected()});
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush(true);else if(initialized&&key&&!dirty())refresh();});
window.addEventListener('online',()=>{for(const draft of drafts.values()){if(draft.dirty&&!draft.blocked){draft.retries=0;draft.error='';saveDraft(draft);}}});
})();
