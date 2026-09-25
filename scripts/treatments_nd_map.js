(() => {
  'use strict';
  const hosts = [...document.querySelectorAll('.nd-provider-map')];
  if (!hosts.length) return;
  const sharedKey = 'lcn_shared_location_preference';
  let origin = null;
  const valid = v => v && v.lat !== null && v.lng !== null && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)) && Math.abs(Number(v.lat)) <= 90 && Math.abs(Number(v.lng)) <= 180 && !(Number(v.lat) === 0 && Number(v.lng) === 0);
  try { const saved = JSON.parse(localStorage.getItem(sharedKey)); if (valid(saved)) origin = {...saved, label:saved.location || saved.label || 'Gespeicherter Standort'}; } catch {}
  let view='cards';try{view=localStorage.getItem('lcn_result_view_preference')==='table'?'table':'cards';}catch{}
  const entries = hosts.map(host => {const providers=JSON.parse(host.querySelector('.nd-map-data').textContent);return {host,providers,points:providers.filter(valid),map:null,view};});
  function distance(point) {
    const rad = v => Number(v)*Math.PI/180, a = rad(point.lat)-rad(origin.lat), b = rad(point.lng)-rad(origin.lng);
    const h = Math.sin(a/2)**2+Math.cos(rad(origin.lat))*Math.cos(rad(point.lat))*Math.sin(b/2)**2;
    return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
  }
  function renderProviders(entry){
    const {host,providers,map}=entry,list=host.querySelector('.nd-map-results');list.replaceChildren();
    const query=host.querySelector('[data-provider-search]').value.trim().toLocaleLowerCase('de');
    const [sort,direction]=host.querySelector('[data-provider-sort]').value.split(':');
    const rows=providers.filter(p=>(p.name+' '+p.place).toLocaleLowerCase('de').includes(query)).sort((a,b)=>{if(sort==='distance'&&origin){if(!valid(a))return valid(b)?1:0;if(!valid(b))return -1;return (distance(a)-distance(b))*(direction==='desc'?-1:1);}return a.name.localeCompare(b.name,'de')*(direction==='desc'?-1:1);});
    host.querySelector('[data-provider-count]').textContent=rows.length+' von '+providers.length+' Anbietern'+(sort==='distance'&&!origin?' · Für die Entfernungssortierung bitte oben einen Standort eingeben.':'');
    host.querySelectorAll('[data-provider-view]').forEach(b=>{const active=b.dataset.providerView===entry.view;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
    if(!rows.length){list.textContent='Keine Anbieter zu dieser Suche gefunden.';return;}
    function nameNode(point){const node=document.createElement(point.href?'a':'strong');node.textContent=point.name;if(point.href)node.href=point.href;return node;}
    function showButton(point){const button=document.createElement('button');button.type='button';button.className='nd-show-provider';button.textContent=valid(point)?'Auf Karte zeigen':'Kein Kartenstandort';button.disabled=!valid(point);button.addEventListener('click',()=>{if(!map)return;host.querySelector('.top-map-content').classList.remove('is-collapsed');const header=host.querySelector('.top-map-header');header.classList.remove('is-collapsed');header.setAttribute('aria-expanded','true');map.invalidateSize();map.setView([point.lat,point.lng],12);entry.markers.get(point)?.openPopup();host.querySelector('.nd-map-canvas').scrollIntoView({block:'center'});});return button;}
    const km=p=>!valid(p)?'Keine Koordinaten':origin?distance(p).toLocaleString('de-DE',{maximumFractionDigits:1})+' km Luftlinie':'Ausgangsort fehlt';
    if(entry.view==='table'){
      list.className='nd-map-results nd-provider-table-wrap';const table=document.createElement('table');table.className='nd-provider-table';const head=table.createTHead().insertRow();['Anbieter','Ort','Entfernung','Zuordnung','Karte'].forEach(label=>{const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);});const body=table.createTBody();rows.forEach(point=>{const row=body.insertRow();row.insertCell().append(nameNode(point));[point.place||'Keine Ortsangabe',km(point),point.status].forEach(value=>row.insertCell().textContent=value);row.insertCell().append(showButton(point));});list.append(table);
    }else{
      list.className='nd-map-results doctor-card-grid';rows.forEach(point=>{const card=document.createElement('article');card.className='doctor-card';const heading=document.createElement('h4');heading.append(nameNode(point));card.append(heading);[point.place||'Keine Ortsangabe',point.status,km(point)].forEach(value=>{const p=document.createElement('p');p.textContent=value;card.append(p);});card.append(showButton(point));list.append(card);});
    }
  }
  function render(entry) {
    const {host,points,map} = entry;
    host.querySelector('input').value = origin?.label || '';
    host.querySelector('[data-map-clear]').classList.toggle('is-hidden',!origin);
    renderProviders(entry);
    let nearest=host.querySelector('.ux-nearest');
    if(!nearest){nearest=document.createElement('p');nearest.className='ux-nearest';host.querySelector('.top-map-location-controls').after(nearest);}
    const closest=origin ? [...points].sort((a,b)=>distance(a)-distance(b))[0] : null;
    nearest.textContent=closest ? 'Nächstgelegener Anbieter mit Koordinaten: '+closest.name+' · '+distance(closest).toLocaleString('de-DE',{maximumFractionDigits:1})+' km Luftlinie' : 'PLZ oder Ort eingeben, um den nächstgelegenen Anbieter zu ermitteln.';
    host.querySelector('[data-map-status]').textContent=points.length ? points.length+' Anbieterstandorte'+(origin?' · Entfernungen ab '+origin.label:'. Ausgangsort eingeben, um Entfernungen zu sehen.') : 'Für diese Behandlung sind noch keine Anbieterkoordinaten hinterlegt.';
    if (!map) return;
    if(entry.originMarker) map.removeLayer(entry.originMarker);
    const bounds=points.map(p=>[p.lat,p.lng]);
    if(origin){entry.originMarker=L.marker([origin.lat,origin.lng],{icon:markerIcon(true)}).bindPopup(document.createTextNode('Dein Ausgangsort: '+origin.label)).addTo(map);bounds.push([origin.lat,origin.lng]);}
    if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:8,animate:false});else map.setView([51.16,10.45],5);
  }
  entries.forEach(entry=>{
    const {host}=entry;render(entry);
    const all=document.createElement('button');all.type='button';all.textContent='Alle Anbieter anzeigen';
    host.querySelector('.doctor-results-search-panel').append(all);
    all.addEventListener('click',()=>{host.querySelector('[data-provider-search]').value='';renderProviders(entry);});
    host.querySelector('[data-provider-search]').addEventListener('input',()=>renderProviders(entry));
    host.querySelector('[data-provider-sort]').addEventListener('change',()=>renderProviders(entry));
    host.querySelectorAll('[data-provider-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.providerView;try{localStorage.setItem('lcn_result_view_preference',view);}catch{}entries.forEach(item=>{item.view=view;renderProviders(item);});}));
    const header=host.querySelector('.top-map-header'),content=host.querySelector('.top-map-content');
    header.addEventListener('click',()=>{const collapsed=content.classList.toggle('is-collapsed');header.classList.toggle('is-collapsed',collapsed);header.setAttribute('aria-expanded',String(!collapsed));if(!collapsed)entry.map?.invalidateSize();});
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
    origin={lat:Number(result.lat),lng:Number(result.lng),label:result.formatted||result.label||label};
    try{localStorage.setItem(sharedKey,JSON.stringify({...origin,location:origin.label}));localStorage.removeItem('lcn_shared_location_cleared');}catch{}
    entries.forEach(render);window.dispatchEvent(new CustomEvent('homepage:location-changed'));
  }
  function markerIcon(red=false){return L.divIcon({className:'nd-local-marker'+(red?' nd-local-origin':''),html:'<span aria-hidden="true">●</span>',iconSize:[28,36],iconAnchor:[14,36],popupAnchor:[0,-32]});}  async function init(){
    if(!window.L){const css=document.createElement('link');css.rel='stylesheet';css.href='assets/vendor/leaflet/leaflet.css';document.head.append(css);await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/vendor/leaflet/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
    entries.forEach(entry=>{
      const canvas=entry.host.querySelector('.nd-map-canvas');entry.map=L.map(canvas,{zoomControl:false,scrollWheelZoom:false}).setView([51.1657,10.4515],6);
      L.control.zoom({position:'topright'}).addTo(entry.map);
      canvas.addEventListener('click',()=>entry.map.scrollWheelZoom.enable());canvas.addEventListener('mouseleave',()=>entry.map.scrollWheelZoom.disable());
      const tiles=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere',maxZoom:19}).addTo(entry.map);
      tiles.on('tileerror',()=>{entry.host.querySelector('[data-map-status]').textContent='Kartenhintergrund konnte nicht geladen werden. Anbieter-Marker und Entfernungsliste bleiben verfügbar.';});
      entry.markers=new Map();
      const groups=new Map();entry.points.forEach(point=>{const key=point.lat.toFixed(6)+','+point.lng.toFixed(6);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(point);});
      groups.forEach(points=>{
        const popup=document.createElement('div'),heading=document.createElement('strong');heading.textContent=points.length>1?points.length+' Einträge':points[0].name;popup.append(heading);
        const list=document.createElement('ul');list.className='top-map-popup-list';points.forEach(point=>{const li=document.createElement('li');li.textContent=point.name;const small=document.createElement('small');small.textContent=point.place+' · '+point.status;li.append(small);list.append(li);});popup.append(list);
        let icon=markerIcon();if(points.length>1){const wrapper=document.createElement('div'),img=document.createElement('img'),count=document.createElement('span');img.src=window.LCNImages.urls['map-marker-default'];img.alt='';count.textContent=points.length;wrapper.append(img,count);icon=L.divIcon({className:'top-map-count-marker',html:wrapper.innerHTML,iconSize:[31,41],iconAnchor:[15,41],popupAnchor:[0,-35]});}
        const marker=L.marker([points[0].lat,points[0].lng],{icon,riseOnHover:true}).bindPopup(popup).addTo(entry.map);points.forEach(point=>entry.markers.set(point,marker));
      });
      new ResizeObserver(()=>{if(canvas.clientWidth){entry.map.invalidateSize();if(!entry.wasVisible){render(entry);entry.wasVisible=true;}}else entry.wasVisible=false;}).observe(canvas);render(entry);
    });
  }
  init().catch(()=>entries.forEach(({host})=>{host.querySelector('.nd-map-canvas').textContent='Karte konnte nicht geladen werden. Anbieter und Entfernungen stehen weiterhin in der Liste.';}));
})();

