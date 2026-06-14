let map;
let radiusCircle;
let doctorMarkerGroup;
let userLocationMarker;
let userLocationIcon;

let currentLocation = {
    lat: 50.9209,
    lng: 6.9603,
    label: "50677 Köln"
};

document.addEventListener("DOMContentLoaded", function () {
    const mapElement = document.getElementById("doctor-map");

    const locationInput = document.getElementById("doctor-location-input");
    const locationButton = document.getElementById("doctor-location-button");
    const locationFilterButton = document.getElementById("doctor-location-filter-button");
    const locationFilterMenu = document.getElementById("doctor-location-filter-menu");

    const radiusInput = document.getElementById("doctor-radius-input");
    const radiusButton = document.getElementById("doctor-radius-button");
    const radiusFilterButton = document.getElementById("doctor-radius-filter-button");
    const radiusFilterMenu = document.getElementById("doctor-radius-filter-menu");

    if (!mapElement) {
        console.error("Kartencontainer #doctor-map wurde nicht gefunden.");
        return;
    }

    map = L.map("doctor-map", { zoomControl: false }).setView([currentLocation.lat, currentLocation.lng], 8);
    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere"
    }).addTo(map);

    userLocationIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    updateUserLocationMarker();

    locationFilterButton.addEventListener("click", function (event) {
        event.stopPropagation();
        locationFilterMenu.classList.toggle("show");
        radiusFilterMenu.classList.remove("show");
    });

    radiusFilterButton.addEventListener("click", function (event) {
        event.stopPropagation();
        radiusFilterMenu.classList.toggle("show");
        locationFilterMenu.classList.remove("show");
    });

    document.addEventListener("click", function (event) {
        if (
            !locationFilterButton.contains(event.target) &&
            !locationFilterMenu.contains(event.target) &&
            !radiusFilterButton.contains(event.target) &&
            !radiusFilterMenu.contains(event.target)
        ) {
            locationFilterMenu.classList.remove("show");
            radiusFilterMenu.classList.remove("show");
        }
    });

    locationButton.addEventListener("click", function () {
        searchLocationAndReload();
        locationFilterMenu.classList.remove("show");
    });

    locationInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            searchLocationAndReload();
            locationFilterMenu.classList.remove("show");
        }
    });

    radiusButton.addEventListener("click", function () {
        applyRadiusFilter();
        radiusFilterMenu.classList.remove("show");
    });

    radiusInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            applyRadiusFilter();
            radiusFilterMenu.classList.remove("show");
        }
    });

    applyRadiusFilter();
});

async function searchLocationAndReload() {
    const locationInput = document.getElementById("doctor-location-input");
    const statusElement = document.getElementById("doctor-map-status");
    const countElement = document.getElementById("doctor-map-count");

    const query = locationInput.value.trim();

    if (query === "") {
        alert("Bitte PLZ, Ort oder Adresse eingeben.");
        return;
    }

    if (statusElement) {
        statusElement.textContent = `Suche Standort: ${query} ...`;
    }

    if (countElement) {
        countElement.textContent = "-";
    }

    try {
        const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
            throw new Error(`HTTP-Fehler: ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.message || "Standort konnte nicht gefunden werden.");
        }

        currentLocation = {
            lat: Number(data.result.lat),
            lng: Number(data.result.lng),
            label: data.result.formatted || query
        };

        locationInput.value = data.result.formatted || query;

        updateUserLocationMarker();
        applyRadiusFilter();

    } catch (error) {
        console.error("Fehler bei der Standortsuche:", error);

        if (statusElement) {
            statusElement.textContent = "Standort konnte nicht gefunden werden. Details stehen in der Konsole.";
        }

        alert("Standort konnte nicht gefunden werden.");
    }
}

function updateUserLocationMarker() {
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }

    userLocationMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: userLocationIcon,
        zIndexOffset: 1000
    })
        .addTo(map)
        .bindPopup(`<strong>Standort</strong><br>${escapeHtml(currentLocation.label)}`)
        .openPopup();
}

function applyRadiusFilter() {
    const radiusInput = document.getElementById("doctor-radius-input");
    const statusElement = document.getElementById("doctor-map-status");

    const radiusKm = Number(radiusInput.value);

    if (Number.isNaN(radiusKm) || radiusKm < 1 || radiusKm > 500) {
        alert("Bitte einen Radius zwischen 1 und 500 km eingeben.");
        return;
    }

    if (radiusCircle) {
        map.removeLayer(radiusCircle);
    }

    if (doctorMarkerGroup) {
        map.removeLayer(doctorMarkerGroup);
    }

    radiusCircle = L.circle([currentLocation.lat, currentLocation.lng], {
        radius: radiusKm * 1000,
        fillOpacity: 0.08,
        weight: 2
    }).addTo(map);

    map.fitBounds(radiusCircle.getBounds(), {
        padding: [30, 30]
    });

    if (statusElement) {
        statusElement.textContent = `Suche Ärzte im Umkreis von ${radiusKm} km. Entfernung: Luftlinie.`;
    }

    loadDoctorsFromSearchApi(radiusKm);
}

async function loadDoctorsFromSearchApi(radiusKm) {
    const statusElement = document.getElementById("doctor-map-status");
    const countElement = document.getElementById("doctor-map-count");

    const url =
        `api/doctors_search.php?lat=${encodeURIComponent(currentLocation.lat)}` +
        `&lng=${encodeURIComponent(currentLocation.lng)}` +
        `&radiusKm=${encodeURIComponent(radiusKm)}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP-Fehler: ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.message || "API-Antwort war nicht erfolgreich.");
        }

        console.log("Treffer aus doctors_search.php:", data.items);
        console.log(`Anzahl geladener Ärzte im Radius: ${data.items.length}`);

        renderDoctorMarkers(data.items);

        if (countElement) {
            countElement.textContent = `${data.items.length} Ärzte`;
        }

        if (statusElement) {
            statusElement.textContent =
                `${data.items.length} Ärzte im Umkreis von ${radiusKm} km gefunden. Entfernung: Luftlinie.`;
        }

    } catch (error) {
        console.error("Fehler beim Laden der Ärzte:", error);

        if (countElement) {
            countElement.textContent = "-";
        }

        if (statusElement) {
            statusElement.textContent = "Die Ärzte konnten nicht geladen werden. Details stehen in der Konsole.";
        }

        alert("Die Ärzte konnten nicht geladen werden. Details stehen in der Konsole.");
    }
}

function renderDoctorMarkers(doctors) {
    doctorMarkerGroup = L.featureGroup();

    doctors.forEach(function (doctor) {
        const lat = Number(doctor.loc_lat);
        const lng = Number(doctor.loc_lng);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return;
        }

        const marker = L.marker([lat, lng])
            .bindPopup(buildDoctorPopupHtml(doctor));

        doctorMarkerGroup.addLayer(marker);
    });

    doctorMarkerGroup.addTo(map);
}

function buildDoctorPopupHtml(doctor) {
    const name = escapeHtml(doctor.dr_display_name || "Unbekannter Arzt");
    const label = escapeHtml(doctor.loc_label || "");
    const plz = escapeHtml(doctor.loc_plz || "");
    const city = escapeHtml(doctor.loc_city || "");
    const street = escapeHtml(doctor.loc_street || "");
    const houseNumber = escapeHtml(doctor.loc_housenumber || "");

    const distanceText = doctor.distance_km !== null && doctor.distance_km !== undefined
        ? `${doctor.distance_km} km Luftlinie`
        : "Entfernung unbekannt";

    const website = doctor.loc_website || doctor.dr_website || "";
    let websiteHtml = "";

    if (website) {
        const safeWebsite = escapeHtml(website);
        websiteHtml = `<br><a href="${safeWebsite}" target="_blank" rel="noopener noreferrer">Website öffnen</a>`;
    }

    return `
        <div class="doctor-map-popup">
            <strong>${name}</strong><br>
            ${label ? `${label}<br>` : ""}
            ${street || houseNumber ? `${street} ${houseNumber}<br>` : ""}
            ${plz} ${city}<br>
            <em>${distanceText}</em>
            ${websiteHtml}
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}