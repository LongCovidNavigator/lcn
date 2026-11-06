/* Shared viewport preference for all Leaflet maps, including dynamically loaded maps. */
(() => {
    if (window.LCNMapViewport) return;
    const key = 'lcn_map_viewport_preference';
    const countries = { de: ['Deutschland', [[47.2, 5.5], [55.1, 15.5]]], at: ['Österreich', [[46.35, 9.4], [49.05, 17.2]]], ch: ['Schweiz', [[45.8, 5.9], [47.85, 10.55]]] };
    const instances = new Set();
    function read() { try { const value = localStorage.getItem(key); return value === 'all' || countries[value] ? value : 'de'; } catch (_) { return 'de'; } }
    let preference = read();
    function save(value) {
        preference = value;
        try { localStorage.setItem(key, value); } catch (_) {}
        instances.forEach(entry => entry.apply(true));
    }
    function attach(map) {
        if (map.options.lcnViewport === false || map._lcnViewport || !map._containerId || (typeof map.getPane==='function' && !map.getPane('mapPane'))) return;
        const toolbar = L.DomUtil.create('div', 'doctor-map-viewport-tools', map.getContainer());
        toolbar.innerHTML = '<div class="map-country-control"><div class="map-country-split"><button type="button" data-country-current>Deutschland</button><button type="button" data-country-toggle aria-label="Land auswählen" aria-expanded="false"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="map-country-options" hidden></div></div><button type="button" data-show-all>Alle Treffer</button>';
        L.DomEvent.disableClickPropagation(toolbar);
        L.DomEvent.disableScrollPropagation(toolbar);
        const current = toolbar.querySelector('[data-country-current]'), toggle = toolbar.querySelector('[data-country-toggle]'), options = toolbar.querySelector('.map-country-options'), all = toolbar.querySelector('[data-show-all]');
        options.id = 'map-country-options-' + map._containerId;
        toggle.setAttribute('aria-controls', options.id);
        function closeOptions() { options.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
        Object.entries(countries).forEach(([value, country]) => {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = country[0]; button.dataset.country = value;
            button.addEventListener('click', () => { closeOptions(); save(value); current.focus(); });
            options.append(button);
        });
        toggle.addEventListener('click', () => {
            const open = options.hidden;
            options.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
            if (open) options.querySelector('button').focus();
        });
        current.addEventListener('click', () => { closeOptions(); save(mode === 'all' ? 'de' : mode); });
        toolbar.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !options.hidden) { event.preventDefault(); closeOptions(); toggle.focus(); }
        });
        toolbar.addEventListener('focusout', event => { if (!toolbar.contains(event.relatedTarget)) closeOptions(); });
        const outsideClick = event => { if (!toolbar.contains(event.target)) closeOptions(); };
        document.addEventListener('click', outsideClick);
        let markers = [], timer, applying = false, mode = preference, disposed = false;
        let previousPoints = null, savedView = null;
        // Data refreshes must not turn the user's country/zoom selection into a
        // new fitBounds operation. Compare locations rather than marker objects.
        const pointKey = marker => {
            const p = marker.getLatLng();
            return p.lat.toFixed(6) + ',' + p.lng.toFixed(6);
        };
        function rememberView() {
            savedView = { center: map.getCenter(), zoom: map.getZoom(), bounds: map.getBounds() };
        }
        function show(layers) {
            if (!layers.length) return;
            // Integer zoom levels can leave almost half the map unused. Fit the
            // actual points in fine steps, including visible radius circles.
            map.options.zoomSnap = 0.1;
            const bounds = L.latLngBounds(layers.map(m => m.getLatLng()));
            let hasRadius = false;
            map.eachLayer(layer => {
                if (layer instanceof L.Circle) {
                    bounds.extend(layer.getBounds());
                    hasRadius = true;
                }
            });
            map.fitBounds(bounds, {
                paddingTopLeft: hasRadius ? [32, 64] : [18, 48],
                paddingBottomRight: hasRadius ? [32, 32] : [18, 18],
                maxZoom: 10, animate: false
            });
        }
        function collect() {
            markers = [];
            map.eachLayer(layer => {
                const iconUrl = layer.options.icon?.options?.iconUrl || '';
                if (layer instanceof L.Marker && !layer.options.lcnOwnLocation && !/marker[_-]red/.test(iconUrl)) markers.push(layer);
            });
        }
        const entry = { apply(force = false) {
            // Leaflet ignores a new zoom while an earlier zoom transition is
            // running. Keep the saved view intact until that transition ends.
            if (disposed) return;
            if (map._animatingZoom) {
                clearTimeout(timer); timer = setTimeout(() => entry.apply(force), 50);
                return;
            }
            clearTimeout(timer); timer = null;
            collect();
            const points = new Set(markers.map(pointKey));
            const addedOutside = previousPoints !== null && savedView && markers.some(marker =>
                !previousPoints.has(pointKey(marker)) && !savedView.bounds.contains(marker.getLatLng()));
            const firstResults = previousPoints === null && points.size > 0;
            if (force) mode = preference;
            else if (addedOutside) mode = 'all';
            applying = true;
            try {
                if (force || !savedView || firstResults || addedOutside) {
                    if (mode === 'all' && markers.length) show(markers);
                    else map.fitBounds(countries[mode === 'all' ? 'de' : mode][1], {padding:[24,24],animate:false});
                } else {
                    map.setView(savedView.center, savedView.zoom, {animate:false});
                }
                rememberView();
                if (points.size || previousPoints !== null) previousPoints = points;
            } finally { applying = false; }
            current.textContent = countries[mode === 'all' ? 'de' : mode][0];
            all.setAttribute('aria-pressed', String(mode === 'all'));
        }, showAll() {
            mode = 'all';
            savedView = null;
            entry.apply();
        }};
        map._lcnViewport = entry; instances.add(entry);
        all.addEventListener('click', () => { closeOptions(); save('all'); });
        // Prevent a legacy animated result fit from finishing after restoration.
        map.options.zoomAnimation = false;
        map.on('moveend', () => { if (!applying && !timer) rememberView(); });
        map.on('resize', () => entry.apply());
        map.on('layeradd layerremove', event => {
            if (disposed) return;
            if (!(event.layer instanceof L.Marker) && !(event.layer instanceof L.Circle)) return;
            clearTimeout(timer); timer = setTimeout(() => entry.apply(), 30);
        });
        map.on('unload', () => { disposed = true; clearTimeout(timer); instances.delete(entry); document.removeEventListener('click', outsideClick); });
        entry.apply();
    }
    function install() {
        if (!window.L || L.Map.prototype._lcnViewportInstalled) return;
        L.Map.prototype._lcnViewportInstalled = true;
        L.Map.addInitHook(function () { this.whenReady(() => setTimeout(() => attach(this), 0)); });
    }
    window.LCNMapViewport = { install };
    document.addEventListener('load', install, true);
    window.addEventListener('storage', event => { if (event.key === key) { preference = read(); instances.forEach(entry => entry.apply(true)); } });
    install();
})();
