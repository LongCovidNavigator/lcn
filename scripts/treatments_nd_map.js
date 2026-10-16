(() => {
  'use strict';
  const hosts = [...document.querySelectorAll('.nd-provider-map')];
  if (!hosts.length) return;
  const sharedKey = 'lcn_shared_location_preference';
  let origin = null;
  const valid = v => v && v.lat !== null && v.lng !== null && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)) && Math.abs(Number(v.lat)) <= 90 && Math.abs(Number(v.lng)) <= 180 && !(Number(v.lat) === 0 && Number(v.lng) === 0);
  try { const saved = JSON.parse(localStorage.getItem(sharedKey)); if (valid(saved)) origin = {...saved, label:saved.location || saved.label || 'Gespeicherter Standort'}; } catch {}
  let relationFeedback={};window.addEventListener('lcn-relation-feedback',event=>{relationFeedback=event.detail||{};entries.forEach(renderProviders);});let ratings={},ratingsLoaded=false;const positiveNode=point=>{const el=document.createElement('span'),r=ratings[point.dr_id];el.className='catalog-positive-rating';el.textContent=r?'Verbesserung '+r.improvement_percent.toLocaleString('de-DE')+' % · Heilung '+r.healing_percent.toLocaleString('de-DE')+' %':ratingsLoaded?'Noch keine Bewertungen':'Bewertungen werden geladen …';el.title='Verbesserung und Heilung'+(r?' · '+r.positive+' von '+r.total+' Bewertungen':'');return el;};
  function ratingCell(point,key){const node=document.createElement('span'),r=ratings[point.dr_id];node.className='catalog-rating-number';node.textContent=r?r[key+'_percent'].toLocaleString('de-DE')+' %':'—';node.title=r?r[key]+' von '+r.total+' Bewertungen':ratingsLoaded?'Noch keine Bewertungen':'Bewertungen werden geladen …';return node;}
  let view='cards';try{view=localStorage.getItem('lcn_result_view_preference')==='table'?'table':'cards';}catch{}
  const entries = hosts.map(host => {const providers=JSON.parse(host.querySelector('.nd-map-data').textContent);return {host,providers,points:providers.filter(valid),map:null,view};});
  window.addEventListener('lcn-pending-providers',event=>{entries.forEach(entry=>{entry.providers=entry.providers.filter(p=>!p.pending);const ids=new Set(entry.providers.map(p=>Number(p.dr_id)));entry.providers.push(...(event.detail||[]).filter(p=>!p.dr_id||!ids.has(Number(p.dr_id))));entry.points=entry.providers.filter(valid);const citySelect=entry.host.querySelector('[data-provider-city]');[...new Set(entry.providers.map(p=>p.city).filter(Boolean))].forEach(city=>{if(![...citySelect.options].some(o=>o.value===city)){const option=document.createElement('option');option.value=option.textContent=city;citySelect.append(option);}});render(entry);});});
  let ratingRequest=0;async function loadRatings(){const request=++ratingRequest;try{const demo=document.getElementById('nd-demo-header-toggle')?.getAttribute('aria-pressed')==='true';const response=await fetch('api/provider_positive_ratings.php?include_dummy='+(demo?'1':'0'));const data=await response.json();if(request!==ratingRequest||!data.ok)return;ratings=data.ratings;ratingsLoaded=true;entries.forEach(renderProviders);}catch{}}
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
    if(!box){box=document.createElement('section');box.className='travel-estimate';box.dataset.travelEstimate='';entry.host.querySelector('.ux-nearest').after(box);}
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
    const city=host.querySelector('[data-provider-city]').value;
    const radius=host.querySelector('[data-radius]');
    const enabled=host.querySelector('[data-radius-enabled]').checked;
    radius.disabled=!enabled;
    const usable=Boolean(origin && radius.value && radius.validity.valid);
    host.querySelector('[data-location-filter-note]').textContent=enabled && !origin ? 'Bitte zuerst PLZ oder Ort eingeben und einen Ausgangsort übernehmen.' : enabled && !usable ? 'Bitte einen ganzen Radius zwischen 1 und 2000 km eingeben.' : 'Radius ab dem übernommenen Ausgangsort · Entfernung als Luftlinie.';
    return providers.filter(p=>(p.name+' '+p.place).toLocaleLowerCase('de').includes(query) && (!city || p.city===city) && (!enabled || !usable || (valid(p) && distance(p)<=Number(radius.value))));
  }
  function renderProviders(entry){
    const {host,providers,map}=entry,list=host.querySelector('.nd-map-results');list.replaceChildren();
    const [sort,direction]=host.querySelector('[data-provider-sort]').value.split(':');
    const onlineGroup=p=>{const access=window.LCNOnline?.get(p.dr_id);return access?.first&&access.follow?0:2;};
    const groupLabels=['100 % online möglich · Erst- und Folgetermin','','Weitere Behandler'];
    const defaultOrder=[...providers].sort((a,b)=>onlineGroup(a)-onlineGroup(b)||(origin?(valid(a)&&valid(b)?distance(a)-distance(b):valid(a)?-1:valid(b)?1:0):0)||a.name.localeCompare(b.name,'de'));
    const numbers=new Map(defaultOrder.map((p,i)=>[p,i+1]));
    const feedbackScore=p=>{const v=relationFeedback[p.dr_id?'d:'+p.dr_id+':t:'+document.querySelector('.ux-detail[data-treatment-id]').dataset.treatmentId:'s:'+p.submission_id];return (v?.confirm||0)-(v?.oppose||0);};
    const value=(p,key)=>key==='number'?numbers.get(p):key==='city'?(p.city||''):key==='distance'?(origin&&valid(p)?distance(p):null):key==='improvement'||key==='healing'?(ratings[p.dr_id]?.[key+'_percent']??null):key==='feedback'?feedbackScore(p):p.name;
    const rows=filteredProviders(entry).sort((a,b)=>{const group=onlineGroup(a)-onlineGroup(b);if(group)return group;const x=value(a,sort),y=value(b,sort);if(x===null)return y===null?0:1;if(y===null)return -1;const cmp=typeof x==='string'?x.localeCompare(y,'de',{numeric:true}):x-y;return cmp*(direction==='desc'?-1:1)||a.name.localeCompare(b.name,'de');});
    function changeSort(key){const next=sort===key?(direction==='asc'?'desc':'asc'):(['improvement','healing','feedback'].includes(key)?'desc':'asc');host.querySelector('[data-provider-sort]').value=key+':'+next;renderProviders(entry);}    host.querySelector('[data-provider-count]').textContent=rows.length+' von '+providers.length+' Behandlern'+(sort==='distance'&&!origin?' · Für die Entfernungssortierung bitte oben einen Standort eingeben.':'');
    host.querySelectorAll('[data-provider-view]').forEach(b=>{const active=b.dataset.providerView===entry.view;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
    if(!rows.length){list.textContent=providers.length?'Keine passenden Behandler. Bitte ändere den Suchtext oder die Orts- und Radiusfilter.':'Für diese Therapie sind noch keine bestätigten Behandler hinterlegt.';return;}
    function nameNode(point){const node=document.createElement(point.href?'a':'strong');node.textContent=point.name;if(point.href)node.href=point.href;if(!point.href&&point.pending)node.dataset.catalogFeedbackKey='s:'+point.submission_id;return node;}
    function pendingNote(point){const note=document.createElement('small');note.className='catalog-pending-note';note.textContent='Prüfung ausstehend';if(point.own)note.title='Dein Vorschlag · Prüfung ausstehend';return note;}
    function showButton(point,compact=false){const button=document.createElement('button');button.type='button';button.className='nd-show-provider';button.textContent=valid(point)?(compact?'Karte':'Auf Karte zeigen'):(compact?'—':'Standort nicht verfügbar');button.title=valid(point)?'Auf Karte zeigen':'Standort nicht verfügbar';button.disabled=!valid(point);button.addEventListener('click',()=>{if(!map)return;host.querySelector('.top-map-content').classList.remove('is-collapsed');map.invalidateSize();if(origin)map.fitBounds([[origin.lat,origin.lng],[point.lat,point.lng]],{padding:[64,64],maxZoom:12});else map.setView([point.lat,point.lng],12);entry.markers.get(point)?.openPopup();host.querySelector('.nd-map-canvas').scrollIntoView({block:'center'});});return button;}
    const km=p=>!valid(p)?'Standort nicht verfügbar':origin?distance(p).toLocaleString('de-DE',{maximumFractionDigits:1})+' km Luftlinie':'Ausgangsort fehlt';
    if(entry.view==='table'){
      list.className='nd-map-results nd-provider-table-wrap';const table=document.createElement('table');table.className='nd-provider-table';const head=table.createTHead().insertRow();[['Nr.','number'],['Behandler','name'],['Ort','city'],['Entfernung','distance'],['Verbesserung','improvement'],['Heilung','healing'],['Karte',null],['Rückmeldungen','feedback']].forEach(([label,key])=>{const th=document.createElement('th');th.scope='col';if(key==='feedback'){th.dataset.catalogReportHeading='';th.className='catalog-report-column';}if(!key){th.textContent=label;th.className='nd-provider-map-column';}else{const button=document.createElement('button');button.type='button';button.textContent=label+(sort===key?(direction==='asc'?' ↑':' ↓'):' ↕');button.disabled=key==='distance'&&!origin;button.title='Nach '+label+' sortieren';button.addEventListener('click',()=>changeSort(key));th.setAttribute('aria-sort',sort===key?(direction==='asc'?'ascending':'descending'):'none');th.append(button);}head.append(th);});const body=table.createTBody();let previousGroup=-1;rows.forEach((point,index)=>{const group=onlineGroup(point);if(group!==previousGroup){const separator=body.insertRow();separator.className='nd-provider-group-row';const title=document.createElement('th');title.scope='rowgroup';title.colSpan=8;title.textContent=groupLabels[group];separator.append(title);previousGroup=group;}const row=body.insertRow();const number=row.insertCell();number.className="nd-provider-row-number";number.textContent=String(numbers.get(point));const nameCell=row.insertCell();nameCell.append(nameNode(point));if(point.pending)nameCell.append(pendingNote(point));[point.city||'Keine Ortsangabe',km(point)].forEach(value=>row.insertCell().textContent=value);row.insertCell().append(ratingCell(point,'improvement'));row.insertCell().append(ratingCell(point,'healing'));row.insertCell().append(showButton(point,true));});list.append(table);
    }else{
      list.className='nd-map-results doctor-card-grid';
      let previousGroup=-1;rows.forEach(point=>{const group=onlineGroup(point);if(group!==previousGroup){const title=document.createElement('h4');title.className='nd-provider-group-title';title.textContent=groupLabels[group];list.append(title);previousGroup=group;}
        const card=document.createElement('article');card.className='doctor-card';if(point.pending){card.classList.add('catalog-pending-provider-card');card.append(pendingNote(point));}
        const header=document.createElement('div');header.className='nd-provider-heading';
        const heading=document.createElement('h4');heading.append(nameNode(point));
        const distanceLabel=document.createElement('span');distanceLabel.className='nd-provider-distance';distanceLabel.textContent=km(point);
        header.append(heading,distanceLabel);card.append(header);
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
    let nearest=host.querySelector('.ux-nearest');
    if(!nearest){nearest=document.createElement('p');nearest.className='ux-nearest';host.querySelector('.top-map-location-layout').before(nearest);}
    const closest=origin ? [...points].sort((a,b)=>distance(a)-distance(b))[0] : null;
    nearest.textContent=closest ? 'Nächstgelegener Behandler im Filter mit Koordinaten: '+closest.name+' · '+distance(closest).toLocaleString('de-DE',{maximumFractionDigits:1})+' km Luftlinie' : origin ? 'Keine Behandler mit Koordinaten im gewählten Filter.' : 'PLZ oder Ort eingeben, um den nächstgelegenen Behandler zu ermitteln.';
    renderTravel(entry,closest);
    host.querySelector('[data-map-status]').textContent=points.length ? points.length+' Behandlerstandorte'+(origin?' · Entfernungen ab '+origin.label:'. Ausgangsort eingeben, um Entfernungen zu sehen.') : 'Keine Behandlerstandorte im gewählten Filter.';
    if (!map) return;
    syncMarkers(entry,points);
    if(entry.radiusCircle) map.removeLayer(entry.radiusCircle);
    if(entry.originMarker) map.removeLayer(entry.originMarker);
    const bounds=points.map(p=>[p.lat,p.lng]);
    if(origin){entry.originMarker=L.marker([origin.lat,origin.lng],{icon:markerIcon(true)}).bindPopup(document.createTextNode('Dein Ausgangsort: '+origin.label)).addTo(map);bounds.push([origin.lat,origin.lng]);}
    const radius=host.querySelector('[data-radius]');
    if(origin && host.querySelector('[data-radius-enabled]').checked && radius.value && radius.validity.valid){
      entry.radiusCircle=L.circle([origin.lat,origin.lng],{radius:Number(radius.value)*1000,color:'#0875ee',weight:2,fillOpacity:0.06,dashArray:'6 5'}).addTo(map);
      map.fitBounds(entry.radiusCircle.getBounds(),{padding:[24,24],animate:false});
    } else if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:8,animate:false});else map.setView([51.16,10.45],5);
  }
  entries.forEach(entry=>{
    const {host}=entry;const sorting=host.querySelector('[data-provider-sort]');[['number','Nummer'],['city','Ort'],['improvement','Verbesserung'],['healing','Heilung'],['feedback','Rückmeldungen']].forEach(([key,label])=>['asc','desc'].forEach(direction=>{const option=document.createElement('option');option.value=key+':'+direction;option.textContent=label+(direction==='asc'?' ↑':' ↓');sorting.append(option);}));sorting.value='distance:asc';const explanation=document.createElement('p');explanation.className='nd-provider-online-explanation';explanation.textContent='Vorne stehen nur Angebote, bei denen Erst- und Folgetermin online bestätigt sind. Ein Online-Ersttermin allein reicht dafür nicht aus. Innerhalb der Gruppen wird standardmäßig nach Entfernung sortiert. Online-Termine bedeuten nicht automatisch, dass die gesamte Behandlung online erfolgt.';host.querySelector('[data-provider-count]').before(explanation);
    const layout=document.createElement('div');layout.className='top-map-location-layout';const controls=host.querySelector('.top-map-location-controls'),panel=host.querySelector('.top-map-panel');controls.before(layout);layout.append(controls,panel);const notes=document.createElement('div');notes.className='nd-map-notes';layout.after(notes);notes.append(host.querySelector('[data-map-status]'));
    const cities=[...new Set(entry.providers.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
    cities.forEach(city=>{const option=document.createElement('option');option.value=city;option.textContent=city;host.querySelector('[data-provider-city]').append(option);});
    host.querySelector('[data-provider-city]').addEventListener('change',()=>render(entry));
    host.querySelector('[data-radius-enabled]').addEventListener('change',()=>render(entry));
    host.querySelector('[data-radius]').addEventListener('input',()=>render(entry));
    render(entry);
    const all=document.createElement('button');all.type='button';all.textContent='Alle Behandler anzeigen';
    host.querySelector('.doctor-results-search-panel').append(all);
    all.addEventListener('click',()=>{host.querySelector('[data-provider-search]').value='';host.querySelector('[data-provider-city]').value='';host.querySelector('[data-radius-enabled]').checked=false;render(entry);});
    host.querySelector('[data-provider-search]').addEventListener('input',()=>render(entry));
    host.querySelector('[data-provider-sort]').addEventListener('change',()=>renderProviders(entry));
    host.querySelectorAll('[data-provider-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.providerView;try{localStorage.setItem('lcn_result_view_preference',view);}catch{}entries.forEach(item=>{item.view=view;renderProviders(item);});}));
    const input=host.querySelector('input'),suggestions=host.querySelector('.top-map-location-suggestions');
    let timer,controller;
    function dismiss(){clearTimeout(timer);controller?.abort();suggestions.classList.add('is-hidden');}
    entry.dismiss=dismiss;
    input.addEventListener('input',()=>{dismiss();const query=input.value.trim();if(query.length<3)return;timer=setTimeout(async()=>{controller=new AbortController();try{const response=await fetch('api/geocode_location.php?q='+encodeURIComponent(query),{signal:controller.signal});const data=await response.json();suggestions.replaceChildren();(data.results||[]).filter(valid).forEach(result=>{const choice=document.createElement('button');choice.type='button';choice.textContent=result.formatted||result.label||query;choice.addEventListener('click',()=>{dismiss();setOrigin(result,choice.textContent);});suggestions.append(choice);});suggestions.classList.toggle('is-hidden',!suggestions.childElementCount);}catch{suggestions.classList.add('is-hidden');}},300);});
    document.addEventListener('click',event=>{if(!event.target.closest('.top-map-location-input-row'))dismiss();});
    input.addEventListener('keydown',event=>{if(event.key==='Escape')dismiss();});
    host.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();dismiss();const button=event.submitter;button.disabled=true;
      const query=host.querySelector('input').value.trim();host.querySelector('[data-map-status]').textContent='Ausgangsort wird gesucht …';
      try{const response=await fetch('api/geocode_location.php?q='+encodeURIComponent(query));const data=await response.json();if(!response.ok||!data.ok||!valid(data.result))throw new Error();
        setOrigin(data.result,query);
      }catch{host.querySelector('[data-map-status]').textContent='Ausgangsort konnte nicht gefunden werden. Bitte Ort oder PLZ prüfen und erneut versuchen.';}finally{button.disabled=false;}
    });
    host.querySelector('[data-map-clear]').addEventListener('click',()=>{entry.dismiss();origin=null;try{localStorage.removeItem(sharedKey);localStorage.setItem('lcn_shared_location_cleared','1');}catch{}entries.forEach(render);});
  });
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


