(() => {
  'use strict';
  const root = document.querySelector('.ux-detail');
  if (!root) return;
  const storageKey = 'lcn-nd-reduced-v1-' + root.dataset.treatmentId;
  let draft = {};
  try { draft = JSON.parse(sessionStorage.getItem(storageKey)) || {}; } catch {}
  let demo = new URLSearchParams(location.search).get('demo') === '1';
  const samples = {setting:[82,7,8,3],pem:[42,31,19,8],access:[6,82,12],effect:[14,18,62,6],gamechanger:[43,57],unit_cost:[10,8,12,26,20,10,6,4,4],total_cost:[10,12,18,24,16,8,6,4,2]};
  const questions = [...root.querySelectorAll('[data-question]')];
  const toggle = document.getElementById('nd-demo-header-toggle');
  const number = value => value.toLocaleString('de-DE', {maximumFractionDigits:1});
  function key(card) { return card.dataset.question + (card.querySelector('[data-insurance]') ? ':' + card.querySelector('[data-insurance][aria-pressed="true"]').dataset.insurance : ''); }
  function save() {
    try { sessionStorage.setItem(storageKey,JSON.stringify(draft)); return 'Deine Auswahl ist als Testentwurf in diesem Tab gespeichert.'; }
    catch { return 'Deine Auswahl bleibt nur bis zum Neuladen erhalten; Browser-Speicherung ist nicht verfügbar.'; }
  }
  function render(card) {
    const id = card.dataset.question, options = [...card.querySelectorAll('[data-option]')];
    const counts = demo ? samples[id] : JSON.parse(card.dataset.counts);
    const total = counts.reduce((a,b)=>a+b,0), own = draft[key(card)];
    card.querySelector('[data-community-note]').textContent = (demo ? 'Dummy-Daten · fiktives Beispiel · ' : 'Community · ') + total + ' Angaben' + (!total ? ' · noch keine auswertbare Verteilung' : ' · Anteile aller zugeordneten Antworten');
    options.forEach((button,i)=>{
      const percent = total ? counts[i]*100/total : null;
      button.querySelector('[data-percent]').textContent = percent === null ? '–' : number(percent)+' %';
      button.setAttribute('aria-pressed',String(own?.value === button.dataset.value));
      const bar=button.querySelector('[data-bar]');
      if(bar) bar.style[card.dataset.kind==='effect'?'height':'width']=(percent || 0)+(card.dataset.kind==='effect'?'%':'%');
    });
    const unit=card.querySelector('[data-unit]');
    if(unit && document.activeElement!==unit) unit.value=own?.unit || '';
    card.querySelector('.ux-own').textContent=own?.value ? 'Deine Auswahl: '+own.value+(own.unit?' pro '+own.unit:'')+' · lokaler Testentwurf' : 'Noch keine eigene Auswahl.';
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
      const option=card.querySelector('[data-option="'+index+'"]'), unit=card.querySelector('[data-unit]');
      if(unit && !unit.value.trim() && option.dataset.value!=='nicht anwendbar') {card.querySelector('.ux-own').textContent='Bitte zuerst die Bezugsgröße eingeben.';unit.focus();return;}
      draft[key(card)]={value:option.dataset.value, ...(unit?{unit:unit.value.trim()}:{})};
      const status=save();render(card);card.querySelector('.ux-own').textContent+=' · '+status;
    }
    card.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.option)));
    card.querySelectorAll('[data-segment]').forEach(segment=>{
      segment.addEventListener('click',()=>choose(segment.dataset.segment));
      segment.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(segment.dataset.segment);}});
    });
    card.querySelectorAll('[data-insurance]').forEach(button=>button.addEventListener('click',()=>{
      card.querySelectorAll('[data-insurance]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render(card);
    }));
    card.querySelector('[data-unit]')?.addEventListener('input',event=>{
      if(draft[key(card)]) {draft[key(card)].unit=event.target.value.trim();save();}
    });
    card.querySelector('[data-clear]').addEventListener('click',()=>{delete draft[key(card)];save();render(card);});
  });
  function renderAll() {
    toggle.textContent='Dummydaten: '+(demo?'an':'aus');toggle.setAttribute('aria-pressed',String(demo));
    document.getElementById('ux-demo-state').textContent=demo?'Alle Diagramme zeigen fiktive Beispieldaten, keine Treatment-Ergebnisse.':'';
    questions.forEach(render);
  }
  toggle.addEventListener('click',()=>{demo=!demo;const url=new URL(location.href);url.searchParams.set('demo',demo?'1':'0');history.replaceState(null,'',url);renderAll();});
  renderAll();
})();
