(() => {
    const treatmentId = 409;
    const germanyCenter = {lat:51.1657, lng:10.4515, label:'Deutschland'};
    const preloaded = new Map();
    const pending = new Map();

    function mapUrl({lat, lng}, radiusKm) {
        const params = new URLSearchParams({
            treat_ids:String(treatmentId), only_with_provider:'1', include_map:'1',
            mapped_providers_only:'1', lat:String(lat), lng:String(lng)
        });
        if (Number.isFinite(radiusKm)) {
            params.set('provider_lat', String(lat));
            params.set('provider_lng', String(lng));
            params.set('radius_km', String(radiusKm));
        }
        return 'api/treatments_search.php?' + params;
    }

    function detailsUrl({lat, lng}) {
        const params = new URLSearchParams({
            treat_id:String(treatmentId), lat:String(lat), lng:String(lng),
            radiusKm:'all', includeNoCoords:'1'
        });
        return 'api/doctors_search.php?' + params;
    }

    async function fetchData(url) {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error('Die hausärztlichen Praxen sind gerade nicht verfügbar.');
        return data;
    }

    function load(url) {
        if (pending.has(url)) return pending.get(url);
        if (preloaded.has(url)) return preloaded.get(url);
        const request = fetchData(url).finally(() => pending.delete(url));
        pending.set(url, request);
        return request;
    }

    window.LCNPrimaryCare = {
        treatmentId,
        germanyCenter,
        loadMap: (origin, radiusKm) => load(mapUrl(origin, radiusKm)),
        loadDetails: origin => load(detailsUrl(origin))
    };

    let origin = germanyCenter;
    try {
        const saved = JSON.parse(localStorage.getItem('lcn_shared_location_preference'));
        if (saved?.lat != null && saved.lng != null && saved.lat !== '' && saved.lng !== '' &&
            Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lng))) {
            origin = {lat:Number(saved.lat), lng:Number(saved.lng)};
        }
    } catch {}

    for (const url of [mapUrl(origin), detailsUrl(origin)]) {
        const request = load(url);
        preloaded.set(url, request);
        request.catch(() => preloaded.delete(url));
    }
    // The map and directory initialize in separate listeners and can share a settled preload.
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => preloaded.clear(), 0);
    }, {once:true});
})();
