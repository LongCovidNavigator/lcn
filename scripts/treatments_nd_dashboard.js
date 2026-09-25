(() => {
  'use strict';
  const dashboard=document.getElementById('nd-dashboard-charts');
  if(!dashboard)return;
  // Mirror the actual charts, including their state; never maintain a second set of answers.
  const sources=[...document.querySelectorAll('.nd-panel:not(#dashboard) .nd-answer, .nd-panel:not(#dashboard) .nd-research-scale, .nd-panel:not(#dashboard) .nd-visual-summary')].filter(node=>node.matches('.nd-research-scale, .nd-visual-summary')||node.querySelector('.effect-chart, .nd-option-table')|| (node.querySelector('.nd-choice-scale')&&node.dataset.answer!=='symptoms'));
  const copies=[];
  for(const panelId of ['termin','zugang','wirkung']){
    const group=document.createElement('section');group.className='nd-dashboard-chart-group';
    const title=document.createElement('h3');title.textContent={termin:'Durchführung und zeitlicher Rahmen',zugang:'Zugang und Kostenübernahme',wirkung:'Erfahrungen mit der Behandlung'}[panelId];group.append(title);
    sources.filter(source=>source.closest('.nd-panel').id===panelId).forEach(source=>{
      const card=document.createElement('section');card.className='card nd-dashboard-chart';
      const host=document.createElement('div');card.append(host);group.append(card);copies.push({source,host});
    });
    if(group.children.length>1)dashboard.append(group);
  }
  function sync(){
    copies.forEach(({source,host})=>{
      const clone=source.cloneNode(true);
      [clone,...clone.querySelectorAll('[id]')].forEach(node=>node.removeAttribute('id'));
      // Copies are updated here, not by the separate chart/dummy renderers.
      [clone,...clone.querySelectorAll('*')].forEach(node=>{
        [...node.attributes].filter(a=>a.name.startsWith('data-')).forEach(a=>node.removeAttribute(a.name));
      });
      const originalControls=[...source.querySelectorAll('input,button')];
      clone.querySelectorAll('input,button').forEach((control,index)=>{
        const original=originalControls[index];
        control.removeAttribute('name');
        if(control.tagName==='INPUT')control.checked=original.checked;
        control.addEventListener('click',event=>{event.preventDefault();original.click();queueMicrotask(sync);});
      });
      // Retain visual selectors without exposing clones as real answer fields.
      if(source.dataset.answer)clone.setAttribute('data-answer',source.dataset.answer);
      if(source.dataset.researchScale)clone.setAttribute('data-research-scale',source.dataset.researchScale);
      host.replaceChildren(clone);
    });
  }
  document.addEventListener('change',event=>{if(!dashboard.contains(event.target))queueMicrotask(sync);});
  document.addEventListener('click',event=>{if(event.target.closest('#nd-demo-header-toggle, #nd-reset-draft, [data-clear-answer], [data-effect-value]')&&!dashboard.contains(event.target))queueMicrotask(sync);});
  sync();
})();
