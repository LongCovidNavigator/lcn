const dashboard=document.getElementById('review-dashboard'),list=document.getElementById('review-list'),message=document.getElementById('review-message');
const kindFilter=document.getElementById('review-kind'),searchFilter=document.getElementById('review-search');
const areaLabels={doctor:'Behandler:innen',treatment:'Therapien',symptom:'Symptome'};
const statusLabels={all:'Alle',pending:'Offen',approved:'Freigegeben',rejected:'Abgelehnt'};
const areaFilterLabels={doctor:'Alle Behandler:innen',treatment:'Alle Therapien',symptom:'Alle Symptome'};
const dashboardFilters=[['all','all','Alles'],...Object.keys(areaLabels).flatMap(area=>
 Object.entries(statusLabels).map(([status,label])=>[area,status,status==='all'?areaFilterLabels[area]:label])
)];
const saved=history.state?.reviewFilters;
let reviewType=Object.hasOwn(areaLabels,saved?.area)?saved.area:'all';
let reviewStatus=Object.hasOwn(statusLabels,saved?.status)?saved.status:'all';
if(!dashboardFilters.some(([area,status])=>area===reviewType&&status===reviewStatus))reviewStatus='all';
kindFilter.value=saved?.kind??(saved?.status==='duplicate'?'duplicate_suspect':'all');
let allItems=[],reviewKind=kindFilter.value||'all',reviewSearch='',reviewSort='created_at',reviewDirection=-1;
kindFilter.value=reviewKind;
function saveReviewFilters(){
 history.replaceState({...history.state,reviewFilters:{area:reviewType,status:reviewStatus,kind:reviewKind}},'');
}
const tile=([area,status,label])=>`<button type="button" data-area="${area}" data-status="${status}" aria-controls="review-list" aria-pressed="false" disabled><span>${label}</span><strong>–</strong></button>`;
dashboard.innerHTML=`<div class="review-dashboard-total">${tile(dashboardFilters[0])}</div>`+
 `<div class="review-dashboard-rows">${Object.entries(areaLabels).map(([area,label])=>`
  <div class="review-dashboard-row" role="group" aria-label="${label}">
   ${dashboardFilters.filter(([type])=>type===area).map(tile).join('')}
  </div>`).join('')}</div>`;
const dashboardButtons=[...dashboard.querySelectorAll('button')];
dashboardButtons.forEach(button=>button.addEventListener('click',()=>{
 reviewStatus=button.dataset.status;
 reviewType=button.dataset.area;
 reviewKind=kindFilter.value='all';
 reviewSearch=searchFilter.value='';
 saveReviewFilters();
 renderOverview();
}));
loadFragment('header-placeholder','components/header.html?v=two-add-links-20261105');
loadFragment('footer-placeholder','components/footer.html?v=f320b7bc85');
async function request(url,options={}){options.credentials='same-origin';options.headers={...(options.headers||{}),'X-LCN-Admin-Request':'1'};const response=await fetch(url,options);const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.error||'Anfrage fehlgeschlagen.');return data;}
async function loadQueue(query){
 const items=[];
 let more=true;
 while(more){
  const data=await request(`api/review_submissions.php?${query}&offset=${items.length}`);
  items.push(...data.items);
  more=data.has_more;
 }
 return items;
}
async function loadReviews(){
 message.textContent='';
 list.innerHTML='<p class="review-empty">Vorschläge werden geladen …</p>';
 try{
  const [submissions,symptoms,profile,medication]=await Promise.all([
   loadQueue('status=all'),loadQueue('queue=symptoms'),
   request('api/review_submissions.php?queue=profile').catch(error=>{
    message.textContent+=' Profilkorrekturen konnten nicht geladen werden. '+error.message;
    return {items:[]};
   }),
   request('api/review_submissions.php?queue=medication').catch(error=>{
    message.textContent+=' Medikamenten-Einordnungen konnten nicht geladen werden. '+error.message;
    return {items:[]};
   })
  ]);
  allItems=[...submissions,...symptoms,...profile.items.map(item=>({
   ...item,source:'doctor_profile',submission_id:'P-'+item.proposal_key.slice(0,8),
   entity_type:'doctor',submission_kind:'change',
   community_feedback:{confirm:item.support,oppose:0}
  })),...medication.items.map(item=>({
   ...item,source:'medication_classification',submission_id:`M-${item.treatment_id}-${item.role}`,
   entity_type:'treatment',submission_kind:'medication',
   community_feedback:{confirm:item.support,oppose:0}
  }))];
  renderOverview();
 }catch(error){
  message.textContent=error.message;
  list.replaceChildren();
 }finally{
  list.removeAttribute('data-scroll-restore-pending');
  window.dispatchEvent(new Event('lcn:scroll-ready'));
 }
}
const medicationRoles={group:'Medikamentengruppe',ingredient:'Wirkstoff',brand:'Handelsname'};
const kindLabels={medication:'Medikamenten-Einordnung',new:'Neuer Eintrag',change:'Angaben ändern',link:'Verknüpfung ergänzen',remove:'Verknüpfung entfernen',symptom:'Symptom ergänzen'};
function kind(item){if(item.source==='medication_classification')return 'medication';if(item.source==='symptom_catalog')return item.submission_kind;const p=item.payload||{};return p.treatment_relationship?.kind==='new_combination'?'new':p.treatment_relationship?'link':p.symptom_proposal?'symptom':p.relationship?.action==='remove'?'remove':p.relationship?.action==='add'?'link':item.submission_kind==='new'?'new':'change';}
function subject(item){if(item.source==='medication_classification')return item.name+' · '+medicationRoles[item.role];if(item.source==='doctor_profile')return item.name+' · '+item.field_label;const p=item.payload||{},r=p.relationship;if(item.triage_status==='possible_duplicate'&&item.duplicate_target_name){const name=p.treatment_relationship?.kind==='group'?p.treatment_relationship.group_name:item.name;return name+' ↔ '+item.duplicate_target_name;}if(p.treatment_relationship)return p.treatment_relationship.description;return r?`${r.doctor_name||'Behandler:innen #'+r.doctor_id} → ${r.treatment_name||'Therapie #'+r.treatment_id}`:p.symptom_proposal?`${p.symptom_proposal} · ${item.name}`:item.name;}
function reviewBucket(item){return item.review_status==='reviewing'?'pending':item.review_status;}
function hasDuplicateSuspicion(item){return reviewBucket(item)==='pending'&&item.triage_status==='possible_duplicate';}
function matchesRequestKind(item,requestKind){
 switch(requestKind){
  case 'all':return true;
  case 'new':return kind(item)==='new'&&!hasDuplicateSuspicion(item)&&item.review_status!=='duplicate';
  case 'new_duplicate':return kind(item)==='new'&&hasDuplicateSuspicion(item);
  case 'duplicate_suspect':return hasDuplicateSuspicion(item);
  case 'duplicate_confirmed':return item.review_status==='duplicate';
  default:return kind(item)===requestKind;
 }
}
function reviewArea(item){return item.payload?.symptom_proposal?'symptom':item.entity_type;}
function reviewKey(item){if(item.source==='medication_classification')return item.submission_id;if(item.source==='doctor_profile')return 'profile-'+item.proposal_key;return item.source==='symptom_catalog'?'symptom-'+Number(item.submission_id):Number(item.submission_id);}
function matchesReviewFilters(item,status,type,requestKind){
 return (status==='all'||reviewBucket(item)===status)&&(type==='all'||reviewArea(item)===type)&&matchesRequestKind(item,requestKind);
}
function renderOverview(){
 renderDashboard(allItems);
 const visible=allItems.filter(item=>matchesReviewFilters(item,reviewStatus,reviewType,reviewKind)&&(!reviewSearch||['#'+item.submission_id,subject(item),item.city,item.website].join(' ').toLocaleLowerCase('de').includes(reviewSearch)));
 const value=item=>reviewSort==='confirm'||reviewSort==='oppose'?Number(item.community_feedback?.[reviewSort]||0):reviewSort==='kind'?kindLabels[kind(item)]:reviewSort==='name'?subject(item):reviewSort==='review_status'?displayStatus(item):item[reviewSort];
 visible.sort((a,b)=>reviewDirection*(['submission_id','confirm','oppose'].includes(reviewSort)?(reviewSort==='submission_id'?String(value(a)).localeCompare(String(value(b)),'de',{numeric:true}):Number(value(a))-Number(value(b))):String(value(a)||'').localeCompare(String(value(b)||''),'de',{numeric:true})));
 document.getElementById('review-count').textContent=`${visible.length} von ${allItems.length} Anträgen`;
 if(!visible.length){list.innerHTML='<p class="review-empty">Keine Anträge für diese Auswahl.</p>';return;}
 const scrollHint='<p class="review-scroll-hint">Wische in der Tabelle zur Seite, um weitere Spalten und Aktionen zu sehen.</p>';
 const head=(key,text)=>`<th scope="col" aria-sort="${reviewSort===key?(reviewDirection===1?'ascending':'descending'):'none'}"><button data-sort="${key}">${text}</button></th>`;
 list.innerHTML=`${scrollHint}<div class="review-table-scroll" tabindex="0" role="region" aria-label="Anträge"><table class="review-table"><thead><tr>${head('submission_id','Nr.')}${head('kind','Art des Antrags')}${head('name','Eintrag / Zuordnung')}${head('review_status','Status')}${head('created_at','Eingegangen')}${head('confirm','Bestätigt')}${head('oppose','Widersprochen')}<th scope="col">Aktionen</th></tr></thead><tbody>${visible.map(item=>{const key=reviewKey(item);const catalog=item.source==='symptom_catalog';const profile=item.source==='doctor_profile';const medication=item.source==='medication_classification';return `<tr class="review-row" data-id="${key}"><td>#${item.submission_id}</td><td><span class="review-kind-label kind-${kind(item)}">${profile?'Profilkorrektur':esc(kindLabels[kind(item)])}</span><small>${esc(areaLabels[reviewArea(item)])}</small>${hasDuplicateSuspicion(item)?'<span class="review-duplicate-flag">Dublettenverdacht</span>':''}</td><td><button type="button" class="review-row-toggle" data-details="${key}" aria-expanded="false" aria-controls="review-details-${key}">${esc(subject(item))}</button>${duplicatePair(item)}${item.city?`<small>${esc(item.city)}</small>`:''}</td><td><span class="review-status status-${esc(reviewBucket(item))}">${esc(displayStatus(item))}</span></td><td class="review-date">${esc(item.created_at)}</td><td class="review-community" title="${esc(feedbackHint(item))}">✓ ${Number(item.community_feedback?.confirm||0)}</td><td class="review-community" title="${esc(feedbackHint(item))}">${profile||medication?'–':'× '+Number(item.community_feedback?.oppose||0)}</td><td><div class="review-actions">${reopenAction(item)}${['pending','reviewing'].includes(item.review_status)?`${profile||medication?'':catalog?'<button class="approve" data-symptom-action="approve">Freigeben</button><button class="reject" data-symptom-action="reject">Ablehnen</button>':`${item.duplicate_target_id?'<button class="merge" data-action="merge">Zusammenführen …</button>':''}<button class="approve" data-action="approve">${kind(item)==='remove'?'Entfernen':'Freigeben'}</button><button class="reject" data-action="reject">Ablehnen</button>`}`:''}</div></td></tr><tr id="review-details-${key}" hidden><td colspan="8">${profile?profileCard(item):medication?medicationCard(item):catalog?symptomCard(item):card(item)}</td></tr>`}).join('')}</tbody></table></div>`;
 list.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.sort;reviewDirection=reviewSort===key?-reviewDirection:1;reviewSort=key;renderOverview();}));
 list.querySelectorAll('.review-row').forEach(row=>row.addEventListener('click',event=>{
  if(event.target.closest('a,input,select,textarea,button:not([data-details])'))return;
  const selection=window.getSelection();
  if(event.detail&&selection?.toString()&&row.contains(selection.anchorNode))return;
  const button=row.querySelector('[data-details]');
  const details=document.getElementById(button.getAttribute('aria-controls'));
  details.hidden=!details.hidden;
  button.setAttribute('aria-expanded',String(!details.hidden));
 }));
 bindActions();
}
function renderDashboard(items){
 dashboardFilters.forEach(([type,status],index)=>{
  const button=dashboardButtons[index];
  button.querySelector('strong').textContent=items.filter(item=>matchesReviewFilters(item,status,type,'all')).length;
  button.setAttribute('aria-pressed',String(!reviewSearch&&reviewStatus===status&&reviewType===type&&reviewKind==='all'));
  button.disabled=false;
 });
}
function reopenAction(item){
 const status=item.review_status;
 if(status==='approved'&&!item.can_reopen){
  return '<span class="review-reopen-unavailable" title="Für diese Freigabe sind keine rücksetzbaren Katalogwerte gespeichert.">Kein Rücksetzstand</span>';
 }
 if(!['approved','rejected','duplicate'].includes(status))return '';
 const attribute={doctor_profile:'data-profile-action',medication_classification:'data-medication-action',symptom_catalog:'data-symptom-action'}[item.source]||'data-action';
 return `<button type="button" class="review-reopen" ${attribute}="reopen">Wieder öffnen</button>`;
}
function confirmReopen(item){
 return item.review_status!=='approved'||confirm('Antrag wieder öffnen und die gespeicherten Katalogwerte vor der Freigabe wiederherstellen?');
}
function showReopened(item){
 reviewType=reviewArea(item);
 reviewStatus='pending';
 reviewKind=kindFilter.value='all';
 reviewSearch=searchFilter.value='';
 saveReviewFilters();
}
function bindActions(){
 list.querySelectorAll('[data-medication-action]').forEach(button=>button.addEventListener('click',()=>reviewMedication(button)));

 list.querySelectorAll('[data-profile-action]').forEach(button=>button.addEventListener('click',()=>reviewProfile(button)));

 list.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>act(button)));
 list.querySelectorAll('[data-symptom-action]').forEach(button=>button.addEventListener('click',()=>reviewSymptom(button)));
}
function medicationCard(item){
 const needsTarget=item.current_role!==item.role&&['group','brand'].includes(item.role);
 return `<article class="review-card" data-medication-key="${esc(item.submission_id)}">
  <h3>${esc(item.name)}</h3>
  <p><a href="therapie_detail.php?treatment_id=${Number(item.treatment_id)}" target="_blank" rel="noopener">Therapieprofil öffnen ↗</a></p>
  ${item.review_status==='pending'?`<p>Aktuelle Einordnung: ${esc(medicationRoles[item.current_role]||'Nicht eindeutig')}</p>`:''}
  <p>Vorgeschlagene Einordnung: ${esc(medicationRoles[item.role])} · ${Number(item.support)} Stimmen</p>
  ${item.related_id?`<p><a href="therapie_detail.php?treatment_id=${Number(item.related_id)}">Verknüpfter Wirkstoff #${Number(item.related_id)}</a></p>`:''}
  ${item.review_status==='pending'?`<div class="review-actions">
   ${needsTarget?'<label>ID des zugehörigen Wirkstoffs <input type="number" min="1" data-medication-related></label>':''}
   <button class="approve" data-medication-action="approve">Einordnung übernehmen</button>
   <button class="reject" data-medication-action="reject">Ablehnen</button>
  </div>`:''}
 </article>`;
}
async function reviewMedication(button){
 const row=button.closest('.review-row');
 const card=row?document.getElementById('review-details-'+row.dataset.id).querySelector('[data-medication-key]'):button.closest('[data-medication-key]');
 const item=allItems.find(candidate=>candidate.submission_id===card.dataset.medicationKey);
 const action=button.dataset.medicationAction;
 if(action==='reopen'&&!confirmReopen(item))return;
 const target=card.querySelector('[data-medication-related]');
 if(action==='approve'){
  if(target&&(!target.value||!target.reportValidity())){message.textContent='Bitte die ID des zugehörigen Wirkstoffs angeben.';target.focus();return;}
  if(!confirm('Diese Einordnung für den Katalog übernehmen?'))return;
 }
 const controls=(row||card).querySelectorAll('button');
 controls.forEach(control=>control.disabled=true);
 try{
  const result=await request('api/review_submissions.php?queue=medication',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action,treatment_id:item.treatment_id,role:item.role,related_id:Number(target?.value)||null})
  });
  if(action==='reopen')showReopened(item);
  await loadReviews();
  if(!message.textContent)message.textContent=`Medikamenten-Einordnung: ${statusLabel(result.status)}.`;
 }catch(error){message.textContent=error.message;}
 finally{controls.forEach(control=>control.disabled=false);}
}
function profileCard(item){
 const addressLabels={loc_street:'Straße',loc_housenumber:'Hausnummer',loc_plz:'Postleitzahl',loc_city:'Ort'};
 return `<article class="review-card" data-profile-key="${item.proposal_key}">
  <h3>${esc(item.field_label)}</h3>
  <p><a href="arzt_detail.html?id=${Number(item.existing_target_id)}" target="_blank" rel="noopener">Behandlerprofil öffnen ↗</a></p>
  <div class="review-details">
   <div class="review-detail"><strong>Hinterlegter Wert</strong>${esc(item.current||'Keine Angabe')}</div>
   <div class="review-detail"><strong>Vorgeschlagener Wert</strong>${esc(item.correction||'Angabe entfernen')}</div>
  </div>
  <p>${Number(item.support)} für diesen Vorschlag · ${Number(item.confirm_current)} Bestätigungen für den hinterlegten Wert</p>
  ${item.applied_value!=null?`<p>Übernommener Wert: ${esc(item.applied_value||'Keine Angabe')}</p>`:''}
  ${item.review_status==='pending'&&item.address_fields?`<fieldset class="review-profile-address">
   <legend>Adresse zur Übernahme eintragen</legend>
   ${Object.entries(addressLabels).map(([key,label])=>`<label>${label}<input data-address-part="${key}" value="${esc(item.address_fields[key])}"></label>`).join('')}
  </fieldset>`:''}
  ${item.review_status==='pending'?`<div class="review-actions">
   ${item.can_apply?'<button class="approve" data-profile-action="approve">Vorschlag übernehmen</button>':'<p>Dieses Feld erfordert eine strukturierte redaktionelle Änderung.</p>'}
   <button class="reject" data-profile-action="reject">Ablehnen</button>
  </div>`:''}
 </article>`;
}
async function reviewProfile(button){
 const row=button.closest('.review-row');
 const card=row?document.getElementById('review-details-'+row.dataset.id).querySelector('[data-profile-key]'):button.closest('[data-profile-key]');
 const item=allItems.find(candidate=>candidate.proposal_key===card.dataset.profileKey);
 const action=button.dataset.profileAction;
 if(action==='reopen'&&!confirmReopen(item))return;
 if(action==='approve'&&!confirm('Diesen Wert jetzt im Behandlerprofil ändern?'))return;
 const controls=(row||card).querySelectorAll('button');
 controls.forEach(control=>control.disabled=true);
 try{
  const address=Object.fromEntries([...card.querySelectorAll('[data-address-part]')].map(input=>[input.dataset.addressPart,input.value]));
  const result=await request('api/review_submissions.php?queue=profile',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action,doctor_id:item.existing_target_id,proposal_key:item.proposal_key,version:item.version,address})
  });
  if(action==='reopen')showReopened(item);
  await loadReviews();
  if(!message.textContent)message.textContent=`Profilkorrektur: ${statusLabel(result.status)}.`;
 }catch(error){message.textContent=error.message;}
 finally{controls.forEach(control=>control.disabled=false);}
}
function symptomCard(item){
 const change=item.submission_kind==='change';
 return `<article class="review-card" data-symptom-key="${reviewKey(item)}">
  <h3>${esc(item.name)}</h3>
  ${change?`<p>Bisherige Kategorie: ${esc(item.category_snapshot||'Ohne Kategorie')}</p>`:''}
  <p>Vorgeschlagene Kategorie: ${esc(item.category||'Ohne Kategorie')}</p>
  ${item.reason?`<p class="review-detail">${esc(item.reason)}</p>`:''}
 </article>`;
}
async function reviewSymptom(button){
 const action=button.dataset.symptomAction;
 const approve=action==='approve';
 if(approve&&!confirm('Diesen Symptomvorschlag jetzt in den Katalog übernehmen?'))return;
 const key=button.closest('[data-symptom-key]')?.dataset.symptomKey??button.closest('.review-row').dataset.id;
 const item=allItems.find(candidate=>reviewKey(candidate)===key);
 if(action==='reopen'&&!confirmReopen(item))return;
 const controls=button.closest('tr').querySelectorAll('[data-symptom-action]');
 controls.forEach(control=>control.disabled=true);
 try{
  const id=Number(item.submission_id);
  await request('api/symptom_catalog.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action==='reopen'?'reopen':'review',id,approve})});
  if(action==='reopen')showReopened(item);
  await loadReviews();
  if(!message.textContent)message.textContent=`Symptomantrag #${id}: ${statusLabel(action==='reopen'?'pending':approve?'approved':'rejected')}.`;
 }catch(error){message.textContent=error.message;}
 finally{controls.forEach(control=>control.disabled=false);}
}
function taxonomyProposalText(proposal){
 const fields={treatmentname:'Name',typ:'Kategorie',unterkategorie:'Unterkategorie'};
 return [fields[proposal.field],`Bisher: ${proposal.previous||'Keine Angabe'}`,`Vorschlag: ${proposal.choice}`,
  ...(proposal.category?[`Hauptkategorie: ${proposal.category}`]:[])].filter(Boolean).join('\n');
}
function card(item){const p=item.payload||{},isChange=item.submission_kind==='change',triageLabel={clear:'Vorprüfung unauffällig',needs_review:'Prüfung empfohlen',possible_duplicate:'Mögliche Dublette',suspicious:'Auffällig'}[item.triage_status]||item.triage_status;const reasons=(item.triage_reasons||[]).map(reason=>`<li>${esc(reason)}</li>`).join('');const ignored=new Set(['type','existing_target_id','name','website','email','phone','confirmation']);const details=Object.entries(p).filter(([key,value])=>!ignored.has(key)&&value!==''&&value!=null&&(!Array.isArray(value)||value.length)).map(([key,value])=>`<div class="review-detail"><strong>${esc(label(key))}</strong>${esc(key==='taxonomy_proposal'?taxonomyProposalText(value):key==='treatment_relationship'?value.description:key==='relationship'&&typeof value==='object'?((value.action==='remove'?'Zuordnung entfernen: ':'Zuordnung ergänzen: ')+(value.doctor_name||'Behandler:innen #'+value.doctor_id)+' → '+(value.treatment_name||'Therapie #'+value.treatment_id)):typeof value==='object'?JSON.stringify(value,null,2):value)}</div>`).join('');const targetId=item.duplicate_target_id||item.approved_target_id||item.existing_target_id;const targetUrl=targetId?(item.entity_type==='doctor'?`arzt_detail.html?id=${targetId}`:`therapie_detail.php?treatment_id=${targetId}`):'';const mergeButton=item.duplicate_target_id?'<button class="merge" data-action="merge">Zusammenführen …</button>':'';return `<article class="review-card is-${esc(item.entity_type)}" data-id="${item.submission_id}"><div class="review-card-top"><div><span class="review-entity">${item.entity_type==='doctor'?'Behandler:innen':'Therapie'}</span><span class="review-kind">${esc(kindLabels[kind(item)])}</span><h3>${esc(item.name)}</h3>${duplicatePair(item)}</div><span class="review-date">${esc(item.created_at)}</span></div><div class="review-triage is-${esc(item.triage_status)}"><strong>${esc(triageLabel)}</strong><span>Prüfwert ${item.triage_score}/100</span>${reasons?`<ul>${reasons}</ul>`:''}${targetUrl?`<a href="${targetUrl}" target="_blank">Bestehenden Eintrag vergleichen ↗</a>`:''}</div><div class="review-links">${item.website?`<a href="${esc(item.website)}" target="_blank" rel="noopener">Quelle öffnen ↗</a>`:'<span>Keine Website angegeben</span>'}${item.email?`<a href="mailto:${esc(item.email)}">${esc(item.email)}</a>`:''}${item.phone?`<span>${esc(item.phone)}</span>`:''}${item.city?`<span>${esc(item.city)}</span>`:''}${item.experience?`<strong>Erfahrung: ${esc(item.experience)}</strong>`:''}</div><details open><summary>Eingereichte Angaben</summary><div class="review-details">${details||'<p>Keine weiteren Angaben.</p>'}</div></details><textarea class="review-note" aria-label="Interne Prüfnotiz" placeholder="Interne Prüfnotiz">${esc(item.reviewer_note||'')}</textarea><div class="review-actions" ${['pending','reviewing'].includes(item.review_status)?'':'hidden'}>${mergeButton}<button class="approve" data-action="approve">${p.treatment_relationship?.kind==='new_combination'?'Neue Kombination freigeben':kind(item)==='remove'?'Verknüpfung entfernen':kind(item)==='link'?'Verknüpfung freigeben':kind(item)==='symptom'?'Symptom freigeben':isChange?'Änderungen übernehmen':'Als neuen Eintrag freigeben'}</button><button class="duplicate" data-action="duplicate">Nur als Dublette markieren</button><button class="reject" data-action="reject">Ablehnen</button></div><div class="review-current-status">Aktueller Status: ${esc(statusLabel(item.review_status))}</div></article>`;}
async function act(button){if(button.dataset.action==='merge'){await mergeDialog(allItems.find(item=>item.submission_id===Number(button.closest('[data-id]').dataset.id)));return;}const container=button.closest('[data-id]'),reviewCard=list.querySelector('.review-card[data-id="'+container.dataset.id+'"]'),action=button.dataset.action;const item=allItems.find(item=>item.submission_id===Number(container.dataset.id));if(action==='reopen'&&!confirmReopen(item))return;if(['approve','merge'].includes(action)&&!confirm(action==='merge'?'Die neuen Angaben in den erkannten bestehenden Eintrag übernehmen?':kind(allItems.find(item=>item.submission_id===Number(reviewCard.dataset.id)))==='remove'?'Diese Verknüpfung nach Prüfung entfernen?':'Diesen Antrag jetzt in den Datenbestand übernehmen?'))return;list.querySelectorAll('[data-id="'+reviewCard.dataset.id+'"] button').forEach(item=>item.disabled=true);try{const result=await request('api/review_submissions.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submission_id:Number(reviewCard.dataset.id),action,note:reviewCard.querySelector('.review-note').value})});message.textContent=`Antrag #${reviewCard.dataset.id}: ${statusLabel(result.status)}.`;const notice=message.textContent;if(action==='reopen')showReopened(item);await loadReviews();message.textContent=notice;}catch(error){message.textContent=error.message;list.querySelectorAll('[data-id="'+reviewCard.dataset.id+'"] button').forEach(item=>item.disabled=false);}}
function statusLabel(status){return {pending:'Offen',reviewing:'Offen',approved:'Freigegeben',duplicate:'Als Dublette markiert',rejected:'Abgelehnt'}[status]||status;}
function displayStatus(item){
 return statusLabel(item.review_status);
}
function loadFragment(id,url){fetch(url).then(response=>response.text()).then(html=>document.getElementById(id).innerHTML=html);}
function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}function label(key){const fields={taxonomy_proposal:'Korrektur der Therapieangaben',treatment_category:'Kategorie',treatment_subcategory:'Unterkategorie',medication_role:'Arzneimittel-Einordnung',medication_parent_name:'Zugeordnete Medikamentengruppe / Wirkstoff',medication_parent_id:'ID der Zuordnung'};if(fields[key])return fields[key];if(key==='community_feedback')return 'Community-Prüfung';if(key==='treatment_relationship')return 'Zusammenhang';if(key==='source_url')return 'Quelle';if(key==='review_note')return 'Begründung';return key.replaceAll('_',' ').replace(/^./,char=>char.toUpperCase());}

kindFilter.addEventListener('change',event=>{reviewKind=event.target.value;saveReviewFilters();renderOverview();});
searchFilter.addEventListener('input',event=>{reviewSearch=event.target.value.trim().toLocaleLowerCase('de');renderOverview();});

function feedbackHint(item){if(['doctor_profile','medication_classification'].includes(item.source))return 'Unterstützungen für genau diesen Vorschlag.';return kind(item)==='remove'?'Rückmeldungen zur bestehenden Zuordnung: Zustimmen (✓) bestätigt das Behandlungsangebot, Widersprechen (×) widerspricht ihm. Keine Abstimmung über den Löschantrag.':'Community-Rückmeldungen zur Zuordnung oder zum Vorschlag. Erfahrungsbewertungen zur Wirksamkeit werden hier nicht mitgezählt.';}

function duplicatePair(item){
 if(!item.duplicate_target_id)return '';
 const sourceId=item.merge_source_id>0?'ID '+item.merge_source_id:'Vorschlag #'+item.submission_id;
 return `<div class="review-duplicate-pair"><span><b>Vorschlag:</b> ${esc(item.merge_source_name||item.name)} <code>${esc(sourceId)}</code></span><span><b>Vergleichseintrag:</b> ${esc(item.duplicate_target_name||'Eintrag')} <code>ID ${Number(item.duplicate_target_id)}</code></span></div>`;
}
async function mergeDialog(item){
 const dialog=document.createElement('dialog');dialog.className='review-merge-dialog';document.body.append(dialog);
 dialog.innerHTML=`<form><h2>Einträge zusammenführen</h2>${duplicatePair(item)}<p>Beide Datenbestände und Verbindungen werden vereint. Wähle, welcher Name und welche ID erhalten bleiben.</p><fieldset class="review-merge-target"><legend>Zieleintrag</legend></fieldset><div class="review-merge-conflicts"></div><p class="review-merge-message" role="status"></p><div class="review-actions"><button type="submit" class="merge">Zusammenführen</button><button type="button" data-cancel>Abbrechen</button></div></form>`;
 const form=dialog.querySelector('form'),targets=dialog.querySelector('fieldset'),conflicts=dialog.querySelector('.review-merge-conflicts'),notice=dialog.querySelector('[role=status]'),submit=form.querySelector('[type=submit]');let plan=null,busy=false,revision=0;
 async function refresh(keep){const version=++revision;submit.disabled=true;plan=null;notice.textContent='Vergleich wird geladen …';try{const data=await request('api/review_submissions.php?merge_preview='+item.submission_id+(keep?'&keep_id='+keep:''));if(version!==revision)return;plan=data;targets.innerHTML=[{id:data.proposal_id,name:data.proposal_id===data.source_id?data.source_name:data.target_name,label:'Eintrag des Vorschlags'},{id:data.existing_id,name:data.existing_id===data.source_id?data.source_name:data.target_name,label:'Bisheriger Vergleichseintrag'}].map(n=>`<label><input type="radio" name="keep" value="${n.id}" ${n.id===data.target_id?'checked':''}> ${esc(n.name)} · ${n.id>0?'ID '+n.id:'Vorschlag #'+(-n.id)} <small>${n.label}</small></label>`).join('');
 conflicts.innerHTML=data.conflicts.length?`<h3>Widersprüchliche Angaben</h3><p>Für jeden Unterschied auswählen, welche Angabe übernommen wird.</p>`+data.conflicts.map((c,i)=>`<fieldset data-conflict="${esc(c.key)}"><legend>${esc(c.label)}</legend><label><input required type="radio" name="conflict-${i}" value="source"> ${esc(data.source_name)} (${data.source_id>0?'ID '+data.source_id:'Vorschlag #'+(-data.source_id)}): <span>${esc(c.source)}</span></label><label><input required type="radio" name="conflict-${i}" value="target"> ${esc(data.target_name)} (${data.target_id>0?'ID '+data.target_id:'Vorschlag #'+(-data.target_id)}): <span>${esc(c.target)}</span></label></fieldset>`).join(''):'<p>Keine widersprüchlichen Angaben. Ergänzende Daten werden aus beiden Einträgen übernommen.</p>';
 notice.textContent='';submit.disabled=false;
 }catch(error){if(version===revision)notice.textContent=error.message;}}
 targets.addEventListener('change',e=>refresh(Number(e.target.value)));dialog.querySelector('[data-cancel]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('close',()=>dialog.remove());
 form.addEventListener('submit',async e=>{e.preventDefault();if(!plan||busy||!form.reportValidity())return;busy=true;form.inert=true;try{const choices={};conflicts.querySelectorAll('[data-conflict]').forEach(n=>choices[n.dataset.conflict]=n.querySelector('input:checked').value);const result=await request('api/review_submissions.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submission_id:item.submission_id,action:'merge',keep_id:plan.target_id,merge_version:plan.version,conflict_choices:choices,note:list.querySelector('.review-card[data-id="'+item.submission_id+'"] .review-note')?.value||''})});dialog.close();await loadReviews();message.textContent='Zusammengeführt in ID '+result.approved_target_id+'.';}catch(error){notice.textContent=error.message;}finally{busy=false;form.inert=false;}});
 dialog.showModal();await refresh();
}

loadReviews();
