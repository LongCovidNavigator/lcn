(() => {
    const reference = { lat: 51.1657, lng: 10.4515 };

    function validLocation(point) {
        return !!point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
            && point.lat != null && point.lng != null && point.lat !== '' && point.lng !== ''
            && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
    }

    function readOrigin() {
        try {
            if (localStorage.getItem('lcn_shared_location_cleared')) return null;
            const point = JSON.parse(localStorage.getItem('lcn_shared_location_preference'));
            if (validLocation(point)) return point;
        } catch (_) {}
        return null;
    }

    function distanceTo(location, origin = reference) {
        const point = { lat: location.loc_lat, lng: location.loc_lng };
        if (!validLocation(point) || (Number(point.lat) === 0 && Number(point.lng) === 0)) return Infinity;
        const radians = Math.PI / 180;
        const sinLat = Math.sin((point.lat - origin.lat) * radians / 2);
        const sinLng = Math.sin((point.lng - origin.lng) * radians / 2);
        const arc = sinLat ** 2 + Math.cos(point.lat * radians) * Math.cos(origin.lat * radians) * sinLng ** 2;
        return 12742 * Math.asin(Math.sqrt(Math.min(1, arc)));
    }

    async function loadTreatments(ids, origin, { signal, mapAll = false } = {}) {
        const point = origin || reference;
        const items = new Map();
        const providers = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
            const params = new URLSearchParams({
                treat_ids: ids.slice(offset, offset + 100).join(','),
                include_map: '1', lat: point.lat, lng: point.lng
            });
            if (mapAll) params.set('map_all', '1');
            const response = await fetch('api/treatments_search.php?' + params, { signal });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error('Die Standorte konnten gerade nicht geladen werden.');
            for (const item of data.items) items.set(String(item.treat_id), item);
            if (mapAll) providers.push(...(data.map?.providers ?? []));
        }
        return { items, providers };
    }

    window.LCNSymptomLocations = { validLocation, readOrigin, distanceTo, loadTreatments };
})();
