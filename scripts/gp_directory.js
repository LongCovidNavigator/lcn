/* Independent directory: the nearby map's ten-result limit never limits this list. */
document.addEventListener('DOMContentLoaded', async () => {
    const body = document.getElementById('gp-directory-body');
    if (!body) return;
    const search = document.getElementById('gp-directory-search');
    const status = document.getElementById('gp-directory-status');
    const more = document.getElementById('gp-directory-more');
    const escape = value => escapeHomepageHtml(value);
    const normalize = value => String(value || '').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
    let rows = [], visible = 50, sort = 'name', direction = 1;
    let hasOrigin = false;
    let view = 'table';
    const cards = document.getElementById('gp-directory-cards');
    const value = (row, key) => ({city:row.loc_city || '', name:row.dr_display_name || '', specialty:row.specialty_labels || '', rank:Number(row.dr_id), distance:hasOrigin ? Number(row.distance_km ?? Infinity) : 0, treatment_count:Number(row.treatment_count || 0), category_count:Number(row.category_count || 0), experience:Number(row.total_votes || 0), contact:row.loc_phone || row.loc_email || ''})[key];
    function render() {
        if(cards.previousElementSibling?.classList.contains('recommendation-card-compare-bar')) cards.previousElementSibling.remove();
        const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
        const filtered = rows.filter(row => {
            const text = normalize([row.dr_display_name, row.loc_city, row.loc_plz, row.loc_street, row.loc_label].join(' '));
            return terms.every(term => text.includes(term));
        }).sort((a,b) => direction * (typeof value(a,sort) === 'number' ? value(a,sort)-value(b,sort) : String(value(a,sort)).localeCompare(String(value(b,sort)),'de',{numeric:true,sensitivity:'base'})));
        body.innerHTML = filtered.slice(0,visible).map((row,index) => {
            const contact = buildRecommendationContact(row);
            const specialty = buildRecommendationSpecialtyBadges(row);
            return `<tr><td>${index+1}</td><td class="doctor-table-name"><a href="arzt_detail.html?id=${encodeURIComponent(row.dr_id)}">${escape(row.dr_display_name || 'Hausarztpraxis')}</a></td><td class="doctor-table-specialty">${specialty}</td><td>${LCNExperience.html('doctor',row.dr_id)}</td><td>${buildRecommendationDistance(row)}</td><td>${row.treatment_count == null ? '–' : Number(row.treatment_count)}</td><td>${row.category_count == null ? '–' : Number(row.category_count)}</td><td>${contact || '–'}</td></tr>`;
        }).join('') || '<tr><td colspan="8">Keine Praxen gefunden. Versuche einen anderen Namen, Ort oder eine PLZ.</td></tr>';
        status.textContent = `${Math.min(visible,filtered.length)} von ${filtered.length} Einträgen angezeigt${terms.length ? ` · ${rows.length} insgesamt` : ''}.`;
        more.hidden = visible >= filtered.length;
        cards.innerHTML = view === 'cards' ? filtered.slice(0,visible).map((row,index)=>LCNSearchCards.doctor(row,index)).join('') : '';
        cards.hidden = view !== 'cards';
        document.querySelector('.gp-directory').dataset.view = view;
        document.querySelectorAll('[data-gp-view]').forEach(button=>{button.classList.toggle('is-active',button.dataset.gpView===view);button.setAttribute('aria-pressed',String(button.dataset.gpView===view));});
    }
    document.querySelectorAll('[data-gp-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.gpView;render();}));
    document.getElementById('gp-directory-sort').addEventListener('change',event=>{const parts=event.target.value.split(':');sort=parts[0];direction=Number(parts[1]);visible=50;render();});
    search.addEventListener('input', () => { visible=50; render(); });
    more.addEventListener('click', () => { visible+=50; render(); });
    document.querySelectorAll('[data-gp-sort]').forEach(button => button.addEventListener('click', () => {
        const next = button.dataset.gpSort;
        direction = sort === next ? -direction : 1; sort=next; visible=50;
        document.querySelectorAll('[data-gp-sort]').forEach(other => other.parentElement.removeAttribute('aria-sort'));
        button.parentElement.setAttribute('aria-sort',direction===1?'ascending':'descending');
        document.querySelector('.gp-directory-scroll').scrollTop=0;
        render();
    }));
    try {
        const response = await fetch(buildHomepagePrimaryCareUrl(homepageGermanyCenter));
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error('load');
        const seen = new Set();
        rows = getHomepagePrimaryCareProviders(data,false).filter(row => {
            const key = [row.dr_id,row.loc_plz,row.loc_city,row.loc_street,row.loc_housenumber].join('|');
            if(seen.has(key)) return false; seen.add(key); return true;
        });
        let origin = homepageGermanyCenter;
        try { const saved = JSON.parse(localStorage.getItem('lcn_shared_location_preference') || 'null'); if(saved && Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lng))) { origin=saved; hasOrigin=true; } } catch(_) {}
        const detailResponse = await fetch(`api/doctors_search.php?lat=${encodeURIComponent(origin.lat)}&lng=${encodeURIComponent(origin.lng)}&radiusKm=all&includeNoCoords=1`);
        const details = await detailResponse.json();
        if(!detailResponse.ok || !details.ok) throw new Error('details');
        const byId = new Map(details.items.map(row => [Number(row.dr_id),row]));
        rows = rows.map(row => ({...byId.get(Number(row.dr_id)),...row,distance_km:byId.get(Number(row.dr_id))?.distance_km}));
        render();
    } catch(error) {
        status.textContent='Die Praxen konnten nicht geladen werden. Bitte lade die Seite erneut.';
        body.innerHTML='<tr><td colspan="8">Zurzeit keine Daten verfügbar.</td></tr>';
    }
});
