(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entryTypes = {
    doctor:'Ärzt:innen', practice:'Praxis', clinic:'Klinik', other:'Anlaufstelle',
    coach:'Coaches', content_creator:'Content-Creator:innen', naturopath:'Naturheilkundler:innen',
    therapist:'Therapeut:innen', physiotherapist:'Physiotherapeut:innen', psychotherapist:'Psychotherapeut:innen',
    alternative_practitioner:'Heilpraktiker:innen', occupational_therapist:'Ergotherapeut:innen',
    speech_therapist:'Logopäd:innen', nutrition_counsellor:'Ernährungsberater:innen',
    osteopath:'Osteopath:innen', psychologist:'Psycholog:innen', sports_therapist:'Sporttherapeut:innen'
  };
  function normalizeType(value) {
    const text=String(value||'').trim();
    if(Object.hasOwn(entryTypes,text))return text;
    const aliases={osteopath:'osteopath','osteopathin':'osteopath',psychologe:'psychologist',psychologin:'psychologist',sporttherapeut:'sports_therapist',arzt:'doctor','ärztin':'doctor','arzt / ärztin':'doctor','ärzt:innen':'doctor',praxis:'practice',klinik:'clinic',anlaufstelle:'other',coach:'coach',coaches:'coach','content creator':'content_creator',naturheilkundler:'naturopath',therapeut:'therapist',physiotherapeut:'physiotherapist',psychotherapeut:'psychotherapist',heilpraktiker:'alternative_practitioner',ergotherapeut:'occupational_therapist','logopäde':'speech_therapist','ernährungsberater':'nutrition_counsellor'};
    return aliases[text.toLocaleLowerCase('de')]||Object.keys(entryTypes).find(key=>entryTypes[key].toLocaleLowerCase('de')===text.toLocaleLowerCase('de'))||text;
  }
  const typeValues=value=>[...new Set(String(value||'').split('\n').map(normalizeType).filter(Boolean))].sort();
  const typeLabel=value=>typeValues(value).map(v=>entryTypes[v]||v).join(' · ');
  window.LCNDoctorEntryTypes={labels:entryTypes,normalize:normalizeType,format:typeLabel};
  let profile, id, own = {}, loadedId, totals = {}, options = {}, proposals = [], countryCodes = [], itemVotes = {}, fieldVotes = {}, busy = false;
  const countryNames=new Intl.DisplayNames(['de'],{type:'region'});
  const countryLabel=value=>{const text=String(value||'').trim();return /^[A-Za-z]{2}$/.test(text)?countryNames.of(text.toUpperCase()):text;};
  window.LCNDoctorCountryLabel=countryLabel;
  const termNames = values => (values || []).map(v => v.term_label).filter(Boolean).join('\n');
  function groups() {
    const d=profile.item,r=profile.research||{};
    return {
      identity: {title:'Name und Praxis',fields:[['name','Name',d.dr_display_name],['organization','Praxis / Organisation',d.dr_org_name],['type','Einordnung des Behandlers',typeValues(d.dr_type).join('\n')]]},
      medical: {title:'Medizinisches Profil',fields:[['specialty','Fachrichtungen',termNames(r.specialty||profile.terms?.specialty)],['specializations','Spezialisierungen',termNames(r.specializations)],['qualifications','Zusatzqualifikationen',termNames(r.qualifications)]]},
      location: {title:'Standort',fields:[['address','Adresse',[[d.loc_street,d.loc_housenumber].filter(Boolean).join(' '),[d.loc_plz,d.loc_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],['country','Land',countryCodes.find(code=>code===String(d.loc_country||'').toUpperCase()||countryLabel(code).toLocaleLowerCase('de')===String(d.loc_country||'').toLocaleLowerCase('de'))||d.loc_country],['additional','Weitere Standorte',(r.locations||[]).filter(l=>Number(l.loc_id)!==Number(d.loc_id)).map(l=>[l.loc_label,l.loc_street,l.loc_plz,l.loc_city,l.loc_country].filter(Boolean).join(', ')).join('\n')]]},
      contact: {title:'Kontakt',fields:[['phone','Telefon',d.loc_phone||d.dr_phone],['email','E-Mail',d.loc_email||d.dr_email],['website','Website',d.loc_website||d.dr_website]]}
    };
  }
  async function request(body) {
    const response=await fetch('api/doctor_profile_feedback.php'+(body?'':'?id='+id),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...body})}:{});
    const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Rückmeldung konnte nicht geladen werden.');
    own=data.own||{};totals=data.totals||{};options=data.options||{};proposals=data.proposals||[];countryCodes=data.country_codes||[];fieldVotes=data.field_votes||{};itemVotes=data.item_votes||{};paint();return data;
  }
  function paint() {
    document.querySelectorAll('[data-profile-feedback]').forEach(el=>{
      const key=el.dataset.profileFeedback, vote=own[key]?.stance;
      const title=groups()[key].title;
      el.innerHTML=`<div class="catalog-feedback catalog-feedback-standard" role="group" aria-label="${esc(title)} prüfen">${[1,-1].map(stance=>{
        const selected=vote===stance, count=totals[key]?.[stance===1?'confirm':'oppose']||0;
        const action=stance===1?(selected?'Bestätigung zurücknehmen':'Bestätigen'):(vote===-1?'Widerspruch zurücknehmen':'Widersprechen');
        const subject=stance===1?`Die Angaben im Bereich „${title}“ sind korrekt.`:`Die Angaben im Bereich „${title}“ sind nicht korrekt oder unvollständig. Du kannst sie korrigieren und ergänzen.`;
        return `<button type="button" data-profile-${stance===1?'confirm':'oppose'}="${key}" data-stance="${stance}" aria-pressed="${selected}" data-feedback-action="${esc(action)}" data-feedback-subject="${esc(subject)}" data-feedback-tone="${selected?'neutral':stance===1?'confirm':'oppose'}" data-lcn-tooltip="${esc(action+': '+subject)}" aria-label="${esc(action+': '+subject)} · ${count} Stimmen" ${busy?'disabled':''}>${stance===1?'✓':'×'} ${count}</button>`;
      }).join('')}</div>`;
      el.querySelectorAll('button').forEach(button=>{button.lcnTooltipAction={label:'Vorschläge ansehen',onClick:()=>showProposals(key)};});
    });
  }
  function notify(message, error=false, tone='neutral') {
    if(window.LCNCatalogRelations?.showFeedbackNotice){window.LCNCatalogRelations.showFeedbackNotice(message,error,tone);return;}
    const el=document.getElementById('feedback');if(el){el.textContent=message;el.classList.add('show');}
  }
  async function showProposals(key) {
    if(busy)return;
    busy=true;paint();
    try{await request();open(key);}catch(err){notify(err.message,true);}finally{busy=false;paint();}
  }
  function confirmWithdrawal(key,field) {
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='catalog-report-dialog ux-taxonomy-withdraw';
      const title=document.createElement('h3');title.id='profile-withdraw-title';title.textContent='Wirklich zurücknehmen?';dialog.setAttribute('aria-labelledby',title.id);
      const text=document.createElement('p');
      text.textContent=field?`Nur dein Änderungsvorschlag für „${groups()[key].fields.find(f=>f[0]===field)[1]}“ wird zurückgenommen. Deine Stimmen und Änderungen bei den anderen Feldern bleiben erhalten.`:own[key]?.stance===1?`Deine Bestätigung für „${groups()[key].title}“ wird zurückgenommen.`:`Dein Widerspruch und alle deine Änderungsvorschläge für „${groups()[key].title}“ werden gestrichen. Die anderen Bereiche bleiben erhalten.`;
      const actions=document.createElement('div');actions.className='ux-taxonomy-withdraw-actions';let confirmed=false,viewRequested=false;
      for(const [label,action] of [['Änderungen ansehen','view'],['Änderungen behalten','keep'],['Ja, zurücknehmen','remove']]){
        const button=document.createElement('button');button.type='button';button.textContent=label;
        if(action==='remove')button.className='ux-taxonomy-withdraw-confirm';if(action==='keep')button.autofocus=true;
        button.onclick=()=>{confirmed=action==='remove';viewRequested=action==='view';dialog.close();};actions.append(button);
      }
      dialog.append(title,text,actions);document.body.append(dialog);dialog.onclose=()=>{dialog.remove();resolve(confirmed);if(viewRequested&&!document.querySelector('.doctor-profile-dialog[open]'))showProposals(key);};dialog.showModal();
    });
  }
  async function saveStance(key,stance) {
    busy=true;paint();
    try{await request({section:key,stance});notify(stance===1?'Bestätige: Die Angaben im Bereich „'+groups()[key].title+'“ sind korrekt.':'Zurückgenommen: Deine Rückmeldung für „'+groups()[key].title+'“ wurde zurückgenommen.',false,stance===1?'confirm':'neutral');}
    catch(err){notify(err.message,true);}finally{busy=false;paint();}
  }
  const lines=value=>[...new Set(String(value||'').split('\n').map(v=>v.trim()).filter(Boolean))];
  function open(key) {
    const group=groups()[key],dialog=document.createElement('dialog');
    dialog.className='catalog-report-dialog ux-taxonomy-dialog ux-taxonomy-community doctor-profile-dialog';
    dialog.setAttribute('aria-labelledby','profile-correction-title');
    dialog.innerHTML=`<h3 id="profile-correction-title">${esc(group.title)} korrigieren</h3><p>Schlage eine Änderung vor oder unterstütze einen Vorschlag der Community.</p><div class="ux-taxonomy-community-fields"></div><p role="status" aria-live="polite"></p><div class="ux-taxonomy-dialog-footer"><small>Änderungen und Stimmen werden direkt gespeichert. Mit Enter oder ✓ bestätigen.</small><button type="button" data-close>Schließen</button></div>`;
    const content=dialog.querySelector('.ux-taxonomy-community-fields'),status=dialog.querySelector('[role="status"]');
    let saving=false;
    const display=(field,value)=>field==='type'?typeLabel(value):field==='country'?countryLabel(value):value;
    function tooltip(button,action,subject,tone='confirm'){
      button.dataset.feedbackAction=action;button.dataset.feedbackSubject=subject;button.dataset.feedbackTone=tone;button.dataset.lcnTooltip=action+': '+subject;button.setAttribute('aria-label',action+': '+subject);
    }
    async function save(field,stance,value){
      if(saving||busy)return false;
      if(stance!==-1&&fieldVotes[key]?.[field]?.own===-1&&!await confirmWithdrawal(key,field))return false;
      if(stance===-1){
        value=String(value??'').trim();
        const current=String(group.fields.find(f=>f[0]===field)[2]||'').trim();
        if(value===current){status.textContent='Diese Angabe entspricht dem aktuellen Eintrag. Du kannst ihn mit ✓ bestätigen.';return false;}
        if(value===own[key]?.corrections?.[field]){status.textContent='Diese Auswahl ist bereits gespeichert.';return false;}
      }
      saving=true;busy=true;paint();dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
      try{
        await request({section:key,field,stance,...(stance===-1?{corrections:{[field]:value}}:{})});
        if(!dialog.open)return true;
        render();status.textContent=stance===-1?'Dein Vorschlag wurde zur Prüfung gespeichert.':stance===1?'Deine Bestätigung wurde gespeichert.':'Deine Stimme wurde zurückgenommen.';
        notify((stance===-1?'Widerspreche: ':stance===1?'Bestätige: ':'Zurückgenommen: ')+group.fields.find(f=>f[0]===field)[1],false,stance===-1?'oppose':stance===1?'confirm':'neutral');
        return true;
      }catch(err){status.textContent=err.message;return false;}
      finally{saving=false;busy=false;paint();dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}
    }
    async function voteEntry(field,entry,stance){
      if(saving||busy)return;
      saving=true;busy=true;paint();dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
      try{await request({section:key,field,entry,stance});if(dialog.open){render();status.textContent=stance===1?'„'+display(field,entry)+'“ wurde bestätigt.':'Deine Bestätigung für „'+display(field,entry)+'“ wurde zurückgenommen.';}}
      catch(err){status.textContent=err.message;}
      finally{saving=false;busy=false;paint();dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}
    }
    function entryControls(field,entry){
      const vote=itemVotes[key]?.[field]?.[entry]||{confirm:0,own:0};
      const controls=document.createElement('span');controls.className='catalog-feedback catalog-feedback-standard ux-taxonomy-proposal-actions profile-entry-votes';
      const button=document.createElement('button');button.type='button';button.dataset.entryConfirm=entry;button.textContent='✓ '+vote.confirm;button.setAttribute('aria-pressed',String(vote.own===1));
      tooltip(button,vote.own===1?'Bestätigung zurücknehmen':'Bestätigen',display(field,entry),vote.own===1?'neutral':'confirm');button.onclick=()=>voteEntry(field,entry,vote.own===1?0:1);controls.append(button);return controls;
    }
    function render(){
      content.replaceChildren();
      for(const [field,label,current] of group.fields){
        const correction=own[key]?.corrections?.[field],vote=fieldVotes[key]?.[field]||{confirm:0,oppose:0,own:0};
        const section=document.createElement('section');section.dataset.profileField=field;
        section.innerHTML=`<h4 class="ux-taxonomy-field-title">${esc(label)}</h4><p class="ux-taxonomy-current">${esc(display(field,current)||'Noch keine Angabe')}</p><button type="button" class="ux-taxonomy-edit">${esc(label)} ändern</button><div class="ux-taxonomy-editor" hidden></div><div class="ux-taxonomy-proposals"><h5>Aktuelle Angabe und Vorschläge</h5><article class="ux-taxonomy-current-option"><strong>${esc(display(field,current)||'Noch keine Angabe')}</strong><small>Aktueller Eintrag · Bestätigungen dieser Angabe</small><span class="catalog-feedback catalog-feedback-standard ux-taxonomy-proposal-actions"><button type="button" data-current-confirm aria-pressed="${vote.own===1}">✓ ${vote.confirm}</button>${vote.own===1?'<button type="button" data-current-undo>×</button>':''}</span></article></div>`;
        const confirm=section.querySelector('[data-current-confirm]');tooltip(confirm,vote.own===1?'Bestätigung zurücknehmen':'Bestätigen',label);
        confirm.onclick=()=>save(field,vote.own===1?0:1);
        const undo=section.querySelector('[data-current-undo]');if(undo){tooltip(undo,'Bestätigung zurücknehmen',label,'neutral');undo.onclick=()=>save(field,0);}
        if(correction!==undefined){const selected=document.createElement('p');selected.className='ux-taxonomy-selected';selected.textContent='Deine Auswahl: '+(display(field,correction)||'Angabe entfernen');section.prepend(selected);}
        const list=section.querySelector('.ux-taxonomy-proposals');
        let pending=proposals.filter(p=>p.section===key&&p.field===field);
        if((key==='medical'||field==='type'||field==='additional')){
          const baseline=lines(current),grouped=new Map();
          for(const proposal of pending){
            const proposed=lines(proposal.value);
            const deltas=[...baseline.filter(v=>!proposed.includes(v)).map(term=>({term,operation:'remove'})),...proposed.filter(v=>!baseline.includes(v)).map(term=>({term,operation:'add'}))];
            for(const delta of deltas){const hash=delta.operation+':'+delta.term;const existing=grouped.get(hash)||{...delta,count:0,own:false};existing.count+=proposal.count;existing.own=existing.own||proposal.own||correction===proposal.value;grouped.set(hash,existing);}
          }
          pending=[...grouped.values()];
        }
        if(!pending.length){const empty=document.createElement('p');empty.className='ux-taxonomy-no-alternatives';empty.textContent='Noch keine anderen Vorschläge aus der Community.';list.append(empty);}
        for(const proposal of pending){
          const supported=proposal.own||(proposal.value!==undefined&&correction===proposal.value),row=document.createElement('article');
          if((key==='medical'||field==='type'||field==='additional')){
            row.dataset.changeOperation=proposal.operation;row.dataset.changeTerm=proposal.term;
            const action=proposal.operation==='remove'?'entfernen':'hinzufügen';
            row.innerHTML=`<strong>${esc(display(field,proposal.term))} <span class="profile-change-label ${proposal.operation}">${action}</span></strong><small>${supported?'Deine Änderung · ':''}Prüfung ausstehend</small><span class="catalog-feedback catalog-feedback-standard ux-taxonomy-proposal-actions"><button type="button" data-proposal-confirm aria-pressed="${supported}">✓ ${proposal.count}</button>${supported?'<button type="button" data-proposal-undo>×</button>':''}</span>`;
            const apply=()=>{
              const values=lines(own[key]?.corrections?.[field]??current),include=proposal.operation==='add'?!supported:supported;
              const next=include?[...new Set([...values,proposal.term])]:values.filter(v=>v!==proposal.term);
              // Restore original order so undoing one delta keeps the other deltas intact.
              const baseline=lines(current),ordered=[...baseline.filter(v=>next.includes(v)),...next.filter(v=>!baseline.includes(v))];
              return ordered.join('\n')===baseline.join('\n')?save(field,0):save(field,-1,ordered.join('\n'));
            };
            const join=row.querySelector('[data-proposal-confirm]');tooltip(join,supported?'Änderung zurücknehmen':'Änderung unterstützen',display(field,proposal.term)+' '+action,supported?'neutral':proposal.operation==='remove'?'oppose':'confirm');join.onclick=apply;
            const remove=row.querySelector('[data-proposal-undo]');if(remove){tooltip(remove,'Änderung zurücknehmen',display(field,proposal.term)+' '+action,'neutral');remove.onclick=apply;}
            list.append(row);continue;
          }
          row.innerHTML=`<strong>${esc(display(field,proposal.value)||'Angabe entfernen')}</strong><small>Prüfung ausstehend</small><span class="catalog-feedback catalog-feedback-standard ux-taxonomy-proposal-actions"><button type="button" data-proposal-confirm aria-pressed="${supported}">✓ ${proposal.count}</button>${supported?'<button type="button" data-proposal-undo>×</button>':''}</span>`;
          const join=row.querySelector('[data-proposal-confirm]');tooltip(join,supported?'Vorschlag zurücknehmen':'Bestätigen',display(field,proposal.value)||'Angabe entfernen',supported?'neutral':'confirm');join.onclick=()=>save(field,supported?0:-1,proposal.value);
          const remove=row.querySelector('[data-proposal-undo]');if(remove){tooltip(remove,'Eigenen Vorschlag zurücknehmen',label,'neutral');remove.onclick=()=>save(field,0);}
          list.append(row);
        }
        const edit=section.querySelector('.ux-taxonomy-edit'),editor=section.querySelector('.ux-taxonomy-editor');
        edit.onclick=event=>{
          editor.hidden=!editor.hidden;edit.setAttribute('aria-expanded',String(!editor.hidden));
          if(editor.hidden)return;if(editor.childElementCount){editor.querySelector('input,select')?.focus();return;}
          if(key==='medical'){
            editor.classList.add('doctor-profile-medical-editor');
            const values=lines(correction??current),terms=document.createElement('div');terms.className='doctor-profile-terms';
            const saveTerms=next=>next.join('\n')===lines(current).join('\n')&&correction!==undefined?save(field,0):save(field,-1,next.join('\n'));
            for(const term of values){const row=document.createElement('div');row.className='profile-term';const name=document.createElement('span');name.textContent=term;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',term+': als falsch markieren');remove.onclick=()=>saveTerms(values.filter(v=>v!==term));row.append(name);if(lines(current).includes(term))row.append(entryControls(field,term));row.append(remove);terms.append(row);}editor.append(terms);
            const picker=document.createElement('div');picker.className='doctor-profile-inline-add';editor.append(picker);
            const choices=()=>((options[field]||[]).filter(v=>!values.some(x=>x.toLocaleLowerCase('de')===v.toLocaleLowerCase('de'))).map((name,id)=>({id:id+1,name})));
            const add=term=>{term=term.trim();if(term.length<2){status.textContent='Bitte mindestens zwei Zeichen eingeben.';return false;}return saveTerms([...values,term]);};
            window.LCNCatalogRelations.combo(picker,{label:label+' ergänzen',items:choices,missingLabel:'＋ Neuen Eintrag hinzufügen',onSelect:item=>add(item.name),onMissing:add});
            const input=picker.querySelector('input');input.placeholder='Weiteren Eintrag hinzufügen …';
            input.addEventListener('keydown',async e=>{
              if(e.isComposing||!['Enter','Tab'].includes(e.key)||e.shiftKey)return;
              const text=input.value.trim();if(!text)return;
              const active=input.getAttribute('aria-activedescendant');
              if(e.key==='Enter'&&active)return; // Shared picker handles the highlighted option.
              e.preventDefault();e.stopImmediatePropagation();
              const highlighted=active?picker.querySelector('[id="'+active+'"]')?.textContent:null;
              const exact=choices().find(v=>v.name.toLocaleLowerCase('de')===text.toLocaleLowerCase('de'));
              const saved=await add(highlighted||exact?.name||text);
              if(saved){
                const index=group.fields.findIndex(f=>f[0]===field),next=e.key==='Tab'?group.fields[index+1]?.[0]:field;
                (next?dialog.querySelector(`[data-profile-field="${next}"] input[role="combobox"]`):dialog.querySelector('[data-close]'))?.focus();
              }
            },true);
            return;
          }
          if(field==='country'){
            const picker=document.createElement('div');editor.append(picker);
            const choices=()=>countryCodes.map(code=>({id:code,name:countryLabel(code)})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
            const choose=item=>save(field,-1,item.id);
            window.LCNCatalogRelations.combo(picker,{label:'Land suchen oder auswählen',items:choices,retainSelection:true,onSelect:choose});
            const input=picker.querySelector('input');input.placeholder='Land suchen oder auswählen …';
            input.addEventListener('keydown',e=>{
              if(e.key!=='Enter'||e.isComposing||input.hasAttribute('aria-activedescendant'))return;
              e.preventDefault();
              const value=input.value.trim().toLocaleLowerCase('de'),item=choices().find(item=>item.id.toLowerCase()===value||item.name.toLocaleLowerCase('de')===value);
              if(item)choose(item);else status.textContent='Bitte ein Land aus der Länderauswahl auswählen.';
            });input.focus();return;
          }
          const form=document.createElement('form');form.className='ux-taxonomy-name-form';
          if(field==='address'){
            form.classList.add('doctor-profile-address-form');
            const value=String(correction??current??''),comma=value.lastIndexOf(',');
            const streetLine=(comma>=0?value.slice(0,comma):value).trim(),cityLine=comma>=0?value.slice(comma+1).trim():'';
            const streetMatch=streetLine.match(/^(.*?)\s+(\d+[\p{L}]?(?:\s*[-/–]\s*\d+[\p{L}]?)?)$/u),cityMatch=cityLine.match(/^(\S*\d\S*)\s+(.+)$/);
            const parts={street:streetMatch?streetMatch[1]:streetLine,house_number:streetMatch?streetMatch[2]:'',postal_code:cityMatch?cityMatch[1]:'',city:cityMatch?cityMatch[2]:cityLine};
            form.innerHTML=`<div class="doctor-profile-address-fields">${[['street','Straße'],['house_number','Hausnummer'],['postal_code','Postleitzahl'],['city','Stadt']].map(([name,caption])=>`<label>${caption}<input type="text" name="${name}" aria-label="${caption}" maxlength="${name==='street'||name==='city'?200:30}" value="${esc(parts[name])}" autocomplete="off"></label>`).join('')}</div>`;
          }else if(field==='type'){
            const selected=typeValues(correction??current),choices=[...new Set([...Object.keys(entryTypes),...typeValues(current),...selected])];
            form.classList.add('doctor-profile-type-form');
            form.innerHTML=`<fieldset><legend>${esc(label)} · Mehrfachauswahl möglich</legend><div class="doctor-profile-type-choices">${choices.map(v=>`<label><input type="checkbox" name="provider_type" value="${esc(v)}" ${selected.includes(v)?'checked':''}><span>${esc(entryTypes[v]||v)}</span></label>`).join('')}</div></fieldset>`;
          }else form.innerHTML=`<label><input type="text" aria-label="${esc(label)}" maxlength="2000" value="${esc(correction??current??'')}"></label>`;
          const apply=document.createElement('button');apply.type='submit';apply.textContent='✓';apply.setAttribute('aria-label',label+': Korrektur übernehmen');form.append(apply);
          const input=form.querySelector('input');
          form.onsubmit=e=>{
            e.preventDefault();
            if(field==='address'){
              const part=name=>form.elements.namedItem(name).value.trim();
              const address=[[part('street'),part('house_number')].filter(Boolean).join(' '),[part('postal_code'),part('city')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
              save(field,-1,address);
            }else if(field==='type'){
              const selected=[...form.querySelectorAll('[name="provider_type"]:checked')].map(el=>el.value).sort();
              if(!selected.length){status.textContent='Bitte mindestens eine Einordnung auswählen.';return;}
              save(field,-1,selected.join('\n'));
            }else save(field,-1,input.value);
          };
          if(field==='type')form.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
          editor.append(form);if(event!==false)input.focus();
        };
        if(field==='type'||field==='additional'){
          const entries=lines(current),currentRow=section.querySelector('.ux-taxonomy-current-option');
          if(entries.length){
            for(const entry of entries){const row=document.createElement('article');row.className='ux-taxonomy-current-option';const name=document.createElement('strong');name.textContent=display(field,entry);const note=document.createElement('small');note.textContent='Aktueller Eintrag';row.append(name,note,entryControls(field,entry));currentRow.before(row);}currentRow.remove();
          }
        }
        content.append(section);
        if(field==='address'){
          section.classList.add('doctor-profile-address-section');
          edit.hidden=true;section.querySelector('.ux-taxonomy-current').hidden=true;
          edit.onclick(false);
        }
        if(key==='medical'){
          section.classList.add('doctor-profile-medical-field');
          edit.hidden=true;section.querySelector('.ux-taxonomy-current').hidden=true;
          section.querySelector('.ux-taxonomy-selected')?.remove();
          const currentRow=section.querySelector('.ux-taxonomy-current-option');if(lines(current).length)currentRow.remove();else currentRow.querySelector('strong').hidden=correction===undefined;
          if(lines(current).length)list.querySelector('h5').textContent='Änderungsvorschläge';
          if(!pending.length){list.querySelector('h5').hidden=true;list.querySelector('.ux-taxonomy-no-alternatives')?.remove();}
          edit.onclick();
        }
      }
    }
    const trigger=document.activeElement;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    dialog.onclose=()=>{dialog.remove();const active=document.querySelector(`[data-profile-oppose="${key}"]`);(trigger?.isConnected?trigger:active)?.focus();};
    render();dialog.showModal();dialog.scrollTop=0;
  }
  document.addEventListener('click',async e=>{
    const oppose=e.target.closest('[data-profile-oppose]');
    if(oppose&&!busy){
      const key=oppose.dataset.profileOppose;
      if(own[key]?.stance===-1){if(await confirmWithdrawal(key))await saveStance(key,0);}
      else await showProposals(key);
      return;
    }
    const confirm=e.target.closest('[data-profile-confirm]');if(!confirm||busy)return;
    const key=confirm.dataset.profileConfirm;
    if(own[key]?.stance===1){await saveStance(key,0);return;}
    if(own[key]?.stance===-1&&!await confirmWithdrawal(key))return;
    await saveStance(key,1);
  });
  window.addEventListener('lcn-doctor-rendered',async e=>{
    if(!e.detail?.data||e.detail.submission)return;profile=e.detail.data;id=e.detail.id;
    const cards=[document.querySelector('.overview-identity'),...document.querySelectorAll('.overview-group')];
    cards.forEach((card,i)=>{if(!card||card.querySelector('[data-profile-feedback]'))return;const el=document.createElement('div');el.className='profile-feedback';el.dataset.profileFeedback=['identity','medical','location','contact'][i];card.prepend(el);});
    paint();if(loadedId!==id){loadedId=id;try{await request();}catch{loadedId=null;}}
  });
})();
