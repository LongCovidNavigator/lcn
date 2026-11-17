/* Shared checkbox picker; native selects remain the source for existing controls. */
window.filterValues = id => {
 const s=document.getElementById(id);
 return s? (s._filterValues || [s.value]).filter(v=>v && v!=="0"):[];
};
window.clearMultiFilters = () => document.querySelectorAll('select[data-multi-filter]').forEach(s=>{s._filterValues=[];s.value=s.options[0]?.value||'';s._renderMulti?.();});
// Capture the original event path before selecting an option rebuilds its menu.
// This also handles keyboard clicks and touch-generated clicks.
document.addEventListener('click', event => {
 const path = event.composedPath();
 document.querySelectorAll('details.multi-filter[open], details.provider-filter-picker[open]').forEach(picker => {
  if (!path.includes(picker)) picker.open = false;
 });
}, true);

document.addEventListener('DOMContentLoaded',()=>{
 for(const id of ['doctor-specialty-select','doctor-specialization-select','doctor-qualification-select','treatment-category-select','treatment-subcategory-select']){
 const s=document.getElementById(id);if(!s)continue;
 s.dataset.multiFilter='1';s.hidden=true;
 const picker=document.createElement('details');picker.className='multi-filter';
 const summary=document.createElement('summary'),menu=document.createElement('div');menu.className='multi-filter-menu';picker.append(summary,menu);s.after(picker);
 const label=document.querySelector(`label[for="${id}"]`);if(label){summary.id=id+'-summary';label.htmlFor=summary.id;}
 const render=()=>{
 const values=filterValues(id);summary.textContent=values.length?s.options.length?[...s.options].filter(o=>values.includes(o.value)).map(o=>o.textContent).join(', '):values.join(', '):s.options[0]?.textContent;
 picker.hidden=s.disabled;menu.replaceChildren();
 if(id==='doctor-specialty-select') {
 const related=[...s.options].filter(o=>/psychiatr|psychosomat|psychotherap/i.test(o.textContent));
 if(related.length>1) {
 const row=document.createElement('label'),box=document.createElement('input');box.type='checkbox';
 const ids=related.map(o=>o.value),n=ids.filter(v=>values.includes(v)).length;box.checked=n===ids.length;box.indeterminate=n>0&&n<ids.length;
 row.className='multi-filter-group';row.append(box,document.createTextNode('Psychiatrie, Psychosomatik und Psychotherapie (alle)'));menu.append(row);
 box.addEventListener('change',()=>{s._filterValues=box.checked?[...new Set([...values,...ids])]:values.filter(v=>!ids.includes(v));s.value=s._filterValues[0]||s.options[0].value;s._multiChanging=true;s.dispatchEvent(new Event('change',{bubbles:true}));s._multiChanging=false;render();});
 }
 }
 for(const o of s.options){const row=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=(!o.value||o.value==='0')?!values.length:values.includes(o.value);row.append(box,document.createTextNode(o.textContent));menu.append(row);
 box.addEventListener('change',()=>{s._filterValues=(!o.value||o.value==='0')?[]:box.checked?[...values,o.value]:values.filter(v=>v!==o.value);s.value=s._filterValues[0]||s.options[0].value;s._multiChanging=true;s.dispatchEvent(new Event('change',{bubbles:true}));s._multiChanging=false;render();});}
 };
 s._renderMulti=render;s.addEventListener('change',()=>{if(!s._multiChanging)s._filterValues=[s.value];render();});new MutationObserver(render).observe(s,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});render();
 picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;summary.focus();}});
 }
 document.getElementById('doctor-filter-reset-button')?.addEventListener('click',clearMultiFilters,true);
 document.querySelectorAll('[id*="reset"]').forEach(b=>b.addEventListener('click',clearMultiFilters,true));
});
