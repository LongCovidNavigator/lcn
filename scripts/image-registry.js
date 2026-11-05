(function () {
    "use strict";

    // Zentrale Zuordnung aller Bilder, die auf der Website angezeigt werden.
    // Beim Austausch eines Bildes muss nur der jeweilige Pfad hier geändert werden.
    const paths = Object.freeze({
        "brand-logo": "assets/images/brand/logo_mark_v002.png",
        "home-hero": "assets/images/homepage/hero_01.png",
        "home-quickstart-icon": "assets/images/icons/quickstart_rocket.svg",
        "home-selection": "assets/images/homepage/process_selection.png",
        "home-search": "assets/images/homepage/process_search_02.png",
        "home-detail": "assets/images/homepage/process_detail_04.png",
        "home-therapies": "assets/images/homepage/feature_therapies.png",
        "home-doctors": "assets/images/homepage/feature_doctors.png",
        "home-project-mountain": "assets/images/homepage/project_challenge.png",
        "home-project-vision": "assets/images/homepage/project_vision.png",
        "home-project-status": "assets/images/homepage/project_status_02.png",
        "map-marker-default": "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        "map-marker-default-retina": "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        "map-marker-red": "assets/images/icons/map_marker_red.svg",
        "map-marker-shadow": "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
    });

    const urls = Object.freeze(
        Object.fromEntries(
            Object.entries(paths).map(([key, path]) => [
                key,
                new URL(path, document.baseURI).href
            ])
        )
    );

    Object.entries(urls).forEach(([key, url]) => {
        document.documentElement.style.setProperty(
            `--lcn-image-${key}`,
            `url("${url}")`
        );
    });

    function apply(root = document) {
        const elements = [];

        if (root.nodeType === Node.ELEMENT_NODE && root.matches("[data-lcn-image]")) {
            elements.push(root);
        }

        if (typeof root.querySelectorAll === "function") {
            elements.push(...root.querySelectorAll("[data-lcn-image]"));
        }

        elements.forEach((element) => {
            const key = element.dataset.lcnImage;
            const url = urls[key];

            if (!url) {
                console.warn(`Unbekannter Bildschlüssel: ${key}`);
                return;
            }

            if (element instanceof HTMLImageElement && element.src !== url) {
                element.src = url;
            }
        });
    }

    function configureLeaflet(leaflet) {
        if (!leaflet?.Icon?.Default) {
            console.warn("Leaflet ist für die zentrale Bildkonfiguration nicht verfügbar.");
            return;
        }

        leaflet.Icon.Default.mergeOptions({
            iconUrl: urls["map-marker-default"],
            iconRetinaUrl: urls["map-marker-default-retina"],
            shadowUrl: urls["map-marker-shadow"]
        });

        // Leaflet ergänzt sonst auch vor absolute URLs noch seinen erkannten CDN-Pfad.
        leaflet.Icon.Default.imagePath = "";
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => apply(node));
        });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => apply());
    } else {
        apply();
    }

    function countMarkerIcon(count, color = '#2889c2', border = '#176398') {
        const value = Math.max(1, Math.floor(Number(count) || 1));
        return window.L.divIcon({className:'lcn-count-pin', html:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44" style="display:block;filter:drop-shadow(0 2px 2px #17365d55)" aria-label="${value} Einträge"><path d="M16 1C7.7 1 1 7.7 1 16c0 10 15 26.5 15 26.5S31 26 31 16C31 7.7 24.3 1 16 1Z" fill="${color}" stroke="${border}" stroke-width="1.5"/><text x="16" y="17" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial,sans-serif" font-size="${value > 99 ? 12 : 14}" font-weight="700">${value}</text></svg>`,iconSize:[32,44],iconAnchor:[16,44],popupAnchor:[0,-38]});
    }
    window.LCNImages = Object.freeze({ paths, urls, apply, configureLeaflet, countMarkerIcon });
})();
