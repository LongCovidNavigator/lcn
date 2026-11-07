let map;
let radiusCircle = null;
let doctorMarkerGroup = null;
let userLocationMarker = null;
let userLocationIcon = null;

let currentDoctors = [];
const doctorTableBatchSize = 50;
let visibleDoctorTableCount = doctorTableBatchSize;
const doctorCardBatchSize = 30;
let visibleDoctorCardCount = doctorCardBatchSize;
let selectedDoctorsForCompare = [];
let showOnlyCompareSelection = false;

let currentDoctorSortKey = "distance";
let currentDoctorSortDirection = "asc";
let currentDoctorTableSortKey = null;
let currentDoctorTableSortDirection = "asc";

let currentMinPositiveRatio = 0;
let currentMinHealingRatio = 0;
let currentMaxNegativeRatio = 100;
let currentAcceptsGkv = false;
let currentAcceptsPkv = false;
let currentHasWebsite = false;
let currentHasEmail = false;
let currentHasPhone = false;
let currentCityFilter = "";
let currentDoctorSearchTerm = "";
let currentMinTreatmentCount = 0;
let currentMinCategoryCount = 0;
let currentSpecialtyTermId = 0;
let currentSpecializationTermId = 0;
let currentQualificationTermId = 0;
let currentIncludeNoCoords = false;
let currentLocation = null;
let doctorSearchDebounceTimer = null;
let doctorLocationSuggestionTimer = null;
let doctorLocationSuggestionController = null;
let doctorLocationSuggestions = [];

const doctorLocationStorageKey = "lcn_doctor_location_preference";
const sharedLocationStorageKey = "lcn_shared_location_preference";
const sharedLocationClearedStorageKey = "lcn_shared_location_cleared";

const defaultMapCenter = {
    lat: 51.1657,
    lng: 10.4515,
    label: "Deutschland"
};

document.addEventListener("DOMContentLoaded", function () {
    const mapElement = document.getElementById("doctor-map");

    if (!mapElement) {
        console.error("Kartencontainer #doctor-map wurde nicht gefunden.");
        return;
    }

    map = L.map("doctor-map", {
		zoomControl: false,
		scrollWheelZoom: false
	}).setView([defaultMapCenter.lat, defaultMapCenter.lng], 6);

    // Ordinary wheel gestures always scroll the page, even after clicking a marker.
    // Capture runs before Leaflet's wheel listener, including the first gesture.
    mapElement.addEventListener("wheel", function (event) {
        if (event.ctrlKey || event.metaKey) {
            map.scrollWheelZoom.enable();
        } else {
            map.scrollWheelZoom.disable();
        }
    }, { capture: true, passive: true });

    mapElement.addEventListener("mouseleave", function () {
        map.scrollWheelZoom.disable();
    });

    L.control.zoom({
        position: "topright"
    }).addTo(map);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere'
    }).addTo(map);

    userLocationIcon = L.icon({
        iconUrl: window.LCNImages.urls["map-marker-red"],
        shadowUrl: window.LCNImages.urls["map-marker-shadow"],
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    setupDoctorNavigationPanel();
    setupDoctorMapPanel();
    setupDoctorViewSwitch();
    setupDoctorSortControl();
    setupDoctorTableSortControls();
    setupDoctorRatingAndFilterControls();
    setupDoctorLocationModeControls();
    setupDoctorCompareControls();
    setupDoctorResultEventDelegation();
    setupDoctorDirtyFilterHint();
    setupDoctorAutoApplyControls();

    restoreDoctorLocationPreference();
    updateRadiusInputState();
    setResultsView(getSavedDoctorResultsView());
    doctorMobileResults.addEventListener("change", () => setResultsView(getSavedDoctorResultsView()));
    renderDoctorCards([]);
    renderDoctorResultsTable([]);
    applySearchFromControls(false, false);
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

function setupDoctorMapPanel() {
    const mapContent = document.getElementById("doctor-map-content");
    const mapToggleButton = document.getElementById("doctor-map-toggle-button");

    if (!mapToggleButton || !mapContent) {
        return;
    }

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

function setupDoctorViewSwitch() {
    const cardViewButton = document.getElementById("doctor-card-view-button");
    const tableViewButton = document.getElementById("doctor-table-view-button");

    if (cardViewButton) {
        cardViewButton.addEventListener("click", function () {
            setResultsView("cards", true);
        });
    }

    if (tableViewButton) {
        tableViewButton.addEventListener("click", function () {
            setResultsView("table", true);
        });
    }
}

function setupDoctorSortControl() {
    const sortSelects = [
        document.getElementById("doctor-sort-select"),
        document.getElementById("doctor-results-sort-select")
    ].filter(Boolean);
    const locationInput = document.getElementById("doctor-location-input");

    if (sortSelects.length === 0) {
        return;
    }

    updateSortSelectValue();

    sortSelects.forEach(function (sortSelect) {
        sortSelect.addEventListener("change", function () {
        const previousKey = currentDoctorSortKey;
        const previousDirection = currentDoctorSortDirection;
        const settings = parseSortSelectValue(sortSelect.value);

        if (settings.key === "distance" && !currentLocation) {
            currentDoctorSortKey = previousKey;
            currentDoctorSortDirection = previousDirection;
            updateSortSelectValue();
            setLocationMode("radius");
            setMapStatus("Für die Sortierung nach Entfernung bitte zuerst einen Standort eingeben.");

            if (locationInput) {
                setTimeout(function () {
                    locationInput.focus();
                }, 50);
            }

            return;
        }

            currentDoctorSortKey = settings.key;
            currentDoctorSortDirection = settings.direction;
            visibleDoctorTableCount = doctorTableBatchSize;
            currentDoctorTableSortKey = null;
            currentDoctorTableSortDirection = "asc";
            updateSortSelectValue();
            currentDoctors = sortDoctors(currentDoctors, currentDoctorSortKey, currentDoctorSortDirection);
        refreshDoctorDisplay();
        });
    });
    document.getElementById("doctor-community-status-select")?.addEventListener("change", function(){ applyDoctorFiltersFromControls(); });
}

function setupDoctorTableSortControls() {
    const table = document.querySelector(".doctor-map-results-table");

    if (!table) {
        return;
    }

    table.parentElement.addEventListener("click", function (event) {
        const sortButton = event.target.closest("[data-table-sort-key]");

        if (!sortButton) {
            return;
        }

        const sortKey = sortButton.dataset.tableSortKey;
        if (sortKey === "experience") {
            let hint = document.getElementById("doctor-experience-sort-hint");
            if (!hint) {
                hint = document.createElement("p");
                hint.id = "doctor-experience-sort-hint";
                hint.setAttribute("role", "status");
                hint.textContent = "Bitte klicke auf den Wert, nach dem du sortieren möchtest: Heilung, Verbesserung, Neutral, Verschlechterung oder N (Anzahl der Angaben).";
                table.parentElement.insertBefore(hint, table);
            }
            return;
        }

        visibleDoctorTableCount = doctorTableBatchSize;
        if (currentDoctorTableSortKey === sortKey) {
            currentDoctorTableSortDirection = currentDoctorTableSortDirection === "asc" ? "desc" : "asc";
        } else {
            currentDoctorTableSortKey = sortKey;
            currentDoctorTableSortDirection = ["contact", "treatment_count", "category_count", "healing_ratio", "positive_ratio", "neutral_ratio", "negative_ratio", "total_votes"].includes(sortKey)
                ? "desc"
                : "asc";
        }

        renderDoctorResultsTable(getDisplayedDoctors());
    });
}

function setupDoctorRatingAndFilterControls() {
    const resetButton = document.getElementById("doctor-filter-reset-button");

    const minPositiveInput = document.getElementById("doctor-min-positive-input");
    const minHealingInput = document.getElementById("doctor-min-healing-input");
    const maxNegativeInput = document.getElementById("doctor-max-negative-input");
    const minPositiveRange = document.getElementById("doctor-min-positive-range");
    const minHealingRange = document.getElementById("doctor-min-healing-range");
    const maxNegativeRange = document.getElementById("doctor-max-negative-range");
    const searchInput = document.getElementById("doctor-search-input");
    const specialtySelect = document.getElementById("doctor-specialty-select");

    syncRangeAndNumber(minPositiveRange, minPositiveInput);
    syncRangeAndNumber(minHealingRange, minHealingInput);
    syncRangeAndNumber(maxNegativeRange, maxNegativeInput);

    [
        minPositiveInput,
        minHealingInput,
        maxNegativeInput,
        minPositiveRange,
        minHealingRange,
        maxNegativeRange,
        searchInput,
        document.getElementById("doctor-location-input"),
        document.getElementById("doctor-radius-input")
    ].filter(Boolean).forEach(function (input) {
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                applyDoctorFiltersFromControls();
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            currentDoctorSearchTerm = searchInput.value.trim();
            if (showOnlyCompareSelection) {
                showOnlyCompareSelection = false;
                refreshDoctorDisplay();
            }
            scheduleDoctorLiveSearch();
        });
    }

    if (specialtySelect) {
        specialtySelect.addEventListener("change", function () {
            currentSpecialtyTermId = Number(specialtySelect.value || 0);
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            clearDoctorSearchDebounce();
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
    const locationInput = document.getElementById("doctor-location-input");
    const clearButton = document.getElementById("doctor-location-clear-button");

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
            if (radiusEnabledInput.checked) setLocationMode("radius");
            updateRadiusInputState();
        });
    }

    if (includeNoCoordsInput) {
        includeNoCoordsInput.addEventListener("change", function () {
            currentIncludeNoCoords = includeNoCoordsInput.checked;
        });
    }

    if (locationInput) {
        locationInput.addEventListener("input", function () {
            updateDoctorLocationClearButton();
            scheduleDoctorLocationSuggestions();
        });

        locationInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") hideDoctorLocationSuggestions();
            if (event.key === "Escape") hideDoctorLocationSuggestions();
        });
    }

    const suggestions = document.getElementById("doctor-location-suggestions");
    if (suggestions) {
        suggestions.addEventListener("click", function (event) {
            const button = event.target.closest("[data-location-suggestion-index]");
            if (!button) return;
            const suggestion = doctorLocationSuggestions[Number(button.dataset.locationSuggestionIndex)];
            if (!suggestion || !locationInput) return;
            locationInput.value = suggestion.formatted;
            hideDoctorLocationSuggestions();
            applyDoctorFiltersFromControls();
        });
    }

    if (clearButton) {
        clearButton.addEventListener("click", function () {
            removeDoctorLocationPreference(true);
        });
    }
}

function applyDoctorFiltersFromControls() {
    clearDoctorSearchDebounce();

    const filterSettings = getRatingFilterSettingsFromControls();

    if (!filterSettings) {
        return;
    }

    currentMinPositiveRatio = filterSettings.minPositiveRatio;
    currentMinHealingRatio = filterSettings.minHealingRatio;
    currentMaxNegativeRatio = filterSettings.maxNegativeRatio;
    currentAcceptsGkv = filterSettings.acceptsGkv;
    currentAcceptsPkv = filterSettings.acceptsPkv;
    currentHasWebsite = filterSettings.hasWebsite;
    currentHasEmail = filterSettings.hasEmail;
    currentHasPhone = filterSettings.hasPhone;
    currentCityFilter = filterSettings.city;
    currentDoctorSearchTerm = filterSettings.searchTerm;
    currentSpecialtyTermId = filterSettings.specialtyTermId;
    showOnlyCompareSelection = false;

    // Publish the location only after geocoding, so other pages never receive
    // a new label paired with the previous coordinates.
    renderDoctorCompareSelection();
    applySearchFromControls(true);
}

function setupDoctorCompareControls() {
    const compareSelection = document.getElementById("doctor-compare-selection");
    const hitViewButton = document.getElementById("doctor-results-hit-view-button");
    const compareViewButton = document.getElementById("doctor-compare-show-button");
    const clearButton = document.getElementById("doctor-compare-clear-button");

    if (compareSelection) {
        compareSelection.addEventListener("click", function (event) {
            const removeButton = event.target.closest(".doctor-compare-chip-remove");

            if (removeButton) {
                removeDoctorFromCompareSelection(Number(removeButton.getAttribute("data-dr-id")));
            }
        });
    }

    if (hitViewButton) {
        hitViewButton.addEventListener("click", function () {
            showOnlyCompareSelection = false;
            refreshDoctorDisplay();
        });
    }

    if (compareViewButton) {
        compareViewButton.addEventListener("click", function () {
            if (selectedDoctorsForCompare.length === 0) {
                return;
            }

            showOnlyCompareSelection = true;
            refreshDoctorDisplay();
        });
    }

    if (clearButton) {
        clearButton.addEventListener("click", function () {
            selectedDoctorsForCompare = [];
            showOnlyCompareSelection = false;
            refreshDoctorDisplay();
        });
    }

    renderDoctorCompareSelection();
}

function setupDoctorResultEventDelegation() {
    document.getElementById("doctor-table-load-more-button")?.addEventListener("click", function () {
        visibleDoctorTableCount += doctorTableBatchSize;
        renderDoctorResultsTable(getDisplayedDoctors(), true);
    });
    const cardResultsContainer = document.getElementById("doctor-card-results");
    const tableResultsBody = document.getElementById("doctor-map-results-body");
    const loadMoreButton = document.getElementById("doctor-cards-load-more-button");

    if (cardResultsContainer) {
        cardResultsContainer.addEventListener("click", handleDoctorCompareClick);
        cardResultsContainer.addEventListener("click", handleDoctorCardVote);
    }

    if (tableResultsBody) {
        const tableContent = tableResultsBody.closest(".lcn-search-table-content");
        tableContent.addEventListener("click", handleDoctorCompareClick);
        tableContent.addEventListener("click", handleDoctorCardVote);
    }

    if (loadMoreButton) {
        loadMoreButton.addEventListener("click", function () {
            visibleDoctorCardCount += doctorCardBatchSize;
            renderDoctorCards(getDisplayedDoctors());
        });
    }
}

function setupDoctorDirtyFilterHint() {
    const dirtyFilterElements = [
        document.getElementById("doctor-min-positive-input"),
        document.getElementById("doctor-min-healing-input"),
        document.getElementById("doctor-max-negative-input"),
        document.getElementById("doctor-min-positive-range"),
        document.getElementById("doctor-min-healing-range"),
        document.getElementById("doctor-max-negative-range"),
        document.getElementById("doctor-accepts-gkv-input"),
        document.getElementById("doctor-accepts-pkv-input"),
        document.getElementById("doctor-has-website-input"),
		document.getElementById("doctor-has-email-input"),
		document.getElementById("doctor-has-phone-input"),
		document.getElementById("doctor-specialty-select"),
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
}

function setupDoctorAutoApplyControls() {
    const immediateElements = [
        document.getElementById("doctor-provider-type-select"),
        document.getElementById("doctor-specialty-select"),
        document.getElementById("doctor-specialization-select"),
        document.getElementById("doctor-qualification-select"),
        document.getElementById("doctor-accepts-gkv-input"),
        document.getElementById("doctor-accepts-pkv-input"),
        document.getElementById("doctor-has-website-input"),
        document.getElementById("doctor-has-email-input"),
        document.getElementById("doctor-has-phone-input"),
        document.getElementById("doctor-radius-enabled-input"),
        document.getElementById("doctor-include-no-coords-input"),
        document.getElementById("doctor-location-mode-city-button"),
        document.getElementById("doctor-location-mode-radius-button")
    ].filter(Boolean);

    const debouncedElements = [
        document.getElementById("doctor-min-treatments-input"),
        document.getElementById("doctor-min-categories-input"),
        document.getElementById("doctor-min-positive-input"),
        document.getElementById("doctor-min-healing-input"),
        document.getElementById("doctor-max-negative-input"),
        document.getElementById("doctor-min-positive-range"),
        document.getElementById("doctor-min-healing-range"),
        document.getElementById("doctor-max-negative-range"),
        document.getElementById("doctor-radius-input")
    ].filter(Boolean);

    immediateElements.forEach(function (element) {
        const eventName = element.tagName === "BUTTON" ? "click" : "change";

        element.addEventListener(eventName, function () {
            scheduleDoctorAutoApply(50);
        });
    });

    debouncedElements.forEach(function (element) {
        element.addEventListener("input", function () {
            scheduleDoctorAutoApply(350);
        });
    });

}

function scheduleDoctorLocationSuggestions() {
    clearTimeout(doctorLocationSuggestionTimer);
    const input = document.getElementById("doctor-location-input");
    const query = input ? input.value.trim() : "";

    if (query.length < 3) {
        hideDoctorLocationSuggestions();
        return;
    }

    doctorLocationSuggestionTimer = setTimeout(function () {
        loadDoctorLocationSuggestions(query);
    }, 300);
}

async function loadDoctorLocationSuggestions(query) {
    if (doctorLocationSuggestionController) doctorLocationSuggestionController.abort();
    doctorLocationSuggestionController = new AbortController();

    try {
        const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`, {
            signal: doctorLocationSuggestionController.signal
        });
        if (!response.ok) throw new Error("Standortvorschläge konnten nicht geladen werden.");
        const data = await response.json();
        doctorLocationSuggestions = Array.isArray(data.results) ? data.results : [];
        renderDoctorLocationSuggestions();
    } catch (error) {
        if (error.name !== "AbortError") hideDoctorLocationSuggestions();
    }
}

function renderDoctorLocationSuggestions() {
    const box = document.getElementById("doctor-location-suggestions");
    if (!box) return;
    box.innerHTML = doctorLocationSuggestions.map(function (suggestion, index) {
        return `<button class="location-suggestion-button" type="button" role="option" data-location-suggestion-index="${index}">${escapeHtml(suggestion.formatted || "")}</button>`;
    }).join("");
    box.classList.toggle("is-hidden", doctorLocationSuggestions.length === 0);
}

function hideDoctorLocationSuggestions() {
    const box = document.getElementById("doctor-location-suggestions");
    if (box) box.classList.add("is-hidden");
}

function scheduleDoctorAutoApply(delay = 350) {
    const countElement = document.getElementById("doctor-map-count");

    clearDoctorSearchDebounce();

    if (countElement) {
        countElement.textContent = "Filter werden angewendet …";
    }

    doctorSearchDebounceTimer = setTimeout(function () {
        doctorSearchDebounceTimer = null;
        applyDoctorFiltersFromControls();
    }, delay);
}

function scheduleDoctorLiveSearch() {
    const countElement = document.getElementById("doctor-map-count");

    clearDoctorSearchDebounce();

    if (countElement) {
        countElement.textContent = "Suche läuft gleich …";
        countElement.classList.remove("is-dirty");
    }

    doctorSearchDebounceTimer = setTimeout(function () {
        doctorSearchDebounceTimer = null;
        applyDoctorFiltersFromControls();
    }, 350);
}

function clearDoctorSearchDebounce() {
    if (doctorSearchDebounceTimer) {
        clearTimeout(doctorSearchDebounceTimer);
        doctorSearchDebounceTimer = null;
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
        numberInput.value = String(value);
        rangeInput.value = String(value);
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

    const useRadius = mode === "radius";

    if (cityModeButton) {
        cityModeButton.classList.toggle("is-active", !useRadius);
        cityModeButton.setAttribute("aria-pressed", useRadius ? "false" : "true");
    }

    if (radiusModeButton) {
        radiusModeButton.classList.toggle("is-active", useRadius);
        radiusModeButton.setAttribute("aria-pressed", useRadius ? "true" : "false");
    }

    if (useRadius) {
        currentCityFilter = "";
    }

    if (!useRadius) {
        if (radiusEnabledInput) radiusEnabledInput.checked = false;
    }

    updateRadiusInputState();
    updateUserLocationMarker();
}

function updateRadiusInputState() {
    const locationModeCityButton = document.getElementById("doctor-location-mode-city-button");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");
    const locationInput = document.getElementById("doctor-location-input");

    const isCityMode = locationModeCityButton
        ? locationModeCityButton.classList.contains("is-active")
        : true;

    if (locationInput) {
        locationInput.disabled = false;
        locationInput.classList.remove("is-disabled");
        locationInput.placeholder = isCityMode
            ? "z. B. Musterstadt"
            : "z. B. Musterstadt";
    }

    if (radiusEnabledInput) radiusEnabledInput.disabled = isCityMode;

    const radiusEnabled = !isCityMode && Boolean(radiusEnabledInput?.checked);

    if (includeNoCoordsInput) includeNoCoordsInput.disabled = !radiusEnabled;

    if (radiusInput) {
        radiusInput.disabled = !radiusEnabled;
        radiusInput.classList.toggle("is-disabled", !radiusEnabled);
    }
}

function saveDoctorLocationPreference() {
    const locationInput = document.getElementById("doctor-location-input");
    const cityModeButton = document.getElementById("doctor-location-mode-city-button");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");
    const locationValue = locationInput ? locationInput.value.trim() : "";

    if (locationValue === "") {
        try {
            localStorage.removeItem(doctorLocationStorageKey);
            localStorage.removeItem("lcn_treatment_location_preference");
            localStorage.removeItem(sharedLocationStorageKey);
            localStorage.setItem(sharedLocationClearedStorageKey, "1");
        } catch (error) {
            console.warn("Der gespeicherte Standort konnte nicht entfernt werden.", error);
        }

        updateDoctorLocationClearButton();
        return;
    }

    const preference = {
        location: locationValue,
        mode: cityModeButton?.classList.contains("is-active") ? "city" : "radius",
        radiusEnabled: Boolean(radiusEnabledInput?.checked),
        radiusKm: radiusInput ? radiusInput.value : "100",
        includeNoCoords: Boolean(includeNoCoordsInput?.checked)
    };

    try {
        localStorage.setItem(doctorLocationStorageKey, JSON.stringify(preference));
        localStorage.setItem(sharedLocationStorageKey, JSON.stringify({
            location: locationValue,
            label: currentLocation?.label || locationValue,
            city: currentLocation?.city || currentCityFilter || "",
            lat: Number.isFinite(currentLocation?.lat) ? currentLocation.lat : null,
            lng: Number.isFinite(currentLocation?.lng) ? currentLocation.lng : null
        }));
        localStorage.removeItem(sharedLocationClearedStorageKey);
    } catch (error) {
        console.warn("Der Standort konnte nicht lokal gespeichert werden.", error);
    }

    updateDoctorLocationClearButton();
}

function restoreDoctorLocationPreference() {
    let preference = null;
    let sharedLocation = null;

    try {
        const sharedValue = localStorage.getItem(sharedLocationStorageKey);
        sharedLocation = sharedValue ? JSON.parse(sharedValue) : null;
        const storedValue = localStorage.getItem(doctorLocationStorageKey);
        preference = storedValue ? JSON.parse(storedValue) : null;

        if (!sharedLocation && !localStorage.getItem(sharedLocationClearedStorageKey)
            && preference && typeof preference.location === "string" && preference.location.trim() !== "") {
            sharedLocation = { location: preference.location.trim(), label: preference.location.trim() };
            localStorage.setItem(sharedLocationStorageKey, JSON.stringify(sharedLocation));
        }
    } catch (error) {
        console.warn("Der gespeicherte Standort konnte nicht gelesen werden.", error);
    }

    const sharedLocationValue = String(sharedLocation?.location || sharedLocation?.label || "").trim();

    if (sharedLocationValue === "") {
        const input = document.getElementById("doctor-location-input");
        if (input) input.value = "";
        currentLocation = null;
        currentCityFilter = "";
        const radius = document.getElementById("doctor-radius-enabled-input");
        if (radius) radius.checked = false;
        clearUserLocationMarker();
        updateRadiusInputState();
        updateDoctorLocationClearButton();
        return;
    }

    const locationInput = document.getElementById("doctor-location-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    if (locationInput) locationInput.value = sharedLocationValue;
    currentLocation = sharedLocation.lat != null && sharedLocation.lng != null
        && Number.isFinite(Number(sharedLocation.lat)) && Number.isFinite(Number(sharedLocation.lng))
        ? { lat: Number(sharedLocation.lat), lng: Number(sharedLocation.lng), label: sharedLocationValue, city: sharedLocation.city || "" }
        : null;
    setLocationMode(preference?.mode === "city" ? "city" : "radius");
    currentCityFilter = preference?.mode === "city" ? (sharedLocation.city || sharedLocationValue) : "";

    if (radiusEnabledInput) radiusEnabledInput.checked = Boolean(preference?.radiusEnabled);
    if (includeNoCoordsInput) includeNoCoordsInput.checked = Boolean(preference?.includeNoCoords);
    if (radiusInput && preference?.radiusKm !== undefined) radiusInput.value = String(preference.radiusKm);

    updateRadiusInputState();
    updateDoctorLocationClearButton();
}

function removeDoctorLocationPreference(clearCurrentLocation) {
    try {
        localStorage.removeItem(doctorLocationStorageKey);
        localStorage.removeItem("lcn_treatment_location_preference");
        localStorage.removeItem(sharedLocationStorageKey);
        localStorage.setItem(sharedLocationClearedStorageKey, "1");
    } catch (error) {
        console.warn("Der gespeicherte Standort konnte nicht entfernt werden.", error);
    }

    if (clearCurrentLocation) {
        const locationInput = document.getElementById("doctor-location-input");
        const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
        const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");

        if (locationInput) locationInput.value = "";
        if (radiusEnabledInput) radiusEnabledInput.checked = false;
        if (includeNoCoordsInput) includeNoCoordsInput.checked = false;

        currentCityFilter = "";
        currentLocation = null;
        currentIncludeNoCoords = false;
        clearUserLocationMarker();
        updateRadiusInputState();
        applySearchFromControls();
    }

    updateDoctorLocationClearButton();
}

function updateDoctorLocationClearButton() {
    const locationInput = document.getElementById("doctor-location-input");
    const clearButton = document.getElementById("doctor-location-clear-button");

    if (clearButton) {
        clearButton.classList.toggle("is-hidden", !locationInput || locationInput.value.trim() === "");
    }
}

function resetDoctorNavigationControls() {
    const sortSelect = document.getElementById("doctor-sort-select");
    const minPositiveInput = document.getElementById("doctor-min-positive-input");
    const minHealingInput = document.getElementById("doctor-min-healing-input");
    const maxNegativeInput = document.getElementById("doctor-max-negative-input");
    const minPositiveRange = document.getElementById("doctor-min-positive-range");
    const minHealingRange = document.getElementById("doctor-min-healing-range");
    const maxNegativeRange = document.getElementById("doctor-max-negative-range");
    const acceptsGkvInput = document.getElementById("doctor-accepts-gkv-input");
    const acceptsPkvInput = document.getElementById("doctor-accepts-pkv-input");
    const hasWebsiteInput = document.getElementById("doctor-has-website-input");
    const hasEmailInput = document.getElementById("doctor-has-email-input");
    const hasPhoneInput = document.getElementById("doctor-has-phone-input");
    const specialtySelect = document.getElementById("doctor-specialty-select");
    const searchInput = document.getElementById("doctor-search-input");
    const locationInput = document.getElementById("doctor-location-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    currentDoctorSortKey = "distance";
    currentDoctorSortDirection = "asc";
    currentMinPositiveRatio = 0;
    currentMinHealingRatio = 0;
    currentMaxNegativeRatio = 100;
    currentAcceptsGkv = false;
    currentAcceptsPkv = false;
    currentHasWebsite = false;
    currentHasEmail = false;
    currentHasPhone = false;
    currentCityFilter = "";
    currentDoctorSearchTerm = "";
    currentSpecialtyTermId = 0;
    currentIncludeNoCoords = false;
    showOnlyCompareSelection = false;

    if (sortSelect) sortSelect.value = "distance:asc";
    if (minPositiveInput) minPositiveInput.value = "0";
    if (minHealingInput) minHealingInput.value = "0";
    if (maxNegativeInput) maxNegativeInput.value = "100";
    if (minPositiveRange) minPositiveRange.value = "0";
    if (minHealingRange) minHealingRange.value = "0";
    if (maxNegativeRange) maxNegativeRange.value = "100";
    if (acceptsGkvInput) acceptsGkvInput.checked = false;
    if (acceptsPkvInput) acceptsPkvInput.checked = false;
    if (hasWebsiteInput) hasWebsiteInput.checked = false;
    if (hasEmailInput) hasEmailInput.checked = false;
    if (hasPhoneInput) hasPhoneInput.checked = false;
    if (specialtySelect) specialtySelect.value = "0";
    const providerSelect = document.getElementById("doctor-provider-type-select");
    if (providerSelect) providerSelect.value = "";
    window.providerTypeGroup = "";
    document.getElementById("doctor-specialization-select").value = "0";
    document.getElementById("doctor-qualification-select").value = "0";
    currentSpecializationTermId = 0;
    currentQualificationTermId = 0;
    currentMinTreatmentCount = 0;
    currentMinCategoryCount = 0;
    document.getElementById("doctor-min-treatments-input").value = "0";
    document.getElementById("doctor-min-categories-input").value = "0";
    if (searchInput) searchInput.value = "";
    const communityStatusSelect=document.getElementById("doctor-community-status-select");
    if(communityStatusSelect)communityStatusSelect.value="all";
    if (radiusEnabledInput) radiusEnabledInput.checked = false;
    if (includeNoCoordsInput) includeNoCoordsInput.checked = false;
    if (radiusInput) radiusInput.value = "100";

    setLocationMode("radius");
    updateRadiusInputState();
    renderDoctorCompareSelection();
}


function parseSortSelectValue(value) {
    const [key, direction] = String(value || "distance:asc").split(":");

    return {
        key: key || "name",
        direction: direction || "asc"
    };
}

function updateSortSelectValue() {
    [
        document.getElementById("doctor-sort-select"),
        document.getElementById("doctor-results-sort-select")
    ].filter(Boolean).forEach(function (sortSelect) {
        sortSelect.value = `${currentDoctorSortKey}:${currentDoctorSortDirection}`;
    });
}

function getRatingFilterSettingsFromControls() {
    const minPositiveInput = document.getElementById("doctor-min-positive-input");
    const minHealingInput = document.getElementById("doctor-min-healing-input");
    const maxNegativeInput = document.getElementById("doctor-max-negative-input");
    const acceptsGkvInput = document.getElementById("doctor-accepts-gkv-input");
    const acceptsPkvInput = document.getElementById("doctor-accepts-pkv-input");
    const hasWebsiteInput = document.getElementById("doctor-has-website-input");
    const hasEmailInput = document.getElementById("doctor-has-email-input");
    const hasPhoneInput = document.getElementById("doctor-has-phone-input");
    const specialtySelect = document.getElementById("doctor-specialty-select");
    const searchInput = document.getElementById("doctor-search-input");
    const locationInput = document.getElementById("doctor-location-input");
    const cityModeButton = document.getElementById("doctor-location-mode-city-button");

    const minPositiveRatio = Number(minPositiveInput ? minPositiveInput.value : 0);
    const minHealingRatio = Number(minHealingInput ? minHealingInput.value : 0);
    const maxNegativeRatio = Number(maxNegativeInput ? maxNegativeInput.value : 100);
    const searchTerm = searchInput ? searchInput.value.trim() : "";
    const isCityMode = cityModeButton ? cityModeButton.classList.contains("is-active") : false;
    const city = isCityMode && locationInput ? locationInput.value.trim() : "";
    const specialtyTermId = Number(specialtySelect ? specialtySelect.value : 0);

    if (!Number.isFinite(minHealingRatio) || minHealingRatio < 0 || minHealingRatio > 100) { alert("Bitte bei Heilung einen Wert zwischen 0 und 100 eingeben."); return null; }

    if (Number.isNaN(minPositiveRatio) || minPositiveRatio < 0 || minPositiveRatio > 100) {
        alert("Bitte bei positiven Erfahrungen einen Wert zwischen 0 und 100 eingeben.");
        return null;
    }

    if (Number.isNaN(maxNegativeRatio) || maxNegativeRatio < 0 || maxNegativeRatio > 100) {
        alert("Bitte bei negativen Erfahrungen einen Wert zwischen 0 und 100 eingeben.");
        return null;
    }

    if (Number.isNaN(specialtyTermId) || specialtyTermId < 0) {
        alert("Bitte eine gültige Fachrichtung auswählen.");
        return null;
    }

    return {
        minPositiveRatio,
        minHealingRatio,
        maxNegativeRatio,
        acceptsGkv: acceptsGkvInput ? acceptsGkvInput.checked : false,
        acceptsPkv: acceptsPkvInput ? acceptsPkvInput.checked : false,
        hasWebsite: hasWebsiteInput ? hasWebsiteInput.checked : false,
        hasEmail: hasEmailInput ? hasEmailInput.checked : false,
        hasPhone: hasPhoneInput ? hasPhoneInput.checked : false,
        city,
        searchTerm,
        specialtyTermId
    };
}

function getSearchSettingsFromControls() {
    const locationModeCityButton = document.getElementById("doctor-location-mode-city-button");
    const locationInput = document.getElementById("doctor-location-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("doctor-include-no-coords-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    const isCityMode = locationModeCityButton
        ? locationModeCityButton.classList.contains("is-active")
        : false;

    const cityQuery = isCityMode && locationInput ? locationInput.value.trim() : "";
    const locationQuery = !isCityMode && locationInput ? locationInput.value.trim() : "";
    const radiusEnabled = !isCityMode && Boolean(radiusEnabledInput?.checked);
    const includeNoCoords = !isCityMode && includeNoCoordsInput ? includeNoCoordsInput.checked : false;
    const radiusKm = Number(radiusInput ? radiusInput.value : 100);

    if (radiusEnabled && locationQuery === "") {
        alert("Bitte zuerst einen Standort eingeben, wenn die Radiusbegrenzung aktiv ist.");
        return null;
    }

    if (radiusEnabled && (Number.isNaN(radiusKm) || radiusKm < 1 || radiusKm > 2000)) {
        alert("Bitte einen Radius zwischen 1 und 2000 km eingeben.");
        return null;
    }

    currentIncludeNoCoords = includeNoCoords;

    return {
        isCityMode,
        cityQuery,
        locationQuery,
        radiusEnabled,
        radiusKm,
        includeNoCoords
    };
}

async function applySearchFromControls(resetEmptyLocation = false, persistLocation = true) {
    const locationField = document.getElementById('doctor-location-input');
    if (resetEmptyLocation && locationField && !locationField.value.trim()) {
        removeDoctorLocationPreference(false);
        currentLocation = null;
        currentCityFilter = '';
        setLocationMode('radius');
        doctorLocationSuggestionController?.abort();
        const radius = document.getElementById('doctor-radius-enabled-input');
        if (radius) radius.checked = false;
        hideDoctorLocationSuggestions();
        updateRadiusInputState();
    }
    const settings = getSearchSettingsFromControls();

    if (!settings) {
        return;
    }

    const locationInput = document.getElementById("doctor-location-input");

    setMapStatus("Suche läuft ...");
    setCountText("-");
    // Keep the current results mounted while the request is in flight. Clearing
    // a long list here shrinks the document and clamps the scroll position.

    try {
        if (settings.isCityMode && settings.cityQuery !== "") {
            const geocodedCity = currentLocation?.label === settings.cityQuery ? currentLocation : await geocodeLocation(settings.cityQuery);
            currentCityFilter = geocodedCity.city || settings.cityQuery;
            settings.cityCenter = geocodedCity;
            currentLocation = geocodedCity;
            updateUserLocationMarker();
            if (persistLocation) saveDoctorLocationPreference();
        } else if (settings.locationQuery !== "") {
            const geocodedLocation = currentLocation?.label === settings.locationQuery ? currentLocation : await geocodeLocation(settings.locationQuery);
            currentLocation = geocodedLocation;

            if (locationInput) {
                locationInput.value = geocodedLocation.label;
            }

            updateUserLocationMarker();
            if (persistLocation) saveDoctorLocationPreference();
        } else {
            currentLocation = null;
            clearUserLocationMarker();
        }

        drawRadiusIfNeeded(settings);
        await loadDoctorsFromSearchApi(settings);
    } catch (error) {
        console.error("Fehler bei der Suche:", error);
        setMapStatus("Die Suche konnte nicht ausgeführt werden. Details stehen in der Konsole.");
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
        label: data.result.formatted || query,
        city: data.result.city || "",
        postcode: data.result.postcode || ""
    };
}

async function loadDoctorsFromSearchApi(settings) {
    currentMinTreatmentCount = normalizeDoctorOfferMinimum("doctor-min-treatments-input");
    currentMinCategoryCount = normalizeDoctorOfferMinimum("doctor-min-categories-input");
    currentSpecializationTermId = Number(document.getElementById("doctor-specialization-select").value || 0);
    currentQualificationTermId = Number(document.getElementById("doctor-qualification-select").value || 0);
    const centerForApi = currentLocation || defaultMapCenter;

    const radiusParam = settings.radiusEnabled
        ? encodeURIComponent(settings.radiusKm)
        : "all";

    const cityParam = currentCityFilter !== ""
        ? `&city=${encodeURIComponent(currentCityFilter)}`
        : "";

    const searchParam = currentDoctorSearchTerm !== ""
        ? `&search=${encodeURIComponent(currentDoctorSearchTerm)}`
        : "";

    const specialtyParam = currentSpecialtyTermId > 0
        ? `&specialtyTermId=${encodeURIComponent(currentSpecialtyTermId)}`
        : "";

    const url =
        `api/doctors_search.php?lat=${encodeURIComponent(centerForApi.lat)}` +
        `&lng=${encodeURIComponent(centerForApi.lng)}` +
        `&radiusKm=${radiusParam}` +
        `&include_dummy=${window.LCNDummy?.get() ? "1" : "0"}` +
        `&minPositiveRatio=${encodeURIComponent(currentMinPositiveRatio)}` +
        `&minHealingRatio=${encodeURIComponent(currentMinHealingRatio)}` +
        `&maxNegativeRatio=${encodeURIComponent(currentMaxNegativeRatio)}` +
        `&acceptsGkv=${currentAcceptsGkv ? "1" : "0"}` +
        `&acceptsPkv=${currentAcceptsPkv ? "1" : "0"}` +
        `&includeNoCoords=${currentIncludeNoCoords ? "1" : "0"}` +
        `&hasWebsite=${currentHasWebsite ? "1" : "0"}` +
        `&hasEmail=${currentHasEmail ? "1" : "0"}` +
        `&hasPhone=${currentHasPhone ? "1" : "0"}` +
        cityParam +
        searchParam +
        specialtyParam +
        `&specializationTermId=${encodeURIComponent(currentSpecializationTermId)}` +
        `&qualificationTermId=${encodeURIComponent(currentQualificationTermId)}` +
        `&minTreatmentCount=${currentMinTreatmentCount}&minCategoryCount=${currentMinCategoryCount}`;

    const searchResponse = await fetch(url);

    if (!searchResponse.ok) {
        throw new Error(`HTTP-Fehler: ${searchResponse.status}`);
    }

    const data = await searchResponse.json();

    if (!data.ok) {
        throw new Error(data.message || "API-Antwort war nicht erfolgreich.");
    }

    renderDoctorSpecialtySelect(data.specialties || []);
    renderDoctorProfileSelect("specialization", data.specializations || [], currentSpecializationTermId, "Alle Spezialisierungen");
    renderDoctorProfileSelect("qualification", data.qualifications || [], currentQualificationTermId, "Alle Zusatzqualifikationen");

    // The API centrally selects the 39 researched providers.
    let apiDoctors = data.items || [];
    const reviewFilter=document.getElementById('doctor-community-status-select')?.value||'all';
    if(reviewFilter==='unreviewed') apiDoctors=[];
    if(reviewFilter!=='approved') {
      try {
        const response=await fetch('api/community_public.php?entity_type=doctor&search='+encodeURIComponent(currentDoctorSearchTerm)+ '&city='+encodeURIComponent(currentCityFilter));
        const community=await response.json();
        if(!response.ok||!community.ok)throw Error('Community-Einträge konnten nicht geladen werden.');
        const matches=(community.items||[]).filter(d=>!currentMinTreatmentCount&&!currentMinCategoryCount&&!currentSpecialtyTermId&&!currentSpecializationTermId&&!currentQualificationTermId&&!currentAcceptsGkv&&!currentAcceptsPkv&&(!currentHasWebsite||d.dr_website)&&(!currentHasEmail||d.dr_email)&&(!currentHasPhone||d.loc_phone)&&d.positive_ratio>=currentMinPositiveRatio&&Number(d.healing_ratio||0)>=currentMinHealingRatio&&d.negative_ratio<=currentMaxNegativeRatio&&(!settings.radiusEnabled||currentIncludeNoCoords));
        apiDoctors.push(...matches);
      } catch(error) { console.error(error); setMapStatus('Community-Einträge konnten nicht geladen werden.'); }
    }

    const providerSelect = document.getElementById("doctor-provider-type-select");
    if (providerSelect) {
        apiDoctors = renderProviderTypePicker(apiDoctors, providerSelect);

    }

    if (!currentLocation) {
        apiDoctors = apiDoctors.map(function (doctor) {
            return {
                ...doctor,
                distance_km: null,
                distance_meters: null
            };
        });
    }


    currentDoctors = sortDoctors(apiDoctors, currentDoctorSortKey, currentDoctorSortDirection);
    visibleDoctorCardCount = doctorCardBatchSize;
    visibleDoctorTableCount = doctorTableBatchSize;

    if (showOnlyCompareSelection && selectedDoctorsForCompare.length === 0) {
        showOnlyCompareSelection = false;
    }

    refreshDoctorDisplay();
    setCountText(`Gefundene Behandler: ${currentDoctors.length}`);
    updateStatusAfterSearch(settings);
}

function renderDoctorProfileSelect(kind, terms, selectedId, emptyLabel) {
    const select = document.getElementById(`doctor-${kind}-select`);
    select.innerHTML = `<option value="0">${emptyLabel}</option>` + terms.map(term =>
        `<option value="${Number(term.term_id)}">${escapeHtml(term.term_label)} (${Number(term.doctor_count)})</option>`
    ).join("");
    select.value = String(selectedId || 0);
}

function renderDoctorSpecialtySelect(specialties) {
    const specialtySelect = document.getElementById("doctor-specialty-select");

    if (!specialtySelect || !Array.isArray(specialties)) {
        return;
    }

    const selectedValue = String(currentSpecialtyTermId || 0);

    specialtySelect.innerHTML = [
        `<option value="0">Alle Fachrichtungen</option>`,
        ...specialties.map(function (specialty) {
            const termId = String(specialty.term_id || 0);
            const label = specialty.term_label || "Unbenannte Fachrichtung";
            const selected = termId === selectedValue ? " selected" : "";

            const count = Number(specialty.doctor_count || 0);
			const countLabel = count > 0 ? ` (${count})` : "";

			return `<option value="${escapeHtml(termId)}"${selected}>${escapeHtml(label + countLabel)}</option>`;
        })
    ].join("");
}


function updateStatusAfterSearch(settings) {
    const filterText = buildActiveFilterStatusText();
    if (currentDoctors.length > 0 && currentDoctors.every(doctor => !doctor.has_coordinates)) {
        setMapStatus(`${currentDoctors.length} Ärzt:innen gefunden. Adressen vorhanden; Kartenpositionen und Entfernungen fehlen noch.${filterText}`);
        return;
    }

    if (showOnlyCompareSelection) {
        setMapStatus(`${selectedDoctorsForCompare.length} ausgewählte Behandler:innen in der Vergleichsansicht.${filterText}`);
        return;
    }

    if (settings.radiusEnabled) {
        const noCoordsText = currentIncludeNoCoords
            ? " Einträge ohne Koordinaten werden zusätzlich angezeigt."
            : "";

        setMapStatus(`${currentDoctors.length} Ärzt:innen im Umkreis von ${settings.radiusKm} km gefunden. Entfernung: Luftlinie.${noCoordsText}${filterText}`);
        return;
    }

    if (currentLocation) {
        setMapStatus(`${currentDoctors.length} Ärzt:innen gefunden. Entfernung: Luftlinie zum Standort.${filterText}`);
        return;
    }

    setMapStatus(`${currentDoctors.length} Ärzt:innen gefunden. Kein Standort gesetzt.${filterText}`);
}

function buildActiveFilterStatusText() {
    const parts = [];

    if (currentDoctorSearchTerm !== "") parts.push(`Suche „${currentDoctorSearchTerm}“`);
    if (showOnlyCompareSelection) parts.push("Vergleichsansicht");
    if (currentMinTreatmentCount) parts.push(`mindestens ${currentMinTreatmentCount} Therapien`);
    if (currentMinCategoryCount) parts.push(`mindestens ${currentMinCategoryCount} unterschiedliche Therapiekategorien`);
    if (currentMinHealingRatio !== 0 || currentMinPositiveRatio !== 0 || currentMaxNegativeRatio !== 100) parts.push(`Verbesserung ≥ ${currentMinPositiveRatio} %, Heilung ≥ ${currentMinHealingRatio} %, negative Erfahrungen ≤ ${currentMaxNegativeRatio} %`);
    if (currentAcceptsGkv) parts.push("GKV");
    if (currentAcceptsPkv) parts.push("PKV/Selbstzahler");
	if (currentHasWebsite) parts.push("hat Website");
	if (currentHasEmail) parts.push("hat E-Mail");
	if (currentHasPhone) parts.push("hat Telefonnummer");
	if (currentSpecialtyTermId > 0) {
		const specialtySelect = document.getElementById("doctor-specialty-select");
		const selectedOption = specialtySelect ? specialtySelect.options[specialtySelect.selectedIndex] : null;
		const specialtyLabel = selectedOption ? selectedOption.textContent.trim() : "";
		parts.push(specialtyLabel ? `Fachrichtung „${specialtyLabel}“` : "Fachrichtung aktiv");
	}
    for (const [kind, label] of [["specialization", "Spezialisierung"], ["qualification", "Zusatzqualifikation"]]) {
        const select = document.getElementById(`doctor-${kind}-select`);
        if (Number(select?.value) > 0) parts.push(`${label} „${select.selectedOptions[0].textContent.trim()}“`);
    }
	if (currentCityFilter !== "") parts.push(`Ort enthält „${currentCityFilter}“`);
	if (currentIncludeNoCoords) parts.push("Einträge ohne Koordinaten werden zusätzlich angezeigt");

    return parts.length > 0 ? ` Filter aktiv: ${parts.join(", ")}.` : "";
}

function drawRadiusIfNeeded(settings) {
    if (settings.isCityMode && settings.cityCenter) {
        if (!map._lcnViewport) map.setView([settings.cityCenter.lat, settings.cityCenter.lng], 11);
        setMapStatus(`Suche Behandler:innen in ${currentCityFilter}.`);
        return;
    }

    if (settings.radiusEnabled && currentLocation) {
        radiusCircle = L.circle([currentLocation.lat, currentLocation.lng], {
            radius: settings.radiusKm * 1000,
            fillOpacity: 0.08,
            weight: 2
        }).addTo(map);

        if (!map._lcnViewport) map.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
        setMapStatus(`Suche Ärzt:innen im Umkreis von ${settings.radiusKm} km. Entfernung: Luftlinie.`);
        return;
    }

    if (currentLocation) {
        if (!map._lcnViewport) map.setView([currentLocation.lat, currentLocation.lng], 6);
        setMapStatus("Suche alle Ärzt:innen mit Koordinaten. Entfernung wird als Luftlinie zum Standort berechnet.");
        return;
    }

    if (!map._lcnViewport) map.setView([defaultMapCenter.lat, defaultMapCenter.lng], 6);
    setMapStatus("Suche alle Ärzt:innen. Kein Standort gesetzt.");
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

const doctorMobileResults = window.matchMedia("(max-width: 760px)");
const doctorOnlineGroupLabels = ["Behandler:innen mit Online-Angebot", "Weitere Behandler:innen"];

function setResultsView(viewName, remember = false) {
    if (remember) {
        try { localStorage.setItem("lcn_result_view_preference", viewName); } catch (_) {}
    }
    viewName = doctorMobileResults.matches || viewName === "table" ? "table" : "cards";
    const cardSection = document.getElementById("doctor-card-results-section");
    const tableSection = document.getElementById("doctor-table-results-section");
    const cardButton = document.getElementById("doctor-card-view-button");
    const tableButton = document.getElementById("doctor-table-view-button");

    const showCards = viewName === "cards";

    if (cardSection) cardSection.classList.toggle("is-hidden", !showCards);
    if (tableSection) tableSection.classList.toggle("is-hidden", showCards);
    if (cardButton) cardButton.classList.toggle("is-active", showCards);
    if (tableButton) tableButton.classList.toggle("is-active", !showCards);

    renderCurrentDoctorResultsView();
}

function getCurrentDoctorResultsView() {
    const tableSection = document.getElementById("doctor-table-results-section");

    if (tableSection && !tableSection.classList.contains("is-hidden")) {
        return "table";
    }

    return "cards";
}

function getDisplayedDoctors() {
    return showOnlyCompareSelection ? selectedDoctorsForCompare : currentDoctors;
}

function refreshDoctorDisplay() {
    const displayedDoctors = getDisplayedDoctors();

    renderDoctorMarkers(displayedDoctors);
    renderCurrentDoctorResultsView();
    renderDoctorCompareSelection();
}

function renderCurrentDoctorResultsView() {
    const currentView = getCurrentDoctorResultsView();
    const displayedDoctors = getDisplayedDoctors();
    const cardContainer = document.getElementById("doctor-card-results");
    const tableBody = document.getElementById("doctor-map-results-body");

    if (currentView === "cards") {
        if (tableBody) {
            LCNSearchOnlineGroups.resetTable(tableBody);
            tableBody.innerHTML = "";
        }
        renderDoctorCards(displayedDoctors);
        return;
    }

    if (cardContainer) cardContainer.innerHTML = "";
    renderDoctorResultsTable(displayedDoctors);
}

function renderDoctorMarkers(doctors) {
    if (doctorMarkerGroup) {
        map.removeLayer(doctorMarkerGroup);
        doctorMarkerGroup = null;
    }

    doctorMarkerGroup = L.featureGroup();

    (doctors || []).forEach(function (doctor) {
        if (!doctor.has_coordinates || doctor.loc_lat === null || doctor.loc_lng === null || doctor.loc_lat === "" || doctor.loc_lng === "") {
            return;
        }

        const lat = Number(doctor.loc_lat);
        const lng = Number(doctor.loc_lng);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return;
        }

        const marker=L.marker([lat, lng])
            .bindPopup(buildDoctorPopupHtml(doctor))
            .addTo(doctorMarkerGroup);
        window.LCNOnline?.track(marker,doctor.dr_id);
    });

    doctorMarkerGroup.addTo(map);

    // Der eigene Standort gehört unabhängig vom Suchmodus dauerhaft zur Karte.
    // Nach dem Neuaufbau der Ergebnismarker wird er deshalb nochmals abgesichert.
    updateUserLocationMarker();

    const markerLayers = doctorMarkerGroup.getLayers();

    if (map._lcnViewport) {
        map._lcnViewport.apply();
        return;
    }


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
            map.fitBounds(bounds, { padding: [30, 30] });
        }
    }
}

function renderDoctorCards(doctors) {
    const cardContainer = document.getElementById("doctor-card-results");
    const loadMoreButton = document.getElementById("doctor-cards-load-more-button");

    if (!cardContainer) {
        return;
    }

    if (!doctors || doctors.length === 0) {
        cardContainer.innerHTML = `<p class="doctor-empty-state">Keine Behandler:innen gefunden.</p>`;
        if (loadMoreButton) loadMoreButton.classList.add("is-hidden");
        return;
    }

    const visibleDoctors = showOnlyCompareSelection
        ? doctors
        : doctors.slice(0, visibleDoctorCardCount);

    cardContainer.innerHTML = LCNSearchOnlineGroups.renderCards(doctors, visibleDoctors.length,
        doctorOnlineLabel, buildDoctorCardHtml, doctorOnlineGroupLabels);

    if (loadMoreButton) {
        const remainingCount = Math.max(0, doctors.length - visibleDoctors.length);
        const nextCount = Math.min(doctorCardBatchSize, remainingCount);
        loadMoreButton.textContent = `Weitere ${nextCount} Kacheln laden`;
        loadMoreButton.classList.toggle("is-hidden", showOnlyCompareSelection || remainingCount === 0);
    }
}

function buildDoctorCardHtml(doctor, index) {
    const name = escapeHtml(LCNDoctorNames.compact(doctor.dr_display_name || "Unbekannte behandelnde Person"));
    const plz = escapeHtml(doctor.loc_plz || "");
    const city = escapeHtml(doctor.loc_city || "");
    const street = escapeHtml(doctor.loc_street || "");
    const houseNumber = escapeHtml(doctor.loc_housenumber || "");
    const distance = getDoctorDistanceText({...doctor, distance_km: doctor.distance_km == null ? null : Math.round(Number(doctor.distance_km)).toLocaleString("de-DE")});
	const stats = getDoctorVoteStats(doctor);
	const ownVote = ['pro', 'neutral', 'contra'].includes(doctor.own_vote) ? doctor.own_vote : null;
	const specialtyChipsHtml = buildDoctorSpecialtyChipsHtml(doctor, "doctor-card-tag", 4);
	const communityBadge=doctor.is_community_preview?'<span class="community-preview-badge">Community-Vorschlag · noch nicht geprüft</span>':'';
	const doctorTitle=doctor.is_community_preview?`<a href="arzt_detail.html?submission_id=${Number(doctor.community_submission_id)}">${name}</a>`:`<a class="doctor-card-title-link" href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">${name}</a>`;

    return `
        <article data-doctor-online-managed class="doctor-card doctor-card-v2${doctor.is_community_preview ? " is-community-preview" : ""}" data-dr-id="${escapeHtml(doctor.dr_id)}">
            <div class="doctor-card-accent"></div>

            <div class="doctor-card-main-header">
                <div class="doctor-card-rank-large" aria-label="Platzierung">
                    <strong>#${index + 1}</strong>
                    <span>${escapeHtml(getDoctorSortShortLabel())}</span>
                </div>

                <div class="doctor-card-title-area">
                    <h3 class="doctor-card-title">${doctorTitle}</h3>${doctorOnlineLabel(doctor) ? `<span class="doctor-search-online lcn-online-badge">${doctorOnlineLabel(doctor)}</span>` : ""}${communityBadge}

                    <div class="doctor-card-meta">
						${specialtyChipsHtml || '<span class="doctor-card-tag">Fachrichtungen: —</span>'}
                    </div>
                </div>

                <div class="doctor-card-location-summary">
                    <address class="doctor-card-address">${street || houseNumber ? `<span>${street} ${houseNumber}</span>` : ""}${plz || city ? `<span>${plz} ${city}</span>` : ""}</address>
                    <div class="doctor-card-distance">${!doctor.online_only ? distance : ""}</div>
                </div>
            </div>

            <div class="doctor-card-content-grid">
                <section class="doctor-card-info-panel doctor-card-location-panel">
                    <div class="doctor-card-offer-stat"><span>Therapien</span><strong>${Number(doctor.treatment_count || 0)}</strong></div>
                    <div class="doctor-card-offer-stat"><span>Therapievielfalt</span><strong>${Number(doctor.category_count || 0)}</strong></div>
                </section>

                <section class="doctor-card-info-panel doctor-card-rating-panel">
                    <h4 class="doctor-card-section-heading">
                        Erfahrungen
                        <span class="doctor-card-section-count"></span>
                        <a class="doctor-card-rating-link" href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">(Zur Bewertung)</a>
                    </h4>
                    ${buildDoctorCardRatingHtml(doctor)}
                </section>
            </div>

            <div class="doctor-card-footer doctor-card-footer-with-compare">
                <button type="button" class="doctor-compare-add-button ${isDoctorSelectedForCompare(doctor.dr_id) ? "is-selected" : ""}" data-dr-id="${escapeHtml(doctor.dr_id)}">
                    ${isDoctorSelectedForCompare(doctor.dr_id) ? "Ausgewählt" : "+ vergleichen"}
                </button>
            </div>
        </article>
    `;
}

function buildDoctorCardRatingHtml(doctor) {
    return LCNExperience.html('doctor', doctor.dr_id);
}

function getDoctorSpecialtyLabels(doctor) {
    const rawTerms = Array.isArray(doctor.specialty_terms)
        ? doctor.specialty_terms
        : (Array.isArray(doctor.specialties) ? doctor.specialties : []);

    const labels = [];

    rawTerms.forEach(function (term) {
        const label = typeof term === "string"
            ? term
            : (term.term_label || term.label || term.name || "");

        const normalizedLabel = String(label || "").trim();

        if (normalizedLabel !== "" && !labels.includes(normalizedLabel)) {
            labels.push(normalizedLabel);
        }
    });

    if (labels.length === 0 && doctor.specialty_labels) {
        String(doctor.specialty_labels)
            .split(",")
            .map(function (label) {
                return label.trim();
            })
            .filter(Boolean)
            .forEach(function (label) {
                if (!labels.includes(label)) {
                    labels.push(label);
                }
            });
    }

    return labels;
}

function getDoctorSpecialtyPlainText(doctor, limit = null) {
    const labels = getDoctorSpecialtyLabels(doctor);
    const visibleLabels = limit ? labels.slice(0, limit) : labels;
    const hiddenCount = limit && labels.length > limit ? labels.length - limit : 0;

    if (visibleLabels.length === 0) {
        return "";
    }

    return visibleLabels.join(", ") + (hiddenCount > 0 ? ` +${hiddenCount}` : "");
}

function buildDoctorSpecialtyChipsHtml(doctor, chipClassName = "doctor-card-tag", limit = null, wrapperClassName = "") {
    const labels = getDoctorSpecialtyLabels(doctor);
    const visibleLabels = limit ? labels.slice(0, limit) : labels;
    const hiddenCount = limit && labels.length > limit ? labels.length - limit : 0;

    if (visibleLabels.length === 0) {
        return "";
    }

    const chipsHtml = visibleLabels.map(function (label) {
        return `<span class="${escapeHtml(chipClassName)}">${escapeHtml(label)}</span>`;
    }).join("");

    const moreHtml = hiddenCount > 0
        ? `<span class="${escapeHtml(chipClassName)}">+${hiddenCount}</span>`
        : "";

    if (wrapperClassName) {
        return `<div class="${escapeHtml(wrapperClassName)}">${chipsHtml}${moreHtml}</div>`;
    }

    return chipsHtml + moreHtml;
}


function renderDoctorResultsTable(doctors, append = false) {
    const more = document.getElementById("doctor-table-load-more-button");
    const total = doctors?.length || 0;
    const visibleCount = showOnlyCompareSelection ? total : Math.min(total, visibleDoctorTableCount);
    const remaining = total - visibleCount;
    if (more) {
        more.classList.toggle("is-hidden", remaining === 0);
        more.textContent = `Weitere ${Math.min(doctorTableBatchSize, remaining)} Behandler:innen laden (${remaining} weitere)`;
    }
    const status = document.getElementById("doctor-table-page-status");
    if (status) status.textContent = `${visibleCount} von ${total} Behandler:innen angezeigt`;
    const tableBody = document.getElementById("doctor-map-results-body");

    updateDoctorMobileTablePresentation();
    updateDoctorTableSortHeaders();

    if (!tableBody) {
        return;
    }

    if (doctorMobileResults.matches || !total) LCNSearchOnlineGroups.resetTable(tableBody);
    if (!doctors || doctors.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8">Keine Behandler:innen gefunden.</td></tr>`;
        return;
    }

    const ranks = new Map(currentDoctors.map((doctor, index) => [Number(doctor.dr_id), index]));
    const tableRows = doctors.map(function (doctor, index) {
        const globalRank = ranks.get(Number(doctor.dr_id)) ?? -1;

        return {
            doctor,
            rank: globalRank >= 0 ? globalRank + 1 : index + 1,
            originalIndex: index
        };
    });

    sortDoctorTableRows(tableRows);
    if (!doctorMobileResults.matches) {
        LCNSearchOnlineGroups.renderTables(tableBody, tableRows, visibleCount,
            row => doctorOnlineLabel(row.doctor), row => buildDoctorTableRowHtml(row.doctor, row.rank), doctorOnlineGroupLabels);
        return;
    }

    // Sort the full result set first; mount only the requested batch.
    const start = append ? tableBody.querySelectorAll("tr[data-dr-id]").length : 0;
    const html = tableRows.slice(start, visibleCount).map(function (row) {
        return buildDoctorTableRowHtml(row.doctor, row.rank);
    }).join("");
    if (append) tableBody.insertAdjacentHTML("beforeend", html);
    else tableBody.innerHTML = html;
}

function buildDoctorTableSpecialtyHtml(doctor) {
    const labels = getDoctorSpecialtyLabels(doctor).slice(0, 1);
    if (!labels.length) return '<span class="doctor-specialty-empty">–</span>';
    return `<span class="doctor-specialty-badges">${labels.map(label => `<span class="doctor-specialty-category-badge">${escapeHtml(label)}</span>`).join("")}</span>`;
}

function buildDoctorTableRowHtml(doctor, rank) {
    const name = escapeHtml(LCNDoctorNames.compact(doctor.dr_display_name || "Unbekannte behandelnde Person"));

    return `
        <tr data-dr-id="${escapeHtml(doctor.dr_id)}">
            <td class="doctor-table-rank">${rank}</td>
            <td class="doctor-table-name" data-doctor-online-managed>
                <div class="doctor-table-name-stack">
					${doctor.is_community_preview?`<a href="arzt_detail.html?submission_id=${Number(doctor.community_submission_id)}">${name}</a><span class="community-preview-badge">Noch nicht geprüft</span>`:`<a href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">${name}</a>`}

                    ${doctorOnlineLabel(doctor) ? `<span class="doctor-search-online lcn-online-badge">${doctorOnlineLabel(doctor)}</span>` : ""}
                    <span class="doctor-mobile-specialty">${buildDoctorTableSpecialtyHtml(doctor)}</span>
                    <span class="doctor-mobile-offer-counts">${Number(doctor.treatment_count || 0)} Therapien · Therapievielfalt: ${Number(doctor.category_count || 0)}</span>
					<button type="button" class="doctor-compare-add-button doctor-compare-add-button-table ${isDoctorSelectedForCompare(doctor.dr_id) ? "is-selected" : ""}" data-dr-id="${escapeHtml(doctor.dr_id)}">
					${isDoctorSelectedForCompare(doctor.dr_id) ? "Ausgewählt" : "+ vergleichen"}
                    </button>
                </div>
            </td>
            <td class="doctor-table-specialty">${buildDoctorTableSpecialtyHtml(doctor)}</td>
            <td>${buildDoctorTableExperienceHtml(doctor)}</td>
            <td>${buildDoctorTableLocationHtml(doctor)}</td>
            <td class="doctor-offer-count">${Number(doctor.treatment_count || 0)}</td>
            <td class="doctor-offer-count">${Number(doctor.category_count || 0)}</td>
            <td>${buildDoctorTableContactHtml(doctor)}</td>
        </tr>
    `;
}

function updateDoctorTableSortHeaders() {
    document.querySelectorAll("[data-table-sort-key]").forEach(function (button) {
        const isActive = button.dataset.tableSortKey === currentDoctorTableSortKey;

        button.classList.toggle("is-active", isActive);
        if (button.closest(".lcn-experience")) {
            button.dataset.sortDirection = isActive ? currentDoctorTableSortDirection : "";
            button.setAttribute("aria-pressed", String(isActive));
        }
        button.setAttribute("aria-sort", isActive
            ? (currentDoctorTableSortDirection === "asc" ? "ascending" : "descending")
            : "none");

    });
}

function sortDoctorTableRows(rows) {
    if (!currentDoctorTableSortKey) {
        return rows;
    }

    const directionFactor = currentDoctorTableSortDirection === "desc" ? -1 : 1;

    rows.sort(function (rowA, rowB) {
        if (currentDoctorTableSortKey === "location" && currentLocation) return compareDoctorDistance(rowA.doctor, rowB.doctor, currentDoctorTableSortDirection);
        const comparison = compareDoctorTableRows(rowA, rowB, currentDoctorTableSortKey);
        return comparison === 0
            ? rowA.originalIndex - rowB.originalIndex
            : comparison * directionFactor;
    });

    return rows;
}

function compareDoctorTableRows(rowA, rowB, sortKey) {
    const doctorA = rowA.doctor;
    const doctorB = rowB.doctor;

    if (sortKey === "rank") {
        return rowA.rank - rowB.rank;
    }

    if (sortKey === "name") {
        return getDoctorNameSortKey(doctorA).localeCompare(getDoctorNameSortKey(doctorB), "de", { sensitivity: "base" });
    }

    if (sortKey === "specialty") {
        return getDoctorSpecialtyPlainText(doctorA).localeCompare(getDoctorSpecialtyPlainText(doctorB), "de");
    }

    if (sortKey === "location") {
        if (currentLocation) {
            return Number(doctorA.distance_km ?? Infinity) - Number(doctorB.distance_km ?? Infinity);
        }

        const locationA = `${doctorA.loc_city || ""} ${doctorA.loc_plz || ""}`.trim();
        const locationB = `${doctorB.loc_city || ""} ${doctorB.loc_plz || ""}`.trim();
        return locationA.localeCompare(locationB, "de", { sensitivity: "base" });
    }

    if (["treatment_count", "category_count", "healing_ratio", "positive_ratio", "neutral_ratio", "negative_ratio", "total_votes"].includes(sortKey)) {
        return Number(doctorA[sortKey] || 0) - Number(doctorB[sortKey] || 0);
    }

    if (sortKey === "experience") {
        const statsA = getDoctorVoteStats(doctorA);
        const statsB = getDoctorVoteStats(doctorB);
        return statsA.proRatio - statsB.proRatio || statsA.totalVotes - statsB.totalVotes;
    }



    if (sortKey === "contact") {
        const contactA = getDoctorTableContactCount(doctorA);
        const contactB = getDoctorTableContactCount(doctorB);
        return contactA - contactB;
    }

    return 0;
}

function getDoctorTableContactCount(doctor) {
    const hasWebsite = Boolean(doctor.loc_website || doctor.dr_website);
    const hasEmail = Boolean(getDoctorFirstFieldValue(doctor, ["loc_email", "dr_email", "email", "contact_email", "dr_contact_email"]))
        || hasDoctorFieldValue(doctor, ["has_email", "hasEmail"]);
    const hasPhone = Boolean(getDoctorFirstFieldValue(doctor, ["loc_phone", "dr_phone", "phone", "telephone", "telefon", "loc_telephone", "dr_telephone"]))
        || hasDoctorFieldValue(doctor, ["has_phone", "hasPhone"]);

    return Number(hasWebsite) + Number(hasEmail) + Number(hasPhone);
}

function doctorOnlineLabel(doctor) {
    return doctor.online_therapy_available ? LCNOnline.appointmentLabel : "";
}

function compareDoctorDistance(a, b, direction = "asc") {
    const distanceA = !a.online_only && a.distance_km != null && Number.isFinite(Number(a.distance_km)) ? Number(a.distance_km) : null;
    const distanceB = !b.online_only && b.distance_km != null && Number.isFinite(Number(b.distance_km)) ? Number(b.distance_km) : null;
    if (distanceA === null && distanceB !== null) return 1;
    if (distanceB === null && distanceA !== null) return -1;
    return (distanceA !== null && distanceB !== null ? (distanceA - distanceB) * (direction === "desc" ? -1 : 1) : 0)
        || getDoctorNameSortKey(a).localeCompare(getDoctorNameSortKey(b), "de");
}

function buildDoctorTableLocationHtml(doctor) {
    const place = String(doctor.loc_city || doctor.loc_plz || "").trim();
    const distance = getDoctorDistanceText(doctor, true);
    const label = distance !== "-" ? distance : currentLocation ? "Entfernung unbekannt" : "Standort setzen";
    if (doctor.online_only) return "–";
    return `<div class="doctor-distance-cell"><strong>${escapeHtml(label)}</strong>${place ? `<span class="doctor-distance-place">${escapeHtml(place)}</span>` : ""}</div>`;
}

function normalizeDoctorOfferMinimum(id) {
    const input = document.getElementById(id);
    const number = Number(input.value);
    const value = Number.isFinite(number) ? Math.max(0, Math.min(100000, Math.floor(number))) : 0;
    input.value = String(value);
    return value;
}

function buildDoctorTableExperienceHtml(doctor) {
    return LCNExperience.html('doctor', doctor.dr_id, true);
}

function getSavedDoctorResultsView() {
    try { return localStorage.getItem("lcn_result_view_preference") === "cards" ? "cards" : "table"; }
    catch (_) { return "table"; }
}

function buildDoctorTableVoteButton(drId, type, prefix, ratio, ownVote, label) {
    const badgeClass = type === "pro"
        ? "doctor-table-badge-positive"
        : type === "neutral" ? "doctor-table-badge-neutral" : "doctor-table-badge-negative";
    const isSelected = ownVote === type;

    return `<a href="arzt_detail.html?id=${escapeHtml(drId)}" title="Erfahrungen auf der Detailseite ansehen oder angeben"
                    class="doctor-table-experience-value   ${badgeClass}${isSelected ? " is-selected" : ""}"

                   >${prefix}${ratio}%</a>`;
}

function buildDoctorTableContactHtml(doctor) {
    const website = doctor.loc_website || doctor.dr_website || "";
    const email = getDoctorFirstFieldValue(doctor, ["loc_email", "dr_email", "email", "contact_email", "dr_contact_email"]);
    const phone = getDoctorFirstFieldValue(doctor, ["loc_phone", "dr_phone", "phone", "telephone", "telefon", "loc_telephone", "dr_telephone"]);

    const badges = [];

    if (website) {
        badges.push('<span class="doctor-table-badge">Web</span>');
    }
    if (email || hasDoctorFieldValue(doctor, ["has_email", "hasEmail"])) {
        badges.push('<span class="doctor-table-badge">Mail</span>');
    }
    if (phone || hasDoctorFieldValue(doctor, ["has_phone", "hasPhone"])) {
        badges.push('<span class="doctor-table-badge">Tel</span>');
    }

    return badges.length > 0 ? `<div class="doctor-table-badge-row">${badges.join("")}</div>` : "";
}

function handleDoctorCompareClick(event) {
    const button = event.target.closest(".doctor-compare-add-button");

    if (!button) {
        return;
    }

    const drId = Number(button.getAttribute("data-dr-id"));

    if (!drId) {
        return;
    }

    const doctor = currentDoctors.find(function (currentDoctor) {
        return Number(currentDoctor.dr_id) === drId;
    }) || selectedDoctorsForCompare.find(function (selectedDoctor) {
        return Number(selectedDoctor.dr_id) === drId;
    });

    if (doctor) {
        addDoctorToCompareSelection(doctor);
    }
}

function addDoctorToCompareSelection(doctor) {
    const drId = Number(doctor.dr_id);

    if (!drId) {
        return;
    }

    if (!isDoctorSelectedForCompare(drId)) {
        selectedDoctorsForCompare.push({ ...doctor });
    }

    renderDoctorCompareSelection();
    refreshDoctorDisplay();
}

function removeDoctorFromCompareSelection(drId) {
    selectedDoctorsForCompare = selectedDoctorsForCompare.filter(function (doctor) {
        return Number(doctor.dr_id) !== Number(drId);
    });

    if (selectedDoctorsForCompare.length === 0) {
        showOnlyCompareSelection = false;
    }

    refreshDoctorDisplay();
}

function isDoctorSelectedForCompare(drId) {
    return selectedDoctorsForCompare.some(function (doctor) {
        return Number(doctor.dr_id) === Number(drId);
    });
}

function renderDoctorCompareSelection() {
    const container = document.getElementById("doctor-compare-selection");
    const chipsContainer = document.getElementById("doctor-compare-chips");
    const statusElement = document.getElementById("doctor-compare-status");
    const hitViewButton = document.getElementById("doctor-results-hit-view-button");
    const compareViewButton = document.getElementById("doctor-compare-show-button");
    const clearButton = document.getElementById("doctor-compare-clear-button");

    const hasSelection = selectedDoctorsForCompare.length > 0;

    if (container) {
        container.classList.toggle("is-hidden", !hasSelection);
    }

    if (chipsContainer) {
        chipsContainer.innerHTML = hasSelection
            ? selectedDoctorsForCompare.map(function (doctor) {
                return `
                    <span class="doctor-compare-chip">
                        <span class="doctor-compare-chip-name">${escapeHtml(LCNDoctorNames.compact(doctor.dr_display_name || "Unbekannt"))}</span>
                        <button type="button" class="doctor-compare-chip-remove" data-dr-id="${escapeHtml(doctor.dr_id)}" aria-label="${escapeHtml(doctor.dr_display_name || "Eintrag")} aus Vergleich entfernen">×</button>
                    </span>
                `;
            }).join("")
            : "";
    }

    if (statusElement) {
        statusElement.textContent = hasSelection
            ? `${selectedDoctorsForCompare.length} Behandler:innen ausgewählt.`
            : "";
    }

    if (hitViewButton) {
        hitViewButton.classList.toggle("is-active", !showOnlyCompareSelection);
    }

    if (compareViewButton) {
        compareViewButton.disabled = !hasSelection;
        compareViewButton.classList.toggle("is-active", showOnlyCompareSelection);
    }

    if (clearButton) {
        clearButton.disabled = !hasSelection;
    }
}

async function handleDoctorCardVote(event) {
    const button = event.target.closest(".doctor-card-vote-button, .doctor-table-vote-button");

    if (!button) {
        return;
    }

    const drId = Number(button.getAttribute("data-dr-id"));
    const voteType = button.getAttribute("data-type");

    if (!drId || !voteType) {
        console.error("Vote-Button ohne dr_id oder type.", { drId, voteType });
        return;
    }

    const voteContainer = button.closest(".doctor-card, tr");
    const buttonsInCard = voteContainer ? voteContainer.querySelectorAll(".doctor-card-vote-button, .doctor-table-vote-button") : [button];

    buttonsInCard.forEach(function (cardButton) {
        cardButton.disabled = true;
        cardButton.classList.add("is-saving");
    });

    try {
        const isCommunity=drId<0;
        const response = await fetch(isCommunity?"api/vote_community_submission.php":"api/inc_doctor_votes.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ...(isCommunity?{submission_id:Math.abs(drId)}:{dr_id:drId}),
                type: voteType
            })
        });

        const data = await response.json().catch(function () {
            return {};
        });

        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Vote konnte nicht gespeichert werden.");
        }

        if(isCommunity){const settings=getSearchSettingsFromControls();if(settings)await loadDoctorsFromSearchApi(settings);}else{await refreshSingleDoctor(drId, data.vote);}
    } catch (error) {
        console.error("Fehler beim Speichern der Ärztebewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden. Details stehen in der Konsole.");

        buttonsInCard.forEach(function (cardButton) {
            cardButton.disabled = false;
            cardButton.classList.remove("is-saving");
        });
    }
}

async function refreshSingleDoctor(drId, ownVote = null) {
    const centerForApi = currentLocation || defaultMapCenter;

    const response = await fetch(
        `api/doctors_search.php?lat=${encodeURIComponent(centerForApi.lat)}` +
        `&lng=${encodeURIComponent(centerForApi.lng)}` +
        `&radiusKm=all` +
        `&dr_id=${encodeURIComponent(drId)}`
    );

    if (!response.ok) {
        throw new Error("Einzelnes Profil konnte nicht neu geladen werden.");
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.items) || data.items.length !== 1) {
        throw new Error("Unerwartetes API-Format beim Einzelladen.");
    }

    let updatedDoctor = {
        ...data.items[0],
        own_vote: ownVote
    };

    if (!currentLocation) {
        updatedDoctor = {
            ...updatedDoctor,
            distance_km: null,
            distance_meters: null
        };
    }

    currentDoctors = currentDoctors.map(function (doctor) {
        return Number(doctor.dr_id) === Number(drId) ? updatedDoctor : doctor;
    });

    selectedDoctorsForCompare = selectedDoctorsForCompare.map(function (doctor) {
        return Number(doctor.dr_id) === Number(drId) ? updatedDoctor : doctor;
    });

    refreshDoctorDisplay();
}

function sortDoctors(doctors, sortKey, direction) {
    const doctorsCopy = [...(doctors || [])];

    doctorsCopy.sort(function (a, b) {
        const statsA = getDoctorVoteStats(a);
        const statsB = getDoctorVoteStats(b);
        let result = 0;

        if (sortKey === "distance") {
            return compareDoctorDistance(a, b, direction);
        } else if (sortKey === "positive_ratio") {
            result = statsA.proRatio - statsB.proRatio;
        } else if (sortKey === "negative_ratio") {
            result = statsA.contraRatio - statsB.contraRatio;
        } else if (sortKey === "total_votes") {
            result = statsA.totalVotes - statsB.totalVotes;
        } else {
            result = getDoctorNameSortKey(a).localeCompare(getDoctorNameSortKey(b), "de", { sensitivity: "base" });

            if (result === 0) {
                result = String(a.dr_display_name || "").localeCompare(String(b.dr_display_name || ""), "de", { sensitivity: "base" });
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

function getDoctorSortShortLabel() {
    if (currentDoctorSortKey === "distance") return "Entf.";
    if (currentDoctorSortKey === "positive_ratio") return "Pos.%";
    if (currentDoctorSortKey === "negative_ratio") return "Neg.%";
    if (currentDoctorSortKey === "total_votes") return "Bew.";
    return "Name";
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

function buildDoctorPopupHtml(doctor) {
    const name = escapeHtml(LCNDoctorNames.compact(doctor.dr_display_name || "Unbekannte behandelnde Person"));
    const plz = escapeHtml(doctor.loc_plz || "");
    const city = escapeHtml(doctor.loc_city || "");
    const stats = getDoctorVoteStats(doctor);
	const specialtyText = getDoctorSpecialtyPlainText(doctor, 4);

	const ratingText = stats.totalVotes > 0
        ? `${stats.proRatio}% positiv · ${stats.totalVotes} Bewertungen`
        : "Noch keine Bewertungen";
    return `
        <div class="doctor-map-popup">
            <strong>${name}</strong><br>
            ${plz} ${city}<br>
			${specialtyText ? `<span class="doctor-popup-specialties">${escapeHtml(specialtyText)}</span><br>` : ""}
            <span>⭐ ${ratingText}</span>
            <br><a href="arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}">Mehr Details</a>
        </div>
    `;
}

function getDoctorDistanceText(doctor, shortText = false) {
    if (!currentLocation || doctor.online_only) {
        return "-";
    }

    if (!doctor.has_coordinates || doctor.distance_km === null || doctor.distance_km === undefined) {
        return "-";
    }

    return shortText
        ? `${escapeHtml(doctor.distance_km)} km`
        : `${escapeHtml(doctor.distance_km)} km`;
}

function getDoctorFirstFieldValue(doctor, fieldNames) {
    for (const fieldName of fieldNames) {
        const value = doctor[fieldName];

        if (value === null || value === undefined) {
            continue;
        }

        const normalizedValue = String(value).trim();

        if (normalizedValue !== "" && !["0", "false", "no", "nein", "n"].includes(normalizedValue.toLowerCase())) {
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
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value === null || value === undefined) return false;

    const normalizedValue = String(value).trim().toLowerCase();

    return ["1", "true", "yes", "ja", "y", "j"].includes(normalizedValue) ||
        (normalizedValue !== "" && !["0", "false", "no", "nein", "n"].includes(normalizedValue));
}

function normalizeWebsiteUrl(value) {
    const url = String(value || "").trim();

    if (url === "") {
        return "";
    }

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    return `https://${url}`;
}

function setMapStatus(text) {
    const statusElement = document.getElementById("doctor-map-status");

    if (statusElement) {
        statusElement.textContent = text;
    }
}

function setCountText(text) {
    const countElement = document.getElementById("doctor-map-count");

    if (countElement) {
        countElement.textContent = text;
        countElement.classList.remove("is-dirty");
    }
}

function markDoctorFiltersDirty() {
    const countElement = document.getElementById("doctor-map-count");

    if (countElement) {
        countElement.textContent = "Bitte Filter erneut anwenden";
    }
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

function updateDoctorMobileTablePresentation() {
    const heading = document.getElementById("doctor-table-experience-heading");

    if (!heading) {
        return;
    }

    if (!window.matchMedia("(max-width: 760px)").matches) {
        heading.textContent = "Erfahrung";
        return;
    }

    heading.textContent = "Erfahrung";
}

window.addEventListener('lcn-dummy-change', () => applySearchFromControls());
window.addEventListener('storage', event => { if (event.key === 'lcn_dummy_data_enabled' || event.key === null) applySearchFromControls(); });

// A location selected in another tab is the same location used by this search.
let doctorLocationSyncTimer;
window.addEventListener('storage', event => {
    if (event.key !== null && ![sharedLocationStorageKey, sharedLocationClearedStorageKey].includes(event.key)) return;
    clearTimeout(doctorLocationSyncTimer);
    doctorLocationSyncTimer = setTimeout(() => {
        restoreDoctorLocationPreference();
        applySearchFromControls(false, false);
    }, 30);
});
