(() => {
  'use strict';
  const root = document.querySelector('.ux-detail');
  if (!root) return;
  let draft = {}, serverCounts = {}, comparisonProfiles = [], symptomHelp = {symptoms:[],catalog:[]}, busy = false, loaded = false;
  const endpoint = 'api/treatment_answer.php';
  const statusNode = document.createElement('p');statusNode.setAttribute('role','status');statusNode.className='ux-test-notice ux-answer-status';root.querySelector('#view-content').prepend(statusNode);
  let feedbackTimer;
  function notify(message,expire=false){clearTimeout(feedbackTimer);statusNode.textContent=message;if(expire)feedbackTimer=setTimeout(()=>{statusNode.textContent='';},4000);}
  async function sync(payload) {
    if(busy || (payload && !loaded))return;busy=true;
    root.querySelectorAll('[data-option],[data-clear],[data-segment],[data-symptom-id],[data-symptom-search],[data-symptom-toggle]').forEach(b=>{b.disabled=true;b.setAttribute('aria-disabled','true');});
    notify(payload?'Wird gespeichert …':'Bewertungen werden geladen …');
    try {
      const response=await fetch(payload?endpoint:endpoint+'?treatment_id='+encodeURIComponent(root.dataset.treatmentId),payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({treatment_id:Number(root.dataset.treatmentId),...payload})}:{cache:'no-store'});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Bewertungen konnten nicht geladen werden.');
      draft=data.own_answers||{};serverCounts=data.counts||{};comparisonProfiles=data.comparison_profiles||[];symptomHelp=data.symptom_help||{symptoms:[],catalog:[]};loaded=true;renderAll();notify(payload?(payload.action==='clear'?'Deine Stimme wurde zurückgenommen.':'Deine Angabe wurde gespeichert.'):'',Boolean(payload));return true;
    }catch(error){notify(error.message+' Deine letzte bestätigte Auswahl bleibt unverändert.');return false;}
    finally{busy=false;root.querySelectorAll('[data-option],[data-clear],[data-segment],[data-symptom-id],[data-symptom-search],[data-symptom-toggle]').forEach(b=>{b.disabled=!loaded;b.setAttribute('aria-disabled',String(!loaded));});filterSymptomPicker();if(!payload&&loaded&&Object.keys(draft).some(k=>(k.startsWith('unit_cost:')||k.startsWith('total_cost:'))&&k.split(':')[1]!==window.LCNCost.context()))sync({action:'move_cost_context',context:window.LCNCost.context()});}
  }
  let demo = new URLSearchParams(location.search).get('demo') === '1';
  const questions = [...root.querySelectorAll('[data-question]')];
  const toggle = document.getElementById('nd-demo-header-toggle');
  const number = value => value.toLocaleString('de-DE', {maximumFractionDigits:1});
  function key(card) { return card.dataset.question + (card.dataset.kind==='cost' ? ':' + window.LCNCost.context() : ''); }
  function displayedCounts(card,contextKey=key(card)) {
    // Real counts already include the saved answer; examples are added only for display.
    const real=serverCounts[contextKey] || (contextKey===key(card)?JSON.parse(card.dataset.counts):[]);
    const sample=demo?comparisonProfiles.find(p=>p.id===Number(root.dataset.treatmentId))?.dummy_counts?.[card.dataset.question]:null;
    return Array.from({length:card.querySelectorAll('[data-option]').length},(_,i)=>Number(real[i]||0)+Number(sample?.[i]||0));
  }
  function countsFor(card) {
    const own=draft[key(card)];
    const option=[...card.querySelectorAll('[data-option]')].find(button=>button.dataset.value===own?.value);
    return {counts:displayedCounts(card),local:Boolean(option)};
  }
  function render(card) {
    const id = card.dataset.question, options = [...card.querySelectorAll('[data-option]')];
    const {counts, local} = countsFor(card);
    const total = counts.reduce((a,b)=>a+b,0), own = draft[key(card)];
    card.querySelector('[data-community-note]').textContent = total ? total + (total === 1 ? ' Angabe' : ' Angaben') : 'Noch keine Community-Angaben';
    options.forEach((button,i)=>{
      const percent = total ? counts[Number(button.dataset.option)]*100/total : null;
      button.querySelector('[data-percent]').textContent = percent === null ? '–' : number(percent)+' %';
      button.setAttribute('aria-pressed',String(own?.value === button.dataset.value));
      const bar=button.querySelector('[data-bar]');
      if(bar) bar.style[card.dataset.kind==='effect'?'height':'width']=(percent || 0)+(card.dataset.kind==='effect'?'%':'%');
    });
    card.querySelector('.ux-own').textContent=own?.value ? 'Deine Auswahl: '+window.LCNCost.amount(own.value.replaceAll('Anbieter','Behandler')) : '';
    if(card.dataset.kind==='donut') {
      const yes=total?counts[0]*100/total:0;
      card.querySelector('[data-donut-value]').textContent=total?number(yes)+' %':'–';
      card.querySelectorAll('[data-segment]').forEach((segment,i)=>{
        const share=total?(i===0?yes:100-yes):0;
        segment.style.strokeDasharray=share+' '+(100-share);
        segment.style.strokeDashoffset=i===0?'0':String(-yes);
        segment.style.opacity=share?1:0;
        const selected=own?.value===options[i].dataset.value;
        segment.style.removeProperty('transform');
        segment.setAttribute('aria-pressed',String(selected));
        segment.setAttribute('aria-label',options[i].dataset.value+': '+(total?number(share)+' %':'keine Angaben')+' – auswählen');
      });
    }
  }
  questions.forEach(card=>{
    function choose(index) {
      const option=card.querySelector('[data-option="'+index+'"]');
      sync({action:draft[key(card)]?.value===option.dataset.value?'clear':'answer',question:card.dataset.question,context:key(card).split(':')[1]||'',value:option.dataset.value});
    }
    card.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.option)));
    card.querySelectorAll('[data-segment]').forEach(segment=>{
      segment.addEventListener('click',()=>choose(segment.dataset.segment));
      segment.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(segment.dataset.segment);}});
    });
    card.querySelectorAll('[data-insurance]').forEach(button=>button.addEventListener('click',()=>{
      card.querySelectorAll('[data-insurance]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render(card);renderSummaries();
    }));

  });

  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const help = {
    pem:'Die Verteilung beschreibt das von der Community berichtete Crash-/PEM-Risiko. Klicke auf eine Stufe, um deine Erfahrung anzugeben.',
    effect:'Subjektive Zustandsveränderung nach der Therapie. Die Verteilung ist kein Wirksamkeitsnachweis. Klicke auf einen Balken, um deine Erfahrung anzugeben.',
    gamechanger:'Hat die Therapie deinen Alltag entscheidend verbessert? Ja und Nein zeigen die Community-Verteilung.',
    unit_cost:'Wie hoch ist dein eigener Kostenanteil pro Anwendung, Packung oder Therapieeinheit? Wähle eine grob passende Stufe. Kostenlos bedeutet, dass keine Kosten anfallen; komplett übernommen bedeutet, dass ein Kostenträger die Kosten trägt.',
    total_cost:'Wie hoch sind deine eigenen Gesamtkosten für diese Therapie bis zum jetzigen Zeitpunkt? Berücksichtige die bisherigen Anwendungen und Ausgaben zusammen. Je nach Dauer, Häufigkeit und Verlauf können sich die Kosten unterscheiden; eine grobe Schätzung genügt.',
    setting:'Wo findet die Therapie statt? Wähle die Form, die auf deine Erfahrung zutrifft: zu Hause, als Hausbesuch, ambulant oder stationär.',
    access:'Wie erhältst du Zugang zur Therapie? Wähle die Möglichkeit, die auf dich zutrifft. Selbstmanagement steht für Maßnahmen, die du eigenständig umsetzen kannst; die anderen Optionen beschreiben den Bezug über Behandler, Verordnung oder Studie.'
  };
  questions.forEach((card,index)=>{
    const heading=card.querySelector('h3'), key=card.dataset.question;
    const detail=document.createElement('span');detail.className='ux-heading-info';
    const summary=document.createElement('button');summary.type='button';summary.textContent='ⓘ';summary.setAttribute('aria-label','Information zu '+heading.textContent);
    const text=document.createElement('p');text.id='therapy-question-help-'+index;text.setAttribute('role','tooltip');summary.setAttribute('aria-describedby',text.id);text.textContent=(help[key]||help.effect)+' Erneutes Anklicken deiner Auswahl nimmt sie zurück.';
    detail.append(summary,text);heading.append(' ',detail);
    if(key==='gamechanger')card.querySelector('h3 + p')?.remove();
    const cardHeading=document.createElement('div');cardHeading.className='ux-question-heading'+(card.dataset.kind==='cost'?' cost-question-heading':'');
    const meta=document.createElement('div');meta.className='ux-question-meta';meta.append(card.querySelector('[data-community-note]'));
    if(card.dataset.kind==='cost')meta.append(card.querySelector('.insurance-toggle'));
    cardHeading.append(heading,meta);card.prepend(cardHeading);
    if(key==='effect'){const node=document.createElement('div');node.dataset.ratingComparison='';card.append(node);}
    if(key==='pem'){const node=document.createElement('div');node.dataset.pemComparison='';card.append(node);}
  });
  function currentCounts(){return Object.fromEntries(questions.map(card=>[key(card),countsFor(card).counts]));}
  function comparison(own,values,label,eligible=true,unit=100,lowerIsBetter=false,referenceRule=null){
    const avg=values.length?values.reduce((n,v)=>n+v,0)/values.length:null;
    const delta=own==null||avg==null?null:own-avg;
    const top=own==null||!values.length?null:Math.max(1,Math.ceil(100*values.filter(v=>lowerIsBetter?v<=own:v>=own).length/values.length));
    return '<div class="score-comparison"><span class="score-comparison-label">'+label+'</span><div class="score-comparison-highlights"><strong>'+(!eligible?'Noch zu wenige Angaben':delta==null?'Noch keine Vergleichsdaten':Math.abs(delta)<.05?'Im Durchschnitt':number(Math.abs(delta))+' Punkte '+(delta>0?'über':'unter')+' dem Durchschnitt')+'</strong>'+(eligible&&top!=null?'<strong class="score-percentile">Top '+top+' %</strong>':'')+'</div><div class="comparison-values">'+(own==null?'Noch keine Angaben.':'<span>Diese Therapie:</span><strong>Ø '+number(own)+' / '+unit+'</strong>')+(avg==null?'':'<span>Durchschnitt:</span><strong>Ø '+number(avg)+' / '+unit+'</strong>')+'</div><small>'+values.length+' andere Therapien · jeweils mindestens zehn auswertbare Antworten'+(referenceRule|| (unit===100?' in über 70 % der Bewertungsfelder':' zur jeweiligen Frage'))+'</small></div>';
  }
  function referenceProfile(profile,context){
    const counts={...profile.counts};
    if(demo)Object.entries(profile.dummy_counts||{}).forEach(([key,values])=>{const field=key+(key.includes('cost')?':'+context:'');const real=counts[field]||[];counts[field]=values.map((n,i)=>Number(n)+Number(real[i]||0));});
    return {...profile,counts};
  }
  function renderSummaries(){
    if(!root.querySelector('[data-treatment-dashboard]'))return;
    const context=window.LCNCost.context();const contextLabel=window.LCNCost.label();
    const counts=currentCounts();
    // Both cost rows use the same context in the overall score.
    ['unit_cost','total_cost'].forEach(k=>{const card=questions.find(c=>c.dataset.question===k);counts[k+':'+context]=displayedCounts(card,k+':'+context);});
    const ownProfile=comparisonProfiles.find(p=>p.id===Number(root.dataset.treatmentId));
    const result=window.lcnTreatmentScore(counts,context,ownProfile?.provider_count??null,root.dataset.independentAtHome==='1');
    const others=comparisonProfiles.filter(p=>p.id!==Number(root.dataset.treatmentId)).map(p=>referenceProfile(p,context));
    const eligible=others.map(p=>window.lcnTreatmentScore(p.counts,context,p.provider_count??null,Boolean(p.independent_at_home))).filter(r=>r.dataCoverage>70);
    const comparisonHtml=comparison(result.score,eligible.map(r=>r.score),'Vergleich mit anderen Therapien',(demo||loaded)&&result.dataCoverage>70);
    const explanations={
      effect:'Verschlechterung: 0 · keine Veränderung: 8,3 · Verbesserung: 16,7 · Heilung: 25 Punkte.',
      pem:'Keines: 20 · niedrig: 13,3 · mittel: 6,7 · hoch: 0 Punkte.',
      gamechanger:'Der Anteil der Ja-Antworten bestimmt den Teilwert: alle Ja = 10 Punkte, alle Nein = 0 Punkte.',
      unit_cost:'Kostenlos und komplett übernommen: 10 Punkte. Höhere Eigenanteile ergeben schrittweise weniger Punkte. „Nicht anwendbar“ wird ausgelassen.',
      total_cost:'Bisherige Gesamtkosten: kostenlos oder komplett übernommen = 10 Punkte. Höhere Eigenanteile ergeben schrittweise weniger Punkte. „Nicht anwendbar“ wird ausgelassen.',
      setting:'Selbstständig zu Hause: 10 · Hausbesuch: 6,7 · ambulant: 3,3 · stationär: 0 Punkte.',
      access:'Selbstmanagement: 10 · frei erhältlich / privater Behandler: 6,7 · ärztliche Verordnung: 3,3 · nur Studie: 0 Punkte.',
      providers:result.rows.find(r=>r.key==='providers').reason
    };
    const rows=result.rows.map(r=>{
      const missing=r.key==='providers'?(root.dataset.independentAtHome==='1'?'Nicht anwendbar bei Selbstmanagement':'Anbieterzahl nicht verfügbar'):r.total===0?'Keine Angaben':'Weniger als zehn Angaben ('+r.total+' von 10)';
      const value=r.value==null?missing:number(r.value*r.weight)+' / '+number(r.weight)+' Punkte';
      const status=r.value==null?'Nicht in die Gesamtauswertung aufgenommen.':'In die Gesamtauswertung aufgenommen.';
      return '<div><strong>'+escape(r.label)+'</strong><span>'+value+'</span><small>'+status+' '+escape(explanations[r.key])+'</small></div>';
    }).join('');
    const explanation='<div class="score-explanation"><p><strong>Bis zu 100 Punkte</strong></p><p>Jeder Community-Bereich zählt ab zehn auswertbaren Antworten. Fehlende Bereiche werden ausgelassen; oben stehen die erreichten Punkte im Verhältnis zu den aktuell bewertbaren Punkten.</p><p>Die Anbieterzahl stammt aus den hinterlegten Zuordnungen. Für den Gesamtvergleich brauchen andere Therapien mindestens fünf von sieben ausreichend beantworteten Community-Feldern. Jede Therapie zählt gleich.</p></div>';
    root.querySelectorAll('[data-treatment-score]').forEach(node=>{
      node.innerHTML='<section class="card dashboard-score"><div class="score-top"><div><h3>Gesamtauswertung</h3></div><strong class="score-number">'+(result.coverage?number(result.earned):'–')+'<small> / '+number(result.coverage)+' Punkte</small></strong></div><div class="score-track"><span style="width:'+(result.score||0)+'%"></span></div><p>Für '+result.available+' von 7 Bereichen liegen ausreichend Angaben vor.</p>'+comparisonHtml+'<p class="field-note">Praktische Orientierung aus subjektiven Erfahrungen, kein Nachweis medizinischer Wirksamkeit oder Eignung.</p>'+(node.dataset.treatmentScore==='overview'?'<a href="#dashboard">Aufschlüsselung im Dashboard →</a>':'<div class="ux-dashboard-insurance-settings"><div class="cost-preferences dashboard-country-preferences">'+window.LCNCost.countryControl()+'</div><div class="insurance-toggle" aria-label="Versicherung für die Gesamtauswertung">'+window.LCNCost.systems[window.LCNCost.get().country].map(([c,label])=>'<button type="button" data-dashboard-context="'+c+'" aria-pressed="'+(c===window.LCNCost.get().insurance)+'">'+label+'</button>').join('')+'</div></div><details><summary>Gewichtung und Teilwerte</summary>'+explanation+'<div class="score-parts">'+rows+'</div></details>')+'</section>';
    });
    const grid=root.querySelector('[data-treatment-dashboard]');
    grid.innerHTML=questions.filter(c=>!c.dataset.question.startsWith('symptom-')).sort((a,b)=>{const order=['setting','access','pem','unit_cost','total_cost','effect','gamechanger'];return order.indexOf(a.dataset.question)-order.indexOf(b.dataset.question);}).map(card=>{
      const chartCounts=card.dataset.kind==='cost'?counts[card.dataset.question+':'+context]:countsFor(card).counts;
      const total=chartCounts.reduce((n,v)=>n+v,0);
      const options=[...card.querySelectorAll('[data-option]')].sort((a,b)=>Number(a.dataset.option)-Number(b.dataset.option));
      const best=total?chartCounts.indexOf(Math.max(...chartCounts)):-1;
      const ties=total?chartCounts.flatMap((v,i)=>v===Math.max(...chartCounts)?[options[i].dataset.value]:[]):[];
      const scoreRow=result.rows.find(row=>row.key===card.dataset.question);
      const percentage=i=>total?chartCounts[i]*100/total:0;
      const stage=i=>!scoreRow?'':scoreRow.scale[i]==null?'–':number(scoreRow.scale[i]*scoreRow.weight)+' P.';
      const label=i=>escape(window.LCNCost.amount(options[i].dataset.value));
      const share=i=>total?number(percentage(i))+' %':'–';
      const points=scoreRow?'<div class="dashboard-points"><strong>'+(scoreRow.value==null?'Noch nicht auswertbar':number(scoreRow.value*scoreRow.weight)+' <small>/ '+number(scoreRow.weight)+' Punkte</small>')+'</strong></div>':'';
      let graphic='';
      if(card.dataset.question==='effect'){
        graphic='<div class="ux-dashboard-effect" role="img" aria-label="Verteilung der Community-Bewertung">'+options.map((_,i)=>'<div><strong>'+share(i)+'</strong><div class="ux-dashboard-bar-area"><span class="effect-'+i+'" style="height:'+percentage(i)+'%"></span></div><span>'+label(i)+'</span><b>'+stage(i)+'</b></div>').join('')+'</div>';
      }else if(card.dataset.kind==='donut'){
        graphic='<div class="ux-dashboard-gamechanger"><div class="ux-dashboard-ring" style="--yes:'+percentage(0)+'%" role="img" aria-label="Gamechanger: '+(total?number(percentage(0))+' Prozent Ja':'noch keine Angaben')+'"><strong>'+(total?number(percentage(0))+' %':'–')+'<small>Ja</small></strong></div><div>'+options.map((_,i)=>'<div class="ux-dashboard-legend"><i style="background:'+(i===0?'#4caf91':'#d2ddeb')+'"></i><span>'+label(i)+'</span><strong>'+share(i)+'</strong><b>'+stage(i)+'</b></div>').join('')+'</div></div>';
      }else if(card.dataset.question==='pem'){
        graphic='<div class="ux-dashboard-risk-blocks">'+options.map((_,i)=>'<div style="--risk-color:'+['#35b891','#f2ca68','#f89976','#ef6b81'][i]+'"><strong>'+share(i)+'</strong><span>'+label(i)+'</span><b>'+stage(i)+'</b></div>').join('')+'</div>';
      }else if(card.dataset.kind==='cost'){
        const order=options.map((_,i)=>i).sort((a,b)=>(card.dataset.kind==='cost'?(a===8?-2:a===9?-1:a):a)-(card.dataset.kind==='cost'?(b===8?-2:b===9?-1:b):b));
        graphic='<div class="ux-dashboard-dots" style="--stages:'+options.length+'">'+order.map(i=>'<div data-stage="'+i+'"'+(total&&chartCounts[i]===Math.max(...chartCounts)?' class="is-community-peak"':'')+'><span class="ux-dashboard-dot-slot"><span class="ux-dashboard-dot" style="--dot-size:'+(10+34*Math.sqrt(percentage(i)/100))+'px;--dot-opacity:'+(0.35+0.65*Math.sqrt(percentage(i)/100))+';--dot-color:'+(card.dataset.question==='pem'?['#4caf91','#b6d994','#e6c383','#e798a7'][i]:'#2486df')+'"></span></span><strong>'+share(i)+'</strong><span>'+label(i)+'</span><b>'+stage(i)+'</b></div>').join('')+'</div>';
      }else{
        const order=options.map((_,i)=>i).sort((a,b)=>(card.dataset.question==='access'?(a===3?-1:a):a)-(card.dataset.question==='access'?(b===3?-1:b):b));
        graphic='<div class="ux-dashboard-rows">'+order.map(i=>'<div><span>'+label(i)+'</span><div class="dashboard-track"><span style="width:'+percentage(i)+'%"></span></div><strong>'+share(i)+'</strong><b>'+stage(i)+'</b></div>').join('')+'</div>';
      }
      return '<section class="card ux-dashboard-card" data-dashboard-question="'+card.dataset.question+'"><div class="assessment-header"><h3>'+escape(card.querySelector('h3').childNodes[0].textContent)+'</h3><span class="assessment-count">'+(total?total+' Angaben':'Noch keine Community-Angaben')+'</span></div>'+points+graphic+(scoreRow?'<p class="ux-dashboard-score-note">'+(scoreRow.total<10?'Punktwert ab zehn auswertbaren Angaben.':'Die Community-Anteile gewichten die dargestellten Stufenwerte.')+'</p>':'')+'<a class="dashboard-detail" href="#'+card.closest('.nd-panel').id+'">Details ansehen →</a></section>';
    }).join('');
    const providerRow=result.rows.find(r=>r.key==='providers');
    const providerScale=providerRow.value==null?'':'<div class="ux-provider-scale"><div class="ux-provider-progress" role="progressbar" aria-label="Anbieterzahl: volle fünf Punkte ab zehn Anbietern" aria-valuemin="0" aria-valuemax="10" aria-valuenow="'+Math.min(providerRow.providerCount,10)+'" aria-valuetext="'+providerRow.providerCount+' Anbieter, '+number(providerRow.value*5)+' von 5 Punkten"><span style="width:'+providerRow.value*100+'%"></span></div><div class="ux-provider-scale-ticks">'+[0,2,4,6,8,10].map(n=>'<div class="'+(providerRow.providerCount>=n?'is-reached':'')+'"><strong>'+n+(n===10?'+':'')+'</strong><small>'+number(n/2)+' P.</small></div>').join('')+'</div><p>Ab 10 Anbietern: volle 5 Punkte</p></div>';
    grid.insertAdjacentHTML('beforeend','<section class="card ux-dashboard-card" data-dashboard-question="providers"><h3>Erfasste Anbieter</h3><div class="dashboard-points"><strong>'+(providerRow.value==null?'Nicht gewertet':number(providerRow.value*providerRow.weight)+' <small>/ 5 Punkte</small>')+'</strong></div><strong class="dashboard-result">'+(providerRow.providerCount==null?'Anbieterzahl nicht verfügbar':providerRow.providerCount+' Anbieter')+'</strong>'+providerScale+'<p class="ux-dashboard-score-note">'+escape(providerRow.reason)+'</p><a class="dashboard-detail" href="#termin">Standorte und Anbieter ansehen →</a></section>');
    const rating=result.rows.find(r=>r.key==='effect');
    const values=others.map(p=>window.lcnTreatmentScore(p.counts,context,p.provider_count??null,Boolean(p.independent_at_home)).rows[0]).filter(r=>r.value!=null).map(r=>1+3*r.value);
    root.querySelector('[data-rating-comparison]').innerHTML=comparison(rating.value==null?null:1+3*rating.value,values,'Community-Bewertung im Vergleich',(demo||loaded)&&rating.total>=10,4)+'<p class="field-note">Skala 1–4: Verschlechterung bis Heilung. Vergleich mit anderen Therapien ab zehn Bewertungen je Therapie; jede Therapie zählt gleich.</p>';
    const gamechanger=result.rows.find(r=>r.key==='gamechanger');
    const gameValues=others.map(p=>window.lcnTreatmentScore(p.counts,context,p.provider_count??null,Boolean(p.independent_at_home)).rows.find(r=>r.key==='gamechanger')).filter(r=>r.value!=null).map(r=>100*r.value);
    const gameCard=questions.find(card=>card.dataset.question==='gamechanger');
    if(gameCard){
      let target=gameCard.querySelector('[data-gamechanger-comparison]');
      if(!target){const layout=document.createElement('div');layout.className='ux-gamechanger-layout';const left=document.createElement('div');left.className='ux-gamechanger-answer';target=document.createElement('div');target.dataset.gamechangerComparison='';const chart=gameCard.querySelector('.ux-chart');chart.before(layout);left.append(chart,gameCard.querySelector('.ux-own'));layout.append(left,target);}
      target.innerHTML=comparison(gamechanger.value==null?null:100*gamechanger.value,gameValues,'Gamechanger im Vergleich',(demo||loaded)&&gamechanger.total>=10,100,false,' zur Gamechanger-Frage').replaceAll('Punkte ','Prozentpunkte ').replaceAll(' / 100',' %')+'<p class="field-note">Anteil der Ja-Antworten. Vergleich mit allen anderen Therapien ab zehn Gamechanger-Antworten; jede Therapie zählt gleich.</p>';
    }
    const pem=result.rows.find(r=>r.key==='pem');
    const pemValues=others.map(p=>window.lcnTreatmentScore(p.counts,context,p.provider_count??null,Boolean(p.independent_at_home)).rows.find(r=>r.key==='pem')).filter(r=>r.value!=null).map(r=>4-3*r.value);
    root.querySelector('[data-pem-comparison]').innerHTML=comparison(pem.value==null?null:4-3*pem.value,pemValues,'Crash-/PEM-Risiko im Vergleich',(demo||loaded)&&pem.total>=10,4,true)+'<p class="field-note">Skala 1–4: keines bis hohes Risiko. Niedrigere Werte bedeuten weniger berichtetes Risiko. Vergleich ab zehn Angaben je Therapie; jede Therapie zählt gleich.</p>';
  }
  async function changeCostPreferences(patch){if(busy)return;const previous=window.LCNCost.get(),before=window.LCNCost.context();window.LCNCost.set(patch);const context=window.LCNCost.context();if(before!==context&&Object.keys(draft).some(k=>k.startsWith('unit_cost:')||k.startsWith('total_cost:'))){if(!await sync({action:'move_cost_context',context}))window.LCNCost.set(previous);}renderAll();}
  root.addEventListener('click',event=>{const button=event.target.closest('[data-dashboard-context]');if(button)changeCostPreferences({insurance:button.dataset.dashboardContext});});

  function renderCostControls(){
    questions.filter(card=>card.dataset.kind==='cost').forEach(card=>{
      let heading=card.querySelector('.cost-question-heading');if(!heading){heading=document.createElement('div');heading.className='cost-question-heading';card.prepend(heading);heading.append(card.querySelector('h3'),card.querySelector('.insurance-toggle'));}
      let preferences=card.querySelector('.cost-preferences');
      if(!preferences){preferences=document.createElement('div');preferences.className='cost-preferences';card.append(preferences);}
      const prefs=window.LCNCost.get();
      preferences.innerHTML=window.LCNCost.countryControl()+window.LCNCost.currencyControl();
      card.querySelector('.insurance-toggle').innerHTML=window.LCNCost.systems[prefs.country].map(([v,label])=>'<button type="button" data-cost-insurance="'+v+'" aria-pressed="'+(v===prefs.insurance)+'">'+label+'</button>').join('');
      card.querySelectorAll('[data-option]').forEach(button=>{const label=button.querySelector('span:last-of-type');label.textContent=window.LCNCost.amount(button.dataset.value);let conversion=button.querySelector('.cost-converted');if(!conversion){conversion=document.createElement('small');conversion.className='cost-converted';button.append(conversion);}conversion.textContent=window.LCNCost.converted(button.dataset.value);});
      let note=card.querySelector('.cost-currency-note');if(!note){note=document.createElement('p');note.className='cost-currency-note';card.append(note);}note.textContent=window.LCNCost.rateNote();preferences.append(note);
      let footer=card.querySelector('.cost-answer-footer');if(!footer){footer=document.createElement('div');footer.className='cost-answer-footer';card.append(footer);}footer.append(card.querySelector('.ux-own'),preferences);
    });
  }
  root.addEventListener('change',event=>{if(busy)return;const target=event.target;if(target.matches('[data-cost-country]'))changeCostPreferences({country:target.value});else if(target.matches('[data-cost-currency]'))changeCostPreferences({currency:target.value});});
  root.addEventListener('click',event=>{const button=event.target.closest('[data-cost-insurance]');if(!button||busy)return;changeCostPreferences({insurance:button.dataset.costInsurance});});
  let symptomSearch='',symptomOpen=false,symptomActive=-1;
  function closeSymptomPicker(){symptomOpen=false;symptomActive=-1;filterSymptomPicker();}
  function filterSymptomPicker(){
    const picker=root.querySelector('[data-symptom-picker]'),input=root.querySelector('[data-symptom-search]'),toggle=root.querySelector('[data-symptom-toggle]');if(!picker||!input)return;
    const ids=new Set(symptomHelp.symptoms.map(r=>r.id));
    const matches=window.LCNSymptomSearch.search(symptomHelp.catalog.filter(s=>!ids.has(s.id)),symptomSearch);
    picker.replaceChildren();input.disabled=toggle.disabled=busy||!loaded;picker.hidden=!symptomOpen;input.setAttribute('aria-expanded',String(symptomOpen));toggle.setAttribute('aria-expanded',String(symptomOpen));input.removeAttribute('aria-activedescendant');
    if(symptomActive>=matches.length)symptomActive=-1;
    matches.forEach((symptom,i)=>{const option=document.createElement('button');option.type='button';option.id='symptom-option-'+symptom.id;option.dataset.symptomSuggestion=String(symptom.id);option.setAttribute('role','option');option.setAttribute('aria-selected',String(i===symptomActive));option.tabIndex=-1;option.textContent=symptom.name;option.disabled=busy||!loaded;picker.append(option);if(i===symptomActive)input.setAttribute('aria-activedescendant',option.id);});
    if(!matches.length){const empty=document.createElement('p');empty.textContent='Keine passenden weiteren Symptome';empty.setAttribute('role','status');picker.append(empty);}
  }
  function selectSymptom(id){if(busy||!loaded)return;symptomSearch='';root.querySelector('[data-symptom-search]').value='';closeSymptomPicker();sync({question:'symptom-help-'+id,value:'Ja'});}
  root.addEventListener('input',event=>{if(!event.target.matches('[data-symptom-search]'))return;symptomSearch=event.target.value;symptomOpen=true;symptomActive=-1;filterSymptomPicker();});
  root.addEventListener('click',event=>{if(event.target.matches('[data-symptom-search]')){symptomOpen=true;filterSymptomPicker();}const toggle=event.target.closest('[data-symptom-toggle]');if(toggle){symptomOpen=!symptomOpen;filterSymptomPicker();root.querySelector('[data-symptom-search]').focus();}const option=event.target.closest('[data-symptom-suggestion]');if(option)selectSymptom(option.dataset.symptomSuggestion);});
  root.addEventListener('keydown',event=>{if(!event.target.matches('[data-symptom-search]'))return;if(event.key==='Escape'){closeSymptomPicker();return;}if(event.key==='Tab'){closeSymptomPicker();return;}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();symptomOpen=true;const count=root.querySelectorAll('[data-symptom-suggestion]').length;symptomActive=count?(symptomActive+(event.key==='ArrowDown'?1:-1)+count)%count:-1;filterSymptomPicker();root.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'){event.preventDefault();const option=root.querySelector('[role="option"][aria-selected="true"]');if(option)selectSymptom(option.dataset.symptomSuggestion);}});
  document.addEventListener('click',event=>{if(!event.target.closest('[data-symptom-combobox]'))closeSymptomPicker();});
  function renderSymptomHelp(){
    const list=root.querySelector('[data-symptom-ranking]'),picker=root.querySelector('[data-symptom-picker]');
    if(!list||!picker)return;
    const focused=document.activeElement?.dataset.symptomId;
    const rows=symptomHelp.symptoms.map(symptom=>({...symptom,count:symptom.count+(demo&&symptom.editorial?(symptom.id*7)%31:0)})).sort((a,b)=>b.count-a.count||Number(b.editorial)-Number(a.editorial)||a.name.localeCompare(b.name,'de'));
    list.replaceChildren();
    rows.forEach(symptom=>{
      const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.symptomId=String(symptom.id);button.setAttribute('aria-pressed',String(symptom.selected));button.disabled=busy||!loaded;
      const label=document.createElement('span');label.textContent=symptom.name;
      const count=document.createElement('strong');count.textContent=symptom.count+' '+(symptom.count===1?'Person':'Personen');
      const check=document.createElement('span');check.className='ux-symptom-check';check.textContent=symptom.selected?'✓':'＋';check.setAttribute('aria-hidden','true');
      button.setAttribute('aria-label',symptom.name+': '+symptom.count+' hilfreiche Erfahrungen'+(symptom.selected?' – eigene Stimme zurücknehmen':' – hat mir geholfen'));
      button.append(label,count,check);li.append(button);list.append(li);
    });
    if(!rows.length){const empty=document.createElement('li');empty.className='ux-symptom-empty';empty.textContent=loaded?'Wähle unten ein Symptom aus, bei dem dir die Therapie geholfen hat.':'Symptome werden geladen …';list.append(empty);}
    filterSymptomPicker();
    if(focused)list.querySelector('[data-symptom-id="'+focused+'"]')?.focus({preventScroll:true});
  }
  root.addEventListener('click',event=>{const button=event.target.closest('[data-symptom-id]');if(!button||busy||!loaded)return;const symptom=symptomHelp.symptoms.find(s=>s.id===Number(button.dataset.symptomId));if(!symptom)return;sync({action:symptom.selected?'clear':'answer',question:'symptom-help-'+symptom.id,value:'Ja'});});
  function renderAll() {
    renderCostControls();
    toggle.textContent='Dummy-Daten sind '+(demo?'an':'aus');toggle.setAttribute('aria-pressed',String(demo));




    questions.forEach(render);renderSummaries();renderSymptomHelp();
    const effect = questions.find(card => card.dataset.question === 'effect');
    const summary = root.querySelector('[data-community-summary]');
    if (effect && summary) {
      const {counts, local} = countsFor(effect);
      const total = counts.reduce((a,b) => a+b, 0);
      summary.textContent = 'Community-Bewertungen ansehen →';
    }
  }
  toggle.addEventListener('click',()=>{if(busy)return;demo=!demo;const url=new URL(location.href);url.searchParams.set('demo',demo?'1':'0');history.replaceState(null,'',url);renderAll();});
  window.addEventListener('lcn-online-ready',()=>renderAll());
  window.addEventListener('lcn-exchange-rates',()=>{renderCostControls();});
  renderAll();
  sync();
})();

