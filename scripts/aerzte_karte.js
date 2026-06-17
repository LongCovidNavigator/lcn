let map;
let radiusCircle;
let doctorMarkerGroup;
let userLocationMarker;
let userLocationIcon;
let currentDoctors = [];

let currentDoctorSortKey = "name";
let currentDoctorSortDirection = "asc";

let currentMinPositiveRatio = 0;
let currentMaxNegativeRatio = 100;

let currentAcceptsGkv = false;
let currentAcceptsPkv = false;

let currentHasWebsite = false;
let currentHasEmail = false;
let currentHasPhone = false;

let currentCityFilter = "";

let currentIncludeNoCoords = false;

let currentLocation = null;

const defaultMapCenter = {
    lat: 51.1657,
    lng: 10.4515,
    label: "Deutschland"
};

document.addEventListener("DOMContentLoaded", function () {
    const mapElement = document.getElementById("doctor-map");

    const mapContent = document.getElementById("doctor-map-content");
	const mapToggleButton = document.getElementById("doctor-map-toggle-button");

    const cardViewButton = document.getElementById("doctor-card-view-button");
    const tableViewButton = document.getElementById("doctor-table-view-button");

    const cardResultsContainer = document.getElementById("doctor-card-results");

    if (!mapElement) {
        console.error("Kartencontainer #doctor-map wurde nicht gefunden.");
        return;
    }

    map = L.map("doctor-map", { zoomControl: false }).setView([defaultMapCenter.lat, defaultMapCenter.lng], 6);

    L.control.zoom({
        position: "topright"
    }).addTo(map);

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

    setupDoctorNavigationPanel();
    setupDoctorSortControl();
    setupDoctorRatingAndFilterControls();
    setupDoctorLocationModeControls();
    updateRadiusInputState();

    if (mapToggleButton && mapContent) {
		mapToggleButton.addEventListener("click", function () {
			const isCollapsed = mapContent.classList.toggle("is-collapsed");

			mapToggleButton.classList.toggle("is-collapsed", isCollapsed);
			mapToggleButton.setAttribute("aria-expanded", isCollapsed ? "false" : "true");

			if (!isCollapsed && map) {
				setTimeout(function () {
					map.invalidateSize();
				}, 50);
			}
		});
	}

    if (cardViewButton && tableViewButton) {
        cardViewButton.addEventListener("click", function () {
            setResultsView("cards");
        });

        tableViewButton.addEventListener("click", function () {
            setResultsView("table");
        });
    }

    if (cardResultsContainer) {
        cardResultsContainer.addEventListener("click", handleDoctorCardVote);
    }

    setResultsView("cards");
    renderDoctorCards([]);
    renderDoctorResultsTable([]);
    applySearchFromControls();
});

function setupDoctorNavigationPanel() {
    const toggleButton = document.getElementById("doctor-navigation-toggle-button");
    const content = document.getElementById("doctor-navigation-content");

    if (!toggleButton || !content) {
        return;
    }

    toggleButton.addEventListener("click", function () {
        const isCollapsed = content.classList.toggle("is-collapsed");

        toggleButton.classList.toggle("is-collapsed", isCollapsed);
        toggleButton.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
}

function setupDoctorSortControl() {
    const sortSelect = document.getElementById("doctor-sort-select");
    const locationInput = document.getElementById("doctor-location-input");

    if (!sortSelect) {
        return;
    }

    updateSortSelectValue();

    sortSelect.addEventListener("change", function () {
        const previousKey = currentDoctorSortKey;
        const previousDirection = currentDoctorSortDirection;

        const settings = parseSortSelectValue(sortSelect.value);

        if (settings.key === "distance" && !currentLocation) {
            currentDoctorSortKey = previousKey;
            currentDoctorSortDirection = previousDirection;
            updateSortSelectValue();

            setLocationMode("radius");

            const statusElement = document.getElementById("doctor-map-status");

            if (statusElement) {
                statusElement.textContent =
                    "Für die Sortierung nach Entfernung bitte zuerst einen Standort eingeben.";
            }

            if (locationInput) {
                setTimeout(function () {
                    locationInput.focus();
                }, 50);
            }

            return;
        }

        currentDoctorSortKey = settings.key;
        currentDoctorSortDirection = settings.direction;

        currentDoctors = sortDoctors(
            currentDoctors,
            currentDoctorSortKey,
            currentDoctorSortDirection
        );

        renderDoctorMarkers(currentDoctors);
        renderDoctorCards(currentDoctors);
        renderDoctorResultsTable(currentDoctors);
    });
}

function setupDoctorRatingAndFilterControls() {
    const applyButton = document.getElementById("doctor-filter-apply-button");
    const resetButton = document.getElementById("doctor-filter-reset-button");

    const minPositiveInput = document.getElementById("doctor-min-positive-input");
    const maxNegativeInput = document.getElementById("doctor-max-negative-input");
    const minPositiveRange = document.getElementById("doctor-min-positive-range");
    const maxNegativeRange = document.getElementById("doctor-max-negative-range");

    const allInputs = [
        minPositiveInput,
        maxNegativeInput,
        minPositiveRange,
        maxNegativeRange,
        document.getElementById("doctor-city-input"),
        document.getElementById("doctor-location-input"),
        document.getElementById("doctor-radius-input")
    ].filter(Boolean);

    syncRangeAndNumber(minPositiveRange, minPositiveInput);
    syncRangeAndNumber(maxNegativeRange, maxNegativeInput);

    allInputs.forEach(function (input) {
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && applyButton) {
                applyButton.click();
            }
        });
    });

    if (applyButton) {
        applyButton.addEventListener("click", function () {
            const filterSettings = getRatingFilterSettingsFromControls();

            if (!filterSettings) {
                return;
            }

            currentMinPositiveRatio = filterSettings.minPositiveRatio;
            currentMaxNegativeRatio = filterSettings.maxNegativeRatio;
            currentAcceptsGkv = filterSettings.acceptsGkv;
            currentAcceptsPkv = filterSettings.acceptsPkv;
            currentHasWebsite = filterSettings.hasWebsite;
            currentHasEmail = filterSettings.hasEmail;
            currentHasPhone = filterSettings.hasPhone;
            currentCityFilter = filterSettings.city;

            applySearchFromControls();
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            resetDoctorNavigationControls();
            applySearchFromControls();
        });
    }
}

function setupDoctorLocationModeControls() {
    const cityModeButton = document.getElementById("doctor-location-mode-city-button");
    const radiusModeButton = document.getElementById("doctor-location-mode-radius-button");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");

    if (cityModeButton) {
        cityModeButton.addEventListener("click", function () {
            setLocationMode("city");
        });
    }

    if (radiusModeButton) {
        radiusModeButton.addEventListener("click", function () {
            setLocationMode("radius");
        });
    }

    if (radiusEnabledInput) {
        radiusEnabledInput.addEventListener("change", function () {
            if (radiusEnabledInput.checked) {
                setLocationMode("radius");
            }

            updateRadiusInputState();
        });
    }

    if (includeNoCoordsInput) {
        includeNoCoordsInput.addEventListener("change", function () {
            currentIncludeNoCoords = includeNoCoordsInput.checked;
        });
    }
}

function syncRangeAndNumber(rangeInput, numberInput) {
    if (!rangeInput || !numberInput) {
        return;
    }

    rangeInput.addEventListener("input", function () {
        numberInput.value = rangeInput.value;
    });

    numberInput.addEventListener("input", function () {
        const value = clampPercentValue(numberInput.value);
        rangeInput.value = value;
    });
}

function clampPercentValue(value) {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        return 0;
    }

    return Math.min(100, Math.max(0, numericValue));
}

function setLocationMode(mode) {
    const cityModeButton = document.getElementById("doctor-location-mode-city-button");
    const radiusModeButton = document.getElementById("doctor-location-mode-radius-button");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const cityInput = document.getElementById("doctor-city-input");

    const useRadius = mode === "radius";

    if (cityModeButton) {
        cityModeButton.classList.toggle("is-active", !useRadius);
        cityModeButton.setAttribute("aria-pressed", useRadius ? "false" : "true");
    }

    if (radiusModeButton) {
        radiusModeButton.classList.toggle("is-active", useRadius);
        radiusModeButton.setAttribute("aria-pressed", useRadius ? "true" : "false");
    }

    if (useRadius && cityInput) {
        cityInput.value = "";
        currentCityFilter = "";
    }

    if (!useRadius && radiusEnabledInput) {
        radiusEnabledInput.checked = false;
        currentLocation = null;
        clearUserLocationMarker();
    }

    updateRadiusInputState();
}

function resetDoctorNavigationControls() {
    const sortSelect = document.getElementById("doctor-sort-select");

    const minPositiveInput = document.getElementById("doctor-min-positive-input");
    const maxNegativeInput = document.getElementById("doctor-max-negative-input");
    const minPositiveRange = document.getElementById("doctor-min-positive-range");
    const maxNegativeRange = document.getElementById("doctor-max-negative-range");

    const acceptsGkvInput = document.getElementById("doctor-accepts-gkv-input");
    const acceptsPkvInput = document.getElementById("doctor-accepts-pkv-input");

    const hasWebsiteInput = document.getElementById("doctor-has-website-input");
    const hasEmailInput = document.getElementById("doctor-has-email-input");
    const hasPhoneInput = document.getElementById("doctor-has-phone-input");

    const cityInput = document.getElementById("doctor-city-input");
    const locationInput = document.getElementById("doctor-location-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    currentDoctorSortKey = "name";
    currentDoctorSortDirection = "asc";
    currentMinPositiveRatio = 0;
    currentMaxNegativeRatio = 100;
    currentAcceptsGkv = false;
    currentAcceptsPkv = false;
    currentHasWebsite = false;
    currentHasEmail = false;
    currentHasPhone = false;
    currentCityFilter = "";
    currentIncludeNoCoords = false;
    currentLocation = null;

    if (sortSelect) {
        sortSelect.value = "name:asc";
    }

    if (minPositiveInput) minPositiveInput.value = "0";
    if (maxNegativeInput) maxNegativeInput.value = "100";
    if (minPositiveRange) minPositiveRange.value = "0";
    if (maxNegativeRange) maxNegativeRange.value = "100";

    if (acceptsGkvInput) acceptsGkvInput.checked = false;
    if (acceptsPkvInput) acceptsPkvInput.checked = false;

    if (hasWebsiteInput) hasWebsiteInput.checked = false;
    if (hasEmailInput) hasEmailInput.checked = false;
    if (hasPhoneInput) hasPhoneInput.checked = false;

    if (cityInput) cityInput.value = "";
    if (locationInput) locationInput.value = "";
    if (radiusEnabledInput) radiusEnabledInput.checked = false;
    if (includeNoCoordsInput) includeNoCoordsInput.checked = false;
    if (radiusInput) radiusInput.value = "100";

    clearUserLocationMarker();
    setLocationMode("city");
    updateRadiusInputState();
}

function parseSortSelectValue(value) {
    const [key, direction] = String(value || "name:asc").split(":");

    return {
        key: key || "name",
        direction: direction || "asc"
    };
}

function updateSortSelectValue() {
    const sortSelect = document.getElementById("doctor-sort-select");

    if (!sortSelect) {
        return;
    }

    sortSelect.value = `${currentDoctorSortKey}:${currentDoctorSortDirection}`;
}

function getRatingFilterSettingsFromControls() {
    const minPositiveInput = document.getElementById("doctor-min-positive-input");
    const maxNegativeInput = document.getElementById("doctor-max-negative-input");
    const acceptsGkvInput = document.getElementById("doctor-accepts-gkv-input");
    const acceptsPkvInput = document.getElementById("doctor-accepts-pkv-input");
    const hasWebsiteInput = document.getElementById("doctor-has-website-input");
    const hasEmailInput = document.getElementById("doctor-has-email-input");
    const hasPhoneInput = document.getElementById("doctor-has-phone-input");
    const cityInput = document.getElementById("doctor-city-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");

    const minPositiveRatio = Number(minPositiveInput ? minPositiveInput.value : 0);
    const maxNegativeRatio = Number(maxNegativeInput ? maxNegativeInput.value : 100);
    const city = cityInput && !cityInput.disabled ? cityInput.value.trim() : "";
    const radiusEnabled = radiusEnabledInput ? radiusEnabledInput.checked : false;

    if (Number.isNaN(minPositiveRatio) || minPositiveRatio < 0 || minPositiveRatio > 100) {
        alert("Bitte bei positiven Erfahrungen einen Wert zwischen 0 und 100 eingeben.");
        return null;
    }

    if (Number.isNaN(maxNegativeRatio) || maxNegativeRatio < 0 || maxNegativeRatio > 100) {
        alert("Bitte bei negativen Erfahrungen einen Wert zwischen 0 und 100 eingeben.");
        return null;
    }

    if (radiusEnabled && city !== "") {
        alert("Bitte entweder Radiusfilter oder Stadtfilter verwenden, nicht beides gleichzeitig.");
        return null;
    }

    return {
        minPositiveRatio,
        maxNegativeRatio,
        acceptsGkv: acceptsGkvInput ? acceptsGkvInput.checked : false,
        acceptsPkv: acceptsPkvInput ? acceptsPkvInput.checked : false,
        hasWebsite: hasWebsiteInput ? hasWebsiteInput.checked : false,
        hasEmail: hasEmailInput ? hasEmailInput.checked : false,
        hasPhone: hasPhoneInput ? hasPhoneInput.checked : false,
        city
    };
}

function getDoctorSortShortLabel() {
    if (currentDoctorSortKey === "distance") {
        return "Entf.";
    }

    if (currentDoctorSortKey === "positive_ratio") {
        return "Pos.%";
    }

    if (currentDoctorSortKey === "negative_ratio") {
        return "Neg.%";
    }

    if (currentDoctorSortKey === "total_votes") {
        return "Bew.";
    }

    return "Name";
}

function getDoctorSortDirectionLabel(sortKey, direction) {
    if (sortKey === "name") {
        return direction === "asc" ? "A–Z" : "Z–A";
    }

    return direction === "asc" ? "↑" : "↓";
}

function sortDoctors(doctors, sortKey, direction) {
    const doctorsCopy = [...(doctors || [])];

    doctorsCopy.sort(function (a, b) {
        const statsA = getDoctorVoteStats(a);
        const statsB = getDoctorVoteStats(b);

        let result = 0;

        if (sortKey === "distance") {
            result = Number(a.distance_km ?? Infinity) - Number(b.distance_km ?? Infinity);
        } else if (sortKey === "positive_ratio") {
            result = statsA.proRatio - statsB.proRatio;
        } else if (sortKey === "negative_ratio") {
            result = statsA.contraRatio - statsB.contraRatio;
        } else if (sortKey === "total_votes") {
            result = statsA.totalVotes - statsB.totalVotes;
        } else {
			result = getDoctorNameSortKey(a).localeCompare(
				getDoctorNameSortKey(b),
				"de",
				{ sensitivity: "base" }
			);

			if (result === 0) {
				result = String(a.dr_display_name || "").localeCompare(
					String(b.dr_display_name || ""),
					"de",
					{ sensitivity: "base" }
				);
			}
		}

        return direction === "desc" ? -result : result;
    });

    return doctorsCopy;
}

function getDoctorNameSortKey(doctor) {
    return String(
        doctor.dr_sort_lastname ||
        doctor.dr_lastname ||
        doctor.dr_org_name ||
        doctor.dr_display_name ||
        ""
    ).trim();
}


function setResultsView(viewName) {
    const cardSection = document.getElementById("doctor-card-results-section");
    const tableSection = document.getElementById("doctor-table-results-section");
    const cardButton = document.getElementById("doctor-card-view-button");
    const tableButton = document.getElementById("doctor-table-view-button");

    const showCards = viewName === "cards";

    if (cardSection) {
        cardSection.classList.toggle("is-hidden", !showCards);
    }

    if (tableSection) {
        tableSection.classList.toggle("is-hidden", showCards);
    }

    if (cardButton) {
        cardButton.classList.toggle("is-active", showCards);
    }

    if (tableButton) {
        tableButton.classList.toggle("is-active", !showCards);
    }

    renderCurrentDoctorResultsView();
}

function getCurrentDoctorResultsView() {
    const tableSection = document.getElementById("doctor-table-results-section");

    if (tableSection && !tableSection.classList.contains("is-hidden")) {
        return "table";
    }

    return "cards";
}

function renderCurrentDoctorResultsView() {
    const currentView = getCurrentDoctorResultsView();
    const cardContainer = document.getElementById("doctor-card-results");
    const tableBody = document.getElementById("doctor-map-results-body");

    if (currentView === "cards") {
        if (tableBody) {
            tableBody.innerHTML = "";
        }

        renderDoctorCards(currentDoctors);
        return;
    }

    if (cardContainer) {
        cardContainer.innerHTML = "";
    }

    renderDoctorResultsTable(currentDoctors);
}

function getCurrentDoctorResultsView() {
    const tableSection = document.getElementById("doctor-table-results-section");

    if (tableSection && !tableSection.classList.contains("is-hidden")) {
        return "table";
    }

    return "cards";
}

function renderCurrentDoctorResultsView() {
    const currentView = getCurrentDoctorResultsView();
    const cardContainer = document.getElementById("doctor-card-results");
    const tableBody = document.getElementById("doctor-map-results-body");

    if (currentView === "cards") {
        if (tableBody) {
            tableBody.innerHTML = "";
        }

        renderDoctorCards(currentDoctors);
        return;
    }

    if (cardContainer) {
        cardContainer.innerHTML = "";
    }

    renderDoctorResultsTable(currentDoctors);
}

function updateRadiusInputState() {
    const locationModeCityButton = document.getElementById("doctor-location-mode-city-button");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");
    const locationInput = document.getElementById("doctor-location-input");
    const cityInput = document.getElementById("doctor-city-input");

    const isCityMode = locationModeCityButton
        ? locationModeCityButton.classList.contains("is-active")
        : true;

    if (cityInput) {
        cityInput.disabled = !isCityMode;
        cityInput.classList.toggle("is-disabled", !isCityMode);
    }

    if (locationInput) {
        locationInput.disabled = isCityMode;
        locationInput.classList.toggle("is-disabled", isCityMode);
    }

    if (radiusEnabledInput) {
        if (isCityMode) {
            radiusEnabledInput.checked = false;
        }

        radiusEnabledInput.disabled = isCityMode;
    }

    const radiusEnabled = radiusEnabledInput ? radiusEnabledInput.checked : false;

    if (includeNoCoordsInput) {
        includeNoCoordsInput.disabled = isCityMode || !radiusEnabled;
    }

    if (radiusInput) {
        radiusInput.disabled = isCityMode || !radiusEnabled;
        radiusInput.classList.toggle("is-disabled", isCityMode || !radiusEnabled);
    }
}

function getSearchSettingsFromControls() {
    const locationModeCityButton = document.getElementById("doctor-location-mode-city-button");
    const locationInput = document.getElementById("doctor-location-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    const isCityMode = locationModeCityButton
        ? locationModeCityButton.classList.contains("is-active")
        : true;

    const locationQuery = !isCityMode && locationInput
        ? locationInput.value.trim()
        : "";

    const radiusEnabled = !isCityMode && radiusEnabledInput
        ? radiusEnabledInput.checked
        : false;

    const includeNoCoords = !isCityMode && includeNoCoordsInput
        ? includeNoCoordsInput.checked
        : false;

    const radiusKm = Number(radiusInput ? radiusInput.value : 100);

    if (radiusEnabled && locationQuery === "") {
        alert("Bitte zuerst einen Standort eingeben, wenn die Radiusbegrenzung aktiv ist.");
        return null;
    }

    if (radiusEnabled && (Number.isNaN(radiusKm) || radiusKm < 1 || radiusKm > 500)) {
        alert("Bitte einen Radius zwischen 1 und 500 km eingeben.");
        return null;
    }

    currentIncludeNoCoords = includeNoCoords;

    return {
        locationQuery,
        radiusEnabled,
        radiusKm,
        includeNoCoords
    };
}

async function applySearchFromControls() {
    const settings = getSearchSettingsFromControls();

    if (!settings) {
        return;
    }

    const statusElement = document.getElementById("doctor-map-status");
    const countElement = document.getElementById("doctor-map-count");
    const locationInput = document.getElementById("doctor-location-input");

    if (statusElement) {
        statusElement.textContent = "Suche läuft ...";
    }

    if (countElement) {
        countElement.textContent = "-";
    }

    clearMapSearchLayers();
    renderDoctorCards([]);
    renderDoctorResultsTable([]);

    try {
        if (settings.locationQuery !== "") {
            const geocodedLocation = await geocodeLocation(settings.locationQuery);

            currentLocation = geocodedLocation;

            if (locationInput) {
                locationInput.value = geocodedLocation.label;
            }

            updateUserLocationMarker();
        } else {
            currentLocation = null;
            clearUserLocationMarker();
        }

        drawRadiusIfNeeded(settings);
        await loadDoctorsFromSearchApi(settings);

    } catch (error) {
        console.error("Fehler bei der Suche:", error);

        if (statusElement) {
            statusElement.textContent = "Die Suche konnte nicht ausgeführt werden. Details stehen in der Konsole.";
        }

        alert("Die Suche konnte nicht ausgeführt werden.");
    }
}

async function geocodeLocation(query) {
    const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
        throw new Error(`HTTP-Fehler beim Geocoding: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.message || "Standort konnte nicht gefunden werden.");
    }

    return {
        lat: Number(data.result.lat),
        lng: Number(data.result.lng),
        label: data.result.formatted || query
    };
}

function clearMapSearchLayers() {
    if (radiusCircle) {
        map.removeLayer(radiusCircle);
        radiusCircle = null;
    }

    if (doctorMarkerGroup) {
        map.removeLayer(doctorMarkerGroup);
        doctorMarkerGroup = null;
    }
}

function clearUserLocationMarker() {
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
}

function updateUserLocationMarker() {
    if (!currentLocation) {
        clearUserLocationMarker();
        return;
    }

    clearUserLocationMarker();

    userLocationMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: userLocationIcon,
        zIndexOffset: 1000
    })
        .addTo(map)
        .bindPopup(`<strong>Standort</strong><br>${escapeHtml(currentLocation.label)}`)
        .openPopup();
}

function drawRadiusIfNeeded(settings) {
    const statusElement = document.getElementById("doctor-map-status");

    if (settings.radiusEnabled && currentLocation) {
        radiusCircle = L.circle([currentLocation.lat, currentLocation.lng], {
            radius: settings.radiusKm * 1000,
            fillOpacity: 0.08,
            weight: 2
        }).addTo(map);

        map.fitBounds(radiusCircle.getBounds(), {
            padding: [30, 30]
        });

        if (statusElement) {
            statusElement.textContent = `Suche Ärzte im Umkreis von ${settings.radiusKm} km. Entfernung: Luftlinie.`;
        }

        return;
    }

    if (currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 6);

        if (statusElement) {
            statusElement.textContent = "Suche alle Ärzte mit Koordinaten. Entfernung wird als Luftlinie zum Standort berechnet.";
        }

        return;
    }

    map.setView([defaultMapCenter.lat, defaultMapCenter.lng], 6);

    if (statusElement) {
        statusElement.textContent = "Suche alle Ärzte. Kein Standort gesetzt.";
    }
}

async function loadDoctorsFromSearchApi(settings) {
    const statusElement = document.getElementById("doctor-map-status");
    const countElement = document.getElementById("doctor-map-count");

    const centerForApi = currentLocation || defaultMapCenter;

    const radiusParam = settings.radiusEnabled
        ? encodeURIComponent(settings.radiusKm)
        : "all";

    const cityParam = currentCityFilter !== ""
        ? `&city=${encodeURIComponent(currentCityFilter)}`
        : "";

    const url =
        `api/doctors_search.php?lat=${encodeURIComponent(centerForApi.lat)}` +
        `&lng=${encodeURIComponent(centerForApi.lng)}` +
        `&radiusKm=${radiusParam}` +
        `&minPositiveRatio=${encodeURIComponent(currentMinPositiveRatio)}` +
        `&maxNegativeRatio=${encodeURIComponent(currentMaxNegativeRatio)}` +
        `&acceptsGkv=${currentAcceptsGkv ? "1" : "0"}` +
        `&acceptsPkv=${currentAcceptsPkv ? "1" : "0"}` +
        `&includeNoCoords=${currentIncludeNoCoords ? "1" : "0"}` +
        `&hasWebsite=${currentHasWebsite ? "1" : "0"}` +
        `&hasEmail=${currentHasEmail ? "1" : "0"}` +
        `&hasPhone=${currentHasPhone ? "1" : "0"}` +
        cityParam;

    const searchResponse = await fetch(url);

    if (!searchResponse.ok) {
        throw new Error(`HTTP-Fehler: ${searchResponse.status}`);
    }

    const data = await searchResponse.json();

    if (!data.ok) {
        throw new Error(data.message || "API-Antwort war nicht erfolgreich.");
    }

    let apiDoctors = data.items || [];

    if (!currentLocation) {
        apiDoctors = apiDoctors.map(function (doctor) {
            return {
                ...doctor,
                distance_km: null,
                distance_meters: null
            };
        });
    }

    if (!currentLocation && currentDoctorSortKey === "distance") {
        currentDoctorSortKey = "name";
        currentDoctorSortDirection = "asc";

        updateSortSelectValue();
    }

    currentDoctors = sortDoctors(
		apiDoctors,
		currentDoctorSortKey,
		currentDoctorSortDirection
	);

	renderDoctorMarkers(currentDoctors);
	renderCurrentDoctorResultsView();

    if (countElement) {
		countElement.textContent = `Gefundene Ärzte: ${currentDoctors.length}`;
		countElement.classList.remove("is-dirty");
	}

    if (statusElement) {
        const filterText = buildActiveFilterStatusText();

        if (settings.radiusEnabled) {
            const noCoordsText = currentIncludeNoCoords
                ? " Einträge ohne Koordinaten werden zusätzlich angezeigt."
                : "";

            statusElement.textContent =
                `${currentDoctors.length} Ärzte im Umkreis von ${settings.radiusKm} km gefunden. Entfernung: Luftlinie.${noCoordsText}${filterText}`;
        } else if (currentLocation) {
            statusElement.textContent =
                `${currentDoctors.length} Ärzte gefunden. Entfernung: Luftlinie zum Standort.${filterText}`;
        } else {
            statusElement.textContent =
                `${currentDoctors.length} Ärzte gefunden. Kein Standort gesetzt.${filterText}`;
        }
    }
}

function buildActiveFilterStatusText() {
    const parts = [];

    if (currentMinPositiveRatio !== 0 || currentMaxNegativeRatio !== 100) {
        parts.push(`positive Erfahrungen ≥ ${currentMinPositiveRatio} %, negative Erfahrungen ≤ ${currentMaxNegativeRatio} %`);
    }

    if (currentAcceptsGkv) {
        parts.push("GKV");
    }

    if (currentAcceptsPkv) {
        parts.push("PKV/Selbstzahler");
    }

    if (currentHasWebsite) {
        parts.push("hat Website");
    }

    if (currentHasEmail) {
        parts.push("hat E-Mail");
    }

    if (currentHasPhone) {
        parts.push("hat Telefonnummer");
    }

    if (currentCityFilter !== "") {
        parts.push(`Ort enthält „${currentCityFilter}“`);
    }

    if (currentIncludeNoCoords) {
        parts.push("Einträge ohne Koordinaten werden zusätzlich angezeigt");
    }

    if (parts.length === 0) {
        return "";
    }

    return ` Filter aktiv: ${parts.join(", ")}.`;
}

async function handleDoctorCardVote(event) {
    const button = event.target.closest(".doctor-card-vote-button");

    if (!button) {
        return;
    }

    const drId = Number(button.getAttribute("data-dr-id"));
    const voteType = button.getAttribute("data-type");

    if (!drId || !voteType) {
        console.error("Vote-Button ohne dr_id oder type.", { drId, voteType });
        return;
    }

    const cardElement = button.closest(".doctor-card");
    const buttonsInCard = cardElement
        ? cardElement.querySelectorAll(".doctor-card-vote-button")
        : [button];

    buttonsInCard.forEach(function (cardButton) {
        cardButton.disabled = true;
        cardButton.classList.add("is-saving");
    });

    try {
        const response = await fetch("api/inc_doctor_votes.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                dr_id: drId,
                type: voteType
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Vote konnte nicht gespeichert werden.");
        }

        await refreshSingleDoctor(drId);

    } catch (error) {
        console.error("Fehler beim Speichern der Ärztebewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden. Details stehen in der Konsole.");

        buttonsInCard.forEach(function (cardButton) {
            cardButton.disabled = false;
            cardButton.classList.remove("is-saving");
        });
    }
}

async function refreshSingleDoctor(drId) {
    const centerForApi = currentLocation || defaultMapCenter;

    const response = await fetch(
        `api/doctors_search.php?lat=${encodeURIComponent(centerForApi.lat)}` +
        `&lng=${encodeURIComponent(centerForApi.lng)}` +
        `&radiusKm=all` +
        `&dr_id=${encodeURIComponent(drId)}`
    );

    if (!response.ok) {
        throw new Error("Einzelner Arzt konnte nicht neu geladen werden.");
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.items) || data.items.length !== 1) {
        throw new Error("Unerwartetes API-Format beim Einzelladen.");
    }

    let updatedDoctor = data.items[0];

    if (!currentLocation) {
        updatedDoctor = {
            ...updatedDoctor,
            distance_km: null,
            distance_meters: null
        };
    }

    const index = currentDoctors.findIndex(function (doctor) {
        return Number(doctor.dr_id) === Number(drId);
    });

    if (index === -1) {
        return;
    }

    currentDoctors[index] = updatedDoctor;
    replaceSingleDoctorDom(updatedDoctor, index);
}

function replaceSingleDoctorDom(doctor, index) {
    if (getCurrentDoctorResultsView() === "cards") {
        const oldCard = document.querySelector(`.doctor-card[data-dr-id="${doctor.dr_id}"]`);

        if (oldCard) {
            oldCard.outerHTML = buildDoctorCardHtml(doctor, index);
        }

        return;
    }

    const oldRow = document.querySelector(`tr[data-dr-id="${doctor.dr_id}"]`);

    if (oldRow) {
        oldRow.outerHTML = buildDoctorTableRowHtml(doctor, index);
    }
}

function doctorPassesCurrentRatingFilter(doctor) {
    const stats = getDoctorVoteStats(doctor);

    return (
        stats.proRatio >= currentMinPositiveRatio &&
        stats.contraRatio <= currentMaxNegativeRatio
    );
}

function recalculateDoctorVoteFields(doctor) {
    const stats = getDoctorVoteStats(doctor);

    return {
        ...doctor,
        total_votes: stats.totalVotes,
        positive_ratio: stats.proRatio,
        neutral_ratio: stats.neutralRatio,
        negative_ratio: stats.contraRatio
    };
}

function renderDoctorMarkers(doctors) {
    if (doctorMarkerGroup) {
        map.removeLayer(doctorMarkerGroup);
        doctorMarkerGroup = null;
    }

    doctorMarkerGroup = L.featureGroup();

    doctors.forEach(function (doctor) {
        if (!doctor.has_coordinates || doctor.loc_lat === null || doctor.loc_lng === null || doctor.loc_lat === "" || doctor.loc_lng === "") {
            return;
        }

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

    const markerLayers = doctorMarkerGroup.getLayers();

    if (markerLayers.length > 0) {
        const bounds = L.latLngBounds([]);

        markerLayers.forEach(function (layer) {
            if (typeof layer.getLatLng === "function") {
                bounds.extend(layer.getLatLng());
            }
        });

        if (userLocationMarker && typeof userLocationMarker.getLatLng === "function") {
            bounds.extend(userLocationMarker.getLatLng());
        }

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [30, 30]
            });
        }
    }
}

function renderDoctorCards(doctors) {
    const cardContainer = document.getElementById("doctor-card-results");

    if (!cardContainer) {
        return;
    }

    if (!doctors || doctors.length === 0) {
        cardContainer.innerHTML = `<p class="doctor-empty-state">Keine Ärztinnen oder Ärzte gefunden.</p>`;
        return;
    }

    cardContainer.innerHTML = doctors.map(function (doctor, index) {
        return buildDoctorCardHtml(doctor, index);
    }).join("");
}

function buildDoctorCardHtml(doctor, index) {
    const name = escapeHtml(doctor.dr_display_name || "Unbekannter Arzt");
    const label = escapeHtml(doctor.loc_label || "");
    const plz = escapeHtml(doctor.loc_plz || "");
    const city = escapeHtml(doctor.loc_city || "");
    const street = escapeHtml(doctor.loc_street || "");
    const houseNumber = escapeHtml(doctor.loc_housenumber || "");

    const distance = getDoctorDistanceText(doctor);

    const website = doctor.loc_website || doctor.dr_website || "";
    const websiteHtml = website
        ? `<a class="doctor-card-link" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Website</a>`
        : `<span class="doctor-card-muted">Keine Website</span>`;

    const gkvText = doctor.dr_accepts_gkv === "yes" ? "GKV" : "";
    const pkvText = doctor.dr_accepts_pkv === "yes" ? "PKV" : "";

    const insuranceTags = [gkvText, pkvText]
        .filter(Boolean)
        .map(value => `<span class="doctor-card-tag">${escapeHtml(value)}</span>`)
        .join("");

    const ratingStats = getDoctorVoteStats(doctor);
    const ratingHtml = buildDoctorCardRatingHtml(doctor);

    return `
        <article class="doctor-card doctor-card-v2" data-dr-id="${doctor.dr_id}">
            <div class="doctor-card-accent"></div>

            <div class="doctor-card-main-header">
                <div class="doctor-card-rank-large" aria-label="Platzierung">
                    <strong>#${index + 1}</strong>
                    <span>(${getDoctorSortShortLabel()})</span>
                </div>

                <div class="doctor-card-title-area">
                    <h3 class="doctor-card-title">${name}</h3>

                    <div class="doctor-card-meta">
                        ${label ? `<span class="doctor-card-tag">🏥 ${label}</span>` : ""}
                        ${insuranceTags || `<span class="doctor-card-tag">Versicherung k. A.</span>`}
                    </div>
                </div>

                ${city ? `<span class="doctor-card-city-badge">⌖ ${city}</span>` : ""}
            </div>

            <div class="doctor-card-content-grid">
                <section class="doctor-card-info-panel doctor-card-location-panel">
                    <h4 class="doctor-card-section-heading">⌖ Standort & Entfernung</h4>

                    <div class="doctor-card-location-block">
                        <div class="doctor-card-mini-label">Adresse</div>
                        <div class="doctor-card-main-text">
                            ${street || houseNumber ? `${street} ${houseNumber}, ` : ""}${plz} ${city}
                        </div>
                    </div>

                    <div class="doctor-card-location-block">
                        <div class="doctor-card-mini-label">Entfernung</div>
                        <div class="doctor-card-main-text">
                            ${distance}
                        </div>
                    </div>
                </section>

                <section class="doctor-card-info-panel doctor-card-rating-panel">
                    <h4 class="doctor-card-section-heading">
                        ⭐ Bewertung
                        <span class="doctor-card-section-count">(${ratingStats.totalVotes} Bewertungen)</span>
                    </h4>
                    ${ratingHtml}
                </section>
            </div>

            <section class="doctor-card-own-rating">
                <div class="doctor-card-own-rating-header">
                    <h4 class="doctor-card-section-heading">✎ Deine Bewertung</h4>
                </div>

                <div class="doctor-card-vote-buttons-placeholder">
                    <button
                        type="button"
                        class="doctor-card-vote-placeholder-button doctor-card-vote-positive doctor-card-vote-button"
                        data-dr-id="${doctor.dr_id}"
                        data-type="pro"
                    >
                        Positiv
                    </button>

                    <button
                        type="button"
                        class="doctor-card-vote-placeholder-button doctor-card-vote-neutral doctor-card-vote-button"
                        data-dr-id="${doctor.dr_id}"
                        data-type="neutral"
                    >
                        Neutral
                    </button>

                    <button
                        type="button"
                        class="doctor-card-vote-placeholder-button doctor-card-vote-negative doctor-card-vote-button"
                        data-dr-id="${doctor.dr_id}"
                        data-type="contra"
                    >
                        Negativ
                    </button>
                </div>
            </section>

            <div class="doctor-card-footer">
                <a class="doctor-card-link" href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">Mehr Details</a>
                ${websiteHtml}
            </div>
        </article>
    `;
}


function buildDoctorCardRatingHtml(doctor) {
    const stats = getDoctorVoteStats(doctor);

    if (stats.totalVotes === 0) {
        return `
            <div class="doctor-card-rating-empty">
                Noch keine Bewertungen vorhanden.
            </div>
        `;
    }

    return `
        <div class="doctor-card-rating-tiles">
            <div class="doctor-card-rating-tile doctor-card-rating-positive">
                <div class="doctor-card-rating-value">${stats.proRatio}%</div>
                <div class="doctor-card-rating-label">Positive Erfahrungen</div>
                <div class="doctor-card-rating-count">${stats.pro} positiv</div>
            </div>

            <div class="doctor-card-rating-tile doctor-card-rating-neutral">
                <div class="doctor-card-rating-value">${stats.neutralRatio}%</div>
                <div class="doctor-card-rating-label">Neutrale Erfahrungen</div>
                <div class="doctor-card-rating-count">${stats.neutral} neutral</div>
            </div>

            <div class="doctor-card-rating-tile doctor-card-rating-negative">
                <div class="doctor-card-rating-value">${stats.contraRatio}%</div>
                <div class="doctor-card-rating-label">Negative Erfahrungen</div>
                <div class="doctor-card-rating-count">${stats.contra} negativ</div>
            </div>
        </div>
    `;
}

function getDoctorVoteStats(doctor) {
    const pro = Number(doctor.pro ?? 0);
    const neutral = Number(doctor.neutral ?? 0);
    const contra = Number(doctor.contra ?? 0);

    const totalVotes = pro + neutral + contra;

    return {
        pro,
        neutral,
        contra,
        totalVotes,
        proRatio: totalVotes > 0 ? Math.round((pro / totalVotes) * 100) : 0,
        neutralRatio: totalVotes > 0 ? Math.round((neutral / totalVotes) * 100) : 0,
        contraRatio: totalVotes > 0 ? Math.round((contra / totalVotes) * 100) : 0
    };
}


function renderDoctorResultsTable(doctors) {
    const tableBody = document.getElementById("doctor-map-results-body");

    updateDoctorTableRankHeader();

    if (!tableBody) {
        return;
    }

    if (!doctors || doctors.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">Keine Ärztinnen oder Ärzte gefunden.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = doctors.map(function (doctor, index) {
        return buildDoctorTableRowHtml(doctor, index);
    }).join("");
}

function buildDoctorTableRowHtml(doctor, index) {
    const name = escapeHtml(doctor.dr_display_name || "Unbekannter Arzt");
    const locationHtml = buildDoctorTableLocationHtml(doctor);
    const experienceHtml = buildDoctorTableExperienceHtml(doctor);
    const insuranceHtml = buildDoctorTableInsuranceHtml(doctor);
    const contactHtml = buildDoctorTableContactHtml(doctor);

    return `
        <tr data-dr-id="${doctor.dr_id}">
            <td class="doctor-table-rank">${index + 1}</td>
            <td class="doctor-table-name"><a href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">${name}</a></td>
            <td>${locationHtml}</td>
            <td>${experienceHtml}</td>
            <td>${insuranceHtml}</td>
            <td>${contactHtml}</td>
        </tr>
    `;
}

function updateDoctorTableRankHeader() {
    const rankHeader = document.getElementById("doctor-table-rank-header");

    if (!rankHeader) {
        return;
    }

    rankHeader.textContent = currentDoctorSortDirection === "desc" ? "▼" : "▲";
}


function buildDoctorTableLocationHtml(doctor) {
    const city = String(doctor.loc_city || "").trim();
    const plz = String(doctor.loc_plz || "").trim();
    const distance = getDoctorDistanceText(doctor, true);
    const hasDistance = distance !== "-";

    let mainText = "";
    let subText = "";
    let mainClass = "doctor-table-main-value";

    if (currentLocation) {
        if (hasDistance) {
            mainText = distance;

            if (city) {
                subText = city;
            } else if (plz) {
                subText = `PLZ: ${plz}`;
            }
        } else if (city) {
            mainText = city;
        } else if (plz) {
            mainText = `PLZ: ${plz}`;
            mainClass = "doctor-table-main-value doctor-table-main-value-muted";
        } else {
            mainText = "—";
        }
    } else {
        if (city) {
            mainText = city;
        } else if (plz) {
            mainText = `PLZ: ${plz}`;
            mainClass = "doctor-table-main-value doctor-table-main-value-muted";
        } else {
            mainText = "—";
        }
    }

    const safeMainText = escapeHtml(mainText);
    const safeSubText = subText ? escapeHtml(subText) : "";

    return `
        <div class="doctor-table-stacked-cell">
            <span class="${mainClass}">${safeMainText}</span>
            ${safeSubText ? `<span class="doctor-table-sub-value">${safeSubText}</span>` : ""}
        </div>
    `;
}

function buildDoctorTableExperienceHtml(doctor) {
    const stats = getDoctorVoteStats(doctor);

    if (stats.totalVotes === 0) {
        return `<span class="doctor-table-muted">Noch keine Bewertungen</span>`;
    }

    return `
        <div class="doctor-table-experience-grid">
            <span class="doctor-table-experience-value doctor-table-badge-positive">+${stats.proRatio}%</span>
            <span class="doctor-table-experience-value doctor-table-badge-neutral">=${stats.neutralRatio}%</span>
            <span class="doctor-table-experience-value doctor-table-badge-negative">-${stats.contraRatio}%</span>
            <span class="doctor-table-vote-count">(n=${stats.totalVotes})</span>
        </div>
    `;
}

function buildDoctorTableInsuranceHtml(doctor) {
    const acceptsGkv = isTruthyFlag(doctor.dr_accepts_gkv);
    const acceptsPkv = isTruthyFlag(doctor.dr_accepts_pkv);

    const badges = [];

    if (acceptsGkv) {
        badges.push(`<span class="doctor-table-badge">GKV</span>`);
    }

    if (acceptsPkv) {
        badges.push(`<span class="doctor-table-badge">PKV</span>`);
    }

    return badges.length > 0
        ? `<div class="doctor-table-badge-row">${badges.join("")}</div>`
        : "";
}


function buildDoctorTableContactHtml(doctor) {
    const website = doctor.loc_website || doctor.dr_website || "";

    const email = getDoctorFirstFieldValue(doctor, [
        "loc_email",
        "dr_email",
        "email",
        "contact_email",
        "dr_contact_email"
    ]);

    const phone = getDoctorFirstFieldValue(doctor, [
        "loc_phone",
        "dr_phone",
        "phone",
        "telephone",
        "telefon",
        "loc_telephone",
        "dr_telephone"
    ]);

    const hasEmail = email || hasDoctorFieldValue(doctor, [
        "has_email",
        "hasEmail"
    ]);

    const hasPhone = phone || hasDoctorFieldValue(doctor, [
        "has_phone",
        "hasPhone"
    ]);

    const badges = [];

    if (website) {
        badges.push(`
            <a
                class="doctor-table-badge doctor-table-badge-link"
                href="${escapeHtml(website)}"
                target="_blank"
                rel="noopener noreferrer"
                title="Website öffnen"
            >Web</a>
        `);
    }

    if (email) {
        badges.push(`
            <a
                class="doctor-table-badge doctor-table-badge-link"
                href="mailto:${escapeHtml(email)}"
                title="${escapeHtml(email)}"
            >Mail</a>
        `);
    } else if (hasEmail) {
        badges.push(`<span class="doctor-table-badge" title="E-Mail vorhanden, aber Adresse nicht im Datensatz">Mail</span>`);
    }

    if (phone) {
        const phoneHref = String(phone).replace(/[^\d+]/g, "");

        badges.push(`
            <a
                class="doctor-table-badge doctor-table-badge-link"
                href="tel:${escapeHtml(phoneHref)}"
                title="${escapeHtml(phone)}"
            >Tel</a>
        `);
    } else if (hasPhone) {
        badges.push(`<span class="doctor-table-badge" title="Telefonnummer vorhanden, aber Nummer nicht im Datensatz">Tel</span>`);
    }

    return badges.length > 0
        ? `<div class="doctor-table-badge-row">${badges.join("")}</div>`
        : "";
}

function getDoctorFirstFieldValue(doctor, fieldNames) {
    for (const fieldName of fieldNames) {
        const value = doctor[fieldName];

        if (value === null || value === undefined) {
            continue;
        }

        const normalizedValue = String(value).trim();

        if (
            normalizedValue !== "" &&
            !["0", "false", "no", "nein", "n"].includes(normalizedValue.toLowerCase())
        ) {
            return normalizedValue;
        }
    }

    return "";
}

function hasDoctorFieldValue(doctor, fieldNames) {
    return fieldNames.some(function (fieldName) {
        return isTruthyFlag(doctor[fieldName]);
    });
}

function isTruthyFlag(value) {
    if (value === true || value === 1) {
        return true;
    }

    if (value === false || value === 0 || value === null || value === undefined) {
        return false;
    }

    const normalizedValue = String(value).trim().toLowerCase();

    return ["1", "true", "yes", "ja", "y", "j"].includes(normalizedValue) ||
        (normalizedValue !== "" && !["0", "false", "no", "nein", "n"].includes(normalizedValue));
}


function buildDoctorPopupHtml(doctor) {
    const name = escapeHtml(doctor.dr_display_name || "Unbekannter Arzt");
    const label = escapeHtml(doctor.loc_label || "");
    const plz = escapeHtml(doctor.loc_plz || "");
    const city = escapeHtml(doctor.loc_city || "");
    const street = escapeHtml(doctor.loc_street || "");
    const houseNumber = escapeHtml(doctor.loc_housenumber || "");
    const stats = getDoctorVoteStats(doctor);

    const distanceText = getDoctorDistanceText(doctor);

    const ratingText = stats.totalVotes > 0
        ? `${stats.proRatio}% positiv · ${stats.totalVotes} Bewertungen`
        : "Noch keine Bewertungen";

    const website = doctor.loc_website || doctor.dr_website || "";
    let websiteHtml = "";
	const detailHtml = `<br><a href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">Mehr Details</a>`;
	
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
            <em>${distanceText}</em><br>
            <span>⭐ ${ratingText}</span>
			${detailHtml}
			${websiteHtml}
        </div>
    `;
}

function getDoctorDistanceText(doctor, shortText = false) {
    if (!currentLocation) {
        return "-";
    }

    if (!doctor.has_coordinates || doctor.distance_km === null || doctor.distance_km === undefined) {
        return "-";
    }

    return shortText
        ? `${escapeHtml(doctor.distance_km)} km`
        : `${escapeHtml(doctor.distance_km)} km Luftlinie`;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ------------------------------
   Hinweis, wenn Filter geändert wurden,
   aber noch nicht neu angewendet sind
------------------------------ */

document.addEventListener("DOMContentLoaded", function () {
    const dirtyFilterElements = [
        document.getElementById("doctor-min-positive-input"),
        document.getElementById("doctor-max-negative-input"),
        document.getElementById("doctor-min-positive-range"),
        document.getElementById("doctor-max-negative-range"),
        document.getElementById("doctor-accepts-gkv-input"),
        document.getElementById("doctor-accepts-pkv-input"),
        document.getElementById("doctor-has-website-input"),
        document.getElementById("doctor-has-email-input"),
        document.getElementById("doctor-has-phone-input"),
        document.getElementById("doctor-city-input"),
        document.getElementById("doctor-location-input"),
        document.getElementById("doctor-radius-enabled-input"),
        document.getElementById("doctor-include-no-coords-input"),
        document.getElementById("doctor-radius-input")
    ].filter(Boolean);

    const cityModeButton = document.getElementById("doctor-location-mode-city-button");
    const radiusModeButton = document.getElementById("doctor-location-mode-radius-button");

    dirtyFilterElements.forEach(function (element) {
        element.addEventListener("input", markDoctorFiltersDirty);
        element.addEventListener("change", markDoctorFiltersDirty);
    });

    if (cityModeButton) {
        cityModeButton.addEventListener("click", markDoctorFiltersDirty);
    }

    if (radiusModeButton) {
        radiusModeButton.addEventListener("click", markDoctorFiltersDirty);
    }
});

function markDoctorFiltersDirty() {
    const countElement = document.getElementById("doctor-map-count");

    if (!countElement) {
        return;
    }

    countElement.textContent = "Bitte Filter erneut anwenden";
}