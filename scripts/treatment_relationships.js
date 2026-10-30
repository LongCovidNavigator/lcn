/* Contextual relationship proposals: choose one entry, keep the choice visible, then submit. */
(()=>{document.addEventListener('DOMContentLoaded',()=>{
 const page=document.querySelector('.ux-detail[data-treatment-id]');if(!page)return;
 const pageId=Number(page.dataset.treatmentId),api=window.LCNCatalogRelations,status=document.querySelector('[data-treatment-relation-status]');if(!api)return;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};let catalog;
 function renderPendingCombination(item){
  const tree=make('div'),drawing=make('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),parent=make('article'),parts=make('div');
  tree.className='ux-combination-tree';tree.dataset.combinationTree='proposal-'+item.submission_id;tree.dataset.pendingCombination=item.submission_id;
  drawing.className='ux-combination-drawing';drawing.style.setProperty('--combination-columns',item.combination.component_ids.length);svg.classList.add('ux-combination-lines');svg.setAttribute('aria-hidden','true');
  parent.className='ux-combination-parent';parent.dataset.combinationParent='';parent.append(make('strong',item.combination.name),make('small','Vorschlag · Prüfung ausstehend'));
  const feedback=make('div'),host=make('span');feedback.className='ux-combination-assertion';host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.feedbackStatement=item.description||'Vorgeschlagene Kombination „'+item.combination.name+'“ mit den angezeigten Bestandteilen.';feedback.append(host);host.dataset.treatmentRelationFeedback=item.combination.id?'combo:'+item.combination.id:'s:'+item.submission_id;host.dataset.feedbackStatement='„'+item.combination.name+'“ bildet eine eigenständige Therapie, die einen zusätzlichen oder anderen Effekt erzielt.';parent.append(feedback);
  const label=make('p','Bestandteile');label.className='ux-combination-parts-label';parts.className='ux-combination-parts';
  for(const id of item.combination.component_ids){const entry=catalog.items.find(n=>n.id===id);if(!entry)continue;const part=make('article');part.className='ux-combination-part ux-relation-entry';part.dataset.combinationPart='';part.dataset.componentId=id;
   if(id===pageId){part.classList.add('is-current');const badge=make('small','Du bist hier');badge.className='ux-combination-current';part.append(badge,make('strong',entry.name));}else{const link=make('a',entry.name);link.href='therapie_detail.php?treatment_id='+id+'#alternativen';part.append(link);}{const feedback=make('div'),host=make('span');feedback.className='ux-combination-assertion';host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.treatmentRelationFeedback=item.combination.id?((item.combination.accepted_ids||[]).includes(id)?'cp:'+item.combination.id+':'+id:'s:'+(catalog.pending.find(n=>n.kind==='component'&&Number(n.right_id)===item.combination.id&&Number(n.left_id)===id)?.submission_id||item.submission_id)):'pc:'+item.submission_id+':'+id;host.dataset.feedbackStatement='„'+entry.name+'“ ist Bestandteil von „'+item.combination.name+'“.';feedback.append(host);part.append(feedback);}parts.append(part);
  }
  drawing.append(svg,parent,label,parts);tree.append(drawing);return tree;
 }
 function renderPendingAlternative(item,options){
  const other=Number(item.left_id)===pageId?Number(item.right_id):Number(item.left_id),entry=catalog.items.find(n=>n.id===other);if(!entry)return false;
  if([...options.querySelectorAll('a[href*="treatment_id="]')].some(a=>Number(new URL(a.href).searchParams.get('treatment_id'))===other))return true;
  const tile=make('article'),link=make('a',entry.name),feedback=make('div'),host=make('span');
  tile.className='ux-alternative-tile ux-feedback-relation';tile.dataset.pendingAlternative=item.submission_id;
  tile.append(make('small','Alternative Therapie · Prüfung ausstehend'));
  link.className='ux-alternative-name';link.href='therapie_detail.php?treatment_id='+other+'#alternativen';tile.append(link);
  if(entry.meta){const category=make('span',entry.meta);category.className='ux-alternative-category';tile.append(category);}
  feedback.className='ux-alternative-feedback';host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.feedbackStatement=item.description+' (Vorschlag · Prüfung ausstehend)';feedback.append(host);tile.append(feedback);
  options.insertBefore(tile,options.querySelector('.ux-alternative-add'));return true;
 }
 function renderPendingGroups(){
  const section=document.querySelector('[data-relationship-stages]'),left=section?.querySelector('[data-stage="0"] .ux-stage-stack'),middle=section?.querySelector('[data-stage="1"] .ux-stage-stack');if(!left||!middle)return;
  const memberships=catalog.pending.filter(n=>n.kind==='group'),names=new Set(memberships.filter(n=>Number(n.left_id)===pageId||Number(n.group_root_id)===pageId).map(n=>n.group_name));
  for(const name of names){
   const own=memberships.find(n=>(Number(n.left_id)===pageId||Number(n.group_root_id)===pageId)&&n.group_name===name),key='group-'+own.submission_id,rootPage=Number(own.group_root_id)===pageId;
   const tile=make('article'),host=make('span');tile.className='ux-stage-node ux-relation-entry is-linked';tile.dataset.pendingRelationship=own.submission_id;tile.dataset.pendingGroup=key;
   const title=make(own.group_root_id&&!rootPage?'a':'strong',name);if(title.tagName==='A')title.href='therapie_detail.php?treatment_id='+own.group_root_id+'#alternativen';title.className='ux-stage-name';tile.append(title,make('small','Prüfung ausstehend'));host.dataset.treatmentRelationFeedback='s:'+own.submission_id;host.dataset.feedbackStatement=own.description;host.dataset.feedbackStandard='1';tile.append(host);const rootNode=rootPage?left.querySelector('[data-stage-node="'+pageId+'"]'):null;if(rootNode){rootNode.dataset.pendingGroup=key;}else left.insertBefore(tile,left.querySelector('[data-treatment-relation-add]'));
   const current=rootPage?null:middle.querySelector('[data-stage-node="'+pageId+'"]');if(current)current.dataset.pendingGroupMember=[current.dataset.pendingGroupMember,key].filter(Boolean).join(' ');
   for(const item of memberships.filter(n=>n.group_name===name&&Number(n.left_id)!==pageId)){
    const entry=catalog.items.find(n=>n.id===Number(item.left_id));if(!entry)continue;
    const node=make('article'),link=make('a',entry.name),feedback=make('span');node.className='ux-stage-node ux-relation-entry is-linked';node.dataset.pendingRelationship=item.submission_id;node.dataset.pendingGroupMember=key;link.className='ux-stage-name';link.href='therapie_detail.php?treatment_id='+entry.id+'#alternativen';feedback.dataset.treatmentRelationFeedback='s:'+item.submission_id;feedback.dataset.feedbackStatement=item.description;feedback.dataset.feedbackStandard='1';node.append(link,make('small','Prüfung ausstehend'),feedback);middle.append(node);
   }
   if(rootPage)middle.querySelectorAll('[data-kind="group_contains"]').forEach(n=>n.remove());
   if(!rootPage)continue;
   const add=make('button','＋ Weiteren Eintrag zu „'+name+'“ hinzufügen');add.type='button';add.className='ux-stage-add';add.dataset.pendingRelationship='add-'+own.submission_id;add.dataset.treatmentRelationAdd='';add.dataset.kind='group_contains';add.dataset.sourceId=pageId;add.dataset.groupId=own.group_alias_id||0;add.dataset.groupName=name;middle.append(add);
  }
 }
 async function load(){
  catalog=await api.request('api/treatment_relationship_proposals.php?id='+pageId);status.textContent='';
  const combinations=document.querySelector('[data-combination-section]');
  document.querySelectorAll('[data-pending-relationship]').forEach(n=>n.remove());
  document.querySelectorAll('[data-pending-group-member]').forEach(n=>delete n.dataset.pendingGroupMember);
  renderPendingGroups();
  const alternatives=document.querySelector('.ux-alternative-options');alternatives?.querySelectorAll('[data-pending-alternative]').forEach(n=>n.remove());
  combinations?.querySelectorAll('[data-pending-combination]').forEach(n=>(n.closest('.ux-combination-group')||n).remove());let remaining=0;
  for(const item of catalog.pending){
   if(item.kind==='group'&&document.querySelector('[data-pending-relationship="'+item.submission_id+'"]'))continue;
   if(item.kind==='alternative'&&alternatives&&[Number(item.left_id),Number(item.right_id)].includes(pageId)&&renderPendingAlternative(item,alternatives))continue;
   if(item.kind==='new_combination'&&item.combination&&combinations){combinations.insertBefore(renderPendingCombination(item),combinations.querySelector('.ux-combination-actions'));continue;}
   if(item.kind==='component'&&Number(item.left_id)===pageId&&combinations){
    const entry=catalog.items.find(n=>n.id===Number(item.right_id));if(!entry)continue;
    const componentIds=[...new Set([...(entry.component_ids||[]),...catalog.pending.filter(n=>n.kind==='component'&&Number(n.right_id)===entry.id).map(n=>Number(n.left_id)),pageId])];
    if(combinations.querySelector('[data-pending-combination-target="'+entry.id+'"]'))continue;
    const tree=renderPendingCombination({...item,combination:{id:entry.id,accepted_ids:entry.component_ids||[],name:entry.name,component_ids:componentIds}});tree.dataset.pendingCombinationTarget=entry.id;
    const parent=tree.querySelector('[data-combination-parent]'),title=parent.querySelector('strong'),link=make('a',entry.name);
    link.href='therapie_detail.php?treatment_id='+entry.id+'#alternativen';title.replaceWith(link);
    tree.querySelector('.ux-combination-parts-label').textContent='Bestandteile';
    combinations.insertBefore(tree,combinations.querySelector('.ux-combination-actions'));continue;
   }
   const kind={brand:'has_trade',form:'has_form',variant:'has_variant',detail:'has_detail',group:Number(item.left_id)===pageId?'belongs_to_group':'group_contains',component:Number(item.left_id)===pageId?'component_of':'has_component'}[item.kind];
   const buttons=[...document.querySelectorAll('[data-treatment-relation-add]')],button=buttons.find(n=>n.dataset.kind===kind&&Number(n.dataset.sourceId||pageId)===Number(item.right_id))||buttons.find(n=>n.dataset.kind===kind);
   const container=button?.parentElement||document.querySelector('[data-stage="0"] .ux-stage-stack');if(!container)continue;
   const tile=make('article'),host=make('span'),other=Number(item.left_id)===pageId?Number(item.right_id):Number(item.left_id),entry=catalog.items.find(n=>n.id===other);
   tile.className='ux-stage-node ux-relation-entry is-linked';tile.dataset.pendingRelationship=item.submission_id;
   if(entry){const link=make('a',entry.name);link.className='ux-stage-name';link.href='therapie_detail.php?treatment_id='+other+'#alternativen';tile.append(link);}
   tile.append(make('small','Prüfung ausstehend'),make('p',item.description));host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.feedbackStatement=item.description;tile.append(host);
   if(container.classList.contains('ux-combination-parts')){
    tile.className='ux-combination-part ux-relation-entry';tile.dataset.combinationPart='';tile.dataset.componentId=other;
    const description=tile.querySelector('p');if(description)description.remove();
    const feedback=make('div');feedback.className='ux-combination-assertion';feedback.append(host);tile.append(feedback);
   }
   container.insertBefore(tile,button||null);container.querySelectorAll('.ux-stage-empty').forEach(n=>n.hidden=true);const block=container.closest('.ux-stage-block');if(block)block.hidden=false;
  }
  const alternativeEmpty=document.querySelector('.ux-alternative-empty');if(alternativeEmpty)alternativeEmpty.hidden=!!alternatives?.querySelector('.ux-feedback-relation');
  const empty=combinations?.querySelector('.ux-combination-empty');if(empty)empty.hidden=!!combinations.querySelector('[data-pending-combination]');
  document.dispatchEvent(new CustomEvent('lcn-combination-diagrams-changed'));return catalog;
 }
 load().catch(e=>{status.textContent=e.message;});
 document.addEventListener('lcn-treatment-relations-changed',()=>load().catch(e=>{status.textContent=e.message;}));
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-treatment-relation-add]');if(!button)return;
  const existingContainer=button.closest('.ux-stage-block,.ux-stage-column')||button.closest('.card');
  button.disabled=true;
  try{
   const data=await load(),sourceOptions=JSON.parse(button.dataset.sourceOptions||'[]');let source=sourceOptions.length?0:(Number(button.dataset.sourceId)||pageId);const sourceName=data.items.find(n=>n.id===source)?.name||'';
   const existing=new Set([...existingContainer.querySelectorAll('a[href*="treatment_id="]')].map(a=>Number(new URL(a.href).searchParams.get('treatment_id'))));
   const dialog=make('dialog'),form=make('form'),heading=make('h3'),context=make('p',button.dataset.prompt||sourceName),kindLabel=make('label','Zusammenhang'),kind=make('select'),groupField=make('div'),targetField=make('div'),selection=make('p'),extras=make('details'),extraTitle=make('summary','Quelle oder Hinweis ergänzen (optional)'),urlLabel=make('label','Quelle (optional)'),url=make('input'),noteLabel=make('label','Begründung (optional)'),note=make('textarea'),hint=make('p','Dein Vorschlag erscheint zunächst mit „Prüfung ausstehend“.'),message=make('p'),actions=make('div'),send=make('button','Vorschlagen'),cancel=make('button','Abbrechen');
   dialog.className='catalog-report-dialog treatment-relation-dialog';kind.name='kind';kind.setAttribute('aria-label','Zusammenhang');
   for(const [value,label] of Object.entries(data.kinds)){const option=make('option',label);option.value=value;kind.append(option);}kind.value=button.dataset.kind||'alternative';kindLabel.append(kind);
   url.type='url';url.maxLength=1000;url.placeholder='https://…';note.maxLength=2000;urlLabel.append(url);noteLabel.append(note);extras.className='treatment-relation-extras';extras.append(extraTitle,urlLabel,noteLabel);send.type='submit';cancel.type='button';cancel.addEventListener('click',()=>dialog.close());message.setAttribute('role','status');selection.className='treatment-relation-preview';selection.setAttribute('aria-live','polite');actions.className='catalog-preview-actions';actions.append(send,cancel);
   form.append(heading,context);
   if(sourceOptions.length){const label=make('label','Übergeordnete Therapie / Verfahren auswählen'),select=make('select'),placeholder=make('option','Bitte auswählen …');placeholder.value='';select.append(placeholder);select.setAttribute('aria-label','Übergeordnete Therapie / Verfahren auswählen');for(const item of sourceOptions){const option=make('option',item.name);option.value=item.id;select.append(option);}label.append(select);form.append(label);select.addEventListener('change',()=>{source=Number(select.value);context.textContent=sourceOptions.find(n=>n.id===source)?.name||'';fields();});}
   if(button.dataset.chooseKind==='1')form.append(kindLabel);
   form.append(groupField,targetField,selection,extras,hint,message,actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
   let target=null,group=null,targets=[],groups=[],saving=false;let targetCombo,groupCombo;
   hint.textContent='Du kannst mehrere Einträge auswählen und danach weitersuchen. Alle Vorschläge erscheinen mit „Prüfung ausstehend“.';
   const titles={alternative:'Alternative Therapie vorschlagen',group_contains:'Eintrag zur Gruppe hinzufügen',belongs_to_group:'Gruppe zuordnen',has_trade:'Handelsname ergänzen',trade_of:'Wirkstoff zuordnen',has_form:'Anwendungsform ergänzen',form_of:'Anwendungsform zuordnen',has_component:'Bestandteil ergänzen',component_of:'Kombination ergänzen',has_variant:'Stoffvariante ergänzen',variant_of:'Übergeordnete Substanz zuordnen',has_detail:'Detaillierteres Verfahren ergänzen',detail_of:'Übergeordnetes Verfahren zuordnen'};
   const targetLabels={alternative:'Alternative Therapie auswählen',group_contains:'Eintrag auswählen',has_trade:'Handelsname auswählen',trade_of:'Wirkstoff auswählen',has_form:'Anwendungsform auswählen',form_of:'Übergeordneten Eintrag auswählen',has_component:'Bestandteil auswählen',component_of:'Kombination auswählen',has_variant:'Stoffvariante auswählen',variant_of:'Übergeordnete Substanz auswählen',has_detail:'Detaillierteres Verfahren auswählen',detail_of:'Übergeordnetes Verfahren auswählen'};
   function preview(){
    const grouped=['belongs_to_group','group_contains'].includes(kind.value),entries=kind.value==='belongs_to_group'?groups:targets;
    send.disabled=saving||!source||!entries.length||(grouped&&kind.value!=='belongs_to_group'&&!group);
    send.textContent=entries.length>1?entries.length+' Einträge vorschlagen':'Vorschlagen';
    selection.replaceChildren();selection.hidden=!entries.length;
    for(const entry of entries){const row=make('span'),remove=make('button','×');row.className='treatment-relation-selection';row.append(make('span',entry.name));remove.type='button';remove.disabled=saving;remove.setAttribute('aria-label',entry.name+' entfernen');remove.addEventListener('click',()=>{if(kind.value==='belongs_to_group')groups=groups.filter(n=>n!==entry);else targets=targets.filter(n=>n!==entry);preview();targetCombo?.refresh();groupCombo?.refresh();});row.append(remove);selection.append(row);}
   }
   function fields(){
    target=null;group=null;targets=[];groups=[];targetCombo=null;groupCombo=null;message.textContent='';groupField.replaceChildren();targetField.replaceChildren();heading.textContent=button.dataset.dialogTitle||titles[kind.value];const grouped=['belongs_to_group','group_contains'].includes(kind.value);groupField.hidden=!grouped;targetField.hidden=kind.value==='belongs_to_group';
    if(grouped){
     group=data.groups.find(n=>n.id===Number(button.dataset.groupId))||(button.dataset.groupName?{id:0,name:button.dataset.groupName}:null);
     if(group&&button.dataset.chooseKind!=='1')groupField.append(make('p','Gruppe: '+group.name));
     else groupCombo=api.combo(groupField,{label:'Gruppe auswählen',retainSelection:kind.value!=='belongs_to_group',keepOpenOnSelect:kind.value==='belongs_to_group',missingLabel:'＋ Neue Gruppe vorschlagen',items:()=>data.groups.filter(n=>!groups.some(g=>g.id===n.id)),onInput:()=>{if(kind.value!=='belongs_to_group')group=null;preview();},onSelect:item=>{group=data.groups.find(n=>n.id===item.id)||item;if(kind.value==='belongs_to_group')groups.push(group);preview();},onMissing:name=>{if(name.trim().length<2){message.textContent='Bitte einen Gruppennamen eingeben.';return;}group={id:0,name:name.trim()};if(kind.value==='belongs_to_group'&&!groups.some(g=>g.name===group.name))groups.push(group);preview();}});
    }
    if(!targetField.hidden)targetCombo=api.combo(targetField,{label:button.dataset.targetLabel||targetLabels[kind.value],keepOpenOnSelect:true,items:()=>data.items.filter(n=>!targets.some(t=>t.id===n.id)&&n.id!==source&&n.id!==pageId&&!(sourceOptions.length?[...document.querySelectorAll('[data-stage="2"] .ux-stage-block')].filter(b=>Number(b.dataset.branch)===source).some(b=>[...b.querySelectorAll('a[href*="treatment_id="]')].some(a=>Number(new URL(a.href).searchParams.get('treatment_id'))===n.id)):existing.has(n.id))&&(kind.value!=='component_of'||n.is_combination)&&(!['trade_of','has_trade'].includes(kind.value)||n.meta.split(' · ')[0]==='Arzneimittel')),onInput:()=>{},onSelect:item=>{target=data.items.find(n=>n.id===item.id)||item;targets.push(target);preview();},onMissing:name=>api.entryDialog('treatment',name,{},async()=>{Object.assign(data,await load());message.textContent='Die neue Therapie ist jetzt auswählbar. Prüfung ausstehend.';targetCombo?.refresh();})});
    preview();
   }
   kind.addEventListener('change',fields);fields();
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(send.disabled)return;message.textContent='';saving=true;form.inert=true;preview();
    const entries=[...(kind.value==='belongs_to_group'?groups:targets)];let completed=0;
    try{
     for(const entry of entries){await api.request('api/treatment_relationship_proposals.php',{source_id:source,context_id:pageId,kind:kind.value,target_id:kind.value==='belongs_to_group'?0:entry.id,group_alias_id:kind.value==='belongs_to_group'?entry.id:(group?.id||0),group_name:kind.value==='belongs_to_group'?entry.name:(group?.name||''),note:note.value,source_url:url.value});completed++;if(kind.value==='belongs_to_group')groups=groups.filter(n=>n!==entry);else{targets=targets.filter(n=>n!==entry);existing.add(entry.id);}}
     await load();message.textContent=completed===1?'Dein Vorschlag ist gespeichert und erscheint mit „Prüfung ausstehend“.':'Alle '+completed+' Vorschläge sind gespeichert und erscheinen mit „Prüfung ausstehend“. Du kannst weitere Einträge auswählen.';cancel.textContent='Schließen';
    }catch(e){message.textContent=(completed?completed+' Vorschläge gespeichert. ':'')+e.message;await load().catch(()=>{});}
    finally{saving=false;form.inert=false;preview();targetCombo?.refresh();groupCombo?.refresh();}

   });
   const refreshCatalog=async()=>{if(!dialog.open||saving)return;try{Object.assign(data,await load());targetCombo?.refresh();groupCombo?.refresh();}catch(e){message.textContent=e.message;}};window.addEventListener('focus',refreshCatalog);dialog.addEventListener('close',()=>window.removeEventListener('focus',refreshCatalog));
   dialog.showModal();
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 });
});})();

// Render links behind the cards; current-page identity never changes with branch selection.
(()=>{document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-relationship-stages]').forEach(section=>{
  const canvas=section.querySelector('.ux-stage-canvas'),columns=section.querySelector('.ux-stage-columns'),svg=section.querySelector('.ux-stage-lines'),edges=JSON.parse(section.querySelector('[data-stage-edges]').textContent);let frame;
  const node=(level,id)=>section.querySelector('[data-stage="'+level+'"] [data-stage-node="'+id+'"]');
  let votes={};
  function summarizeBranches(){
   const multiple=section.querySelectorAll('[data-stage="1"] [data-stage-node]').length>1;
   section.querySelectorAll('[data-stage="2"] .ux-stage-block[data-branch]').forEach(block=>{
    const cards=[...block.querySelectorAll('[data-stage-node]')];
    cards.forEach(card=>card.hidden=false);block.querySelector('.ux-stage-more')?.remove();block.classList.remove('has-more');
    if(!multiple||cards.length<2)return;
    const score=card=>[...card.querySelectorAll('[data-treatment-relation-feedback]')].reduce((sum,host)=>sum+Number(votes[host.dataset.treatmentRelationFeedback]?.confirm||0),0);
    const best=[...cards].sort((a,b)=>score(b)-score(a)||Number(a.dataset.stageNode)-Number(b.dataset.stageNode))[0];
    cards.forEach(card=>card.hidden=card!==best);
    const more=document.createElement('a');more.className='ux-stage-more';more.href='therapie_detail.php?treatment_id='+block.dataset.branch+'#alternativen';more.textContent='＋ '+(cards.length-1)+' weitere anzeigen';more.setAttribute('aria-label',more.textContent+' auf der zugehörigen Therapieseite');block.append(more);block.classList.add('has-more');
   });
  }
  window.addEventListener('lcn-relation-feedback',event=>{votes=event.detail||{};summarizeBranches();schedule();});
  summarizeBranches();

  function draw(){
   frame=0;if(!canvas.getBoundingClientRect().width||!canvas.getBoundingClientRect().height)return;
   const fixedHeader=document.querySelector('#header-placeholder .profile,.treatment-detail-sticky-header');
   const availableHeight=Math.max(0,innerHeight-(fixedHeader?.getBoundingClientRect().height||0)-32);
   const compact=columns.offsetHeight<=availableHeight*.75;
   // Compact diagrams stay centered; long lists follow the viewport.
   const left=columns.querySelector('[data-stage="0"]'),stack=left.querySelector('.ux-stage-stack');
   stack.style.transform='';
   const middleStack=columns.querySelector('[data-stage="1"] .ux-stage-stack');
   middleStack.style.transform='';
   const middleNodes=middleStack.querySelectorAll('.ux-stage-node');
   // The middle column is centered by shared CSS and stays independent of scrolling.
   const right=columns.querySelector('[data-stage="2"]');
   const blocks=[...right.querySelectorAll('.ux-stage-block')];
   blocks.forEach(block=>{block.style.transform='';block.style.marginTop='';block.querySelectorAll('.ux-stage-add').forEach(button=>button.style.transform='');});
   // Different relationship types for one substance form one ordered stack.
   // Moving its blocks independently would let headings and add actions overlap.
   const stackedRelationships=middleNodes.length===1&&blocks.filter(block=>block.getClientRects().length).length>1;
   // Snap a nearly aligned current substance to a saved child row for a straight connector.
   // This shared tolerance uses diagram geometry only, so scrolling cannot move the card.
   const rowAlignmentTolerance=32;
   if(innerWidth>650&&middleNodes.length===1&&middleNodes[0].classList.contains('is-current')){
    const current=middleNodes[0],box=current.getBoundingClientRect(),center=box.top+box.height/2;
    const offsets=edges.filter(([from,id,to])=>from===1&&String(id)===current.dataset.stageNode&&to===2)
     .map(([, ,to,id])=>node(to,id)).filter(child=>child?.getClientRects().length)
     .map(child=>{const rect=child.getBoundingClientRect();return rect.top+rect.height/2-center;})
     .sort((a,b)=>Math.abs(a)-Math.abs(b));
    const tradeBlock=blocks.find(block=>block.getClientRects().length&&block.dataset.relationshipKind==='has_trade');
    if(tradeBlock){
     // Use the middle row(s) of the full brand list, including its add row.
     const rows=[...tradeBlock.querySelectorAll('.ux-stage-node:not([hidden]),.ux-stage-add')];
     if(rows.length){
      const rowCenter=row=>{const r=row.getBoundingClientRect();return r.top+r.height/2;};
      const target=(rowCenter(rows[Math.floor((rows.length-1)/2)])+rowCenter(rows[Math.floor(rows.length/2)]))/2;
      middleStack.style.transform=`translateY(${target-center}px)`;
     }
    }else if(stackedRelationships&&!offsets.length){
     // With empty relationship blocks, center on the full connector span,
     // not on column height (which also includes the subsection headings).
     const centers=blocks.filter(block=>block.getClientRects().length)
      .flatMap(block=>[...block.querySelectorAll('.ux-stage-add')])
      .filter(button=>String(button.dataset.sourceId)===current.dataset.stageNode)
      .map(button=>{const r=button.getBoundingClientRect();return r.top+r.height/2;});
     if(centers.length)middleStack.style.transform=`translateY(${(Math.min(...centers)+Math.max(...centers))/2-center}px)`;
    }else if(offsets.length&&Math.abs(offsets[0])<=rowAlignmentTolerance)middleStack.style.transform=`translateY(${offsets[0]}px)`;
   }
   if(innerWidth>650&&!stack.querySelector('.ux-stage-node')&&stack.querySelectorAll('.ux-stage-add').length===1){
    const button=stack.querySelector('.ux-stage-add'),parent=node(1,button.dataset.sourceId);
    if(parent){const a=button.getBoundingClientRect(),b=parent.getBoundingClientRect();stack.style.transform=`translateY(${b.top+b.height/2-a.top-a.height/2}px)`;}
   }
   if(innerWidth>650&&stack.querySelector('.is-current')&&stack.querySelectorAll('.ux-stage-node').length===1){
    const box=stack.getBoundingClientRect(),currentNode=stack.querySelector('.is-current');
    const children=edges.filter(([from,id,to])=>from===0&&String(id)===currentNode.dataset.stageNode&&to===1).map(([, ,to,id])=>node(to,id));
    if(currentNode.dataset.pendingGroup)section.querySelectorAll('[data-pending-group-member]').forEach(child=>{if(child.dataset.pendingGroupMember.split(' ').includes(currentNode.dataset.pendingGroup))children.push(child);});
    const centers=children.filter(child=>child?.getClientRects().length).map(child=>{const r=child.getBoundingClientRect();return r.top+r.height/2;});
    const header=document.querySelector('#header-placeholder .profile,.treatment-detail-sticky-header'),headerBox=header?.getBoundingClientRect();
    const top=Math.max(16,headerBox&&headerBox.top<=0?headerBox.bottom+16:16);
    const current=currentNode.getBoundingClientRect();
    const target=top+(innerHeight-16-top)/2;
    if(centers.length&&box.height<innerHeight-top-16){
     const center=compact?(Math.min(...centers)+Math.max(...centers))/2:Math.max(Math.min(...centers),Math.min(target,Math.max(...centers)));
     stack.style.transform=`translateY(${center-current.top-current.height/2}px)`;
    }
   }
   // Saved details keep their place beside their parent; only the add action follows scrolling.
   if(innerWidth>650&&!stackedRelationships){
    if(section.querySelectorAll('[data-stage="1"] [data-stage-node]').length>1&&!right.querySelector('.is-current')){
     blocks.filter(b=>!b.hidden&&b.dataset.branch).forEach(block=>{const parent=node(1,block.dataset.branch);if(parent)parent.style.minHeight=block.getBoundingClientRect().height+'px';});
    }
    for(const block of blocks.filter(b=>b.getClientRects().length&&b.querySelector('.ux-stage-node:not([hidden])'))){
     const parent=node(1,block.dataset.branch);if(!parent)continue;
     const cards=[...block.querySelectorAll('.ux-stage-node:not([hidden])')];
     if(cards.length===1){
      const a=parent.getBoundingClientRect(),b=cards[0].getBoundingClientRect();
      const add=block.querySelector('.ux-stage-add'),addBox=add?.getBoundingClientRect();
      const center=addBox?(b.top+b.height/2+addBox.top+addBox.height/2)/2:b.top+b.height/2;
      const offset=a.top+a.height/2-center;
      if(offset>=0)block.style.marginTop=offset+'px';
      else block.style.transform=`translateY(${offset}px)`;
     }else{
      const gap=parent.getBoundingClientRect().top-block.getBoundingClientRect().top;
      if(gap>0&&!(middleNodes.length===1&&middleNodes[0].classList.contains('is-current')))block.style.marginTop=gap+'px';
     }
    }
    const header=document.querySelector('#header-placeholder .profile,.treatment-detail-sticky-header'),headerBox=header?.getBoundingClientRect();
    const top=Math.max(16,headerBox&&headerBox.top<=0?headerBox.bottom+16:16),target=top+(innerHeight-16-top)/2;
    const middleCenters=[...columns.querySelectorAll('[data-stage="1"] .ux-stage-node')].map(n=>{const r=n.getBoundingClientRect();return r.top+r.height/2;});
    if(middleCenters.length){
     const center=compact?(Math.min(...middleCenters)+Math.max(...middleCenters))/2:Math.max(Math.min(...middleCenters),Math.min(target,Math.max(...middleCenters)));
     const visible=blocks.filter(b=>b.getClientRects().length);
     visible.forEach((block,index)=>{
      const button=block.querySelector('.ux-stage-add');if(!button)return;
      if(block.querySelectorAll('.ux-stage-node:not([hidden])').length===1)return;
      const box=button.getBoundingClientRect(),next=visible[index+1];
      const bottom=Math.min(right.getBoundingClientRect().bottom-16,next?next.getBoundingClientRect().top-12:Infinity);
      const offset=Math.max(0,Math.min(center-box.top-box.height/2,bottom-box.bottom));
      button.style.transform=`translateY(${offset}px)`;
     });
    }
   }
   if(innerWidth>650&&!stackedRelationships)for(const block of blocks){
    const cards=[...block.querySelectorAll('.ux-stage-node:not([hidden])')],add=block.querySelector('.ux-stage-add'),parent=node(1,block.dataset.branch);
    if(block.hidden||cards.length!==1||!add||!parent)continue;
    const center=n=>{const r=n.getBoundingClientRect();return r.top+r.height/2;};
    const correction=center(parent)-(center(cards[0])+center(add))/2;
    const previous=Number(block.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1]||0);
    block.style.transform=`translateY(${previous+correction}px)`;
   }
   if(innerWidth>650&&!stackedRelationships){
    const current=right.querySelector('.ux-stage-block:not([hidden]) .is-current');
    if(current){
     const parents=edges.filter(([from,,to,id])=>from===1&&to===2&&String(id)===current.dataset.stageNode).map(([,id])=>node(1,id));
     const centers=parents.filter(n=>n?.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return r.top+r.height/2;});
     if(centers.length>1){
      const block=current.closest('.ux-stage-block'),r=current.getBoundingClientRect();
      const previous=Number(block.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1]||0);
      block.style.transform=`translateY(${previous+(Math.min(...centers)+Math.max(...centers))/2-r.top-r.height/2}px)`;
     }
    }
   }
   // A single group-to-substance link shares one horizontal center line.
   // Align after the other columns have finished positioning their cards.
   if(innerWidth>650){
    const parents=[...stack.querySelectorAll('.ux-stage-node')].filter(n=>n.getClientRects().length);
    if(parents.length===1&&!parents[0].classList.contains('is-current')){
     const parent=parents[0],children=edges.filter(([from,id,to])=>from===0&&String(id)===parent.dataset.stageNode&&to===1)
      .map(([, ,to,id])=>node(to,id)).filter(n=>n?.getClientRects().length);
     if(children.length===1){
      const a=parent.getBoundingClientRect(),b=children[0].getBoundingClientRect();
      stack.style.transform=`translateY(${b.top+b.height/2-a.top-a.height/2}px)`;
     }
    }
   }
   const rect=columns.getBoundingClientRect(),width=columns.scrollWidth,height=columns.offsetHeight;svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.style.width=width+'px';svg.style.height=height+'px';
   const paths=[],groups=new Map();
   function path(d,added,right){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('class',(added?'is-add ':'')+(right?'is-right':''));paths.push(p);}
   function line(a,b,added,right){
    if(!a||!b||!a.getClientRects().length||!b.getClientRects().length)return;
    // Merge children of the same parent onto one shared vertical bus.
    const key=[...columns.querySelectorAll('.ux-stage-node,.ux-stage-add')].indexOf(a)+':'+added+':'+right;
    if(!groups.has(key))groups.set(key,{a,targets:new Set(),added,right});
    groups.get(key).targets.add(b);
   }
   for(const [from,a,to,b] of edges)line(node(from,a),node(to,b),false,to===2);
   section.querySelectorAll('[data-pending-group]').forEach(parent=>{section.querySelectorAll('[data-pending-group-member]').forEach(child=>{if(child.dataset.pendingGroupMember.split(' ').includes(parent.dataset.pendingGroup))line(parent,child,false,false);});});
   section.querySelectorAll('.ux-stage-add').forEach(button=>{const level=Number(button.closest('[data-stage]').dataset.stage),id=Number(button.dataset.sourceId);if(level===0)line(button,node(1,id),true,false);else if(level===2&&!button.dataset.sourceOptions)line(node(1,id)||node(0,id),button,true,true);else if(level===1)line(node(0,id),button,true,false);});
   for(const {a,targets,added,right} of groups.values()){
    const ra=a.getBoundingClientRect(),ay=ra.top+ra.height/2-rect.top;
    const boxes=[...targets].map(b=>b.getBoundingClientRect()),forward=boxes[0].left>ra.left;
    const ax=(forward?ra.right:ra.left)-rect.left;
    const bx=(forward?Math.min(...boxes.map(b=>b.left)):Math.max(...boxes.map(b=>b.right)))-rect.left;
    const bus=(ax+bx)/2,ys=boxes.map(b=>b.top+b.height/2-rect.top);
    let d=`M${ax},${ay} H${bus} M${bus},${Math.min(ay,...ys)} V${Math.max(ay,...ys)}`;
    boxes.forEach((b,i)=>{d+=` M${bus},${ys[i]} H${(forward?b.left:b.right)-rect.left}`;});
    path(d,added,right);
   }
   svg.replaceChildren(...paths);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  schedule();
  new ResizeObserver(schedule).observe(columns);new MutationObserver(schedule).observe(columns,{childList:true,subtree:true});window.addEventListener('hashchange',schedule);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{capture:true,passive:true});
 });
});})();
