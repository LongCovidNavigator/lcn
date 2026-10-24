// Four effect categories, identical to the detail-page scales. Read-only links.
window.LCNExperience = (() => {
  const labels=['Verschlechterung','Neutral','Verbesserung','Heilung'];
  let counts=null,failed=false,includeDummy=false,requestVersion=0;
  function dummyEnabled(){
    if(window.LCNDummy)return window.LCNDummy.get();
    try{const saved=localStorage.getItem('lcn_dummy_data_enabled');if(saved!==null)return saved==='1';}catch(_){}
    return new URLSearchParams(location.search).get('demo')==='1';
  }
  function load(){
    const version=++requestVersion;includeDummy=dummyEnabled();counts=null;failed=false;
    document.querySelectorAll('.lcn-experience').forEach(node=>{delete node.dataset.ready;node.textContent='Erfahrungen werden geladen …';});
    fetch('api/experience_summary.php?include_dummy='+(includeDummy?'1':'0'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(version!==requestVersion)return;if(!data.ok)throw Error();counts=data.counts;render();}).catch(()=>{if(version!==requestVersion)return;failed=true;render();});
  }
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
      [3,2,1,0].forEach(i=>{
        const label=labels[i];
        const item=document.createElement(ids.length===1?'a':'span');item.className='lcn-effect lcn-effect-'+i;
        if(ids.length===1)item.href=type==='doctor'?`arzt_detail.html?id=${ids[0]}#wirkung`:`therapie_detail.php?treatment_id=${ids[0]}#wirkung`;
        const title=document.createElement('span'),value=document.createElement('strong');title.textContent=label;value.textContent=total?Math.round(values[i]*100/total)+' %':'—';
        item.title=label+': '+values[i]+' von '+total+' Angaben';item.setAttribute('aria-label',label+': '+value.textContent);item.append(title,value);node.append(item);
      });
      const note=document.createElement('small');note.textContent=`N = ${total}`;node.append(note);
    });
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
