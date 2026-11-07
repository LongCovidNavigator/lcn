/* Product feedback is independent from medical ratings and catalog corrections. */
(async()=>{
 'use strict';
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=async(params,write=false)=>{const r=await fetch('api/feedback.php'+(write?'':'?'+new URLSearchParams(params)),{credentials:'same-origin',cache:'no-store',...(write?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}:{})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Die Anfrage ist fehlgeschlagen.');return d;};
 const message=(text,error=false)=>{const node=$('#fb-message');node.className=error?'fb-error':'fb-success';node.textContent=text;node.scrollIntoView({block:'nearest',behavior:'smooth'});};
 const date=v=>new Date(String(v).replace(' ','T')).toLocaleDateString('de-DE');
 const options=(values,selected)=>Object.entries(values).map(([k,v])=>`<option value="${esc(k)}" ${k===selected?'selected':''}>${esc(v)}</option>`).join('');
 const field=(label,name,value,max=180,area=false)=>`<label>${label}${area?`<textarea rows="4" name="${name}" maxlength="${max}">${esc(value)}</textarea>`:`<input name="${name}" maxlength="${max}" value="${esc(value)}">`}</label>`;
 let config, listSeq=0;
 const params=new URLSearchParams(location.search),context={};
 if(params.get('entity_type')&&params.get('entity_id')){context.entity_type=params.get('entity_type');context.entity_id=params.get('entity_id');}
 const names={doctor:'Behandler:in',treatment:'Therapie',symptom:'Symptom'};
 const contextLink=r=>{const id=Number(r.entity_id);if(!id||!names[r.entity_type])return '';const href=r.entity_type==='doctor'?`arzt_detail.html?id=${id}`:r.entity_type==='treatment'?`therapie_detail.php?treatment_id=${id}`:`symptome.php?id=${id}#symptom-${id}`;return `<a href="${href}">${names[r.entity_type]} #${id}</a>`;};
 const referenceMarkup=r=>r.page_reference?`<p class="fb-note">Seitenbezug: <a href="${esc(r.page_reference.page_path)}">${esc(r.page_reference.label||'Zugehörige Seite')}</a>${r.page_reference.section_label?` · Reiter: ${esc(r.page_reference.section_label)}`:''}${r.page_reference.element_label?` · Bereich: ${esc(r.page_reference.element_label)}`:''}</p>`:'';
 const tags=r=>`<div class="fb-tags"><span class="fb-tag fb-status-${esc(r.status)}">${esc(config.statuses[r.status])}</span>${contextLink(r)}</div>`;
 const vote=r=>`<button class="fb-vote" type="button" data-vote="${Number(r.id)}" aria-pressed="${!!Number(r.supported)}" aria-label="${Number(r.supported)?'Unterstützung entfernen':'Vorschlag unterstützen'}: ${esc(r.title)}"><span aria-hidden="true">▲</span><strong>${Number(r.votes)}</strong><span>${Number(r.supported)?'Unterstützt':'Unterstützen'}</span></button>`;
 // Stable round-robin covers: sorting and filtering keep the same image per idea.
 const cover=r=>/^[a-f0-9]{32}$/.test(r.image_id||'')?`api/feedback_image.php?id=${r.image_id}`:r.seed_key?`assets/images/feedback/motif-${String(((Math.max(1,Number(r.id)||1)-1)%9)+1).padStart(2,'0')}.webp`:'';
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
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-vote]');if(!b)return;b.disabled=true;try{const d=await api({action:'vote',id:Number(b.dataset.vote),supported:b.getAttribute('aria-pressed')!=='true'},true);b.setAttribute('aria-pressed',String(d.supported));b.querySelector('strong').textContent=d.votes;b.querySelector('span:last-child').textContent=d.supported?'Unterstützt':'Unterstützen';b.setAttribute('aria-label',d.supported?'Unterstützung entfernen':'Vorschlag unterstützen');}catch(err){message(err.message,true);}finally{b.disabled=false;}});
  function bindSubmit(form,action,extra={},done){form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button[type=submit]')||form.querySelector('button');b.disabled=true;try{const data=Object.fromEntries(new FormData(form));const d=await api({...data,...extra,action},true);if(done)await done(d);form.closest('dialog')?.close();message(d.message||'Gespeichert.');}catch(err){const modal=form.closest('dialog');if(modal){let result=form.querySelector('[data-form-result]');if(!result){result=document.createElement('p');result.dataset.formResult='';result.className='fb-form-result';result.setAttribute('role','alert');form.append(result);}result.textContent=err.message;result.scrollIntoView({block:'nearest'});}else message(err.message,true);}finally{b.disabled=false;}});}
  if($('#fb-admin-list')){
   const filter=$('#fb-admin-filters');
   const adminStates={
    ideas:{pending:'Zur Prüfung',approved:'Freigegeben',rejected:'Abgelehnt',archived:'Archiviert'},
    comments:{pending:'Zur Prüfung',approved:'Freigegeben',rejected:'Abgelehnt',archived:'Archiviert',hidden:'Ausgeblendet'},
    reports:{open:'Offen',done:'Bearbeitet',rejected:'Abgelehnt',archived:'Archiviert'}
   };
   const development=filter.elements.status;
   const moderation=filter.elements.state;
   const stateButtons=$('#fb-admin-state');
   const developmentButtons=$('#fb-admin-development-buttons');
   const filterButtons=values=>Object.entries(values).map(([key,label])=>
    `<button type="button" data-filter-value="${esc(key)}" aria-pressed="false">${esc(label)}</button>`
   ).join('');
   developmentButtons.innerHTML=filterButtons({'':'Alle',...config.statuses});
   function syncFilters(){
    const showDevelopment=filter.elements.kind.value==='ideas'&&moderation.value==='approved';
    $('#fb-admin-development').hidden=!showDevelopment;
    if(!showDevelopment)development.value='';
    for(const [group,value] of [[stateButtons,moderation.value],[developmentButtons,development.value]]){
     group.querySelectorAll('button').forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.filterValue===value))
     );
    }
   }
   for(const [group,input] of [[stateButtons,moderation],[developmentButtons,development]]){
    group.onclick=event=>{
     const button=event.target.closest('[data-filter-value]');
     if(!button)return;
     input.value=button.dataset.filterValue;
     syncFilters();
     load();
    };
   }
   const sections=document.querySelectorAll('[data-admin-section]');
   function states(){
    const kind=filter.elements.kind.value;
    const isPrivate=kind==='reports';
    sections.forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.adminSection==='reports')===isPrivate)));
    filter.hidden=isPrivate;
    filter.elements.kind.querySelector('option[value=reports]').hidden=!isPrivate;
    stats.querySelectorAll('[data-queue-shortcut]').forEach(button=>{
     const [,area]=shortcuts[button.dataset.queueShortcut];
     button.hidden=(area==='reports')!==isPrivate;
    });
    stateButtons.closest('fieldset').hidden=kind==='ideas';
    development.value='';
    moderation.value=isPrivate?'open':'pending';
    stateButtons.innerHTML=filterButtons({'':'Alle',...adminStates[kind]});
    syncFilters();
   }
   const shortcuts={
    all_ideas:['Alle Ideen','ideas',''],
    pending_ideas:['Ideen zur Prüfung','ideas','pending'],
    pending_comments:['Kommentare zur Prüfung','comments','pending'],
    published:['Freigegebene Ideen','ideas','approved'],
    rejected_ideas:['Abgelehnte Ideen','ideas','rejected'],
    archived_ideas:['Archivierte Ideen','ideas','archived'],
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
    const [,kind,state]=shortcuts[button.dataset.queueShortcut];
    filter.elements.kind.value=kind;
    states();
    moderation.value=state;
    syncFilters();
    load();
   });
   sections.forEach(button=>button.onclick=()=>{
    const section=button.dataset.adminSection;
    const url=new URL(location.href);
    if(section==='reports')url.searchParams.set('section','reports');
    else url.searchParams.delete('section');
    history.replaceState(history.state,'',url);
    filter.elements.kind.value=section;
    states();
    load();
   });
   const moderationActions={pending:'Zur Prüfung',approved:'Freigeben',rejected:'Ablehnen',archived:'Archivieren'};
   function entryActions(entry,field,choices,current,extra=''){
    const label=field==='status'?'Entwicklungsstand':'Moderation';
    return `<fieldset class="fb-admin-filter-group fb-entry-actions fb-entry-actions-${field}"><legend>${label}</legend><div>${Object.entries(choices).map(([value,text])=>
     `<button type="button" data-entry-action="${field}" data-entry-id="${Number(entry.id)}" data-filter-value="${esc(value)}" aria-pressed="${value===current}">${esc(text)}</button>`
    ).join('')}${extra}</div></fieldset>`;
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
     ['archived','Archivieren'],
     ['deleted','Löschen']
    ];
    return `<article class="fb-card fb-admin-card fb-report-card">
     <div class="fb-admin-entry-content">
      <div class="fb-report-meta"><span class="fb-tag">#${Number(report.id)}</span><span class="fb-tag">${esc(adminStates.reports[report.status]||report.status)}</span><time class="fb-muted">${date(report.created_at)}</time></div>
      <h2>${esc(config.report_categories[report.category]||report.category)}</h2>
      <p class="fb-prose">${esc(body)}</p>
     </div>
     <dl class="fb-report-details">
      <div><dt>E-Mail-Adresse</dt><dd>${esc(report.email||'Nicht angegeben')}</dd></div>
      <div><dt>Seitenbezug</dt><dd>${esc(report.page_path||'Kein Seitenbezug')}${contextLink(report)}</dd></div>
      ${location}
     </dl>
     <div class="fb-actions fb-report-actions">${actions.map(([state,label])=>
      `<button type="button" class="fb-secondary${state==='deleted'?' fb-delete':''}" data-moderate="${Number(report.id)}" data-state="${state}">${label}</button>`
     ).join('')}</div>
    </article>`;
   }
   let queueSeq=0;
   async function load(page=1,follow=null){const seq=++queueSeq;try{
    const f=Object.fromEntries(new FormData(filter));
    const d=await api({action:'admin_queue',...f,page,...(follow?{focus_id:follow.id}:{})});
    if(seq!==queueSeq)return;
    page=d.page;
    $('#fb-count').textContent=`${d.total} ${d.total===1?'Eintrag':'Einträge'}`;
    stats.querySelectorAll('button').forEach(button=>{
     const key=button.dataset.queueShortcut;
     const [,kind,state]=shortcuts[key];
     button.querySelector('strong').textContent=d.stats[key];
     button.setAttribute('aria-pressed',String(f.kind===kind&&f.state===state&&!f.status));
    });
   $('#fb-admin-list').innerHTML=d.items.map(r=>{
    if(f.kind==='ideas'){
     const editorId=`fb-idea-editor-${Number(r.id)}`;
     return `<article class="fb-card fb-admin-entry-row fb-idea-admin-card">
      ${r.moderation==='approved'&&!r.merged_into?`<div class="fb-idea-development">${entryActions(r,'status',config.statuses,r.status)}</div>`:''}
      <details class="fb-admin-card">
       <summary>#${r.id} · ${esc(r.title)} · ${esc(adminStates.ideas[r.moderation]||r.moderation)}${r.moderation==='approved'?` <span class="fb-tag fb-status-${esc(r.status)}">${esc(config.statuses[r.status]||r.status)}</span>`:''}${r.merged_into?' → #'+r.merged_into:''}</summary>
       <p class="fb-muted">${date(r.created_at)} · Community-Beitrag · ${esc(r.email||'Keine E-Mail')} ${contextLink(r)}</p>
       ${referenceMarkup(r)}
       ${r.merged_into?`<a href="mitgestalten.html?id=${Number(r.merged_into)}">Zum Zielvorschlag</a>`:''}
      </details>
      ${!r.merged_into||r.image_id?`<div class="fb-entry-controls${r.image_id?' fb-entry-controls-with-image':''}">
       ${r.merged_into?'':entryActions(r,'moderation',moderationActions,r.moderation)}
       ${r.image_id?`<img class="fb-admin-thumbnail" src="${cover(r)}" alt="Eingereichtes Kartenbild" width="72" height="72" loading="lazy">`:''}
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
        <label>Mit Zielvorschlag zusammenführen (ID)<input name="target_id" type="number" min="1" required></label>
        <button type="submit" class="fb-secondary">Zusammenführen …</button>
       </form>`}
     </article>`;
    }
    if(f.kind==='reports')return reportCard(r);
    const removeComment=`<button type="button" class="fb-delete" data-moderate="${Number(r.id)}" data-state="deleted">Löschen</button>`;
    return `<article class="fb-card fb-admin-entry-row fb-comment-admin-card">
     <details class="fb-admin-card">
      <summary>#${Number(r.id)} · Kommentar zu Idee #${Number(r.idea_id)} · ${esc(adminStates.comments[r.moderation]||r.moderation)}</summary>
      <p class="fb-prose">${esc(r.body)}</p>
      <p class="fb-muted">${date(r.created_at)} · ${esc(r.display_name||'Anonym')}</p>
     </details>
     <div class="fb-entry-controls">${entryActions(r,'moderation',{...moderationActions,hidden:'Ausblenden'},r.moderation,removeComment)}</div>
    </article>`;
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
     await api({action:f.kind==='ideas'?'admin_idea_classify':'admin_comment',id:Number(entryId),[entryAction]:filterValue,reason},true);
     if(currentQueue!==queueSeq)return;
     if(entryAction==='moderation'){
      moderation.value=filterValue;
      syncFilters();
      await load(1,{id:Number(entryId),open:wasOpen});
     }else await load(page);
    }catch(err){message(err.message,true);}
    finally{controls.forEach(control=>control.disabled=false);}
   });
   document.querySelectorAll('[data-edit]').forEach(form=>bindSubmit(form,'admin_idea',{id:Number(form.dataset.edit)},()=>load(page)));
   document.querySelectorAll('[data-merge]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const target=Number(form.elements.target_id.value);if(!confirm(`Idee #${form.dataset.merge} in Idee #${target} zusammenführen? Stimmen werden dedupliziert, Kommentare übernommen. Diese Aktion ist nicht automatisch rückgängig zu machen.`))return;const b=form.querySelector('button');b.disabled=true;try{await api({action:'admin_merge',id:Number(form.dataset.merge),target_id:target},true);message('Vorschläge zusammengeführt.');await load(page);}catch(err){message(err.message,true);}finally{b.disabled=false;}}));
   document.querySelectorAll('[data-moderate]').forEach(b=>b.onclick=async()=>{if(b.dataset.state==='deleted'&&!confirm('Diesen Eintrag endgültig löschen?'))return;b.disabled=true;try{await api({action:f.kind==='comments'?'admin_comment':'admin_report',id:Number(b.dataset.moderate),[f.kind==='comments'?'moderation':'status']:b.dataset.state},true);await load(page);}catch(err){message(err.message,true);b.disabled=false;}});pages(page,d.pages,load);
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
   filter.elements.kind.value=params.get('section')==='reports'?'reports':'ideas';
   states();filter.elements.kind.addEventListener('change',()=>{states();load();});filter.onsubmit=e=>{e.preventDefault();load();};await load();return;
  }
  $('#fb-status-filter').insertAdjacentHTML('beforeend',options(config.statuses));
  async function loadList(page=1){const seq=++listSeq;try{const values=Object.fromEntries(new FormData($('#fb-filters')));const d=await api({action:'list',...values,page});if(seq!==listSeq)return;$('#fb-count').textContent=`${d.total} ${d.total===1?'Vorschlag':'Vorschläge'}`;$('#fb-list').setAttribute('aria-busy','false');$('#fb-list').innerHTML=(d.items.map(r=>{const image=cover(r);return `<article class="fb-card fb-idea-card">${image?`<a class="fb-card-cover" href="mitgestalten.html?id=${Number(r.id)}" tabindex="-1" aria-hidden="true"><img src="${image}" alt="" width="600" height="400" loading="lazy" decoding="async"></a>`:''}<div class="fb-card-content">${tags(r)}<h2><a href="mitgestalten.html?id=${r.id}">${esc(r.title)}</a></h2><p>${esc(r.description.slice(0,240))}${r.description.length>240?' …':''}</p><div class="fb-card-support">${vote(r)}</div><div class="fb-card-footer"><a href="mitgestalten.html?id=${r.id}">${Number(r.comments)} ${Number(r.comments)===1?'Kommentar':'Kommentare'} · Mitdiskutieren →</a><time datetime="${esc(String(r.created_at).slice(0,10))}">${date(r.created_at)}</time></div>${r.seed_key?'<small class="fb-test-marker">LCN-Testidee · keine echten Nutzerbeiträge</small>':''}</div></article>`;}).join('')||'<p class="fb-note">Noch keine passenden Vorschläge.</p>')+ideaInvitation;pages(page,d.pages,loadList);}catch(err){message(err.message,true);}}
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
        <div class="fb-card-support">${vote(r)}</div>
        <div class="fb-card-footer"><span>${Number(d.comment_total)} ${Number(d.comment_total)===1?'Kommentar':'Kommentare'}</span><time datetime="${esc(String(r.created_at).slice(0,10))}">${date(r.created_at)}</time></div>
        ${r.team_reply?`<aside class="fb-note"><strong>Antwort des LCN-Teams</strong><p class="fb-prose">${esc(r.team_reply)}</p></aside>`:''}
      </div>
    </article>
    ${d.history.length?`<section class="fb-panel"><h2>Entwicklungsverlauf</h2><div class="fb-history">${d.history.map(h=>`<p><strong>${esc(config.statuses[h.new_value]||h.new_value)}</strong> · ${date(h.created_at)}<br><span class="fb-prose">${esc(h.reason)}</span></p>`).join('')}</div></section>`:''}<section class="fb-panel fb-discussion"><h2>Kommentare (${d.comment_total})</h2>${d.comments.map(c=>`<article class="fb-comment"><strong>Community-Beitrag</strong> <span class="fb-muted">${date(c.created_at)}</span><p class="fb-prose">${esc(c.body)}</p></article>`).join('')||'<p>Noch keine Kommentare.</p>'}<nav id="fb-comment-pages" class="fb-actions"></nav><form id="fb-comment-form" class="fb-form"><label>Deine Ergänzung<textarea id="fb-comment-body" name="body" required minlength="5" maxlength="4000" rows="4"></textarea></label><p class="fb-muted">Nach der Freigabe ist dein Kommentar öffentlich sichtbar.</p><button type="submit" class="fb-button">Kommentar senden</button></form></section>`;
   const cp=$('#fb-comment-pages');for(const [label,p] of [['← Frühere Kommentare',page-1],['Weitere Kommentare →',page+1]]){if(p<1||p>Math.ceil(d.comment_total/30))continue;const b=document.createElement('button');b.className='fb-secondary';b.textContent=label;b.onclick=()=>detail(p).catch(e=>message(e.message,true));cp.append(b);}bindSubmit($('#fb-comment-form'),'comment',{id:Number(r.id)},()=>$('#fb-comment-form').reset());}
   await detail();
  }else{await loadList();}if(['#idee','#privat'].includes(location.hash)){const {openComposer}=await import('./feedback_composer.js?v=privacy-label-20261107');await openComposer(location.hash);}
 }catch(err){message(err.message,true);}
})();
