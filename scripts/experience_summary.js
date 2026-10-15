// Four effect categories, identical to the detail-page scales. Read-only links.
window.LCNExperience = (() => {
  const labels=['Verschlechterung','Keine Veränderung','Verbesserung','Heilung'];
  let counts=null,failed=false;
  function html(type,id){
    const ids=String(id).split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0).join(',');
    return `<div class="lcn-experience" data-experience-type="${type==='doctor'?'doctor':'treatment'}" data-experience-ids="${ids}">Erfahrungen werden geladen …</div>`;
  }
  function render(){
    if(!counts&&!failed)return;
    document.querySelectorAll('.lcn-experience:not([data-ready])').forEach(node=>{
      node.dataset.ready='true';node.replaceChildren();
      if(failed){node.textContent='Erfahrungen gerade nicht verfügbar.';return;}
      const ids=[...new Set(node.dataset.experienceIds.split(',').map(Number).filter(Boolean))],type=node.dataset.experienceType;
      const values=[0,0,0,0];ids.forEach(id=>(counts[type]?.[id]||[0,0,0,0]).forEach((n,i)=>values[i]+=Number(n)));
      const total=values.reduce((a,b)=>a+b,0);
      labels.forEach((label,i)=>{
        const item=document.createElement(ids.length===1?'a':'span');item.className='lcn-effect lcn-effect-'+i;
        if(ids.length===1)item.href=type==='doctor'?`arzt_detail.html?id=${ids[0]}#wirkung`:`therapie_detail.php?treatment_id=${ids[0]}#wirkung`;
        const title=document.createElement('span'),value=document.createElement('strong');title.textContent=label;value.textContent=total?Math.round(values[i]*100/total)+' %':'—';
        item.title=values[i]+' von '+total+' Angaben';item.append(title,value);node.append(item);
      });
      const note=document.createElement('small');note.textContent=total?`n = ${total} · gespeicherte Erfahrungen`:'Noch keine gespeicherten Erfahrungen';node.append(note);
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(render).observe(document.body,{childList:true,subtree:true});
    fetch('api/experience_summary.php',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!data.ok)throw Error();counts=data.counts;render();}).catch(()=>{failed=true;render();});
  });
  return {html};
})();
