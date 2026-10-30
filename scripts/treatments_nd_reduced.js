(() => {
  'use strict';
  const root = document.querySelector('.ux-detail');
  if (!root) return;
  let draft = {}, serverCounts = {}, comparisonProfiles = [], symptomHelp = {symptoms:[],catalog:[]}, busy = false, loaded = false;
  const endpoint = 'api/treatment_answer.php';
  const statusNode = document.createElement('p');statusNode.setAttribute('role','status');statusNode.className='ux-test-notice ux-answer-status';root.querySelector('#view-content').prepend(statusNode);
  let feedbackTimer;
  function notify(message,expire=false){clearTimeout(feedbackTimer);statusNode.textContent=message;if(expire)feedbackTimer=setTimeout(()=>{statusNode.textContent='';},2000);}
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
  let demo = window.LCNDummy.get();
  const questions = [...root.querySelectorAll('[data-question]')];
  const toggle = document.getElementById('nd-demo-header-toggle');
  const initialUpper = value => value.replace(/^\p{L}/u, letter => letter.toLocaleUpperCase('de-DE'));
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
      if(bar) bar.style[card.dataset.kind==='effect'||id==='access'?'height':'width']=(percent || 0)+'%';
    });
    const ownSummary=card.querySelector('.ux-own');
    ownSummary.textContent='';
    ownSummary.hidden=true;
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
    pem:'Wie hoch ist das Crash-/PEM-Risiko bei dieser Therapie? Wähle die Stufe, die auf deine Erfahrung zutrifft. Die Verteilung zeigt die Angaben der Community zu einer Verschlechterung nach Belastung.',
    effect:'Wie hat sich dein Zustand durch die Therapie verändert? Wähle die Bewertung, die auf deine Erfahrung zutrifft. Die Verteilung zeigt subjektive Erfahrungen der Community und ist kein Wirksamkeitsnachweis.',
    gamechanger:'War die Therapie für dich ein Gamechanger, hat sie also deinen Alltag entscheidend verbessert? Wähle die Antwort, die auf deine Erfahrung zutrifft. Die Verteilung zeigt die Antworten der Community.',
    unit_cost:'Wie hoch ist dein eigener Kostenanteil pro Anwendung, Packung oder Therapieeinheit? Wähle eine grob passende Stufe.',
    total_cost:'Wie hoch sind deine eigenen Gesamtkosten für diese Therapie bis zum jetzigen Zeitpunkt? Berücksichtige die bisherigen Anwendungen und Ausgaben zusammen. Je nach Dauer, Häufigkeit und Verlauf können sich die Kosten unterscheiden; eine grobe Schätzung genügt.',
    setting:'Wo findet die Therapie statt? Wähle das Setting, das auf deine Erfahrung zutrifft.',
    access:'Wie erhältst du Zugang zur Therapie? Wähle den Zugang, der auf deine Erfahrung zutrifft.'
  };
  let helpSequence = 0;
  function helpMarkup(title, text) {
    const id = 'therapy-section-help-' + ++helpSequence;
    return '<span class="ux-heading-info"><button type="button" aria-label="'+escape('Information zu '+title)+'" aria-describedby="'+id+'">ⓘ</button><p id="'+id+'" role="tooltip">'+escape(text)+'</p></span>';
  }
  function appendHelp(heading, text) {
    if (heading && !heading.querySelector('.ux-heading-info')) heading.insertAdjacentHTML('beforeend', ' '+helpMarkup(heading.textContent.trim(), text));
  }
  questions.forEach((card,index)=>{
    const heading=card.querySelector('h3'), key=card.dataset.question;
    appendHelp(heading,help[key]+' Erneutes Anklicken deiner Auswahl nimmt sie zurück.');
    if(key==='gamechanger')card.querySelector('h3 + p')?.remove();
    const cardHeading=document.createElement('div');cardHeading.className='ux-question-heading'+(card.dataset.kind==='cost'?' cost-question-heading':'');
    const meta=document.createElement('div');meta.className='ux-question-meta';meta.append(card.querySelector('[data-community-note]'));
    if(card.dataset.kind==='cost')meta.append(card.querySelector('.insurance-toggle'));
    cardHeading.append(heading,meta);card.prepend(cardHeading);
    if(key==='effect'){const node=document.createElement('div');node.dataset.ratingComparison='';card.append(node);}
    if(key==='pem'){const node=document.createElement('div');node.dataset.pemComparison='';card.append(node);}
  });
  appendHelp(root.querySelector('.card:has(>.nd-provider-map)>h3'), 'Wo findest du Behandler für diese Therapie? Gib deinen Ausgangsort ein und übernimm ihn mit Enter oder einem Suchvorschlag. Du kannst die Behandler nach Ort und Radius filtern. Die Karte zeigt gespeicherte Hauptstandorte; Entfernungen sind Luftlinien. Vorläufige Zuordnungen sind gekennzeichnet.');
  appendHelp(root.querySelector('#symptom-help-heading'), 'Bei welchen Symptomen hat dir die Therapie geholfen? Wähle die passenden Symptome aus oder ergänze eines über die Suche. Erneutes Anklicken deiner Auswahl nimmt sie zurück.');
  function currentCounts(){return Object.fromEntries(questions.map(card=>[key(card),countsFor(card).counts]));}
  function topPercentLabel(percent){
    if(percent==null)return null;
    if(percent<1)return percent<=0?'unter 0,01':(Math.ceil(percent*100)/100).toLocaleString('de-DE',{maximumFractionDigits:2});
    return String([1,3,5,10,20,30,40,50,60,80,100].find(step=>percent<=step));
  }
  function relativeRank(own,values,lowerIsBetter=false){
    if(own==null||!values.length)return null;
    // Midranks keep equal scores together, including a completely tied group.
    const better=values.filter(value=>lowerIsBetter?value<own:value>own).length;
    const equal=values.filter(value=>value===own).length;
    return 100*(better+(equal+1)/2)/(values.length+1);
  }
  function relativeScoreLevel(rank){
    return rank<=20?4:rank<=40?3:rank<=60?2:rank<=80?1:0;
  }
  function comparison(own,values,label,eligible=true,unit=100,lowerIsBetter=false,referenceRule=null,classificationHtml=''){
    const avg=values.length?values.reduce((n,v)=>n+v,0)/values.length:null;
    const delta=own==null||avg==null?null:own-avg;
    const rank=relativeRank(own,values,lowerIsBetter);
    const top=topPercentLabel(rank);
    const badgeLevel=rank!=null?' score-percentile-level-'+relativeScoreLevel(rank):'';
    const basis=classificationHtml?'':'<details class="comparison-basis"><summary>Weitere Infos</summary>'+comparisonExplanation({dataCoverage:100,score:own},values,eligible)+comparisonOrientation+'</details>';
    return '<div class="score-comparison'+(classificationHtml?' score-comparison-overall':'')+'"><span class="score-comparison-label">'+label+'</span><div class="score-comparison-highlights">'+(classificationHtml?'':'<strong>'+(!eligible?'Noch zu wenige Angaben':delta==null?'Noch keine Vergleichsdaten':Math.abs(delta)<.05?'Im Durchschnitt':number(Math.abs(delta))+' Punkte '+(delta>0?'über':'unter')+' dem Durchschnitt')+'</strong>')+(!classificationHtml&&eligible&&top!=null?'<strong class="score-percentile'+badgeLevel+'">Top '+top+' %</strong>':'')+'</div>'+(classificationHtml?'':'<div class="comparison-values">'+(own==null?'Noch keine Angaben.':'<span>Diese Therapie:</span><strong>'+number(own)+' / '+unit+'</strong>')+(avg==null?'':'<span>Durchschnitt:</span><strong>'+number(avg)+' / '+unit+'</strong>')+'</div>')+classificationHtml+basis+'</div>';
  }
  function referenceProfile(profile,context){
    const counts={...profile.counts};
    if(demo)Object.entries(profile.dummy_counts||{}).forEach(([key,values])=>{const field=key+(key.includes('cost')?':'+context:'');const real=counts[field]||[];counts[field]=values.map((n,i)=>Number(n)+Number(real[i]||0));});
    return {...profile,counts};
  }
  let gamechangerReference=[];
  function scoreProfile(profile,counts,context){
    let origin=null;try{origin=JSON.parse(localStorage.getItem('lcn_shared_location_preference'));}catch{}
    const valid=v=>v&&v.lat!=null&&v.lng!=null&&Number.isFinite(Number(v.lat))&&Number.isFinite(Number(v.lng))&&Math.abs(Number(v.lat))<=90&&Math.abs(Number(v.lng))<=180;
    const providers=profile?.providers||[];
    const distances=valid(origin)?providers.filter(valid).map(p=>{const rad=v=>Number(v)*Math.PI/180,h=Math.sin(rad(p.lat-origin.lat)/2)**2+Math.cos(rad(origin.lat))*Math.cos(rad(p.lat))*Math.sin(rad(p.lng-origin.lng)/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));}):[];
    const independent=Boolean(profile?.independent_at_home);
    const atHome=independent||Boolean(profile?.home_delivery);
    const prescriptionRequired=Boolean(profile?.prescription_required);
    const oneOffPrescription=atHome&&prescriptionRequired;
    const remote=Boolean(profile?.online_at_home)||Boolean(atHome&&providers.some(p=>p.home_visit||window.LCNOnline?.get(p.id)?.complete));
    const noTravel=Boolean(profile?.home_visit_setting)||remote||(atHome&&(independent||profile?.freely_available)&&!prescriptionRequired);
    const result=window.lcnTreatmentScore(counts,context,null,independent,{distance:distances.length?Math.min(...distances):null,noTravel,prescriptionRequired,oneOffPrescription},gamechangerReference.filter(p=>p.id!==profile?.id).map(p=>p.value));
    const travel=result.rows.find(row=>row.key==='distance');
    if(travel.value==null)travel.reason=!valid(origin)?'Bitte deinen Ausgangsort unter Standorte eingeben. Danach werden Entfernung und Punkte automatisch berechnet.':'Für diese Therapie ist noch kein bestätigter Anbieter mit gültigen Koordinaten hinterlegt.';
    return result;
  }
  function comparisonRange(own,values){
    const sorted=[...values,own].filter(Number.isFinite).sort((a,b)=>a-b);
    if(!sorted.length)return null;
    const min=sorted[0],max=sorted[sorted.length-1];
    const quantile=fraction=>{const i=(sorted.length-1)*fraction,low=Math.floor(i);return sorted[low]+(sorted[Math.ceil(i)]-sorted[low])*(i-low);};
    return {min,max,cuts:[min,...[.2,.4,.6,.8].map(quantile),max],position:value=>max===min?50:100*(value-min)/(max-min)};
  }
  const wholePoints=value=>String(Math.round(value));
  function rankPreview(own,values){
    const rank=relativeRank(own,values);
    if(rank==null)return '';
    const range=comparisonRange(own,values),level=relativeScoreLevel(rank),top=topPercentLabel(rank);
    const labels=['Deutlich weniger passend','Weniger passend','Durchschnittlich passend','Passend','Sehr passend'];
    const widths=range.max===range.min?[20,20,20,20,20]:range.cuts.slice(1).map((cut,i)=>100*(cut-range.cuts[i])/(range.max-range.min));
    const position=range.position(own);
    // The full precision controls position and classification; only displayed points are rounded.
    const ticks=range.cuts.map((value,i)=>({value,position:range.position(value),i})).filter((tick,i,all)=>i===0||i===5||(tick.position-all[i-1].position>=8&&100-tick.position>=8));
    const legend=[4,3,2,1,0].map(i=>'<div class="therapy-precise-legend-row'+(i===level?' is-current':'')+'"><i class="score-level-'+i+'" aria-hidden="true"></i><span class="therapy-precise-name">'+labels[i]+'</span><span class="therapy-precise-tier"><span>Top</span> <span class="therapy-precise-tier-number">'+(100-i*20)+'</span> <span>%</span></span><span class="therapy-precise-range"><span>'+wholePoints(range.cuts[i])+'</span><span aria-hidden="true">–</span><span>'+wholePoints(range.cuts[i+1])+'</span></span><span class="therapy-precise-unit">Punkte</span></div>').join('');
    return '<figure class="therapy-precise-chart" aria-label="'+labels[level]+', '+wholePoints(own)+' Punkte im Therapievergleich"><div class="therapy-precise-pin-row"><div class="therapy-precise-pin" style="--position:'+position+'%;--label-position:'+Math.max(16,Math.min(84,position))+'%"><small>Diese Therapie</small>'+(top!=null?'<strong class="therapy-final-top score-percentile-level-'+level+'">Top '+top+' %</strong>':'<strong>'+labels[level]+'</strong>')+'</div><i class="therapy-precise-pointer" style="left:'+position+'%" aria-hidden="true"></i></div><div class="therapy-precise-band" aria-hidden="true">'+widths.map((width,i)=>'<span class="score-level-'+i+'" style="width:'+width+'%"></span>').join('')+'</div><div class="therapy-precise-axis">'+ticks.map(tick=>'<span class="'+(tick.i===0?'is-first':tick.i===5?'is-last':'is-inner')+'" style="left:'+tick.position+'%">'+wholePoints(tick.value)+'</span>').join('')+'</div></figure><div class="therapy-precise-legend" aria-label="Passungsstufen von sehr passend bis deutlich weniger passend">'+legend+'</div>';
  }
  function scoreClassification(result,values,ready) {
    const valid=ready&&result.dataCoverage>70&&result.score!=null&&values.length;
    const range=valid?comparisonRange(result.score,values):null;
    const average=valid?values.reduce((sum,value)=>sum+value,0)/values.length:null;
    return '<section class="therapy-final-comparison therapy-precise-comparison"><h3>'+(valid?'Vergleich mit anderen Therapien':'Gesamtauswertung')+' '+helpMarkup('Gesamtauswertung','Wie schneidet diese Therapie im Vergleich zu anderen Therapien ab? Die Gesamtauswertung fasst Belastung, Zugang und Erfahrungen zusammen. Punkte und Rang zeigen die relative Einordnung; unter Weitere Infos findest du die Berechnungsgrundlage.')+'</h3><div class="therapy-precise-summary"><div><span>Gesamtauswertung</span><strong class="score-number">'+(result.coverage?wholePoints(result.earned):'–')+'<small> / '+wholePoints(result.coverage)+' Punkte</small></strong></div>'+(valid?'<dl><div><dt>Minimum</dt><dd>'+wholePoints(range.min)+'</dd></div><div><dt>Durchschnitt</dt><dd>'+wholePoints(average)+'</dd></div><div><dt>Maximum</dt><dd>'+wholePoints(range.max)+'</dd></div></dl>':'')+'</div>'+(valid?rankPreview(result.score,values):'<div class="score-track" role="img" aria-label="'+(result.coverage?wholePoints(result.earned)+' von '+wholePoints(result.coverage)+' auswertbaren Punkten':'Noch keine auswertbaren Punkte')+'"><span style="width:'+(result.score||0)+'%"></span></div><p class="field-note">Für einen Therapievergleich liegen noch nicht genügend Angaben vor.</p>')+'</section>';
  }

  const comparisonOrientation='<p class="field-note therapy-orientation-note">Praktische Orientierung aus subjektiven Erfahrungen, kein Nachweis medizinischer Wirksamkeit oder Eignung.</p>';
  function comparisonExplanation(result,values,ready){
    const valid=ready&&result.dataCoverage>70&&result.score!=null&&values.length>0;
    return '<p class="field-note therapy-final-explanation">'+(valid?'Ausgewertet wird das Abschneiden dieser Therapie im Vergleich zu allen anderen relevanten, bewerteten Therapien. Maßgeblich ist die relative Einordnung, nicht die absolute Punktzahl. ':'')+'Wir vergleichen nur Therapien, zu denen genügend Erfahrungswerte vorliegen: '+values.length+' andere '+(values.length===1?'Therapie':'Therapien')+' mit ausreichend Community-Angaben.</p>';
  }

  function renderSummaries(){
    if(!root.querySelector('[data-treatment-dashboard]'))return;
    const context=window.LCNCost.context();const contextLabel=window.LCNCost.label();
    const counts=currentCounts();
    // Both cost rows use the same context in the overall score.
    ['unit_cost','total_cost'].forEach(k=>{const card=questions.find(c=>c.dataset.question===k);counts[k+':'+context]=displayedCounts(card,k+':'+context);});
    const ownProfile=comparisonProfiles.find(p=>p.id===Number(root.dataset.treatmentId));
    gamechangerReference=comparisonProfiles.map(profile=>{
      const values=profile.id===Number(root.dataset.treatmentId)?counts.gamechanger:referenceProfile(profile,context).counts.gamechanger;
      const total=(values||[]).reduce((sum,n)=>sum+Number(n||0),0);
      return {id:profile.id,value:total>=10?Number(values[0]||0)/total:null};
    }).filter(profile=>profile.value!=null);
    const result=scoreProfile(ownProfile||{id:Number(root.dataset.treatmentId),independent_at_home:root.dataset.independentAtHome==='1'},counts,context);
    const others=comparisonProfiles.filter(p=>p.id!==Number(root.dataset.treatmentId)).map(p=>referenceProfile(p,context));
    const eligible=others.map(p=>scoreProfile(p,p.counts,context)).filter(r=>r.dataCoverage>70);
    const comparisonValues=eligible.map(r=>r.score);
    const comparisonReady=(demo||loaded)&&result.dataCoverage>70;

    const weightedRule='Für jede Antwort berechnen wir einen gewichteten Beitrag: Dazu multiplizieren wir den Stufenwert der Antwort mit dem prozentualen Anteil dieser Antwort. Die Summe aller Beiträge ergibt den Teilwert.';
    const costRule=weightedRule+' Antworten mit „nicht anwendbar“ werden dabei nicht mitgerechnet. Die Stufenwerte und gewichteten Beiträge stehen in der Tabelle.';
    const costSelectionHelp='<details class="therapy-calculation-help therapy-cost-selection-info"><summary>Wie wird der Wert ermittelt?</summary><div class="therapy-calculation-cases"><section><strong>Welche Kostenbasis verwenden wir?</strong><p>Grundsätzlich verwenden wir die Gesamtkosten. Sind diese nicht auswertbar oder ist die Datengrundlage für die Kosten pro Therapieeinheit fundierter, verwenden wir stattdessen die Kosten pro Therapieeinheit. Der ausgewählte Kostenwert fließt mit höchstens 20 Punkten in die Gesamtbewertung ein. Für jede Antwort berechnen wir einen gewichteten Beitrag, indem wir den Stufenwert der Antwort mit dem prozentualen Anteil dieser Antwort multiplizieren. Die Summe dieser Beiträge ergibt den Kostenwert. Antworten mit „nicht anwendbar“ werden dabei nicht mitgerechnet.</p></section><section><strong>Wann wechseln wir zu den Kosten pro Therapieeinheit?</strong><p>Dafür müssen mindestens zehn auswertbare Antworten zu den Kosten pro Therapieeinheit vorliegen. Zusätzlich muss mindestens einer dieser Fälle zutreffen:</p><ul><li>Zu den Gesamtkosten liegen weniger als zehn auswertbare Antworten vor.</li><li>Bei den Gesamtkosten gibt es mehr Antworten „nicht anwendbar“ als auswertbare Antworten.</li><li>Zu den Kosten pro Therapieeinheit liegen mindestens 20 auswertbare Antworten mehr vor als zu den Gesamtkosten.</li></ul></section></div></details>';

    const travelRule='<p>Für die Anreise unterscheiden wir mehrere Fälle. Dafür ziehen wir das <u>Durchführungssetting</u> und den <u>Zugang zur Therapie</u> heran:</p><ol class="therapy-travel-cases"><li data-case-number="1">Durchführungssetting: <strong>selbstständig zu Hause</strong>. Zugang: <strong>frei erhältlich</strong> oder <strong>Selbstmanagement</strong>.<br>Da die Therapie ohne Vor-Ort-Termin zu Hause durchgeführt werden kann, entfällt die Anreise. Der Teilwert für die persönliche Anreise beträgt deshalb 15 Punkte.</li><li data-case-number="2">Durchführungssetting: <strong>Hausbesuch</strong>.<br>Der Behandler kommt zur Behandlung nach Hause. Für die Bewertung nehmen wir an, dass eine gegebenenfalls nötige Verordnung im Rahmen des Hausbesuchs geklärt werden kann. Es ist keine Anreise erforderlich. Daher werden für die persönliche Anreise 15 Punkte vergeben.</li><li data-case-number="3a">Durchführungssetting: <strong>selbstständig zu Hause</strong>. Zugang: <strong>Verordnung nötig</strong>. Termin: <strong>online möglich</strong>.<br>Wenn die Verordnung bei einem zugeordneten Behandler vollständig online erfolgen kann, ist auch dafür keine Anreise erforderlich. Der Teilwert für die persönliche Anreise beträgt deshalb 15 Punkte.</li><li data-case-number="3b">Durchführungssetting: <strong>selbstständig zu Hause</strong>. Zugang: <strong>Verordnung nötig</strong>. Termin: <strong>nicht online möglich oder keine Angaben dazu</strong>.<br>In diesem Fall nehmen wir einen einmaligen Vor-Ort-Termin für die Verordnung an. Da die Therapie anschließend zu Hause durchgeführt wird, berücksichtigen wir den Fahraufwand geringer als bei wiederkehrenden Vor-Ort-Terminen: Der entfernungsabhängige Abzug von den maximal 15 Punkten wird halbiert.</li><li data-case-number="4"><strong>Alle übrigen Fälle, zum Beispiel ambulant oder stationär:</strong> Wir berücksichtigen die Entfernung mit dem vollen Abzug. Je weiter der nächste bestätigte Anbieter entfernt ist, desto weniger Punkte gibt es. Auch bei einem stationären Aufenthalt bleibt die Anreise damit berücksichtigt.</li></ol><p>Die Entfernung ist die Luftlinie zum nächstgelegenen bestätigten Anbieter, unabhängig vom Listenfilter. Falls eine Anreise nötig ist, aber dein Standort oder Anbieterkoordinaten fehlen, bleibt der Teilwert offen.</p>';
    function calculationHelp(key){
      const row=result.rows.find(row=>row.key===key)||(key==='unit_cost'?result.costs.unit:key==='total_cost'?result.costs.total:null);
      const text=key.includes('cost')?costRule:key==='distance'?travelRule:key==='gamechanger'?row.reason:weightedRule;
      const answerBased=key!=='distance';
      const insufficient=answerBased&&row.total<10;
      const requirement='Der Teilwert wird ab 10 auswertbaren Antworten berechnet.';
      const notice=insufficient?'<p class="therapy-data-requirement" role="status">'+requirement+' '+(row.total===1?'Bisher liegt 1 Antwort von 10 vor.':'Bisher liegen '+row.total+' von 10 Antworten vor.')+'</p>':'';
      const requirementSuffix=answerBased&&!insufficient&&key!=='gamechanger'?' '+requirement:'';
      return notice+'<details class="therapy-calculation-help"><summary>Wie wird der Wert ermittelt?</summary>'+(key==='distance'?'<div class="therapy-calculation-cases">'+text+'</div>':'<p>'+escape(text)+requirementSuffix+'</p>')+'</details>';
    }
    const rows=result.rows.map(r=>{
      const missing=r.key==='distance'?'Standort oder bestätigte Anbieter fehlen':r.total===0?'Keine Angaben':r.total<10?'Weniger als zehn Angaben ('+r.total+' von 10)':'Nicht zuverlässig auswertbar';
      const value=r.value==null?'—':number(r.value*r.weight);
      const included=r.value!=null;
      return '<tr class="therapy-score-part '+(included?'is-included':'is-excluded')+'"><th scope="row" class="therapy-score-part-name">'+(included?'<strong>'+escape(r.label)+'</strong>':escape(r.label))+'</th><td class="therapy-score-part-status">'+(included?'Aufgenommen':'Nicht aufgenommen')+(included?'':'<small>'+escape(missing)+'</small>')+'</td><td class="therapy-score-stage">'+number(r.weight)+'</td><td class="therapy-score-contribution">'+value+'</td></tr>';
    }).join('');
    const explanation='<div class="score-explanation"><p><strong>Bis zu 100 Punkte: Belastung 30 · Zugang 30 · Erfahrungen 40</strong></p><p>Für den Vergleich mit anderen Therapien brauchen wir genügend Daten: Mindestens fünf der sieben Teilwerte müssen berechnet werden können. Teilwerte ohne ausreichende Angaben lassen wir weg. Damit die Ergebnisse trotzdem vergleichbar bleiben, rechnen wir die erreichten Punkte auf eine gemeinsame Skala von 0 bis 100 um.</p><p>Das Gewicht zeigt den maximalen Beitrag eines Teilwerts. Der Beitrag zeigt die tatsächlich erreichten Punkte. Wie ein einzelner Teilwert berechnet wird, erfährst du unter „Wie wird der Wert ermittelt?“.</p></div>';


    root.querySelectorAll('[data-treatment-score]').forEach(node=>{
      const comparisonHtml=scoreClassification(result,comparisonValues,comparisonReady);
      node.innerHTML='<section class="card dashboard-score therapy-final-summary">'+comparisonHtml+'<details class="therapy-more-info"><summary>Weitere Infos</summary>'+comparisonExplanation(result,comparisonValues,comparisonReady)+comparisonOrientation+'</details>'+(node.dataset.treatmentScore==='overview'?'':'<details><summary>Gewichtung und Teilwerte</summary>'+explanation+'<div class="therapy-score-scroll" role="region" aria-label="Gewichtung und Teilwerte" tabindex="0"><table class="score-parts therapy-score-table"><thead><tr><th scope="col">Teilwert</th><th scope="col">Berücksichtigung</th><th scope="col">Gewicht</th><th scope="col">Beitrag</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><th scope="row">Gesamtwert</th><td>'+result.available+' von '+result.fieldCount+' Teilwerten</td><td>'+number(result.coverage)+'</td><td>'+(result.coverage?number(result.earned):'—')+'</td></tr></tfoot></table></div></details>')+'</section>';
    });
    const grid=root.querySelector('[data-treatment-dashboard]');
    grid.innerHTML=questions.filter(c=>!c.dataset.question.startsWith('symptom-')).sort((a,b)=>{const order=['setting','access','pem','unit_cost','total_cost','effect','gamechanger'];return order.indexOf(a.dataset.question)-order.indexOf(b.dataset.question);}).map(card=>{
      const chartCounts=card.dataset.kind==='cost'?counts[card.dataset.question+':'+context]:countsFor(card).counts;
      const total=chartCounts.reduce((n,v)=>n+v,0);
      const options=[...card.querySelectorAll('[data-option]')].sort((a,b)=>Number(a.dataset.option)-Number(b.dataset.option));
      const scoreRow=result.rows.find(row=>row.key===card.dataset.question);
      const percentage=i=>total?chartCounts[i]*100/total:0;
      const stageRow=scoreRow||(card.dataset.kind==='cost'?result.costs[card.dataset.question==='unit_cost'?'unit':'total']:null);
      const stage=i=>{
        if(!stageRow)return '';
        if(stageRow.scale[i]==null)return 'Entfällt';
        const maximum=stageRow.scale[i]*stageRow.weight;
        const contribution=stageRow.value!=null?maximum*Number(chartCounts[i]||0)/stageRow.total:null;
        return '<span class="therapy-stage-maximum">'+number(maximum)+'</span><span class="therapy-stage-contribution">'+(contribution==null?'–':number(contribution))+'</span>';
      };
      const label=i=>{ const text=escape(initialUpper(window.LCNCost.amount(options[i].dataset.value))); return card.dataset.question==='access'?text.replace(' / ',i===1?' oder<br>':' /<br>'):text; };
      const share=i=>total?number(percentage(i))+' %':'–';
      const points=scoreRow?'<div class="dashboard-points"><strong>'+(scoreRow.value==null?'Noch nicht auswertbar':number(scoreRow.value*scoreRow.weight)+' <small>/ '+number(scoreRow.weight)+' Punkte</small>')+'</strong></div>':card.dataset.kind==='cost'?'<div class="dashboard-points"><strong><small>Kein zusätzlicher Punktwert</small></strong></div>':'';
      let graphic='';
      if(card.dataset.question==='gamechanger'){
        const ready=scoreRow.value!=null;
        graphic='<div class="ux-dashboard-gamechanger"><div class="ux-dashboard-ring" style="--yes:'+(ready?percentage(0):0)+'%" role="img" aria-label="Gamechanger: '+(ready?number(percentage(0))+' Prozent Ja':'noch nicht auswertbar')+'"><strong>'+(ready?number(percentage(0))+' %':'–')+'<small>Ja</small></strong></div><div>'+options.map((_,i)=>'<div class="ux-dashboard-legend"><i style="background:'+(i===0?'#30b98c':'#dce6f0')+'"></i><span>'+label(i)+'</span><strong>'+(ready?share(i):'–')+'</strong></div>').join('')+'</div></div>';
      }
      // Match the provider dashboard: readable labels, community share and points in separate columns.
      if(card.dataset.question!=='gamechanger'){
        const order=card.dataset.kind==='cost'?[9,0,1,2,3,4,5,6,7,8]:options.map((_,i)=>i);
        graphic='<div class="therapy-dashboard-distribution"><div class="therapy-distribution-heading"><span>Antwort</span><span>Anteil der Antworten</span><span>Stufenwert</span><span>Gewichteter<br>Beitrag</span></div>'+order.map(i=>'<div class="therapy-distribution-row"><span>'+label(i)+'</span><div class="therapy-distribution-share"><strong>'+share(i)+'</strong><div class="dashboard-track"><span style="width:'+percentage(i)+'%"></span></div></div>'+stage(i)+'</div>').join('')+'</div>';
      }
      if(card.dataset.question==='effect'){
        graphic='<div class="therapy-effect-columns"><span></span>'+options.map((_,i)=>'<div class="therapy-effect-bar-area"><span class="therapy-effect-bar effect-'+i+'" style="height:'+percentage(i)+'%"><strong>'+share(i)+'</strong></span></div>').join('')+'<span></span>'+options.map((_,i)=>'<span class="therapy-effect-label">'+label(i)+'</span>').join('')+'<span class="therapy-effect-row-heading">Stufenwert</span>'+options.map((_,i)=>'<span class="therapy-effect-number">'+number(stageRow.scale[i]*stageRow.weight)+'</span>').join('')+'<span class="therapy-effect-row-heading">Gewichteter<br>Beitrag</span>'+options.map((_,i)=>'<strong class="therapy-effect-number">'+(stageRow.value==null?'–':number(stageRow.scale[i]*stageRow.weight*Number(chartCounts[i]||0)/stageRow.total))+'</strong>').join('')+'</div>';
      }
      if(card.dataset.kind==='cost'){
        const order=[9,0,1,2,3,4,5,6,7,8];
        graphic='<table class="therapy-cost-table"><thead><tr><th scope="col">Kostenstufe</th><th scope="col">Anteil</th><th scope="col">Stufenwert</th><th scope="col">Gewichteter<br>Beitrag</th></tr></thead><tbody>'+order.map(i=>{
          const applicable=stageRow.scale[i]!=null;
          const maximum=applicable?stageRow.scale[i]*stageRow.weight:null;
          const contribution=applicable&&stageRow.value!=null?maximum*Number(chartCounts[i]||0)/stageRow.total:null;
          return '<tr><th scope="row">'+label(i)+'</th><td><div class="therapy-cost-share"><span class="dashboard-track" aria-hidden="true"><span style="width:'+percentage(i)+'%"></span></span><strong>'+share(i)+'</strong></div></td><td class="therapy-cost-maximum">'+(applicable?number(maximum):'–')+'</td><td class="therapy-cost-contribution">'+(contribution==null?'–':number(contribution))+'</td></tr>';
        }).join('')+'</tbody></table>';
      }
      return '<section class="card ux-dashboard-card dashboard-shared-card" data-dashboard-question="'+card.dataset.question+'"><div class="assessment-header"><h3>'+escape(card.querySelector('h3').childNodes[0].textContent)+' '+helpMarkup(card.querySelector('h3').childNodes[0].textContent.trim(),help[card.dataset.question]+' Die Übersicht zeigt die Community-Verteilung. Über die Überschrift gelangst du zu den eigenen Angaben.')+'</h3><span class="assessment-count">'+(total?total+(total===1?' Angabe':' Angaben'):'Noch keine Community-Angaben')+'</span></div>'+points+graphic+(scoreRow?'<p class="ux-dashboard-score-note">'+escape(scoreRow.reason||(scoreRow.total<10?'Punktwert ab zehn auswertbaren Angaben.':'Gewichteter Beitrag = Stufenwert × prozentualer Anteil der Antwort. Die Beiträge ergeben zusammen den Teilwert.'))+'</p>':card.dataset.kind==='cost'?'<p class="ux-dashboard-score-note">Nicht zusätzlich gewertet. Kostenbasis im Gesamtscore: '+escape(result.rows.find(r=>r.key===result.costBasis).label)+'.</p>':'')+'<a class="dashboard-detail" href="#'+card.closest('.nd-panel').id+'">Details ansehen →</a></section>';
    }).join('');
    const travel=result.rows.find(r=>r.key==='distance');
    const travelLevels=[
      [0,'Keine Anreise erforderlich','Zu Hause oder ohne Anfahrt',15,'#176748'],
      [20,'Bis 20 km','Unter 30 Min.',14,'#9fd3b6'],
      [50,'20–50 km','30–60 Min.',9,'#cadca9'],
      [100,'50–100 km','Etwa 1–2 Std.',6,'#e5cf9b'],
      [300,'100–300 km','Mehrere Stunden',3,'#dfb09e'],
      [800,'300–800 km','Tagesreise',1.5,'#e5a5ad'],
      [Infinity,'Über 800 km','Tagesreise oder länger',0,'#bd4949']
    ];
    const travelLevel=travel.noTravel?0:travel.distance==null?-1:travelLevels.findIndex((level,i)=>i>0&&travel.distance<=level[0]);
    const travelGraphic='<ol class="dashboard-travel-scale" aria-label="Anreisestufen und Punkte">'+travelLevels.map((level,i)=>'<li'+(i===travelLevel?' class="is-current" aria-current="true"':'')+'><span class="dashboard-travel-color" style="background:'+level[4]+'" aria-hidden="true"></span><span><strong>'+level[1]+'</strong><small>'+level[2]+'</small></span><b>'+number(travel.oneOffPrescription&&i>0?15-(15-level[3])/2:level[3])+' P.</b></li>').join('')+'</ol>';

    grid.insertAdjacentHTML('beforeend','<section class="card ux-dashboard-card dashboard-shared-card" data-dashboard-question="distance"><h3>Persönliche Anreise '+helpMarkup('Persönliche Anreise','Wie weit ist der nächste Behandler von deinem Standort entfernt? Die Entfernung wird als Luftlinie zum nächstgelegenen bestätigten Anbieter berechnet. Deinen Ausgangsort kannst du unter Standorte ergänzen. Bei eigenständig zu Hause durchführbaren Therapien ohne Verordnung entfällt die Anreise. Für eine nötige Verordnung zu Hause nehmen wir ohne bestätigte Online-Möglichkeit einen einmaligen Termin mit halbiertem Entfernungsabzug an.')+'</h3><div class="dashboard-points"><strong>'+(travel.value==null?'Noch nicht auswertbar':number(travel.value*15)+' <small>/ 15 Punkte</small>')+'</strong></div><p>'+(travel.noTravel?'Keine Anreise erforderlich':travel.distance==null?escape(travel.reason):number(travel.distance)+' km Luftlinie zum nächstgelegenen bestätigten Anbieter')+'</p>'+(travel.oneOffPrescription?'<p class="ux-dashboard-score-note">Verordnung: einmaliger Vor-Ort-Termin angenommen · halber Entfernungsabzug.</p>':'')+travelGraphic+'<p class="ux-dashboard-score-note">'+escape(travel.reason)+'</p></section>');
    for(const [sectionNumber,title,maximum,keys] of [[2,'Welche Belastungshürden gibt es bei der Therapie?',30,['setting','pem','distance']],[3,'Wie zugänglich ist die Therapie?',30,['access','total_cost','unit_cost']],[4,'Welche Erfahrungen gibt es?',40,['effect','gamechanger']]]){
      const rows=result.rows.filter(row=>keys.includes(row.key));
      const available=rows.filter(row=>row.value!=null);
      const earned=available.reduce((sum,row)=>sum+row.value*row.weight,0);
      const group=document.createElement('section');group.className='dashboard-score-group';
      group.innerHTML='<h2 class="dashboard-group-heading"><span class="dashboard-group-number">'+sectionNumber+'</span><span>'+title+'</span><small>'+(available.length?number(earned)+' von '+maximum+' Punkten':'Noch nicht auswertbar · maximal '+maximum+' Punkte')+(available.length&&available.length<rows.length?' · Angaben unvollständig':'')+'</small></h2><div class="dashboard-grid"></div>';
      const cards=group.querySelector('.dashboard-grid');
      for(const key of keys){const node=grid.querySelector('[data-dashboard-question="'+key+'"]');if(node)cards.append(node);}
      if(sectionNumber===3){
        const cost=result.rows.find(row=>row.key===result.costBasis);
        const box=document.createElement('section');box.className='therapy-dashboard-cost-group';
        box.setAttribute('aria-label','Gemeinsame Kostenauswertung');
        const costNotice=cost.value==null?'<p class="therapy-data-requirement" role="status">Für die gemeinsame Kostenauswertung liegen noch nicht genügend auswertbare Angaben vor. Gesamtkosten: '+result.costs.total.total+' auswertbare Antworten; Kosten pro Therapieeinheit: '+result.costs.unit.total+'. Je Kostenbasis sind mindestens zehn nötig. Bei den Gesamtkosten dürfen die Antworten „nicht anwendbar“ nicht überwiegen.</p>':'';
        box.innerHTML='<div class="therapy-cost-group-heading"><h3>Gemeinsame Kostenauswertung</h3><strong>'+(cost.value==null?'Noch nicht auswertbar':number(cost.value*cost.weight)+' / 20 Punkte')+'</strong></div><p>Gesamtkosten und Kosten pro Therapieeinheit werden gemeinsam ausgewertet.</p>'+costNotice+costSelectionHelp+'<div class="therapy-cost-pair"></div>';

        const pair=box.querySelector('.therapy-cost-pair');
        for(const key of ['total_cost','unit_cost']){
          const card=cards.querySelector('[data-dashboard-question="'+key+'"]');
          if(!card)continue;
          const selected=key===result.costBasis&&cost.value!=null;
          card.classList.toggle('is-cost-basis',selected);
          const badge=document.createElement('p');badge.className='therapy-cost-basis-label';
          badge.textContent=selected?'Zählt in der Gesamtauswertung':cost.value==null?'Noch keine verwendbare Kostenbasis':'Zum Vergleich · zählt nicht zusätzlich';
          card.querySelector('.assessment-header').after(badge);
          pair.append(card);
        }
        cards.append(box);
      }
      grid.append(group);
    }
    grid.querySelectorAll('[data-dashboard-question]').forEach(card=>{
      const heading=card.querySelector('.assessment-header')||card.querySelector('h3');
      const oldLink=card.querySelector('.dashboard-detail');
      const target=oldLink?.getAttribute('href')||'#termin';
      const title=card.querySelector('h3');
      const link=document.createElement('a');link.className='therapy-dashboard-title-link';link.href=target;
      link.textContent=title.firstChild.textContent.trim();title.firstChild.replaceWith(link);
      oldLink?.remove();
      const content=document.createElement('div');content.innerHTML=calculationHelp(card.dataset.dashboardQuestion);
      const notice=content.querySelector('.therapy-data-requirement');
      if(notice)heading.after(notice);
      if(!card.dataset.dashboardQuestion.includes('cost'))card.append(content.querySelector('.therapy-calculation-help'));
      card.querySelectorAll('.ux-dashboard-score-note').forEach(note=>note.remove());
    });
    grid.querySelectorAll('.therapy-dashboard-cost-group').forEach(group=>{
      const help=group.querySelector(':scope>.therapy-cost-selection-info');
      if(help)group.append(help);
    });
    const rating=result.rows.find(r=>r.key==='effect');
    const values=others.map(p=>scoreProfile(p,p.counts,context).rows[0]).filter(r=>r.value!=null).map(r=>1+3*r.value);
    root.querySelector('[data-rating-comparison]').innerHTML=comparison(rating.value==null?null:1+3*rating.value,values,'Community-Bewertung im Vergleich',(demo||loaded)&&rating.total>=10,4);
    const gamechanger=result.rows.find(r=>r.key==='gamechanger');
    const gameValues=others.map(p=>scoreProfile(p,p.counts,context).rows.find(r=>r.key==='gamechanger')).filter(r=>r.value!=null).map(r=>100*r.rawValue);
    const gameCard=questions.find(card=>card.dataset.question==='gamechanger');
    if(gameCard){
      let target=gameCard.querySelector('[data-gamechanger-comparison]');
      if(!target){const layout=document.createElement('div');layout.className='ux-gamechanger-layout';const left=document.createElement('div');left.className='ux-gamechanger-answer';target=document.createElement('div');target.dataset.gamechangerComparison='';const chart=gameCard.querySelector('.ux-chart');chart.before(layout);left.append(chart,gameCard.querySelector('.ux-own'));layout.append(target,left);}
      target.innerHTML=comparison(gamechanger.rawValue==null?null:100*gamechanger.rawValue,gameValues,'Gamechanger im Vergleich',(demo||loaded)&&gamechanger.total>=10,100,false,' zur Gamechanger-Frage').replaceAll('Punkte ','Prozentpunkte ').replaceAll(' / 100',' %');
    }
    const pem=result.rows.find(r=>r.key==='pem');
    const pemValues=others.map(p=>scoreProfile(p,p.counts,context).rows.find(r=>r.key==='pem')).filter(r=>r.value!=null).map(r=>4-3*r.value);
    root.querySelector('[data-pem-comparison]').innerHTML=comparison(pem.value==null?null:4-3*pem.value,pemValues,'Crash-/PEM-Risiko im Vergleich',(demo||loaded)&&pem.total>=10,4,true);
  }
  async function changeCostPreferences(patch){if(busy)return;const previous=window.LCNCost.get(),before=window.LCNCost.context();window.LCNCost.set(patch);const context=window.LCNCost.context();if(before!==context&&Object.keys(draft).some(k=>k.startsWith('unit_cost:')||k.startsWith('total_cost:'))){if(!await sync({action:'move_cost_context',context}))window.LCNCost.set(previous);}renderAll();}

  function renderCostControls(){
    questions.filter(card=>card.dataset.kind==='cost').forEach(card=>{
      let heading=card.querySelector('.cost-question-heading');if(!heading){heading=document.createElement('div');heading.className='cost-question-heading';card.prepend(heading);heading.append(card.querySelector('h3'),card.querySelector('.insurance-toggle'));}
      let preferences=card.querySelector('.cost-preferences');
      if(!preferences){preferences=document.createElement('div');preferences.className='cost-preferences';card.append(preferences);}
      const prefs=window.LCNCost.get();
      preferences.innerHTML=window.LCNCost.countryControl()+window.LCNCost.currencyControl();
      card.querySelector('.insurance-toggle').innerHTML=window.LCNCost.systems[prefs.country].map(([v,label])=>'<button type="button" data-cost-insurance="'+v+'" aria-pressed="'+(v===prefs.insurance)+'">'+label+'</button>').join('');
      card.querySelectorAll('[data-option]').forEach(button=>{const label=button.querySelector('span:last-of-type');label.textContent=initialUpper(window.LCNCost.amount(button.dataset.value));let conversion=button.querySelector('.cost-converted');if(!conversion){conversion=document.createElement('small');conversion.className='cost-converted';button.append(conversion);}conversion.textContent=window.LCNCost.converted(button.dataset.value);});
      let note=card.querySelector('.cost-currency-note');if(!note){note=document.createElement('p');note.className='cost-currency-note';card.append(note);}note.textContent=window.LCNCost.rateNote();preferences.append(note);
      let footer=card.querySelector('.cost-answer-footer');if(!footer){footer=document.createElement('div');footer.className='cost-answer-footer';card.append(footer);}footer.append(card.querySelector('.ux-own'),preferences);
    });
  }
  root.addEventListener('change',event=>{if(busy)return;const target=event.target;if(target.matches('[data-cost-country]'))changeCostPreferences({country:target.value});else if(event.target.matches('[data-cost-custom-country]'))changeCostPreferences({customCountry:event.target.value});else if(target.matches('[data-cost-currency]'))changeCostPreferences({currency:target.value});});
  root.addEventListener('click',event=>{const button=event.target.closest('[data-cost-insurance]');if(!button||busy)return;changeCostPreferences({insurance:button.dataset.costInsurance});});
  let symptomSearch='',symptomOpen=false,symptomActive=-1;
  const symptomOrder=[];
  function closeSymptomPicker(){symptomOpen=false;symptomActive=-1;filterSymptomPicker();}
  function filterSymptomPicker(){
    const picker=root.querySelector('[data-symptom-picker]'),input=root.querySelector('[data-symptom-search]'),toggle=root.querySelector('[data-symptom-toggle]');if(!picker||!input)return;
    const ids=new Set(symptomHelp.symptoms.filter(r=>r.editorial||r.count>0||r.selected).map(r=>r.id));
    const matches=window.LCNSymptomSearch.search(symptomHelp.catalog.filter(s=>!ids.has(s.id)),symptomSearch);
    picker.replaceChildren();input.disabled=busy||!loaded;if(toggle)toggle.disabled=busy||!loaded;picker.hidden=!symptomOpen;input.setAttribute('aria-expanded',String(symptomOpen));if(toggle)toggle.setAttribute('aria-expanded',String(symptomOpen));input.removeAttribute('aria-activedescendant');
    if(symptomActive>=matches.length)symptomActive=-1;
    matches.forEach((symptom,i)=>{const option=document.createElement('button');option.type='button';option.id='symptom-option-'+symptom.id;option.dataset.symptomSuggestion=String(symptom.id);option.setAttribute('role','option');option.setAttribute('aria-selected',String(i===symptomActive));option.tabIndex=-1;option.textContent=symptom.name;option.disabled=busy||!loaded;picker.append(option);if(i===symptomActive)input.setAttribute('aria-activedescendant',option.id);});
    if(!matches.length&&symptomSearch.trim().length>=2){const add=document.createElement('button');add.type='button';add.setAttribute('role','option');add.textContent='Möchtest du das Symptom „'+symptomSearch.trim()+'“ hinzufügen?';add.addEventListener('click',()=>{document.dispatchEvent(new CustomEvent('lcn-propose-symptom',{detail:{name:symptomSearch.trim()}}));closeSymptomPicker();});picker.append(add);}
  }
  function selectSymptom(id){if(busy||!loaded)return;if(!symptomOrder.includes(Number(id)))symptomOrder.push(Number(id));symptomSearch='';root.querySelector('[data-symptom-search]').value='';closeSymptomPicker();sync({question:'symptom-help-'+id,value:'Ja'});}
  root.addEventListener('input',event=>{if(!event.target.matches('[data-symptom-search]'))return;symptomSearch=event.target.value;symptomOpen=true;symptomActive=-1;filterSymptomPicker();});
  root.addEventListener('click',event=>{if(event.target.matches('[data-symptom-search]')){symptomOpen=true;filterSymptomPicker();}const toggle=event.target.closest('[data-symptom-toggle]');if(toggle){symptomOpen=!symptomOpen;filterSymptomPicker();root.querySelector('[data-symptom-search]').focus();}const option=event.target.closest('[data-symptom-suggestion]');if(option)selectSymptom(option.dataset.symptomSuggestion);});
  root.addEventListener('keydown',event=>{if(!event.target.matches('[data-symptom-search]'))return;if(event.key==='Escape'){closeSymptomPicker();return;}if(event.key==='Tab'){closeSymptomPicker();return;}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();symptomOpen=true;const count=root.querySelectorAll('[data-symptom-suggestion]').length;symptomActive=count?(symptomActive+(event.key==='ArrowDown'?1:-1)+count)%count:-1;filterSymptomPicker();root.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'){event.preventDefault();const option=root.querySelector('[role="option"][aria-selected="true"]');if(option)selectSymptom(option.dataset.symptomSuggestion);}});
  document.addEventListener('click',event=>{if(!event.target.closest('[data-symptom-combobox]'))closeSymptomPicker();});
  function renderSymptomHelp(){
    const list=root.querySelector('[data-symptom-ranking]'),picker=root.querySelector('[data-symptom-picker]');
    if(!list||!picker)return;
    const focused=document.activeElement?.dataset.symptomId;
    const rows=symptomHelp.symptoms.map(symptom=>({...symptom,count:symptom.count+(demo&&symptom.editorial?(symptom.id*7)%31:0)})).sort((a,b)=>b.count-a.count||Number(b.editorial)-Number(a.editorial)||a.name.localeCompare(b.name,'de'));
    const visibleRows=rows.filter(symptom=>symptom.editorial||symptom.count>0||symptom.selected);
    if(loaded&&!busy){const visibleIds=new Set(visibleRows.map(symptom=>symptom.id));for(let i=symptomOrder.length-1;i>=0;i--)if(!visibleIds.has(symptomOrder[i]))symptomOrder.splice(i,1);}
    visibleRows.forEach(symptom=>{if(!symptomOrder.includes(symptom.id))symptomOrder.push(symptom.id);});
    visibleRows.sort((a,b)=>symptomOrder.indexOf(a.id)-symptomOrder.indexOf(b.id));
    list.replaceChildren();
    visibleRows.forEach(symptom=>{
      const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.symptomId=String(symptom.id);button.setAttribute('aria-pressed',String(symptom.selected));button.disabled=busy||!loaded;
      const label=document.createElement('span');label.textContent=symptom.name;
      const count=document.createElement('strong');count.textContent=symptom.count+' '+(symptom.count===1?'Stimme':'Stimmen');
      const check=document.createElement('span');check.className='ux-symptom-check';check.textContent=symptom.selected?'✓':'＋';check.setAttribute('aria-hidden','true');
      button.setAttribute('aria-label',symptom.name+': '+symptom.count+' hilfreiche Erfahrungen'+(symptom.selected?' – eigene Stimme zurücknehmen':' – hat mir geholfen'));
      button.append(label,count,check);li.append(button);list.append(li);
    });
    if(!loaded){const empty=document.createElement('li');empty.textContent='Symptome werden geladen …';list.append(empty);}
    filterSymptomPicker();
    if(focused)list.querySelector('[data-symptom-id="'+focused+'"]')?.focus({preventScroll:true});
  }
  root.addEventListener('click',event=>{const button=event.target.closest('[data-symptom-id]');if(!button||busy||!loaded)return;const symptom=symptomHelp.symptoms.find(s=>s.id===Number(button.dataset.symptomId));if(!symptom)return;sync({action:symptom.selected?'clear':'answer',question:'symptom-help-'+symptom.id,value:'Ja'});});
  function renderAll() {
    renderCostControls();
    toggle.textContent='Dummy-Daten sind '+(demo?'an':'aus');toggle.setAttribute('aria-pressed',String(demo));




    questions.forEach(render);renderSummaries();renderSymptomHelp();

  }
  toggle.addEventListener('click',()=>{if(busy)return;demo=!demo;window.LCNDummy.set(demo);const url=new URL(location.href);url.searchParams.set('demo',demo?'1':'0');history.replaceState(null,'',url);renderAll();});
  window.addEventListener('storage',event=>{if(event.key===window.LCNDummy.key){demo=window.LCNDummy.get();renderAll();}if(['lcn_shared_location_preference','lcn_shared_location_cleared'].includes(event.key))renderSummaries();});
  window.addEventListener('lcn-dummy-change',()=>{const next=window.LCNDummy.get();if(next!==demo){demo=next;renderAll();}});
  window.addEventListener('homepage:location-changed',()=>renderSummaries());
  window.addEventListener('lcn-online-ready',()=>renderAll());
  window.addEventListener('lcn-exchange-rates',()=>{renderCostControls();});
  window.addEventListener('lcn-symptoms-updated',()=>{if(busy)setTimeout(()=>sync(),300);else sync();});
  renderAll();
  sync();
})();

