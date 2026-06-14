let doctorRatingMap = null;

document.addEventListener("DOMContentLoaded", function () {
    const mapElement = document.getElementById("doctor-map");
    const mapSection = document.getElementById("doctor-map-section");
    const toggleButton = document.getElementById("doctor-map-toggle-button");

    if (!mapElement) {
        console.error("Kartencontainer #doctor-map wurde nicht gefunden.");
        return;
    }

    // Erstmal nur plain: Deutschlandkarte
    const germanyCenter = [51.1657, 10.4515];

    doctorRatingMap = L.map("doctor-map", {
        zoomControl: false
    }).setView(germanyCenter, 6);

    L.control.zoom({
        position: "topright"
    }).addTo(doctorRatingMap);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere"
    }).addTo(doctorRatingMap);

    if (mapSection && toggleButton) {
        toggleButton.addEventListener("click", function () {
            const isHidden = mapSection.classList.toggle("is-hidden");

            toggleButton.textContent = isHidden
                ? "Karte anzeigen"
                : "Karte ausblenden";

            if (!isHidden && doctorRatingMap) {
                setTimeout(function () {
                    doctorRatingMap.invalidateSize();
                }, 50);
            }
        });
    }
});