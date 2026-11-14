(() => {
    const mapNode = document.getElementById('sym-overview-map');
    const status = document.getElementById('sym-overview-map-status');
    const form = document.getElementById('sym-location-form');
    const input = document.getElementById('sym-location-input');
    const clear = document.getElementById('sym-location-clear');
    const error = document.getElementById('sym-location-error');
    const { validLocation, readOrigin, distanceTo, loadTreatments } = window.LCNSymptomLocations;
    const locations = JSON.parse(document.getElementById('sym-provider-locations').textContent);
    const cards = [...document.querySelectorAll('#sym-cards [data-symptom-result]')];
    const rows = new Map([...document.querySelectorAll('#sym-table [data-symptom-result]')]
        .map(row => [row.dataset.symptomResult, row]));
    const treatmentIds = card => card.dataset.treatmentIds.split(',').filter(Boolean);
    const treatments = [...new Set(cards.flatMap(treatmentIds))];
    const viewButtons = [...document.querySelectorAll('[data-sym-map-view]')];
    const note = document.getElementById('sym-map-marker-note');
    let origin = readOrigin();
    let mode = 'providers', request;
    let map, markers;

    function updateOnline() {
        for (const badge of document.querySelectorAll('[data-sym-online]')) {
            badge.hidden = !window.LCNOnline?.get(badge.dataset.symOnline).complete;
        }
    }

    function providerLink(provider) {
        const link = document.createElement('a');
        link.href = 'arzt_detail.html?id=' + Number(provider.dr_id);
        link.textContent = provider.dr_display_name;
        return link;
    }

    function createPopup(matches) {
        const popup = document.createElement('div');
        popup.className = 'sym-map-popup';
        const heading = document.createElement('strong');
        heading.className = 'sym-map-popup-heading';
        heading.textContent = matches.length === 1 ? '1 Symptom an diesem Standort'
            : matches.length + ' Symptome an diesem Standort';
        popup.append(heading);

        const { provider: location } = matches[0];
        const address = [
            [location.loc_street, location.loc_housenumber].filter(Boolean).join(' '),
            [location.loc_plz, location.loc_city].filter(Boolean).join(' ')
        ].filter(Boolean).join(', ');
        if (address) {
            const place = document.createElement('div');
            place.className = 'sym-map-popup-address';
            place.textContent = address;
            popup.append(place);
        }

        const list = document.createElement('ul');
        for (const { card, provider, treatment } of matches) {
            const item = document.createElement('li');
            const symptom = card.querySelector('h2 a').cloneNode(true);
            symptom.className = 'sym-map-popup-symptom';
            item.append(symptom);
            const detail = document.createElement('div');
            if (treatment) {
                const link = document.createElement('a');
                link.href = 'therapie_detail.php?treatment_id=' + Number(treatment.treat_id);
                link.textContent = treatment.behandlung;
                detail.append(link, ' · ');
            }
            detail.append(providerLink(provider));
            item.append(detail);
            list.append(item);
        }
        popup.append(list);
        return popup;
    }

    function updateResult(result, provider) {
        const name = result.querySelector('[data-sym-nearest]');
        const place = result.querySelector('[data-sym-location]');
        if (name) updateCardProvider(result, name, mode === 'providers' ? provider : null);
        const location = provider && [provider.loc_plz, provider.loc_city].filter(Boolean).join(' ');
        const km = origin && provider?.distance_km != null ? Number(provider.distance_km) : NaN;
        const distance = Number.isFinite(km) ? km.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km' : '';
        const value = [distance, location].filter(Boolean).join(' · ');
        if (!name) {
            if (distance) place.dataset.distance = km;
            else delete place.dataset.distance;
            place.dataset.city = provider?.loc_city || location || '';
            const stack = document.createElement('div');
            stack.className = 'treatment-table-stacked-cell';
            for (const [text, className] of [
                [distance, 'treatment-table-main-value'], [provider?.loc_city || location, 'treatment-table-muted']
            ]) {
                if (!text) continue;
                const part = document.createElement('span');
                part.className = className;
                part.textContent = text;
                stack.append(part);
            }
            place.replaceChildren(value ? stack : '–');
            return;
        }
        if (mode === 'therapies') {
            place.textContent = value ? 'Therapiestandort · ' + value : '';
            place.hidden = !value;
            name.after(place);
            return;
        }
        const preview = result.querySelector('[data-sym-provider-id="' + Number(provider?.dr_id) + '"]');
        if (preview) preview.append(place);
        else name.after(place);
        place.textContent = value;
        place.hidden = !value;
    }

    function updateCardProvider(result, name, provider) {
        const preview = provider && result.querySelector('[data-sym-provider-id="' + Number(provider.dr_id) + '"]');
        name.hidden = !provider || !!preview;
        name.replaceChildren();
        if (provider && !preview) {
            const badge = document.createElement('span');
            badge.className = 'lcn-online-badge';
            badge.dataset.symOnline = provider.dr_id;
            badge.textContent = 'Erst- und Folgetermin online';
            badge.hidden = true;
            name.append(providerLink(provider), badge);
        }
    }

    function renderMarkers(groups) {
        if (!map) return;
        markers.clearLayers();
        for (const [coordinates, matches] of groups) {
            const options = {
                title: matches.length + (matches.length === 1 ? ' Symptom' : ' Symptome'),
                zIndexOffset: matches.length > 1 ? 1000 : 0
            };
            if (matches.length > 1) options.icon = window.LCNImages.countMarkerIcon(matches.length);
            const marker = L.marker(coordinates.split(',').map(Number), options)
                .bindPopup(() => createPopup(matches), { maxWidth: 320, maxHeight: 190 })
                .addTo(markers);
            const providerIds = new Set(matches.map(({ provider }) => provider.dr_id));
            window.LCNOnline?.track(marker, [...providerIds], matches.length);
        }
        if (origin) {
            L.marker([origin.lat, origin.lng], { icon: window.LCNMapViewport.originIcon(), lcnOwnLocation: true })
                .bindPopup('Dein Standort').addTo(markers);
        }
        map._lcnViewport?.apply();
    }

    function renderResults(items) {
        const groups = new Map();
        let total = 0;
        for (const card of cards) {
            let provider;
            let treatment;
            let nearestDistance = Infinity;
            if (mode === 'therapies') {
                for (const id of treatmentIds(card)) {
                    const candidate = items.get(id);
                    const location = candidate?.nearest_provider;
                    if (location && location.distance_km < nearestDistance) {
                        nearestDistance = location.distance_km;
                        provider = location;
                        treatment = candidate;
                    }
                }
            } else {
                for (const id of card.dataset.providerIds.split(',')) {
                    for (const location of locations[id] ?? []) {
                        const distance = distanceTo(location, origin ?? undefined);
                        if (distance < nearestDistance) {
                            nearestDistance = distance;
                            provider = { ...location, distance_km: distance };
                        }
                    }
                }
            }
            updateResult(card, provider);
            updateResult(rows.get(card.dataset.symptomResult), provider);
            if (!provider) continue;
            total++;
            const key = [provider.loc_lat, provider.loc_lng].map(value => Number(value).toFixed(6)).join(',');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ card, provider, treatment });
        }
        updateOnline();
        document.dispatchEvent(new Event('lcn-symptom-locations-updated'));
        renderMarkers(groups);
        status.textContent = total
            ? total + ' von ' + cards.length + ' passenden Symptomen mit Kartenstandort · '
                + groups.size + (groups.size === 1 ? ' Standort' : ' Standorte')
                + (origin ? ' · jeweils am nächsten zu deinem Standort' : ' · jeweils am nächsten zur Kartenreferenz in Deutschland')
            : (mode === 'therapies' ? 'Für die passenden Symptome sind keine Standorte verknüpfter Therapien hinterlegt.'
                : 'Für die passenden Symptome sind keine Standorte direkt verknüpfter Behandler hinterlegt.');
    }

    async function refresh() {
        request?.abort();
        if (mode === 'providers') {
            renderResults();
            return;
        }
        request = new AbortController();
        const { signal } = request;
        status.textContent = 'Therapiestandorte werden geladen …';
        try {
            const { items } = await loadTreatments(treatments, origin, { signal });
            if (!signal.aborted) renderResults(items);
        } catch (error) {
            if (signal.aborted) return;
            renderResults(new Map());
            status.textContent = 'Die Therapiestandorte konnten gerade nicht geladen werden.';
        }
    }

    for (const button of viewButtons) {
        button.addEventListener('click', () => {
            if (mode === button.dataset.symMapView) return;
            mode = button.dataset.symMapView;
            for (const option of viewButtons) {
                option.classList.toggle('is-active', option === button);
                option.setAttribute('aria-pressed', String(option === button));
            }
            note.textContent = 'Die Zahl auf einem Marker zeigt, für wie viele der passenden Symptome dies der nächstgelegene Standort '
                + (mode === 'therapies' ? 'einer verknüpften Therapie' : 'eines direkt verknüpften Behandlers') + ' ist.';
            refresh();
        });
    }
    function selectOrigin(point, label) {
        origin = { lat: Number(point.lat), lng: Number(point.lng), location: label, label, city: point.city || '' };
        try { window.LCNMapViewport.saveLocation(origin); } catch (_) {}
        input.value = label;
        clear.hidden = false;
        error.hidden = true;
        refresh();
    }

    form.hidden = false;
    input.value = origin?.location || origin?.label || '';
    clear.hidden = !origin;
    const dismiss = window.LCNMapViewport.bindLocationSuggestions(input,
        document.getElementById('sym-location-input-suggestions'), { valid: validLocation, onSelect: selectOrigin });
    document.addEventListener('click', event => {
        if (!event.target.closest('#sym-location-form .sym-search-field')) dismiss();
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const query = input.value.trim();
        if (!query) return;
        dismiss();
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        error.hidden = true;
        try {
            const response = await fetch('api/geocode_location.php?q=' + encodeURIComponent(query));
            const data = await response.json();
            if (!response.ok || !data.ok || !validLocation(data.result)) throw new Error();
            selectOrigin(data.result, data.result.formatted || data.result.label || query);
        } catch (_) {
            error.textContent = 'Der Standort konnte nicht übernommen werden.';
            error.hidden = false;
        } finally {
            button.disabled = false;
        }
    });
    clear.addEventListener('click', () => {
        origin = null;
        try { window.LCNMapViewport.clearLocation(); } catch (_) {}
        input.value = '';
        clear.hidden = true;
        error.hidden = true;
        refresh();
    });
    if (window.L) {
        window.LCNImages?.configureLeaflet(L);
        map = window.LCNMapViewport.createMap(mapNode, {
            viewKey: 'symptom-overview:v2',
            lcnCompactResultFit: true
        });
        markers = L.featureGroup().addTo(map);
        mapNode.closest('details').addEventListener('toggle', event => {
            if (event.target.open) map._lcnViewport?.apply();
        });
    } else {
        mapNode.hidden = true;
    }
    window.addEventListener('lcn-online-ready', updateOnline);
    updateOnline();
    refresh();
})();
