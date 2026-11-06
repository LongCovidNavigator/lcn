if(!document.querySelector('[data-feedback-reference-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='styles/feedback_reference.css?v=reference-first-2';css.dataset.feedbackReferenceStyle='';document.head.append(css);}
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
 box.innerHTML=`<legend>Seitenbezug</legend><p class="fb-reference-source"></p><p class="fb-reference-hint">Passt diese Seite zu deinem Beitrag?</p><div class="fb-reference-decisions"><label><input type="radio" name="reference_mode" value="confirm" required> Ja, diese Seite</label><label><input type="radio" name="reference_mode" value="none" required> Ohne Seitenbezug</label><label><input type="radio" name="reference_mode" value="other" required> Andere Seite auswählen</label></div><div class="fb-reference-other" hidden><label>Welche Seite?<select data-reference-page><option value="">Bitte auswählen</option>${Object.entries(pages).map(([path,label])=>`<option value="${esc(path)}">${esc(label)}</option>`).join('')}</select></label><div data-reference-entity hidden><label><span data-reference-search-label></span><input type="search" maxlength="100" data-reference-search autocomplete="off" placeholder="Mindestens zwei Zeichen eingeben"></label><label><span data-reference-result-label>Eintrag auswählen</span><select data-reference-results><option value="">Bitte zuerst suchen</option></select></label><p class="fb-reference-status" role="status" aria-live="polite"></p></div></div><p class="fb-reference-selected" role="status" aria-live="polite" hidden></p><input type="hidden" name="page_path"><input type="hidden" name="entity_type"><input type="hidden" name="entity_id"><input type="hidden" name="page_section"><input type="hidden" name="page_element">`;
 // A legend groups native radio controls; all generated identifiers are local to this form.
 box.id=id;form.prepend(box);
 const source=box.querySelector('.fb-reference-source'),other=box.querySelector('.fb-reference-other'),page=box.querySelector('[data-reference-page]'),entity=box.querySelector('[data-reference-entity]'),search=box.querySelector('[data-reference-search]'),results=box.querySelector('[data-reference-results]'),status=box.querySelector('[role=status]');
 function describe(){source.textContent='Vorgeschlagene Seite: '+[pages[original.page_path.split(/[?#]/)[0]],original.name!==pages[original.page_path.split(/[?#]/)[0]]&&original.name,original.tab&&'Reiter: '+original.tab,original.heading&&'Bereich: '+original.heading].filter(Boolean).join(' · ');sync();}
 if(original.entity_type&&original.entity_id){request({action:'reference_info',entity_type:original.entity_type,entity_id:original.entity_id}).then(d=>{original.name=(original.entity_type==='doctor'?'Behandler:in: ':'Therapie: ')+d.label;describe();}).catch(()=>{});}
 function set(ref){const selected=box.querySelector('.fb-reference-selected');selected.hidden=!ref?.page_path;selected.replaceChildren();if(ref?.page_path){selected.append('Einbezogene Seite: ');const link=document.createElement('a');link.href=ref.page_path;link.target='_blank';link.rel='noopener';link.textContent=ref.entity_type?(ref.name||pages[ref.page_path.split(/[?#]/)[0]]):pages[ref.page_path.split(/[?#]/)[0]]||ref.name||ref.page_path;selected.append(link);if(ref.tab)selected.append(' · Reiter: '+ref.tab);if(ref.heading)selected.append(' · Bereich: '+ref.heading);}for(const [name,value] of Object.entries({page_path:ref?.page_path||'',entity_type:ref?.entity_type||'',entity_id:ref?.entity_id||'',page_section:ref?.tab||'',page_element:ref?.heading||''}))box.querySelector(`[name="${name}"]`).value=value;}
 let sequence=0,timer;
 function sync(){const mode=box.querySelector('[name=reference_mode]:checked')?.value;other.hidden=mode!=='other';page.required=mode==='other';const type=page.value==='arzt_detail.html'?'doctor':page.value==='therapie_detail.php'?'treatment':'';const specific=mode==='other'&&!!type;entity.hidden=!specific;results.required=specific;
 box.querySelector('[data-reference-search-label]').textContent=type==='doctor'?'Behandler:in suchen':'Therapie suchen';box.querySelector('[data-reference-result-label]').textContent=type==='doctor'?'Behandler:in auswählen':'Therapie auswählen';
 if(mode==='confirm')set(original);else if(mode==='other'&&page.value){set({name:type?results.selectedOptions[0]?.textContent:pages[page.value],page_path:page.value+(type&&results.value?'?'+new URLSearchParams({[type==='doctor'?'id':'treatment_id']:results.value}):''),entity_type:type,entity_id:type?results.value:''});}else set(null);
 }
 box.querySelectorAll('[name=reference_mode]').forEach(r=>r.onchange=sync);page.onchange=()=>{sequence++;clearTimeout(timer);search.value='';results.innerHTML='<option value="">Bitte zuerst suchen</option>';status.textContent='';sync();};results.onchange=sync;
 search.addEventListener('input',()=>{clearTimeout(timer);const seq=++sequence;results.innerHTML='<option value="">Bitte einen Treffer auswählen</option>';sync();const query=search.value.trim();if(query.length<2){status.textContent='Bitte mindestens zwei Zeichen eingeben.';return;}timer=setTimeout(async()=>{status.textContent='Einträge werden gesucht …';try{const data=await request({action:'reference_search',type:page.value==='arzt_detail.html'?'doctor':'treatment',q:query});if(seq!==sequence)return;results.innerHTML='<option value="">Bitte einen Treffer auswählen</option>'+data.items.map(item=>`<option value="${Number(item.id)}">${esc(item.label)}</option>`).join('');status.textContent=data.items.length?`${data.items.length} Treffer. Bitte wähle einen Eintrag aus.`:'Keine passenden Einträge gefunden.';}catch(err){if(seq===sequence)status.textContent=err.message;}},300);});
 form.addEventListener('reset',()=>setTimeout(()=>{page.value='';search.value='';results.innerHTML='<option value="">Bitte zuerst suchen</option>';sync();},0));describe();
 return {box,get:()=>Object.fromEntries(new FormData(form))};
}
