(function () {
    "use strict";

    // Zentrale Zuordnung aller Bilder, die auf der Website angezeigt werden.
    // Beim Austausch eines Bildes muss nur der jeweilige Pfad hier geändert werden.
    const paths = Object.freeze({
        "brand-logo": "assets/images/brand/Logo_v002_justLogo.png",
        "home-hero": "assets/images/homepage/Hero_Landing_01.png",
        "home-quickstart-icon": "assets/images/icons/rocket-62.svg",
        "home-selection": "assets/images/homepage/Auswahl_Landing_01.png",
        "home-search": "assets/images/homepage/Suche_Landing_02.png",
        "home-detail": "assets/images/homepage/Detail_Landing_04.png",
        "home-therapies": "assets/images/homepage/Therapie_Landing.png",
        "home-doctors": "assets/images/homepage/Drs_Landing_01.png",
        "home-project-mountain": "assets/images/homepage/Berg_02.png",
        "home-project-vision": "assets/images/homepage/Vision_01.png",
        "home-project-status": "assets/images/homepage/StatusQuo_02.png",
        "map-marker-default": "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        "map-marker-default-retina": "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        "map-marker-red": "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
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

    window.LCNImages = Object.freeze({ paths, urls, apply, configureLeaflet });
})();
