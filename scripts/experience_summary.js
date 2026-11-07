// Four effect categories, identical to the detail-page scales; optional table sorting.
window.LCNExperience = (() => {
  const labels=['Verschlechterung','Neutral','Verbesserung','Heilung'];
  let counts=null,failed=false,includeDummy=false,requestVersion=0;
  function dummyEnabled(){
    return window.LCNDummy?.get() ?? false;
  }
  function load(){
    const version=++requestVersion;includeDummy=dummyEnabled();counts=null;failed=false;
    document.querySelectorAll('.lcn-experience').forEach(node=>{delete node.dataset.ready;node.textContent='Erfahrungen werden geladen …';});
    fetch('api/experience_summary.php?include_dummy='+(includeDummy?'1':'0'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(version!==requestVersion)return;if(!data.ok)throw Error();counts=data.counts;render();}).catch(()=>{if(version!==requestVersion)return;failed=true;render();});
  }
  function html(type,id,sortable=false){
    const ids=String(id).split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0).join(',');
    return `<div class="lcn-experience" data-experience-type="${type==='doctor'?'doctor':'treatment'}" data-experience-ids="${ids}"${sortable?' data-experience-sortable="true"':''}>Erfahrungen werden geladen …</div>`;
  }
  function render(){
    if(!counts&&!failed)return;
    const sortableTypes=new Set();
    document.querySelectorAll('.lcn-experience:not([data-ready])').forEach(node=>{
      node.dataset.ready='true';node.replaceChildren();
      if(failed){node.textContent='Erfahrungen gerade nicht verfügbar.';return;}
      const ids=[...new Set(node.dataset.experienceIds.split(',').map(Number).filter(Boolean))],type=node.dataset.experienceType;
      const values=[0,0,0,0];ids.forEach(id=>(counts[type]?.[id]||[0,0,0,0]).forEach((n,i)=>values[i]+=Number(n)));
      const total=values.reduce((a,b)=>a+b,0);
      const cardPanel=node.closest('.treatment-card-rating-panel,.doctor-card-rating-panel');
      if(cardPanel){
        const heading=cardPanel.querySelector('.treatment-card-section-heading,.doctor-card-section-heading');
        let count=heading.querySelector('.treatment-card-section-count,.doctor-card-section-count');
        if(!count){count=document.createElement('span');count.className=type==='doctor'?'doctor-card-section-count':'treatment-card-section-count';heading.append(count);}
        count.textContent=' (N = '+total+')';
        node.style.setProperty('--experience-bar-height',(total?Math.max(...values)*54/total:0)+'px');
      }
      [0,1,2,3].forEach(i=>{
        const label=labels[i];
        const sortable=node.dataset.experienceSortable==='true';
        const item=document.createElement(sortable?'button':ids.length===1?'a':'span');item.className='lcn-effect lcn-effect-'+i;
        if(sortable){item.dataset.lcnTooltip=label+': Zum Sortieren klicken.';item.dataset.lcnTooltipAccent='text';item.type='button';item.dataset.tableSortKey=['negative_ratio','neutral_ratio','positive_ratio','healing_ratio'][i];}
        if(!sortable&&ids.length===1)item.href=type==='doctor'?`arzt_detail.html?id=${ids[0]}#wirkung`:`therapie_detail.php?treatment_id=${ids[0]}#wirkung`;
        const title=document.createElement('span'),value=document.createElement('strong');title.textContent=label;value.textContent=total?Math.round(values[i]*100/total)+' %':'—';
        if(!sortable)item.title=label+': '+values[i]+' von '+total+' Angaben';item.setAttribute('aria-label',label+': '+value.textContent+(sortable?'. Nach '+label+' sortieren':''));item.append(title,value);
        if(node.closest('.treatment-card,.doctor-card')){const track=document.createElement('span'),bar=document.createElement('span');track.className='lcn-effect-track';track.setAttribute('aria-hidden','true');bar.className='lcn-effect-bar';bar.style.height=(total?values[i]*54/total:0)+'px';track.append(bar);item.append(track);}
        node.append(item);
      });
      const note=document.createElement('small');note.textContent=`N = ${total}`;
      if(node.dataset.experienceSortable==='true'){const button=document.createElement('button');button.type='button';button.className='lcn-experience-count';button.dataset.lcnTooltip='Anzahl der Angaben: Zum Sortieren klicken.';button.dataset.lcnTooltipAccent='text';button.dataset.tableSortKey='total_votes';button.setAttribute('aria-label',total+' Angaben. Nach Anzahl der Angaben sortieren');button.append(note);node.append(button);}else if(!cardPanel)node.append(note);
      if(node.dataset.experienceSortable==='true')sortableTypes.add(type);
    });
    if(sortableTypes.has('doctor')&&typeof updateDoctorTableSortHeaders==='function')updateDoctorTableSortHeaders();
    if(sortableTypes.has('treatment')&&typeof updateTreatmentTableSortHeaders==='function')updateTreatmentTableSortHeaders();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(render).observe(document.body,{childList:true,subtree:true});
    load();
    window.addEventListener('storage',event=>{if(event.key==='lcn_dummy_data_enabled'||event.key===null)load();});
    window.addEventListener('focus',()=>{if(dummyEnabled()!==includeDummy)load();});
    window.addEventListener('lcn-dummy-change',load);
  });
  return {html};
})();
