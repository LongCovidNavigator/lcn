(() => {
  'use strict';
  const hosts = [...document.querySelectorAll('.nd-provider-map')];
  if (!hosts.length) return;
  const sharedKey = 'lcn_shared_location_preference';
  let origin = null;
  const valid = v => v && v.lat !== null && v.lng !== null && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)) && Math.abs(Number(v.lat)) <= 90 && Math.abs(Number(v.lng)) <= 180 && !(Number(v.lat) === 0 && Number(v.lng) === 0);
  try { const saved = JSON.parse(localStorage.getItem(sharedKey)); if (valid(saved)) origin = {...saved, label:saved.location || saved.label || 'Gespeicherter Standort'}; } catch {}
  let relationFeedback={};window.addEventListener('lcn-relation-feedback',event=>{relationFeedback=event.detail||{};entries.forEach(renderProviders);});let ratings={},ratingsLoaded=false;const positiveNode=point=>{
    const container=document.createElement('div'),grid=document.createElement('div'),r=ratings[point.dr_id];
    container.className='nd-provider-rating-summary';grid.className='treatment-card-ratings';grid.setAttribute('role','group');grid.setAttribute('aria-label','Behandlererfahrungen');
    for(const [key,label,tone] of [['healing','Heilung','healing'],['improvement','Verbesserung','improvement'],['neutral','Neutral','neutral'],['worsening','Verschlechterung','negative']]){
      const field=document.createElement('div');field.className='treatment-card-rating treatment-card-rating-'+tone;
      const value=document.createElement('strong');value.textContent=r?Math.round(r[key+'_percent']).toLocaleString('de-DE')+' %':'—';
      const caption=document.createElement('span');caption.textContent=label==='Verschlechterung'?'Verschlech\u00ADterung':label;
      field.append(value,caption);grid.append(field);
    }
    const total=document.createElement('small');total.className='treatment-card-rating-total';total.textContent=r?r.total+' Bewertungen':ratingsLoaded?'Noch keine Bewertungen':'Bewertungen werden geladen …';
    container.append(grid,total);return container;
  };

  function numericValue(value,unit,width=3){const node=document.createElement('span'),number=document.createElement('span'),suffix=document.createElement('span');node.className='provider-numeric-value';node.style.setProperty('--number-width',width+'ch');number.className='provider-value-number';number.textContent=Math.round(value).toLocaleString('de-DE');suffix.className='provider-value-unit';suffix.textContent=unit;node.setAttribute('aria-label',number.textContent+' '+unit);node.append(number,suffix);return node;}
  function ratingCell(point,key){const r=ratings[point.dr_id],value=r?.[key+'_percent'];const node=value!=null?numericValue(value,'%'):document.createElement('span');node.classList.add('catalog-rating-number');if(key==='worsening')node.classList.add('catalog-rating-negative');if(value==null)node.textContent='—';return node;}
  let view='cards';try{view=localStorage.getItem('lcn_result_view_preference')==='table'?'table':'cards';}catch{}
  const entries = hosts.map(host => {const providers=JSON.parse(host.querySelector('.nd-map-data').textContent);return {host,providers,points:providers.filter(valid),map:null,view};});
  window.addEventListener('lcn-pending-providers',event=>{entries.forEach(entry=>{entry.providers=entry.providers.filter(p=>!p.pending);const ids=new Set(entry.providers.map(p=>Number(p.dr_id)));entry.providers.push(...(event.detail||[]).filter(p=>!p.dr_id||!ids.has(Number(p.dr_id))));entry.points=entry.providers.filter(valid);const citySelect=entry.host.querySelector('[data-provider-city]');[...new Set(entry.providers.map(p=>p.city).filter(Boolean))].forEach(city=>{if(![...citySelect.options].some(o=>o.value===city)){const option=document.createElement('option');option.value=option.textContent=city;citySelect.append(option);}});render(entry);});});
  let ratingRequest=0;async function loadRatings(){const request=++ratingRequest;try{const demo=document.getElementById('nd-demo-header-toggle')?.getAttribute('aria-pressed')==='true';const response=await fetch('api/provider_positive_ratings.php?include_dummy='+(demo?'1':'0'));const data=await response.json();if(request!==ratingRequest||!data.ok)return;ratings=data.ratings;ratingsLoaded=true;entries.forEach(render);}catch{}}
  const demoButton=document.getElementById('nd-demo-header-toggle');if(demoButton)new MutationObserver(loadRatings).observe(demoButton,{attributes:true,attributeFilter:['aria-pressed']});loadRatings();
  function distance(point) {
    const rad = v => Number(v)*Math.PI/180, a = rad(point.lat)-rad(origin.lat), b = rad(point.lng)-rad(origin.lng);
    const h = Math.sin(a/2)**2+Math.cos(rad(origin.lat))*Math.cos(rad(point.lat))*Math.sin(b/2)**2;
    return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
  }
  const travelBands=[[20,'Bis 20 km','Unter 30 Min.',5.6],[50,'Über 20–50 km','30–60 Min.',4.2],[100,'Über 50–100 km','Etwa 1–2 Std.',2.8],[300,'Über 100–300 km','Mehrere Stunden',1.4],[800,'Über 300–800 km','Tagesreise',0.7],[Infinity,'Über 800 km','Tagesreise oder länger / ggf. Flug',0]];
  const travelBand=km=>travelBands.findIndex(([limit])=>km<=limit);
  function renderTravel(entry,closest){
    if(entry.host.dataset.independentAtHome==='1'){entry.host.querySelector('[data-travel-estimate]')?.remove();return;}
    let box=entry.host.querySelector('[data-travel-estimate]');
    if(!box){box=document.createElement('section');box.className='travel-estimate';box.dataset.travelEstimate='';entry.host.querySelector('.top-map-location-layout').before(box);}
    const online=filteredProviders(entry).find(p=>window.LCNOnline?.get(p.dr_id).complete);
    const km=closest?distance(closest):null,index=online||km===null?-1:travelBand(km);
    const heading=document.createElement('div');heading.className='travel-estimate-heading';
    const title=document.createElement('strong');title.textContent='Anreiseaufwand';
    const result=document.createElement('span');result.textContent=online?online.name+' · Erst- und Folgetermin online':closest?closest.name+' · '+km.toLocaleString('de-DE',{maximumFractionDigits:1})+' km Luftlinie':origin?'Keine Behandler mit Koordinaten im gewählten Filter.':'Standort eingeben, um die Entfernung einzuordnen.';
    heading.append(title,result);box.replaceChildren(heading);
    const scale=document.createElement('ol');scale.className='travel-scale';scale.setAttribute('aria-label','Entfernung und Anreiseaufwand');
    const remote=document.createElement('li');remote.className='travel-online-level'+(online?' is-current':'');remote.innerHTML='<strong>Erst- und Folgetermin online</strong><span class="travel-scale-bar" aria-hidden="true"></span><span>Keine Anreise zu Erst- und Folgetermin</span>';scale.append(remote);
    travelBands.forEach(([,range,time,points],i)=>{
      const li=document.createElement('li');li.className='travel-level-'+(i+1)+(i===index?' is-current':'');
      const label=document.createElement('strong');label.textContent=range;
      const bar=document.createElement('span');bar.className='travel-scale-bar';bar.setAttribute('aria-hidden','true');
      const timing=document.createElement('span');timing.textContent=time;
      li.append(label,bar,timing);
      if(i===index){li.setAttribute('aria-current','true');const current=document.createElement('b');current.textContent='Nächster Behandler im Filter';li.append(current);}
      scale.append(li);
    });box.append(scale);
    const details=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent='Wie wird eingeordnet?';
    note.textContent='Die Einordnung zeigt die Luftlinienentfernung zum nächstgelegenen Behandler im aktuellen Filter. Fahrzeiten sind grobe Orientierungswerte, keine Routenberechnung. Sind Erst- und Folgetermin online möglich, entfällt die Anreise zu diesen Terminen. Ob Untersuchungen oder Behandlungen vor Ort nötig sind, muss zusätzlich mit der Praxis geklärt werden.';
    details.append(summary,note);box.append(details);
  }
  function filteredProviders(entry) {
    const {host,providers}=entry;
    const query=host.querySelector('[data-provider-search]').value.trim().toLocaleLowerCase('de');
    const mode=host.dataset.locationMode||'radius';
    const city=mode==='city'?host.querySelector('[data-provider-city]').value:'';
    const radius=host.querySelector('[data-radius]');
    const enabled=mode==='radius'&&host.querySelector('[data-radius-enabled]').checked;
    const includeUnknown=host.querySelector('[data-include-no-coords]');
    if(includeUnknown)includeUnknown.disabled=!enabled;
    host.querySelectorAll('[data-location-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.locationMode===mode)));
    const radiusControls=host.querySelector('[data-location-radius-controls]'),cityControls=host.querySelector('[data-location-city-controls]');
    if(radiusControls)radiusControls.hidden=mode!=='radius';if(cityControls)cityControls.hidden=mode!=='city';
    radius.disabled=false;
    const usable=Boolean(origin && radius.value && radius.validity.valid);
    host.querySelector('[data-location-filter-note]').textContent=enabled && !origin ? 'Bitte zuerst PLZ oder Ort eingeben und einen Ausgangsort übernehmen.' : enabled && !usable ? 'Bitte einen ganzen Radius zwischen 1 und 2000 km eingeben.' : '';
    const specialty=host.querySelector('[data-provider-specialty]')?.value||'';
    const limits=[...host.querySelectorAll('[data-rating-filter]')];
    const matchesRatings=p=>limits.every(input=>{const threshold=Number(input.value),maximum=input.dataset.ratingFilter==='worsening';if(threshold===(maximum?100:0))return true;const value=ratings[p.dr_id]?.[input.dataset.ratingFilter+'_percent'];return value!=null&&(maximum?value<=threshold:value>=threshold);});
    return providers.filter(p=>(!specialty||(p.specialties||[]).includes(specialty)) && matchesRatings(p) && (p.name+' '+p.place).toLocaleLowerCase('de').includes(query) && (!city || p.city?.toLocaleLowerCase('de')===city.toLocaleLowerCase('de')) && (!enabled || !usable || (valid(p)?distance(p)<=Number(radius.value):Boolean(includeUnknown?.checked))));
  }
  function renderProviders(entry){
    const {host,providers,map}=entry,list=host.querySelector('.nd-map-results');list.replaceChildren();
    const [sort,direction]=host.querySelector('[data-provider-sort]').value.split(':');
    const onlineGroup=p=>{const access=window.LCNOnline?.get(p.dr_id);return access?.first&&access.follow?0:2;};
    const defaultOrder=[...providers].sort((a,b)=>onlineGroup(a)-onlineGroup(b)||(origin?(valid(a)&&valid(b)?distance(a)-distance(b):valid(a)?-1:valid(b)?1:0):0)||a.name.localeCompare(b.name,'de'));
    const numbers=new Map(defaultOrder.map((p,i)=>[p,i+1]));
    const feedbackScore=p=>{const v=relationFeedback[p.dr_id?'d:'+p.dr_id+':t:'+document.querySelector('.ux-detail[data-treatment-id]').dataset.treatmentId:'s:'+p.submission_id];return (v?.confirm||0)-(v?.oppose||0);};
    const value=(p,key)=>key==='number'?numbers.get(p):key==='city'?(p.city||''):key==='distance'?(origin&&valid(p)?distance(p):null):['worsening','improvement','healing'].includes(key)?(ratings[p.dr_id]?.[key+'_percent']??null):key==='feedback'?feedbackScore(p):p.name;
    const rows=filteredProviders(entry).sort((a,b)=>{const group=onlineGroup(a)-onlineGroup(b);if(group)return group;const x=value(a,sort),y=value(b,sort);if(x===null)return y===null?0:1;if(y===null)return -1;const cmp=typeof x==='string'?x.localeCompare(y,'de',{numeric:true}):x-y;return cmp*(direction==='desc'?-1:1)||a.name.localeCompare(b.name,'de');});
    function changeSort(key){const next=sort===key?(direction==='asc'?'desc':'asc'):(['improvement','healing','feedback'].includes(key)?'desc':'asc');host.querySelector('[data-provider-sort]').value=key+':'+next;renderProviders(entry);}    host.querySelector('[data-provider-count]').textContent=rows.length+' von '+providers.length+' Behandlern'+(sort==='distance'&&!origin?' · Für die Entfernungssortierung bitte oben einen Standort eingeben.':'');
    const sidebarCount=host.querySelector('[data-location-provider-count]');if(sidebarCount)sidebarCount.textContent=rows.length+' von '+providers.length;
    host.querySelectorAll('[data-provider-view]').forEach(b=>{const active=b.dataset.providerView===entry.view;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
    if(!rows.length){
      list.className='nd-map-results nd-provider-empty';
      const message=document.createElement('p');message.textContent='Kein passender Behandler gefunden.';
      const link=document.createElement('a');link.textContent='Behandler hinzufügen →';
      const targetId='add-provider-'+document.querySelector('.ux-detail[data-treatment-id]').dataset.treatmentId;
      link.href='#'+targetId;
      link.addEventListener('click',event=>{
        const section=host.querySelector('.catalog-relation-add');if(!section)return;
        event.preventDefault();section.id=targetId;section.scrollIntoView({behavior:'smooth',block:'center'});
        section.querySelector('input')?.focus({preventScroll:true});
      });
      list.append(message,link);return;
    }
    function nameNode(point){const node=document.createElement(point.href?'a':'strong');node.textContent=point.name;if(point.href)node.href=point.href;if(!point.href&&point.pending)node.dataset.catalogFeedbackKey='s:'+point.submission_id;return node;}
    function pendingNote(point){const note=document.createElement('small');note.className='catalog-pending-note';note.textContent='Prüfung ausstehend';if(point.own)note.title='Dein Vorschlag · Prüfung ausstehend';return note;}
    function showButton(point,compact=false){const button=document.createElement('button');button.type='button';button.className='nd-show-provider';button.textContent=valid(point)?(compact?'Karte':'Auf Karte zeigen'):(compact?'—':'Standort nicht verfügbar');if(!compact)button.title=valid(point)?'Auf Karte zeigen':'Standort nicht verfügbar';button.disabled=!valid(point);button.addEventListener('click',()=>{if(!map)return;host.querySelector('.top-map-content').classList.remove('is-collapsed');map.invalidateSize();if(origin)map.fitBounds([[origin.lat,origin.lng],[point.lat,point.lng]],{padding:[64,64],maxZoom:12});else map.setView([point.lat,point.lng],12);entry.markers.get(point)?.openPopup();host.querySelector('.nd-map-canvas').scrollIntoView({block:'center'});});return button;}
    const km=p=>origin&&valid(p)?Math.round(distance(p)).toLocaleString('de-DE')+' km':'';
    if(entry.view==='table'){
      list.className='nd-map-results nd-provider-table-wrap';const table=document.createElement('table');table.className='nd-provider-table';const head=table.createTHead().insertRow();[['Nr.','number'],['Behandler','name'],['Ort','city'],['Entfernung','distance'],['Verschlechterung','worsening'],['Verbesserung','improvement'],['Heilung','healing'],['Karte',null],['Rückmeldungen','feedback']].forEach(([label,key])=>{const th=document.createElement('th');th.scope='col';if(key==='feedback'){th.dataset.catalogReportHeading='';th.className='catalog-report-column';}if(!key){th.textContent=label;th.className='nd-provider-map-column';}else{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=key==='distance'&&!origin;button.setAttribute('aria-label','Nach '+label+' sortieren');button.addEventListener('click',()=>changeSort(key));th.setAttribute('aria-sort',sort===key?(direction==='asc'?'ascending':'descending'):'none');th.append(button);}head.append(th);});const body=table.createTBody();rows.forEach((point,index)=>{const row=body.insertRow();const number=row.insertCell();number.className="nd-provider-row-number";number.textContent=String(numbers.get(point));const nameCell=row.insertCell();nameCell.append(nameNode(point));if(point.pending)nameCell.append(pendingNote(point));row.insertCell().textContent=point.city||'Keine Ortsangabe';const distanceCell=row.insertCell();distanceCell.className='provider-distance-cell';if(origin&&valid(point))distanceCell.append(numericValue(distance(point),'km',2));else distanceCell.textContent=km(point);row.insertCell().append(ratingCell(point,'worsening'));row.insertCell().append(ratingCell(point,'improvement'));row.insertCell().append(ratingCell(point,'healing'));row.insertCell().append(showButton(point,true));});list.append(table);
    }else{
      list.className='nd-map-results doctor-card-grid';
      rows.forEach(point=>{
        const card=document.createElement('article');card.className='doctor-card';if(point.pending){card.classList.add('catalog-pending-provider-card');card.append(pendingNote(point));}
        const header=document.createElement('div');header.className='nd-provider-heading';
        const heading=document.createElement('h4');heading.append(nameNode(point));
        const distanceLabel=document.createElement('span');distanceLabel.className='nd-provider-distance';distanceLabel.textContent=km(point);
        header.append(heading);if(distanceLabel.textContent)header.append(distanceLabel);card.append(header);
        const place=document.createElement('p');place.className='nd-provider-place';place.textContent=point.place||'Keine Ortsangabe';card.append(place);
        const footer=document.createElement('div');footer.className='nd-provider-footer';
        const status=document.createElement('span');status.className='nd-provider-status';status.textContent=point.status;
        card.append(positiveNode(point));footer.append(showButton(point));card.append(footer);list.append(card);
      });
    }
  }
  function render(entry) {
    const {host,map} = entry;
    const points=filteredProviders(entry).filter(valid);
    host.querySelector('input').value = origin?.label || '';
    host.querySelector('[data-map-clear]').classList.toggle('is-hidden',!origin);
    renderProviders(entry);
    const closest=origin ? [...points].sort((a,b)=>distance(a)-distance(b))[0] : null;
    renderTravel(entry,closest);
    host.querySelector('[data-map-status]').textContent='';
    if (!map) return;
    syncMarkers(entry,points);
    if(entry.radiusCircle) map.removeLayer(entry.radiusCircle);
    if(entry.originMarker) map.removeLayer(entry.originMarker);
    const bounds=points.map(p=>[p.lat,p.lng]);
    if(origin){entry.originMarker=L.marker([origin.lat,origin.lng],{icon:markerIcon(true)}).bindPopup(document.createTextNode('Dein Ausgangsort: '+origin.label)).addTo(map);bounds.push([origin.lat,origin.lng]);}
    const radius=host.querySelector('[data-radius]');
    if(origin && (host.dataset.locationMode||'radius')==='radius' && host.querySelector('[data-radius-enabled]').checked && radius.value && radius.validity.valid){
      entry.radiusCircle=L.circle([origin.lat,origin.lng],{radius:Number(radius.value)*1000,color:'#0875ee',weight:2,fillOpacity:0.06}).addTo(map);
      map.fitBounds(entry.radiusCircle.getBounds(),{padding:[24,24],animate:false});
    } else if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:8,animate:false});else map.setView([51.16,10.45],5);
  }
  entries.forEach(entry=>{
    const filterPanel=document.createElement('div');filterPanel.className='nd-provider-filter-panel';
    const specialtyLabel=document.createElement('label');specialtyLabel.textContent='Fachrichtung';
    const specialtySelect=document.createElement('select');specialtySelect.dataset.providerSpecialty='';
    const allSpecialties=document.createElement('option');allSpecialties.value='';allSpecialties.textContent='Alle Fachrichtungen';specialtySelect.append(allSpecialties);
    [...new Set(entry.providers.flatMap(p=>p.specialties||[]))].sort((a,b)=>a.localeCompare(b,'de')).forEach(value=>{const option=document.createElement('option');option.value=option.textContent=value;specialtySelect.append(option);});
    specialtyLabel.append(specialtySelect);filterPanel.append(specialtyLabel);
    specialtySelect.addEventListener('change',()=>render(entry));
    const ratingBlock=document.createElement('fieldset');ratingBlock.className='nd-provider-rating-block';
    const legend=document.createElement('legend');legend.textContent='Bewertung';ratingBlock.append(legend);
    for(const [key,title,initial] of [['improvement','Verbesserung (mind.)',0],['healing','Heilung (mind.)',0],['worsening','Verschlechterung (höchstens)',100]]){
      const label=document.createElement('label');label.textContent=title;
      const row=document.createElement('div');row.className='nd-provider-rating-row';
      const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=initial;slider.dataset.ratingFilter=key;slider.setAttribute('aria-label',title);
      const number=document.createElement('input');number.type='number';number.min='0';number.max='100';number.step='1';number.value=initial;number.setAttribute('aria-label',title+' in Prozent');
      const unit=document.createElement('span');unit.textContent='%';
      slider.addEventListener('input',()=>{number.value=slider.value;render(entry);});
      number.addEventListener('input',()=>{if(number.value===''||!number.validity.valid)return;slider.value=number.value;render(entry);});
      row.append(slider,number,unit);label.append(row);ratingBlock.append(label);
    }
    const searchPanel=entry.host.querySelector('.doctor-results-search-panel');
    const searchRow=searchPanel.querySelector('.doctor-results-search-row');
    const leftColumn=document.createElement('fieldset');leftColumn.className='nd-provider-search-fields';
    const parameterLegend=document.createElement('legend');parameterLegend.textContent='Parameter';leftColumn.append(parameterLegend);
    leftColumn.append(searchRow.querySelector('.doctor-results-search-field'),specialtyLabel,searchRow.querySelector('.doctor-results-sort-field'));
    searchRow.remove();filterPanel.append(leftColumn,ratingBlock);searchPanel.append(filterPanel);
    const {host}=entry;const sorting=host.querySelector('[data-provider-sort]');[['number','Nummer'],['city','Ort'],['worsening','Verschlechterung'],['improvement','Verbesserung'],['healing','Heilung'],['feedback','Rückmeldungen']].forEach(([key,label])=>['asc','desc'].forEach(direction=>{const option=document.createElement('option');option.value=key+':'+direction;option.textContent=label+(direction==='asc'?' ↑':' ↓');sorting.append(option);}));sorting.value='distance:asc';
    const layout=document.createElement('div');layout.className='top-map-location-layout';const controls=host.querySelector('.top-map-location-controls'),panel=host.querySelector('.top-map-panel');controls.before(layout);layout.append(controls,panel);const notes=document.createElement('div');notes.className='nd-map-notes';layout.append(notes);notes.append(host.querySelector('[data-map-status]'));
    const cities=[...new Set(entry.providers.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
    cities.forEach(city=>{const option=document.createElement('option');option.value=city;option.textContent=city;host.querySelector('[data-provider-city]').append(option);});
    host.querySelectorAll('[data-location-mode]').forEach(button=>button.addEventListener('click',()=>{host.dataset.locationMode=button.dataset.locationMode;render(entry);}));
    host.querySelector('[data-include-no-coords]')?.addEventListener('change',()=>render(entry));
    host.querySelector('[data-provider-city]').addEventListener('change',()=>render(entry));
    host.querySelector('[data-radius-enabled]').addEventListener('change',()=>render(entry));
    host.querySelector('[data-radius]').addEventListener('input',event=>{if(event.target.validity.valid){host.querySelector('[data-radius-enabled]').checked=true;render(entry);}});
    render(entry);
    const all=document.createElement('button');all.type='button';all.textContent='Alle Behandler anzeigen';
    host.querySelector('.doctor-results-search-panel').append(all);
    all.addEventListener('click',()=>{host.dataset.locationMode='radius';const includeUnknown=host.querySelector('[data-include-no-coords]');if(includeUnknown)includeUnknown.checked=false;host.querySelector('[data-provider-specialty]').value='';host.querySelectorAll('[data-rating-filter]').forEach(slider=>{slider.value=slider.dataset.ratingFilter==='worsening'?100:0;slider.nextElementSibling.value=slider.value;});host.querySelector('[data-provider-search]').value='';host.querySelector('[data-provider-city]').value='';host.querySelector('[data-radius-enabled]').checked=false;render(entry);});
    host.querySelector('[data-provider-search]').addEventListener('input',()=>render(entry));
    host.querySelector('[data-provider-sort]').addEventListener('change',()=>renderProviders(entry));
    host.querySelectorAll('[data-provider-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.providerView;try{localStorage.setItem('lcn_result_view_preference',view);}catch{}entries.forEach(item=>{item.view=view;renderProviders(item);});}));
    const input=host.querySelector('input'),suggestions=host.querySelector('.top-map-location-suggestions');
    let timer,controller,suggestionVersion=0,activeSuggestion=-1;
    const suggestionCache=new Map();
    suggestions.setAttribute('role','listbox');
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
    suggestions.id=input.id+'-suggestions';input.setAttribute('aria-controls',suggestions.id);
    function showMessage(text){suggestions.replaceChildren();const note=document.createElement('p');note.className='location-suggestion-status';note.setAttribute('role','status');note.textContent=text;suggestions.append(note);suggestions.classList.remove('is-hidden');input.setAttribute('aria-expanded','true');activeSuggestion=-1;}
    function dismiss(){clearTimeout(timer);controller?.abort();suggestionVersion++;suggestions.classList.add('is-hidden');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');activeSuggestion=-1;}
    function paintSuggestions(results,query){
      suggestions.replaceChildren();activeSuggestion=-1;
      results.filter(valid).forEach((result,index)=>{const choice=document.createElement('button');choice.type='button';choice.id=suggestions.id+'-'+index;choice.setAttribute('role','option');choice.textContent=result.formatted||result.label||query;choice.addEventListener('click',()=>{dismiss();setOrigin(result,choice.textContent);});suggestions.append(choice);});
      if(!suggestions.childElementCount)showMessage('Kein Ort gefunden. Bitte Ort oder PLZ genauer angeben.');
      else {suggestions.classList.remove('is-hidden');input.setAttribute('aria-expanded','true');}
    }
    function suggest(){
      dismiss();const query=input.value.trim();
      if(query.length<2){showMessage('Mindestens zwei Zeichen für Ort oder PLZ eingeben.');return;}
      const cacheKey=query.toLocaleLowerCase('de');
      if(suggestionCache.has(cacheKey)){paintSuggestions(suggestionCache.get(cacheKey),query);return;}
      showMessage('Orte werden gesucht …');const version=suggestionVersion;
      timer=setTimeout(async()=>{const requestController=new AbortController();controller=requestController;
        try{const response=await fetch('api/geocode_location.php?suggest=1&q='+encodeURIComponent(query),{signal:requestController.signal});const data=await response.json();if(version!==suggestionVersion)return;if(!response.ok||!data.ok)throw new Error();const results=data.results||[];suggestionCache.set(cacheKey,results);paintSuggestions(results,query);}
        catch(error){if(error.name!=='AbortError'&&version===suggestionVersion)showMessage('Ortssuche derzeit nicht verfügbar. Bitte erneut versuchen.');}
      },150);
    }
    entry.dismiss=dismiss;
    input.addEventListener('input',suggest);
    input.addEventListener('focus',suggest);
    document.addEventListener('click',event=>{if(!event.target.closest('.top-map-location-input-row'))dismiss();});
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){dismiss();return;}
      const choices=[...suggestions.querySelectorAll('button')];
      if(!suggestions.classList.contains('is-hidden')&&choices.length&&['ArrowDown','ArrowUp'].includes(event.key)){
        event.preventDefault();activeSuggestion=(activeSuggestion+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;
        choices.forEach((choice,i)=>choice.setAttribute('aria-selected',String(i===activeSuggestion)));input.setAttribute('aria-activedescendant',choices[activeSuggestion].id);
      }else if(event.key==='Enter'&&!suggestions.classList.contains('is-hidden')&&activeSuggestion>=0){event.preventDefault();choices[activeSuggestion]?.click();}
    });
    host.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();dismiss();if(!input.value.trim()){clearOrigin();return;}
      const query=host.querySelector('input').value.trim();host.querySelector('[data-map-status]').textContent='Ausgangsort wird gesucht …';
      try{const response=await fetch('api/geocode_location.php?q='+encodeURIComponent(query));const data=await response.json();if(!response.ok||!data.ok||!valid(data.result))throw new Error();
        setOrigin(data.result,query);
      }catch{host.querySelector('[data-map-status]').textContent='Ausgangsort konnte nicht gefunden werden. Bitte Ort oder PLZ prüfen und erneut versuchen.';}
    });
    host.querySelector('[data-map-clear]').addEventListener('click',clearOrigin);
    input.addEventListener('input',()=>host.querySelector('[data-map-clear]').classList.toggle('is-hidden',!input.value.trim()));
  });
  function clearOrigin(){
    origin=null;
    try{for(const key of [sharedKey,'lcn_doctor_location_preference','lcn_treatment_location_preference'])localStorage.removeItem(key);localStorage.setItem('lcn_shared_location_cleared',String(Date.now()));}catch{}
    entries.forEach(entry=>{entry.dismiss();entry.host.querySelector('[data-provider-city]').value='';entry.host.querySelector('[data-radius-enabled]').checked=false;render(entry);});
    window.dispatchEvent(new CustomEvent('homepage:location-changed'));
  }
  function setOrigin(result,label){
    origin={lat:Number(result.lat),lng:Number(result.lng),label:result.formatted||result.label||label,city:result.city||''};
    try{localStorage.setItem(sharedKey,JSON.stringify({...origin,location:origin.label}));localStorage.removeItem('lcn_shared_location_cleared');}catch{}
    entries.forEach(render);window.dispatchEvent(new CustomEvent('homepage:location-changed'));
  }
  window.addEventListener('storage',event=>{if(![sharedKey,'lcn_shared_location_cleared'].includes(event.key))return;origin=null;try{const saved=JSON.parse(localStorage.getItem(sharedKey));if(valid(saved))origin={...saved,label:saved.location||saved.label||'Gespeicherter Standort'};}catch{}entries.forEach(render);});
  function markerIcon(red=false){
    const urls=window.LCNImages.urls;
    return L.icon({iconUrl:urls[red?'map-marker-red':'map-marker-default'],iconRetinaUrl:urls[red?'map-marker-red':'map-marker-default-retina'],shadowUrl:urls['map-marker-shadow'],iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});
  }
  function syncMarkers(entry,visiblePoints){
      if(entry.markers) new Set(entry.markers.values()).forEach(marker=>entry.map.removeLayer(marker));
      entry.markers=new Map();
      const groups=new Map();visiblePoints.forEach(point=>{const key=point.lat.toFixed(6)+','+point.lng.toFixed(6);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(point);});
      groups.forEach(points=>{
        const popup=document.createElement('div'),heading=document.createElement('strong');heading.textContent=points.length>1?points.length+' Einträge':points[0].name;popup.append(heading);
        const list=document.createElement('ul');list.className='top-map-popup-list';points.forEach(point=>{const li=document.createElement('li');li.textContent=point.name;const small=document.createElement('small');small.textContent=point.place+(point.pending?' · Prüfung ausstehend':'');li.append(small);list.append(li);});popup.append(list);
        let icon=markerIcon();if(points.length>1){const wrapper=document.createElement('div'),img=document.createElement('img'),count=document.createElement('span');img.src=window.LCNImages.urls['map-marker-default'];img.alt='';count.textContent=points.length;wrapper.append(img,count);icon=L.divIcon({className:'top-map-count-marker',html:wrapper.innerHTML,iconSize:[31,41],iconAnchor:[15,41],popupAnchor:[0,-35]});}
        const marker=L.marker([points[0].lat,points[0].lng],{icon,riseOnHover:true}).bindPopup(popup,{autoPan:false}).addTo(entry.map);window.LCNOnline?.track(marker,points.map(p=>p.dr_id));points.forEach(point=>entry.markers.set(point,marker));
      });
  }
  async function init(){
    if(!window.L){const css=document.createElement('link');css.rel='stylesheet';css.href='assets/vendor/leaflet/leaflet.css';document.head.append(css);await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/vendor/leaflet/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
    entries.forEach(entry=>{
      const canvas=entry.host.querySelector('.nd-map-canvas');entry.map=L.map(canvas,{zoomControl:false,scrollWheelZoom:false}).setView([51.1657,10.4515],6);
      L.control.zoom({position:'topright'}).addTo(entry.map);
      canvas.addEventListener('click',()=>entry.map.scrollWheelZoom.enable());canvas.addEventListener('mouseleave',()=>entry.map.scrollWheelZoom.disable());
      const tiles=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere',maxZoom:19}).addTo(entry.map);
      tiles.on('tileerror',()=>{entry.host.querySelector('[data-map-status]').textContent='Kartenhintergrund konnte nicht geladen werden. Behandler-Marker und Entfernungsliste bleiben verfügbar.';});
      new ResizeObserver(()=>{if(canvas.clientWidth){entry.map.invalidateSize();if(!entry.wasVisible){render(entry);entry.wasVisible=true;}}else entry.wasVisible=false;}).observe(canvas);render(entry);
    });
  }
  window.addEventListener('lcn-online-ready',()=>entries.forEach(render));
  init().catch(()=>entries.forEach(({host})=>{host.querySelector('.nd-map-canvas').textContent='Karte konnte nicht geladen werden. Behandler und Entfernungen stehen weiterhin in der Liste.';}));
})();


