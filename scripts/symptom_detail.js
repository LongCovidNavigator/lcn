(() => {
    const main = document.querySelector('[data-symptom-id]');
    function updateProviderBadges() {
        for (const badge of main.querySelectorAll('[data-sym-online]')) {
            badge.hidden = !window.LCNOnline?.get(badge.dataset.symOnline).complete;
        }
    }
    window.addEventListener('lcn-online-ready', updateProviderBadges);
    updateProviderBadges();
    const providerMap = document.getElementById('symptom-provider-map');
    if (providerMap) {
        const { readOrigin, distanceTo } = window.LCNSymptomLocations;
        const origin = readOrigin();
        const locations = JSON.parse(document.getElementById('symptom-provider-locations').textContent);
        const groups = new Map();
        for (const row of main.querySelectorAll('[data-symptom-provider]')) {
            const id = row.dataset.symptomProvider;
            const link = row.querySelector('a');
            let nearestDistance = Infinity;
            let nearest;
            for (const location of locations[id] ?? []) {
                const distance = distanceTo(location, origin ?? undefined);
                if (!Number.isFinite(distance)) continue;
                if (distance < nearestDistance) {
                    nearest = location;
                    nearestDistance = distance;
                }
                const coordinates = [location.loc_lat, location.loc_lng].map(value => Number(value).toFixed(6)).join(',');
                if (!groups.has(coordinates)) groups.set(coordinates, new Map());
                groups.get(coordinates).set(id, link);
            }
            if (origin && nearest) {
                const distance = nearestDistance.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km';
                const place = [nearest.loc_plz, nearest.loc_city].filter(Boolean).join(' ');
                row.querySelector('[data-symptom-provider-location]').textContent = [distance, place].filter(Boolean).join(' · ');
            }
        }
        const status = document.getElementById('symptom-provider-map-status');
        if (!groups.size || !window.L) {
            status.textContent = groups.size ? 'Die Karte ist gerade nicht verfügbar.' : 'Für diese Behandler sind keine Kartenstandorte hinterlegt.';
        } else {
            providerMap.hidden = false;
            window.LCNImages?.configureLeaflet(L);
            const map = window.LCNMapViewport.createMap(providerMap, {
                viewKey: 'symptom-providers:' + main.dataset.symptomId,
                lcnCompactResultFit: true
            });
            for (const [coordinates, providers] of groups) {
                const list = document.createElement('ul');
                list.className = 'symptom-map-popup';
                for (const link of providers.values()) {
                    list.appendChild(document.createElement('li')).append(link.cloneNode(true));
                }
                const options = providers.size > 1 && window.LCNImages
                    ? { icon: window.LCNImages.countMarkerIcon(providers.size) } : {};
                const marker = L.marker(coordinates.split(',').map(Number), options)
                    .bindPopup(list, { maxHeight: 220 }).addTo(map);
                window.LCNOnline?.track(marker, [...providers.keys()], providers.size);
            }
            if (origin) {
                L.marker([origin.lat, origin.lng], { icon: window.LCNMapViewport.originIcon(), lcnOwnLocation: true })
                    .bindPopup('Dein Standort').addTo(map);
            }
        }
    }
    const form = document.getElementById('symptom-link-form');
    if (form) {
        form.hidden = false;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const button = form.querySelector('button');
            const error = document.getElementById('symptom-link-error');
            button.disabled = true;
            error.hidden = true;
            try {
                const response = await fetch('api/treatment_answer.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'link_symptom',
                        treatment_id: Number(form.elements.treatment_id.value),
                        symptom_id: Number(main.dataset.symptomId)
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.ok) throw new Error(data.error);
                location.reload();
            } catch (failure) {
                error.textContent = failure.message || 'Die Verknüpfung konnte nicht gespeichert werden.';
                error.hidden = false;
                button.disabled = false;
            }
        });
    }

    const cardList = document.getElementById('symptom-treatment-cards');
    if (!cardList) return;
    const cards = [...cardList.children];
    const table = document.getElementById('symptom-treatment-table');
    const tableBody = table.tBodies[0];
    const viewSwitch = main.querySelector('[data-treatment-view-switch]');
    const viewButtons = [...viewSwitch.querySelectorAll('button')];

    function renderTable() {
        const rows = document.createDocumentFragment();
        for (const card of cards) {
            const row = rows.appendChild(document.createElement('tr'));
            const treatment = row.appendChild(document.createElement('th'));
            treatment.scope = 'row';
            for (const element of card.querySelectorAll('[data-therapy-link], [data-therapy-online]')) {
                treatment.append(element.cloneNode(true));
            }
            const provider = card.querySelector('[data-provider]');
            row.insertCell().append(provider.cloneNode(true));
            const place = card.querySelector('[data-provider-location]').textContent;
            row.insertCell().textContent = place || '–';
        }
        tableBody.replaceChildren(rows);
    }

    for (const button of viewButtons) {
        button.addEventListener('click', () => {
            const showTable = button.dataset.treatmentView === 'table';
            cardList.hidden = showTable;
            table.hidden = !showTable;
            if (showTable) renderTable();
            for (const option of viewButtons) {
                option.classList.toggle('is-active', option === button);
                option.setAttribute('aria-pressed', String(option === button));
            }
        });
    }
    viewSwitch.hidden = false;
    const mapNode = document.getElementById('symptom-map');
    const status = document.getElementById('symptom-map-status');

    function updateOnlineBadges() {
        for (const card of cards) {
            const link = card.querySelector('[data-provider-id]');
            if (link) {
                card.querySelector('[data-provider-online]').hidden = !window.LCNOnline?.get(link.dataset.providerId).complete;
            }
        }
        if (!table.hidden) renderTable();
    }

    function renderMap(groups, origin) {
        if (!groups.size) return;
        mapNode.hidden = false;
        window.LCNImages?.configureLeaflet(L);
        const map = window.LCNMapViewport.createMap(mapNode, { viewKey: 'symptom:' + main.dataset.symptomId });
        const markers = L.featureGroup().addTo(map);
        for (const [coordinates, items] of groups) {
            const list = document.createElement('ul');
            list.className = 'symptom-map-popup';
            for (const item of items) {
                const row = document.createElement('li');
                row.append(item.therapy.cloneNode(true), document.createElement('br'), item.provider.cloneNode(true));
                list.append(row);
            }
            const options = items.length > 1 && window.LCNImages
                ? { icon: window.LCNImages.countMarkerIcon(items.length) } : {};
            const marker = L.marker(coordinates.split(',').map(Number), options)
                .bindPopup(list, { maxHeight: 220 }).addTo(markers);
            window.LCNOnline?.track(marker, items.map(item => item.provider.dataset.providerId), items.length);
        }
        if (origin) {
            L.marker([origin.lat, origin.lng], { icon: window.LCNMapViewport.originIcon(), lcnOwnLocation: true })
                .bindPopup('Dein Standort').addTo(markers);
        }
        map.fitBounds(markers.getBounds(), { padding: [24, 24], maxZoom: 10 });
    }

    async function loadProviders() {
        const { readOrigin, loadTreatments } = window.LCNSymptomLocations;
        const origin = readOrigin();
        const { items, providers } = await loadTreatments(
            cards.map(card => card.dataset.treatmentId), origin, { mapAll: true }
        );

        const groups = new Map();
        const therapyLinks = new Map(cards.map(card => [
            card.dataset.treatmentId, card.querySelector('[data-therapy-link]')
        ]));
        for (const card of cards) {
            const item = items.get(card.dataset.treatmentId);
            card.querySelector('[data-therapy-online]').hidden = !item?.online_at_home;
            const provider = item?.nearest_provider;
            if (!provider) continue;

            const link = document.createElement('a');
            link.href = 'arzt_detail.html?id=' + Number(provider.dr_id);
            link.textContent = provider.dr_display_name;
            link.dataset.providerId = provider.dr_id;
            const badge = document.createElement('span');
            badge.className = 'lcn-online-badge';
            badge.dataset.providerOnline = '';
            badge.textContent = 'Erst- und Folgetermin online';
            badge.hidden = true;
            card.querySelector('[data-provider]').replaceChildren(link, badge);

            const location = card.querySelector('[data-provider-location]');
            const place = [provider.loc_plz, provider.loc_city].filter(Boolean).join(' ');
            const distance = origin ? Number(provider.distance_km).toLocaleString('de-DE') + ' km Luftlinie' : '';
            location.textContent = [place, distance].filter(Boolean).join(' · ');
            location.hidden = !location.textContent;

        }
        for (const provider of providers) {
            const therapy = therapyLinks.get(String(provider.treat_id));
            if (!therapy) continue;
            const link = document.createElement('a');
            link.href = 'arzt_detail.html?id=' + Number(provider.dr_id);
            link.textContent = provider.dr_display_name;
            link.dataset.providerId = provider.dr_id;
            const key = [provider.loc_lat, provider.loc_lng].join(',');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ therapy, provider: link });
        }
        updateOnlineBadges();
        status.textContent = groups.size
            ? 'Die Karte zeigt die hinterlegten Standorte der Behandler, die eine der verknüpften Therapien anbieten.'
            : 'Für diese Behandlungen sind keine Standorte mit Kartenkoordinaten hinterlegt.';
        if (groups.size && !window.L) {
            status.textContent = 'Die Karte ist gerade nicht verfügbar. Die Behandler stehen in der Liste.';
            return;
        }
        renderMap(groups, origin);
    }

    window.addEventListener('lcn-online-ready', updateOnlineBadges);
    updateOnlineBadges();
    loadProviders().catch(() => {
        status.textContent = 'Die Karte konnte gerade nicht geladen werden.';
    });
})();
