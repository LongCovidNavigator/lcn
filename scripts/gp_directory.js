/* Independent directory: the nearby map's ten-result limit never limits this list. */
document.addEventListener('DOMContentLoaded', async () => {
    const body = document.getElementById('gp-directory-body');
    if (!body) return;
    const search = document.getElementById('gp-directory-search');
    const status = document.getElementById('gp-directory-status');
    const more = document.getElementById('gp-directory-more');
    const nearestSection = document.getElementById('gp-directory-nearest');
    const onlineSection = document.getElementById('gp-directory-online');
    const remainingTitle = document.getElementById('gp-directory-remaining-title');
    const nearestTitle = document.getElementById('gp-directory-nearest-title');
    const groupHead = body.parentElement.tHead.cloneNode(true);
    groupHead.querySelectorAll('th').forEach(th => {
        th.removeAttribute('aria-sort');
        th.textContent = th.textContent;
    });
    const nearestBody = document.getElementById('gp-directory-nearest-body');
    const onlineBody = document.getElementById('gp-directory-online-body');
    const onlineCards = document.getElementById('gp-directory-online-cards');
    nearestBody.parentElement.prepend(groupHead);
    onlineBody.parentElement.prepend(groupHead.cloneNode(true));
    const locationKey = row => [row.dr_id,row.loc_plz,row.loc_city,row.loc_street,row.loc_housenumber].join('|');
    const escape = value => escapeHomepageHtml(value);
    const normalize = value => String(value || '').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
    let rows = [], visible = 50, sort = 'distance', direction = 1;
    let nearestRanks = new Map(), request = 0;
    let hasOrigin = false;
    let preferredView = 'table';
    const stackedResults = window.matchMedia('(max-width: 760px), (max-width: 800px) and (orientation: portrait)');
    const cards = document.getElementById('gp-directory-cards');
    const value = (row, key) => ({city:row.loc_city || '', name:row.dr_display_name || '', specialty:row.specialty_labels || '', rank:Number(row.dr_id), distance:hasOrigin ? Number(row.distance_km ?? Infinity) : 0, treatment_count:Number(row.treatment_count || 0), category_count:Number(row.category_count || 0), experience:Number(row.total_votes || 0), contact:row.loc_phone || row.loc_email || ''})[key];
    function render() {
        const view = stackedResults.matches ? 'table' : preferredView;
        for (const grid of [cards, onlineCards]) {
            if (grid.previousElementSibling?.classList.contains('recommendation-card-compare-bar')) grid.previousElementSibling.remove();
        }
        const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
        const onlineRank = row => Number(Boolean(row.online_therapy_available));
        const enriched = rows.map(row => {
            const access = window.LCNOnline?.get(row.dr_id);
            return access?.demo ? {...row, online_therapy_available:access.complete} : row;
        });
        const nearby = stackedResults.matches ? enriched.filter(row => nearestRanks.has(locationKey(row)))
            .sort((a,b) => nearestRanks.get(locationKey(a)) - nearestRanks.get(locationKey(b))) : [];
        const matchesSearch = row => {
            const text = normalize([row.dr_display_name, row.loc_city, row.loc_plz, row.loc_street, row.loc_label].join(' '));
            return terms.every(term => text.includes(term));
        };
        const online = enriched.filter(row => onlineRank(row) && (stackedResults.matches
            ? !nearestRanks.has(locationKey(row))
            : matchesSearch(row)));
        const priorityKeys = new Set([...nearby, ...online].map(locationKey));
        const sortRows = (a,b) => {
            if (sort === 'distance') {
                const distanceA = a.online_only ? Infinity : value(a, sort);
                const distanceB = b.online_only ? Infinity : value(b, sort);
                if (Number.isFinite(distanceA) !== Number.isFinite(distanceB)) return Number.isFinite(distanceA) ? -1 : 1;
                return direction * (distanceA - distanceB) || 0;
            }
            return direction * (typeof value(a,sort) === 'number' ? value(a,sort)-value(b,sort) : String(value(a,sort)).localeCompare(String(value(b,sort)),'de',{numeric:true,sensitivity:'base'}));
        };
        const filtered = enriched.filter(row => !priorityKeys.has(locationKey(row)) && matchesSearch(row)).sort(sortRows);
        if (!stackedResults.matches) online.sort(sortRows);
        const total = nearby.length + online.length + filtered.length;
        const limit = total < 100 ? total : Math.min(visible, total);
        const onlineShown = online.slice(0, limit - nearby.length);
        const priorityCount = nearby.length + onlineShown.length;
        const shown = filtered.slice(0, limit - priorityCount);
        function renderRow(row, rank) {
            const contact = buildRecommendationContact(row);
            const specialty = buildRecommendationSpecialtyBadges(row);
            const onlineLabel = row.online_therapy_available ? LCNOnline.appointmentLabel : '';
            const onlineBadge = onlineLabel
                ? `<span class="lcn-online-badge">${escape(onlineLabel)}</span>`
                : '';
            const distance = row.online_only ? "–" : buildRecommendationDistance(row);
            return `<tr data-doctor-online-managed><td>${rank}</td><td class="doctor-table-name"><a href="arzt_detail.html?id=${encodeURIComponent(row.dr_id)}">${escape(row.dr_display_name || 'Hausarztpraxis')}</a>${onlineBadge}</td><td class="doctor-table-specialty">${specialty}</td><td>${LCNExperience.html('doctor',row.dr_id)}</td><td>${distance}</td><td>${row.treatment_count == null ? '–' : Number(row.treatment_count)}</td><td>${row.category_count == null ? '–' : Number(row.category_count)}</td><td>${contact || '–'}</td></tr>`;
        }
        const groupAnchor = stackedResults.matches ? nearestSection : status;
        if (groupAnchor.nextElementSibling !== onlineSection) groupAnchor.after(onlineSection, remainingTitle);
        nearestSection.hidden = !nearby.length;
        onlineSection.hidden = !onlineShown.length;
        remainingTitle.hidden = !stackedResults.matches && !onlineShown.length;
        remainingTitle.textContent = priorityCount ? 'Erweiterte Hausarztpraxen' : 'Hausarztpraxen';
        nearestTitle.textContent = nearby.length === 1 ? 'Die nächste Hausarztpraxis' : `Die nächsten ${nearby.length} Hausarztpraxen`;
        nearestBody.innerHTML = nearby.map((row,index) => renderRow(row,index+1)).join('');
        onlineBody.innerHTML = onlineShown.map((row,index) => renderRow(row, nearby.length + index + 1)).join('');
        body.innerHTML = shown.map((row,index) => renderRow(row, priorityCount + index + 1)).join('')
            || (priorityCount ? '<tr><td colspan="8">Keine weiteren Praxen gefunden.</td></tr>' : '<tr><td colspan="8">Keine Praxen gefunden. Versuche einen anderen Namen, Ort oder eine PLZ.</td></tr>');
        status.textContent = `${limit} von ${total} Einträgen angezeigt${terms.length ? ` · ${rows.length} insgesamt` : ''}.`;
        more.hidden = limit >= total;
        cards.innerHTML = view === 'cards' ? shown.map((row,index)=>LCNSearchCards.doctor(row,priorityCount + index)).join('') : '';
        onlineCards.innerHTML = view === 'cards' ? onlineShown.map((row,index)=>LCNSearchCards.doctor(row,index)).join('') : '';
        onlineCards.hidden = view !== 'cards';
        cards.hidden = view !== 'cards';
        document.querySelector('.gp-directory').dataset.view = view;
        document.querySelectorAll('[data-gp-view]').forEach(button=>{button.classList.toggle('is-active',button.dataset.gpView===view);button.setAttribute('aria-pressed',String(button.dataset.gpView===view));});
    }
    document.querySelectorAll('[data-gp-view]').forEach(button=>button.addEventListener('click',()=>{preferredView=button.dataset.gpView;render();}));
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
    async function loadDirectory() {
        const current = ++request;
        try {
            const saved = getHomepageSharedLocation();
            const origin = saved || homepageGermanyCenter;
            const response = await fetch(buildHomepagePrimaryCareUrl(origin));
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error('load');
            const seen = new Set();
            const mapped = getHomepagePrimaryCareProviders(data,false).filter(row => {
                const key = locationKey(row);
                if(seen.has(key)) return false; seen.add(key); return true;
            });
            const detailResponse = await fetch(`api/doctors_search.php?treat_id=${homepagePrimaryCareTreatmentId}&lat=${encodeURIComponent(origin.lat)}&lng=${encodeURIComponent(origin.lng)}&radiusKm=all&includeNoCoords=1`);
            const details = await detailResponse.json();
            if(!detailResponse.ok || !details.ok) throw new Error('details');
            if (current !== request) return;
            hasOrigin = Boolean(saved);
            const byId = new Map(details.items.map(row => [Number(row.dr_id),row]));
            const nearest = saved ? getNearestHomepagePrimaryCareProviders(
                getHomepagePrimaryCareProviders(data,true).filter(row => !byId.get(Number(row.dr_id))?.online_only)
            ) : [];
            nearestRanks = new Map(nearest.map((row,index) => [locationKey(row), index+1]));
            const mappedIds = new Set(mapped.map(row => Number(row.dr_id)));
            rows = mapped.map(row => ({...byId.get(Number(row.dr_id)), ...row, distance_km:hasOrigin ? row.distance_km : null}));
            rows.push(...details.items.filter(row => row.online_therapy_available && !mappedIds.has(Number(row.dr_id))));
            render();
        } catch(error) {
            if (current !== request) return;
            status.textContent='Die Praxen konnten nicht geladen werden. Bitte lade die Seite erneut.';
            if (!rows.length) body.innerHTML='<tr><td colspan="8">Zurzeit keine Daten verfügbar.</td></tr>';
        }
    }
    stackedResults.addEventListener('change', render);
    window.addEventListener('lcn-online-ready', () => { if (rows.length) render(); });
    window.addEventListener('homepage:location-changed', loadDirectory);
    await loadDirectory();
});
