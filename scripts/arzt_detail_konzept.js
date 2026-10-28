// Layout prototype: read original profile/treatment data from the existing API.
// Community answers use the existing anonymous voting identity.
(() => {
  'use strict';
  const scales = {
    adaptation: ['Hohe Belastung', 'Etwas belastender', 'Gut angepasst', 'Sehr gut angepasst', 'Individuell anpassbar'],
    costs: ['Komplett übernommen', 'Bis 100 €', 'Bis 500 €', 'Bis 1.000 €', 'Bis 5.000 €', 'Bis 10.000 €', 'Bis 25.000 €', 'Über 25.000 €'],
    wait: ['Wenige Tage', 'Mehrere Wochen', 'Mehrere Monate', 'Etwa ein Jahr', 'Mehr als ein Jahr / mehrere Jahre'],
    effect: ['Verschlechterung', 'Keine Veränderung', 'Verbesserung', 'Heilung']
  };
  const adaptationCriteria = ['Wartezeit', 'Wartezimmer', 'Warten im Liegen', 'Rückzug'];
  const adaptationDetails = [
    ['Lange Wartezeit', 'Unruhig', 'Nicht möglich', 'Nicht möglich'],
    ['Kurze Wartezeit', 'Unruhig', 'Nicht möglich', 'Nicht möglich'],
    ['Kurze Wartezeit', 'Ruhig', 'Nicht möglich', 'Nicht möglich'],
    ['Kurze Wartezeit', 'Ruhig', 'Möglich', 'Nicht möglich'],
    ['Kurze Wartezeit', 'Ruhig', 'Möglich', 'Möglich']
  ];
  // Archived alternative: appointmentVariant(4) / mergedAppointmentCell.
  // Active display is appointmentVariant(3), formerly labelled Variante 2.
  const emptyAppointmentDemo = new URLSearchParams(location.search).get('demo') === 'termine-null';
  const demoAppointmentAnswers = {};
  let includeDummy = window.LCNDummy.get();
  let communityLoading = false;
  const dummyToggle = document.getElementById('doctor-demo-toggle');
  function updateDummyToggle() {
    if(!dummyToggle)return;
    dummyToggle.textContent = communityLoading ? 'Dummydaten werden geladen …' : 'Dummy-Daten sind '+(includeDummy?'an':'aus');
    dummyToggle.setAttribute('aria-pressed',String(includeDummy));
    dummyToggle.disabled = communityLoading || state.saving || !validId || isSubmission || emptyAppointmentDemo;
    if(isSubmission || emptyAppointmentDemo)dummyToggle.title='Für diese Test- oder Vorschlagsansicht nicht verfügbar.';
  }
  dummyToggle?.addEventListener('click',()=>{if(!communityLoading&&!state.saving) { window.LCNDummy.set(!includeDummy); }});
  window.addEventListener('lcn-dummy-change', () => { const next = window.LCNDummy.get(); if (next !== includeDummy && !isSubmission && !emptyAppointmentDemo) loadCommunityData(next); });
  window.addEventListener('storage', event => { if(event.key === window.LCNDummy.key && !isSubmission && !emptyAppointmentDemo) loadCommunityData(window.LCNDummy.get()); });
  let appointmentEditor = null;
  function savedTreatmentView(){try{const value=localStorage.getItem('lcn_doctor_treatment_view_preference');return ['categories','list','cards'].includes(value)?value:'categories';}catch{return 'categories';}}
  function saveTreatmentView(value){try{localStorage.setItem('lcn_doctor_treatment_view_preference',value);}catch{}}
  const state = { view: 'ueberblick', insurance: (window.LCNCost?.get().insurance||'GKV').toLowerCase(), selections: {}, treatmentCategory: null, treatmentView: savedTreatmentView(), treatmentSort: null, treatmentSortDirection: 'desc', treatmentQuery: '', treatmentFilterCategories: null, treatmentOnlyRated: false, treatmentPositiveMin: 0, treatmentHealingMin: 0, treatmentNegativeMax: 100, data: null, loading: true, error: false, community: null, communityError: false, saving: false };
  const content = document.getElementById('view-content');
  const livePage = document.body.dataset.doctorPage === 'live';
  const submissionParam = new URLSearchParams(location.search).get('submission_id');
  const isSubmission = submissionParam !== null;
  const idParam = submissionParam ?? new URLSearchParams(location.search).get('id');
  const doctorId = Number(idParam || (livePage ? 0 : 627));
  const validId = /^\d+$/.test(idParam || (livePage ? '' : '627')) && Number.isSafeInteger(doctorId) && doctorId > 0;
  if (isSubmission) {
    const banner=document.querySelector('.prototype-note > span');
    if(banner) for(const node of banner.childNodes) if(node.nodeType===Node.TEXT_NODE) node.textContent=node.textContent.replace('Praxis und Therapien: Originaldaten.', 'Praxisangaben aus dem Community-Eintrag.');
  }
  let detailMap = null;
  let profileMap = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const labels = values => (values || []).map(value => value.term_label).filter(Boolean).join(' · ');
  const categoryLabel = category => category === 'Arzneimittel' ? 'Medikamente' : category;
  const question = key => state.community?.questions?.[key] || {total:0, options:[], mode:null, mean:null};
  const percent = (key, index) => question(key).options[index]?.percent ?? null;
  const percentText = value => value === null ? '–' : Number(value).toLocaleString('de-DE', {maximumFractionDigits:0}) + ' %';
  function commonLabel(key) {
    const data = question(key);
    if (!data.total) return state.communityError ? 'Daten nicht verfügbar' : state.community ? 'Noch keine Angaben' : 'Wird geladen …';
    return data.mode ? data.options[data.mode - 1].label : 'Unterschiedliche Erfahrungen';
  }
  function costSystem() {
    const raw = String(state.data?.item?.loc_country || '').toUpperCase();
    const code = window.LCNCost?.get().country || ({DEUTSCHLAND:'DE',ÖSTERREICH:'AT',SCHWEIZ:'CH'})[raw] || raw;
    const systems = {
      DE: {name:'Deutschland',options:[['gkv','GKV'],['pkv','PKV'],['de-abroad','Aus dem Ausland']]},
      AT: {name:'Österreich',options:[['at-public','Kassenarzt'],['at-elective','Wahlarzt'],['at-abroad','Aus dem Ausland']]},
      CH: {name:'Schweiz',options:[['ch-basic','Grundversicherung'],['ch-extra','Zusatzversicherung'],['ch-abroad','Aus dem Ausland']]}
    };
    return {code,...(systems[code] || {name:'Land noch nicht angegeben',options:[['other-self','Selbstzahler'],['other-abroad','Aus dem Ausland']]})};
  }
  function costContext() {
    if(!costSystem().options.some(([key])=>key===state.insurance)) state.insurance=costSystem().options[0][0];
    return state.insurance+(costSystem().code==='CH'?'-CHF':'');
  }
  function summaries() { return [commonLabel('adaptation'), commonLabel('costs-' + costContext()) + ' · ' + commonLabel('wait'), commonLabel('effect')]; }
  function communityNote(key) {
    const data = question(key);
    if (!state.community) return state.communityError ? 'Community-Daten konnten nicht geladen werden.' : 'Community-Daten werden geladen …';
    if (!data.total) return 'Noch keine Community-Angaben';
    return data.total===1?'1 Angabe':`${data.total} Angaben`;
  }
  async function loadCommunityData(requestedDummy = includeDummy) {
    communityLoading = true;
    updateDummyToggle();
    updateAnswerControls();
    try {
      const response = await fetch(isSubmission ? `api/doctor_submission.php?id=${doctorId}` : `api/doctor_community.php?id=${doctorId}&include_dummy=${requestedDummy?1:0}`);
      const data = await response.json();
      if(isSubmission&&data.approved_target_id){location.replace('arzt_detail.html?id='+Number(data.approved_target_id)+location.hash);return;}
      if (!response.ok || !data.ok) throw new Error('Community unavailable');
      applyCommunityResponse(data);
      includeDummy = Boolean(state.community.include_dummy);
      const url = new URL(location.href);
      if(!emptyAppointmentDemo) {url.searchParams.set('demo',includeDummy?'1':'0');history.replaceState(history.state,'',url);}
      state.communityError = false;
    } catch (_) { state.communityError = true; notify('Community-Daten konnten nicht geladen werden.'); }
    communityLoading = false;
    if(!state.communityError&&Object.keys(state.selections).some(key=>key.startsWith('costs-')&&key!=='costs-'+costContext()))await saveAnswer({action:'move_cost_context',question:'costs-'+costContext()});
    updateDummyToggle();
    window.LCNOnline?.update(doctorId,onlineAppointments());
    if (document.getElementById('community-mode')) document.getElementById('community-mode').textContent = state.community ? '' : 'Community-Daten derzeit nicht verfügbar.';
    render();
  }
  function applyCommunityResponse(data) {
    if (isSubmission) {
      const questions={}, own={};
      for (const [key,q] of Object.entries(data.questions)) {
        const options=q.options.map(o=>({...o,percent:q.total?Math.round(o.count*1000/q.total)/10:null}));
        const highest=Math.max(...options.map(o=>o.count));
        const modes=options.filter(o=>o.count===highest);
        questions[key]={...q,options,real_count:q.total,dummy_count:0,mode:q.total&&modes.length===1?modes[0].value:null,mean:q.total?Math.round(options.reduce((sum,o)=>sum+o.value*o.count,0)*10/q.total)/10:null};
        if(q.own!==null)own[key]=q.own;
      }
      data={community:{include_dummy:false,questions,adaptation_benchmark:data.adaptation_benchmark},own_answers:own};
    }
    state.community = data.community;
    state.selections = Object.fromEntries(Object.entries(data.own_answers || {}).map(([key, value]) => [key, value - 1]));
    if(emptyAppointmentDemo) applyDemoAppointments();
  }
  function applyDemoAppointments() {
    if(!state.community)return;
    for(const [key,q] of Object.entries(state.community.questions)) {
      if(!key.startsWith('appointment-'))continue;
      const value=demoAppointmentAnswers[key];
      delete state.selections[key];if(value)state.selections[key]=value-1;
      q.options=q.options.map(o=>({...o,count:o.value===value?1:0,percent:value?(o.value===value?100:0):null}));
      q.total=value?1:0;q.real_count=0;q.dummy_count=0;q.mode=value||null;q.mean=value||null;
    }
  }
  function updateAnswerControls() {
    document.querySelectorAll('[data-choice], #reset-demo').forEach(button => {
      button.disabled = state.saving || communityLoading || !state.community || state.communityError || (emptyAppointmentDemo && button.dataset.choice && !button.dataset.choice.startsWith('appointment-')); 
    });
  }
  async function saveAnswer(payload) {
    if (emptyAppointmentDemo && (payload.question?.startsWith('appointment-') || payload.action === 'reset')) {
      if(payload.action==='reset') Object.keys(demoAppointmentAnswers).forEach(key=>delete demoAppointmentAnswers[key]);
      else if(payload.action==='clear') delete demoAppointmentAnswers[payload.question];
      else demoAppointmentAnswers[payload.question]=payload.value;
      applyDemoAppointments();render();notify('Testauswahl aktualisiert – keine echten Angaben verändert.');return;
    }
    if (state.saving || communityLoading || !state.community || state.communityError) return;
    state.saving = true;
    updateDummyToggle();
    updateAnswerControls();
    notify('Wird gespeichert …');
    try {
      const response = await fetch(isSubmission ? 'api/doctor_submission.php' : 'api/doctor_community_answer.php?include_dummy='+(includeDummy?'1':'0'), {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(isSubmission ? {id:doctorId,...payload} : {dr_id: doctorId, ...payload})
      });
      const data = await response.json();
      if(isSubmission&&data.approved_target_id){location.replace('arzt_detail.html?id='+Number(data.approved_target_id)+location.hash);return;}
      if (!response.ok || !data.ok) throw new Error(data.error || 'Speichern konnte nicht bestätigt werden. Bitte erneut versuchen.');
      applyCommunityResponse(data);
      appointmentEditor = null;
      render();
      notify(payload.action === 'move_cost_context' ? 'Deine Angabe wurde gespeichert.' : payload.action === 'reset' ? 'Deine Angaben zu dieser Praxis wurden gelöscht.' : payload.action === 'clear' ? 'Deine Stimme wurde zurückgenommen.' : 'Deine Angabe wurde gespeichert.');return true;
    } catch (error) {
      notify('Speichern konnte nicht bestätigt werden. Bitte erneut versuchen.');return false;
    } finally {
      state.saving = false;
      updateDummyToggle();
      updateAnswerControls();
    }
  }
  async function loadDoctorSelector() {
    if (!document.getElementById('demo-doctor')) return;
    try {
      const response = await fetch('api/doctors_search.php?lat=51&lng=10&radiusKm=all');
      const data = await response.json();
      if(isSubmission&&data.approved_target_id){location.replace('arzt_detail.html?id='+Number(data.approved_target_id)+location.hash);return;}
      if (!response.ok || !data.ok) return;
      document.getElementById('demo-doctor').innerHTML = data.items.map(doctor => `<option value="${Number(doctor.dr_id)}"${Number(doctor.dr_id) === doctorId ? ' selected' : ''}>${escape(doctor.dr_display_name)}</option>`).join('');
    } catch (_) { /* The current profile remains independently usable. */ }
  }
  function address(doctor = state.data?.item || {}) {
    return doctor.address_text || [[doctor.loc_street, doctor.loc_housenumber].filter(Boolean).join(' '), [doctor.loc_plz, doctor.loc_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  function isOnlinePostalAddress(doctor=state.data?.item||{}) {
    const label=String(doctor.loc_label||'');
    return /online[\s-]*praxis/i.test(label)&&/postadresse|kein.*vor[\s-]*ort/i.test(label);
  }
  function researchedRemoteAccess(){
    if(state.data?.research?.online_only_verified!==true)return {first:false,follow:false,complete:false,exclusive:false};
    const entity=state.data?.research?.entity||{};
    const yes=value=>String(value||'').trim().toLowerCase()==='ja';
    const no=value=>String(value||'').trim().toLowerCase()==='nein';
    const postal=isOnlinePostalAddress();
    const first=postal||yes(entity.ersttermin_video)||yes(entity.ersttermin_telefon);
    const follow=postal||yes(entity.folgetermin_video)||yes(entity.folgetermin_telefon);
    const exclusive=postal||(first&&follow&&no(entity.ersttermin_vor_ort)&&no(entity.folgetermin_vor_ort));
    const describe=prefix=>[yes(entity[prefix+'_video'])?'Video':'',yes(entity[prefix+'_telefon'])?'Telefon':''].filter(Boolean).join(' oder ')||'aus der Ferne';
    return {first,follow,complete:first&&follow,exclusive,firstMethod:describe('ersttermin'),followMethod:describe('folgetermin'),firstOnsite:yes(entity.ersttermin_vor_ort),followOnsite:yes(entity.folgetermin_vor_ort)};
  }
  function researchedRemoteNotice(){
    const access=researchedRemoteAccess();
    if(!access.first&&!access.follow)return '';
    const text='Nur Online-Termine möglich – laut Recherche in der Standortauswertung berücksichtigt.';
    return '<p class="researched-online-notice">'+text+'</p>';
  }
  function dataStatus() {
    return state.error ? '<p>Die Originaldaten konnten nicht geladen werden.</p><button type="button" id="retry-data">Erneut versuchen</button>' : '<p>Originaldaten werden geladen …</p>';
  }
  function contactLink(type, value) {
    if (!value) return 'Noch keine Angabe';
    let href = '';
    if (type === 'Website' && /^https?:\/\//i.test(value)) href = value;
    if (type === 'Telefon') href = 'tel:' + value.replace(/[^+\d]/g, '');
    if (type === 'E-Mail') href = 'mailto:' + value;
    return href ? `<a href="${escape(href)}"${type === 'Website' ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(value)}</a>` : escape(value);
  }
  async function loadOriginalData() {
    state.loading = true;
    state.error = false;
    render();
    try {
      const response = await fetch(isSubmission ? `api/doctor_submission.php?id=${doctorId}` : `api/doctor_detail.php?id=${doctorId}`);
      let data = await response.json();
      if(data.merged_target_id){const target=new URL(location.href);target.searchParams.set('id',data.merged_target_id);location.replace(target.href);return;}
      if(isSubmission && response.ok && data.ok) {
        const activities=[data.primary_care?'Hausärztlich tätig':'',data.specialist_care?'Als Spezialist tätig':''].filter(Boolean).join(' · ');
        const note=document.getElementById('submission-note');
        if(note){note.hidden=false;note.querySelector('strong').textContent=data.status==='approved'?'Community-Eintrag':'Community-Eintrag · noch nicht geprüft';}
        data={ok:true,item:{dr_display_name:data.name,dr_org_name:data.organization,dr_website:data.website,address_text:data.address,loc_label:data.organization||data.name,activities,has_coordinates:false,loc_lat:null,loc_lng:null},research:{},treatments_grouped:data.treatments_grouped||{}};
      }
      if (!response.ok || !data.ok || !data.item) throw new Error('Profile unavailable');
      state.data = data;
      const doctor = data.item;
      document.querySelector('.profile h1').textContent = doctor.dr_display_name;
      document.title = `${doctor.dr_display_name} – Long Covid Navigator`;
      const suggestion = document.getElementById('suggest-doctor');
      if (suggestion) { suggestion.href = `arzt_vorschlagen.html?existing_target_id=${doctorId}`; suggestion.hidden = isSubmission; }
      document.querySelector('.avatar').textContent = [doctor.dr_firstname?.[0], doctor.dr_lastname?.[0]].filter(Boolean).join('') || 'LCN';
      document.getElementById('profile-specialty').textContent = [labels(data.research?.specialty || data.terms?.specialty), labels(data.research?.specializations)].filter(Boolean).join(' | ');
      document.getElementById('profile-address').textContent = livePage ? ([doctor.loc_plz, doctor.loc_city].filter(Boolean).join(' ') || address()) : address();
      document.querySelector('.contact').innerHTML = [['Website', doctor.loc_website || doctor.dr_website], ['Telefon', doctor.loc_phone || doctor.dr_phone], ['E-Mail', doctor.loc_email || doctor.dr_email]].filter(([type, value]) => type==='E-Mail'||value).map(([type, value]) => {
        if(type==='E-Mail'&&!String(value||'').trim())return '<button type="button" class="contact-unavailable" disabled title="Keine E-Mail-Adresse hinterlegt" aria-label="E-Mail nicht hinterlegt"><span class="contact-symbol" aria-hidden="true">✉</span><span class="contact-label">E-Mail</span></button>';
        const link = contactLink(type, value);
        return link.replace('<a ', `<a aria-label="${type}" title="${type}" `).replace(`>${escape(value)}</a>`, livePage ? `><span class="contact-symbol" aria-hidden="true">${({Website:'↗',Telefon:'☎','E-Mail':'✉'})[type]}</span><span class="contact-label">${type}</span></a>` : `>${type}</a>`);
      }).join('');
      if(dummyToggle)document.querySelector('.contact').prepend(dummyToggle);
      profileMap?.remove();
      profileMap = createMap(document.getElementById('profile-map'), true);
    } catch (error) {
      state.error = true;
      document.getElementById('profile-specialty').textContent = 'Praxisinformationen derzeit nicht verfügbar';
    } finally {
      state.loading = false;
      render();
    }
  }
  // Same Leaflet map, tile layer, marker registry and controls as arzt_detail.js.
  let locationRadiusEnabled=false,locationRadius=100;
  function practiceLocations(){const doctor=state.data?.item;if(!doctor)return [];const all=[doctor,...(state.data?.research?.locations||[])];return all.filter((p,i)=>all.findIndex(q=>String(q.loc_id)===String(p.loc_id))===i);}
  function locationDistance(point){const own=savedLocation();if(!own||point.loc_lat==null||point.loc_lng==null)return null;const rad=v=>Number(v)*Math.PI/180;const a=Math.sin(rad(point.loc_lat-own.lat)/2)**2+Math.cos(rad(own.lat))*Math.cos(rad(point.loc_lat))*Math.sin(rad(point.loc_lng-own.lng)/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,a)));}
  function practiceFilters(){return '<div class="nd-location-filters doctor-location-filters"><div class="nd-radius-inline"><label class="nd-radius-value"><span>Radius in Kilometern</span><input type="number" data-doctor-radius min="1" max="2000" step="1" value="'+locationRadius+'" aria-label="Radius in Kilometern"'+(!locationRadiusEnabled?' disabled':'')+'></label><label class="nd-radius-toggle"><span>Radius aktivieren</span><input type="checkbox" role="switch" data-doctor-radius-enabled'+(locationRadiusEnabled?' checked':'')+'></label></div></div>';}
  function createMap(element, compact = false) {
    if (!element) return null;
    const doctor = state.data?.item;
    if (!doctor) {
      element.textContent = 'Karte wird geladen …';
      return null;
    }
    const hasCoordinates=point=>point.loc_lat!=null&&point.loc_lng!=null&&String(point.loc_lat).trim()!==''&&String(point.loc_lng).trim()!==''&&Number.isFinite(Number(point.loc_lat))&&Number.isFinite(Number(point.loc_lng));
    const locations=compact?[doctor]:practiceLocations();
    const missingPosition=!locations.some(hasCoordinates);
    element.classList.toggle('map-position-missing',missingPosition);
    if(missingPosition){
      if(isOnlinePostalAddress(doctor)){
        const postalAddress=address(doctor);
        element.innerHTML='<div class="map-location-message"><span class="map-online-label">Online-Praxis</span><h4>Keine Vor-Ort-Behandlung</h4><p>Die angegebene Adresse ist eine Postadresse, kein Behandlungsort.</p>'+(postalAddress?'<div class="map-postal-address"><strong>Postadresse</strong><p>'+escape(postalAddress)+'</p><a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(postalAddress)+'" target="_blank" rel="noopener noreferrer">Postadresse in Google Maps ansehen ↗</a></div>':'')+'<small>Für die Postadresse liegen keine Koordinaten vor.</small></div>';
      }else element.textContent='Für diesen Arzt liegen keine Koordinaten vor.';
      const status=document.querySelector('[data-doctor-map-status]');
      if(status)status.textContent='';
      return null;
    }
    if (typeof L === 'undefined') { element.textContent = 'Karte konnte nicht geladen werden.'; return null; }
    element.replaceChildren();
    window.LCNImages?.configureLeaflet(L);
    const country=String(doctor.loc_country||'DE').trim().toUpperCase();
    const countryBounds={DE:[[47.2,5.8],[55.1,15.1]],AT:[[46.3,9.5],[49.1,17.2]],CH:[[45.8,5.9],[47.9,10.5]]};
    const countryCode=({DEUTSCHLAND:'DE',GERMANY:'DE',AUT:'AT','ÖSTERREICH':'AT',AUSTRIA:'AT',CHE:'CH',SCHWEIZ:'CH',SWITZERLAND:'CH'})[country]||country;
    const map = L.map(element, {zoomControl: false, scrollWheelZoom: false, dragging: !compact, doubleClickZoom: !compact, touchZoom: !compact, keyboard: !compact});
    const own = savedLocation();
    const visible=locations.filter(p=>hasCoordinates(p)&&(!locationRadiusEnabled||compact||!own||locationDistance(p)<=locationRadius));
    const overview=(countryBounds[countryCode]||countryBounds.DE).map(point=>[...point]);
    locations.filter(hasCoordinates).forEach(point=>{const lat=Number(point.loc_lat),lng=Number(point.loc_lng);overview[0][0]=Math.min(overview[0][0],lat);overview[0][1]=Math.min(overview[0][1],lng);overview[1][0]=Math.max(overview[1][0],lat);overview[1][1]=Math.max(overview[1][1],lng);});
    if(!compact&&own){
      const points=visible.map(point=>[Number(point.loc_lat),Number(point.loc_lng)]);
      points.push([own.lat,own.lng]);
      map.fitBounds(points,{padding:[48,48],maxZoom:14});
    }else map.fitBounds(overview,{padding:[20,20]});
    if (!compact) {
      L.control.zoom({position:'topright'}).addTo(map);
      element.onclick = () => map.scrollWheelZoom.enable();
      element.onmouseleave = () => map.scrollWheelZoom.disable();
    }
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom:19, attribution:'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere'
    }).addTo(map);
    let practiceMarkers=[];
    function renderPracticeMarkers(){
      practiceMarkers.forEach(marker=>map.removeLayer(marker));
      practiceMarkers=[];
      const groups=[];
      visible.forEach(point=>{
        const position=map.latLngToContainerPoint([Number(point.loc_lat),Number(point.loc_lng)]);
        const group=groups.find(group=>Math.hypot(group.position.x-position.x,group.position.y-position.y)<32);
        if(group)group.points.push(point);else groups.push({position,points:[point]});
      });
      groups.forEach(({points})=>{
        const label=point=>point.loc_label||doctor.dr_display_name||'Praxis';
        const details=points.map(point=>'<strong>'+escape(label(point))+'</strong><br>'+escape(address(point))).join('<br><br>');
        const center=[points.reduce((sum,p)=>sum+Number(p.loc_lat),0)/points.length,points.reduce((sum,p)=>sum+Number(p.loc_lng),0)/points.length];
        const options={title:points.map(point=>[label(point),address(point)].filter(Boolean).join(' · ')).join(' / ')};
        if(points.length>1)options.icon=L.divIcon({className:'doctor-location-cluster',html:'<span>'+points.length+'</span>',iconSize:[34,34],iconAnchor:[17,17]});
        const marker=L.marker(center,options).addTo(map).bindTooltip(details,{direction:'top',offset:[0,-35]}).bindPopup(details);
        if(points.length>1)marker.on('click',()=>map.fitBounds(points.map(point=>[Number(point.loc_lat),Number(point.loc_lng)]),{padding:[48,48],maxZoom:16}));
        window.LCNOnline?.track(marker,doctorId,points.length);
        practiceMarkers.push(marker);
      });
    }
    renderPracticeMarkers();
    map.on('zoomend',renderPracticeMarkers);
    if(!compact){const status=document.querySelector('[data-doctor-map-status]');if(status)status.textContent=locationRadiusEnabled&&!savedLocation()?'Bitte zuerst einen Ausgangsort übernehmen.':visible.length+' Praxisstandorte im Filter · Entfernung als Luftlinie.';}
    if(!compact&&locationRadiusEnabled&&savedLocation())L.circle([savedLocation().lat,savedLocation().lng],{radius:locationRadius*1000,color:'#0875ee',weight:2,fillOpacity:.06}).addTo(map);
    if (!compact && own) {
      const icon = L.icon({iconUrl: window.LCNImages.urls['map-marker-red'], shadowUrl: window.LCNImages.urls['map-marker-shadow'], iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41]});
      L.marker([own.lat, own.lng], {icon, title: own.label}).addTo(map).bindPopup(`<strong>Dein Standort</strong><br>${escape(own.label)}`);
    }
    return map;
  }
  function savedLocation() {
    try {
      if (localStorage.getItem('lcn_shared_location_cleared') === '1') return null;
      const raw = localStorage.getItem('lcn_shared_location_preference') || localStorage.getItem('lcn_doctor_location_preference') || localStorage.getItem('lcn_treatment_location_preference');
      const value = raw ? JSON.parse(raw) : null;
      if (value?.lat == null || value?.lng == null || !Number.isFinite(Number(value.lat)) || !Number.isFinite(Number(value.lng)) || Math.abs(Number(value.lat)) > 90 || Math.abs(Number(value.lng)) > 180) return null;
      return {...value, lat:Number(value.lat), lng:Number(value.lng), label:String(value.label || value.location || value.city || 'Eigener Standort')};
    } catch (_) { return null; }
  }
  function distanceKm() {
    const own=savedLocation(),doctor=state.data?.item;
    if(!own||doctor?.loc_lat==null||doctor?.loc_lng==null)return null;
    const lat=Number(doctor.loc_lat),lng=Number(doctor.loc_lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
    const rad=v=>v*Math.PI/180;
    const a=Math.sin(rad(lat-own.lat)/2)**2+Math.cos(rad(own.lat))*Math.cos(rad(lat))*Math.sin(rad(lng-own.lng)/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
  }
  function distanceText() {
    const km=distanceKm();
    if(km===null)return savedLocation()?'Entfernung nicht verfügbar':'Standort nicht gesetzt';
    return 'ca. '+km.toLocaleString('de-DE',{maximumFractionDigits:km<10?1:0})+' km (Luftlinie)';
  }
  function onlineAppointments(){
    const research=researchedRemoteAccess();
    const community=window.LCNOnline?.fromQuestions(doctorId,state.community?.questions)||{};
    const first=research.first||Boolean(community.first),follow=research.follow||Boolean(community.follow);
    return {first,follow,complete:first&&follow,source:research.complete?'research':'community'};
  }
  function travelEstimate() {
    if(state.view!=='termin')return '';
    const km=distanceKm();
    if(km===null&&!onlineAppointments().complete)return '<div class="travel-estimate"><strong>Anreiseaufwand</strong><p>'+ (savedLocation()?'Für diese Praxis fehlen Koordinaten zur Schätzung.':'Gib deinen Standort ein, um den Anreiseaufwand grob einzuordnen.')+'</p></div>';
    const index=onlineAppointments().complete?-1:travelBands.findIndex(([limit])=>km<=limit);
    return '<div class="travel-estimate"><div class="travel-estimate-heading"><strong>'+(onlineAppointments().complete?'Erst- und Folgetermin online · keine Anreise zu Erst- und Folgetermin':distanceText())+'</strong><span>'+(index<0?'Keine Anreise':travelBands[index][2]+' · grobe Orientierung')+'</span></div><ol class="travel-scale"><li class="travel-online-level'+(index<0?' is-current':'')+'"><strong>Erst- und Folgetermin online</strong><span class="travel-scale-bar" aria-hidden="true"></span><span>Keine Anreise zu Erst- und Folgetermin</span></li>'+travelBands.map(([,range,time],i)=>'<li class="travel-level-'+(i+1)+(i===index?' is-current':'')+'"><strong>'+range+'</strong><span class="travel-scale-bar" aria-hidden="true"></span><span>'+time+'</span>'+(i===index?'<b>Deine Entfernung</b>':'')+'</li>').join('')+'</ol><details><summary>Wie wird eingeordnet?</summary><p>Die Einordnung zeigt die Luftlinienentfernung zu dieser Praxis. Fahrzeiten sind grobe Orientierungswerte, keine Routenberechnung. Sind Erst- und Folgetermin online möglich, entfällt die Anreise zu diesen Terminen. Ob Untersuchungen oder Behandlungen vor Ort nötig sind, muss zusätzlich mit der Praxis geklärt werden.</p></details></div>';
  }
  const travelBands=[[20,'Bis 20 km','Unter 30 Min.'],[50,'20–50 km','30–60 Min.'],[100,'50–100 km','Etwa 1–2 Std.'],[300,'100–300 km','Mehrere Stunden'],[800,'300–800 km','Tagesreise'],[Infinity,'Über 800 km','Tagesreise oder länger / ggf. Flug']];
  function initLocationSuggestions() {
    const host=document.getElementById('location-form');
    if(!host)return;
    const valid=p=>p?.lat!=null&&p?.lng!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng));
    const setOrigin=(point,label)=>{host.elements.doctor_location_query.value=label;saveLocation(host,point);};
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
    host.addEventListener('submit',dismiss);
    host.addEventListener('focusout',event=>{if(!host.contains(event.relatedTarget))dismiss();});
    input.addEventListener('input',suggest);
    input.addEventListener('focus',suggest);
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){dismiss();return;}
      const choices=[...suggestions.querySelectorAll('button')];
      if(!suggestions.classList.contains('is-hidden')&&choices.length&&['ArrowDown','ArrowUp'].includes(event.key)){
        event.preventDefault();activeSuggestion=(activeSuggestion+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;
        choices.forEach((choice,i)=>choice.setAttribute('aria-selected',String(i===activeSuggestion)));input.setAttribute('aria-activedescendant',choices[activeSuggestion].id);
      }else if(event.key==='Enter'&&!suggestions.classList.contains('is-hidden')&&activeSuggestion>=0){event.preventDefault();choices[activeSuggestion]?.click();}
    });
  }
  let locationRequest = null;
  function refreshLocation() {
    const section = document.querySelector('.location-section');
    if (!section) return;
    detailMap?.remove();
    section.outerHTML = locationCard();
    decorateBoxHeadings();
    detailMap = createMap(document.getElementById('doctor-detail-map'));
    initLocationSuggestions();
  }
  async function saveLocation(form, selectedLocation = null) {
    const query = form.elements.doctor_location_query.value.trim();
    if (!query) { clearLocation(); return; }
    locationRequest?.abort();
    const controller = new AbortController();
    locationRequest = controller;
    form.setAttribute('aria-busy', 'true');
    form.querySelector('[data-location-status]').textContent = 'Standort wird gesucht …';
    try {
      const response = selectedLocation ? null : await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`, {signal:controller.signal});
      const data = selectedLocation ? {ok:true,result:selectedLocation} : await response.json();
      if(isSubmission&&data.approved_target_id){location.replace('arzt_detail.html?id='+Number(data.approved_target_id)+location.hash);return;}
      if ((response && !response.ok) || !data.ok) throw new Error(data.message || 'Standort nicht gefunden.');
      const value = data.result;
      if (value?.lat == null || value?.lng == null || !Number.isFinite(Number(value.lat)) || !Number.isFinite(Number(value.lng))) throw new Error('Keine gültigen Koordinaten gefunden.');
      localStorage.setItem('lcn_shared_location_preference', JSON.stringify({location:value.formatted || query, label:value.formatted || query, city:value.city || '', lat:Number(value.lat), lng:Number(value.lng)}));
      localStorage.removeItem('lcn_shared_location_cleared');
      refreshLocation();
      notify('Standort übernommen – auch für die anderen LCN-Seiten.');
    } catch (error) {
      if (error.name !== 'AbortError') form.querySelector('[data-location-status]').textContent = 'Standort nicht gefunden oder nicht speicherbar. Bitte versuche einen genaueren Ort.';
    } finally { form.removeAttribute('aria-busy'); }
  }
  function clearLocation() {
    locationRequest?.abort();
    try {
      ['lcn_shared_location_preference','lcn_doctor_location_preference','lcn_treatment_location_preference'].forEach(key => localStorage.removeItem(key));
      localStorage.setItem('lcn_shared_location_cleared','1');
      refreshLocation();
    } catch (_) { notify('Standort konnte nicht entfernt werden.'); }
  }
  let feedbackTimer;
  function notify(message) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.classList.add('visible');
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => feedback.classList.remove('visible'), 2000);
  }

  let helpSequence=0;
  function blockTitle(title, explanation) {
    const id='heading-info-'+(++helpSequence);
    return '<div class="block-heading adaptation-heading-help"><h3><button type="button" class="heading-help-trigger" aria-describedby="'+id+'">'+title+' <span aria-hidden="true">ⓘ</span></button></h3><div class="heading-help-info" id="'+id+'" role="tooltip">'+escape(explanation)+'</div></div>';
  }
  function decorateBoxHeadings(root=content) {
    const explanations={
      'Überblick':'Welche Angaben sind zu diesem Behandler bekannt? Hier findest du die recherchierten Informationen zu Behandler, medizinischem Profil und Kontakt. Fehlende Angaben sind gekennzeichnet.',
      'Medizinisches Profil':'Welches medizinische Profil hat der Behandler? Hier findest du die recherchierten Fachrichtungen, Spezialisierungen und Zusatzqualifikationen.',
      'Standort':'Wo befindet sich die Praxis? Hier findest du die Adresse und die Karte. Gib deinen Standort ein, um die Luftlinienentfernung zu sehen. Im Termin-Reiter wird zusätzlich der Anreiseaufwand grob geschätzt.',
      'Kontakt':'Wie kannst du den Behandler kontaktieren? Über diese Links kannst du die Website öffnen, anrufen oder eine E-Mail schreiben.',
      'Community-Bewertung':'Wie hat sich dein Zustand durch die Behandlung verändert? Wähle die Bewertung, die auf deine Erfahrung zutrifft. Die Verteilung zeigt subjektive Erfahrungen der Community und ist kein Wirksamkeitsnachweis. Erneutes Anklicken deiner Auswahl nimmt sie zurück.',
      'Therapien':'Welche Therapien bietet diese Praxis an? Hier findest du die recherchierten Therapien. Suche und Filter helfen beim Eingrenzen.'
    };
    root.querySelectorAll('h3').forEach(h=>{
      if(h.querySelector('.heading-help-trigger')||h.closest('.adaptation-heading-help'))return;
      const title=h.textContent.trim();
      const key=Object.keys(explanations).find(k=>title===k||(k==='Therapien'&&title.startsWith(k)));
      if(!key)return;
      const id='heading-info-'+(++helpSequence),html=h.innerHTML;
      h.classList.add('adaptation-heading-help');
      h.innerHTML='<button type="button" class="heading-help-trigger" aria-describedby="'+id+'">'+html+' <span aria-hidden="true">ⓘ</span></button><span id="'+id+'" class="heading-help-info" role="tooltip">'+escape(explanations[key])+'</span>';
      if(['Community-Bewertung','Therapien'].includes(key)&&h.nextElementSibling?.tagName==='P')h.nextElementSibling.remove();
    });
    // Only the info icon is interactive; the heading stays ordinary text.
    root.querySelectorAll('.heading-help-trigger').forEach(button=>{
      if(button.dataset.iconOnly)return;
      const icon=button.querySelector('span[aria-hidden="true"]');
      if(!icon)return;
      const title=[...button.childNodes].filter(node=>node!==icon).map(node=>node.textContent).join('').trim();
      if(title)button.setAttribute('aria-label','Information zu '+title);
      button.before(...[...button.childNodes].filter(node=>node!==icon));
      button.dataset.iconOnly='true';
      button.setAttribute('aria-expanded','false');
    });
  }
  function choices(key, labels, numbered = false) {
    return `<div class="choice-grid" role="group" aria-label="Deine Auswahl: ${key === 'adaptation' ? 'Termin-Anpassung' : key.startsWith('costs') ? 'Eigene Kosten, ' + state.insurance.toUpperCase() : key.startsWith('wait') ? (key === 'wait' ? 'Wartezeit auf den Ersttermin' : 'Wartezeit auf Folgetermine') : 'Wirkung'}" style="--count:${labels.length}">${labels.map((label, index) => `<button type="button" data-choice="${key}" data-value="${index}" aria-pressed="${state.selections[key] === index}">${numbered ? `<span class="choice-number" aria-hidden="true">${index + 1}</span>` : ''}${label}</button>`).join('')}</div>`;
  }
  function dotScale(key, labels) {
    return `<p class="community-label">${communityNote(key)}</p><div class="interactive-dot-scale" role="group" aria-label="Deine Auswahl: ${key.startsWith('wait') ? (key === 'wait' ? 'Wartezeit auf den Ersttermin' : 'Wartezeit auf Folgetermine') : 'Eigenanteil ' + state.insurance.toUpperCase()}" style="--count:${labels.length}">${labels.map((label, index) => `<button type="button" data-choice="${key}" data-value="${index}" aria-pressed="${state.selections[key] === index}"><span class="dot" aria-hidden="true"></span><strong class="scale-percent">${percentText(percent(key,index))}</strong><span>${label}</span></button>`).join('')}</div>`;
  }
  function locationCard() {
    if (!state.data) return `<section class="card"><h3>Standort</h3>${dataStatus()}</section>`;
    const own = savedLocation();
    return `<section class="card location-section" aria-label="Standort"><h3>Standort</h3>${travelEstimate()}${researchedRemoteNotice()}<div class="doctor-detail-location-grid"><div class="doctor-detail-location-address top-map-location-controls"><h4 class="nd-location-title">Standortsuche</h4><form id="location-form" role="search" autocomplete="off" aria-label="Standortsuche"><div class="nd-location-heading"><label for="own-location">Adresse, PLZ oder Ort</label><button type="button" id="clear-location" aria-label="Standort entfernen"${own ? '' : ' hidden'}>×</button></div><div class="own-location-control top-map-location-input-row"><input id="own-location" name="doctor_location_query" type="search" placeholder="z. B. 50667 oder Köln" autocomplete="off" data-lpignore="true" data-1p-ignore="true" spellcheck="false" enterkeyhint="search" maxlength="200" value="${escape(own?.label || '')}"><div class="top-map-location-suggestions is-hidden"></div></div><button type="submit" class="nd-location-submit">Standort übernehmen</button><span data-location-status role="status" aria-live="polite"></span></form>${practiceFilters()}<div class="nd-location-summary"><span>Entfernung zu deinem Standort</span><strong id="own-distance">${distanceText()}</strong><span data-doctor-map-status role="status"></span></div></div><div id="doctor-detail-map" class="doctor-detail-map" aria-label="Karte des Praxisstandorts"></div></div></section>`;
  }
  function profileFacts() {
    if (!state.data) return `<section class="card overview-facts"><h3>Überblick</h3>${dataStatus()}</section>`;
    const doctor = state.data.item;
    const research = state.data.research || {};
    const organization = doctor.dr_org_name || '';
    const displayName = doctor.dr_display_name || '';
    const namePosition = displayName ? organization.indexOf(displayName) : -1;
    const organizationHtml = namePosition > 0
      ? escape((organization.slice(0, namePosition) + organization.slice(namePosition + displayName.length)).trim())
      : escape(organization) || 'Noch keine Angabe';
    const icons={person:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',medical:'<path d="M5 3v6a5 5 0 0 0 10 0V3M3 3h4M13 3h4M10 14v3a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="11" r="3"/>',location:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',phone:'<path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3-1 4C10 22 2 14 3 4Z"/>'};
    const icon=name=>`<span class="overview-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg></span>`;
    const fields=rows=>`<dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd${!value ? ' class="overview-missing"' : ''}>${value||'Noch keine Angabe'}</dd></div>`).join('')}</dl>`;
    const section=(title,symbol,rows)=>`<section class="overview-group">${icon(symbol)}<div class="overview-group-content"><h3>${title}</h3>${fields(rows)}</div></section>`;
    const type=({doctor:'Arzt',practice:'Praxis',clinic:'Klinik',other:'Anlaufstelle'})[doctor.dr_type]||doctor.dr_type||'Noch keine Angabe';
    const country=({AT:'Österreich',DE:'Deutschland',CH:'Schweiz'})[doctor.loc_country]||doctor.loc_country;
    const locations=[['Adresse',escape(address())],['Land',escape(country)]];
    const additionalLocations=(research.locations||[]).filter(location=>Number(location.loc_id)!==Number(doctor.loc_id));
    if(additionalLocations.length)locations.push(['Weitere Standorte',additionalLocations.map(location=>escape([location.loc_label,address(location)].filter(Boolean).join(' · '))).join('<br>')]);
    return `<section class="card overview-facts overview-structured"><h3 class="overview-heading">Überblick</h3><div class="overview-profile-grid"><aside class="overview-identity">${icon('person')}<h3>${escape(doctor.dr_display_name)}</h3><div class="overview-organization"><span>Praxis</span><strong>${organizationHtml}</strong></div>${doctor.activities?`<p class="overview-activities">${escape(doctor.activities)}</p>`:''}<span class="overview-type-badge">${escape(type)}</span></aside><div class="overview-groups">${section('Medizinisches Profil','medical',[
      ['Fachrichtungen',escape(labels(research.specialty||state.data.terms?.specialty))],
      ['Spezialisierungen',escape(labels(research.specializations))],
      ['Zusatzqualifikation',escape(labels(research.qualifications))]
    ])}${section('Standort','location',locations)}${section('Kontakt','phone',[
      ['Telefon',contactLink('Telefon',doctor.loc_phone||doctor.dr_phone)],
      ['E-Mail',contactLink('E-Mail',doctor.loc_email||doctor.dr_email)],
      ['Website',contactLink('Website',doctor.loc_website||doctor.dr_website)]
    ])}</div></div></section>`;
  }

  function overview() {
    return profileFacts() + dashboardScore(true);
  }

  function adaptationHelp() {
    const selected=state.selections.adaptation;
    if (!Number.isInteger(selected)) return '';
    const icons=[
      '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
      '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2"/><path d="M2 20v-3a6 6 0 0 1 12 0v3zM16 14a5 5 0 0 1 6 5v1h-5"/>',
      '<path d="M3 5v16M3 17h18v4M3 10h5v7M8 11h10a3 3 0 0 1 3 3v3"/><circle cx="6" cy="8" r="2"/>',
      '<path d="M4 21h16M7 21V3h10v18M11 12h1"/>'
    ];
    return `<section class="adaptation-explanation" aria-label="Bedeutung deiner gewählten Stufe"><p class="adaptation-explanation-heading">Das bedeutet deine gewählte Stufe:</p><div class="adaptation-facts">${adaptationCriteria.map((criterion,i)=>`<div class="adaptation-fact"><span class="adaptation-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</svg></span><div><span class="adaptation-fact-label">${escape(criterion)}</span><strong>${escape(adaptationDetails[selected][i])}</strong></div></div>`).join('')}</div></section>`;
  }
  function adaptationResults(data) {
    return ratingComparison('adaptation',10,5,'Vergleich: Behandler mit mindestens zehn Angaben zur Termin-Anpassung.');
  }
  function appointment() {
    const data = question('adaptation');
    const percentages = scales.adaptation.map((_, index) => percent('adaptation', index));
    // Gentle emphasis only: every segment keeps enough space for its own label.
    const weights = percentages.map(value => 1 + Math.min(100, value || 0) / 250);
    const tracks = weights.map(weight => weight + 'fr').join(' ');
    return `<section class="card"><div class="block-heading adaptation-heading-help"><h3><button type="button" class="heading-help-trigger" aria-describedby="adaptation-heading-info">Long-Covid-gerechter Termin <span aria-hidden="true">ⓘ</span></button></h3><div id="adaptation-heading-info" class="heading-help-info" role="tooltip">Wie gut ist der Termin auf gesundheitlich stark eingeschränkte Menschen mit Long Covid oder ME/CFS angepasst? Berücksichtige die Wartezeit vor Ort, die Ruhe im Wartezimmer sowie die Möglichkeit, im Liegen zu warten oder dich zurückzuziehen. Wähle die Stufe, die auf deine Erfahrung zutrifft. Unter deiner ausgewählten Stufe siehst du die dazugehörigen Kriterien. Erneutes Anklicken deiner Auswahl nimmt sie zurück.</div></div><div class="block-content"><p class="community-label">${communityNote('adaptation')}</p><div class="adaptation-matched" role="group" aria-label="Termin-Anpassung: Verteilung und eigene Auswahl" style="--tracks:${tracks}">${scales.adaptation.map((label, i) => `<button type="button" data-choice="adaptation" data-value="${i}" aria-pressed="${state.selections.adaptation === i}"><span class="matched-bar shade-${i}" aria-hidden="true"></span><strong>${percentText(percentages[i])}</strong><strong class="adaptation-title">${i + 1} · ${label}</strong></button>`).join('')}</div>${adaptationHelp()}${adaptationResults(data)}</div></section>` +
      appointmentVariant(3) + locationCard();
  }

  function appointmentVariant(variant) {
    const description='Welche Terminformen sind bei diesem Behandler möglich? Gib für Erst- und Folgetermine jeweils an, was auf deine Erfahrung zutrifft. Die Zahlen zeigen die Angaben der Community. Erneutes Anklicken deiner Auswahl nimmt sie zurück.';
    return `<section class="card appointment-variant" data-variant="${variant}">${blockTitle(variant===3?'Terminform':'Terminform · Variante '+(variant-1),description)}<div class="block-content"><div class="appointment-table" role="table" aria-label="Terminform"><div class="matrix-header" role="row"><span role="columnheader">Termin</span>${['Vor Ort','Telefon','Video'].map(f=>`<strong role="columnheader">${f}</strong>`).join('')}</div>${['Ersttermin','Folgetermin'].map((type,row)=>`<div class="matrix-row" role="row"><strong role="rowheader">${type}</strong>${['Vor Ort','Telefon','Video'].map((form,column)=>{
      const key=`appointment-${row}-${column}`,q=question(key),own=state.selections[key];
      const yes=q.options[0]?.count||0,no=q.options[1]?.count||0,total=yes+no;
      const status=!total?'Noch keine Angaben':yes===no?'Unterschiedlich':yes>no?'Möglich':'Nicht möglich';
      const tone=!total||yes===no?'unknown':yes>no?'possible':'unlikely';
      if(variant===4) return mergedAppointmentCell(key,type,form,own,total,yes,no,status,tone);
      const buttons=`<div class="thumb-answers" role="group" aria-label="${type}, ${form}: deine Angabe">${[0,1].map(value=>`<button type="button" class="thumb-answer agreement-answer ${value===0?'agreement-yes':'agreement-no'}" data-choice="${key}" data-value="${value}" aria-pressed="${own===value}" aria-label="${type}, ${form}: ${value===0?'Möglich':'Nicht möglich'}" title="${own===value?'Stimme zurücknehmen':value===0?'Möglich':'Nicht möglich'}"><span aria-hidden="true">${value===0?'✓':'✕'}</span></button>`).join('')}</div>`;
      const ownControl=variant===2&&Number.isInteger(own)?`<button type="button" class="appointment-status agreement-answer own-result ${own===0?'possible':'unlikely'}" data-choice="${key}" data-value="${own}" aria-pressed="true" aria-label="${type}, ${form}: ${own===0?'Möglich':'Nicht möglich'}, Stimme zurücknehmen" title="Erneut klicken: Stimme zurücknehmen">${own===0?'✓ Möglich':'✕ Nicht möglich'}</button>`:buttons;
      const countButton=value=>`<button type="button" class="agreement-answer count-choice ${value===0?'count-yes':'count-no'}" data-choice="${key}" data-value="${value}" aria-pressed="${own===value}" aria-label="${type}, ${form}: ${value===0?'Möglich':'Nicht möglich'}, ${value===0?yes:no} Stimmen" title="${value===0?'Möglich':'Nicht möglich'}${own===value?' – deine Auswahl; erneut klicken zum Zurücknehmen':''}">${value===0?yes:no}</button>`;
      const community=variant===2?`<span class="appointment-status ${tone}" title="${escape(communityNote(key))}">${status}</span>`:`<div class="inline-vote-meter" role="group" aria-label="${type}, ${form}: eigene Angabe">${countButton(1)}<div class="vote-meter" role="img" aria-label="${yes} Stimmen möglich, ${no} Stimmen nicht möglich"><span class="vote-meter-fill" style="width:${total?100*yes/total:50}%"></span><span class="vote-meter-point" style="left:${total?100*no/total:50}%"></span></div>${countButton(0)}</div>${!total?'<small>Noch keine Angaben</small>':''}`;

      return `<div class="matrix-cell variant-cell variant-cell-${variant}" role="cell"><span class="mobile-form">${form}</span><div class="variant-community">${variant===2?'<span class="variant-label">Community</span>':''}${community}</div>${variant===2?`<div class="variant-own"><span class="variant-label">Deine Angabe</span>${ownControl}</div>`:''}</div>`;
    }).join('')}</div>`).join('')}</div>${emptyAppointmentDemo?'<p class="field-note">Testansicht: Die Terminformen starten bei 0 / 0. Deine Klicks gelten nur hier und werden beim Neuladen zurückgesetzt.</p>':''}</div></section>`;
  }
  function mergedAppointmentCell(key,type,form,own,total,yes,no,status,tone) {
    const answered=Number.isInteger(own), matched=answered&&total>0&&yes!==no&&own===(yes>no?0:1);
    const split=answered&&!matched, editing=appointmentEditor===key;
    const pill=(text,color,extra='')=>`<button type="button" class="appointment-status merged-pill ${color} ${extra}" data-edit-appointment="${key}" aria-expanded="${editing}" aria-label="${type}, ${form}: ${text}${matched?', von dir bestätigt':''}, Angabe ändern">${text}</button>`;
    if(editing) return `<div class="matrix-cell merged-cell" role="cell"><span class="mobile-form">${form}</span><div class="merged-editor" role="group" aria-label="${type}, ${form}: eigene Angabe"><div>${[0,1].map(v=>`<button type="button" class="appointment-status ${v===0?'possible':'unlikely'}" data-choice="${key}" data-value="${v}" aria-pressed="${own===v}">${v===0?'Möglich':'Nicht möglich'}</button>`).join('')}</div></div></div>`;
    return `<div class="matrix-cell merged-cell" role="cell"><span class="mobile-form">${form}</span><div class="merged-values${split?' is-split':''}"><div>${split?'<span class="variant-label">Community</span>':''}${pill(status,tone,matched?'merged-confirmed':'')}</div>${split?`<div class="merged-own"><span class="variant-label">Deine Angabe</span>${pill(own===0?'Möglich':'Nicht möglich',own===0?'possible':'unlikely')}</div>`:''}</div></div>`;

  }
  function access() {
    return `<section class="card"><div class="cost-heading">${blockTitle('Behandlungskosten (Eigenanteil)', 'Wie hoch waren deine eigenen Aufwendungen für alle Untersuchungen und Therapien, die du bei diesem Behandler bis zum aktuellen Zeitpunkt hast durchführen lassen? Wähle eine grob passende Stufe. Erneutes Anklicken deiner Auswahl nimmt sie zurück.')}</div><div class="cost-contexts insurance-toggle" role="group" aria-label="Versicherungs- und Abrechnungskontext">${costSystem().options.map(([value,label]) => `<button type="button" data-insurance="${value}" aria-pressed="${state.insurance === value}">${label}</button>`).join('')}</div>${dotScale('costs-' + costContext(), scales.costs.map(label=>window.LCNCost?.amount(label,costSystem().code==='CH'?'CHF':'EUR')||label))}</section>` +
      `<section class="card">${blockTitle('Wartezeit auf den Ersttermin', 'Wie lange musstest du auf deinen ersten Termin warten? Wähle die Stufe, die auf deine Erfahrung zutrifft. Erneutes Anklicken deiner Auswahl nimmt sie zurück.')}${dotScale('wait', scales.wait)}</section>` +
      `<section class="card">${blockTitle('Wartezeit auf Folgetermine', 'Wie lange musstest du bei diesem Behandler auf einen Folgetermin warten? Wähle die Stufe, die auf deine Erfahrung zutrifft. Erneutes Anklicken deiner Auswahl nimmt sie zurück.')}${dotScale('wait-followup', scales.wait)}</section>`;
  }

  function effect() {
    return `<section class="card"><div class="chart-heading"><div><h3>Community-Bewertung</h3><p>Subjektive Erfahrungen nach der Therapie.</p></div><span>${communityNote('effect')}</span></div><div class="effect-chart" role="group" aria-label="Zustandsveränderung: Community und deine Auswahl">${[0,1,2,3].map(i => { const label=i===1?'Neutral':scales.effect[i]; const value = percent('effect',i); return `<button type="button" class="effect-column" data-choice="effect" data-value="${i}" aria-pressed="${state.selections.effect === i}" aria-label="${label}: ${percentText(value)}. Als eigene Erfahrung auswählen"><span class="bar-area"><strong>${percentText(value)}</strong><span class="effect-bar effect-${i}" style="height:${(value || 0) * 1.5}px"></span></span><span class="effect-label">${label}</span></button>`; }).join('')}</div>${effectComparison()}</section>` + '<section class="card ux-symptom-help" data-doctor-symptom-help><h3>Bei welchen Symptomen hat dir der Behandler geholfen?</h3><p>Klicke die Symptome an, bei denen dir die Behandlung geholfen hat. Erneutes Anklicken nimmt deine Stimme zurück.</p><ol class="ux-symptom-ranking" data-symptom-ranking aria-label="Symptome nach hilfreichen Erfahrungen"></ol><div class="ux-symptom-picker" data-symptom-combobox><label for="doctor-symptom-search">Weiteres Symptom auswählen</label><div class="ux-symptom-input-wrap"><input id="doctor-symptom-search" type="text" role="combobox" data-symptom-search placeholder="Symptom auswählen oder eintippen …" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="doctor-symptom-picker"><button type="button" data-symptom-toggle aria-label="Symptomliste öffnen" aria-controls="doctor-symptom-picker" aria-expanded="false">⌄</button></div><div id="doctor-symptom-picker" role="listbox" aria-label="Weitere Symptome" data-symptom-picker hidden></div></div></section>' + treatmentSection();
  }
  let pendingCatalogTreatments=[],treatmentFeedback={};window.addEventListener('lcn-relation-feedback',event=>{treatmentFeedback=event.detail||{};if(state.treatmentSort==='feedback'&&document.getElementById('treatment-section'))refreshTreatmentControls();});
  window.addEventListener('lcn-pending-treatments',event=>{pendingCatalogTreatments=event.detail||[];if(document.getElementById('treatment-section'))refreshTreatmentControls();});
  function treatmentSection() {
    if (!state.data) return '<section class="card" id="treatment-section"><h3>Therapien</h3>'+dataStatus()+'</section>';
    const grouped=Object.fromEntries(Object.entries(state.data.treatments_grouped||{}).map(([category,entries])=>[category,[...entries]]));
    const existing=new Set(Object.values(grouped).flat().map(e=>Number(e.treat_id)));
    pendingCatalogTreatments.forEach(item=>{if(item.id&&existing.has(item.id))return;const category=item.category||'Kategorie unbekannt';(grouped[category]??=[]).push({...item.details,treat_id:item.id||-item.submission_id,behandlung:item.name,pending:true,pendingSubmission:item.submission_id,pendingOwn:item.own,feedbackKey:item.id?'d:'+Number(new URLSearchParams(location.search).get('id'))+':t:'+item.id:'s:'+item.submission_id,dummy_example:item.dummy_example,total_votes:item.details?.total_votes||0,provider_total:item.details?.provider_total??null});});
    const groups=Object.entries(grouped).sort((a,b)=>b[1].length-a[1].length);
    const all=[...new Map(groups.flatMap(([category,entries])=>entries.map(e=>{
      const example=state.community?.treatment_experiences?.[e.treat_id]||(includeDummy?e.dummy_example:null);
      if(!example)return [Number(e.treat_id),{...e,category,improvement_ratio:e.improvement_ratio??e.positive_ratio,positive_ratio:Number(e.improvement_ratio??e.positive_ratio??0)+Number(e.healing_ratio??0)}];
      const counts=[Number(e.contra||0)+example.worsening,Number(e.neutral||0)+example.unchanged,Number(e.pro||0)+example.improvement,Number(e.healing||0)+example.healing];
      const total=counts.reduce((sum,count)=>sum+count,0);
      const ratios=counts.map(count=>Math.round(count*1000/total)/10);
      return [Number(e.treat_id),{...e,category,total_votes:total,negative_ratio:ratios[0],neutral_ratio:ratios[1],improvement_ratio:ratios[2],positive_ratio:(counts[2]+counts[3])*100/total,healing_ratio:ratios[3]}];
    }))).values()];
    if(!all.length)return '<section class="card" id="treatment-section"><h3>Therapien</h3><p>Noch keine Therapien zugeordnet.</p></section>';
    const editorialData=state.data.analysis?.editorial;
    const editorialIds=(editorialData?.matches||[]).flatMap(e=>e.treat_ids);
    const editorial=all.filter(e=>editorialIds.includes(Number(e.treat_id)));
    const catalog=state.data.analysis?.catalog;
    const category=state.treatmentCategory;
    let rows=category==='@editorial'?editorial:category&&category!=='*'?all.filter(e=>e.category===category):all;
    const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replaceAll('ß','ss');
    rows=rows.filter(e=>(state.treatmentFilterCategories===null||state.treatmentFilterCategories.includes(e.category)) && normalized(e.behandlung+' '+e.category+' '+(e.unterkategorie||'')).includes(normalized(state.treatmentQuery.trim())) && (!state.treatmentOnlyRated||Number(e.total_votes)>0) && ((state.treatmentPositiveMin===0&&state.treatmentHealingMin===0&&state.treatmentNegativeMax===100)||(Number(e.total_votes)>0&&Number(e.improvement_ratio)>=state.treatmentPositiveMin&&Number(e.healing_ratio||0)>=state.treatmentHealingMin&&Number(e.negative_ratio)<=state.treatmentNegativeMax)));
    rows=[...rows].sort((a,b)=>category==='@editorial'?editorialIds.indexOf(Number(a.treat_id))-editorialIds.indexOf(Number(b.treat_id)):Number(b.provider_total??b.provider_count)-Number(a.provider_total??a.provider_count)||a.behandlung.localeCompare(b.behandlung,'de'));
    if(state.treatmentSort){
      const value=e=>({name:e.behandlung,category:categoryLabel(e.category),experience:Number(e.improvement_ratio)||0,healing:Number(e.healing_ratio)||0,feedback:(()=>{const f=treatmentFeedback[e.feedbackKey||'d:'+Number(new URLSearchParams(location.search).get('id'))+':t:'+e.treat_id];return (f?.confirm||0)-(f?.oppose||0);})(),negative:Number(e.negative_ratio)||0,votes:Number(e.total_votes)||0,providers:Number(e.provider_total??e.provider_count)||0,editorial:editorialIds.includes(Number(e.treat_id))?1:0})[state.treatmentSort];
      rows.sort((a,b)=>{const x=value(a),y=value(b);const cmp=typeof x==='string'?x.localeCompare(y,'de'):x-y;return cmp*(state.treatmentSortDirection==='asc'?1:-1)||a.behandlung.localeCompare(b.behandlung,'de');});
    }
    const link=e=>{const name=e.treat_id>0?'<a '+(e.pending?'data-catalog-feedback-key="'+escape(e.feedbackKey)+'" ':'')+'href="therapie_detail.html?treat_id='+Number(e.treat_id)+'&source=priority">'+escape(e.behandlung)+'</a>':'<span data-catalog-feedback-key="'+escape(e.feedbackKey)+'">'+escape(e.behandlung)+'</span>';return name+(e.pending?'<small class="catalog-inline-pending">Prüfung ausstehend</small>':'');};
    const ratingValue=(e,key)=>Number(e.total_votes)>0?Number(e[key]||0).toLocaleString('de-DE',{maximumFractionDigits:0})+' %':'—';
    const cardRatings=e=>'<div class="treatment-card-ratings" role="group" aria-label="Therapieerfahrungen">'+[['Verschlechterung','negative_ratio','negative'],['Neutral','neutral_ratio','neutral'],['Verbesserung','improvement_ratio','improvement'],['Heilung','healing_ratio','healing']].map(([label,key,tone])=>'<div class="treatment-card-rating treatment-card-rating-'+tone+'"><strong>'+ratingValue(e,key)+'</strong><span>'+label.replace('Verbesserung','Verbes&shy;serung').replace('Verschlechterung','Verschlech&shy;terung')+'</span></div>').join('')+'</div><small class="treatment-card-rating-total">'+(Number(e.total_votes)>0?Number(e.total_votes)+' Bewertungen':'Noch keine Bewertungen')+'</small>';
    const meta=e=>e.pending&&e.provider_total==null?'':Number(e.provider_total??e.provider_count??0)+' Behandler';
    const card=(key,label,count)=>'<button type="button" class="treatment-category-card" data-treatment-category="'+escape(key)+'"><span>'+escape(label)+'</span><strong>'+count+'</strong><span>Therapien →</span></button>';
    const filterControls='<div class="treatment-controls"><div class="treatment-search-controls"><label>Therapie suchen<input type="search" id="treatment-query" value="'+escape(state.treatmentQuery)+'" placeholder="Name, Kategorie oder Unterkategorie"></label><details id="treatment-category-filter"><summary>Kategorien'+(state.treatmentFilterCategories===null?' · alle':' · '+state.treatmentFilterCategories.length)+'</summary><div class="treatment-category-options"><button type="button" data-treatment-filter-all="1">Alle</button><button type="button" data-treatment-filter-none="1">Keine</button>'+groups.map(([name])=>'<label><input type="checkbox" data-treatment-filter-category="'+escape(name)+'" '+(state.treatmentFilterCategories===null||state.treatmentFilterCategories.includes(name)?'checked':'')+'> '+escape(categoryLabel(name))+'</label>').join('')+'</div></details><label class="treatment-rated-toggle"><input type="checkbox" id="treatment-only-rated" '+(state.treatmentOnlyRated?'checked':'')+'> Nur mit Bewertung</label><button type="button" id="treatment-reset-filters">Zurücksetzen</button></div><div class="treatment-rating-controls">'+[['positive','Verbesserung mindestens',state.treatmentPositiveMin],['healing','Heilung mindestens',state.treatmentHealingMin],['negative','Negative Erfahrungen höchstens',state.treatmentNegativeMax]].map(([key,label,value])=>'<div><label for="treatment-'+key+'-range">'+label+'</label><div class="treatment-range-row"><input id="treatment-'+key+'-range" data-treatment-rating="'+key+'" type="range" min="0" max="100" value="'+value+'"><input aria-label="'+label+' in Prozent" id="treatment-'+key+'-number" data-treatment-rating="'+key+'" type="number" min="0" max="100" value="'+value+'"><span>%</span></div></div>').join('')+'<label>Sortieren<select id="treatment-sort-select">'+[['name:asc','Name A–Z'],['name:desc','Name Z–A'],['experience:desc','Verbesserung ↓'],['healing:desc','Heilung ↓'],['feedback:desc','Rückmeldungen ↓'],['negative:desc','Negative Erfahrungen ↓'],['votes:desc','Bewertungen ↓'],['providers:desc','Behandler ↓']].map(([key,label])=>'<option value="'+key+'" '+((state.treatmentSort||'providers')+':'+state.treatmentSortDirection===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div></div><p class="treatment-result-count" role="status">'+rows.length+' von '+all.length+' Therapien'+(category&&category!=='*'?' in der gewählten Auswahl':'')+'</p>';
    let body='';
    if(state.treatmentView==='categories'&&!category){
      body='<div class="treatment-categories">'+groups.map(([name])=>[name,rows.filter(e=>e.category===name)]).filter(([,entries])=>entries.length).map(([name,entries])=>card(name,categoryLabel(name),entries.length)).join('')+'</div>';
    }else{
      const label=category==='@editorial'?'Top-Therapien':category&&category!=='*'?categoryLabel(category):'Alle Therapien';
      body='<div class="treatment-drilldown"><strong>'+escape(label)+' · '+(category==='@editorial'?editorialData.matched_count+' Top-Therapien, '+rows.length+' Einträge':rows.length+' Therapien')+'</strong><button type="button" id="treatment-back">Alle Kategorien</button></div>';
      if(!rows.length)body+='<p>Noch keine passenden Therapien zugeordnet.</p>';
      else if(state.treatmentView==='cards')body+='<div class="treatment-categories treatment-rating-cards">'+rows.map(e=>'<article class="treatment-result-card"><h4>'+link(e)+'</h4><p>'+escape(categoryLabel(e.category))+'</p><small>'+meta(e)+'</small>'+cardRatings(e)+'</article>').join('')+'</div>';
      else {
        const header=(label,key)=>'<th '+(key==='feedback'?'data-catalog-report-heading ':'')+'scope="col" aria-sort="'+(state.treatmentSort===key?(state.treatmentSortDirection==='asc'?'ascending':'descending'):'none')+'"><button type="button" class="doctor-detail-treatment-table-sort" data-treatment-sort="'+key+'">'+label+'</button></th>';
        const experience=e=>'<div class="doctor-detail-treatment-experience-row">'+[['Verschlechterung','negative_ratio',0],['Neutral','neutral_ratio',1],['Verbesserung','improvement_ratio',2],['Heilung','healing_ratio',3]].map(([label,key,color])=>{const value=Number(e.total_votes)>0&&e[key]!=null?Number(e[key])+'%':'–';return '<span class="treatment-experience-value experience-'+color+'" title="'+label+': '+(value==='–'?'noch nicht erfasst':value)+'" aria-label="'+label+': '+(value==='–'?'noch nicht erfasst':value)+'">'+value+'</span>';}).join('')+'</div>';

        const providers=e=>'<span class="doctor-detail-treatment-provider-badge">'+(Number(e.provider_total??e.provider_count)||'—')+'</span>';
        body+='<p class="treatment-rating-note">Behandler gesamt zählt den gesamten Katalog. Ein Strich bedeutet, dass für diese Kategorie noch keine Bewertung vorliegt.</p><div class="treatment-experience-legend"><span><i class="effect-0"></i>Verschlechterung</span><span><i class="effect-1"></i>Neutral</span><span><i class="effect-2"></i>Verbesserung</span><span><i class="effect-3"></i>Heilung</span></div><div class="doctor-detail-treatment-table-wrap"><table class="doctor-detail-treatment-table doctor-detail-treatment-table-detailed"><caption class="sr-only">Therapien mit Erfahrungen, Bewertungen und Behandlern</caption><thead><tr><th scope="col" aria-label="Rang">#</th>'+header('Therapie','name')+header('Kategorie','category')+header('<span class="table-heading-label">Negative<br>Erfahrungen</span>','negative')+header('Verbesserung','experience')+header('Heilung','healing')+header('<span class="table-heading-label">Bewertungen<small>Anzahl</small></span>','votes')+header('<span class="table-heading-label">Behandler<br>gesamt</span>','providers')+header('Rück&shy;meldungen','feedback')+'</tr></thead><tbody>'+rows.map((e,i)=>'<tr><td><span class="doctor-detail-treatment-rank-badge">#'+(i+1)+'</span></td><td>'+link(e)+'</td><td><span class="doctor-detail-treatment-category-inline">'+escape(categoryLabel(e.category)).replaceAll('Nahrungsergänzungsmittel','Nahrungs&shy;ergänzungs&shy;mittel')+'</span></td><td><span class="catalog-rating-number catalog-rating-negative">'+ratingValue(e,'negative_ratio')+'</span></td><td><span class="catalog-rating-number">'+ratingValue(e,'improvement_ratio')+'</span></td><td><span class="catalog-rating-number">'+ratingValue(e,'healing_ratio')+'</span></td><td><span class="doctor-detail-treatment-vote-total">'+Number(e.total_votes||0)+'</span></td><td>'+providers(e)+'</td></tr>').join('')+'</tbody></table><table class="doctor-detail-treatment-compact-table"><caption class="sr-only">Kompakte Therapieliste</caption><thead><tr><th scope="col">#</th>'+header('Therapie','name')+header('<span class="table-heading-label">Negative<br>Erfahrungen</span>','negative')+header('Verbesserung','experience')+header('Heilung','healing')+header('Behandler','providers')+header('Rück&shy;meldungen','feedback')+'</tr></thead><tbody>'+rows.map((e,i)=>'<tr><td>'+(i+1)+'</td><td>'+link(e)+'</td><td><span class="catalog-rating-negative">'+ratingValue(e,'negative_ratio')+'</span></td><td>'+ratingValue(e,'improvement_ratio')+'</td><td>'+ratingValue(e,'healing_ratio')+'</td><td>'+providers(e)+'</td></tr>').join('')+'</tbody></table></div>';
      }
    }
    const diagnostics=all.filter(e=>e.category==='Diagnostik').length;
    const medicines=all.filter(e=>e.category==='Arzneimittel').length;
    const knownGroups=groups.filter(([name])=>name!=='Ohne Kategorie'&&name!=='Diagnostik');
    const specializations=labels(state.data.research?.specializations);
    const percentile=all.length<=5?'Wenige dokumentierte Einträge':catalog?.top_percent!=null?'Top '+catalog.top_percent+' %':'Noch kein Vergleich verfügbar';
    const preview=(editorialData?.matches||[]).slice(0,3).map(topic=>'<li><button type="button" data-treatment-category="@editorial">'+escape(topic.label)+'</button></li>').join('');
    const categories=groups.filter(([name])=>name!=='Ohne Kategorie');
    const summary='<div class="treatment-profile-summary"><div><span>Umfang im Vergleich</span><strong class="'+(all.length>5&&catalog?.top_percent!=null?'score-percentile score-percentile-level-'+(catalog.top_percent<=20?4:catalog.top_percent<=40?3:catalog.top_percent<=60?2:catalog.top_percent<=80?1:0):'')+'">'+percentile+'</strong><dl class="profile-average"><div><dt>Diese Praxis</dt><dd>'+all.length+' Einträge</dd></div><div><dt>Vergleichsgruppe</dt><dd>'+(catalog?catalog.doctor_count:'–')+' Behandler</dd></div></dl><small>'+(all.length<=5?'Bis einschließlich fünf Einträge: keine Prozent-Einstufung.':catalog?.top_percent!=null?catalog.at_least_count+' von '+catalog.doctor_count+' Profilen haben mindestens '+all.length+' Einträge.':'')+' Verglichen werden alle Katalogprofile mit mehr als fünf Einträgen. </small></div><div><span>Häufigste Kategorien</span><strong>'+categories.length+' Kategorien</strong><ul class="profile-summary-list">'+categories.slice(0,3).map(([name,entries])=>'<li><button type="button" data-treatment-category="'+escape(name)+'">'+escape(categoryLabel(name))+' <b>'+entries.length+'</b></button></li>').join('')+'</ul><button type="button" class="profile-summary-more" data-treatment-view="categories">Alle Kategorien anzeigen →</button></div><div><div class="top-therapy-heading"><span>Abdeckung von Top-Therapien</span><span class="top-therapy-help adaptation-heading-help"><button type="button" class="heading-help-trigger" aria-label="Was sind Top-Therapien?" aria-describedby="top-therapy-info"><span aria-hidden="true">ⓘ</span></button><span id="top-therapy-info" class="heading-help-info" role="tooltip">Was sind Top-Therapien und was zeigt ihre Abdeckung? Top-Therapien sind eine redaktionelle Auswahl zur Orientierung, kein Wirksamkeitsranking. Die Abdeckung zeigt, wie viele Therapien aus dieser Auswahl der Praxis zugeordnet sind.</span></span></div><strong>'+(editorialData?editorialData.matched_count+' von '+editorialData.total+' Top-Therapien':'Noch nicht abgeglichen')+'</strong><ul class="profile-summary-list editorial-preview">'+preview+'</ul>'+(editorialData?'<button type="button" class="profile-summary-more" data-treatment-category="@editorial">Alle '+editorialData.matched_count+' Top-Therapien anzeigen →</button>':'')+'</div></div>';
    const editorialNotes=editorialData?.partial?.length?'<details class="treatment-match-notes"><summary>'+editorialData.partial.length+' nur teilweise passende Zuordnungen</summary><p>Diese zählen nicht als bestätigter Treffer der redaktionellen Auswahl:</p><ul>'+editorialData.partial.map(e=>'<li>'+escape(e.label)+'</li>').join('')+'</ul><p>Zum Beispiel belegt allgemeine Physiotherapie keine PEM-Anpassung; einzelne Komponenten belegen keine vollständige Kombination.</p></details>':'';
    return '<section class="card" id="treatment-section"><h3 tabindex="-1">Therapien <span class="total-count">'+all.length+'</span></h3><p>Das recherchierte Therapieprofil von '+escape(state.data.item.dr_display_name)+'.</p>'+summary+'<p class="treatment-specializations"><strong>Erfasste Spezialisierungen:</strong> '+(escape(specializations)||'<span class="overview-missing">Noch keine Angabe</span>')+'</p><p class="field-note">Der Vergleich beschreibt dokumentierte Einträge, nicht Qualität oder Wirksamkeit. Die Vergleichsgruppe wächst mit weiteren Katalogprofilen mit mehr als fünf Einträgen. Die redaktionelle Auswahl ist kein Wirksamkeitsranking.</p>'+editorialNotes+'<div class="treatment-view-switch" role="group" aria-label="Therapieansicht">'+[['categories','Kategorien'],['list','Liste'],['cards','Kacheln']].map(([key,label])=>'<button type="button" data-treatment-view="'+key+'" aria-pressed="'+(state.treatmentView===key)+'">'+label+'</button>').join('')+'</div>'+filterControls+'<div id="treatment-results" tabindex="-1" aria-label="Therapien und Kategorien">'+body+'</div></section>';

  }
  function appointmentCountNote() {
    if(!state.community)return communityNote('appointment-0-0');
    let total=0;
    for(let r=0;r<2;r++)for(let c=0;c<3;c++){const q=question('appointment-'+r+'-'+c);total+=Number(q.total)||0;}
    return total?total+' Einzelangaben':'Noch keine Community-Angaben';
  }
  function alignCommunityCounters() {
    content.querySelectorAll('.appointment-variant').forEach(card=>{const note=document.createElement('p');note.className='community-label';note.textContent=appointmentCountNote();note.title='Summe über sechs Terminfragen; eine Person kann mehrere Angaben machen.';card.append(note);});
    content.querySelectorAll('.card').forEach(card=>{
      const note=card.querySelector('.community-label')||card.querySelector('.chart-heading > span'),heading=card.querySelector('.cost-heading, .chart-heading, .block-heading');
      if(!note||!heading)return;
      let row=heading;
      if(!heading.matches('.cost-heading, .chart-heading')){row=document.createElement('div');heading.before(row);row.append(heading);}
      row.classList.add('assessment-header');note.classList.add('assessment-count');
      const meta=document.createElement('div');meta.className='assessment-meta';meta.append(note);
      const country=row.querySelector('.cost-country');if(country)meta.append(country);row.append(meta);
    });
  }
  function ratingComparison(key,minimum,unit,reference) {
    const summarize=options=>{
      const total=options.reduce((sum,o)=>sum+Number(o.count||0),0);
      return {total,mean:total?options.reduce((sum,o,i)=>sum+Number(o.count||0)*(i+1),0)/total:null};
    };
    const own=summarize(question(key).options||[]);
    const values=(state.community?.comparison_profiles||[]).flatMap(profile=>{
      const data=summarize(profile.questions[key]?.options||[]);
      return data.total>=minimum?[data.mean]:[];
    });
    const average=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
    const eligible=own.total>=minimum;
    const difference=eligible&&average!=null?own.mean-average:null;
    const top=difference==null?null:Math.max(1,Math.ceil(100*values.filter(value=>value>=own.mean-1e-9).length/values.length));
    const format=value=>value.toLocaleString('de-DE',{maximumFractionDigits:2});
    return '<div class="score-comparison"><span class="score-comparison-label">Vergleich mit anderen Behandlern</span><div class="score-comparison-highlights"><strong>'+(difference==null?'Keine Einordnung möglich':Math.abs(difference)<.005?'Im Durchschnitt':format(Math.abs(difference))+' Punkte '+(difference>0?'über':'unter')+' dem Durchschnitt')+'</strong>'+(top==null?'':'<strong class="score-percentile score-percentile-level-'+(top<=20?4:top<=40?3:top<=60?2:top<=80?1:0)+'">Top '+top+' %</strong>')+'</div><div class="comparison-values">'+(own.mean==null?'Noch keine Angaben.':'<span>Dieser Behandler:</span><strong>'+format(own.mean)+' / '+unit+'</strong>')+(average==null?'':'<span>Durchschnitt:</span><strong>'+format(average)+' / '+unit+'</strong>')+'</div><details class="comparison-basis"><summary>Verglichen mit '+values.length+' anderen Behandlern.</summary><p>'+reference+' Jeder Behandler zählt im Vergleich gleich.'+(!eligible&&minimum>1?' Für diesen Behandler sind dafür noch zu wenige Bewertungen vorhanden.':'')+'</p></details></div>';
  }
  function effectComparison() {
    return ratingComparison('effect',10,4,'Vergleich: Behandler mit mindestens zehn Community-Bewertungen.');
  }
  function totalComparisonValues() {
    const ownLocation=savedLocation();
    return (state.community?.comparison_profiles||[]).flatMap(profile=>{
      if(Number(profile.id)===doctorId)return [];
      let distance=null;
      if(ownLocation&&profile.lat!=null&&profile.lng!=null){
        const rad=v=>v*Math.PI/180,a=Math.sin(rad(profile.lat-ownLocation.lat)/2)**2+Math.cos(rad(ownLocation.lat))*Math.cos(rad(profile.lat))*Math.sin(rad(profile.lng-ownLocation.lng)/2)**2;
        distance=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
      }
      const candidate=window.lcnDashboardScore({...profile,costKey:'costs-'+costContext(),distance});
      if(candidate.dataCoverage<70||!candidate.coverage)return [];
      return [100*candidate.earned/candidate.coverage];
    });
  }
  function dashboardCalculation() {
    const groups=Object.entries(state.data?.treatments_grouped||{}),editorial=state.data?.analysis?.editorial;
    const result=window.lcnDashboardScore({questions:state.community?.questions,costKey:'costs-'+costContext(),distance:distanceKm(),onlineFirst:onlineAppointments().complete,researchedOnlineComplete:researchedRemoteAccess().complete,researchedRemoteFirst:researchedRemoteAccess().first,researchedRemoteFollow:researchedRemoteAccess().follow,treatmentCount:new Set(groups.flatMap(([,items])=>items.map(t=>t.treat_id))).size,categoryCount:groups.filter(([name,items])=>items.length&&name!=='Ohne Kategorie').length,editorialCount:editorial?.matched_count,editorialTotal:editorial?.total});
    return result;
  }
  function scoreDataStatus() {
    if(state.communityError)return '<section class="card" role="status"><p>Die Auswertung konnte nicht geladen werden.</p><button type="button" id="retry-data">Erneut versuchen</button></section>';
    if(state.loading||communityLoading||!state.community)return '<section class="card score-loading" role="status" aria-busy="true"><span class="score-loading-bar" aria-hidden="true"></span><p>Auswertung wird geladen …</p></section>';
    return '';
  }
  function scoreMissingText(row) {
    return row?.answerCount>0?'Weniger als zehn Angaben':'Keine Angaben';
  }
  function dashboardScore(overview = false) {
    const status=scoreDataStatus();
    if(status)return status;
    const result=dashboardCalculation();
    const number=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1});
    return '<section class="card dashboard-score doctor-relative-summary">'+window.lcnDoctorRelativeScore.render(result,totalComparisonValues())+(overview?'':'<details><summary>Gewichtung und Teilwerte ansehen</summary><div class="score-explanation"><p>Insgesamt sind 100 Punkte möglich: Belastung 30, Zugang 30, Erfahrungen und Angebot 40. Sind Erst- und Folgetermin aus der Ferne bestätigt, erhält der gesamte Belastungsbereich 30 Punkte; Wartezimmer und Entfernung verursachen keinen Abzug. Bereiche ohne Angaben werden vollständig aus der Gewichtung genommen. Oben stehen die erreichten Punkte im Verhältnis zu den aktuell bewertbaren Punkten. Community-Bereiche zählen ab zehn Angaben. Therapieanzahl und Kategorienvielfalt bilden zusammen einen Bereich; ihre Teilpunkte bleiben einzeln sichtbar.</p><p>Anreise und Kassensystem sorgen für ein individuelles Ergebnis.</p></div><div class="score-parts">'+[...result.rows].sort((a,b)=>['Termin-Anpassung','Ersttermin aus der Ferne','Folgetermin aus der Ferne','Persönliche Anreise','Eigene Behandlungskosten','Wartezeit auf Ersttermin','Wartezeit auf Folgetermine','Berichtete Zustandsveränderung','Anzahl Therapien','Vielfalt der Kategorien'].indexOf(a.label)-['Termin-Anpassung','Ersttermin aus der Ferne','Folgetermin aus der Ferne','Persönliche Anreise','Eigene Behandlungskosten','Wartezeit auf Ersttermin','Wartezeit auf Folgetermine','Berichtete Zustandsveränderung','Anzahl Therapien','Vielfalt der Kategorien'].indexOf(b.label)).map(row=>'<div><strong>'+escape(row.label)+'</strong><span>'+(row.value==null?scoreMissingText(row):number(row.value*row.weight)+' / '+row.weight+' Punkte')+'</span><small>'+escape(row.reason.replace('Euro',costSystem().code==='CH'?'Schweizer Franken':'Euro'))+'</small></div>').join('')+'</div><p>Die Gesamtpunktzahl bezieht sich auf die aktuell bewertbaren Punkte. Die Ferntermin-Werte beschreiben Zustimmung pro Terminform, keine zusammengeführte Wahrscheinlichkeit.</p></details>')+'</section>';
  }
  function dashboard() {
    const status=scoreDataStatus();
    if(status)return status;
    const result=dashboardCalculation();
    const number=n=>n.toLocaleString('de-DE',{maximumFractionDigits:1});
    const points=row=>'<div class="dashboard-points"><strong>'+(row?.value==null?scoreMissingText(row):number(row.value*row.weight)+' <small>/ '+row.weight+' Punkte</small>')+'</strong></div>';
    const scoreRow=label=>result.rows.find(row=>row.label===label);
    const dist=(key,labels,row)=>'<div class="dashboard-distribution dashboard-scored-distribution"><div class="dashboard-distribution-head"><span>Ausprägung</span><span>Community</span><span>Stufenwert</span></div>'+labels.map((label,i)=>'<div><span>'+escape(label)+'</span><div class="dashboard-bar-value"><div class="dashboard-track"><span class="'+(key==='effect'?'effect-'+i:'dashboard-blue')+'" style="width:'+(percent(key,i)||0)+'%"></span></div><strong>'+percentText(percent(key,i))+'</strong></div><span class="dashboard-level-points">'+number(row.scalePoints[i])+' P.</span></div>').join('')+'</div>';
    const costDistribution=(key,labels,row)=>'<div class="dashboard-cost-scale" role="list" aria-label="Behandlungskosten: Community-Anteil und Stufenwert">'+labels.map((label,i)=>'<div role="listitem"><strong class="dashboard-cost-share">'+percentText(percent(key,i))+'</strong><span class="dashboard-cost-bar-area" aria-hidden="true"><span class="dashboard-cost-bar" style="height:'+Math.max(0,Math.min(100,percent(key,i)||0))+'%"></span></span><span class="dashboard-cost-label">'+escape(label)+'</span><b class="dashboard-cost-points">'+number(row.scalePoints[i])+' P.</b></div>').join('')+'</div>';
    const card=(title,key,labels,view,extra='')=>{
      const row=result.rows.find(row=>row.key===key);
      return '<section class="card dashboard-card" data-dashboard-question="'+key+'"><div class="assessment-header"><h3>'+title+'</h3><span class="assessment-count">'+communityNote(key)+'</span></div>'+points(row)+extra+(key.startsWith('costs-')?costDistribution(key,labels,row):dist(key,labels,row))+'<p class="dashboard-score-reason">'+(row?.remoteOverride?escape(row.reason):'Die Anteile der Community gewichten die Stufenwerte zum angezeigten Punktwert.')+'</p><a class="dashboard-detail" href="#'+view+'">Details ansehen →</a></section>';
    };
    const costKey='costs-'+costContext();
    const costChoices='<div class="insurance-toggle dashboard-insurance" aria-label="Versicherungskontext">'+costSystem().options.map(([value,label])=>'<button type="button" data-insurance="'+value+'" aria-pressed="'+(state.insurance===value)+'">'+label+'</button>').join('')+'</div>';
    const appointments='<section class="card dashboard-card dashboard-card-wide"><div class="assessment-header"><h3>Terminform</h3><span class="assessment-count">'+appointmentCountNote()+'</span></div><div class="dashboard-appointments">'+['Ersttermin','Folgetermin'].map((type,r)=>{
      const row=scoreRow(r?'Folgetermin aus der Ferne':'Ersttermin aus der Ferne');
      if(row?.researchConfirmed)return '<section><div class="dashboard-appointment-heading"><h4>'+type+'</h4>'+points(row)+'</div><p class="dashboard-research-note"><strong>Aus der Ferne möglich · Recherche bestätigt</strong></p><p>'+escape(r?researchedRemoteAccess().followMethod:researchedRemoteAccess().firstMethod)+'</p><p class="dashboard-score-reason">Redaktionell bestätigte Terminform. Community-Antworten werden dadurch nicht ersetzt.</p></section>';
      return '<section><div class="dashboard-appointment-heading"><h4>'+type+'</h4>'+points(row)+'</div><div class="dashboard-term-distribution"><div class="dashboard-term-head"><span>Terminform</span><span>Nicht möglich · möglich</span><span>Stufenwert</span></div>'+['Vor Ort','Telefon','Video'].map((label,c)=>{
        const q=question('appointment-'+r+'-'+c),yes=q.options[0]?.count||0,no=q.options[1]?.count||0,total=yes+no;
        const yesPercent=total?100*yes/total:null,noPercent=total?100*no/total:null;
        return '<div class="dashboard-term-row"><span>'+label+'</span><div class="dashboard-term-bar"><div class="dashboard-term-meter" role="img" aria-label="'+(total?percentText(noPercent)+' nicht möglich, '+percentText(yesPercent)+' möglich':'Keine Angaben')+'">'+(total?'<span class="term-no" style="width:'+noPercent+'%"></span><span class="term-yes" style="width:'+yesPercent+'%"></span>':'')+'</div><div class="dashboard-term-percent"><span>'+percentText(noPercent)+'</span><span>'+percentText(yesPercent)+'</span></div></div><span class="dashboard-level-points">'+(c?'3 P.':'0 P.')+'</span></div>';
      }).join('')+'</div><p class="dashboard-score-reason">Möglich: 3 Punkte · nicht möglich: 0 Punkte. Der höhere Möglich-Anteil von Telefon oder Video zählt, ohne Addition. Vor Ort gibt keine Punkte.</p></section>';
    }).join('')+'</div><a class="dashboard-detail" href="#termin">Details ansehen →</a></section>';
    const groups=Object.entries(state.data?.treatments_grouped||{}),count=new Set(groups.flatMap(([,items])=>items.map(t=>t.treat_id))).size,editorial=state.data?.analysis?.editorial;
    const treatmentRows=['Anzahl Therapien','Vielfalt der Kategorien'].map(scoreRow);
    const treatmentEarned=treatmentRows.reduce((sum,row)=>sum+(row.value??0)*row.weight,0),treatmentAvailable=treatmentRows.reduce((sum,row)=>sum+(row.value==null?0:row.weight),0);
    const treatments='<section class="card dashboard-card"><div class="assessment-header"><h3>Therapien</h3><span class="assessment-count">'+count+' Einträge</span></div><div class="dashboard-points"><strong>'+(treatmentAvailable?number(treatmentEarned)+' <small>/ '+treatmentAvailable+' Punkte</small>':'Keine Angaben')+'</strong></div><div class="dashboard-treatment-points">'+treatmentRows.map((row,i)=>'<div><span>'+['Anzahl: '+count+' Therapien','Vielfalt: '+groups.filter(([name,items])=>items.length&&name!=='Ohne Kategorie').length+' Kategorien','Top-Therapien: '+(editorial?editorial.matched_count+' von '+editorial.total:'Keine Angaben')][i]+'</span><strong>'+(row.value==null?scoreMissingText(row):number(row.value*row.weight)+' / '+row.weight+' P.')+'</strong></div>').join('')+'</div><p class="dashboard-score-reason">60 Therapien ergeben 7 Punkte, acht bekannte Kategorien 3 Punkte. Redaktionelle Top-Therapien werden nicht gewertet. Bei Anzahl und Vielfalt zählt der jeweilige Anteil.</p><a class="dashboard-detail" href="#wirkung">Therapien ansehen →</a></section>';
    const km=distanceKm(),band=km===null?null:travelBands.find(([limit])=>km<=limit),travelRow=scoreRow('Persönliche Anreise');
    const travel='<section class="card dashboard-card"><h3>Anreise</h3>'+points(travelRow)+'<strong class="dashboard-result">'+(result.remoteComplete?'Erst- und Folgetermin aus der Ferne · keine Anreise':km===null?'Standort für die Entfernung ergänzen':distanceText())+'</strong>'+(band&&!result.remoteComplete?'<p>'+band[2]+' · grobe Orientierung</p>':'')+'<p class="dashboard-score-reason">Erst- und Folgetermin aus der Ferne: volle 30 Punkte für den gesamten Belastungsbereich. Sonst Anreise: bis 20 km 14,4 P. · bis 50 km 10,8 P. · bis 100 km 7,2 P. · bis 300 km 3,6 P. · bis 800 km 1,8 P. · darüber: 0 P.</p><a class="dashboard-detail" href="#termin">Standort und Einordnung ansehen →</a></section>';
    const group=(sectionNumber,title,maximum,body)=>{
      const labels=sectionNumber===2?['Termin-Anpassung','Ersttermin aus der Ferne','Folgetermin aus der Ferne','Persönliche Anreise']:sectionNumber===3?['Eigene Behandlungskosten','Wartezeit auf Ersttermin','Wartezeit auf Folgetermine']:['Berichtete Zustandsveränderung','Anzahl Therapien','Vielfalt der Kategorien'];
      const rows=result.rows.filter(row=>labels.includes(row.label));
      const available=rows.filter(row=>row.value!=null);
      const earned=available.reduce((sum,row)=>sum+row.value*row.weight,0);
      return '<section class="dashboard-score-group"><h2 class="dashboard-group-heading"><span class="dashboard-group-number">'+sectionNumber+'</span><span>'+title+'</span><small>'+(available.length?number(earned)+' von '+maximum+' Punkten':'Noch nicht auswertbar · maximal '+maximum+' Punkte')+(available.length&&available.length<rows.length?' · Angaben unvollständig':'')+'</small></h2><div class="dashboard-grid">'+body+'</div></section>';
    };
    return dashboardScore()+group(2,'Welche Belastungshürden gibt es bei einem Termin?',30,card('Long-Covid-gerechter Termin','adaptation',scales.adaptation,'termin')+travel+appointments)+group(3,'Wie zugänglich ist der Behandler?',30,card('Behandlungskosten',costKey,scales.costs.map(label=>window.LCNCost?.amount(label,costSystem().code==='CH'?'CHF':'EUR')||label),'zugang',costChoices)+card('Wartezeit auf den Ersttermin','wait',scales.wait,'zugang')+card('Wartezeit auf Folgetermine','wait-followup',scales.wait,'zugang'))+group(4,'Welche Erfahrungen gibt es?',40,card('Zustandsveränderung','effect',scales.effect,'wirkung')+treatments);

  }
  const views = { ueberblick: overview, termin: appointment, zugang: access, wirkung: effect, dashboard: dashboard };
  function render(focus = false) {
    detailMap?.remove();
    detailMap = null;
    document.querySelector('.profile').hidden = state.error;
    document.querySelector('.side-nav').hidden = state.error;
    document.querySelector('.detail-layout').classList.toggle('has-error', state.error);
    if (state.error) {
      content.innerHTML = '<section class="card" role="status"><h2>Praxis konnte nicht geladen werden</h2><p>Der Eintrag ist nicht in der aktuellen Auswahl enthalten oder die Daten sind gerade nicht erreichbar.</p><button type="button" id="retry-data">Erneut versuchen</button> <a href="aerzte_karte.html">Zur Behandler-Suche</a></section>';
      return;
    }
    content.innerHTML = views[state.view]();
    content.querySelectorAll('.cost-contexts,.dashboard-insurance').forEach(node=>{
      const control=document.createElement('div');control.className='cost-preferences';control.innerHTML=(window.LCNCost?.countryControl()||'')+(window.LCNCost?.currencyControl()||'')+'<small>'+(window.LCNCost?.rateNote(costSystem().code==='CH'?'CHF':'EUR')||'')+'</small>';node.closest('.card').append(control);
    });
    content.querySelectorAll('.cost-contexts,.dashboard-insurance').forEach(node=>{
      const card=node.closest('.card'),base=costSystem().code==='CH'?'CHF':'EUR';
      card.querySelectorAll('[data-choice^="costs-"]').forEach((button,i)=>{const text=window.LCNCost?.converted(scales.costs[i],base);if(text){const conversion=document.createElement('small');conversion.className='cost-converted';conversion.textContent=text;button.append(conversion);}});
    });
    alignCommunityCounters();
    decorateBoxHeadings();
    window.dispatchEvent(new Event('lcn-doctor-rendered'));
    profileMap?.invalidateSize();
    updateAnswerControls();
    detailMap = createMap(document.getElementById('doctor-detail-map'));
    initLocationSuggestions();
    document.querySelectorAll('[data-view]').forEach(link => {
      if (link.dataset.view === state.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (focus) { content.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  }
  window.addEventListener('lcn-online-ready',()=>{if(state.data)render();});
  window.addEventListener('lcn-exchange-rates',()=>{if(state.data)render();});
  async function changeDoctorCostPreferences(patch){if(state.saving||communityLoading)return;const previous=window.LCNCost.get(),insurance=state.insurance,before=costContext();window.LCNCost.set(patch);state.insurance=window.LCNCost.get().insurance.toLowerCase();const next=costContext();if(before!==next&&Object.keys(state.selections).some(k=>k.startsWith('costs-'))){if(!await saveAnswer({action:'move_cost_context',question:'costs-'+next})){window.LCNCost.set(previous);state.insurance=insurance;}}render();}
  content.addEventListener('change',event=>{const target=event.target;if(target.matches('[data-doctor-radius-enabled]')){locationRadiusEnabled=target.checked;render();return;}if(target.matches('[data-doctor-radius]')){if(target.validity.valid){locationRadius=Number(target.value);render();}return;}if(state.saving)return;if(event.target.matches('[data-cost-country]'))changeDoctorCostPreferences({country:event.target.value});else if(event.target.matches('[data-cost-custom-country]'))changeDoctorCostPreferences({customCountry:event.target.value});else if(event.target.matches('[data-cost-currency]'))changeDoctorCostPreferences({currency:event.target.value});});
  function navigate(focus) {
    const view = location.hash.slice(1);
    state.view = Object.hasOwn(views, view) ? view : 'ueberblick';
    render(focus);
  }
  function revealTreatmentResults() {
    const results=document.getElementById('treatment-results');
    if(!results)return;
    document.querySelectorAll('.adaptation-heading-help').forEach(el=>el.classList.add('help-dismissed'));
    results.focus({preventScroll:true});
    results.scrollIntoView({block:'start',behavior:'instant'});
  }
  function refreshTreatmentControls(focusId) {
    const section=document.getElementById('treatment-section');
    const open=document.getElementById('treatment-category-filter')?.open;
    const old=document.activeElement;
    const caret=old?.id==='treatment-query'?old.selectionStart:null;
    if(section){section.outerHTML=treatmentSection();decorateBoxHeadings();}
    const details=document.getElementById('treatment-category-filter');if(details)details.open=!!open;
    const target=focusId?document.getElementById(focusId):null;
    target?.focus({preventScroll:true});
    if(caret!==null&&target?.id==='treatment-query')target.setSelectionRange(caret,caret);
  }
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')document.querySelectorAll('.adaptation-heading-help').forEach(el=>{el.classList.add('help-dismissed');el.classList.remove('help-open');el.querySelector('.heading-help-trigger')?.setAttribute('aria-expanded','false');});
  });
  document.addEventListener('pointerover',event=>{
    const icon=event.target.closest('.heading-help-trigger');
    if(icon&&!icon.contains(event.relatedTarget))icon.closest('.adaptation-heading-help').classList.remove('help-dismissed');
  });
  document.addEventListener('pointerout',event=>{
    const icon=event.target.closest('.heading-help-trigger');
    if(icon&&!icon.contains(event.relatedTarget)){
      icon.closest('.adaptation-heading-help').classList.remove('help-open');
      icon.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('click',event=>{
    const icon=event.target.closest('.heading-help-trigger');
    document.querySelectorAll('.adaptation-heading-help.help-open').forEach(help=>{
      if(!icon||help!==icon.closest('.adaptation-heading-help')){
        help.classList.remove('help-open');help.querySelector('.heading-help-trigger')?.setAttribute('aria-expanded','false');
      }
    });
    if(icon){
      const help=icon.closest('.adaptation-heading-help');
      help.classList.remove('help-dismissed');
      icon.setAttribute('aria-expanded',String(help.classList.toggle('help-open')));
    }
  });
  document.addEventListener('focusin',event=>{
    if(event.target.matches('.heading-help-trigger'))event.target.closest('.adaptation-heading-help').classList.remove('help-dismissed');
  });
  document.addEventListener('click',event=>{
    const filter=document.getElementById('treatment-category-filter');
    if(filter?.open&&!filter.contains(event.target))filter.open=false;
  });
  document.addEventListener('keydown',event=>{
    const filter=document.getElementById('treatment-category-filter');
    if(event.key==='Escape'&&filter?.open){filter.open=false;filter.querySelector('summary').focus({preventScroll:true});}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='treatment-query'){state.treatmentQuery=event.target.value;refreshTreatmentControls('treatment-query');}
    if(event.target.dataset.treatmentRating){
      const key=event.target.dataset.treatmentRating;
      document.querySelectorAll('[data-treatment-rating="'+key+'"]').forEach(el=>{if(el!==event.target)el.value=event.target.value;});
    }
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.hasAttribute('data-treatment-filter-category')){
      state.treatmentFilterCategories=[...document.querySelectorAll('[data-treatment-filter-category]:checked')].map(input=>input.dataset.treatmentFilterCategory);
      refreshTreatmentControls();
    }else if(el.id==='treatment-only-rated'){state.treatmentOnlyRated=el.checked;refreshTreatmentControls(el.id);
    }else if(el.dataset.treatmentRating){state[({positive:'treatmentPositiveMin',healing:'treatmentHealingMin',negative:'treatmentNegativeMax'})[el.dataset.treatmentRating]]=Math.max(0,Math.min(100,Number(el.value)||0));refreshTreatmentControls(el.id);
    }else if(el.id==='treatment-sort-select'){[state.treatmentSort,state.treatmentSortDirection]=el.value.split(':');refreshTreatmentControls(el.id);}
  });
  document.addEventListener('click', event => {
    if (!validId) return;
    const link = event.target.closest('a[href^="#"]');
    if (link && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && !link.hasAttribute('download') && (!link.target || link.target === '_self')) {
      const view = link.getAttribute('href').slice(1);
      if (Object.hasOwn(views, view)) {
        event.preventDefault();
        history.replaceState(history.state, '', '#' + view);
        navigate(true);
        return;
      }
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.editAppointment) {
      if(state.saving)return;
      appointmentEditor=appointmentEditor===button.dataset.editAppointment?null:button.dataset.editAppointment;
      render();
      if(appointmentEditor)content.querySelector('.merged-editor [data-choice]')?.focus({preventScroll:true});
    } else if (button.hasAttribute('data-close-appointment')) {
      const key=appointmentEditor;appointmentEditor=null;render();
      content.querySelector('[data-edit-appointment="'+key+'"]')?.focus({preventScroll:true});
    } else if (button.dataset.choice) {
      const key = button.dataset.choice, value = Number(button.dataset.value);
      saveAnswer(state.selections[key] === value ? {action:'clear',question:key} : {question:key,value:value+1});
    } else if (button.dataset.insurance) {
      changeDoctorCostPreferences({insurance:button.dataset.insurance.toUpperCase()});
      } else if(button.id==='treatment-reset-filters') {
      Object.assign(state,{treatmentQuery:'',treatmentFilterCategories:null,treatmentOnlyRated:false,treatmentPositiveMin:0,treatmentHealingMin:0,treatmentNegativeMax:100,treatmentCategory:null,treatmentSort:null,treatmentSortDirection:'desc'});
      refreshTreatmentControls('treatment-reset-filters');
    } else if(button.hasAttribute('data-treatment-filter-all')||button.hasAttribute('data-treatment-filter-none')) {
      state.treatmentFilterCategories=button.hasAttribute('data-treatment-filter-all')?null:[];
      refreshTreatmentControls();
    } else if (button.hasAttribute('data-treatment-sort')) {
      const key=button.dataset.treatmentSort;
      state.treatmentSortDirection=state.treatmentSort===key?(state.treatmentSortDirection==='asc'?'desc':'asc'):(['name','category'].includes(key)?'asc':'desc');
      state.treatmentSort=key;
      render();
      [...content.querySelectorAll('[data-treatment-sort="'+key+'"]')].find(el=>el.getClientRects().length)?.focus({preventScroll:true});
    } else if (button.hasAttribute('data-treatment-view')) {
      state.treatmentView=button.dataset.treatmentView;saveTreatmentView(state.treatmentView);
      if(state.treatmentView==='categories')state.treatmentCategory=null;
      render();
      if(button.classList.contains('profile-summary-more')) revealTreatmentResults();
      else content.querySelector('[data-treatment-view="'+state.treatmentView+'"]').focus({preventScroll:true});
    } else if (button.hasAttribute('data-treatment-category')) {
      state.treatmentCategory = button.dataset.treatmentCategory;
      render();
      revealTreatmentResults();
    } else if (button.id === 'treatment-back') {
      const previous = state.treatmentCategory;
      state.treatmentView = 'categories';saveTreatmentView('categories');
      state.treatmentCategory = null;
      render();
      [...content.querySelectorAll('[data-treatment-category]')].find(option => option.dataset.treatmentCategory === previous)?.focus({preventScroll:true});
      revealTreatmentResults();
    } else if (button.id === 'retry-data') {
      loadOriginalData();
      loadCommunityData();
    } else if (button.id === 'clear-location') {
      clearLocation();
    } else if (button.id === 'reset-demo') {
      saveAnswer({action: 'reset'});
    } else if (button.dataset.contact) {
      notify(`${button.dataset.contact}: Für diesen Behandler sind keine Kontaktdaten hinterlegt.`);
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'location-form') { event.preventDefault(); saveLocation(event.target); }
  });
  document.getElementById('demo-doctor')?.addEventListener('change', event => {
    const url = new URL(location.href);
    url.searchParams.set('id', event.target.value);
    location.href = url.href;
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'own-location') {
      const clear = document.getElementById('clear-location');
      if (clear) clear.hidden = !event.target.value.trim();
    }
  });
  const locationKeys = ['lcn_shared_location_preference','lcn_shared_location_cleared','lcn_doctor_location_preference','lcn_treatment_location_preference'];
  window.addEventListener('storage', event => {
    if (event.key === null || locationKeys.includes(event.key)) { locationRequest?.abort(); refreshLocation(); }
  });
  window.addEventListener('hashchange', () => { if (validId) navigate(true); });
  if (!validId) {
    document.querySelector('.profile').hidden = true;
    document.querySelector('.side-nav').hidden = true;
    document.querySelector('.detail-layout').classList.add('has-error');
    content.innerHTML = '<section class="card" role="status"><h2>Kein gültiges Profil angegeben</h2><p>Öffne einen Behandler über die Behandler-Suche.</p><a href="aerzte_karte.html">Zur Behandler-Suche →</a></section>';
    document.getElementById('community-mode').textContent = '';
    return;
  }
  navigate(false);
  loadOriginalData();
  loadCommunityData();
  loadDoctorSelector();
})();
