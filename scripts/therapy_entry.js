document.addEventListener('DOMContentLoaded',async()=>{
 const form=document.getElementById('entry-form');if(!form?.elements.treatment_category)return;
 const category=form.elements.treatment_category,sub=form.elements.treatment_subcategory,drug=document.getElementById('therapy-entry-drug'),assignment=document.getElementById('therapy-entry-assignment'),parent=form.elements.medication_parent_name,status=document.getElementById('therapy-entry-options-status');
 let categories={},items=[];
 const role=()=>form.querySelector('[name=medication_role]:checked')?.value||'';
 function draw(){
  const selected=role(),match=items.find(item=>item.name===parent.value);
  const parentRole=selected==='brand'?'ingredient':'group';
  document.querySelectorAll('[data-drug-stage]').forEach(stage=>{const active=stage.dataset.drugStage===selected;stage.classList.toggle('is-current',active);stage.querySelector('strong').textContent=active?(form.elements.name.value.trim()||'Dein neuer Eintrag'):(match&&stage.dataset.drugStage===parentRole?match.name:'–');});
 }
 function availableParents(){return items.filter(item=>item.medication_role===(role()==='brand'?'ingredient':'group'));}
 function updateRole(){
  const selected=role();assignment.hidden=!selected||selected==='group';parent.value='';parent.setCustomValidity('');const options=document.getElementById('therapy-entry-medications');options.replaceChildren();for(const item of availableParents())options.append(new Option(item.name,item.name));
  document.getElementById('therapy-entry-assignment-label').textContent=selected==='brand'?'Zugehöriger Wirkstoff (optional)':'Zugehörige Medikamentengruppe (optional)';draw();
 }
 category.addEventListener('change',()=>{
  sub.replaceChildren(new Option('Bitte wählen / weiß ich nicht',''));for(const value of categories[category.value]||[])sub.add(new Option(value,value));sub.disabled=!category.value||!(categories[category.value]||[]).length;
  drug.hidden=category.value!=='Arzneimittel';if(drug.hidden){form.querySelectorAll('[name=medication_role]').forEach(input=>input.checked=false);updateRole();}
 });
 form.querySelectorAll('[name=medication_role]').forEach(input=>input.addEventListener('change',updateRole));form.elements.name.addEventListener('input',draw);parent.addEventListener('input',()=>{parent.setCustomValidity('');draw();});
 window.LCNTherapyEntry={payload:()=>{
  const selected=drug.hidden?'':role(),match=availableParents().find(item=>item.name===parent.value.trim());
  if(selected&&selected!=='group'&&parent.value.trim()&&!match){parent.setCustomValidity('Bitte einen vorhandenen Eintrag aus der Liste auswählen oder das Feld leer lassen.');parent.reportValidity();return null;}
  return {treatment_category:category.value,treatment_subcategory:sub.disabled?'':sub.value,medication_role:selected,medication_parent_id:selected&&selected!=='group'&&match?Number(match.id):null,medication_parent_name:selected&&selected!=='group'&&match?match.name:''};
 }};
 try{const response=await fetch('api/treatment_entry_options.php');const data=await response.json();if(!response.ok||!data.ok)throw Error();categories=data.categories;items=data.items.filter(item=>item.category==='Arzneimittel');for(const value of Object.keys(categories))category.add(new Option(value,value));for(const item of items)document.getElementById('therapy-entry-medications').append(new Option(item.name,item.name));}
 catch(_){status.textContent='Die Auswahllisten konnten nicht geladen werden. Du kannst die Therapie trotzdem mit ihrem Namen vorschlagen.';}
});
