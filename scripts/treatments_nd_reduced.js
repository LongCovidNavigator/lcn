(() => {
  'use strict';
  const root = document.querySelector('.ux-detail');
  if (!root) return;
  let draft = {}, serverCounts = {}, busy = false;
  const endpoint = 'api/treatment_answer.php';
  const statusNode = document.createElement('p');statusNode.setAttribute('role','status');statusNode.className='ux-test-notice';root.querySelector('#view-content').prepend(statusNode);
  async function sync(payload) {
    if(busy)return;if(payload && demo){statusNode.textContent='Beispieldaten sind eingeschaltet. Zum Bewerten bitte Dummydaten ausschalten.';return;}busy=true;
    root.querySelectorAll('[data-option],[data-clear],[data-segment]').forEach(b=>{b.disabled=true;b.setAttribute('aria-disabled','true');});
    statusNode.textContent=payload?'Antwort wird gespeichert …':'Bewertungen werden geladen …';
    try {
      const response=await fetch(payload?endpoint:endpoint+'?treatment_id='+encodeURIComponent(root.dataset.treatmentId),payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({treatment_id:Number(root.dataset.treatmentId),...payload})}:{cache:'no-store'});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Bewertungen konnten nicht geladen werden.');
      draft=data.own_answers||{};serverCounts=data.counts||{};renderAll();statusNode.textContent=payload?'Deine Änderung wurde gespeichert.':'Bewertungen sind aktuell.';
    }catch(error){statusNode.textContent=error.message+' Deine letzte bestätigte Auswahl bleibt unverändert.';}
    finally{busy=false;root.querySelectorAll('[data-option],[data-clear],[data-segment]').forEach(b=>{b.disabled=false;b.setAttribute('aria-disabled','false');});}
  }
  let demo = new URLSearchParams(location.search).get('demo') === '1';
  const samples = {setting:[82,7,8,3],pem:[42,31,19,8],access:[6,82,12],effect:[14,18,62,6],gamechanger:[43,57],unit_cost:[10,8,12,26,20,10,6,4,4],total_cost:[10,12,18,24,16,8,6,4,2]};
  const questions = [...root.querySelectorAll('[data-question]')];
  const toggle = document.getElementById('nd-demo-header-toggle');
  const number = value => value.toLocaleString('de-DE', {maximumFractionDigits:1});
  function key(card) { return card.dataset.question + (card.querySelector('[data-insurance]') ? ':' + card.querySelector('[data-insurance][aria-pressed="true"]').dataset.insurance : ''); }
  function countsFor(card) {
    const base = demo ? (card.dataset.demoCounts ? JSON.parse(card.dataset.demoCounts) : samples[card.dataset.question]) : (serverCounts[key(card)] || JSON.parse(card.dataset.counts));
    const counts = [...base];
    const own = draft[key(card)];
    const option = [...card.querySelectorAll('[data-option]')].find(button => button.dataset.value === own?.value);
    // Server distributions already include the current respondent.
    return {counts, local: !demo && Boolean(option)};
  }
  function render(card) {
    const id = card.dataset.question, options = [...card.querySelectorAll('[data-option]')];
    const {counts, local} = countsFor(card);
    const total = counts.reduce((a,b)=>a+b,0), own = draft[key(card)];
    card.querySelector('[data-community-note]').textContent = (demo ? 'Dummy-Daten · fiktives Beispiel · ' : 'Community · ') + total + (total === 1 ? ' Angabe' : ' Angaben') + (!total ? ' · Noch keine Bewertungen. Du kannst die erste Angabe machen.' : ' · Anteile aller zugeordneten Antworten') + (local ? ' · inklusive deiner gespeicherten Antwort' : '');
    options.forEach((button,i)=>{
      const percent = total ? counts[Number(button.dataset.option)]*100/total : null;
      button.querySelector('[data-percent]').textContent = percent === null ? '–' : number(percent)+' %';
      button.setAttribute('aria-pressed',String(own?.value === button.dataset.value));
      const bar=button.querySelector('[data-bar]');
      if(bar) bar.style[card.dataset.kind==='effect'?'height':'width']=(percent || 0)+(card.dataset.kind==='effect'?'%':'%');
    });
    card.querySelector('.ux-own').textContent=own?.value ? 'Deine gespeicherte Auswahl: '+own.value : 'Noch keine eigene Auswahl.';
    if(card.dataset.kind==='donut') {
      const yes=total?counts[0]*100/total:0;
      card.querySelector('[data-donut-value]').textContent=total?number(yes)+' %':'–';
      card.querySelectorAll('[data-segment]').forEach((segment,i)=>{
        const share=total?(i===0?yes:100-yes):0;
        segment.style.strokeDasharray=share+' '+(100-share);
        segment.style.strokeDashoffset=i===0?'0':String(-yes);
        segment.style.opacity=share?1:0;
        segment.setAttribute('aria-pressed',String(own?.value===options[i].dataset.value));
        segment.setAttribute('aria-label',options[i].dataset.value+': '+(total?number(share)+' %':'keine Angaben')+' – auswählen');
      });
    }
  }
  questions.forEach(card=>{
    function choose(index) {
      const option=card.querySelector('[data-option="'+index+'"]');
      sync({question:card.dataset.question,context:key(card).split(':')[1]||'',value:option.dataset.value});
    }
    card.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.option)));
    card.querySelectorAll('[data-segment]').forEach(segment=>{
      segment.addEventListener('click',()=>choose(segment.dataset.segment));
      segment.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(segment.dataset.segment);}});
    });
    card.querySelectorAll('[data-insurance]').forEach(button=>button.addEventListener('click',()=>{
      card.querySelectorAll('[data-insurance]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render(card);
    }));
    card.querySelector('[data-clear]').addEventListener('click',()=>sync({action:'clear',question:card.dataset.question,context:key(card).split(':')[1]||''}));
  });
  function renderAll() {
    toggle.textContent='Dummydaten: '+(demo?'an':'aus');toggle.setAttribute('aria-pressed',String(demo));
    document.getElementById('ux-demo-state').textContent=demo?'Alle Diagramme zeigen fiktive Beispieldaten, keine tatsächlichen Behandlungsergebnisse.':'';



    questions.forEach(render);
    const effect = questions.find(card => card.dataset.question === 'effect');
    const summary = root.querySelector('[data-community-summary]');
    if (effect && summary) {
      const {counts, local} = countsFor(effect);
      const total = counts.reduce((a,b) => a+b, 0);
      summary.textContent = total ? (demo ? 'Beispieldaten · ' : '') + total + (total === 1 ? ' Angabe' : ' Angaben') + (local ? ' · inklusive deiner gespeicherten Antwort' : '') + ' →' : 'Noch keine auswertbaren Angaben →';
    }
  }
  toggle.addEventListener('click',()=>{demo=!demo;const url=new URL(location.href);url.searchParams.set('demo',demo?'1':'0');history.replaceState(null,'',url);renderAll();});
  renderAll();
  sync();
})();

