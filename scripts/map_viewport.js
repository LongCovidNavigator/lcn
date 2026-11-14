/* Shared viewport preference for all Leaflet maps, including dynamically loaded maps. */
(() => {
    if (window.LCNMapViewport) return;
    const key = 'lcn_map_viewport_preference';
    const viewKeyPrefix = 'lcn_map_view:';
    const locationKeys = ['shared', 'doctor', 'treatment'].map(name => 'lcn_' + name + '_location_preference');
    const clearedLocationKey = 'lcn_shared_location_cleared';
    const overviewZoomOffset = 0.5;
    const initialCenter = [51.1657, 10.4515];
    const mapControls = '.leaflet-control, .leaflet-marker-icon, .leaflet-popup, .doctor-map-viewport-tools, button, a';
    const countries = { de: ['Deutschland', [[47.2, 5.5], [55.1, 15.5]]], at: ['Österreich', [[46.35, 9.4], [49.05, 17.2]]], ch: ['Schweiz', [[45.8, 5.9], [47.85, 10.55]]] };
    const instances = new Set();
    function read() { try { const value = localStorage.getItem(key); return value === 'all' || countries[value] ? value : 'de'; } catch (_) { return 'de'; } }
    let preference = read();
    function save(value, source) {
        preference = value;
        try { localStorage.setItem(key, value); } catch (_) {}
        instances.forEach(entry => entry.apply(true, entry === source));
    }
    const pointKey = point => Number(point.lat).toFixed(6) + ',' + Number(point.lng).toFixed(6);
    const hasCoordinates = point => point?.lat != null && point?.lng != null &&
        Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
    function storedOrigin() {
        try {
            if (localStorage.getItem(clearedLocationKey)) return null;
            for (const locationKey of locationKeys) {
                const point = JSON.parse(localStorage.getItem(locationKey));
                if (hasCoordinates(point)) return pointKey(point);
            }
        } catch (_) {}
        return null;
    }
    function discardViewsForOtherLocations(origin) {
        for (let index = localStorage.length - 1; index >= 0; index--) {
            const storageKey = localStorage.key(index);
            if (storageKey?.startsWith(viewKeyPrefix) &&
                readView(storageKey)?.origin !== origin) localStorage.removeItem(storageKey);
        }
    }
    function saveLocation(location) {
        localStorage.setItem(locationKeys[0], JSON.stringify(location));
        localStorage.removeItem(clearedLocationKey);
        if (hasCoordinates(location)) discardViewsForOtherLocations(pointKey(location));
    }
    function clearLocation(clearValue = '1') {
        locationKeys.forEach(locationKey => localStorage.removeItem(locationKey));
        localStorage.setItem(clearedLocationKey, clearValue);
        discardViewsForOtherLocations(null);
    }
    function readView(storageKey) {
        if (!storageKey) return null;
        try {
            const view = JSON.parse(localStorage.getItem(storageKey));
            if (view && Array.isArray(view.center) && view.center.length === 2 &&
                view.center.every(Number.isFinite) && Number.isFinite(view.zoom) &&
                (view.mode === 'all' || countries[view.mode])) return view;
        } catch (_) {}
        return null;
    }
    function createMap(container, { viewKey, center = initialCenter, zoom = 6, wheelZoom = true, zoomPosition = 'topright',
        tileMaxZoom = 19, onTileError, ...options } = {}) {
        install();
        const map = L.map(container, { ...options, lcnViewKey: viewKey, zoomControl: false, scrollWheelZoom: false });
        if (center) map.setView(center, zoom);
        if (zoomPosition) L.control.zoom({ position: zoomPosition }).addTo(map);
        if (wheelZoom) configureWheelZoom(map);
        const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: tileMaxZoom,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere'
        });
        if (onTileError) tiles.on('tileerror', onTileError);
        tiles.addTo(map);
        return map;
    }
    function configureWheelZoom(map) {
        const element = map.getContainer();
        let activated = false;
        const stopWheel = () => {
            activated = false;
            map.scrollWheelZoom.disable();
        };
        const activate = event => {
            if (event.pointerType !== 'touch' && !event.target.closest(mapControls)) activated = true;
        };
        const prepareWheel = event => {
            if (!(activated || event.ctrlKey || event.metaKey)) {
                map.scrollWheelZoom.disable();
            } else {
                map.scrollWheelZoom.enable();
            }
        };
        // Enable Leaflet before the same wheel event reaches its listener.
        element.addEventListener('wheel', prepareWheel, { capture: true, passive: true });
        element.addEventListener('click', activate);
        element.addEventListener('mouseleave', stopWheel);
        map.on('lcn-resume-page-scroll', stopWheel);
        map.once('unload', () => {
            element.removeEventListener('wheel', prepareWheel, true);
            element.removeEventListener('click', activate);
            element.removeEventListener('mouseleave', stopWheel);
            map.off('lcn-resume-page-scroll', stopWheel);
        });
    }
    function originIcon() {
        const urls = window.LCNImages?.urls || {};
        return L.icon({
            iconUrl: urls['map-marker-red'] || 'assets/images/icons/map_marker_red.svg',
            shadowUrl: urls['map-marker-shadow'] || 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
    }
    function bindLocationSuggestions(input, suggestions, { valid, onSelect }) {
        let timer, controller, version = 0, activeIndex = -1;
        const cache = new Map();
        suggestions.id = input.id + '-suggestions';
        suggestions.setAttribute('role', 'listbox');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', suggestions.id);

        function setOpen(open) {
            suggestions.classList.toggle('is-hidden', !open);
            input.setAttribute('aria-expanded', String(open));
        }
        setOpen(false);

        function dismiss() {
            clearTimeout(timer);
            controller?.abort();
            version++;
            setOpen(false);
            input.removeAttribute('aria-activedescendant');
            activeIndex = -1;
        }
        function showMessage(text) {
            const note = document.createElement('p');
            note.className = 'location-suggestion-status';
            note.setAttribute('role', 'status');
            note.textContent = text;
            suggestions.replaceChildren(note);
            setOpen(true);
            activeIndex = -1;
        }
        function render(results, query) {
            suggestions.replaceChildren();
            activeIndex = -1;
            results.filter(valid).forEach((result, index) => {
                const choice = document.createElement('button');
                choice.type = 'button';
                choice.id = suggestions.id + '-' + index;
                choice.setAttribute('role', 'option');
                choice.textContent = result.formatted || result.label || query;
                choice.addEventListener('click', () => {
                    dismiss();
                    onSelect(result, choice.textContent);
                });
                suggestions.append(choice);
            });
            if (suggestions.childElementCount) setOpen(true);
            else showMessage('Kein Ort gefunden. Bitte Ort oder PLZ genauer angeben.');
        }
        function suggest() {
            dismiss();
            const query = input.value.trim();
            if (query.length < 2) {
                showMessage('Mindestens zwei Zeichen für Ort oder PLZ eingeben.');
                return;
            }
            const cacheKey = query.toLocaleLowerCase('de');
            if (cache.has(cacheKey)) {
                render(cache.get(cacheKey), query);
                return;
            }
            showMessage('Orte werden gesucht …');
            const requestVersion = version;
            timer = setTimeout(async () => {
                controller = new AbortController();
                try {
                    const response = await fetch('api/geocode_location.php?suggest=1&q=' + encodeURIComponent(query),
                        { signal: controller.signal });
                    const data = await response.json();
                    if (version !== requestVersion) return;
                    if (!response.ok || !data.ok) throw new Error();
                    const results = data.results || [];
                    cache.set(cacheKey, results);
                    render(results, query);
                } catch (error) {
                    if (error.name !== 'AbortError' && version === requestVersion) {
                        showMessage('Ortssuche derzeit nicht verfügbar. Bitte erneut versuchen.');
                    }
                }
            }, 150);
        }
        input.addEventListener('input', suggest);
        input.addEventListener('focus', suggest);
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') { dismiss(); return; }
            if (suggestions.classList.contains('is-hidden')) return;
            const choices = [...suggestions.querySelectorAll('button')];
            if (choices.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                activeIndex = (activeIndex + direction + choices.length) % choices.length;
                choices.forEach((choice, index) => choice.setAttribute('aria-selected', String(index === activeIndex)));
                input.setAttribute('aria-activedescendant', choices[activeIndex].id);
            } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                choices[activeIndex]?.click();
            }
        });
        return dismiss;
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
            button.addEventListener('click', () => { closeOptions(); save(value, entry); current.focus(); });
            options.append(button);
        });
        toggle.addEventListener('click', () => {
            const open = options.hidden;
            options.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
            if (open) options.querySelector('button').focus();
        });
        current.addEventListener('click', () => { closeOptions(); save(mode === 'all' ? 'de' : mode, entry); });
        toolbar.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !options.hidden) { event.preventDefault(); closeOptions(); toggle.focus(); }
        });
        toolbar.addEventListener('focusout', event => { if (!toolbar.contains(event.relatedTarget)) closeOptions(); });
        const outsideClick = event => { if (!toolbar.contains(event.target)) closeOptions(); };
        document.addEventListener('click', outsideClick);
        let timer, applying = false, disposed = false;
        let mode = map.options.lcnResultLocations || map.options.lcnCompactResultFit ? 'all' : preference;
        let previousPoints = null, savedView = null, previousRadius = null, previousOrigin = null;
        let hadOriginMarker = false, dragged = false;
        let lastSize = '', fitOnResize = false;
        let pendingForce = false, pendingPreset = false;
        const storageKey = map.options.lcnViewKey ? viewKeyPrefix + map.options.lcnViewKey : null;
        let chosenView = readView(storageKey);
        function clearChosenView() {
            chosenView = null;
            if (storageKey) try { localStorage.removeItem(storageKey); } catch (_) {}
        }
        const container = map.getContainer();
        // The map must be larger than the combined padding used by fitBounds.
        const canFit = () => container.clientWidth > 72 && container.clientHeight > 132;
        // Data refreshes must not turn the user's country/zoom selection into a
        // new fitBounds operation. Compare locations rather than marker objects.
        function rememberView() {
            savedView = { center: map.getCenter(), zoom: map.getZoom(), bounds: map.getBounds() };
        }
        function persistView(origin) {
            if (!storageKey) return;
            chosenView = { origin, center: [savedView.center.lat, savedView.center.lng], zoom: savedView.zoom, mode };
            try { localStorage.setItem(storageKey, JSON.stringify(chosenView)); } catch (_) {}
        }
        function show(points, radius) {
            // Integer zoom levels can leave almost half the map unused. Fit the
            // actual points in fine steps, including visible radius circles.
            map.options.zoomSnap = 0.1;
            const bounds = L.latLngBounds(points);
            if (radius) bounds.extend(radius.getBounds());
            const size = map.getSize();
            const compact = map.options.lcnCompactResultFit;
            const extraPadding = compact ? L.point(0, 0) : L.point(size.x * 0.035, size.y * 0.035);
            const paddingTopLeft = L.point(radius ? 32 : 18, points.length ? 92 : 56).add(extraPadding);
            const paddingBottomRight = L.point(radius ? [32, 28] : [18, 18]).add(extraPadding);
            const maxZoom = map.options.lcnResultLocations ? 14 : 10;
            const fittedZoom = compact ? maxZoom
                : map.getBoundsZoom(bounds, false, paddingTopLeft.add(paddingBottomRight)) - overviewZoomOffset;
            map.fitBounds(bounds, {
                paddingTopLeft,
                paddingBottomRight,
                maxZoom: points.length ? Math.min(maxZoom, fittedZoom) : maxZoom,
                animate: false
            });
        }
        const entry = { apply(force = false, selectPreset = false) {
            // Leaflet ignores a new zoom while an earlier zoom transition is
            // running. Keep the saved view intact until that transition ends.
            if (disposed) return;
            pendingForce ||= force;
            pendingPreset ||= selectPreset;
            clearTimeout(timer); timer = null;
            if (!canFit()) return;
            if (map._animatingZoom) {
                timer = setTimeout(() => entry.apply(), 50);
                return;
            }
            force = pendingForce;
            pendingForce = false;
            const selectedPreset = pendingPreset;
            pendingPreset = false;
            if (selectedPreset) clearChosenView();
            const results = map.options.lcnResultLocations?.map(point => L.latLng(point)) || [];
            let origin = null;
            let radiusCircle = null;
            map.eachLayer(layer => {
                if (layer instanceof L.Circle) radiusCircle = layer;
                if (!(layer instanceof L.Marker) || layer.options.lcnMapDecoration) return;
                const iconUrl = layer.options.icon?.options?.iconUrl || '';
                if (layer.options.lcnOwnLocation || /marker[_-]red/.test(iconUrl)) origin = layer.getLatLng();
                else if (!map.options.lcnResultLocations) results.push(layer.getLatLng());
            });
            const radius = radiusCircle ? pointKey(radiusCircle.getLatLng()) + ':' + radiusCircle.getRadius() : null;
            const radiusChanged = radius !== previousRadius;
            const originKey = origin ? pointKey(origin) : storedOrigin();
            if (chosenView && chosenView.origin !== originKey) clearChosenView();
            const originChanged = originKey !== previousOrigin || Boolean(origin) !== hadOriginMarker;
            const size = container.clientWidth + 'x' + container.clientHeight;
            const refit = fitOnResize && size !== lastSize;
            const points = new Set(results.map(pointKey));
            const compactResultsChanged = map.options.lcnCompactResultFit && previousPoints !== null
                && (points.size !== previousPoints.size || [...points].some(point => !previousPoints.has(point)));
            const addedOutside = previousPoints !== null && savedView && results.some(point =>
                !previousPoints.has(pointKey(point)) && !savedView.bounds.contains(point));
            const firstResults = !radius && previousPoints === null && points.size > 0;
            if (force) mode = preference;
            else if ((origin && (originChanged || (radiusCircle && radiusChanged))) || addedOutside) mode = 'all';
            applying = true;
            try {
                map.invalidateSize({ debounceMoveend: true });
                if (chosenView) {
                    mode = chosenView.mode;
                    map.options.zoomSnap = 0.1;
                    if (map.getZoom() !== chosenView.zoom || !map.getCenter().equals(chosenView.center)) {
                        map.setView(chosenView.center, chosenView.zoom, { reset: true });
                    }
                    fitOnResize = false;
                } else if (!force && radiusCircle && radiusChanged && !origin && map.options.lcnFitRadius) {
                    show([], radiusCircle);
                    fitOnResize = false;
                } else if (force || !savedView || firstResults || addedOutside || compactResultsChanged || radiusChanged || originChanged || refit) {
                    if (mode === 'all' && (results.length || origin || radiusCircle)) {
                        const includeOrigin = origin && (!map.options.lcnCompactResultFit || !results.length);
                        show(includeOrigin ? [...results, origin] : results, radiusCircle);
                    }
                    else map.fitBounds(countries[mode === 'all' ? 'de' : mode][1], {padding:[24,24],animate:false});
                    fitOnResize = true;
                } else {
                    map.setView(savedView.center, savedView.zoom, {animate:false});
                }
                rememberView();
                if (selectedPreset) {
                    persistView(originKey);
                    if (chosenView) fitOnResize = false;
                }
                lastSize = size;
                previousRadius = radius;
                previousOrigin = originKey;
                hadOriginMarker = Boolean(origin);
                if (points.size || previousPoints !== null) previousPoints = points;
            } finally { applying = false; }
            current.textContent = countries[mode === 'all' ? 'de' : mode][0];
            all.setAttribute('aria-pressed', String(mode === 'all'));
        }};
        map._lcnViewport = entry; instances.add(entry);
        all.addEventListener('click', () => { closeOptions(); save('all', entry); });
        // Prevent a legacy animated result fit from finishing after restoration.
        map.options.zoomAnimation = false;
        map.on('movestart zoomstart', () => { if (!applying) fitOnResize = false; });
        map.on('dragstart', () => { dragged = true; });
        map.on('moveend', () => {
            if (!savedView || !canFit() || applying) return;
            const size = map.getSize();
            if (size.x !== container.clientWidth || size.y !== container.clientHeight) return;
            const zoomChanged = savedView.zoom !== map.getZoom();
            rememberView();
            if (zoomChanged || dragged) persistView(previousOrigin);
            dragged = false;
        });
        map.on('resize', () => {
            if (applying || timer) return;
            timer = setTimeout(() => entry.apply(), 0);
        });
        const sizeObserver = new ResizeObserver(() => entry.apply());
        sizeObserver.observe(container);
        // Leaflet can cache a zero size if the container is hidden and shown
        // between two ResizeObserver deliveries.
        const visibilityObserver = new MutationObserver(() => {
            const size = map.getSize();
            if (canFit() && (size.x !== container.clientWidth || size.y !== container.clientHeight)) entry.apply();
        });
        visibilityObserver.observe(container, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
        map.on('layeradd layerremove', event => {
            if (disposed) return;
            if (!(event.layer instanceof L.Marker) && !(event.layer instanceof L.Circle)) return;
            clearTimeout(timer); timer = setTimeout(() => entry.apply(), 30);
        });
        map.on('unload', () => {
            disposed = true;
            clearTimeout(timer);
            sizeObserver.disconnect();
            visibilityObserver.disconnect();
            instances.delete(entry);
            document.removeEventListener('click', outsideClick);
        });
        entry.apply();
    }
    function configureTouchGestures(map) {
        if (!map.touchZoom.enabled() || !map.dragging.enabled()) return;
        const container = map.getContainer();
        const previousTouchAction = container.style.touchAction;
        let touchDragActive = false;
        let lastPointerType;
        const control = L.control({position: 'bottomleft'});
        const scrollButton = document.createElement('button');
        scrollButton.type = 'button';
        scrollButton.className = 'map-resume-page-scroll';
        scrollButton.textContent = 'Seite scrollen';
        scrollButton.hidden = true;
        L.DomEvent.disableClickPropagation(scrollButton);
        control.onAdd = () => scrollButton;
        control.addTo(map);

        function setTouchDrag(active) {
            touchDragActive = active;
            // The browser reads touch-action at the start of the next gesture.
            container.style.touchAction = active ? 'none' : 'pan-x pan-y';
            scrollButton.hidden = !active;
        }
        setTouchDrag(false);

        function resumePageScroll() {
            setTouchDrag(false);
            map.dragging.disable();
            map.scrollWheelZoom.disable();
            map.fire('lcn-resume-page-scroll');
        }
        scrollButton.addEventListener('click', event => {
            // The map's native click listener would otherwise re-enable wheel zoom.
            event.stopPropagation();
            resumePageScroll();
        });

        const setDragMode = event => {
            lastPointerType = event.pointerType;
            if (lastPointerType === 'touch' && !touchDragActive) map.dragging.disable();
            else map.dragging.enable();
            if (lastPointerType === 'mouse' && map.options.scrollWheelZoom) map.scrollWheelZoom.enable();
        };
        const activateTouchDrag = event => {
            if ((event.pointerType || lastPointerType) !== 'touch' || !event.detail) return;
            if (event.target.closest(mapControls)) return;
            setTouchDrag(true);
        };
        const releaseOutside = event => {
            if (touchDragActive && !container.contains(event.target)) resumePageScroll();
        };
        container.addEventListener('pointerdown', setDragMode, true);
        container.addEventListener('click', activateTouchDrag);
        document.addEventListener('pointerdown', releaseOutside, true);
        map.once('unload', () => {
            container.removeEventListener('pointerdown', setDragMode, true);
            container.removeEventListener('click', activateTouchDrag);
            document.removeEventListener('pointerdown', releaseOutside, true);
            container.style.touchAction = previousTouchAction;
        });
    }
    function install() {
        if (!window.L || L.Map.prototype._lcnViewportInstalled) return;
        L.Map.prototype._lcnViewportInstalled = true;
        L.Map.addInitHook(function () {
            configureTouchGestures(this);
            this.whenReady(() => setTimeout(() => attach(this), 0));
        });
    }
    window.LCNMapViewport = { install, createMap, originIcon, bindLocationSuggestions, saveLocation, clearLocation };
    document.addEventListener('load', install, true);
    window.addEventListener('storage', event => { if (event.key === key) { preference = read(); instances.forEach(entry => entry.apply(true)); } });
    install();
})();
