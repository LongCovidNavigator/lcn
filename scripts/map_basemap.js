/* Quiet, single-language vector background; existing Leaflet markers remain unchanged. */
(() => {
    if (window.LCNBasemap) return;
    let resources;
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src; script.onload = resolve;
            script.onerror = () => reject(new Error('Kartenbibliothek konnte nicht geladen werden.'));
            document.head.append(script);
        });
    }
    function ready() {
        if (!resources) {
            const css = document.createElement('link'); css.rel = 'stylesheet';
            css.href = 'assets/vendor/maplibre/maplibre-gl.css'; document.head.append(css);
            resources = (window.maplibregl ? Promise.resolve() : loadScript('assets/vendor/maplibre/maplibre-gl.js'))
                .then(() => window.L.maplibreGL ? undefined : loadScript('assets/vendor/maplibre/leaflet-maplibre-gl.js'));
        }
        return resources;
    }
    function install() {
        if (!window.L || L._lcnBasemapInstalled) return;
        L._lcnBasemapInstalled = true;
        const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>';
        const Background = L.Layer.extend({
            options: { attribution },
            onAdd(map) {
                this._targetMap = map;
                ready().then(() => {
                    if (this._targetMap !== map || !map.hasLayer(this)) return;
                    this._vector = L.maplibreGL({ style: 'assets/lcn-basemap-de.json?v=20261102', interactive: false, attributionControl: false });
                    this._vector.addTo(map);
                    this._vector.getMaplibreMap().on('error', error => this.fire('tileerror', {error: error.error}));
                }).catch(error => this.fire('tileerror', {error}));
            },
            onRemove(map) { this._targetMap = null; if (this._vector) { map.removeLayer(this._vector); this._vector = null; } }
        });
        const original = L.tileLayer;
        L.tileLayer = Object.assign(function(url, options) {
            if (url === 'https://tile.openstreetmap.de/{z}/{x}/{y}.png') return new Background();
            return original(url, options);
        }, original);
    }
    window.LCNBasemap = { install };
    document.addEventListener('load', install, true);
    install();
})();
