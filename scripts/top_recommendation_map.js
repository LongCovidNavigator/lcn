(function () {
    const isDoctors = document.body.dataset.recommendation === "doctors";
    const isTreatments = document.body.dataset.recommendation === "treatments";
    if(!isDoctors&&!isTreatments)return;
    const sharedKey='lcn_shared_location_preference',clearedKey='lcn_shared_location_cleared',germany={lat:51.1657,lng:10.4515};
    const radiusKey = 'lcn_top_recommendation_radius';
    let map,markerLayer,userMarker,currentLocation,suggestionTimer,suggestionController=[],allPoints=[],radiusCircle;
    let publishedRadius = '';
    document.addEventListener('DOMContentLoaded',init);

    async function init(){
        const reference=document.querySelector(isDoctors?'.featured-experts':'.featured-treatments');if(!reference)return;
        const section=document.createElement('section');section.className='top-recommendation-map-section';section.innerHTML=locationPanelMarkup();reference.before(section);
        bindControls();
        restoreRadiusPreference();
        ['top-map-radius-enabled','top-map-radius'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{saveRadiusPreference();renderFiltered();}));
        document.getElementById('top-map-city').addEventListener('input',renderFiltered);
        document.getElementById('top-map-reset')?.addEventListener('click',()=>{document.getElementById('top-map-radius-enabled').checked=false;document.getElementById('top-map-city').value='';saveRadiusPreference();renderFiltered();});
        restoreSharedLocation();window.addEventListener('storage',handleStorage);
        renderFiltered();
        window.addEventListener('homepage:experts-loaded',()=>{if(isDoctors&&map)refreshMap();});
        try{await ensureLeaflet();initMap();await refreshMap();}catch(error){setStatus('Die Karte konnte nicht geladen werden. Bitte die Seite erneut laden.',true);}
    }
    function readRadiusPreference() {
        try { return JSON.parse(localStorage.getItem(radiusKey)); } catch (_) { return null; }
    }
    function restoreRadiusPreference() {
        const saved = readRadiusPreference();
        if (!saved) return;
        const input = document.getElementById('top-map-radius');
        const initialValue = input.value;
        input.value = saved.km;
        if (!input.value || !input.validity.valid) input.value = initialValue;
        document.getElementById('top-map-radius-enabled').checked = saved.enabled === true;
    }
    function saveRadiusPreference() {
        const input = document.getElementById('top-map-radius');
        const enabled = document.getElementById('top-map-radius-enabled').checked;
        const km = input.value && input.validity.valid ? Number(input.value) : readRadiusPreference()?.km;
        try { localStorage.setItem(radiusKey, JSON.stringify({ km, enabled })); } catch (_) {}
    }
    function locationPanelMarkup(){return `
        <div class="top-map-location-controls doctor-detail-location-address">
            <h4 class="nd-location-title">Standortsuche</h4>
            <form id="top-map-location-form" role="search" autocomplete="off" aria-label="Standortsuche">
                <div class="nd-location-heading"><label for="top-map-location-input">Adresse, PLZ oder Ort</label><button id="top-map-location-clear" class="is-hidden" type="button" aria-label="Standort entfernen">×</button></div>
                <div class="top-map-location-input-row own-location-control"><input id="top-map-location-input" name="location" type="search" placeholder="z. B. Musterstadt" autocomplete="off" spellcheck="false" enterkeyhint="search"><div id="top-map-location-suggestions" class="top-map-location-suggestions is-hidden" role="listbox"></div></div>
                <button class="top-map-location-submit nd-location-submit" type="submit">Standort übernehmen</button>
            </form>
            <div class="doctor-location-filters nd-location-filters"><div class="nd-radius-inline">
                <label class="nd-radius-value"><span>Radius in Kilometern</span><input type="number" id="top-map-radius" min="1" max="2000" step="1" value="100" disabled></label>
                <label class="nd-radius-toggle"><span>Radius aktivieren</span><input type="checkbox" role="switch" id="top-map-radius-enabled"></label>
            </div><p id="top-map-filter-note" class="lcn-map-help" role="status" hidden></p><select id="top-map-city" aria-label="Ort filtern" hidden><option value="">Alle Städte</option></select></div>
            <div class="nd-location-summary"><span>Entfernung zum nächsten Standort</span><strong id="top-map-distance">Standort wählen</strong><span id="top-map-status" class="top-map-status" role="status" aria-live="polite">Standorte werden geladen …</span></div>
        </div>
        <div class="top-map-panel"><div id="top-map-content" class="top-map-content"><div id="top-recommendation-map" aria-label="Karte der ausgewählten Standorte"></div></div></div>`;}
    function bindControls(){
        const form=document.getElementById('top-map-location-form'),input=document.getElementById('top-map-location-input');
        form.addEventListener('submit',submitLocation);input.addEventListener('input',scheduleSuggestions);
        input.addEventListener('keydown',event=>{if(event.key==='Escape'){clearTimeout(suggestionTimer);suggestionController?.abort?.();hideSuggestions();}});
        document.getElementById('top-map-location-clear').addEventListener('click',clearLocation);
        document.addEventListener('click',event=>{if(!event.target.closest('.top-map-location-input-row'))hideSuggestions();});
    }
    function restoreSharedLocation(){document.getElementById('top-map-location-input').value='';try{const stored=JSON.parse(localStorage.getItem(sharedKey)||'null');if(validLocation(stored)){currentLocation={lat:Number(stored.lat),lng:Number(stored.lng),label:String(stored.location||stored.label||'Gespeicherter Standort'),city:String(stored.city||'')};document.getElementById('top-map-location-input').value=currentLocation.label;}}catch(_){}updateClearButton();}
    async function submitLocation(event){event.preventDefault();const input=document.getElementById('top-map-location-input'),button=event.currentTarget.querySelector('[type="submit"]'),query=input.value.trim();if(!query){await clearLocation();return;}button.disabled=true;setStatus('Standort wird gesucht …');try{const response=await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`),data=await response.json();if(!response.ok||!data.ok||!data.result)throw new Error('Der Standort konnte nicht gefunden werden.');setSharedLocation(data.result,query);input.value=currentLocation.label;hideSuggestions();window.dispatchEvent(new CustomEvent('homepage:location-changed'));await refreshMap();}catch(error){setStatus(error.message||'Standort konnte nicht geladen werden.',true);}finally{button.disabled=false;}}
    function setSharedLocation(location,fallback){currentLocation={lat:Number(location.lat),lng:Number(location.lng),label:String(location.formatted||location.label||fallback),city:String(location.city||'')};localStorage.setItem(sharedKey,JSON.stringify({location:currentLocation.label,label:currentLocation.label,city:currentLocation.city,lat:currentLocation.lat,lng:currentLocation.lng}));localStorage.removeItem(clearedKey);updateClearButton();}
    async function clearLocation(){clearTimeout(suggestionTimer);suggestionController?.abort?.();document.getElementById('top-map-city').value='';document.getElementById('top-map-radius-enabled').checked=false;saveRadiusPreference();currentLocation=null;renderFiltered();document.getElementById('top-map-location-input').value='';localStorage.removeItem(sharedKey);localStorage.removeItem('lcn_doctor_location_preference');localStorage.removeItem('lcn_treatment_location_preference');localStorage.setItem(clearedKey,'1');updateClearButton();hideSuggestions();window.dispatchEvent(new CustomEvent('homepage:location-changed'));await refreshMap();}
    function updateClearButton(){document.getElementById('top-map-location-clear')?.classList.toggle('is-hidden',!document.getElementById('top-map-location-input').value.trim());}
    function scheduleSuggestions(){updateClearButton();clearTimeout(suggestionTimer);const query=document.getElementById('top-map-location-input').value.trim();if(query.length<3){hideSuggestions();return;}suggestionTimer=setTimeout(()=>loadSuggestions(query),300);}
    async function loadSuggestions(query){suggestionController?.abort?.();suggestionController=new AbortController();try{const response=await fetch(`api/geocode_location.php?suggest=1&q=${encodeURIComponent(query)}`,{signal:suggestionController.signal}),data=await response.json();const results=Array.isArray(data.results)?data.results:[];const box=document.getElementById('top-map-location-suggestions');box.innerHTML=results.map((result,index)=>`<button type="button" data-index="${index}">${escapeHtml(result.formatted||'')}</button>`).join('');box.classList.toggle('is-hidden',!results.length);box.querySelectorAll('button').forEach(button=>button.addEventListener('click',async()=>{const result=results[Number(button.dataset.index)];setSharedLocation(result,result.formatted);document.getElementById('top-map-location-input').value=currentLocation.label;hideSuggestions();window.dispatchEvent(new CustomEvent('homepage:location-changed'));await refreshMap();}));}catch(error){if(error.name!=='AbortError')hideSuggestions();}}
    function hideSuggestions(){document.getElementById('top-map-location-suggestions')?.classList.add('is-hidden');}
    function handleStorage(event){if(![sharedKey,clearedKey].includes(event.key))return;currentLocation=null;restoreSharedLocation();refreshMap();}
    function initMap(){window.LCNImages?.configureLeaflet?.(L);map=L.map('top-recommendation-map',{zoomControl:false,scrollWheelZoom:false,lcnFitRadius:true}).setView([germany.lat,germany.lng],6);const node=document.getElementById('top-recommendation-map');node.addEventListener('click',()=>{map.scrollWheelZoom.enable();node.classList.add('is-scroll-zoom-active');});node.addEventListener('mouseleave',()=>{map.scrollWheelZoom.disable();node.classList.remove('is-scroll-zoom-active');});L.control.zoom({position:'topright'}).addTo(map);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere'}).addTo(map);markerLayer=L.layerGroup().addTo(map);}
    async function refreshMap(){if(!map)return;setStatus('Standorte werden geladen …');try{const points=isDoctors?await loadDoctorPoints():await loadTreatmentPoints();allPoints=points;const city=document.getElementById('top-map-city'),selected=city.value;city.replaceChildren(new Option('Alle Städte',''));[...new Set(points.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de')).forEach(c=>city.add(new Option(c,c)));city.value=selected;renderFiltered();}catch(_){setStatus('Die Standortkarte konnte gerade nicht geladen werden.',true);}}
    function renderFiltered(){
        const enabled=document.getElementById('top-map-radius-enabled').checked,input=document.getElementById('top-map-radius'),city=document.getElementById('top-map-city').value;
        input.disabled=!enabled;const valid=Boolean(currentLocation&&input.validity.valid&&input.value);
        document.getElementById('top-map-filter-note').hidden=!(enabled&&(!currentLocation||!valid));
        document.getElementById('top-map-filter-note').textContent=enabled&&!currentLocation?'Bitte zuerst einen Standort übernehmen.':enabled&&!valid?'Bitte einen ganzen Radius zwischen 1 und 2000 km eingeben.':'';
        const km = enabled && valid ? Number(input.value) : null;
        const origin = currentLocation;
        const key = km === null ? '' : `${origin.lat},${origin.lng},${km}`;
        if (key !== publishedRadius) {
            publishedRadius = key;
            const detail = km === null ? null : {
                km,
                contains: location => validCoordinates(location.loc_lat, location.loc_lng)
                    ? distanceToOrigin({ lat: Number(location.loc_lat), lng: Number(location.loc_lng) }, origin) <= km
                    : null
            };
            window.dispatchEvent(new CustomEvent('top-recommendations:radius-changed', { detail }));
        }
        if(!map)return;
        const candidates = allPoints.filter(point => !city || point.city === city);
        const points = km === null ? candidates : candidates.filter(point => distanceToOrigin(point, origin) <= km);
        document.getElementById('top-map-distance').textContent = origin && candidates.length
            ? `${Math.round(Math.min(...candidates.map(point => distanceToOrigin(point, origin)))).toLocaleString('de-DE')} km Luftlinie`
            : origin ? 'Keine Standorte mit Entfernungsangabe' : 'Standort wählen';
        renderPoints(points);
        if (km !== null) {
            const count = points.length === 1 ? '1 Standort im Umkreis' : `${points.length} Standorte im Umkreis`;
            setStatus(`Bis ${km.toLocaleString('de-DE')} km Luftlinie · ${count}`);
        } else {
            setStatus(points.length ? `${points.length} ${points.length === 1 ? 'Standort' : 'Standorte'} auf der Karte` : 'Für diese Auswahl sind keine Standorte mit Koordinaten vorhanden.');
        }
        if(radiusCircle){map.removeLayer(radiusCircle);radiusCircle=null;}
        if(km!==null){radiusCircle=L.circle([origin.lat,origin.lng],{radius:km*1000,color:'#0878e3',weight:2,fillOpacity:0.06}).addTo(map);if(!map._lcnViewport)map.fitBounds(radiusCircle.getBounds(),{padding:[24,24],animate:false});}
    }
    function renderPoints(points){markerLayer.clearLayers();if(userMarker){map.removeLayer(userMarker);userMarker=null;}const bounds=[],groups=groupPoints(points),urls=window.LCNImages?.urls||{};const providerIcon=L.icon({iconUrl:urls['map-marker-default']||'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',iconRetinaUrl:urls['map-marker-default-retina']||'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',shadowUrl:urls['map-marker-shadow']||'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});groups.forEach(group=>{bounds.push([group.lat,group.lng]);const icon=group.points.length>1?countIcon(group.points.length,urls):providerIcon;const marker=L.marker([group.lat,group.lng],{icon,riseOnHover:true}).bindPopup(buildPopup(group)).addTo(markerLayer);window.LCNOnline?.track(marker,group.points.map(p=>p.doctorId));});if(currentLocation){const red=L.icon({iconUrl:urls['map-marker-red']||'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',shadowUrl:urls['map-marker-shadow']||'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34],shadowSize:[41,41]});userMarker=L.marker([currentLocation.lat,currentLocation.lng],{icon:red}).bindPopup(`<strong>Dein Standort</strong><br>${escapeHtml(currentLocation.label)}`).addTo(map);bounds.push([currentLocation.lat,currentLocation.lng]);}if(!map._lcnViewport){if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:8});else map.setView([germany.lat,germany.lng],6);}setTimeout(()=>map.invalidateSize(),0);}
    function countIcon(count){return window.LCNImages.countMarkerIcon(count);}
    function groupPoints(points){const groups=new Map();points.forEach(point=>{if(!validCoordinates(point.lat,point.lng))return;const key=`${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;if(!groups.has(key))groups.set(key,{lat:point.lat,lng:point.lng,points:[]});groups.get(key).points.push(point);});return [...groups.values()];}
    function buildPopup(group){const items=group.points.map(point=>`<li><a href="${escapeHtml(point.href)}">${escapeHtml(point.title)}</a>${point.subtitle?`<small>${escapeHtml(point.subtitle)}</small>`:''}</li>`).join('');return `<strong>${group.points.length>1?`${group.points.length} Einträge`:escapeHtml(group.points[0].title)}</strong>${group.points.length===1&&group.points[0].subtitle?`<br>${escapeHtml(group.points[0].subtitle)}`:''}<ul class="top-map-popup-list">${items}</ul>`;}
    async function waitForIds(selector,parameter){for(let i=0;i<30;i++){const ids=[...document.querySelectorAll(selector)].map(link=>(new URL(link.href).searchParams.get(parameter)||new URL(link.href).searchParams.get('treat_id'))).filter(Boolean);if(ids.length)return[...new Set(ids)];await new Promise(resolve=>setTimeout(resolve,100));}return[];}
    async function loadDoctorPoints(){
        if(!window.LCNFeaturedDoctors){await new Promise(resolve=>{const done=()=>{clearTimeout(timer);window.removeEventListener('homepage:experts-loaded',done);resolve();};const timer=setTimeout(done,10000);window.addEventListener('homepage:experts-loaded',done);});}
        return(window.LCNFeaturedDoctors?.items||[]).filter(item=>Number(item.dr_id)>0&&validCoordinates(item.loc_lat,item.loc_lng)).map(item=>({doctorId:Number(item.dr_id),lat:Number(item.loc_lat),lng:Number(item.loc_lng),title:item.dr_display_name,city:item.loc_city||'',subtitle:[item.loc_plz,item.loc_city].filter(Boolean).join(' '),href:`arzt_detail.html?id=${Number(item.dr_id)}`}));
    }
    function distanceToOrigin(point, origin){const rad=x=>x*Math.PI/180,dlat=rad(point.lat-origin.lat),dlng=rad(point.lng-origin.lng),a=Math.sin(dlat/2)**2+Math.cos(rad(origin.lat))*Math.cos(rad(point.lat))*Math.sin(dlng/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,a)));}
    async function loadTreatmentPoints(){const ids=await waitForIds('#featured-treatments-list a[href*="therapie_detail"]','treatment_id');if(!ids.length)return[];const origin=currentLocation||germany,response=await fetch(`api/treatments_search.php?treat_ids=${encodeURIComponent(ids.join(','))}&sort=name&direction=asc&include_map=1&lat=${origin.lat}&lng=${origin.lng}`),data=await response.json();if(!response.ok||!data.ok)throw new Error();return(data.items||[]).map(item=>({item,provider:item.nearest_provider})).filter(({provider})=>provider&&validCoordinates(provider.loc_lat,provider.loc_lng)).map(({item,provider})=>({doctorId:Number(provider.dr_id),lat:Number(provider.loc_lat),lng:Number(provider.loc_lng),title:item.behandlung,city:provider.loc_city||'',subtitle:[provider.dr_display_name,provider.loc_city].filter(Boolean).join(' · '),href:`therapie_detail.html?treat_id=${Number(item.treat_id)}`}));}
    function validLocation(value){return value&&validCoordinates(value.lat,value.lng);}function validCoordinates(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)>.001&&Math.abs(lng)>.001&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
    function setStatus(text,error=false){const node=document.getElementById('top-map-status');if(node){node.textContent=text;node.classList.toggle('is-error',error);}}
    function ensureLeaflet(){if(window.L)return Promise.resolve();return new Promise((resolve,reject)=>{if(!document.querySelector('link[data-top-map-leaflet]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.topMapLeaflet='1';document.head.append(css);}const existing=document.querySelector('script[data-top-map-leaflet]');if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.dataset.topMapLeaflet='1';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
    function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
})();
