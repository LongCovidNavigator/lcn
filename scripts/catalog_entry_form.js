document.addEventListener('DOMContentLoaded',()=>{
 const form=document.getElementById('entry-form');if(!form)return;
 const params=new URLSearchParams(location.search),type=document.querySelector('[data-entry-type]')?.dataset.entryType,selected=new Set(),treatmentId=Number(params.get('for_treatment')),doctorId=Number(params.get('for_doctor'));
 if(params.get('embed')==='1')document.body.classList.add('catalog-embedded-form');
 if(params.get('prefill'))form.elements.name.value=params.get('prefill');
 window.LCNCatalogEntry={treatmentIds:()=>[...selected],doctorIds:()=>doctorId>0?[doctorId]:[],saved:data=>{if(params.get('embed')==='1'){window.parent.postMessage({type:'lcn-entry-saved',submission_id:data.submission_id},location.origin);return true;}return false;}};
 if(type!=='doctor')return;
 if(treatmentId>0)selected.add(treatmentId);
 const section=document.createElement('div'),heading=document.createElement('strong'),chips=document.createElement('div'),field=document.createElement('div');heading.textContent='Weitere Behandlungen';section.className='catalog-form-treatments';section.append(heading,chips,field);form.querySelector('fieldset').append(section);
 fetch('api/submission_options.php').then(r=>r.json()).then(data=>{if(!data.ok)throw Error();const items=data.treatments.map(item=>({id:Number(item.id),name:item.label,meta:item.meta}));function render(){chips.replaceChildren();items.filter(item=>selected.has(item.id)).forEach(item=>{const tag=document.createElement('button');tag.type='button';tag.textContent=item.name+' ×';tag.addEventListener('click',()=>{selected.delete(item.id);render();picker.refresh();});chips.append(tag);});}const picker=window.LCNCatalogRelations.combo(field,{label:'Behandlungsangebot ergänzen',items:()=>items.filter(item=>!selected.has(item.id)),onSelect:item=>{selected.add(item.id);render();}});render();}).catch(()=>{field.textContent='Die Behandlungsauswahl konnte nicht geladen werden. Bitte später erneut versuchen.';});
});
