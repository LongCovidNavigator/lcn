if(!document.querySelector('[data-feedback-reference-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='styles/feedback_reference.css?v=reference-combobox-20261107';css.dataset.feedbackReferenceStyle='';document.head.append(css);}
// Shared page reference editor. Never copies search text or arbitrary URL parameters.
const pages={
 'index.html':'Startseite','top_behandler.html':'Top-Behandler:innen','top_therapien.html':'Top-Therapien',
 'hausarzt_suche.html':'Hausärzt:innen','behandler_suche.html':'Behandler:innen-Suche','therapien_suche.html':'Therapie-Suche',
 'behandler_vorschlagen.html':'Behandler:in vorschlagen','behandlung_vorschlagen.html':'Therapie vorschlagen',
 'mitgestalten.html':'Mitgestalten','symptome.php':'Symptomübersicht','impressum.html':'Impressum','datenschutz.html':'Datenschutz',
 'arzt_detail.html':'Behandler-Detailseite','therapie_detail.php':'Therapie-Detailseite'
};
const aliases={'aerzte_karte.html':'behandler_suche.html','therapien_karte.html':'therapien_suche.html','top_behandlungen.html':'top_therapien.html','arzt_vorschlagen.html':'behandler_vorschlagen.html','eintrag_vorschlagen.html':'behandler_vorschlagen.html'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const request=async params=>{const r=await fetch('api/feedback.php?'+new URLSearchParams(params),{credentials:'same-origin',cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Die Einträge können gerade nicht geladen werden.');return d;};
export function fromUrl(value){
 try{const url=new URL(value,location.href);if(url.origin!==location.origin)return null;let file=url.pathname.split('/').pop()||'index.html';file=aliases[file]||file;let type='',id='';if(file==='arzt_detail.html'){type='doctor';id=url.searchParams.get('id')||'';}if(file==='therapie_detail.php'||file==='therapie_detail.html'){type='treatment';id=url.searchParams.get('treatment_id')||url.searchParams.get('nd_id')||url.searchParams.get('treat_id')||'';file='therapie_detail.php';}if(!pages[file])return null;if(type&&!/^\d+$/.test(id))return null;
 const hash=/^#[a-z][a-z0-9_-]{0,63}$/i.test(url.hash)?url.hash:'';
 return {page_path:file+(type?'?'+new URLSearchParams({[type==='doctor'?'id':'treatment_id']:id}):'')+hash,entity_type:type,entity_id:id,name:pages[file],tab:hash.slice(1)};
 }catch{return null;}
}
export function initialReference(){
 const params=new URLSearchParams(location.search);let stored=null;
 try{const raw=sessionStorage.getItem('lcn-feedback-source');sessionStorage.removeItem('lcn-feedback-source');if(raw){const source=JSON.parse(raw);const safe=fromUrl(source.page_path);if(safe&&Date.now()-source.time<300000)stored={...safe,name:String(source.name||safe.name).slice(0,180),tab:String(source.tab||safe.tab).slice(0,180),heading:String(source.heading||'').slice(0,180)};}}catch{}
 if(params.get('page_path')){const explicit=fromUrl(params.get('page_path'));if(explicit)return stored?.page_path===explicit.page_path?stored:explicit;}
 if(location.pathname.endsWith('/mitgestalten.html')){
  if(stored)return stored;
  if(document.referrer){const source=fromUrl(document.referrer);if(source&&!source.page_path.startsWith('mitgestalten.html'))return source;}
 }
 return fromUrl(location.href)||fromUrl('index.html');
}
let counter=0;
export function mountReference(form,initial){
 const safe=fromUrl(initial?.page_path||location.href)||fromUrl('index.html');const original={...safe,name:String(initial?.name||safe.name).slice(0,180),tab:String(initial?.tab||safe.tab).slice(0,180),heading:String(initial?.heading||'').slice(0,180)};
 const id='fb-ref-'+(++counter),box=document.createElement('fieldset');box.className='fb-reference';
 box.innerHTML=`<legend>Seitenbezug</legend><p class="fb-reference-hint">Passt diese Seite zu deinem Beitrag?</p><div class="fb-reference-decisions"><label><input type="radio" name="reference_mode" value="confirm" required checked> Ja, diese Seite</label><label><input type="radio" name="reference_mode" value="none" required> Ohne Seitenbezug</label><label><input type="radio" name="reference_mode" value="other" required> Andere Seite auswählen</label></div><div class="fb-reference-other" hidden><label>Welche Seite?<select data-reference-page><option value="">Bitte auswählen</option>${Object.entries(pages).map(([path,label])=>`<option value="${esc(path)}">${esc(label)}</option>`).join('')}</select></label><div data-reference-entity hidden><label for="${id}-search" data-reference-search-label></label><div class="fb-reference-combobox"><input type="search" id="${id}-search" maxlength="100" data-reference-search autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-results"><button type="button" data-reference-toggle aria-label="Vorschläge anzeigen" aria-controls="${id}-results" aria-expanded="false">▾</button><div class="fb-reference-popup" hidden><ul id="${id}-results" data-reference-results role="listbox"></ul><p class="fb-reference-status" role="status"></p></div></div></div></div><p class="fb-reference-selected" role="status" aria-live="polite" hidden></p><input type="hidden" name="page_path"><input type="hidden" name="entity_type"><input type="hidden" name="entity_id"><input type="hidden" name="page_section"><input type="hidden" name="page_element">`;
 // A legend groups native radio controls; all generated identifiers are local to this form.
 box.id=id;form.prepend(box);
 const other=box.querySelector('.fb-reference-other'),page=box.querySelector('[data-reference-page]'),entity=box.querySelector('[data-reference-entity]'),search=box.querySelector('[data-reference-search]'),results=box.querySelector('[data-reference-results]'),status=box.querySelector('.fb-reference-status'),popup=box.querySelector('.fb-reference-popup'),toggle=box.querySelector('[data-reference-toggle]'),searchLabel=box.querySelector('[data-reference-search-label]');
 if(original.entity_type&&original.entity_id){request({action:'reference_info',entity_type:original.entity_type,entity_id:original.entity_id}).then(d=>{original.name=(original.entity_type==='doctor'?'Behandler:in: ':'Therapie: ')+d.label;sync();}).catch(()=>{});}
 function set(ref,suggestion){
  const selected=box.querySelector('.fb-reference-selected');
  const visibleReference=ref||suggestion;
  selected.hidden=!visibleReference;
  selected.replaceChildren();
  if(visibleReference){
   const pageName=pages[visibleReference.page_path.split(/[?#]/)[0]];
   const label=document.createElement('strong');
   label.textContent=visibleReference.entity_type?(visibleReference.name||pageName):pageName||visibleReference.name||visibleReference.page_path;
   selected.append(suggestion?'Vorgeschlagene Seite: ':'Einbezogene Seite: ',label);
  }
  for(const [name,value] of Object.entries({page_path:ref?.page_path||'',entity_type:ref?.entity_type||'',entity_id:ref?.entity_id||'',page_section:ref?.tab||'',page_element:ref?.heading||''}))box.querySelector(`[name="${name}"]`).value=value;
 }
 let sequence=0,timer,selectedEntity=null,items=[],active=-1;
 const entityType=()=>page.value==='arzt_detail.html'?'doctor':page.value==='therapie_detail.php'?'treatment':'';
 function sync(){
  const mode=box.querySelector('[name=reference_mode]:checked')?.value;
  const type=entityType();
  const specific=mode==='other'&&!!type;
  other.hidden=mode!=='other';
  page.required=mode==='other';
  entity.hidden=!specific;
  search.required=specific;
  search.setCustomValidity(specific&&search.value&&!selectedEntity?'Bitte wähle einen Eintrag aus den Vorschlägen.':'');
  searchLabel.textContent=type==='doctor'?'Behandler:in suchen und auswählen':'Therapie suchen und auswählen';
  results.setAttribute('aria-label',searchLabel.textContent);
  search.placeholder=type==='doctor'?'Name oder Praxis eingeben':'Therapiename eingeben';
  if(mode==='confirm')set(original);
  else if(mode==='other'&&page.value&&(!type||selectedEntity)){
   const query=type?'?'+new URLSearchParams({[type==='doctor'?'id':'treatment_id']:selectedEntity.id}):'';
   set({name:selectedEntity?.label||pages[page.value],page_path:page.value+query,entity_type:type,entity_id:selectedEntity?.id||''});
  }else set(null,mode?null:original);
 }
 function mark(index){
  active=index;
  for(const [i,option] of Array.from(results.children).entries())option.setAttribute('aria-selected',String(i===index));
  if(index<0)search.removeAttribute('aria-activedescendant');
  else{
   const option=results.children[index];
   search.setAttribute('aria-activedescendant',option.id);
   option.scrollIntoView({block:'nearest'});
  }
 }
 function expand(open){
  popup.hidden=!open;
  search.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Vorschläge schließen':'Vorschläge anzeigen');
  if(!open){
   sequence++;
   clearTimeout(timer);
   mark(-1);
  }
 }
 function suggest(delay=0){
  clearTimeout(timer);
  const seq=++sequence,query=selectedEntity?'':search.value.trim(),type=entityType();
  items=[];
  results.replaceChildren();
  mark(-1);
  status.textContent='Vorschläge werden geladen …';
  expand(true);
  timer=setTimeout(async()=>{
   try{
    const data=await request({action:'reference_search',type,q:query});
    if(seq!==sequence)return;
    items=data.items;
    results.replaceChildren(...items.map((item,index)=>{
     const option=document.createElement('li');
     option.id=id+'-option-'+index;
     option.setAttribute('role','option');
     option.setAttribute('aria-selected','false');
     option.textContent=item.label;
     return option;
    }));
    status.textContent=items.length?'':'Keine passenden Einträge gefunden.';
   }catch(err){if(seq===sequence)status.textContent=err.message;}
  },delay);
 }
 function choose(index){
  selectedEntity=items[index];
  search.value=selectedEntity.label;
  expand(false);
  sync();
 }
 function resetSearch(){
  expand(false);
  selectedEntity=null;
  search.value='';
 }
 box.querySelectorAll('[name=reference_mode]').forEach(r=>r.onchange=()=>{expand(false);sync();});
 page.onchange=()=>{resetSearch();sync();};
 search.addEventListener('input',()=>{selectedEntity=null;sync();suggest(250);});
 search.addEventListener('blur',()=>expand(false));
 toggle.addEventListener('pointerdown',event=>event.preventDefault());
 toggle.addEventListener('click',()=>{
  search.focus();
  if(popup.hidden)suggest();
  else expand(false);
 });
 results.addEventListener('pointerdown',event=>event.preventDefault());
 results.addEventListener('click',event=>{
  const option=event.target.closest('[role=option]');
  if(option)choose(Array.from(results.children).indexOf(option));
 });
 search.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!popup.hidden){
   event.preventDefault();
   event.stopPropagation();
   expand(false);
  }else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   if(popup.hidden)suggest();
   else if(items.length){
    const index=active<0?(event.key==='ArrowDown'?0:items.length-1):active+(event.key==='ArrowDown'?1:-1);
    mark((index+items.length)%items.length);
   }
  }else if(event.key==='Enter'&&!popup.hidden){
   event.preventDefault();
   if(active>=0)choose(active);
  }
 });
 function reset(){
  page.value='';
  resetSearch();
  sync();
 }
 sync();
 return {box,reset};
}
