/* Product feedback is independent from medical ratings and catalog corrections. */
(async()=>{
 'use strict';
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=async(params,write=false)=>{const r=await fetch('api/feedback.php'+(write?'':'?'+new URLSearchParams(params)),{credentials:'same-origin',cache:'no-store',...(write?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}:{})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Die Anfrage ist fehlgeschlagen.');return d;};
 const message=(text,error=false)=>{const node=$('#fb-message');node.className=error?'fb-error':'fb-success';node.textContent=text;node.scrollIntoView({block:'nearest',behavior:'smooth'});};
 const date=v=>new Date(String(v).replace(' ','T')).toLocaleDateString('de-DE');
 const options=(values,selected)=>Object.entries(values).map(([k,v])=>`<option value="${esc(k)}" ${k===selected?'selected':''}>${esc(v)}</option>`).join('');
 const field=(label,name,value,max=180,area=false)=>`<label>${label}${area?`<textarea rows="4" name="${name}" maxlength="${max}">${esc(value)}</textarea>`:`<input name="${name}" maxlength="${max}" value="${esc(value)}">`}</label>`;
 let config, listSeq=0, listItems;
 const pendingVotes=new Set();
 const params=new URLSearchParams(location.search),context={};
 if(params.get('entity_type')&&params.get('entity_id')){context.entity_type=params.get('entity_type');context.entity_id=params.get('entity_id');}
 const names={doctor:'Behandler:in',treatment:'Therapie',symptom:'Symptom'};
 const contextLink=r=>{const id=Number(r.entity_id);if(!id||!names[r.entity_type])return '';const href=r.entity_type==='doctor'?`arzt_detail.html?id=${id}`:r.entity_type==='treatment'?`therapie_detail.php?treatment_id=${id}`:`symptome.php?id=${id}#symptom-${id}`;return `<a href="${href}">${names[r.entity_type]} #${id}</a>`;};
 const referenceMarkup=r=>r.page_reference?`<p class="fb-note">Seitenbezug: <a href="${esc(r.page_reference.page_path)}">${esc(r.page_reference.label||'Zugehörige Seite')}</a>${r.page_reference.section_label?` · Reiter: ${esc(r.page_reference.section_label)}`:''}${r.page_reference.element_label?` · Bereich: ${esc(r.page_reference.element_label)}`:''}</p>`:'';
 const tags=r=>`<div class="fb-tags"><span class="fb-tag fb-status-${esc(r.status)}">${esc(config.statuses[r.status])}</span>${contextLink(r)}</div>`;
 const reviewBadge=r=>r.moderation==='pending'?'<small class="catalog-inline-pending">Prüfung ausstehend</small>':'';
 const voteLabel=(supported,title,count)=>`${supported?'Unterstützung entfernen':'Vorschlag unterstützen'}: ${title} (${count} Unterstützungen)`;
 const vote=r=>`<button class="fb-vote" type="button" data-vote="${Number(r.id)}" aria-pressed="${!!Number(r.supported)}" aria-label="${esc(voteLabel(Number(r.supported),r.title,Number(r.votes)))}" data-vote-title="${esc(r.title)}"${pendingVotes.has(Number(r.id))?' disabled':''}>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 3 3.5 12H8v8h8v-8h4.5L12 3Z"/></svg>
  <strong>${Number(r.votes)}</strong>
 </button>`;
 // Stable round-robin covers: sorting and filtering keep the same image per idea.
 const motif=id=>`assets/images/feedback/motif-${String(((Math.max(1,Number(id)||1)-1)%9)+1).padStart(2,'0')}.webp`;
 const cover=r=>/^[a-f0-9]{32}$/.test(r.image_id||'')?`api/feedback_image.php?id=${r.image_id}`:r.seed_key?motif(r.id):'';
 const ideaInvitation=`
  <article class="fb-card fb-idea-card fb-idea-invitation">
    <div class="fb-card-cover fb-invitation-art" aria-hidden="true">
      <svg viewBox="0 0 300 200" fill="none" focusable="false">
        <circle cx="150" cy="101" r="67" fill="#dfd1f0"/>
        <path d="M104 59h81a13 13 0 0 1 13 13v48a13 13 0 0 1-13 13h-40l-27 20v-20h-14a13 13 0 0 1-13-13V72a13 13 0 0 1 13-13Z" fill="#fff" stroke="#604e7e" stroke-width="3" stroke-linejoin="round"/>
        <path d="M144 81v30m-15-15h30" stroke="#604e7e" stroke-width="5" stroke-linecap="round"/>
        <path d="M203 50v22m-11-11h22M75 124v14m-7-7h14" stroke="#8566a6" stroke-width="3" stroke-linecap="round"/>
        <circle cx="210" cy="143" r="5" fill="#d5a64d"/>
        <circle cx="78" cy="66" r="4" fill="#d5a64d"/>
      </svg>
    </div>
    <div class="fb-card-content">
      <span class="fb-eyebrow">Mitgestalten</span>
      <h2>Hast du eine Idee?</h2>
      <p>Was würde dir im Long-Covid-Navigator weiterhelfen? Vielleicht wünschst du dir eine bessere Orientierung, eine neue Funktion oder verständlichere Informationen. Teile deinen eigenen Vorschlag mit der Community.</p>
      <a class="fb-button" href="#idee">Eigene Idee einbringen</a>
    </div>
  </article>`;
 const pages=(page,total,load)=>{const node=$('#fb-pages');node.replaceChildren();if(total<=1)return;for(const [label,target] of [['← Zurück',page-1],[`Seite ${page} von ${Math.max(1,total)}`,0],['Weiter →',page+1]]){const b=document.createElement('button');b.className='fb-secondary';b.textContent=label;b.disabled=!target||target<1||target>total;b.onclick=()=>load(target);node.append(b);}};
 try{
  await Promise.all(['header','footer'].map(async name=>{
    const url=name==='footer'?'components/footer.html?v=f320b7bc85':'components/header.html';
    const r=await fetch(url);
    if(r.ok)$(`#${name}-placeholder`).innerHTML=await r.text();
  }));
  config=await api({action:'config'});
  if(config.admin)document.querySelectorAll('[data-admin-only]').forEach(n=>n.hidden=false);
  document.addEventListener('click',async e=>{
   const button=e.target.closest('[data-vote]');
   if(!button)return;
   const id=Number(button.dataset.vote);
   if(pendingVotes.has(id))return;
   const currentButton=()=>button.isConnected?button:$(`[data-vote="${id}"]`);
   pendingVotes.add(id);
   button.disabled=true;
   try{
    const d=await api({action:'vote',id,supported:button.getAttribute('aria-pressed')!=='true'},true);
    const item=listItems?.find(r=>Number(r.id)===id);
    if(item)Object.assign(item,{supported:d.supported,votes:d.votes});
    const current=currentButton();
    if(current){
     current.setAttribute('aria-pressed',String(d.supported));
     current.querySelector('strong').textContent=d.votes;
     current.setAttribute('aria-label',voteLabel(d.supported,current.dataset.voteTitle,d.votes));
    }
   }catch(err){message(err.message,true);}
   finally{
    pendingVotes.delete(id);
    const current=currentButton();
    if(current)current.disabled=false;
   }
  });
  function bindSubmit(form,action,extra={},done,save=data=>api(data,true)){form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button[type=submit]')||form.querySelector('button');b.disabled=true;try{const data=Object.fromEntries(new FormData(form));const d=await save({...data,...extra,action});if(done)await done(d);form.closest('dialog')?.close();message(d.message||'Gespeichert.');}catch(err){const modal=form.closest('dialog');if(modal){let result=form.querySelector('[data-form-result]');if(!result){result=document.createElement('p');result.dataset.formResult='';result.className='fb-form-result';result.setAttribute('role','alert');form.append(result);}result.textContent=err.message;result.scrollIntoView({block:'nearest'});}else message(err.message,true);}finally{b.disabled=false;}});}
  if($('#fb-admin-list')){
   const filter=$('#fb-admin-filters');
   const queue=$('#fb-admin-list');
   const adminStates={
    ideas:{pending:'Zur Prüfung',approved:'Freigegeben',rejected:'Abgelehnt',archived:'Archiviert'},
    comments:{pending:'Zur Prüfung',approved:'Freigegeben',rejected:'Abgelehnt',archived:'Archiviert',hidden:'Ausgeblendet'},
    reports:{open:'Offen',done:'Bearbeitet',rejected:'Abgelehnt',archived:'Archiviert'}
   };
   const development=filter.elements.status;
   const moderation=filter.elements.state;
   const developmentButtons=$('#fb-admin-development-buttons');
   const filterButtons=values=>Object.entries(values).map(([key,label])=>
    `<button type="button" data-filter-value="${esc(key)}" aria-pressed="false">${esc(label)}</button>`
   ).join('');
   developmentButtons.innerHTML=filterButtons({'':'Alle',...config.statuses});
   function syncFilters(){
    const showDevelopment=filter.elements.kind.value==='ideas'&&moderation.value==='approved';
    filter.hidden=!showDevelopment;
    if(!showDevelopment)development.value='';
    developmentButtons.querySelectorAll('button').forEach(button=>
     button.setAttribute('aria-pressed',String(button.dataset.filterValue===development.value))
    );
   }
   developmentButtons.onclick=event=>{
    const button=event.target.closest('[data-filter-value]');
    if(!button)return;
    development.value=button.dataset.filterValue;
    syncFilters();
    load();
   };
   const sections=document.querySelectorAll('[data-admin-section]');
   const defaultState=kind=>kind==='reports'?'open':'pending';
   function selectSection(kind){
    filter.elements.kind.value=kind;
    queue.replaceChildren();
    $('#fb-count').textContent='';
    $('#fb-pages').replaceChildren();
    sections.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.adminSection===kind)));
    stats.querySelectorAll('[data-queue-shortcut]').forEach(button=>{
     const [,area]=shortcuts[button.dataset.queueShortcut];
     button.hidden=area!==kind;
     button.setAttribute('aria-pressed','false');
    });
    development.value='';
    moderation.value=defaultState(kind);
    syncFilters();
   }
   const shortcuts={
    all_ideas:['Alle Ideen','ideas',''],
    pending_ideas:['Ideen zur Prüfung','ideas','pending'],
    published:['Freigegebene Ideen','ideas','approved'],
    rejected_ideas:['Abgelehnte Ideen','ideas','rejected'],
    archived_ideas:['Archivierte Ideen','ideas','archived'],
    all_comments:['Alle Kommentare','comments',''],
    pending_comments:['Kommentare zur Prüfung','comments','pending'],
    approved_comments:['Freigegebene Kommentare','comments','approved'],
    rejected_comments:['Abgelehnte Kommentare','comments','rejected'],
    archived_comments:['Archivierte Kommentare','comments','archived'],
    hidden_comments:['Ausgeblendete Kommentare','comments','hidden'],
    all_reports:['Alle','reports',''],
    open_reports:['Offen','reports','open'],
    done_reports:['Bearbeitet','reports','done'],
    rejected_reports:['Abgelehnt','reports','rejected'],
    archived_reports:['Archiviert','reports','archived']
   };
   const stats=$('#fb-stats');
   stats.innerHTML=Object.entries(shortcuts).map(([key,[label]])=>
    `<button type="button" class="fb-stat" data-queue-shortcut="${key}" aria-pressed="false"><strong>–</strong>${label}</button>`
   ).join('');
   stats.querySelectorAll('button').forEach(button=>button.onclick=()=>{
    const [,,state]=shortcuts[button.dataset.queueShortcut];
    development.value='';
    moderation.value=state;
    syncFilters();
    load();
   });
   sections.forEach(button=>button.onclick=()=>{
    selectSection(button.dataset.adminSection);
    load();
   });
   function saveQueueUrl({kind,state,status},page){
    const url=new URL(location.href);
    for(const [key,value,fallback] of [
     ['section',kind,'ideas'],['state',state,defaultState(kind)],['status',status,''],['page',String(page),'1']
    ]){
     if(value===fallback)url.searchParams.delete(key);
     else url.searchParams.set(key,value);
    }
    if(url.href!==location.href)history.replaceState({...history.state,feedbackOpenEntries:[]},'',url);
   }
   queue.addEventListener('click',event=>{
    const card=event.target.closest('.fb-admin-entry-row');
    const details=card?.querySelector('details');
    if(!details||details.open||event.defaultPrevented||event.target.closest('summary, a, button, .fb-entry-actions'))return;

    const actionPadding=5;
    const nearActions=[...card.querySelectorAll('.fb-entry-actions, .fb-entry-controls > button')].some(group=>{
     const {left,right,top,bottom}=group.getBoundingClientRect();
     return event.clientX>=left-actionPadding&&event.clientX<=right+actionPadding&&
      event.clientY>=top-actionPadding&&event.clientY<=bottom+actionPadding;
    });
    if(!nearActions)details.open=true;
   });
   queue.addEventListener('toggle',event=>{
    if(!event.target.matches('details[data-feedback-entry]'))return;
    const feedbackOpenEntries=[...queue.querySelectorAll('details[open][data-feedback-entry]')].map(details=>details.dataset.feedbackEntry);
    history.replaceState({...history.state,feedbackOpenEntries},'');
   },true);
   const moderationActions={pending:'Zur Prüfung',approved:'Freigeben',rejected:'Ablehnen',archived:'Archivieren'};
   function entryActions(entry,field,choices,current,extra=''){
    const label=field==='status'?'Entwicklungsstand':'Moderation';
    return `<fieldset class="fb-admin-filter-group fb-entry-actions fb-entry-actions-${field}"><legend>${label}</legend><div>${Object.entries(choices).map(([value,text])=>
     `<button type="button" data-entry-action="${field}" data-entry-id="${Number(entry.id)}" data-filter-value="${esc(value)}" aria-pressed="${value===current}">${esc(text)}</button>`
    ).join('')}${extra}</div></fieldset>`;
   }
   const deleteButton=r=>`<button type="button" class="fb-delete" data-moderate="${Number(r.id)}" data-state="deleted">Löschen</button>`;
   function archiveDates(entry,inHeader=false){
    const days=Number(entry.archive_days_left);
    const deadline=Number(entry.archive_overdue)
     ? '<strong class="fb-overdue">Löschen</strong>'
     : `<strong>${days===0?'Heute löschen':days===1?'Noch 1 Tag bis zur Löschung':`Noch ${days} Tage bis zur Löschung`}</strong>`;
    const created=`Erstellt am ${date(entry.created_at)}`;
    const archived=entry.archived_at?`Archiviert am ${date(entry.archived_at)}`:'Archivierungsdatum unbekannt';
    if(inHeader)return `<p class="fb-muted fb-entry-dates"><span>${created}</span><span>${archived}</span><span>${entry.archived_at?deadline:'Löschfrist unbekannt'}</span></p>`;
    return `<p class="fb-muted fb-entry-dates">${created}${entry.archived_at?` · ${archived} · ${deadline}`:''}</p>`;
   }
   function archiveDemo(id,daysLeft,retentionDays){
    const archived = new Date();
    archived.setDate(archived.getDate() - retentionDays + daysLeft);
    const created = new Date(archived);
    created.setDate(created.getDate() - 1);
    return {
     id,demo:true,moderation:'archived',status:'open',category:'general',
     title:daysLeft<0?'Testeintrag · Löschung fällig':'Testeintrag · Archivfrist läuft',
     description:'Mit dieser Beispielidee lassen sich Moderation, Bearbeitung und Löschung im Archiv ausprobieren.',
     team_reply:'Beispiel für eine offizielle Antwort.',
     created_at:created.toISOString(),archived_at:archived.toISOString(),
     archive_days_left:daysLeft,archive_overdue:daysLeft<0
    };
   }
   let demoEntries;
   let retentionDays;
   function moderateDemo(entry,moderation){
    if(entry.moderation===moderation)return;
    entry.moderation=moderation;
    entry.archived_at=moderation==='archived'?new Date().toISOString():null;
    entry.archive_days_left=retentionDays;
    entry.archive_overdue=false;
   }
   async function saveAdmin(data){
    if(data.id>=0)return api(data,true);
    const entry=demoEntries?.find(item=>item.id===data.id);
    if(!entry||!window.LCNDummy?.get())throw Error('Der Testeintrag ist nicht verfügbar.');
    if(data.action==='admin_idea_delete'){
     if(demoEntries.some(item=>item.merged_into===entry.id))throw Error('Bitte lösche zuerst die zusammengeführte Quellidee im Archiv.');
     demoEntries=demoEntries.filter(item=>item!==entry);
    }else if(data.action==='admin_merge'){
     const target=demoEntries.find(item=>item.id===data.target_id&&!item.merged_into);
     if(!target||target===entry)throw Error('Bitte die ID des anderen Testeintrags eingeben.');
     entry.merged_into=target.id;
     moderateDemo(entry,'archived');
    }else if(data.action==='admin_idea'){
     const {title,description,category,team_reply}=data;
     if(title.trim().length<5||description.trim().length<15)throw Error('Bitte Titel und Beschreibung vervollständigen.');
     Object.assign(entry,{title,description,category,team_reply});
    }else if(data.status){
     entry.status=data.status;
    }else{
     moderateDemo(entry,data.moderation);
    }
    return {message:'Testeintrag gespeichert.'};
   }
   function reportCard(report){
    const reference=report.page_path&&report.body.match(/\r?\n\r?\n— Seitenbezug —\r?\n((?:Reiter|Bereich): [^\r\n]+(?:\r?\nBereich: [^\r\n]+)?)$/);
    const body=reference?report.body.slice(0,reference.index):report.body;
    const location=reference?reference[1].split(/\r?\n/).map(line=>{
     const separator=line.indexOf(': ');
     return `<div><dt>${esc(line.slice(0,separator))}</dt><dd>${esc(line.slice(separator+2))}</dd></div>`;
    }).join(''):'';
    const actions=[
     ['done','Als bearbeitet markieren'],
     report.status==='rejected'?['open','Wieder öffnen']:['rejected','Ablehnen'],
     ['archived','Archivieren']
    ];
    return `<article class="fb-card fb-admin-card fb-report-card">
     <div class="fb-admin-entry-content">
      <div class="fb-report-meta"><span class="fb-tag">#${Number(report.id)}</span><span class="fb-tag">${esc(adminStates.reports[report.status]||report.status)}</span></div>
      ${archiveDates(report)}
      <h2>${esc(config.report_categories[report.category]||report.category)}</h2>
      <p class="fb-prose">${esc(body)}</p>
     </div>
     <dl class="fb-report-details">
      <div><dt>E-Mail-Adresse</dt><dd>${esc(report.email||'Nicht angegeben')}</dd></div>
      <div><dt>Seitenbezug</dt><dd>${esc(report.page_path||'Kein Seitenbezug')}${contextLink(report)}</dd></div>
      ${location}
     </dl>
     <div class="fb-actions fb-report-actions">${actions.map(([state,label])=>
      `<button type="button" class="fb-secondary" data-moderate="${Number(report.id)}" data-state="${state}">${label}</button>`
     ).join('')}${report.status==='archived'?deleteButton(report):''}</div>
    </article>`;
   }
   let queueSeq=0;
   async function load(page=1,follow=null){const seq=++queueSeq;try{
    const f=Object.fromEntries(new FormData(filter));
    saveQueueUrl(f,page);
    const d=await api({action:'admin_queue',...f,page,...(follow?.id>0?{focus_id:follow.id}:{})});
    if(seq!==queueSeq)return;
    page=d.page;
    saveQueueUrl(f,page);
    const openEntries=new Set(history.state?.feedbackOpenEntries||[]);
    retentionDays=d.archive_days;
    const showArchiveDemo=f.kind==='ideas'&&page===1&&window.LCNDummy?.get();
    if(showArchiveDemo)demoEntries??=[archiveDemo(-1,-1,retentionDays),archiveDemo(-2,14,retentionDays)];
    const visibleDemos=showArchiveDemo?demoEntries.filter(entry=>
     (!f.state||entry.moderation===f.state)&&(!f.status||entry.status===f.status)):[];
    $('#fb-count').textContent=`${d.total} ${d.total===1?'Eintrag':'Einträge'}${visibleDemos.length?` + ${visibleDemos.length} ${visibleDemos.length===1?'Testeintrag':'Testeinträge'}`:''}`;
    stats.querySelectorAll('button').forEach(button=>{
     const key=button.dataset.queueShortcut;
     const [,kind,state]=shortcuts[key];
     button.querySelector('strong').textContent=d.stats[key];
     button.setAttribute('aria-pressed',String(f.kind===kind&&f.state===state&&!f.status));
    });
   function renderEntry(r){
    const detailsAttributes=`data-feedback-entry="${Number(r.id)}"${openEntries.has(String(r.id))?' open':''}`;
    if(f.kind==='ideas'){
     const hasDevelopment=r.moderation==='approved'&&!r.merged_into;
     const archived=r.moderation==='archived';
     const hasHeader=hasDevelopment||archived;
     const image=r.image_id?cover(r):r.demo||archived&&d.archive_preview_images?motif(Math.abs(r.id)):'';
     const thumbnail=image?`<img class="fb-admin-thumbnail" src="${image}" alt="${r.image_id?'Eingereichtes Kartenbild':'Testmotiv'}" width="72" height="72" loading="lazy">`:'';
     return `<article class="fb-card fb-admin-entry-row fb-idea-admin-card"${r.demo?' data-archive-demo':''}>
      ${hasHeader?`<div class="fb-idea-development${archived?' fb-idea-archive':''}">${archived?archiveDates(r,true):entryActions(r,'status',config.statuses,r.status)}<div class="fb-idea-development-image">${thumbnail}</div></div>`:''}
      <div class="fb-admin-card"><details ${detailsAttributes}>
       <summary>#${r.id} · ${esc(r.title)} · ${esc(adminStates.ideas[r.moderation]||r.moderation)}${r.demo?' <span class="fb-tag">Dummy</span>':''}${r.moderation==='approved'?` <span class="fb-tag fb-status-${esc(r.status)}">${esc(config.statuses[r.status]||r.status)}</span>`:''}${r.merged_into?' → #'+r.merged_into:''}</summary>
       <p class="fb-muted">Community-Beitrag · ${esc(r.email||'Keine E-Mail')} ${contextLink(r)}</p>
       ${referenceMarkup(r)}
       ${r.merged_into&&!r.demo?`<a href="mitgestalten.html?id=${Number(r.merged_into)}">Zum Zielvorschlag</a>`:''}
      </details>${archived?'':archiveDates(r)}</div>
      ${!r.merged_into||r.image_id||archived?`<div class="fb-entry-controls${thumbnail&&!hasHeader?' fb-entry-controls-with-image':''}">
       ${r.merged_into?(r.moderation==='archived'?deleteButton(r):''):entryActions(r,'moderation',moderationActions,r.moderation,r.moderation==='archived'?deleteButton(r):'')}
       ${hasHeader?'':thumbnail}
      </div>`:''}
      ${r.merged_into?'':`
       <form data-edit="${r.id}" class="fb-form fb-idea-editor">
        ${field('Titel','title',r.title)}
        ${field('Öffentliche Begründung einer Änderung des Entwicklungsstands','reason','',2000,true)}
        ${field('Beschreibung','description',r.description,8000,true)}
        ${field('Offizielle Antwort','team_reply',r.team_reply,4000,true)}
        <label>Kategorie<select name="category">${options(config.categories,r.category)}</select></label>
        <button type="submit" class="fb-button">Änderungen speichern</button>
       </form>
       <form data-merge="${r.id}" class="fb-toolbar fb-idea-merge">
        <label>${r.demo?'Mit anderem Testeintrag zusammenführen (ID)':'Mit Zielvorschlag zusammenführen (ID)'}<input name="target_id" type="number" ${r.demo?'max="-1"':'min="1"'} required></label>
        <button type="submit" class="fb-secondary">Zusammenführen …</button>
       </form>`}
     </article>`;
    }
    if(f.kind==='reports')return reportCard(r);
    return `<article class="fb-card fb-admin-entry-row fb-comment-admin-card">
     <div class="fb-admin-card"><details ${detailsAttributes}>
      <summary>#${Number(r.id)} · Kommentar zu Idee #${Number(r.idea_id)} · ${esc(adminStates.comments[r.moderation]||r.moderation)}</summary>
      <p class="fb-prose">${esc(r.body)}</p>
      <p class="fb-muted">${esc(r.display_name||'Anonym')}</p>
     </details>${archiveDates(r)}</div>
     <div class="fb-entry-controls">${entryActions(r,'moderation',{...moderationActions,hidden:'Ausblenden'},r.moderation,r.moderation==='archived'?deleteButton(r):'')}</div>
    </article>`;
   }
   const entries=[...visibleDemos,...d.items].sort((a,b)=>Number(b.archive_overdue)-Number(a.archive_overdue));
   queue.innerHTML=entries.map((entry,index)=>{
    const overdue=Number(entry.archive_overdue);
    const previousOverdue=Number(entries[index-1]?.archive_overdue);
    const separator=index===0&&overdue
     ? '<h2 class="fb-archive-heading">Zur Löschung fällig</h2>'
     : previousOverdue&&!overdue
      ? '<div class="fb-archive-divider"><span>Löschlinie</span><hr></div>'
      : '';
    return separator+renderEntry(entry);
   }).join('')||'<p class="fb-note">Keine Einträge in dieser Auswahl.</p>';
   document.querySelectorAll('[data-entry-action]').forEach(button=>button.onclick=async()=>{
    if(button.getAttribute('aria-pressed')==='true')return;
    const {entryAction,entryId,filterValue}=button.dataset;
    const card=button.closest('article');
    const wasOpen=card.querySelector('details')?.open;
    const currentQueue=queueSeq;
    const controls=[...card.querySelectorAll('[data-entry-action]')];
    controls.forEach(control=>control.disabled=true);
    try{
     const reason=card.querySelector('[name=reason]')?.value||'';
     await saveAdmin({action:f.kind==='ideas'?'admin_idea_classify':'admin_comment',id:Number(entryId),[entryAction]:filterValue,reason});
     if(currentQueue!==queueSeq)return;
     if(entryAction==='moderation'){
      moderation.value=filterValue;
      syncFilters();
      await load(1,{id:Number(entryId),open:wasOpen});
     }else await load(page);
    }catch(err){message(err.message,true);}
    finally{controls.forEach(control=>control.disabled=false);}
   });
   document.querySelectorAll('[data-edit]').forEach(form=>bindSubmit(form,'admin_idea',{id:Number(form.dataset.edit)},()=>load(page),saveAdmin));
   document.querySelectorAll('[data-merge]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const target=Number(form.elements.target_id.value);if(!confirm(`Idee #${form.dataset.merge} in Idee #${target} zusammenführen? Stimmen werden dedupliziert, Kommentare übernommen. Diese Aktion ist nicht automatisch rückgängig zu machen.`))return;const b=form.querySelector('button');b.disabled=true;try{await saveAdmin({action:'admin_merge',id:Number(form.dataset.merge),target_id:target});message('Vorschläge zusammengeführt.');await load(page);}catch(err){message(err.message,true);}finally{b.disabled=false;}}));
   document.querySelectorAll('[data-moderate]').forEach(button=>button.onclick=async()=>{
    const state=button.dataset.state;
    if(state==='deleted'){
     const prompt=f.kind==='ideas'?'Diese Idee samt archivierten Kommentaren und zugehörigen Daten endgültig löschen?':'Diesen Eintrag endgültig löschen?';
     if(!confirm(prompt))return;
    }
    const actions={ideas:'admin_idea_delete',comments:'admin_comment',reports:'admin_report'};
    const currentQueue=queueSeq;
    button.disabled=true;
    try{
     await saveAdmin({action:actions[f.kind],id:Number(button.dataset.moderate),[f.kind==='reports'?'status':'moderation']:state});
     if(currentQueue===queueSeq)await load(page);
    }catch(err){message(err.message,true);}
    finally{button.disabled=false;}
   });
   pages(page,d.pages,load);
   if(follow){
    const target=$(`[data-entry-action="moderation"][data-entry-id="${follow.id}"][aria-pressed="true"]`);
    if(target){
     const card=target.closest('article');
     if(follow.open)card.querySelector('details').open=true;
     target.focus({preventScroll:true});
     card.scrollIntoView({block:'nearest'});
    }
   }
   }catch(err){message(err.message,true);}}
   const section=params.get('section');
   const kind=Object.hasOwn(adminStates,section)?section:'ideas';
   selectSection(kind);
   const state=params.get('state');
   const status=params.get('status');
   if(state===''||Object.hasOwn(adminStates[kind],state))moderation.value=state;
   if(Object.hasOwn(config.statuses,status))development.value=status;
   syncFilters();
   const page=Number(params.get('page'));
   filter.onsubmit=e=>e.preventDefault();
   function refreshArchiveDemo(){
    if(filter.elements.kind.value==='ideas')load(1);
   }
   window.addEventListener('lcn-dummy-change',refreshArchiveDemo);
   window.addEventListener('storage',event=>{
    if(event.key===window.LCNDummy?.key||event.key===null)refreshArchiveDemo();
   });
   await load(Number.isInteger(page)&&page>=1&&page<=10000?page:1);
   queue.removeAttribute('data-scroll-restore-pending');
   window.dispatchEvent(new Event('lcn:scroll-ready'));
   return;
  }
  $('#fb-status-filter').insertAdjacentHTML('beforeend',options(config.statuses));
  const list=$('#fb-list');
  let listOffset=0;
  function renderList(){
   if(!listItems)return;
   const view=list.dataset.view;
   const items=listItems.map((r,index)=>{
    const href=`mitgestalten.html?id=${Number(r.id)}`;
    const title=`<a href="${href}">${esc(r.title)}</a>`;
    const image=cover(r);
    const thumbnail=image?`<img src="${image}" alt="" width="600" height="400" loading="lazy" decoding="async">`:'';
    const comments=Number(r.comments);
    if(view==='table'){
     return `<tr>
      <td>${listOffset+index+1}</td>
      <td>${vote(r)}</td>
      <td>${thumbnail}</td>
      <th scope="row">${title}${reviewBadge(r)}</th>
      <td>${comments}</td>
     </tr>`;
    }
    return `<article class="fb-card fb-idea-card">
     ${image?`<a class="fb-card-cover" href="${href}" tabindex="-1" aria-hidden="true">${thumbnail}</a>`:''}
     <div class="fb-card-content">
      ${tags(r)}<h2 class="fb-idea-title">${title}</h2>
      <p>${esc(r.description.slice(0,240))}${r.description.length>240?' …':''}</p>
      ${reviewBadge(r)}
      <div class="fb-card-footer">
       ${vote(r)}
       <a href="${href}">${comments} ${comments===1?'Kommentar':'Kommentare'} · Mitdiskutieren →</a>
       <time datetime="${esc(String(r.created_at).slice(0,10))}">${date(r.created_at)}</time>
      </div>
     </div>
    </article>`;
   }).join('');
   const proposals=view==='table'&&items
    ?`<div class="fb-proposal-table-scroll" role="region" aria-label="Vorschlagstabelle" tabindex="0">
     <table class="fb-proposal-table">
      <thead><tr>
       <th scope="col">Rang</th>
       <th scope="col">Unterstützung</th>
       <th scope="col">Bild</th>
       <th scope="col">Name</th>
       <th scope="col">Kommentare</th>
      </tr></thead>
      <tbody>${items}</tbody>
     </table>
    </div>`
    :items;
   list.innerHTML=(proposals||'<p class="fb-note">Noch keine passenden Vorschläge.</p>')+(view==='cards'?ideaInvitation:'');
  }
  const viewButtons=document.querySelectorAll('[data-proposal-view]');
  const viewPreferenceKey='lcn.mitgestalten.view';
  const mobileResults=matchMedia('(max-width: 760px)');
  let preferredView='cards';
  function selectView(){
   const view=mobileResults.matches?'cards':preferredView;
   list.dataset.view=view;
   viewButtons.forEach(option=>option.setAttribute('aria-pressed',String(option.dataset.proposalView===view)));
   renderList();
  }
  try{
   const savedView=localStorage.getItem(viewPreferenceKey);
   if(savedView==='cards'||savedView==='table')preferredView=savedView;
  }catch{}
  selectView();
  mobileResults.addEventListener('change',selectView);
  viewButtons.forEach(button=>button.addEventListener('click',()=>{
   preferredView=button.dataset.proposalView;
   selectView();
   try{localStorage.setItem(viewPreferenceKey,preferredView);}catch{}
  }));
  async function loadList(page=1){
   const seq=++listSeq;
   try{
    const values=Object.fromEntries(new FormData($('#fb-filters')));
    const d=await api({action:'list',...values,page});
    if(seq!==listSeq)return;
    listItems=d.items;
    listOffset=Number(d.offset)||0;
    $('#fb-count').textContent=`${d.total} ${d.total===1?'Vorschlag':'Vorschläge'}`;
    list.setAttribute('aria-busy','false');
    renderList();
    pages(page,d.pages,loadList);
   }catch(err){message(err.message,true);}
  }
  let searchTimer;$('#fb-filters').elements.q.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadList(),300);});
  $('#fb-filters').onsubmit=e=>{e.preventDefault();clearTimeout(searchTimer);loadList();};$('#fb-filters').querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>loadList()));
  if(params.get('id')){
   document.body.classList.add('is-detail');$('#fb-list-section').hidden=true;$('#fb-detail').hidden=false;
   async function detail(page=1){const d=await api({action:'detail',id:params.get('id'),page}),r=d.idea;document.title=r.title+' – Mitgestalten';
   const image=cover(r);
   $('#fb-detail').innerHTML=`
    <div class="fb-detail-links">
      <a href="mitgestalten.html">← Alle Vorschläge</a>
      <a href="#idee">＋ Eigene Idee einbringen</a>
    </div>
    ${d.merged?'<p class="fb-note">Diese Idee wurde mit dem folgenden Vorschlag zusammengeführt.</p>':''}
    <aside class="fb-discussion-invitation" aria-labelledby="fb-invitation-title">
      <div>
        <span class="fb-eyebrow">Mitgestalten</span>
        <h2 id="fb-invitation-title">Was würde dir bei dieser Idee helfen?</h2>
        <p>Ergänze den Vorschlag mit deiner Perspektive oder einem konkreten Beispiel.</p>
      </div>
      <a class="fb-button" href="#fb-comment-body">Kommentar schreiben</a>
    </aside>
    <article class="fb-card fb-idea-card fb-detail-card">
      ${image?`<div class="fb-card-cover"><img src="${image}" alt="" width="600" height="400" decoding="async"></div>`:''}
      <div class="fb-card-content">
        ${tags(r)}
        <h1>${esc(r.title)}</h1>
        ${referenceMarkup(r)}
        <div class="fb-prose">${esc(r.description)}</div>
        ${reviewBadge(r)}
        <div class="fb-card-footer">${vote(r)}<span>${Number(d.comment_total)} ${Number(d.comment_total)===1?'Kommentar':'Kommentare'}</span><time datetime="${esc(String(r.created_at).slice(0,10))}">${date(r.created_at)}</time></div>
        ${r.team_reply?`<aside class="fb-note"><strong>Antwort des LCN-Teams</strong><p class="fb-prose">${esc(r.team_reply)}</p></aside>`:''}
      </div>
    </article>
    ${d.history.length?`<section class="fb-panel"><h2>Entwicklungsverlauf</h2><div class="fb-history">${d.history.map(h=>`<p><strong>${esc(config.statuses[h.new_value]||h.new_value)}</strong> · ${date(h.created_at)}<br><span class="fb-prose">${esc(h.reason)}</span></p>`).join('')}</div></section>`:''}<section class="fb-panel fb-discussion"><h2>Kommentare (${d.comment_total})</h2>${d.comments.map(c=>`<article class="fb-comment"><strong>Community-Beitrag</strong> <span class="fb-muted">${date(c.created_at)}</span><p class="fb-prose">${esc(c.body)}</p>${reviewBadge(c)}</article>`).join('')||'<p>Noch keine Kommentare.</p>'}<nav id="fb-comment-pages" class="fb-actions"></nav><form id="fb-comment-form" class="fb-form"><label>Deine Ergänzung<textarea id="fb-comment-body" name="body" required minlength="5" maxlength="4000" rows="4"></textarea></label><p class="fb-muted">Dein Kommentar ist sofort öffentlich sichtbar und trägt bis zur Freigabe den Hinweis „Prüfung ausstehend“. Bitte teile keine persönlichen Gesundheitsdaten oder Kontaktdaten.</p><button type="submit" class="fb-button">Kommentar senden</button></form></section>`;
   const cp=$('#fb-comment-pages');for(const [label,p] of [['← Frühere Kommentare',d.page-1],['Weitere Kommentare →',d.page+1]]){if(p<1||p>Math.ceil(d.comment_total/30))continue;const b=document.createElement('button');b.className='fb-secondary';b.textContent=label;b.onclick=()=>detail(p).catch(e=>message(e.message,true));cp.append(b);}bindSubmit($('#fb-comment-form'),'comment',{id:Number(r.id)},async()=>{
    $('#fb-comment-form').reset();
    await detail('last');
   });}
   await detail();
  }else{
   document.addEventListener('lcn-idea-created',()=>loadList());
   await loadList();
  }
  if(['#idee','#privat'].includes(location.hash)){const {openComposer}=await import('./feedback_composer.js?v=pending-ideas-20261108');await openComposer(location.hash);}
 }catch(err){message(err.message,true);}
})();
