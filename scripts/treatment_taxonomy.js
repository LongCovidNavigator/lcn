document.addEventListener('DOMContentLoaded',()=>{

 const id=document.querySelector('[data-treatment-id]')?.dataset.treatmentId,host=document.querySelector('.ux-treatment-identity');if(!id||!host)return;

 const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};

 const fields={treatmentname:['Name',host.querySelector('h3')?.textContent||''],typ:['Kategorie',host.querySelector('.ux-identity-category-field strong')?.textContent||''],unterkategorie:['Unterkategorie',host.querySelector('.ux-identity-subcategory-field strong')?.textContent||'']};

 const controls=make('div'),notice=make('small');controls.className='catalog-feedback catalog-feedback-standard ux-taxonomy-feedback';controls.setAttribute('aria-label','Angaben zur Therapie prüfen');notice.className='ux-taxonomy-notice';notice.setAttribute('role','status');host.prepend(controls);

 let data={},busy=true;const confirm=make('button'),oppose=make('button','×');confirm.type=oppose.type='button';controls.append(confirm,oppose);

 const notify=(text,error=false,tone='neutral')=>window.LCNCatalogRelations.showFeedbackNotice(text,error,tone);

 function paint(){for(const [button,stance] of [[confirm,1],[oppose,-1]]){const count=(stance===1?data.confirm:data.oppose)||0,selected=data.own===stance,action=selected?(stance===1?'Bestätigung zurücknehmen':'Widerspruch zurücknehmen'):(stance===1?'Bestätigen':'Widersprechen'),subject=stance===1?'Name und Kategorien der angezeigten Therapie sind korrekt.':'Name oder Kategorien der angezeigten Therapie sind nicht korrekt.';button.textContent=(stance===1?'✓ ':'× ')+count;button.setAttribute('aria-pressed',String(selected));button.dataset.stance=String(stance);button.dataset.feedbackAction=action;button.dataset.feedbackSubject=subject;button.dataset.feedbackTone=selected?'neutral':stance===1?'confirm':'oppose';button.dataset.lcnTooltip=action+': '+subject;button.removeAttribute('title');button.setAttribute('aria-label',action+': '+subject+' · '+count+' Stimmen');button.disabled=busy;}}

 async function vote(stance){if(stance===1&&data.own===-1&&!await confirmWithdrawal())return false;busy=true;paint();try{data=await request('overview',{stance});notify((stance===0?'Zurückgenommen: ':stance===1?'Bestätige: ':'Widerspreche: ')+fields.treatmentname[1],false,stance===0?'neutral':stance===1?'confirm':'oppose');return true;}catch(error){notify(error.message,true);return false;}finally{busy=false;paint();}}

 async function request(field,body){const response=await fetch('api/treatment_taxonomy_feedback.php'+(body?'':'?id='+id+'&field='+field),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(id),field,...body})}:{cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Rückmeldung konnte nicht gespeichert werden.');return result;}

 const alreadyVoted=()=>notify('Bereits abgestimmt: Du hast hier bereits abgestimmt. Über × kannst du deine Stimme zurücknehmen.',false,'neutral');

 confirm.addEventListener('click',()=>vote(data.own===1?0:1));

 for(const button of [confirm,oppose])button.lcnTooltipAction={label:'Vorschläge ansehen',onClick:openDialog};

 async function confirmWithdrawal(field){

  return new Promise(resolve=>{

   const dialog=make('dialog'),title=make('h3','Wirklich zurücknehmen?'),text=make('p',field?'Nur dein Änderungsvorschlag für „'+fields[field][0]+'“ wird zurückgenommen. Deine Stimmen und Änderungen bei den anderen Feldern bleiben erhalten.':data.own===1?'Deine Bestätigung wird zurückgenommen.':'Dein Widerspruch und alle deine Änderungsvorschläge zu dieser Therapie werden gestrichen.'),actions=make('div'),cancel=make('button','Änderungen behalten'),remove=make('button','Ja, zurücknehmen');

   dialog.className='catalog-report-dialog ux-taxonomy-withdraw';title.id='taxonomy-withdraw-title';dialog.setAttribute('aria-labelledby',title.id);actions.className='ux-taxonomy-withdraw-actions';cancel.type=remove.type='button';remove.className='ux-taxonomy-withdraw-confirm';cancel.autofocus=true;let confirmed=false;

   cancel.addEventListener('click',()=>dialog.close());remove.addEventListener('click',()=>{confirmed=true;dialog.close();});const view=make('button','Änderungen ansehen');view.type='button';let viewRequested=false;view.addEventListener('click',()=>{viewRequested=true;dialog.close();});actions.append(view,cancel,remove);dialog.append(title,text,actions);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();resolve(confirmed);if(viewRequested)openDialog();},{once:true});dialog.showModal();

  });

 }

 oppose.addEventListener('click',async()=>{if(data.own===-1){if(await confirmWithdrawal())await vote(0);return;}openDialog();});

 function openDialog(){

  const dialog=make('dialog');dialog.className='catalog-report-dialog ux-taxonomy-dialog ux-taxonomy-community';

  const title=make('h3','Angaben zur Therapie korrigieren'),intro=make('p','Schlage eine Änderung vor oder unterstütze einen Vorschlag der Community.'),content=make('div'),status=make('p'),cancel=make('button','Schließen');title.id='taxonomy-dialog-title';dialog.setAttribute('aria-labelledby',title.id);status.setAttribute('role','status');cancel.type='button';cancel.addEventListener('click',()=>dialog.close());const footer=make('div'),hint=make('small','Eine Auswahl je Feld. Kategorie und Unterkategorie werden gemeinsam vorgeschlagen.');footer.className='ux-taxonomy-dialog-footer';footer.append(hint,cancel);dialog.append(title,intro,content,status,footer);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();oppose.focus();});dialog.showModal();

  let saving=false;

  async function save(field,choice){if(saving)return;saving=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);try{data=await request(field,{stance:-1,choice});paint();notify('Widerspreche: '+fields.treatmentname[1]+' · '+fields[field][0]+': '+choice,false,'oppose');await render();status.textContent=field==='typ'?'Kategorie übernommen. Wähle jetzt eine passende Unterkategorie.':'Deine Auswahl wurde gespeichert.';if(field==='typ'){const next=dialog.querySelector('[data-taxonomy-field=unterkategorie] .ux-taxonomy-edit');next.click();next.scrollIntoView({block:'nearest'});}}catch(error){status.textContent=error.message;}finally{saving=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}}

  async function render(){

   status.textContent='Vorschläge werden geladen …';

   try{const state=await request('overview');if(!dialog.open)return;data=state;paint();content.replaceChildren();status.textContent='';const grid=make('div');grid.className='ux-taxonomy-community-fields';

    for(const [field,[label,current]] of Object.entries(fields)){

     const section=make('section'),heading=make('h4',label),existing=make('p','Aktuell: '+(current||'Noch keine Angabe')),list=make('div'),edit=make('button',field==='treatmentname'?'Name / Schreibweise ändern':label+' ändern'),editor=make('div');heading.className='ux-taxonomy-field-title';existing.className='ux-taxonomy-current';edit.className='ux-taxonomy-edit';editor.className='ux-taxonomy-editor';section.dataset.taxonomyField=field;list.className='ux-taxonomy-proposals';edit.type='button';editor.hidden=true;if(field==='treatmentname'){heading.textContent='Name:';existing.textContent=current;section.classList.add('ux-taxonomy-name-card');}

     if(field==='unterkategorie')existing.textContent='Zur Kategorie: '+state.category;

     if(state.own_choices[field]){const selected=make('p','Deine Auswahl: '+state.own_choices[field]);selected.className='ux-taxonomy-selected';section.append(selected);}

     const proposals=state.suggestions.filter(s=>s.field===field&&(field!=='unterkategorie'||s.category===state.category||s.own));list.append(make('h5','Aktuelle Angabe und Vorschläge'));

     const fieldVote=state.field_votes[field];const currentRow=make('article'),currentName=make('strong',current||'Noch keine Angabe'),currentInfo=make('small','Aktueller Eintrag · Bestätigungen dieser Angabe'),currentActions=make('span'),currentVote=make('button','✓ '+(fieldVote.confirm||0));currentRow.className='ux-taxonomy-current-option';currentActions.className='catalog-feedback catalog-feedback-standard ux-taxonomy-proposal-actions';currentVote.type='button';currentVote.setAttribute('aria-pressed',String(fieldVote.own===1));currentVote.setAttribute('aria-label',(fieldVote.own===1?'Bestätigung zurücknehmen: ':'Aktuelle Angabe bestätigen: ')+(current||label));currentVote.dataset.feedbackAction=fieldVote.own===1?'Bestätigung zurücknehmen':'Bestätigen';currentVote.dataset.feedbackSubject=label+': '+current;currentVote.dataset.feedbackTone=fieldVote.own===1?'neutral':'confirm';currentVote.dataset.lcnTooltip=currentVote.dataset.feedbackAction+': '+currentVote.dataset.feedbackSubject;currentVote.addEventListener('click',async()=>{if(saving)return;saving=true;try{if(fieldVote.own===1){data=await request(field,{stance:0});paint();notify('Zurückgenommen: '+label,false,'neutral');await render();return;}if(fieldVote.own===-1&&!await confirmWithdrawal(field))return;data=await request(field,{stance:1});paint();notify('Bestätige: '+label,false,'confirm');await render();}finally{saving=false;}});currentActions.append(currentVote);if(fieldVote.own===1){const undoCurrent=make('button','×');undoCurrent.type='button';undoCurrent.setAttribute('aria-label','Bestätigung zurücknehmen: '+label);undoCurrent.dataset.feedbackAction='Zurücknehmen';undoCurrent.dataset.feedbackSubject=label;undoCurrent.dataset.feedbackTone='neutral';undoCurrent.dataset.lcnTooltip='Bestätigung zurücknehmen: '+label;undoCurrent.addEventListener('click',async()=>{if(saving)return;saving=true;undoCurrent.disabled=true;try{data=await request(field,{stance:0});paint();notify('Zurückgenommen: '+label,false,'neutral');await render();}catch(error){status.textContent=error.message;}finally{saving=false;undoCurrent.disabled=false;}});currentActions.append(undoCurrent);}currentRow.append(currentName,currentInfo,currentActions);list.append(currentRow);

     if(!proposals.length){const empty=make('p','Noch keine anderen Vorschläge aus der Community.');empty.className='ux-taxonomy-no-alternatives';list.append(empty);}

     for(const proposal of proposals){

      const row=make('article'),name=make('strong',proposal.choice),count=make('small','Prüfung ausstehend'+(field==='unterkategorie'&&proposal.category!==state.category?' · Zur Kategorie: '+proposal.category:'')),actions=make('span'),join=make('button','✓ '+proposal.count),remove=make('button','×');actions.className='catalog-feedback catalog-feedback-standard ux-taxonomy-proposal-actions';join.type=remove.type='button';join.setAttribute('aria-pressed',String(proposal.own));join.setAttribute('aria-label',proposal.own?'Bestätigt: '+proposal.choice:'Bestätigen: '+proposal.choice);join.dataset.feedbackAction=proposal.own?'Bestätigt':'Bestätigen';join.dataset.feedbackSubject=proposal.choice;join.dataset.feedbackTone=proposal.own?'neutral':'confirm';join.dataset.lcnTooltip=join.dataset.feedbackAction+': '+proposal.choice;

      const undo=async()=>{if(saving)return;if(!await confirmWithdrawal(field))return;saving=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);try{data=await request(field,{stance:0});paint();notify('Zurückgenommen: '+label,false,'neutral');await render();}finally{saving=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}};

      join.addEventListener('click',()=>{if(proposal.own){alreadyVoted();return;}save(field,proposal.choice);});remove.setAttribute('aria-label','Eigenen Vorschlag zurücknehmen: '+proposal.choice);remove.dataset.feedbackAction='Zurücknehmen';remove.dataset.feedbackSubject=proposal.choice;remove.dataset.feedbackTone='neutral';remove.dataset.lcnTooltip='Zurücknehmen: '+proposal.choice;remove.hidden=!proposal.own;remove.addEventListener('click',undo);actions.append(join,remove);row.append(name,count,actions);list.append(row);

     }

     edit.addEventListener('click',async()=>{editor.hidden=!editor.hidden;if(field==='treatmentname')existing.hidden=!editor.hidden;if(editor.hidden||editor.childElementCount)return;status.textContent='Auswahl wird geladen …';try{const options=await request(field);if(!dialog.open)return;status.textContent='';if(field==='treatmentname'){

       const form=make('form'),caption=make('label'),input=make('input'),apply=make('button','✓');form.className='ux-taxonomy-name-form';input.type='text';input.value=state.own_choices.treatmentname||current;input.required=true;input.minLength=2;input.maxLength=150;input.setAttribute('aria-label','Name bearbeiten');apply.type='submit';apply.setAttribute('aria-label','Namenskorrektur übernehmen');caption.append(input);form.append(caption,apply);form.addEventListener('submit',async event=>{event.preventDefault();const value=input.value.trim();if(value===current.trim()){status.textContent='Bitte ändere den Namen, bevor du die Korrektur übernimmst.';return;}await save(field,value);});editor.append(form);input.focus();return;

      }

      const picker=make('div');editor.append(picker);

      window.LCNCatalogRelations.combo(picker,{label:field==='unterkategorie'?'Unterkategorie für '+state.category:label+' suchen oder eingeben',items:()=>options.options.map((name,id)=>({id:id+1,name})),missingLabel:field==='treatmentname'?'＋ Korrigierten Namen hinzufügen':'＋ Neue '+label+' hinzufügen',retainSelection:true,onSelect:async item=>{await save(field,item.name);return true;},onMissing:async value=>{if(value.trim().length<2){status.textContent='Bitte mindestens zwei Zeichen eingeben.';return;}await save(field,value.trim());}});

     }catch(error){status.textContent=error.message;editor.replaceChildren();}});

     section.append(heading,existing,edit,editor,list);grid.append(section);

    }content.append(grid);

   }catch(error){status.textContent=error.message;}

  }

  render();

 }

 paint();request('overview').then(result=>{data=result;busy=false;paint();}).catch(error=>{notify(error.message,true);});

});

