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
  const feedback=make('div'),host=make('span');feedback.className='ux-combination-assertion';host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.feedbackStatement='Vorgeschlagene Kombination „'+item.combination.name+'“ mit den angezeigten Bestandteilen.';feedback.append(host);parent.append(feedback);
  const label=make('p','Bestandteile');label.className='ux-combination-parts-label';parts.className='ux-combination-parts';
  for(const id of item.combination.component_ids){const entry=catalog.items.find(n=>n.id===id);if(!entry)continue;const part=make('article');part.className='ux-combination-part ux-relation-entry';part.dataset.combinationPart='';part.dataset.componentId=id;
   if(id===pageId){part.classList.add('is-current');const badge=make('small','Du bist hier');badge.className='ux-combination-current';part.append(badge,make('strong',entry.name));}else{const link=make('a',entry.name);link.href='therapie_detail.php?treatment_id='+id+'#alternativen';part.append(link);}parts.append(part);
  }
  drawing.append(svg,parent,label,parts);tree.append(drawing);return tree;
 }
 function renderPendingAlternative(item,options){
  const other=Number(item.left_id)===pageId?Number(item.right_id):Number(item.left_id),entry=catalog.items.find(n=>n.id===other);if(!entry)return false;
  if([...options.querySelectorAll('a[href*="treatment_id="]')].some(a=>Number(new URL(a.href).searchParams.get('treatment_id'))===other))return true;
  const tile=make('article'),link=make('a',entry.name),feedback=make('div'),host=make('span');
  tile.className='ux-alternative-tile ux-feedback-relation';tile.dataset.pendingAlternative=item.submission_id;
  tile.append(make('small','Vorschlag · Prüfung ausstehend'));
  if(entry.meta){const category=make('span',entry.meta);category.className='ux-alternative-category';tile.append(category);}
  link.className='ux-alternative-name';link.href='therapie_detail.php?treatment_id='+other+'#alternativen';tile.append(link);
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
  combinations?.querySelectorAll('[data-pending-combination]').forEach(n=>n.remove());let remaining=0;
  for(const item of catalog.pending){
   if(item.kind==='group'&&document.querySelector('[data-pending-relationship="'+item.submission_id+'"]'))continue;
   if(item.kind==='alternative'&&alternatives&&[Number(item.left_id),Number(item.right_id)].includes(pageId)&&renderPendingAlternative(item,alternatives))continue;
   if(item.kind==='new_combination'&&item.combination&&combinations){combinations.insertBefore(renderPendingCombination(item),combinations.querySelector('.ux-combination-actions'));continue;}
   const kind={brand:'has_trade',form:'has_form',variant:'has_variant',detail:'has_detail',group:Number(item.left_id)===pageId?'belongs_to_group':'group_contains',component:Number(item.left_id)===pageId?'component_of':'has_component'}[item.kind];
   const buttons=[...document.querySelectorAll('[data-treatment-relation-add]')],button=buttons.find(n=>n.dataset.kind===kind&&Number(n.dataset.sourceId||pageId)===Number(item.right_id))||buttons.find(n=>n.dataset.kind===kind);
   const container=button?.parentElement||document.querySelector('[data-stage="0"] .ux-stage-stack');if(!container)continue;
   const tile=make('article'),host=make('span'),other=Number(item.left_id)===pageId?Number(item.right_id):Number(item.left_id),entry=catalog.items.find(n=>n.id===other);
   tile.className='ux-stage-node ux-relation-entry is-linked';tile.dataset.pendingRelationship=item.submission_id;
   if(entry){const link=make('a',entry.name);link.className='ux-stage-name';link.href='therapie_detail.php?treatment_id='+other+'#alternativen';tile.append(link);}
   tile.append(make('small','Prüfung ausstehend'),make('p',item.description));host.dataset.treatmentRelationFeedback='s:'+item.submission_id;host.dataset.feedbackStandard='1';host.dataset.feedbackStatement=item.description;tile.append(host);
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
   const data=await load(),source=Number(button.dataset.sourceId)||pageId,sourceName=data.items.find(n=>n.id===source)?.name||'';
   const existing=new Set([...existingContainer.querySelectorAll('a[href*="treatment_id="]')].map(a=>Number(new URL(a.href).searchParams.get('treatment_id'))));
   const dialog=make('dialog'),form=make('form'),heading=make('h3'),context=make('p',button.dataset.prompt||sourceName),kindLabel=make('label','Zusammenhang'),kind=make('select'),groupField=make('div'),targetField=make('div'),selection=make('p'),extras=make('details'),extraTitle=make('summary','Quelle oder Hinweis ergänzen (optional)'),urlLabel=make('label','Quelle (optional)'),url=make('input'),noteLabel=make('label','Begründung (optional)'),note=make('textarea'),hint=make('p','Dein Vorschlag erscheint zunächst mit „Prüfung ausstehend“.'),message=make('p'),actions=make('div'),send=make('button','Vorschlagen'),cancel=make('button','Abbrechen');
   dialog.className='catalog-report-dialog treatment-relation-dialog';kind.name='kind';kind.setAttribute('aria-label','Zusammenhang');
   for(const [value,label] of Object.entries(data.kinds)){const option=make('option',label);option.value=value;kind.append(option);}kind.value=button.dataset.kind||'alternative';kindLabel.append(kind);
   url.type='url';url.maxLength=1000;url.placeholder='https://…';note.maxLength=2000;urlLabel.append(url);noteLabel.append(note);extras.className='treatment-relation-extras';extras.append(extraTitle,urlLabel,noteLabel);send.type='submit';cancel.type='button';cancel.addEventListener('click',()=>dialog.close());message.setAttribute('role','status');selection.className='treatment-relation-preview';selection.setAttribute('aria-live','polite');actions.className='catalog-preview-actions';actions.append(send,cancel);
   form.append(heading,context);if(button.dataset.chooseKind==='1')form.append(kindLabel);
   form.append(groupField,targetField,selection,extras,hint,message,actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
   let target=null,group=null,targets=[],groups=[],saving=false;let targetCombo,groupCombo;
   hint.textContent='Du kannst mehrere Einträge auswählen und danach weitersuchen. Alle Vorschläge erscheinen mit „Prüfung ausstehend“.';
   const titles={alternative:'Alternative Therapie vorschlagen',group_contains:'Eintrag zur Gruppe hinzufügen',belongs_to_group:'Gruppe zuordnen',has_trade:'Handelsname ergänzen',trade_of:'Wirkstoff zuordnen',has_form:'Anwendungsform ergänzen',form_of:'Anwendungsform zuordnen',has_component:'Bestandteil ergänzen',component_of:'Kombination ergänzen',has_variant:'Stoffvariante ergänzen',variant_of:'Übergeordnete Substanz zuordnen',has_detail:'Detaillierteres Verfahren ergänzen',detail_of:'Übergeordnetes Verfahren zuordnen'};
   const targetLabels={alternative:'Alternative Therapie auswählen',group_contains:'Eintrag auswählen',has_trade:'Handelsname auswählen',trade_of:'Wirkstoff auswählen',has_form:'Anwendungsform auswählen',form_of:'Übergeordneten Eintrag auswählen',has_component:'Bestandteil auswählen',component_of:'Kombination auswählen',has_variant:'Stoffvariante auswählen',variant_of:'Übergeordnete Substanz auswählen',has_detail:'Detaillierteres Verfahren auswählen',detail_of:'Übergeordnetes Verfahren auswählen'};
   function preview(){
    const grouped=['belongs_to_group','group_contains'].includes(kind.value),entries=kind.value==='belongs_to_group'?groups:targets;
    send.disabled=saving||!entries.length||(grouped&&kind.value!=='belongs_to_group'&&!group);
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
    if(!targetField.hidden)targetCombo=api.combo(targetField,{label:button.dataset.targetLabel||targetLabels[kind.value],keepOpenOnSelect:true,items:()=>data.items.filter(n=>!targets.some(t=>t.id===n.id)&&n.id!==source&&n.id!==pageId&&!existing.has(n.id)&&(kind.value!=='component_of'||n.is_combination)&&(!['trade_of','has_trade'].includes(kind.value)||n.meta.split(' · ')[0]==='Arzneimittel')),onInput:()=>{},onSelect:item=>{target=data.items.find(n=>n.id===item.id)||item;targets.push(target);preview();},onMissing:name=>api.entryDialog('treatment',name,{},async()=>{Object.assign(data,await load());message.textContent='Die neue Therapie ist jetzt auswählbar. Prüfung ausstehend.';targetCombo?.refresh();})});
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
  function draw(){
   frame=0;if(!canvas.getBoundingClientRect().width||!canvas.getBoundingClientRect().height)return;
   const rect=columns.getBoundingClientRect(),width=columns.scrollWidth,height=columns.offsetHeight;svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.style.width=width+'px';svg.style.height=height+'px';
   const paths=[];
   function line(a,b,added,right){if(!a||!b||!a.getClientRects().length||!b.getClientRects().length)return;const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();let ax=ra.right-rect.left,ay=ra.top+ra.height/2-rect.top,bx=rb.left-rect.left,by=rb.top+rb.height/2-rect.top;if(ra.left>rb.left){ax=ra.left-rect.left;bx=rb.right-rect.left;}const curve=Math.max(14,Math.abs(bx-ax)*.45),dir=bx>ax?1:-1;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M${ax},${ay} C${ax+curve*dir},${ay} ${bx-curve*dir},${by} ${bx},${by}`);path.setAttribute('class',(added?'is-add ':'')+(right?'is-right':''));paths.push(path);}
   for(const [from,a,to,b] of edges)line(node(from,a),node(to,b),false,to===2);
   section.querySelectorAll('[data-pending-group]').forEach(parent=>{section.querySelectorAll('[data-pending-group-member]').forEach(child=>{if(child.dataset.pendingGroupMember.split(' ').includes(parent.dataset.pendingGroup))line(parent,child,false,false);});});
   section.querySelectorAll('.ux-stage-add').forEach(button=>{const level=Number(button.closest('[data-stage]').dataset.stage),id=Number(button.dataset.sourceId);if(level===0)line(button,node(1,id),true,false);else if(level===2)line(node(1,id)||node(0,id),button,true,true);else if(level===1)line(node(0,id),button,true,false);});
   svg.replaceChildren(...paths);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  schedule();
  new ResizeObserver(schedule).observe(columns);new MutationObserver(schedule).observe(columns,{childList:true,subtree:true});window.addEventListener('hashchange',schedule);window.addEventListener('resize',schedule);
 });
});})();
