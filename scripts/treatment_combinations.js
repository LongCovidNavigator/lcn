/* Combination creation is one reviewed proposal, including all selected component links. */
(()=>{document.addEventListener('DOMContentLoaded',()=>{
 const page=document.querySelector('.ux-detail[data-treatment-id]'),api=window.LCNCatalogRelations;if(!page||!api)return;const source=Number(page.dataset.treatmentId),make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 document.querySelectorAll('[data-combination-create]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;try{
   const data=await api.request('api/treatment_relationship_proposals.php?id='+source),current=data.items.find(n=>n.id===source);if(!current)throw Error('Die aktuelle Therapie wurde nicht gefunden.');
   const chosen=new Map([[source,current]]),dialog=make('dialog'),form=make('form'),title=make('h3','Neue Kombination mit '+current.name),nameLabel=make('label','Name der Kombination'),name=make('input'),layout=make('div'),fields=make('div'),preview=make('aside'),partsTitle=make('h4','Bestandteile'),list=make('div'),picker=make('div'),extras=make('details'),summary=make('summary','Quelle oder Begründung ergänzen (optional)'),urlLabel=make('label','Quelle (optional)'),url=make('input'),noteLabel=make('label','Begründung (optional)'),note=make('textarea'),hint=make('p','Der Vorschlag wird vor Veröffentlichung geprüft.'),message=make('p'),actions=make('div'),cancel=make('button','Abbrechen'),send=make('button','Kombination vorschlagen');
   dialog.className='catalog-report-dialog treatment-relation-dialog ux-combination-dialog';layout.className='ux-combination-dialog-layout';list.className='ux-combination-selected';preview.className='ux-combination-preview';preview.setAttribute('aria-label','Vorschau der neuen Kombination');message.setAttribute('role','status');actions.className='catalog-preview-actions';name.type='text';name.required=true;name.minLength=2;name.maxLength=255;name.placeholder='Namen eingeben';nameLabel.append(name);url.type='url';url.maxLength=1000;urlLabel.append(url);note.maxLength=2000;noteLabel.append(note);extras.append(summary,urlLabel,noteLabel);send.type='submit';send.disabled=true;cancel.type='button';cancel.addEventListener('click',()=>dialog.close());actions.append(cancel,send);fields.append(nameLabel,partsTitle,list,picker,extras,hint);layout.append(fields,preview);form.append(title,layout,message,actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
   let combo;
   function paint(){
    list.replaceChildren();for(const item of chosen.values()){const row=make('div'),label=make('span',item.name);row.append(label);if(item.id===source)row.append(make('small','Bereits ausgewählt'));else{const remove=make('button','Entfernen');remove.type='button';remove.setAttribute('aria-label',item.name+' entfernen');remove.addEventListener('click',()=>{chosen.delete(item.id);paint();combo.refresh();});row.append(remove);}list.append(row);}
    preview.replaceChildren(make('h4','Vorschau'));const parent=make('strong',name.value.trim()||'Neue Kombination'),parts=make('div');parent.className='ux-combination-preview-parent';parts.className='ux-combination-preview-parts';for(const item of chosen.values())parts.append(make('span',item.name));if(chosen.size<2)parts.append(make('span','Weiteren Bestandteil auswählen'));preview.append(parent,parts);send.disabled=chosen.size<2||chosen.size>20||name.value.trim().length<2;
   }
   combo=api.combo(picker,{label:'Weiteren Bestandteil auswählen',items:()=>data.items.filter(n=>!chosen.has(n.id)),onSelect:item=>{const original=data.items.find(n=>n.id===item.id);if(chosen.size>=20){message.textContent='Höchstens zwanzig Bestandteile auswählen.';return false;}chosen.set(item.id,original);message.textContent='';paint();return true;},onMissing:query=>api.entryDialog('treatment',query,{},()=>{message.textContent='Die neue Therapie wurde zur Prüfung vorgeschlagen. Nach ihrer Freigabe kannst du sie als Bestandteil auswählen.';})});
   name.addEventListener('input',paint);paint();
   form.addEventListener('submit',async event=>{event.preventDefault();if(send.disabled)return;send.disabled=true;message.textContent='';try{const result=await api.request('api/treatment_relationship_proposals.php',{kind:'new_combination',source_id:source,context_id:source,name:name.value.trim(),component_ids:[...chosen.keys()],note:note.value,source_url:url.value});document.dispatchEvent(new CustomEvent('lcn-treatment-relations-changed'));form.replaceChildren(make('h3',result.duplicate?'Kombination bereits vorgeschlagen':'Kombination vorgeschlagen'),make('p','Die Kombination und ihre Bestandteile sind gemeinsam zur Prüfung gespeichert.'),cancel);cancel.textContent='Schließen';}catch(error){message.textContent=error.message;paint();}});
   dialog.showModal();name.focus();
  }catch(error){const status=document.querySelector('[data-treatment-relation-status]');if(status)status.textContent=error.message;}finally{button.disabled=false;}
 }));
 // One bracket joins the combination to its components. Dashed branches are additions only.
 function initializeTrees(){document.querySelectorAll('[data-combination-tree]').forEach(tree=>{
  if(tree.dataset.bracketInitialized)return;tree.dataset.bracketInitialized='1';
  const group=make('details'),summary=make('summary'),title=tree.querySelector('[data-combination-parent] > a,[data-combination-parent] > strong');
  group.className='ux-combination-group';summary.textContent=title?.textContent||'Kombination';
  tree.before(group);group.append(summary,tree);

  const drawing=tree.querySelector('.ux-combination-drawing'),parent=tree.querySelector('[data-combination-parent]'),svg=tree.querySelector('svg');let frame;
  function draw(){frame=0;if(!drawing.getBoundingClientRect().width)return;
   const children=[...tree.querySelectorAll('[data-combination-part], [data-combination-add-part]')];
   drawing.style.setProperty('--combination-columns',Math.max(1,children.length));
   const r=drawing.getBoundingClientRect(),p=parent.getBoundingClientRect();
   svg.setAttribute('width',r.width);svg.setAttribute('height',r.height);
   svg.setAttribute('viewBox','0 0 '+r.width+' '+r.height);const paths=[],px=p.left+p.width/2-r.left,py=p.bottom-r.top;
   const path=(d,dashed=false)=>{const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',d);if(dashed)node.setAttribute('class','is-add');paths.push(node);};
   if(children.length){
    const boxes=children.map(n=>n.getBoundingClientRect()),centers=boxes.map(b=>b.left+b.width/2-r.left),rail=Math.min(...boxes.map(b=>b.top))-r.top-18;
    path(`M${px},${py} V${rail}`);
    const accepted=children.filter(n=>!n.hasAttribute('data-combination-add-part'));
    const solid=accepted.map(n=>{const b=n.getBoundingClientRect();return b.left+b.width/2-r.left;});
    if(solid.length)path(`M${Math.min(px,...solid)},${rail} H${Math.max(px,...solid)}`);
    children.forEach((n,i)=>{const dashed=n.hasAttribute('data-combination-add-part'),start=centers[i]>=px?Math.max(px,...solid):Math.min(px,...solid);path(dashed?`M${start},${rail} H${centers[i]} V${boxes[i].top-r.top}`:`M${centers[i]},${rail} V${boxes[i].top-r.top}`,dashed);});
   }svg.replaceChildren(...paths);
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};new ResizeObserver(schedule).observe(drawing);new MutationObserver(schedule).observe(drawing.querySelector('.ux-combination-parts'),{childList:true,subtree:true});window.addEventListener('hashchange',schedule);group.addEventListener('toggle',schedule);schedule();
 });
 document.querySelectorAll('[data-combination-section]').forEach(section=>{
  const groups=[...section.querySelectorAll('.ux-combination-group')],multiple=groups.length>1;
  groups.forEach(group=>{
   const wasSingle=group.classList.contains('is-single');
   group.classList.toggle('is-single',!multiple);
   group.querySelector('summary').hidden=!multiple;
   if(!multiple)group.open=true;else if(wasSingle)group.open=false;
  });
 });}
 document.addEventListener('lcn-combination-diagrams-changed',initializeTrees);initializeTrees();
});})();
