(() => {
 'use strict';
 const $=s=>document.querySelector(s), input=$('#sym-search'), list=$('#sym-suggestions'), dialog=$('#sym-dialog'), form=$('#sym-proposal');
 let context=null, timer, controller, active=-1;
 function message(text){const box=$('#sym-message');box.textContent=text;box.className='fb-success';box.hidden=false;}
 async function send(body){const response=await fetch('api/symptom_catalog.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Bitte versuche es erneut.');return data;}
 const mobileResults=matchMedia('(max-width: 760px)');
 function view(preferred){const value=mobileResults.matches||preferred==='table'?'table':'cards';$('#sym-cards')?.toggleAttribute('hidden',value!=='cards');$('#sym-table')?.toggleAttribute('hidden',value!=='table');document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('is-active',b.dataset.view===value);b.setAttribute('aria-pressed',String(b.dataset.view===value));});}
 let saved;try{saved=localStorage.getItem('lcn-symptom-view');}catch{}view(saved);
 mobileResults.addEventListener('change',()=>view(saved));
 const more=$('#sym-show-more');
 const cards=[...document.querySelectorAll('#sym-cards [data-symptom-result]')];
 const tableBody=$('#sym-table tbody');
 let visibleLimit=50;
 function showResults(){
  if(!more)return;
  cards.forEach((card,index)=>card.hidden=index>=visibleLimit);
  [...tableBody.rows].forEach((row,index)=>row.hidden=index>=visibleLimit);
  const remaining=Math.max(0,cards.length-visibleLimit);
  const count=$('#sym-visible-count');
  count.textContent=Math.min(visibleLimit,cards.length)+' von '+cards.length+' Symptomen angezeigt';
  count.hidden=false;
  more.hidden=remaining===0;
  more.textContent='Weitere '+Math.min(remaining,50)+' anzeigen';
 }
 more?.addEventListener('click',()=>{
  const next=($('#sym-table').hidden?cards:tableBody.rows)[visibleLimit];
  visibleLimit+=50;
  showResults();
  next?.querySelector('a')?.focus();
 });
 showResults();
 const sortField=$('#sym-table-sort-field');
 if(sortField){
  const directionButton=$('#sym-table-sort-direction');
  const headers=[...document.querySelectorAll('[data-sym-sort]')];
  const body=$('#sym-table tbody');
  const collator=new Intl.Collator('de',{numeric:true,sensitivity:'base'});
  let key='rank', direction=1;
  const rank=row=>Number(row.cells[0].textContent);
  const count=text=>/^\d+$/.test(text.trim())?Number(text):null;
  const value={
   rank,
   name:row=>row.cells[1].querySelector('a').textContent,
   category:row=>row.querySelector('.sym-actions').dataset.category.trim()||null,
   votes:row=>[...row.cells[3].querySelectorAll('[data-count]')].reduce((total,node)=>total+Number(node.textContent),0),
   treatments:row=>count(row.cells[4].textContent),
   providers:row=>count(row.cells[5].textContent),
   distance:row=>row.cells[6].dataset.distance!==undefined?Number(row.cells[6].dataset.distance):value.city(row),
   city:row=>row.cells[6].dataset.city||null
  };
  function sortRows(){
   const rows=[...body.rows].map(row=>({row,value:value[key](row)}));
   rows.sort((a,b)=>{
    if(a.value===b.value)return rank(a.row)-rank(b.row);
    if(a.value===null)return 1;
    if(b.value===null)return -1;
    if(typeof a.value!==typeof b.value)return typeof a.value==='number'?-1:1;
    const order=typeof a.value==='number'?a.value-b.value:collator.compare(a.value,b.value);
    return order*direction||rank(a.row)-rank(b.row);
   });
   rows.forEach(({row},index)=>{
    if(body.rows[index]!==row)body.insertBefore(row,body.rows[index]);
   });
   showResults();
   headers.forEach(button=>{
    const heading=button.parentElement;
    if(button.dataset.symSort===(key==='city'?'distance':key)){
     heading.setAttribute('aria-sort',direction===1?'ascending':'descending');
    }else heading.removeAttribute('aria-sort');
   });
   directionButton.textContent=direction===1?'Aufsteigend ↑':'Absteigend ↓';
   sortField.value=key;
  }
  function changeSort(next){
   direction=next===key?-direction:1;
   key=next;
   sortRows();
  }
  headers.forEach(button=>{
   button.disabled=false;
   button.addEventListener('click',()=>changeSort(button.dataset.symSort));
  });
  sortField.closest('.sym-table-order').hidden=false;
  sortField.addEventListener('change',()=>changeSort(sortField.value));
  directionButton.addEventListener('click',()=>changeSort(key));
  document.addEventListener('lcn-symptom-locations-updated',()=>{
   if(key==='distance'||key==='city')sortRows();
  });
  sortRows();
 }
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
  saved=b.dataset.view;
  try{localStorage.setItem('lcn-symptom-view',saved);}catch{}
  view(saved);
 }));
 function hide(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
 function openProposal(sym=null,name=''){
  hide();context=sym;form.reset();$('#sym-dialog-error').hidden=true;
  $('#sym-dialog-title').textContent=sym?'Kategorie für „'+sym.name+'“ anpassen':'Fehlendes Symptom ergänzen';
  form.elements.name.value=sym?sym.name:name;form.elements.name.required=!sym;$('#sym-name-label').hidden=!!sym;
  form.elements.category.value=sym?sym.category:'';form.elements.category.required=!!sym;
  dialog.showModal();(sym?form.elements.category:form.elements.name).focus();
 }
 $('#sym-add').addEventListener('click',()=>openProposal(null,input.value.trim()));
 $('#sym-dialog-close').addEventListener('click',()=>dialog.close());
 form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;$('#sym-dialog-error').hidden=true;try{const data=await send({action:context?'category':'add',id:context?.id,snapshot:context?.category,name:form.elements.name.value.trim(),category:form.elements.category.value.trim(),reason:form.elements.reason.value.trim()});dialog.close();message(data.message);$('#sym-message').focus();}catch(err){$('#sym-dialog-error').textContent=err.message;$('#sym-dialog-error').hidden=false;}finally{button.disabled=false;}});
 document.addEventListener('click',async e=>{
  const propose=e.target.closest('[data-propose]');if(propose){const d=propose.closest('[data-symptom]').dataset;openProposal({id:Number(d.symptom),name:d.name,category:d.category});return;}
  const vote=e.target.closest('[data-vote]'), review=e.target.closest('[data-review]');if(!vote&&!review)return;
  const button=vote||review;button.disabled=true;
  try{if(vote){const d=vote.closest('[data-symptom]').dataset;const data=await send({action:'vote',id:Number(d.symptom),snapshot:d.category,vote:vote.dataset.vote});document.querySelectorAll('[data-symptom="'+d.symptom+'"] [data-vote]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.vote===data.vote));const count=data.counts[b.dataset.vote];b.querySelector('[data-count]').textContent=count;b.setAttribute('aria-label',(b.dataset.vote==='confirm'?'Bestätigen':'Widersprechen')+': Kategorie '+d.category+' · '+count+' Stimmen');});message(data.message);if(vote.dataset.vote==='disagree')openProposal({id:Number(d.symptom),name:d.name,category:d.category});}else{const row=review.closest('[data-request]');const data=await send({action:'review',id:Number(row.dataset.request),approve:review.dataset.review==='approve'});row.remove();message(data.message+' Lade die Seite neu, um die Übersicht zu aktualisieren.');}}
  catch(err){const box=$('#sym-message');box.textContent=err.message;box.className='fb-error';box.hidden=false;}finally{button.disabled=false;}
 });
 input.addEventListener('input',()=>{
  clearTimeout(timer);controller?.abort();hide();const query=input.value.trim();if(query.length<2)return;
  timer=setTimeout(async()=>{controller=new AbortController();try{const response=await fetch('api/symptom_catalog.php?q='+encodeURIComponent(query),{signal:controller.signal});const data=await response.json();if(!response.ok||!data.ok||input.value.trim()!==query)return;list.replaceChildren();
   const option=(title,sub,callback)=>{const item=document.createElement('div');item.id='sym-option-'+list.children.length;item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.textContent=title;if(sub){const small=document.createElement('small');small.textContent=sub;item.append(small);}item.addEventListener('mousedown',e=>e.preventDefault());item.addEventListener('click',callback);list.append(item);};
   data.items.forEach(r=>option(r.sym_name,r.sym_category||'Noch ohne Kategorie',()=>{location.href='symptom_detail.php?id='+Number(r.sym_id);}));
   if(!data.exists&&!$('#sym-add').disabled)option('„'+query+'“ als fehlendes Symptom ergänzen','Vorschlag zur Prüfung einreichen',()=>openProposal(null,query));
   if(list.children.length){list.hidden=false;input.setAttribute('aria-expanded','true');}
  }catch(err){if(err.name!=='AbortError'){/* Die normale Formularsuche bleibt verfügbar. */}}},200);
 });
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){clearTimeout(timer);controller?.abort();hide();return;}if(list.hidden)return;const options=[...list.children];if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((o,i)=>o.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',options[active].id);options[active].scrollIntoView({block:'nearest'});}else if(e.key==='Enter'&&active>=0){e.preventDefault();options[active].click();}});
 input.addEventListener('blur',hide);
 document.addEventListener('click',e=>{if(!e.target.closest('.sym-search-field'))hide();});
})();
