/* Contextual relationship proposals: choose one entry, keep the choice visible, then submit. */
(()=>{document.addEventListener('DOMContentLoaded',()=>{
 const page=document.querySelector('.ux-detail[data-treatment-id]');if(!page)return;
 const pageId=Number(page.dataset.treatmentId),api=window.LCNCatalogRelations,status=document.querySelector('[data-treatment-relation-status]');if(!api)return;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};let catalog;
 function renderPendingCombination(item){
  const tree=make('div'),drawing=make('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),parent=make('article'),parts=make('div');
  tree.className='ux-combination-tree';tree.dataset.combinationTree='proposal-'+item.submission_id;tree.dataset.pendingCombination=item.submission_id;
  drawing.className='ux-combination-drawing';drawing.style.setProperty('--combination-columns',item.combination.component_ids.length);svg.classList.add('ux-combination-lines');svg.setAttribute('aria-hidden','true');
  parent.className='ux-combination-parent';parent.dataset.combinationParent='';parent.append(make('strong',item.combination.name),make('small','Kombination aus '+item.combination.component_ids.length+' verknüpften Einträgen'),make('small','Vorschlag · Prüfung ausstehend'));
  const feedback=make('div'),host=make('span');feedback.className='ux-combination-assertion';host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.feedbackStatement='Vorgeschlagene Kombination „'+item.combination.name+'“ mit den angezeigten Bestandteilen.';feedback.append(make('small','Diese Kombination mit ihren Bestandteilen prüfen'),host);parent.append(feedback);
  const label=make('p','Bestandteile');label.className='ux-combination-parts-label';parts.className='ux-combination-parts';
  for(const id of item.combination.component_ids){const entry=catalog.items.find(n=>n.id===id);if(!entry)continue;const part=make('article');part.className='ux-combination-part ux-relation-entry';part.dataset.combinationPart='';part.dataset.componentId=id;
   if(id===pageId){part.classList.add('is-current');const badge=make('small','Du bist hier');badge.className='ux-combination-current';part.append(badge,make('strong',entry.name));}else{const link=make('a',entry.name);link.href='therapie_detail.php?treatment_id='+id+'#alternativen';part.append(link);}parts.append(part);
  }
  drawing.append(svg,parent,label,parts);tree.append(drawing);return tree;
 }
 async function load(){
  catalog=await api.request('api/treatment_relationship_proposals.php?id='+pageId);status.textContent='';
  const section=document.querySelector('[data-treatment-relation-pending]'),body=section.querySelector('tbody'),combinations=document.querySelector('[data-combination-section]');body.replaceChildren();
  combinations?.querySelectorAll('[data-pending-combination]').forEach(n=>n.remove());let remaining=0;
  for(const item of catalog.pending){
   if(item.kind==='new_combination'&&item.combination&&combinations){combinations.insertBefore(renderPendingCombination(item),combinations.querySelector('.ux-combination-actions'));continue;}
   const row=make('tr'),name=make('td',item.description),state=make('td','Prüfung ausstehend'),votes=make('td'),host=make('span');host.dataset.treatmentRelationFeedback='s:'+item.submission_id;votes.append(host);row.append(name,state,votes);body.append(row);remaining++;
  }
  const empty=combinations?.querySelector('.ux-combination-empty');if(empty)empty.hidden=!!combinations.querySelector('[data-pending-combination]');
  section.hidden=!remaining;document.dispatchEvent(new CustomEvent('lcn-combination-diagrams-changed'));return catalog;
 }
 load().catch(e=>{status.textContent=e.message;});
 document.addEventListener('lcn-treatment-relations-changed',()=>load().catch(e=>{status.textContent=e.message;}));
 document.querySelectorAll('[data-treatment-relation-add]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
   const data=catalog||await load(),source=Number(button.dataset.sourceId)||pageId,sourceName=data.items.find(n=>n.id===source)?.name||'';
   const existing=new Set([...(button.closest('.ux-stage-block,.ux-stage-column')||button.closest('.card')).querySelectorAll('a[href*="treatment_id="]')].map(a=>Number(new URL(a.href).searchParams.get('treatment_id'))));
   const dialog=make('dialog'),form=make('form'),heading=make('h3'),context=make('p',button.dataset.prompt||sourceName),kindLabel=make('label','Zusammenhang'),kind=make('select'),groupField=make('div'),targetField=make('div'),selection=make('p'),extras=make('details'),extraTitle=make('summary','Quelle oder Hinweis ergänzen (optional)'),urlLabel=make('label','Quelle (optional)'),url=make('input'),noteLabel=make('label','Begründung (optional)'),note=make('textarea'),hint=make('p','Dein Vorschlag erscheint zunächst mit „Prüfung ausstehend“.'),message=make('p'),actions=make('div'),send=make('button','Vorschlagen'),cancel=make('button','Abbrechen');
   dialog.className='catalog-report-dialog treatment-relation-dialog';kind.name='kind';kind.setAttribute('aria-label','Zusammenhang');
   for(const [value,label] of Object.entries(data.kinds)){const option=make('option',label);option.value=value;kind.append(option);}kind.value=button.dataset.kind||'alternative';kindLabel.append(kind);
   url.type='url';url.maxLength=1000;url.placeholder='https://…';note.maxLength=2000;urlLabel.append(url);noteLabel.append(note);extras.className='treatment-relation-extras';extras.append(extraTitle,urlLabel,noteLabel);send.type='submit';cancel.type='button';cancel.addEventListener('click',()=>dialog.close());message.setAttribute('role','status');selection.className='treatment-relation-preview';selection.setAttribute('aria-live','polite');actions.className='catalog-preview-actions';actions.append(send,cancel);
   form.append(heading,context);if(button.dataset.chooseKind==='1')form.append(kindLabel);
   form.append(groupField,targetField,selection,extras,hint,message,actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
   let target=null,group=null;
   const titles={alternative:'Alternative Therapie vorschlagen',group_contains:'Eintrag zur Gruppe hinzufügen',belongs_to_group:'Gruppe zuordnen',has_trade:'Handelsname ergänzen',trade_of:'Wirkstoff zuordnen',has_form:'Anwendungsform ergänzen',form_of:'Anwendungsform zuordnen',has_component:'Bestandteil ergänzen',component_of:'Kombination ergänzen',has_variant:'Stoffvariante ergänzen',variant_of:'Übergeordnete Substanz zuordnen',has_detail:'Detaillierteres Verfahren ergänzen',detail_of:'Übergeordnetes Verfahren zuordnen'};
   const targetLabels={alternative:'Alternative Therapie auswählen',group_contains:'Eintrag auswählen',has_trade:'Handelsname auswählen',trade_of:'Wirkstoff auswählen',has_form:'Anwendungsform auswählen',form_of:'Übergeordneten Eintrag auswählen',has_component:'Bestandteil auswählen',component_of:'Kombination auswählen',has_variant:'Stoffvariante auswählen',variant_of:'Übergeordnete Substanz auswählen',has_detail:'Detaillierteres Verfahren auswählen',detail_of:'Übergeordnetes Verfahren auswählen'};
   function preview(){
    const grouped=['belongs_to_group','group_contains'].includes(kind.value),ready=(kind.value==='belongs_to_group'||target)&&(!grouped||group);
    send.disabled=!ready;selection.hidden=!ready;if(!ready){selection.textContent='';return;}
    const t=target?.name||'',g=group?.name||'';
    selection.textContent={alternative:t+' als alternative Therapie zu '+sourceName,belongs_to_group:sourceName+' gehört zur Gruppe „'+g+'“',group_contains:t+' gehört zur Gruppe „'+g+'“',trade_of:sourceName+' ist Handelsname von '+t,has_trade:t+' ist Handelsname von '+sourceName,form_of:sourceName+' ist Anwendungsform von '+t,has_form:t+' ist Anwendungsform von '+sourceName,component_of:sourceName+' ist Bestandteil der Kombination '+t,has_component:t+' ist Bestandteil der Kombination '+sourceName,has_variant:t+' ist Stoffvariante von '+sourceName,variant_of:sourceName+' ist Stoffvariante von '+t,has_detail:t+' ist detaillierteres Verfahren von '+sourceName,detail_of:sourceName+' ist detaillierteres Verfahren von '+t}[kind.value];
   }
   function fields(){
    target=null;group=null;message.textContent='';groupField.replaceChildren();targetField.replaceChildren();heading.textContent=button.dataset.dialogTitle||titles[kind.value];const grouped=['belongs_to_group','group_contains'].includes(kind.value);groupField.hidden=!grouped;targetField.hidden=kind.value==='belongs_to_group';
    if(grouped){
     group=data.groups.find(n=>n.id===Number(button.dataset.groupId))||null;
     if(group&&button.dataset.chooseKind!=='1')groupField.append(make('p','Gruppe: '+group.name));
     else api.combo(groupField,{label:'Gruppe auswählen',retainSelection:true,missingLabel:'＋ Neue Gruppe vorschlagen',items:()=>data.groups,onInput:()=>{group=null;preview();},onSelect:item=>{group=data.groups.find(n=>n.id===item.id)||item;preview();},onMissing:name=>{if(name.trim().length<2){message.textContent='Bitte einen Gruppennamen eingeben.';return;}group={id:0,name:name.trim()};preview();}});
    }
    if(!targetField.hidden)api.combo(targetField,{label:button.dataset.targetLabel||targetLabels[kind.value],retainSelection:true,items:()=>data.items.filter(n=>n.id!==source&&n.id!==pageId&&!existing.has(n.id)&&(kind.value!=='component_of'||n.is_combination)&&(!['trade_of','has_trade'].includes(kind.value)||n.meta==='Arzneimittel')),onInput:()=>{target=null;preview();},onSelect:item=>{target=data.items.find(n=>n.id===item.id)||item;preview();},onMissing:name=>api.entryDialog('treatment',name,{},()=>{catalog=null;message.textContent='Die neue Therapie wurde zur Prüfung vorgeschlagen. Nach Freigabe kannst du sie hier verknüpfen.';})});
    preview();
   }
   kind.addEventListener('change',fields);fields();
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(send.disabled)return;message.textContent='';send.disabled=true;
    try{await api.request('api/treatment_relationship_proposals.php',{source_id:source,context_id:pageId,kind:kind.value,target_id:target?.id||0,group_alias_id:group?.id||0,group_name:group?.name||'',note:note.value,source_url:url.value});await load();form.replaceChildren(make('h3','Verknüpfung vorgeschlagen'),make('p','Dein Vorschlag ist gespeichert und erscheint mit „Prüfung ausstehend“.'),cancel);cancel.textContent='Schließen';}
    catch(e){message.textContent=e.message;preview();}
   });
   dialog.showModal();
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 }));
});})();

// Render links behind the cards; current-page identity never changes with branch selection.
(()=>{document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-relationship-stages]').forEach(section=>{
  const canvas=section.querySelector('.ux-stage-canvas'),columns=section.querySelector('.ux-stage-columns'),svg=section.querySelector('.ux-stage-lines'),edges=JSON.parse(section.querySelector('[data-stage-edges]').textContent);let frame;
  const node=(level,id)=>section.querySelector('[data-stage="'+level+'"] [data-stage-node="'+id+'"]');
  function draw(){
   frame=0;if(!canvas.getBoundingClientRect().width||!canvas.getBoundingClientRect().height)return;
   const rect=columns.getBoundingClientRect(),width=columns.scrollWidth,height=columns.offsetHeight;svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.style.width=width+'px';svg.style.height=height+'px';
   const paths=[];
   function line(a,b,added,right){if(!a||!b||!a.getClientRects().length||!b.getClientRects().length)return;const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();let ax=ra.right-rect.left,ay=ra.top+ra.height/2-rect.top,bx=rb.left-rect.left,by=rb.top+rb.height/2-rect.top;if(ra.left>rb.left){ax=ra.left-rect.left;bx=rb.right-rect.left;}const curve=Math.max(14,Math.abs(bx-ax)*.45),dir=bx>ax?1:-1;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M${ax},${ay} C${ax+curve*dir},${ay} ${bx-curve*dir},${by} ${bx},${by}`);path.setAttribute('class',(added?'is-add ':'')+(right?'is-right':''));paths.push(path);}
   for(const [from,a,to,b] of edges)line(node(from,a),node(to,b),false,to===2);
   section.querySelectorAll('.ux-stage-add').forEach(button=>{const level=Number(button.closest('[data-stage]').dataset.stage),id=Number(button.dataset.sourceId);if(level===0)line(button,node(1,id),true,false);else if(level===2)line(node(1,id)||node(0,id),button,true,true);else if(level===1)line(node(0,id),button,true,false);});
   svg.replaceChildren(...paths);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  schedule();
  new ResizeObserver(schedule).observe(columns);new MutationObserver(schedule).observe(columns,{childList:true,subtree:true});window.addEventListener('hashchange',schedule);window.addEventListener('resize',schedule);
 });
});})();
