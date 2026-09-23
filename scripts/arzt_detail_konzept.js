// Layout prototype: read original profile/treatment data from the existing API.
// Community answers use the existing anonymous voting identity.
(() => {
  'use strict';
  const scales = {
    adaptation: ['Hohe Belastung', 'Etwas belastender', 'Gut angepasst', 'Sehr gut angepasst', 'Individuell anpassbar'],
    costs: ['Komplett übernommen', 'Bis 100 €', 'Mehrere 100 €', 'Mehrere 1.000 €', '10.000 € oder mehr', 'Mehrere 10.000 €'],
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
  let appointmentEditor = null;
  const state = { view: 'ueberblick', insurance: 'gkv', selections: {}, treatmentCategory: null, treatmentView: 'categories', treatmentSort: null, treatmentSortDirection: 'desc', treatmentQuery: '', treatmentFilterCategories: null, treatmentOnlyRated: false, treatmentPositiveMin: 0, treatmentNegativeMax: 100, data: null, loading: true, error: false, community: null, communityError: false, saving: false };
  const content = document.getElementById('view-content');
  const livePage = document.body.dataset.doctorPage === 'live';
  const submissionParam = new URLSearchParams(location.search).get('submission_id');
  const isSubmission = submissionParam !== null;
  const idParam = submissionParam ?? new URLSearchParams(location.search).get('id');
  const doctorId = Number(idParam || (livePage ? 0 : 627));
  const validId = /^\d+$/.test(idParam || (livePage ? '' : '627')) && Number.isSafeInteger(doctorId) && doctorId > 0;
  if (isSubmission) {
    const banner=document.querySelector('.prototype-note > span');
    if(banner) for(const node of banner.childNodes) if(node.nodeType===Node.TEXT_NODE) node.textContent=node.textContent.replace('Praxis und Behandlungen: Originaldaten.', 'Praxisangaben aus dem Community-Eintrag.');
  }
  let detailMap = null;
  let profileMap = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const labels = values => (values || []).map(value => value.term_label).filter(Boolean).join(' · ');
  const categoryLabel = category => category === 'Arzneimittel' ? 'Medikamente' : category;
  const question = key => state.community?.questions?.[key] || {total:0, options:[], mode:null, mean:null};
  const percent = (key, index) => question(key).options[index]?.percent ?? null;
  const percentText = value => value === null ? '–' : Number(value).toLocaleString('de-DE', {maximumFractionDigits:1}) + ' %';
  function commonLabel(key) {
    const data = question(key);
    if (!data.total) return state.communityError ? 'Daten nicht verfügbar' : state.community ? 'Noch keine Angaben' : 'Wird geladen …';
    return data.mode ? data.options[data.mode - 1].label : 'Unterschiedliche Erfahrungen';
  }
  function costSystem() {
    const raw = String(state.data?.item?.loc_country || '').toUpperCase();
    const code = ({DEUTSCHLAND:'DE',ÖSTERREICH:'AT',SCHWEIZ:'CH'})[raw] || raw;
    const systems = {
      DE: {name:'Deutschland',options:[['gkv','GKV'],['pkv','PKV'],['de-self','Selbstzahler'],['de-abroad','Aus dem Ausland']]},
      AT: {name:'Österreich',options:[['at-public','Kassenarzt'],['at-elective','Wahlarzt'],['at-private','Privat'],['at-abroad','Aus dem Ausland']]},
      CH: {name:'Schweiz',options:[['ch-basic','Grundversicherung'],['ch-extra','Zusatzversicherung'],['ch-self','Selbstzahler'],['ch-abroad','Aus dem Ausland']]}
    };
    return {code,...(systems[code] || {name:'Land noch nicht angegeben',options:[['other-self','Selbstzahler'],['other-abroad','Aus dem Ausland']]})};
  }
  function costContext() {
    if(!costSystem().options.some(([key])=>key===state.insurance)) state.insurance=costSystem().options[0][0];
    return state.insurance;
  }
  function summaries() { return [commonLabel('adaptation'), commonLabel('costs-' + costContext()) + ' · ' + commonLabel('wait'), commonLabel('effect')]; }
  function communityNote(key) {
    const data = question(key);
    if (!state.community) return state.communityError ? 'Community-Daten konnten nicht geladen werden.' : 'Community-Daten werden geladen …';
    if (!data.total) return 'Noch keine Community-Angaben';
    return `${data.total} Angaben${Number(data.dummy_count) > 0 ? ` · davon ${data.dummy_count} Dummy-Angaben` : ''}`;
  }
  async function loadCommunityData() {
    try {
      const response = await fetch(isSubmission ? `api/doctor_submission.php?id=${doctorId}` : `api/doctor_community.php?id=${doctorId}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('Community unavailable');
      applyCommunityResponse(data);
      state.communityError = false;
    } catch (_) { state.communityError = true; }
    if (document.getElementById('community-mode')) document.getElementById('community-mode').textContent = state.community ? (state.community.include_dummy ? 'Dummy-Community-Daten eingeschaltet.' : 'Dummy-Community-Daten ausgeschaltet.') : 'Community-Daten derzeit nicht verfügbar.';
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
      button.disabled = state.saving || !state.community || state.communityError || (emptyAppointmentDemo && button.dataset.choice && !button.dataset.choice.startsWith('appointment-')); 
    });
  }
  async function saveAnswer(payload) {
    if (emptyAppointmentDemo && (payload.question?.startsWith('appointment-') || payload.action === 'reset')) {
      if(payload.action==='reset') Object.keys(demoAppointmentAnswers).forEach(key=>delete demoAppointmentAnswers[key]);
      else if(payload.action==='clear') delete demoAppointmentAnswers[payload.question];
      else demoAppointmentAnswers[payload.question]=payload.value;
      applyDemoAppointments();render();notify('Testauswahl aktualisiert – keine echten Angaben verändert.');return;
    }
    if (state.saving || !state.community || state.communityError) return;
    state.saving = true;
    updateAnswerControls();
    notify('Wird gespeichert …');
    try {
      const response = await fetch(isSubmission ? 'api/doctor_submission.php' : 'api/doctor_community_answer.php', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(isSubmission ? {id:doctorId,...payload} : {dr_id: doctorId, ...payload})
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Speichern konnte nicht bestätigt werden. Bitte erneut versuchen.');
      applyCommunityResponse(data);
      appointmentEditor = null;
      render();
      notify(payload.action === 'reset' ? 'Deine Angaben zu dieser Praxis wurden gelöscht.' : payload.action === 'clear' ? 'Deine Stimme wurde zurückgenommen.' : 'Deine Angabe wurde gespeichert.');
    } catch (error) {
      notify('Speichern konnte nicht bestätigt werden. Bitte erneut versuchen.');
    } finally {
      state.saving = false;
      updateAnswerControls();
    }
  }
  async function loadDoctorSelector() {
    if (!document.getElementById('demo-doctor')) return;
    try {
      const response = await fetch('api/doctors_search.php?lat=51&lng=10&radiusKm=all');
      const data = await response.json();
      if (!response.ok || !data.ok) return;
      document.getElementById('demo-doctor').innerHTML = data.items.map(doctor => `<option value="${Number(doctor.dr_id)}"${Number(doctor.dr_id) === doctorId ? ' selected' : ''}>${escape(doctor.dr_display_name)}</option>`).join('');
    } catch (_) { /* The current profile remains independently usable. */ }
  }
  function address(doctor = state.data?.item || {}) {
    return doctor.address_text || [[doctor.loc_street, doctor.loc_housenumber].filter(Boolean).join(' '), [doctor.loc_plz, doctor.loc_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
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
      document.querySelector('.contact').innerHTML = [['Website', doctor.loc_website || doctor.dr_website], ['Telefon', doctor.loc_phone || doctor.dr_phone], ['E-Mail', doctor.loc_email || doctor.dr_email]].filter(([, value]) => value).map(([type, value]) => {
        const link = contactLink(type, value);
        return link.replace('<a ', `<a aria-label="${type}" title="${type}" `).replace(`>${escape(value)}</a>`, livePage ? `><span class="contact-symbol" aria-hidden="true">${({Website:'↗',Telefon:'☎','E-Mail':'✉'})[type]}</span><span class="contact-label">${type}</span></a>` : `>${type}</a>`);
      }).join('');
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
  function createMap(element, compact = false) {
    if (!element) return null;
    const doctor = state.data?.item;
    if (!doctor || doctor.loc_lat == null || doctor.loc_lng == null) {
      element.textContent = state.loading ? 'Karte wird geladen …' : 'Keine Kartenposition hinterlegt.';
      return null;
    }
    if (typeof L === 'undefined') { element.textContent = 'Karte konnte nicht geladen werden.'; return null; }
    element.replaceChildren();
    window.LCNImages?.configureLeaflet(L);
    const map = L.map(element, {zoomControl: false, scrollWheelZoom: false, dragging: !compact, doubleClickZoom: !compact, touchZoom: !compact, keyboard: !compact}).setView([Number(doctor.loc_lat), Number(doctor.loc_lng)], compact ? 12 : 15);
    if (!compact) {
      L.control.zoom({position:'topright'}).addTo(map);
      element.onclick = () => map.scrollWheelZoom.enable();
      element.onmouseleave = () => map.scrollWheelZoom.disable();
    }
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom:19, attribution:'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere'
    }).addTo(map);
    L.marker([Number(doctor.loc_lat), Number(doctor.loc_lng)]).addTo(map).bindPopup(`<strong>Praxis</strong><br>${escape(address())}`);
    const own = savedLocation();
    if (!compact && own) {
      const icon = L.icon({iconUrl: window.LCNImages.urls['map-marker-red'], shadowUrl: window.LCNImages.urls['map-marker-shadow'], iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41]});
      L.marker([own.lat, own.lng], {icon, title: own.label}).addTo(map).bindPopup(`<strong>Dein Standort</strong><br>${escape(own.label)}`);
      map.fitBounds([[Number(doctor.loc_lat), Number(doctor.loc_lng)], [own.lat, own.lng]], {padding:[30,30], maxZoom:15});
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
  function distanceText() {
    const own = savedLocation(), doctor = state.data?.item;
    if (!own) return 'Standort nicht gesetzt';
    if (doctor?.loc_lat == null || doctor?.loc_lng == null) return 'Entfernung nicht verfügbar';
    const radians = value => value * Math.PI / 180;
    const a = Math.sin(radians(doctor.loc_lat - own.lat) / 2) ** 2 + Math.cos(radians(own.lat)) * Math.cos(radians(doctor.loc_lat)) * Math.sin(radians(doctor.loc_lng - own.lng) / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0,1-a)));
    return `ca. ${km.toLocaleString('de-DE', {maximumFractionDigits:km < 10 ? 1 : 0})} km (Luftlinie)`;
  }
  let locationRequest = null;
  function refreshLocation() {
    const section = document.querySelector('.location-section');
    if (!section) return;
    detailMap?.remove();
    section.outerHTML = locationCard();
    detailMap = createMap(document.getElementById('doctor-detail-map'));
  }
  async function saveLocation(form) {
    const query = form.elements.location.value.trim();
    if (!query) { clearLocation(); return; }
    locationRequest?.abort();
    const controller = new AbortController();
    locationRequest = controller;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    form.querySelector('[role="status"]').textContent = 'Standort wird gesucht …';
    try {
      const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`, {signal:controller.signal});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Standort nicht gefunden.');
      const value = data.result;
      if (value?.lat == null || value?.lng == null || !Number.isFinite(Number(value.lat)) || !Number.isFinite(Number(value.lng))) throw new Error('Keine gültigen Koordinaten gefunden.');
      localStorage.setItem('lcn_shared_location_preference', JSON.stringify({location:value.formatted || query, label:value.formatted || query, city:value.city || '', lat:Number(value.lat), lng:Number(value.lng)}));
      localStorage.removeItem('lcn_shared_location_cleared');
      refreshLocation();
      notify('Standort übernommen – auch für die anderen LCN-Seiten.');
    } catch (error) {
      if (error.name !== 'AbortError') form.querySelector('[role="status"]').textContent = 'Standort nicht gefunden oder nicht speicherbar. Bitte versuche einen genaueren Ort.';
    } finally { submit.disabled = false; }
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
    feedbackTimer = setTimeout(() => feedback.classList.remove('visible'), 4000);
  }
  function heading(kicker, title, description) {
    return `<header class="view-heading"><p class="eyebrow">${kicker}</p><h2>${title}</h2><p>${description}</p></header>`;
  }
  function blockTitle(number, title, question) {
    return `<div class="block-heading"><span class="section-number" aria-hidden="true">${number}</span><div><h3>${title}</h3><p>${question}</p></div></div>`;
  }
  function choices(key, labels, numbered = false) {
    return `<div class="choice-grid" role="group" aria-label="Deine Auswahl: ${key === 'adaptation' ? 'Termin-Anpassung' : key.startsWith('costs') ? 'Eigene Kosten, ' + state.insurance.toUpperCase() : key === 'wait' ? 'Wartezeit' : 'Wirkung'}" style="--count:${labels.length}">${labels.map((label, index) => `<button type="button" data-choice="${key}" data-value="${index}" aria-pressed="${state.selections[key] === index}">${numbered ? `<span class="choice-number" aria-hidden="true">${index + 1}</span>` : ''}${label}</button>`).join('')}</div>`;
  }
  function dotScale(key, labels) {
    return `<p class="community-label">${communityNote(key)}</p><p class="field-note">Prozente: Community-Verteilung · Blauer Punkt: deine Auswahl</p><div class="interactive-dot-scale" role="group" aria-label="Deine Auswahl: ${key === 'wait' ? 'Wartezeit' : 'Eigenanteil ' + state.insurance.toUpperCase()}" style="--count:${labels.length}">${labels.map((label, index) => `<button type="button" data-choice="${key}" data-value="${index}" aria-pressed="${state.selections[key] === index}"><span class="dot" aria-hidden="true"></span><strong class="scale-percent">${percentText(percent(key,index))}</strong><span>${label}</span></button>`).join('')}</div>`;
  }
  function locationCard() {
    if (!state.data) return `<section class="card"><h3>Standort & Erreichbarkeit</h3>${dataStatus()}</section>`;
    const own = savedLocation();
    return `<section class="card location-section" aria-label="Standort und Erreichbarkeit"><h3>Standort & Erreichbarkeit</h3><div class="doctor-detail-location-grid"><div class="doctor-detail-location-address"><div class="doctor-detail-location-block"><strong>Praxisstandort</strong><span>${escape(state.data.item.loc_label)}</span><span>${escape(address())}</span><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address())}" target="_blank" rel="noopener noreferrer">In Google Maps öffnen ↗</a></div><div class="doctor-detail-location-block"><strong>Entfernung zu deinem Standort</strong><span id="own-distance">${distanceText()}</span></div><div class="doctor-detail-location-block"><form id="location-form"><label for="own-location">Dein Standort</label><div class="own-location-control"><input id="own-location" name="location" type="text" placeholder="Adresse oder Ort" autocomplete="street-address" maxlength="200" value="${escape(own?.label || '')}"><button type="button" id="clear-location" aria-label="Standort entfernen"${own ? '' : ' hidden'}>×</button></div><button type="submit">Standort übernehmen</button><small>Gemeinsam mit den anderen LCN-Seiten.</small><span role="status" aria-live="polite"></span></form></div></div><div id="doctor-detail-map" class="doctor-detail-map" aria-label="Karte des Praxisstandorts"></div></div></section>`;
  }
  function profileFacts() {
    if (!state.data) return `<section class="card overview-facts"><h2>Die Praxis im Überblick</h2>${dataStatus()}</section>`;
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
    return `<section class="card overview-facts overview-structured"><p class="eyebrow">Überblick</p><h2>Die Praxis im Überblick</h2><div class="overview-profile-grid"><aside class="overview-identity">${icon('person')}<h3>${escape(doctor.dr_display_name)}</h3><div class="overview-organization"><span>Praxis</span><strong>${organizationHtml}</strong></div>${doctor.activities?`<p class="overview-activities">${escape(doctor.activities)}</p>`:''}<span class="overview-type-badge">${escape(type)}</span></aside><div class="overview-groups">${section('Medizinisches Profil','medical',[
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
    return profileFacts() + locationCard();
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
    return `<section class="adaptation-explanation" aria-label="Bedeutung deiner gewählten Stufe"><p class="adaptation-explanation-heading">Deine Auswahl: <strong>${escape(scales.adaptation[selected])}</strong> – das bedeutet:</p><div class="adaptation-facts">${adaptationCriteria.map((criterion,i)=>`<div class="adaptation-fact"><span class="adaptation-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</svg></span><div><span class="adaptation-fact-label">${escape(criterion)}</span><strong>${escape(adaptationDetails[selected][i])}</strong></div></div>`).join('')}</div></section>`;
  }
  function adaptationResults(data) {
    const benchmark=state.community?.adaptation_benchmark;
    const number=value=>value.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
    const difference=data.mean!==null && benchmark?.mean!=null ? Math.round((data.mean-benchmark.mean)*10)/10 : null;
    const comparison=difference===null?'':difference===0?'Auf dem Durchschnitt':number(Math.abs(difference))+' Punkte '+(difference>0?'über':'unter')+' dem Durchschnitt';
    return `<div class="adaptation-results"><div class="community-result"><span>Community-Ergebnis · diese Praxis</span><strong>${escape(commonLabel('adaptation'))}</strong><span>${data.mean!==null?'Ø '+number(data.mean)+' / 5':'Noch keine Bewertung'}</span>${comparison?'<small>'+comparison+'</small>':''}</div><div class="community-result"><span>Durchschnitt über alle Ärzte</span><strong>${benchmark?.mean!=null?'Ø '+number(benchmark.mean)+' / 5':'Noch keine Vergleichsdaten'}</strong><span>${benchmark?benchmark.doctor_count+' von '+benchmark.catalog_count+' Ärzten mit Angaben':'Vergleich wird geladen …'}</span><small>Jeder Arzt zählt gleich viel.${Number(benchmark?.dummy_count) > 0?' Einschließlich Dummy-Angaben.':''}</small></div></div>`;
  }
  function appointment() {
    const data = question('adaptation');
    const percentages = scales.adaptation.map((_, index) => percent('adaptation', index));
    // Gentle emphasis only: every segment keeps enough space for its own label.
    const weights = percentages.map(value => 1 + Math.min(100, value || 0) / 250);
    const tracks = weights.map(weight => weight + 'fr').join(' ');
    return heading('Termin & Belastbarkeit', 'Welche Belastungshürden gibt es bei einem Termin?', 'Wie angepasst ist der Termin – und welche Terminformen sind möglich?') +
      `<section class="card">${blockTitle(1, 'Long-Covid-gerechter Termin', 'Wie gut ist der Termin auf gesundheitlich stark eingeschränkte Long-Covid-/ME/CFS-Patienten angepasst?')}<div class="block-content"><p class="community-label">${communityNote('adaptation')}</p><p class="field-note">Klicke auf eine Stufe, um deine Erfahrung anzugeben. Blau markiert: deine Auswahl.</p><div class="adaptation-matched" role="group" aria-label="Termin-Anpassung: Verteilung und eigene Auswahl" style="--tracks:${tracks}">${scales.adaptation.map((label, i) => `<button type="button" data-choice="adaptation" data-value="${i}" aria-pressed="${state.selections.adaptation === i}"><span class="matched-bar shade-${i}" aria-hidden="true"></span><strong>${percentText(percentages[i])}</strong><strong class="adaptation-title">${i + 1} · ${label}</strong></button>`).join('')}</div>${adaptationHelp()}${adaptationResults(data)}</div></section>` +
      appointmentVariant(3) + locationCard();
  }

  function appointmentVariant(variant) {
    const description=variant===4?'Klicke auf die Community-Angabe. Bei Zustimmung bleibt ein gemeinsames Feld mit farbigem Rand; abweichende Angaben stehen daneben.':variant===2?'Community und eigene Angabe getrennt. ✓ = möglich, ✕ = nicht möglich. Klicke deine Angabe erneut an, um sie zurückzunehmen.':(emptyAppointmentDemo?'Testansicht 0 / 0 – keine echte Abstimmung. ':'')+'Klicke auf eine Zahl: links grün = möglich, rechts rot = nicht möglich. Deine Auswahl wird fett dargestellt; erneutes Anklicken nimmt sie zurück.';
    return `<section class="card appointment-variant" data-variant="${variant}">${blockTitle(2,variant===3?'Terminform':'Terminform · Variante '+(variant-1),description)}<div class="block-content"><div class="appointment-table" role="table" aria-label="Terminform Variante ${variant-1}"><div class="matrix-header" role="row"><span role="columnheader">Termin</span>${['Vor Ort','Telefon','Video'].map(f=>`<strong role="columnheader">${f}</strong>`).join('')}</div>${['Ersttermin','Folgetermin'].map((type,row)=>`<div class="matrix-row" role="row"><strong role="rowheader">${type}</strong>${['Vor Ort','Telefon','Video'].map((form,column)=>{
      const key=`appointment-${row}-${column}`,q=question(key),own=state.selections[key];
      const yes=q.options[0]?.count||0,no=q.options[1]?.count||0,total=yes+no;
      const status=!total?'Noch keine Angaben':yes===no?'Unterschiedlich':yes>no?'Möglich':'Nicht möglich';
      const tone=!total||yes===no?'unknown':yes>no?'possible':'unlikely';
      if(variant===4) return mergedAppointmentCell(key,type,form,own,total,yes,no,status,tone);
      const buttons=`<div class="thumb-answers" role="group" aria-label="${type}, ${form}: deine Angabe">${[0,1].map(value=>`<button type="button" class="thumb-answer agreement-answer ${value===0?'agreement-yes':'agreement-no'}" data-choice="${key}" data-value="${value}" aria-pressed="${own===value}" aria-label="${type}, ${form}: ${value===0?'Möglich':'Nicht möglich'}" title="${own===value?'Stimme zurücknehmen':value===0?'Möglich':'Nicht möglich'}"><span aria-hidden="true">${value===0?'✓':'✕'}</span></button>`).join('')}</div>`;
      const ownControl=variant===2&&Number.isInteger(own)?`<button type="button" class="appointment-status agreement-answer own-result ${own===0?'possible':'unlikely'}" data-choice="${key}" data-value="${own}" aria-pressed="true" aria-label="${type}, ${form}: ${own===0?'Möglich':'Nicht möglich'}, Stimme zurücknehmen" title="Erneut klicken: Stimme zurücknehmen">${own===0?'✓ Möglich':'✕ Nicht möglich'}</button>`:buttons;
      const countButton=value=>`<button type="button" class="agreement-answer count-choice ${value===0?'count-yes':'count-no'}" data-choice="${key}" data-value="${value}" aria-pressed="${own===value}" aria-label="${type}, ${form}: ${value===0?'Möglich':'Nicht möglich'}, ${value===0?yes:no} Stimmen" title="${value===0?'Möglich':'Nicht möglich'}${own===value?' – deine Auswahl; erneut klicken zum Zurücknehmen':''}">${value===0?yes:no}</button>`;
      const community=variant===2?`<span class="appointment-status ${tone}" title="${escape(communityNote(key))}">${status}</span>`:`<div class="inline-vote-meter" role="group" aria-label="${type}, ${form}: eigene Angabe">${countButton(0)}<div class="vote-meter" role="img" aria-label="${yes} Stimmen möglich, ${no} Stimmen nicht möglich"><span class="vote-meter-fill" style="width:${total?100*yes/total:50}%"></span><span class="vote-meter-point" style="left:${total?100*yes/total:50}%"></span></div>${countButton(1)}</div>${!total?'<small>Noch keine Angaben</small>':''}`;

      return `<div class="matrix-cell variant-cell variant-cell-${variant}" role="cell"><span class="mobile-form">${form}</span><div class="variant-community">${variant===2?'<span class="variant-label">Community</span>':''}${community}</div>${variant===2?`<div class="variant-own"><span class="variant-label">Deine Angabe</span>${ownControl}</div>`:''}</div>`;
    }).join('')}</div>`).join('')}</div><p class="field-note">${emptyAppointmentDemo?'Testansicht: Die Terminformen starten bei 0 / 0. Deine Klicks gelten nur hier und werden beim Neuladen zurückgesetzt.':'Pro Terminform zählt nur eine eigene Stimme.'}</p></div></section>`;
  }
  function mergedAppointmentCell(key,type,form,own,total,yes,no,status,tone) {
    const answered=Number.isInteger(own), matched=answered&&total>0&&yes!==no&&own===(yes>no?0:1);
    const split=answered&&!matched, editing=appointmentEditor===key;
    const pill=(text,color,extra='')=>`<button type="button" class="appointment-status merged-pill ${color} ${extra}" data-edit-appointment="${key}" aria-expanded="${editing}" aria-label="${type}, ${form}: ${text}${matched?', von dir bestätigt':''}, Angabe ändern">${text}</button>`;
    if(editing) return `<div class="matrix-cell merged-cell" role="cell"><span class="mobile-form">${form}</span><div class="merged-editor" role="group" aria-label="${type}, ${form}: eigene Angabe"><div>${[0,1].map(v=>`<button type="button" class="appointment-status ${v===0?'possible':'unlikely'}" data-choice="${key}" data-value="${v}" aria-pressed="${own===v}">${v===0?'Möglich':'Nicht möglich'}</button>`).join('')}</div></div></div>`;
    return `<div class="matrix-cell merged-cell" role="cell"><span class="mobile-form">${form}</span><div class="merged-values${split?' is-split':''}"><div>${split?'<span class="variant-label">Community</span>':''}${pill(status,tone,matched?'merged-confirmed':'')}</div>${split?`<div class="merged-own"><span class="variant-label">Deine Angabe</span>${pill(own===0?'Möglich':'Nicht möglich',own===0?'possible':'unlikely')}</div>`:''}</div></div>`;

  }
  function access() {
    return heading('Kosten & Wartezeit', 'Wie zugänglich ist die Behandlung?', 'Wie verteilen sich Eigenkosten und Wartezeiten? Wähle deine eigene Erfahrung direkt über die Punkte aus.') +
      `<section class="card"><div class="cost-heading">${blockTitle(1, 'Kosten der Behandlung (Eigenanteil)', 'Wie hoch waren deine gesamten eigenen Kosten für die Behandlung dort?')}<span class="cost-country"><span class="country-flag flag-${escape(costSystem().code.toLowerCase())}" aria-hidden="true"></span>${costSystem().name}</span></div><div class="cost-contexts insurance-toggle" role="group" aria-label="Versicherungs- und Abrechnungskontext">${costSystem().options.map(([value,label]) => `<button type="button" data-insurance="${value}" aria-pressed="${costContext() === value}">${label}</button>`).join('')}</div><p class="field-note">„Aus dem Ausland“: nicht im Versicherungssystem des Praxislandes versichert.</p>${dotScale('costs-' + costContext(), scales.costs.map(label=>costSystem().code==='CH'?label.replaceAll('€','CHF'):label))}</section>` +
      `<section class="card">${blockTitle(2, 'Wartezeit auf den Ersttermin', 'Wie lange musstest du auf deinen ersten Termin warten?')}${dotScale('wait', scales.wait)}</section>`;
  }

  function effect() {
    return heading('Patient:innenerfahrungen', 'Wie sind die Erfahrungen mit einer Zustandsverbesserung?', 'So haben Patient:innen die Veränderung nach der Behandlung eingeschätzt.') +
      `<section class="card"><div class="chart-heading"><div><h3>Community-Verteilung</h3><p>Subjektive Erfahrungen nach der Behandlung.</p></div><span>${communityNote('effect')}</span></div><p class="effect-instruction">Klicke auf einen Balken, um deine eigene Erfahrung anzugeben.</p><div class="effect-chart" role="group" aria-label="Zustandsveränderung: Community und deine Auswahl">${scales.effect.map((label, i) => { const value = percent('effect',i); return `<button type="button" class="effect-column" data-choice="effect" data-value="${i}" aria-pressed="${state.selections.effect === i}" aria-label="${label}: ${percentText(value)}. Als eigene Erfahrung auswählen"><span class="bar-area"><strong>${percentText(value)}</strong><span class="effect-bar effect-${i}" style="height:${(value || 0) * 1.5}px"></span></span><span class="effect-label">${label}</span></button>`; }).join('')}</div></section>` + treatmentSection();
  }
  function treatmentSection() {
    if (!state.data) return '<section class="card"><h3>Behandlungen & Verfahren</h3>'+dataStatus()+'</section>';
    const groups=Object.entries(state.data.treatments_grouped||{}).sort((a,b)=>b[1].length-a[1].length);
    const all=[...new Map(groups.flatMap(([category,entries])=>entries.map(e=>[Number(e.treat_id),{...e,category}]))).values()];
    if(!all.length)return '<section class="card"><h3>Behandlungen & Verfahren</h3><p>Noch keine Behandlungen zugeordnet.</p></section>';
    const editorialData=state.data.analysis?.editorial;
    const editorialIds=(editorialData?.matches||[]).flatMap(e=>e.treat_ids);
    const editorial=all.filter(e=>editorialIds.includes(Number(e.treat_id)));
    const catalog=state.data.analysis?.catalog;
    const category=state.treatmentCategory;
    let rows=category==='@editorial'?editorial:category&&category!=='*'?all.filter(e=>e.category===category):all;
    const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replaceAll('ß','ss');
    rows=rows.filter(e=>(state.treatmentFilterCategories===null||state.treatmentFilterCategories.includes(e.category)) && normalized(e.behandlung+' '+e.category+' '+(e.unterkategorie||'')).includes(normalized(state.treatmentQuery.trim())) && (!state.treatmentOnlyRated||Number(e.total_votes)>0) && ((state.treatmentPositiveMin===0&&state.treatmentNegativeMax===100)||(Number(e.total_votes)>0&&Number(e.positive_ratio)>=state.treatmentPositiveMin&&Number(e.negative_ratio)<=state.treatmentNegativeMax)));
    rows=[...rows].sort((a,b)=>category==='@editorial'?editorialIds.indexOf(Number(a.treat_id))-editorialIds.indexOf(Number(b.treat_id)):Number(b.provider_count)-Number(a.provider_count)||a.behandlung.localeCompare(b.behandlung,'de'));
    if(state.treatmentSort){
      const value=e=>({name:e.behandlung,category:categoryLabel(e.category),experience:Number(e.positive_ratio)||0,negative:Number(e.negative_ratio)||0,votes:Number(e.total_votes)||0,providers:Number(e.provider_total??e.provider_count)||0,editorial:editorialIds.includes(Number(e.treat_id))?1:0})[state.treatmentSort];
      rows.sort((a,b)=>{const x=value(a),y=value(b);const cmp=typeof x==='string'?x.localeCompare(y,'de'):x-y;return cmp*(state.treatmentSortDirection==='asc'?1:-1)||a.behandlung.localeCompare(b.behandlung,'de');});
    }
    const link=e=>'<a href="therapie_detail.html?treat_id='+Number(e.treat_id)+'&source=priority">'+escape(e.behandlung)+'</a>';
    const stats=e=>editorialIds.includes(Number(e.treat_id))?'Teil der redaktionellen Auswahl':'';
    const meta=e=>Number(e.provider_count||0)+' von 39 Ärzten zugeordnet';
    const card=(key,label,count)=>'<button type="button" class="treatment-category-card" data-treatment-category="'+escape(key)+'"><span>'+escape(label)+'</span><strong>'+count+'</strong><span>Behandlungen →</span></button>';
    const filterControls='<div class="treatment-controls"><div class="treatment-search-controls"><label>Behandlung suchen<input type="search" id="treatment-query" value="'+escape(state.treatmentQuery)+'" placeholder="Name, Kategorie oder Unterkategorie"></label><details id="treatment-category-filter"><summary>Kategorien'+(state.treatmentFilterCategories===null?' · alle':' · '+state.treatmentFilterCategories.length)+'</summary><div class="treatment-category-options"><button type="button" data-treatment-filter-all="1">Alle</button><button type="button" data-treatment-filter-none="1">Keine</button>'+groups.map(([name])=>'<label><input type="checkbox" data-treatment-filter-category="'+escape(name)+'" '+(state.treatmentFilterCategories===null||state.treatmentFilterCategories.includes(name)?'checked':'')+'> '+escape(categoryLabel(name))+'</label>').join('')+'</div></details><label class="treatment-rated-toggle"><input type="checkbox" id="treatment-only-rated" '+(state.treatmentOnlyRated?'checked':'')+'> Nur mit Bewertung</label><button type="button" id="treatment-reset-filters">Zurücksetzen</button></div><div class="treatment-rating-controls">'+[['positive','Positive Erfahrungen mindestens',state.treatmentPositiveMin],['negative','Negative Erfahrungen höchstens',state.treatmentNegativeMax]].map(([key,label,value])=>'<div><label for="treatment-'+key+'-range">'+label+'</label><div class="treatment-range-row"><input id="treatment-'+key+'-range" data-treatment-rating="'+key+'" type="range" min="0" max="100" value="'+value+'"><input aria-label="'+label+' in Prozent" id="treatment-'+key+'-number" data-treatment-rating="'+key+'" type="number" min="0" max="100" value="'+value+'"><span>%</span></div></div>').join('')+'<label>Sortieren<select id="treatment-sort-select">'+[['name:asc','Name A–Z'],['name:desc','Name Z–A'],['experience:desc','Positive Erfahrungen ↓'],['negative:desc','Negative Erfahrungen ↓'],['votes:desc','Bewertungen ↓'],['providers:desc','Anbieter ↓']].map(([key,label])=>'<option value="'+key+'" '+((state.treatmentSort||'providers')+':'+state.treatmentSortDirection===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div></div><p class="treatment-result-count" role="status">'+rows.length+' von '+all.length+' Behandlungen'+(category&&category!=='*'?' in der gewählten Auswahl':'')+'</p>';
    let body='';
    if(state.treatmentView==='categories'&&!category){
      body='<div class="treatment-categories">'+groups.map(([name])=>[name,rows.filter(e=>e.category===name)]).filter(([,entries])=>entries.length).map(([name,entries])=>card(name,categoryLabel(name),entries.length)).join('')+'</div>';
    }else{
      const label=category==='@editorial'?'Redaktionelle Auswahl':category&&category!=='*'?categoryLabel(category):'Alle Behandlungen';
      body='<div class="treatment-drilldown"><strong>'+escape(label)+' · '+(category==='@editorial'?editorialData.matched_count+' Themen, '+rows.length+' Datenbankeinträge':rows.length+' Behandlungen')+'</strong><button type="button" id="treatment-back">Alle Kategorien</button></div>';
      if(!rows.length)body+='<p>Noch keine passenden Behandlungen zugeordnet.</p>';
      else if(state.treatmentView==='cards')body+='<div class="treatment-categories">'+rows.map(e=>'<article class="treatment-result-card"><h4>'+link(e)+'</h4><p>'+escape(categoryLabel(e.category))+'</p><small>'+meta(e)+'</small><small>'+stats(e)+'</small></article>').join('')+'</div>';
      else {
        const header=(label,key)=>'<th scope="col" aria-sort="'+(state.treatmentSort===key?(state.treatmentSortDirection==='asc'?'ascending':'descending'):'none')+'"><button type="button" class="doctor-detail-treatment-table-sort" data-treatment-sort="'+key+'">'+label+'<span aria-hidden="true">'+(state.treatmentSort===key?(state.treatmentSortDirection==='asc'?'↑':'↓'):'↕')+'</span></button></th>';
        const experience=e=>'<div class="doctor-detail-treatment-experience-row">'+[['Verschlechterung','negative_ratio',0],['Keine Veränderung','neutral_ratio',1],['Verbesserung','positive_ratio',2],['Heilung','healing_ratio',3]].map(([label,key,color])=>{const value=Number(e.total_votes)>0&&e[key]!=null?Number(e[key])+'%':'–';return '<span class="treatment-experience-value experience-'+color+'" title="'+label+': '+(value==='–'?'noch nicht erfasst':value)+'" aria-label="'+label+': '+(value==='–'?'noch nicht erfasst':value)+'">'+value+'</span>';}).join('')+'</div>';

        const providers=e=>'<span class="doctor-detail-treatment-provider-badge">'+(Number(e.provider_total??e.provider_count)||'—')+'</span>';
        body+='<p class="treatment-rating-note">Bewertungen aus dem vorhandenen Datenbestand, einschließlich Dummy-Bewertungen. Bisherige Negativ-/Neutral-/Positiv-Angaben sind in den ersten drei Positionen dargestellt; Heilung wurde noch nicht separat erfasst (–). Anbieter gesamt zählt den gesamten Katalog.</p><div class="treatment-experience-legend"><span><i class="effect-0"></i>Verschlechterung</span><span><i class="effect-1"></i>Keine Veränderung</span><span><i class="effect-2"></i>Verbesserung</span><span><i class="effect-3"></i>Heilung</span></div><div class="doctor-detail-treatment-table-wrap"><table class="doctor-detail-treatment-table doctor-detail-treatment-table-detailed"><caption class="sr-only">Behandlungen mit Erfahrungen, Bewertungen und Anbietern</caption><thead><tr><th scope="col">Rang</th>'+header('Therapie','name')+header('Kategorie','category')+header('Erfahrung','experience')+header('Bewertungen','votes')+header('Anbieter gesamt','providers')+header('Redaktionelle Auswahl','editorial')+'</tr></thead><tbody>'+rows.map((e,i)=>'<tr><td><span class="doctor-detail-treatment-rank-badge">#'+(i+1)+'</span></td><td>'+link(e)+'</td><td><span class="doctor-detail-treatment-category-inline">'+escape(categoryLabel(e.category))+'</span></td><td>'+experience(e)+'</td><td><span class="doctor-detail-treatment-vote-total">'+Number(e.total_votes||0)+'</span></td><td>'+providers(e)+'</td><td>'+(editorialIds.includes(Number(e.treat_id))?'Ja':'—')+'</td></tr>').join('')+'</tbody></table><table class="doctor-detail-treatment-compact-table"><caption class="sr-only">Kompakte Behandlungsliste</caption><thead><tr><th scope="col">#</th>'+header('Therapie','name')+header('Erfahrung','experience')+header('Anbieter','providers')+'</tr></thead><tbody>'+rows.map((e,i)=>'<tr><td>'+(i+1)+'</td><td>'+link(e)+'</td><td>'+(experience(e)+'<small>n='+Number(e.total_votes||0)+'</small>')+'</td><td>'+providers(e)+'</td></tr>').join('')+'</tbody></table></div>';
      }
    }
    const diagnostics=all.filter(e=>e.category==='Diagnostik').length;
    const medicines=all.filter(e=>e.category==='Arzneimittel').length;
    const knownGroups=groups.filter(([name])=>name!=='Ohne Kategorie'&&name!=='Diagnostik');
    const specializations=labels(state.data.research?.specializations);
    const percentile=all.length<=5?'Wenige dokumentierte Einträge':catalog?.top_percent!=null?'Top '+catalog.top_percent+' %':'Noch kein Vergleich verfügbar';
    const preview=(editorialData?.matches||[]).slice(0,3).map(topic=>'<li><button type="button" data-treatment-category="@editorial">'+escape(topic.label)+'</button></li>').join('');
    const categories=groups.filter(([name])=>name!=='Ohne Kategorie');
    const summary='<div class="treatment-profile-summary"><div><span>Umfang im Vergleich</span><strong>'+percentile+'</strong><dl class="profile-average"><div><dt>Diese Praxis</dt><dd>'+all.length+' Einträge</dd></div><div><dt>Vergleichsgruppe</dt><dd>'+(catalog?catalog.doctor_count:'–')+' Ärzte/Praxen</dd></div></dl><small>'+(all.length<=5?'Bis einschließlich fünf Einträge: keine Prozent-Einstufung.':catalog?.top_percent!=null?catalog.at_least_count+' von '+catalog.doctor_count+' Profilen haben mindestens '+all.length+' Einträge.':'')+' Verglichen werden alle Katalogprofile mit mehr als fünf Einträgen. Gleichstände zählen gemeinsam; der Prozentwert wird aufgerundet.</small></div><div><span>Häufigste Kategorien</span><strong>'+categories.length+' Kategorien</strong><ul class="profile-summary-list">'+categories.slice(0,3).map(([name,entries])=>'<li><button type="button" data-treatment-category="'+escape(name)+'">'+escape(categoryLabel(name))+' <b>'+entries.length+'</b></button></li>').join('')+'</ul><button type="button" class="profile-summary-more" data-treatment-view="categories">Alle Kategorien ansehen →</button></div><div><span>Redaktionelle Auswahl</span><strong>'+(editorialData?editorialData.matched_count+' von 31 Themen':'Noch nicht abgeglichen')+'</strong><ul class="profile-summary-list editorial-preview">'+preview+'</ul>'+(editorialData?'<button type="button" class="profile-summary-more" data-treatment-category="@editorial">Alle '+editorialData.matched_count+' Themen ansehen →</button>':'')+'</div></div>';
    const editorialNotes=editorialData?.partial?.length?'<details class="treatment-match-notes"><summary>'+editorialData.partial.length+' nur teilweise passende Zuordnungen</summary><p>Diese zählen nicht als bestätigter Treffer der redaktionellen Auswahl:</p><ul>'+editorialData.partial.map(e=>'<li>'+escape(e.label)+'</li>').join('')+'</ul><p>Zum Beispiel belegt allgemeine Physiotherapie keine PEM-Anpassung; einzelne Komponenten belegen keine vollständige Kombination.</p></details>':'';
    return '<section class="card" id="treatment-section"><h3 tabindex="-1">Behandlungen & Verfahren <span class="total-count">'+all.length+'</span></h3><p>Das recherchierte Behandlungsprofil von '+escape(state.data.item.dr_display_name)+'.</p>'+summary+'<p class="treatment-specializations"><strong>Erfasste Spezialisierungen:</strong> '+(escape(specializations)||'<span class="overview-missing">Noch keine Angabe</span>')+'</p><p class="field-note">Der Vergleich beschreibt dokumentierte Einträge, nicht Qualität oder Wirksamkeit. Die Vergleichsgruppe wächst mit weiteren Katalogprofilen mit mehr als fünf Einträgen. Die redaktionelle Auswahl ist kein Wirksamkeitsranking.</p>'+editorialNotes+'<div class="treatment-view-switch" role="group" aria-label="Behandlungsansicht">'+[['categories','Kategorien'],['list','Liste'],['cards','Kacheln']].map(([key,label])=>'<button type="button" data-treatment-view="'+key+'" aria-pressed="'+(state.treatmentView===key)+'">'+label+'</button>').join('')+'</div>'+filterControls+body+'</section>';

  }
  const views = { ueberblick: overview, termin: appointment, zugang: access, wirkung: effect };
  function render(focus = false) {
    detailMap?.remove();
    detailMap = null;
    document.querySelector('.profile').hidden = state.error;
    document.querySelector('.side-nav').hidden = state.error;
    document.querySelector('.detail-layout').classList.toggle('has-error', state.error);
    if (state.error) {
      content.innerHTML = '<section class="card" role="status"><h2>Praxis konnte nicht geladen werden</h2><p>Der Eintrag ist nicht in der aktuellen Auswahl enthalten oder die Daten sind gerade nicht erreichbar.</p><button type="button" id="retry-data">Erneut versuchen</button> <a href="aerzte_karte.html">Zur Ärzt:innen-Suche</a></section>';
      return;
    }
    content.innerHTML = views[state.view]();
    profileMap?.invalidateSize();
    updateAnswerControls();
    detailMap = createMap(document.getElementById('doctor-detail-map'));
    document.querySelectorAll('[data-view]').forEach(link => {
      if (link.dataset.view === state.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (focus) { content.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  }
  function navigate(focus) {
    const view = location.hash.slice(1);
    state.view = Object.hasOwn(views, view) ? view : 'ueberblick';
    render(focus);
  }
  function refreshTreatmentControls(focusId) {
    const section=document.getElementById('treatment-section');
    const open=document.getElementById('treatment-category-filter')?.open;
    const old=document.activeElement;
    const caret=old?.id==='treatment-query'?old.selectionStart:null;
    if(section)section.outerHTML=treatmentSection();
    const details=document.getElementById('treatment-category-filter');if(details)details.open=!!open;
    const target=focusId?document.getElementById(focusId):null;
    target?.focus({preventScroll:true});
    if(caret!==null&&target?.id==='treatment-query')target.setSelectionRange(caret,caret);
  }
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
    }else if(el.dataset.treatmentRating){state[el.dataset.treatmentRating==='positive'?'treatmentPositiveMin':'treatmentNegativeMax']=Math.max(0,Math.min(100,Number(el.value)||0));refreshTreatmentControls(el.id);
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
      saveAnswer(button.classList.contains('agreement-answer') && state.selections[key] === value ? {action:'clear',question:key} : {question:key,value:value+1});
    } else if (button.dataset.insurance) {
      state.insurance = button.dataset.insurance;
      render();
      content.querySelector(`[data-insurance="${state.insurance}"]`).focus();
      } else if(button.id==='treatment-reset-filters') {
      Object.assign(state,{treatmentQuery:'',treatmentFilterCategories:null,treatmentOnlyRated:false,treatmentPositiveMin:0,treatmentNegativeMax:100,treatmentCategory:null,treatmentSort:null,treatmentSortDirection:'desc'});
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
      state.treatmentView=button.dataset.treatmentView;
      if(state.treatmentView==='categories')state.treatmentCategory=null;
      render();
      content.querySelector('[data-treatment-view="'+state.treatmentView+'"]').focus({preventScroll:true});
    } else if (button.hasAttribute('data-treatment-category')) {
      state.treatmentCategory = button.dataset.treatmentCategory;
      render();
      document.querySelector('#treatment-section h3').focus({preventScroll:true});
      document.getElementById('treatment-section').scrollIntoView({block:'start'});
    } else if (button.id === 'treatment-back') {
      const previous = state.treatmentCategory;
      state.treatmentView = 'categories';
      state.treatmentCategory = null;
      render();
      [...content.querySelectorAll('[data-treatment-category]')].find(option => option.dataset.treatmentCategory === previous)?.focus({preventScroll:true});
      document.getElementById('treatment-section').scrollIntoView({block:'start'});
    } else if (button.id === 'retry-data') {
      loadOriginalData();
      loadCommunityData();
    } else if (button.id === 'clear-location') {
      clearLocation();
    } else if (button.id === 'reset-demo') {
      saveAnswer({action: 'reset'});
    } else if (button.dataset.contact) {
      notify(`${button.dataset.contact}: In diesem Entwurf sind keine Kontaktdaten hinterlegt.`);
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
  const locationKeys = ['lcn_shared_location_preference','lcn_shared_location_cleared','lcn_doctor_location_preference','lcn_treatment_location_preference'];
  window.addEventListener('storage', event => {
    if (event.key === null || locationKeys.includes(event.key)) { locationRequest?.abort(); refreshLocation(); }
  });
  window.addEventListener('hashchange', () => { if (validId) navigate(true); });
  if (!validId) {
    document.querySelector('.profile').hidden = true;
    document.querySelector('.side-nav').hidden = true;
    document.querySelector('.detail-layout').classList.add('has-error');
    content.innerHTML = '<section class="card" role="status"><h2>Keine gültige Arzt-ID angegeben</h2><p>Öffne einen Behandler über die Ärzt:innen-Suche.</p><a href="aerzte_karte.html">Zur Ärzt:innen-Suche →</a></section>';
    document.getElementById('community-mode').textContent = '';
    return;
  }
  navigate(false);
  loadOriginalData();
  loadCommunityData();
  loadDoctorSelector();
})();
