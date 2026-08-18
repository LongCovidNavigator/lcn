// =========================
// Therapien-Seite - Version 8
// Ergänzt:
// - Radius frei eingeben
// - Radius-Kreis auf Karte anzeigen
// - Distanz in Tabellen-Anbieter-Zelle anzeigen
// - Intelligente Suche nach Name, Alias und Oberbegriff
// =========================

let currentTreatments = [];
let currentCategories = [];
let currentViewMode = getSavedTreatmentResultsView();
const treatmentCardBatchSize = 30;
let visibleTreatmentCardCount = treatmentCardBatchSize;
let selectedTreatmentsForCompare = [];
let showOnlyTreatmentCompareSelection = false;
const treatmentCompareMaxItems = 5;

let treatmentMap = null;
let treatmentMarkerGroup = null;
let treatmentUserLocationMarker = null;
let treatmentRadiusCircle = null;
let treatmentUserLocationIcon = null;
let currentTreatmentUserLocation = null;
let currentTreatmentCompareMapData = null;
let currentTreatmentCompareMapKey = "";
let treatmentSmartSearchOverride = null;
let treatmentAliasSmartSuggestController = null;
let treatmentAliasSmartSuggestions = [];
let currentTreatmentLocationMode = "radius";
let currentTreatmentTableSortKey = null;
let currentTreatmentTableSortDirection = "asc";
let treatmentAutoApplyTimer = null;
let treatmentSearchRequestId = 0;
let treatmentSearchController = null;
let treatmentMapDataController = null;
let treatmentMapRequestId = 0;
let currentTreatmentMapData = null;
let treatmentLocationSuggestionTimer = null;
let treatmentLocationSuggestionController = null;
let treatmentLocationSuggestions = [];
let treatmentTableResizeTimer = null;

const treatmentLocationStorageKey = "lcn_treatment_location_preference";
const sharedLocationStorageKey = "lcn_shared_location_preference";
const sharedLocationClearedStorageKey = "lcn_shared_location_cleared";

const treatmentDefaultMapCenter = {
    lat: 51.1657,
    lng: 10.4515,
    label: "Deutschland"
};

const treatmentMapMarkerColors = [
    "#0072B2",
    "#D55E00",
    "#009E73",
    "#CC79A7",
    "#F0E442"
];

document.addEventListener("DOMContentLoaded", function () {
    const radiusModeButton = document.getElementById("treatment-location-mode-radius-button");
    const cityModeButton = document.getElementById("treatment-location-mode-city-button");

    if (radiusModeButton) {
        radiusModeButton.addEventListener("click", function () {
            setTreatmentLocationMode("radius");
            applyTreatmentFiltersFromControls();
        });
    }

    if (cityModeButton) {
        cityModeButton.addEventListener("click", function () {
            setTreatmentLocationMode("city");
            applyTreatmentFiltersFromControls();
        });
    }

    initTreatmentPage();
});

async function initTreatmentPage() {
    initTreatmentMap();
    bindTreatmentNavigationEvents();
    bindTreatmentSmartSearchEvents();
   
    bindTreatmentViewSwitchEvents();
    bindTreatmentCompareControls();
    bindTreatmentCardContainerEvents();
    bindTreatmentTableContainerEvents();
    bindTreatmentMapEvents();
    document.getElementById("treatment-community-status-select")?.addEventListener("change",loadTreatmentResults);
    window.addEventListener("resize", function () {
        clearTimeout(treatmentTableResizeTimer);
        treatmentTableResizeTimer = setTimeout(function () {
            if (currentViewMode === "table") {
                renderTreatmentResultsTable(getDisplayedTreatments());
            }
        }, 100);
    });
    setTreatmentLocationMode("radius");
    await restoreTreatmentLocationPreference();
    updateTreatmentRadiusInputState();
    await loadTreatmentResults();
}

async function loadTreatmentResults() {
    clearTimeout(treatmentAutoApplyTimer);
    treatmentAutoApplyTimer = null;

    if (treatmentSearchController) {
        treatmentSearchController.abort();
    }
    if (treatmentMapDataController) {
        treatmentMapDataController.abort();
    }

    treatmentSearchController = new AbortController();
    const requestId = ++treatmentSearchRequestId;
    const tableBody = document.getElementById("treatment-results-body");
    const cardResults = document.getElementById("treatment-card-results");

    try {
        const loadsMapImmediately = getTreatmentFilters().sortKey === "distance";
        const url = buildTreatmentSearchUrl(loadsMapImmediately);
        const statusFilter=document.getElementById("treatment-community-status-select")?.value||"all";
        const communitySearch=document.getElementById("treatment-alias-smart-input")?.value?.trim()||"";
        const communityUrl=`api/community_public.php?entity_type=treatment&search=${encodeURIComponent(communitySearch)}`;
        const [response,communityResponse] = await Promise.all([fetch(url,{signal:treatmentSearchController.signal}),statusFilter==="approved"?Promise.resolve(null):fetch(communityUrl,{signal:treatmentSearchController.signal})]);

        if (!response.ok) {
            throw new Error("Fehler beim Laden der Therapiedaten.");
        }

        const data = await response.json();

        if (requestId !== treatmentSearchRequestId) {
            return;
        }

        if (!data.ok || !Array.isArray(data.items)) {
            throw new Error("Unerwartetes API-Format.");
        }

        
		const communityData=communityResponse&&communityResponse.ok?await communityResponse.json():{items:[]};
		const regularItems=statusFilter==="unreviewed"?[]:data.items;
		let communityItems=Array.isArray(communityData.items)?communityData.items:[];
		const activeFilters=getTreatmentFilters();
		communityItems=communityItems.filter(function(item){
			if(activeFilters.category&&String(item.typ||"")!==activeFilters.category)return false;
			if(Number(item.positive_ratio||0)<activeFilters.minPositiveRatio||Number(item.negative_ratio||0)>activeFilters.maxNegativeRatio)return false;
			if(activeFilters.minProviderCount>0||activeFilters.onlyWithProvider||activeFilters.acceptsGkv)return false;
			return true;
		});
		const combined=statusFilter==="approved"?regularItems:regularItems.concat(communityItems);
		currentTreatments = combined.map(normalizeTreatment);
        visibleTreatmentCardCount = treatmentCardBatchSize;
        syncSelectedTreatmentsWithCurrentResults();
		currentCategories = Array.isArray(data.categories) ? data.categories : [];
		currentTreatmentMapData = data.map && typeof data.map === "object" ? data.map : null;

        applyClientSideTreatmentSort();

		populateTreatmentCategorySelect(currentCategories);

        updateTreatmentResultsCount(
            currentTreatments.length,
            currentTreatments.length
        );

        refreshTreatmentDisplay();

        if (!loadsMapImmediately && currentTreatmentUserLocation) {
            setTimeout(function () {
                loadTreatmentMapData(requestId, currentTreatments);
            }, 50);
        }

    } catch (error) {
        if (error.name === "AbortError") {
            return;
        }

        console.error("Fehler beim Laden der Therapien:", error);

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">Fehler beim Laden der Therapiedaten.</td>
                </tr>
            `;
        }

        if (cardResults) {
            cardResults.innerHTML = `
                <p class="treatment-empty-state">Fehler beim Laden der Therapiedaten.</p>
            `;
        }

        currentTreatmentMapData = null;
		updateTreatmentResultsCount(0, 0);
		renderTreatmentMap([], currentTreatmentMapData);
        updateTreatmentMapStatus("Die Kartendaten konnten nicht geladen werden.");
    }
}

async function loadTreatmentMapData(resultRequestId, treatments) {
    if (!currentTreatmentUserLocation || resultRequestId !== treatmentSearchRequestId) {
        return;
    }

    if (treatmentMapDataController) {
        treatmentMapDataController.abort();
    }

    treatmentMapDataController = new AbortController();
    const mapRequestId = ++treatmentMapRequestId;

    try {
        const response = await fetch(buildTreatmentSearchUrl(true), {
            signal: treatmentMapDataController.signal
        });

        if (!response.ok) {
            throw new Error("Fehler beim Laden der Kartendaten.");
        }

        const data = await response.json();

        if (
            resultRequestId !== treatmentSearchRequestId
            || mapRequestId !== treatmentMapRequestId
            || !data.ok
            || !Array.isArray(data.items)
        ) {
            return;
        }

        const mapItemsById = new Map(data.items.map(function (item) {
            return [Number(item.treat_id), item];
        }));

        treatments.forEach(function (treatment) {
            const mapItem = mapItemsById.get(Number(treatment.treat_id));

            if (!mapItem) {
                return;
            }

            treatment.nearest_provider = mapItem.nearest_provider || null;
            treatment.nearest_provider_distance_km = mapItem.nearest_provider_distance_km === null
                || mapItem.nearest_provider_distance_km === undefined
                ? null
                : Number(mapItem.nearest_provider_distance_km);
        });

        currentTreatmentMapData = data.map && typeof data.map === "object" ? data.map : null;
        refreshTreatmentDisplay();
    } catch (error) {
        if (error.name !== "AbortError") {
            console.warn("Kartendaten konnten nicht nachgeladen werden:", error);
            updateTreatmentMapStatus("Die Kartendaten konnten nicht geladen werden.");
        }
    }
}


function buildTreatmentSearchUrl(includeMap = false) {
    const filters = getTreatmentFilters();
    const params = new URLSearchParams();

    if (treatmentSmartSearchOverride && Array.isArray(treatmentSmartSearchOverride.treatIds)) {
        const treatIds = treatmentSmartSearchOverride.treatIds
            .map(function (id) {
                return Number(id);
            })
            .filter(function (id) {
                return Number.isFinite(id) && id > 0;
            });

        params.set("treat_ids", treatIds.length > 0 ? treatIds.join(",") : "0");
    } else {
        const activeSearchTerm = filters.searchTerm;

        if (activeSearchTerm !== "") {
            params.set("search", activeSearchTerm);
        }
    }

    if (filters.category !== "") {
        params.set("category", filters.category);
    }

    const currentCity = getCurrentTreatmentCity();

    if (filters.onlyCurrentCity && currentCity !== "") {
        params.set("provider_city", currentCity);
    }

    if (filters.radiusKm > 0 && currentTreatmentUserLocation) {
        params.set("provider_lat", String(currentTreatmentUserLocation.lat));
        params.set("provider_lng", String(currentTreatmentUserLocation.lng));
        params.set("radius_km", String(filters.radiusKm));
    }

    params.set("min_positive", String(filters.minPositiveRatio));
    params.set("max_negative", String(filters.maxNegativeRatio));
    params.set("min_provider", String(filters.minProviderCount));
    params.set("only_with_provider", filters.onlyWithProvider ? "1" : "0");
    params.set("accepts_gkv", filters.acceptsGkv ? "1" : "0");
    params.set("include_no_coords", filters.includeNoCoords ? "1" : "0");
    params.set("mapped_providers_only", filters.mappedProvidersOnly ? "1" : "0");

    if (filters.sortKey === "distance") {
        params.set("sort", "name");
        params.set("direction", "asc");
    } else if (filters.sortKey === "matching_provider_count" && !hasActiveTreatmentSearchArea()) {
        params.set("sort", "provider_count");
        params.set("direction", filters.sortDirection);
    } else {
        params.set("sort", filters.sortKey);
        params.set("direction", filters.sortDirection);
    }

    if (includeMap && currentTreatmentUserLocation) {
        params.set("include_map", "1");
        params.set("lat", String(currentTreatmentUserLocation.lat));
        params.set("lng", String(currentTreatmentUserLocation.lng));
    }

    return `api/treatments_search.php?${params.toString()}`;
}


function normalizeTreatment(treatment) {
    return {
        treat_id: Number(treatment.treat_id ?? 0),
        slug: treatment.slug || "",
        behandlung: treatment.behandlung || "",
        typ: treatment.typ || "",
        unterkategorie: treatment.unterkategorie || "",
        pro: Number(treatment.pro ?? 0),
        neutral: Number(treatment.neutral ?? 0),
        contra: Number(treatment.contra ?? 0),
        total_votes: Number(treatment.total_votes ?? 0),
        positive_ratio: Number(treatment.positive_ratio ?? 0),
        neutral_ratio: Number(treatment.neutral_ratio ?? 0),
        negative_ratio: Number(treatment.negative_ratio ?? 0),
        own_vote: ['pro', 'neutral', 'contra'].includes(treatment.own_vote) ? treatment.own_vote : null,
        is_community_preview: Boolean(treatment.is_community_preview),
        community_submission_id: Number(treatment.community_submission_id||0),
        community_status: treatment.community_status||null,
        provider_count: Number(treatment.provider_count ?? 0),
        total_provider_count: Number(treatment.total_provider_count ?? treatment.provider_count ?? 0),
        matching_provider_count: Number(treatment.matching_provider_count ?? 0),
        unlocated_provider_count: Number(treatment.unlocated_provider_count ?? 0),
        nearest_provider: normalizeNearestProvider(treatment.nearest_provider),
        nearest_provider_distance_km: treatment.nearest_provider_distance_km === null || treatment.nearest_provider_distance_km === undefined
            ? null
            : Number(treatment.nearest_provider_distance_km)
    };
}

function normalizeNearestProvider(provider) {
    if (!provider || !hasValidCoordinates(provider.loc_lat, provider.loc_lng)) {
        return null;
    }

    return {
        treat_id: Number(provider.treat_id ?? 0),
        dr_id: Number(provider.dr_id ?? 0),
        dr_display_name: provider.dr_display_name || "",
        loc_label: provider.loc_label || "",
        loc_country: provider.loc_country || "",
        loc_plz: provider.loc_plz || "",
        loc_city: provider.loc_city || "",
        loc_street: provider.loc_street || "",
        loc_housenumber: provider.loc_housenumber || "",
        loc_phone: provider.loc_phone || "",
        loc_email: provider.loc_email || "",
        loc_website: provider.loc_website || "",
        loc_lat: Number(provider.loc_lat),
        loc_lng: Number(provider.loc_lng),
        distance_km: provider.distance_km === null || provider.distance_km === undefined
            ? null
            : Number(provider.distance_km)
    };
}

function bindTreatmentNavigationEvents() {
    const navigationToggleButton = document.getElementById("treatment-navigation-toggle-button");
    const navigationContent = document.getElementById("treatment-navigation-content");

    if (navigationToggleButton && navigationContent) {
        navigationToggleButton.addEventListener("click", function () {
            const isCollapsed = navigationContent.classList.toggle("is-collapsed");
            navigationToggleButton.classList.toggle("is-collapsed", isCollapsed);
            navigationToggleButton.setAttribute("aria-expanded", String(!isCollapsed));
        });
    }

    const resetButton = document.getElementById("treatment-filter-reset-button");
    const sortSelects = [
        document.getElementById("treatment-sort-select"),
        document.getElementById("treatment-results-sort-select")
    ].filter(Boolean);
    const categorySelect = document.getElementById("treatment-category-select");
    const onlyWithProviderInput = document.getElementById("treatment-only-with-provider-input");
    const acceptsGkvInput = document.getElementById("treatment-accepts-gkv-input");
    const mappedProvidersOnlyInput = document.getElementById("treatment-mapped-providers-only-input");
    const radiusEnabledInput = document.getElementById("treatment-radius-enabled-input");
    const includeNoCoordsInput = document.getElementById("treatment-include-no-coords-input");
    const radiusInput = document.getElementById("treatment-radius-input");
    const minProviderInput = document.getElementById("treatment-min-provider-input");
    const locationInput = document.getElementById("treatment-location-input");
    const locationClearButton = document.getElementById("treatment-location-clear-button");

    if (resetButton) {
        resetButton.addEventListener("click", resetTreatmentFilters);
    }

    updateTreatmentSortSelects();

    sortSelects.forEach(function (sortSelect) {
        sortSelect.addEventListener("change", function () {
            sortSelects.forEach(function (otherSelect) {
                otherSelect.value = sortSelect.value;
            });
            currentTreatmentTableSortKey = null;
            currentTreatmentTableSortDirection = "asc";
            applyTreatmentFiltersFromControls();
        });
    });

    if (categorySelect) {
        categorySelect.addEventListener("change", function () {
            applyTreatmentFiltersFromControls();
        });
    }

    if (radiusInput) {
        radiusInput.addEventListener("blur", function () {
            normalizeRadiusInput();
        });

        radiusInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                normalizeRadiusInput();
                applyTreatmentFiltersFromControls();
            }
        });
    }

    if (onlyWithProviderInput) {
        onlyWithProviderInput.addEventListener("change", function () {
            if (onlyWithProviderInput.checked && minProviderInput) {
                minProviderInput.value = Math.max(1, Number(minProviderInput.value || 0));
            }

            applyTreatmentFiltersFromControls();
        });
    }

    if (acceptsGkvInput) {
        acceptsGkvInput.addEventListener("change", applyTreatmentFiltersFromControls);
    }

    if (mappedProvidersOnlyInput) {
        mappedProvidersOnlyInput.addEventListener("change", function () {
            updateTreatmentRadiusInputState();
            applyTreatmentFiltersFromControls();
        });
    }

    if (radiusEnabledInput) {
        radiusEnabledInput.addEventListener("change", function () {
            updateTreatmentRadiusInputState();
            applyTreatmentFiltersFromControls();
        });
    }

    if (includeNoCoordsInput) {
        includeNoCoordsInput.addEventListener("change", applyTreatmentFiltersFromControls);
    }

    if (minProviderInput) {
        minProviderInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyTreatmentFiltersFromControls();
            }
        });
    }

    if (locationClearButton) {
        locationClearButton.addEventListener("click", function () {
            resetTreatmentLocation();
        });
    }

    if (locationInput) {
        locationInput.addEventListener("input", function () {
            updateTreatmentLocationClearButton();
            scheduleTreatmentLocationSuggestions();
        });

        locationInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                hideTreatmentLocationSuggestions();
                applyTreatmentLocationFromInput();
            }

            if (event.key === "Escape") hideTreatmentLocationSuggestions();
        });
    }

    const locationSuggestions = document.getElementById("treatment-location-suggestions");
    if (locationSuggestions) {
        locationSuggestions.addEventListener("click", function (event) {
            const button = event.target.closest("[data-location-suggestion-index]");
            if (!button) return;
            const suggestion = treatmentLocationSuggestions[Number(button.dataset.locationSuggestionIndex)];
            if (!suggestion || !locationInput) return;
            locationInput.value = suggestion.formatted;
            hideTreatmentLocationSuggestions();
            applyTreatmentLocationFromInput();
        });
    }

    bindRangePair(
        "treatment-min-positive-range",
        "treatment-min-positive-input",
        applyTreatmentFiltersFromControls
    );

    bindRangePair(
        "treatment-max-negative-range",
        "treatment-max-negative-input",
        applyTreatmentFiltersFromControls
    );

    bindTreatmentTableSortControls();
}

function updateTreatmentSortSelects() {
    const source = document.getElementById("treatment-sort-select");
    const value = source ? source.value : "name:asc";

    [
        document.getElementById("treatment-sort-select"),
        document.getElementById("treatment-results-sort-select")
    ].filter(Boolean).forEach(function (select) {
        select.value = value;
    });

    updateTreatmentSortAvailability();
}

function hasActiveTreatmentSearchArea() {
    const radiusEnabledInput = document.getElementById("treatment-radius-enabled-input");

    return Boolean(currentTreatmentUserLocation) && (
        currentTreatmentLocationMode === "city"
        || (currentTreatmentLocationMode === "radius" && Boolean(radiusEnabledInput?.checked))
    );
}

function updateTreatmentSortAvailability() {
    const searchAreaActive = hasActiveTreatmentSearchArea();
    const sortSelects = [
        document.getElementById("treatment-sort-select"),
        document.getElementById("treatment-results-sort-select")
    ].filter(Boolean);

    sortSelects.forEach(function (select) {
        Array.from(select.options).forEach(function (option) {
            if (option.value.startsWith("matching_provider_count:")) {
                option.disabled = false;
            }
        });
    });

}

function scheduleTreatmentAutoApply(delay = 300) {
    clearTimeout(treatmentAutoApplyTimer);
    treatmentSearchRequestId += 1;
    treatmentMapRequestId += 1;

    if (treatmentSearchController) {
        treatmentSearchController.abort();
    }
    if (treatmentMapDataController) {
        treatmentMapDataController.abort();
    }

    treatmentAutoApplyTimer = setTimeout(runTreatmentFilterLoad, delay);
}

function scheduleTreatmentLocationSuggestions() {
    clearTimeout(treatmentLocationSuggestionTimer);
    const input = document.getElementById("treatment-location-input");
    const query = input ? String(input.value || "").trim() : "";

    if (query.length < 3) {
        hideTreatmentLocationSuggestions();
        return;
    }

    treatmentLocationSuggestionTimer = setTimeout(function () {
        loadTreatmentLocationSuggestions(query);
    }, 300);
}

async function loadTreatmentLocationSuggestions(query) {
    if (treatmentLocationSuggestionController) treatmentLocationSuggestionController.abort();
    treatmentLocationSuggestionController = new AbortController();

    try {
        const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`, {
            signal: treatmentLocationSuggestionController.signal
        });
        if (!response.ok) throw new Error("Standortvorschläge konnten nicht geladen werden.");
        const data = await response.json();
        treatmentLocationSuggestions = Array.isArray(data.results) ? data.results : [];
        renderTreatmentLocationSuggestions();
    } catch (error) {
        if (error.name !== "AbortError") hideTreatmentLocationSuggestions();
    }
}

function renderTreatmentLocationSuggestions() {
    const box = document.getElementById("treatment-location-suggestions");
    if (!box) return;
    box.innerHTML = treatmentLocationSuggestions.map(function (suggestion, index) {
        return `<button class="location-suggestion-button" type="button" role="option" data-location-suggestion-index="${index}">${escapeHtml(suggestion.formatted || "")}</button>`;
    }).join("");
    box.classList.toggle("is-hidden", treatmentLocationSuggestions.length === 0);
}

function hideTreatmentLocationSuggestions() {
    const box = document.getElementById("treatment-location-suggestions");
    if (box) box.classList.add("is-hidden");
}

function applyTreatmentFiltersFromControls() {
    scheduleTreatmentAutoApply(250);
}

function runTreatmentFilterLoad() {
    treatmentAutoApplyTimer = null;

    if (validateLocationDependentFilters()) {
        loadTreatmentResults();
    }
}

function bindTreatmentSmartSearchEvents() {
    const input = document.getElementById("treatment-alias-smart-input");
    const suggestionsBox = document.getElementById("treatment-alias-smart-suggestions");

    if (input) {
		input.addEventListener("input", function () {
			const query = String(input.value || "").trim();

            if (showOnlyTreatmentCompareSelection) {
                showOnlyTreatmentCompareSelection = false;
                currentTreatmentCompareMapData = null;
                currentTreatmentCompareMapKey = "";
                refreshTreatmentDisplay();
            }

			if (query === "") {
				treatmentSmartSearchOverride = null;
				treatmentAliasSmartSuggestions = [];
				hideTreatmentAliasSmartSuggestions();
				setTreatmentAliasSmartStatus("Suche nach direktem Therapienamen, Alias/Synonym oder Oberbegriff/Kombibegriff.");

				return;
			}

			if (query.length < 2) {
				treatmentAliasSmartSuggestions = [];
				hideTreatmentAliasSmartSuggestions();
				return;
			}

			loadTreatmentAliasSmartSuggestions(query);
		});
	
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyTreatmentAliasSmartGroup("direct");
            }

            if (event.key === "Escape") {
                hideTreatmentAliasSmartSuggestions();
            }
        });

        input.addEventListener("focus", function () {
            if (treatmentAliasSmartSuggestions.length > 0) {
                renderTreatmentAliasSmartSuggestions(treatmentAliasSmartSuggestions, String(input.value || "").trim());
            }
        });
    }

    if (suggestionsBox) {
        suggestionsBox.addEventListener("mousedown", function (event) {
            const groupButton = event.target.closest(".treatment-alias-smart-group-button");

            if (!groupButton) {
                return;
            }

            event.preventDefault();
            applyTreatmentAliasSmartGroup(groupButton.dataset.groupKey || "direct");
        });
    }

    document.addEventListener("click", function (event) {
        const panel = event.target.closest(".treatment-alias-smart-panel");

        if (!panel) {
            hideTreatmentAliasSmartSuggestions();
        }
    });
}

async function loadTreatmentAliasSmartSuggestions(query) {
    try {
        if (treatmentAliasSmartSuggestController) {
            treatmentAliasSmartSuggestController.abort();
        }

        treatmentAliasSmartSuggestController = new AbortController();

        const params = new URLSearchParams();
        params.set("alias_suggest", "smart");
        params.set("q", query);

        const response = await fetch(`api/treatments_search.php?${params.toString()}`, {
            signal: treatmentAliasSmartSuggestController.signal
        });

        if (!response.ok) {
            throw new Error("Intelligente Suchvorschläge konnten nicht geladen werden.");
        }

        const data = await response.json();

        if (!data.ok || !Array.isArray(data.suggestions)) {
            treatmentAliasSmartSuggestions = [];
            renderTreatmentAliasSmartSuggestions([], query);
            return;
        }

        treatmentAliasSmartSuggestions = data.suggestions;
        renderTreatmentAliasSmartSuggestions(treatmentAliasSmartSuggestions, query);

    } catch (error) {
        if (error.name !== "AbortError") {
            console.warn("Intelligente Suchvorschläge konnten nicht geladen werden:", error);
        }
    }
}

function renderTreatmentAliasSmartSuggestions(suggestions, query) {
    const suggestionsBox = document.getElementById("treatment-alias-smart-suggestions");

    if (!suggestionsBox) {
        return;
    }

    const groupedSuggestions = groupTreatmentAliasSmartSuggestions(suggestions || [], query || "");
    const groupOrder = ["direct", "alias", "extended"];

    suggestionsBox.innerHTML = groupOrder.map(function (groupKey) {
        const group = groupedSuggestions[groupKey];
        const hasItems = group.items.length > 0;
        const itemsHtml = hasItems
            ? group.items.map(function (suggestion) {
                return `
                    <li class="treatment-alias-smart-item">
                        <span class="treatment-alias-smart-item-label">${escapeHtml(suggestion.label || "")}</span>
                    </li>
                `;
            }).join("")
            : `<li class="treatment-alias-smart-item treatment-alias-smart-item-empty">Keine Treffer in dieser Kategorie.</li>`;

        return `
            <section class="treatment-alias-smart-group" data-group-key="${escapeHtml(groupKey)}">
                <button
                    type="button"
                    class="treatment-alias-smart-group-button"
                    data-group-key="${escapeHtml(groupKey)}"
                >
                    <span class="treatment-alias-smart-group-title">${escapeHtml(group.label)}</span>
                    <span class="treatment-alias-smart-group-meta">${hasItems ? `${group.items.length} Vorschlag/Vorschläge anwenden` : "leere Suche anwenden"}</span>
                </button>

                <ul class="treatment-alias-smart-list">
                    ${itemsHtml}
                </ul>
            </section>
        `;
    }).join("");

    suggestionsBox.classList.remove("is-hidden");
}

function groupTreatmentAliasSmartSuggestions(suggestions, query) {
    const groups = {
        direct: {
            label: "Direkte Treffer",
            searchMode: "basic",
            searchValue: query,
            items: []
        },
        alias: {
            label: "Alias / Synonym",
            searchMode: "alias_direct",
            searchValue: query,
            items: []
        },
        extended: {
            label: "Oberbegriff / Kombibegriff",
            searchMode: "alias_extended",
            searchValue: query,
            items: []
        }
    };

    const seen = {
        direct: new Set(),
        alias: new Set(),
        extended: new Set()
    };

    suggestions.forEach(function (suggestion) {
        const groupKey = suggestion.group_key || "extended";

        if (!groups[groupKey]) {
            return;
        }

        const treatId = Number(suggestion.treat_id || 0);
        const label = String(suggestion.label || "").trim();
        const key = treatId ? `${groupKey}:id:${treatId}` : `${groupKey}:label:${label}`;

        if (seen[groupKey].has(key)) {
            return;
        }

        seen[groupKey].add(key);
        groups[groupKey].items.push(suggestion);
    });

    return groups;
}

function applyTreatmentAliasSmartGroup(groupKey) {
    const input = document.getElementById("treatment-alias-smart-input");
    const query = input ? String(input.value || "").trim() : "";

    if (query === "") {
        treatmentSmartSearchOverride = null;
        treatmentAliasSmartSuggestions = [];
        hideTreatmentAliasSmartSuggestions();
        setTreatmentAliasSmartStatus("Suche nach direktem Therapienamen, Alias/Synonym oder Oberbegriff/Kombibegriff.");

        if (validateLocationDependentFilters()) {
            loadTreatmentResults();
        }

        return;
    }

    const groups = groupTreatmentAliasSmartSuggestions(treatmentAliasSmartSuggestions, query);
    const group = groups[groupKey] || groups.direct;

    const treatIds = group.items
        .map(function (suggestion) {
            return Number(suggestion.treat_id || 0);
        })
        .filter(function (treatId) {
            return Number.isFinite(treatId) && treatId > 0;
        });

    const uniqueTreatIds = Array.from(new Set(treatIds));

    treatmentSmartSearchOverride = {
        treatIds: uniqueTreatIds,
        searchTerm: query,
        searchMode: group.searchMode,
        searchGroup: groupKey
    };

    const countText = uniqueTreatIds.length === 1
        ? "1 Therapie"
        : `${uniqueTreatIds.length} Therapien`;

    setTreatmentAliasSmartStatus(`Suche aktiv: ${group.label} · ${countText} aus der Vorschlagsgruppe · „${query}“.`);

    hideTreatmentAliasSmartSuggestions();

    if (!validateLocationDependentFilters()) {
        return;
    }

    loadTreatmentResults();
}

function setTreatmentAliasSmartStatus(message) {
    const status = document.getElementById("treatment-alias-smart-status");

    if (status) {
        status.textContent = message;
    }
}

function hideTreatmentAliasSmartSuggestions() {
    const suggestionsBox = document.getElementById("treatment-alias-smart-suggestions");

    if (!suggestionsBox) {
        return;
    }

    suggestionsBox.classList.add("is-hidden");
}

function normalizeRadiusInput() {
    const radiusInput = document.getElementById("treatment-radius-input");

    if (!radiusInput) {
        return;
    }

    const radius = clampNumber(radiusInput.value, 0, 1000);
    radiusInput.value = String(radius);
}

function validateLocationDependentFilters() {
    const filters = getTreatmentFilters();

    if (!filters.onlyCurrentCity && filters.radiusKm <= 0) {
        return true;
    }

    if (!currentTreatmentUserLocation) {
        updateTreatmentLocationStatus("Bitte eine Adresse oder einen Ort eingeben.");
        return false;
    }

    if (filters.onlyCurrentCity && !getCurrentTreatmentCity()) {
        alert("Aus dem Kartenstandort konnte keine Stadt erkannt werden. Bitte gib den Standort eindeutiger ein, z. B. 50677 Köln.");

        setTreatmentLocationMode("radius");

        return false;
    }

    return true;
}

function bindTreatmentViewSwitchEvents() {
    const cardButton = document.getElementById("treatment-card-view-button");
    const tableButton = document.getElementById("treatment-table-view-button");

    if (cardButton) {
        cardButton.addEventListener("click", function () {
            setTreatmentViewMode("cards");
        });
    }

    if (tableButton) {
        tableButton.addEventListener("click", function () {
            setTreatmentViewMode("table");
        });
    }
}


function bindTreatmentCompareControls() {
    const compareSelection = document.getElementById("treatment-compare-selection");
    const hitViewButton = document.getElementById("treatment-results-hit-view-button");
    const compareViewButton = document.getElementById("treatment-compare-show-button");
    const clearButton = document.getElementById("treatment-compare-clear-button");

    if (compareSelection) {
        compareSelection.addEventListener("click", function (event) {
            const removeButton = event.target.closest(".treatment-compare-chip-remove");

            if (removeButton) {
                removeTreatmentFromCompareSelection(Number(removeButton.getAttribute("data-treat-id")));
            }
        });
    }

    if (hitViewButton) {
        hitViewButton.addEventListener("click", function () {
            showOnlyTreatmentCompareSelection = false;
            refreshTreatmentDisplay();
        });
    }

    if (compareViewButton) {
        compareViewButton.addEventListener("click", function () {
            if (selectedTreatmentsForCompare.length === 0) {
                return;
            }

            showOnlyTreatmentCompareSelection = true;
            refreshTreatmentDisplay();
        });
    }

    if (clearButton) {
        clearButton.addEventListener("click", function () {
            selectedTreatmentsForCompare = [];
            showOnlyTreatmentCompareSelection = false;
            currentTreatmentCompareMapData = null;
            currentTreatmentCompareMapKey = "";
            refreshTreatmentDisplay();
        });
    }

    renderTreatmentCompareSelection();
}


function bindTreatmentCardContainerEvents() {
    const cardResults = document.getElementById("treatment-card-results");
    const loadMoreButton = document.getElementById("treatment-cards-load-more-button");

    if (!cardResults) {
        return;
    }

    if (loadMoreButton) {
        loadMoreButton.addEventListener("click", function () {
            visibleTreatmentCardCount += treatmentCardBatchSize;
            renderTreatmentCards(getDisplayedTreatments());
        });
    }

    cardResults.addEventListener("click", function (event) {
        const compareButton = event.target.closest(".treatment-compare-add-button");

        if (compareButton) {
            handleTreatmentCompareClick(compareButton);
            return;
        }

        const voteButton = event.target.closest(".treatment-card-vote-button");

        if (voteButton) {
            const treatmentName = voteButton.dataset.treatmentName || "";
            const voteType = voteButton.dataset.voteType || "";
            const treatId = Number(voteButton.dataset.treatId || 0);

            submitTreatmentVote(treatId, treatmentName, voteType, voteButton);
            return;
        }

    });
}

function bindTreatmentTableContainerEvents() {
    const tableBody = document.getElementById("treatment-results-body");

    if (!tableBody) {
        return;
    }

    tableBody.addEventListener("click", function (event) {
        const compareButton = event.target.closest(".treatment-compare-add-button");

        if (compareButton) {
            handleTreatmentCompareClick(compareButton);
            return;
        }

        const voteButton = event.target.closest(".treatment-table-vote-button");
        if (voteButton) {
            submitTreatmentVote(
                Number(voteButton.dataset.treatId || 0),
                voteButton.dataset.treatmentName || "Behandlung",
                voteButton.dataset.voteType || "",
                voteButton
            );
        }
    });
}

function setTreatmentViewMode(viewMode) {
    currentViewMode = viewMode === "table" ? "table" : "cards";
    try { localStorage.setItem("lcn_result_view_preference", currentViewMode); } catch (_) {}

    const cardSection = document.getElementById("treatment-card-results-section");
    const tableSection = document.getElementById("treatment-table-results-section");
    const cardButton = document.getElementById("treatment-card-view-button");
    const tableButton = document.getElementById("treatment-table-view-button");

    if (cardSection) {
        cardSection.classList.toggle("is-hidden", currentViewMode !== "cards");
    }

    if (tableSection) {
        tableSection.classList.toggle("is-hidden", currentViewMode !== "table");
    }

    if (cardButton) {
        cardButton.classList.toggle("is-active", currentViewMode === "cards");
    }

    if (tableButton) {
        tableButton.classList.toggle("is-active", currentViewMode === "table");
    }

    renderCurrentTreatmentView();
}

function getDisplayedTreatments() {
    return showOnlyTreatmentCompareSelection ? selectedTreatmentsForCompare : currentTreatments;
}

function refreshTreatmentDisplay() {
    const displayedTreatments = getDisplayedTreatments();

    renderCurrentTreatmentView();
    renderTreatmentCompareSelection();

    renderTreatmentMap(
        displayedTreatments,
        getTreatmentMapDataForCurrentView(displayedTreatments)
    );

    refreshTreatmentCompareMapDataIfNeeded(displayedTreatments);
}

function renderCurrentTreatmentView() {
    const tableBody = document.getElementById("treatment-results-body");
    const cardResults = document.getElementById("treatment-card-results");
    const displayedTreatments = getDisplayedTreatments();

    if (currentViewMode === "cards") {
        if (tableBody) {
            tableBody.innerHTML = "";
        }

        renderTreatmentCards(displayedTreatments);
        return;
    }

    if (cardResults) {
        cardResults.innerHTML = "";
    }

    renderTreatmentResultsTable(displayedTreatments);
}

function bindRangePair(rangeId, numberId, onChangeCallback) {
    const rangeInput = document.getElementById(rangeId);
    const numberInput = document.getElementById(numberId);

    if (!rangeInput || !numberInput) {
        return;
    }

    rangeInput.addEventListener("input", function () {
        numberInput.value = rangeInput.value;
    });

    rangeInput.addEventListener("change", onChangeCallback);

    numberInput.addEventListener("input", function () {
        const clampedValue = clampNumber(numberInput.value, 0, 100);
        rangeInput.value = clampedValue;
    });

    numberInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            const clampedValue = clampNumber(numberInput.value, 0, 100);
            numberInput.value = clampedValue;
            rangeInput.value = clampedValue;
            onChangeCallback();
        }
    });

    numberInput.addEventListener("blur", function () {
        const clampedValue = clampNumber(numberInput.value, 0, 100);
        numberInput.value = clampedValue;
        rangeInput.value = clampedValue;
    });
}

function populateTreatmentCategorySelect(categories) {
    const categorySelect = document.getElementById("treatment-category-select");

    if (!categorySelect) {
        return;
    }

    const currentValue = categorySelect.value;

    categorySelect.innerHTML = `
        <option value="">Alle Kategorien</option>
        ${(categories || []).map(function (category) {
            return `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`;
        }).join("")}
    `;

    categorySelect.value = currentValue;
}

function getTreatmentFilters() {
    const sortSelect = document.getElementById("treatment-sort-select");
    const categorySelect = document.getElementById("treatment-category-select");
    const minPositiveInput = document.getElementById("treatment-min-positive-input");
    const maxNegativeInput = document.getElementById("treatment-max-negative-input");
    const minProviderInput = document.getElementById("treatment-min-provider-input");
    const onlyWithProviderInput = document.getElementById("treatment-only-with-provider-input");
    const acceptsGkvInput = document.getElementById("treatment-accepts-gkv-input");
    const mappedProvidersOnlyInput = document.getElementById("treatment-mapped-providers-only-input");
    const radiusEnabledInput = document.getElementById("treatment-radius-enabled-input");
    const radiusInput = document.getElementById("treatment-radius-input");
    const includeNoCoordsInput = document.getElementById("treatment-include-no-coords-input");

    const sortValue = sortSelect ? sortSelect.value : "name:asc";
    const sortParts = sortValue.split(":");

    const onlyWithProvider = onlyWithProviderInput ? onlyWithProviderInput.checked : false;

    let minProviderCount = minProviderInput
        ? Math.max(0, Number(minProviderInput.value || 0))
        : 0;

    if (onlyWithProvider) {
        minProviderCount = Math.max(1, minProviderCount);
    }

    return {
        sortKey: sortParts[0] || "name",
        sortDirection: sortParts[1] || "asc",
		searchTerm: "",
        category: categorySelect ? String(categorySelect.value || "").trim() : "",
        onlyCurrentCity: currentTreatmentLocationMode === "city",
        radiusKm: currentTreatmentLocationMode === "radius" && radiusEnabledInput && radiusEnabledInput.checked && radiusInput
            ? clampNumber(radiusInput.value, 0, 1000)
            : 0,
        minPositiveRatio: minPositiveInput ? clampNumber(minPositiveInput.value, 0, 100) : 0,
        maxNegativeRatio: maxNegativeInput ? clampNumber(maxNegativeInput.value, 0, 100) : 100,
        minProviderCount: minProviderCount,
        onlyWithProvider: onlyWithProvider,
        acceptsGkv: Boolean(acceptsGkvInput?.checked),
        mappedProvidersOnly: Boolean(mappedProvidersOnlyInput?.checked),
        includeNoCoords: Boolean(includeNoCoordsInput?.checked)
            && Boolean(radiusEnabledInput?.checked)
            && !Boolean(mappedProvidersOnlyInput?.checked)
    };
}

function applyClientSideTreatmentSort() {
    const filters = getTreatmentFilters();
    const directionFactor = filters.sortDirection === "desc" ? -1 : 1;

    currentTreatments.sort(function (a, b) {
        let result=0;
        if(filters.sortKey==="name")result=String(a.behandlung||"").localeCompare(String(b.behandlung||""),"de",{sensitivity:"base"});
        else if(filters.sortKey==="positive_ratio")result=Number(a.positive_ratio||0)-Number(b.positive_ratio||0);
        else if(filters.sortKey==="negative_ratio")result=Number(a.negative_ratio||0)-Number(b.negative_ratio||0);
        else if(filters.sortKey==="total_votes")result=Number(a.total_votes||0)-Number(b.total_votes||0);
        else if(filters.sortKey==="provider_count")result=Number(a.provider_count||0)-Number(b.provider_count||0);
        else if(filters.sortKey==="matching_provider_count")result=Number(a.matching_provider_count||0)-Number(b.matching_provider_count||0);
        else if(filters.sortKey==="distance"){
            const distanceA=a.nearest_provider_distance_km===null?Infinity:Number(a.nearest_provider_distance_km);
            const distanceB=b.nearest_provider_distance_km===null?Infinity:Number(b.nearest_provider_distance_km);
            result=Number.isFinite(distanceA)||Number.isFinite(distanceB)?distanceA-distanceB:0;
        }
        return result===0?String(a.behandlung||"").localeCompare(String(b.behandlung||""),"de",{sensitivity:"base"}):result*directionFactor;
    });
}

function resetTreatmentFilters() {
    clearTimeout(treatmentAutoApplyTimer);
    treatmentAutoApplyTimer = null;

    if (treatmentAliasSmartSuggestController) {
        treatmentAliasSmartSuggestController.abort();
        treatmentAliasSmartSuggestController = null;
    }

    treatmentSmartSearchOverride = null;
    treatmentAliasSmartSuggestions = [];
    showOnlyTreatmentCompareSelection = false;
    currentTreatmentCompareMapData = null;
    currentTreatmentCompareMapKey = "";
    currentTreatmentTableSortKey = null;
    currentTreatmentTableSortDirection = "asc";
    hideTreatmentAliasSmartSuggestions();
    setInputValue("treatment-alias-smart-input", "");
    setTreatmentAliasSmartStatus("Suche nach direktem Therapienamen, Alias/Synonym oder Oberbegriff/Kombibegriff.");
    setInputValue("treatment-sort-select", "name:asc");
    setInputValue("treatment-community-status-select", "all");
    setInputValue("treatment-category-select", "");
    setInputValue("treatment-min-positive-range", "0");
    setInputValue("treatment-min-positive-input", "0");
    setInputValue("treatment-max-negative-range", "100");
    setInputValue("treatment-max-negative-input", "100");
    setInputValue("treatment-min-provider-input", "0");
    setInputValue("treatment-radius-input", "100");

    const onlyWithProviderInput = document.getElementById("treatment-only-with-provider-input");
    const radiusEnabledInput = document.getElementById("treatment-radius-enabled-input");
    const acceptsGkvInput = document.getElementById("treatment-accepts-gkv-input");
    const mappedProvidersOnlyInput = document.getElementById("treatment-mapped-providers-only-input");
    const includeNoCoordsInput = document.getElementById("treatment-include-no-coords-input");

    if (onlyWithProviderInput) {
        onlyWithProviderInput.checked = false;
    }

    if (acceptsGkvInput) {
        acceptsGkvInput.checked = false;
    }

    if (mappedProvidersOnlyInput) {
        mappedProvidersOnlyInput.checked = false;
    }

    if (includeNoCoordsInput) {
        includeNoCoordsInput.checked = false;
    }

    if (radiusEnabledInput) {
        radiusEnabledInput.checked = false;
    }

    setTreatmentLocationMode("radius");
    updateTreatmentRadiusInputState();
    updateTreatmentSortSelects();
    loadTreatmentResults();
}

function bindTreatmentTableSortControls() {
    const table = document.querySelector(".treatment-results-table");
    if (!table) return;

    table.addEventListener("click", function (event) {
        const button = event.target.closest("[data-table-sort-key]");
        if (!button || !table.contains(button)) return;

        const key = button.dataset.tableSortKey;
        if (currentTreatmentTableSortKey === key) {
            currentTreatmentTableSortDirection = currentTreatmentTableSortDirection === "asc" ? "desc" : "asc";
        } else {
            currentTreatmentTableSortKey = key;
            currentTreatmentTableSortDirection = [
                "experience",
                "experience-negative",
                "provider",
                "provider-total",
                "provider-area"
            ].includes(key) ? "desc" : "asc";
        }

        renderTreatmentResultsTable(getDisplayedTreatments());
    });
}

function setInputValue(id, value) {
    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.value = value;
}

function buildTreatmentTableRowHtml(treatment, rank, presentation) {
    const treatmentName = escapeHtml(treatment.behandlung || "Unbekannte Therapie");
    const categoryHtml = buildTreatmentCategoryHtml(treatment);
    const experienceHtml = buildTreatmentExperienceHtml(treatment, presentation.experienceMode);
    const providerHtml = buildTreatmentProviderHtml(treatment);
    const metricHtml = presentation.isMobile
        ? buildTreatmentMobileMetricHtml(treatment, presentation.metricMode)
        : buildTreatmentDistanceLocationHtml(treatment);
    const isSelected = isTreatmentSelectedForCompare(treatment.treat_id);

    return `
        <tr data-treat-id="${treatment.treat_id}">
            <td class="treatment-table-rank">${rank}</td>
            <td class="treatment-table-name">
                <div class="treatment-table-name-stack">
					${treatment.is_community_preview?`<strong>${treatmentName}</strong><span class="community-preview-badge">Noch nicht geprüft</span>`:`<a class="treatment-table-detail-link" href="therapie_detail.html?treat_id=${encodeURIComponent(treatment.treat_id)}">${treatmentName}</a>`}
                    <button
                        type="button"
                        class="treatment-compare-add-button treatment-compare-add-button-table ${isSelected ? "is-selected" : ""}"
                        data-treat-id="${escapeHtml(treatment.treat_id)}"
                    >
                        ${isSelected ? "Ausgewählt" : "+ vergleichen"}
                    </button>
                </div>
            </td>
            <td>${categoryHtml}</td>
            <td>${experienceHtml}</td>
            <td>${providerHtml}</td>
            <td>${metricHtml}</td>
        </tr>
    `;
}

function buildTreatmentMobileMetricHtml(treatment, mode) {
    if (mode === "provider-total") {
        return `<div class="treatment-table-mobile-provider-count">${Number(treatment.provider_count ?? 0)}</div>`;
    }

    if (mode === "provider-area") {
        const totalCount = Number(treatment.total_provider_count ?? treatment.provider_count ?? 0);
        const matchingCount = hasActiveTreatmentSearchArea()
            ? Number(treatment.matching_provider_count ?? 0)
            : totalCount;
        return `
            <div class="treatment-table-mobile-provider-count">${matchingCount}</div>
            <div class="treatment-table-muted">von ${totalCount}</div>
        `;
    }

    return buildTreatmentDistanceLocationHtml(treatment);
}

function updateTreatmentMobileTablePresentation() {
    const table = document.querySelector(".treatment-results-table");
    const filters = getTreatmentFilters();
    const experienceButton = document.getElementById("treatment-table-experience-button");
    const experienceHeading = document.getElementById("treatment-table-experience-heading");
    const metricButton = document.getElementById("treatment-table-metric-button");
    const metricHeading = document.getElementById("treatment-table-metric-heading");
    const providerHeading = document.getElementById("treatment-table-provider-heading");
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const experienceMode = isMobile && filters.sortKey === "negative_ratio" ? "negative" : isMobile ? "positive" : "all";
    let metricMode = "location";

    if (isMobile && filters.sortKey === "provider_count") {
        metricMode = "provider-total";
    } else if (isMobile && filters.sortKey === "matching_provider_count") {
        metricMode = "provider-area";
    }

    if (table) {
        table.dataset.mobileMetric = metricMode;
        table.dataset.mobileExperience = experienceMode;
    }

    if (experienceButton) {
        experienceButton.dataset.tableSortKey = experienceMode === "negative" ? "experience-negative" : "experience";
    }

    if (experienceHeading) {
        experienceHeading.textContent = experienceMode === "negative" ? "Negativ" : experienceMode === "positive" ? "Positiv" : "Erfahrung";
    }

    if (metricButton) {
        metricButton.dataset.tableSortKey = metricMode;
    }

    if (metricHeading) {
        metricHeading.textContent = metricMode === "provider-total"
            ? "Anbieter gesamt"
            : metricMode === "provider-area"
                ? "Im Suchgebiet"
                : "Entfernung / Ort";
    }

    if (providerHeading) {
        const searchAreaActive = hasActiveTreatmentSearchArea() || filters.sortKey === "matching_provider_count";
        providerHeading.textContent = searchAreaActive ? "Suchgebiet / Gesamt" : "Anbieter gesamt";
        providerHeading.title = searchAreaActive
            ? "Anbieter im aktiven Suchgebiet / Anbieter insgesamt"
            : "Anbieter insgesamt";
    }

    return { isMobile, metricMode, experienceMode };
}


function buildTreatmentDistanceLocationHtml(treatment) {
    const distanceText = treatment.nearest_provider_distance_km === null
        ? ""
        : `<div class="treatment-table-main-value">${escapeHtml(formatDistanceKm(treatment.nearest_provider_distance_km))}</div>`;

    const cityText = treatment.nearest_provider && treatment.nearest_provider.loc_city
        ? `<div class="treatment-table-muted">${escapeHtml(treatment.nearest_provider.loc_city)}</div>`
        : "";

    if (!distanceText && !cityText) {
        return `<span class="treatment-table-muted">—</span>`;
    }

    return `
        <div class="treatment-table-stacked-cell">
            ${distanceText}
            ${cityText}
        </div>
    `;
}

function renderTreatmentResultsTable(treatments) {
    const tableBody = document.getElementById("treatment-results-body");

    if (!tableBody) {
        return;
    }

    const presentation = updateTreatmentMobileTablePresentation();

    if (!treatments || treatments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">Keine Therapien gefunden.</td>
            </tr>
        `;
        return;
    }

    const rows = treatments.map(function (treatment, index) {
        const globalIndex = currentTreatments.findIndex(function (currentTreatment) {
            return Number(currentTreatment.treat_id) === Number(treatment.treat_id);
        });
        return { treatment, rank: globalIndex >= 0 ? globalIndex + 1 : index + 1, originalIndex: index };
    });

    sortTreatmentTableRows(rows);
    updateTreatmentTableSortHeaders();

    tableBody.innerHTML = rows.map(function (row) {
        return buildTreatmentTableRowHtml(row.treatment, row.rank, presentation);
    }).join("");
}

function sortTreatmentTableRows(rows) {
    if (!currentTreatmentTableSortKey) return rows;
    const factor = currentTreatmentTableSortDirection === "desc" ? -1 : 1;

    rows.sort(function (rowA, rowB) {
        const a = rowA.treatment;
        const b = rowB.treatment;
        let result = 0;

        if (currentTreatmentTableSortKey === "rank") result = rowA.rank - rowB.rank;
        else if (currentTreatmentTableSortKey === "name") result = String(a.behandlung || "").localeCompare(String(b.behandlung || ""), "de", { sensitivity: "base" });
        else if (currentTreatmentTableSortKey === "category") result = String(a.typ || "").localeCompare(String(b.typ || ""), "de", { sensitivity: "base" });
        else if (currentTreatmentTableSortKey === "experience") result = Number(a.positive_ratio || 0) - Number(b.positive_ratio || 0) || Number(a.total_votes || 0) - Number(b.total_votes || 0);
        else if (currentTreatmentTableSortKey === "experience-negative") result = Number(a.negative_ratio || 0) - Number(b.negative_ratio || 0) || Number(a.total_votes || 0) - Number(b.total_votes || 0);
        else if (currentTreatmentTableSortKey === "provider") result = Number(a.matching_provider_count || a.provider_count || 0) - Number(b.matching_provider_count || b.provider_count || 0);
        else if (currentTreatmentTableSortKey === "provider-total") result = Number(a.provider_count || 0) - Number(b.provider_count || 0);
        else if (currentTreatmentTableSortKey === "provider-area") {
            const countA = hasActiveTreatmentSearchArea() ? Number(a.matching_provider_count || 0) : Number(a.total_provider_count ?? a.provider_count ?? 0);
            const countB = hasActiveTreatmentSearchArea() ? Number(b.matching_provider_count || 0) : Number(b.total_provider_count ?? b.provider_count ?? 0);
            result = countA - countB;
        }
        else if (currentTreatmentTableSortKey === "location") {
            const distanceA = a.nearest_provider_distance_km === null ? Infinity : Number(a.nearest_provider_distance_km);
            const distanceB = b.nearest_provider_distance_km === null ? Infinity : Number(b.nearest_provider_distance_km);
            result = distanceA - distanceB;
            if (!Number.isFinite(distanceA) && !Number.isFinite(distanceB)) {
                result = String(a.nearest_provider?.loc_city || "").localeCompare(String(b.nearest_provider?.loc_city || ""), "de", { sensitivity: "base" });
            }
        }

        return result === 0 ? rowA.originalIndex - rowB.originalIndex : result * factor;
    });
    return rows;
}

function updateTreatmentTableSortHeaders() {
    document.querySelectorAll("[data-table-sort-key]").forEach(function (button) {
        const active = button.dataset.tableSortKey === currentTreatmentTableSortKey;
        const indicator = button.querySelector(".treatment-table-sort-indicator");
        button.classList.toggle("is-active", active);
        if (indicator) indicator.textContent = active ? (currentTreatmentTableSortDirection === "asc" ? "▲" : "▼") : "↕";
    });
}

function renderTreatmentCards(treatments) {
    const cardResults = document.getElementById("treatment-card-results");
    const loadMoreButton = document.getElementById("treatment-cards-load-more-button");

    if (!cardResults) {
        return;
    }

    if (!treatments || treatments.length === 0) {
        cardResults.innerHTML = `
            <p class="treatment-empty-state">Keine Therapien gefunden.</p>
        `;
        if (loadMoreButton) loadMoreButton.classList.add("is-hidden");
        return;
    }

    const visibleTreatments = showOnlyTreatmentCompareSelection
        ? treatments
        : treatments.slice(0, visibleTreatmentCardCount);

    cardResults.innerHTML = visibleTreatments.map(function (treatment, index) {
        return buildTreatmentCardHtml(treatment, index);
    }).join("");

    if (loadMoreButton) {
        const remainingCount = Math.max(0, treatments.length - visibleTreatments.length);
        const nextCount = Math.min(treatmentCardBatchSize, remainingCount);
        loadMoreButton.textContent = `Weitere ${nextCount} Kacheln laden`;
        loadMoreButton.classList.toggle("is-hidden", showOnlyTreatmentCompareSelection || remainingCount === 0);
    }
}

function buildTreatmentCardHtml(treatment, index) {
    const treatmentName = escapeHtml(treatment.behandlung || "Unbekannte Therapie");
    const rawTreatmentName = escapeHtmlAttribute(treatment.behandlung || "");
    const categoryHtml = buildTreatmentCategoryHtml(treatment);
    const providerHtml = buildTreatmentProviderHtml(treatment);
    const category = escapeHtml(String(treatment.typ || "").trim() || "Keine Kategorie angegeben");
    const subcategory = escapeHtml(String(treatment.unterkategorie || "").trim() || "Keine Unterkategorie angegeben");
    const providerCount = Number(treatment.total_provider_count ?? treatment.provider_count ?? 0);
    const providerCountLabel = providerCount === 1 ? "1 Anbieter insgesamt" : `${providerCount} Anbieter insgesamt`;

    const totalVotes = Number(treatment.total_votes ?? 0);
    const positiveRatio = Number(treatment.positive_ratio ?? 0);
    const neutralRatio = Number(treatment.neutral_ratio ?? 0);
    const negativeRatio = Number(treatment.negative_ratio ?? 0);

    const pro = Number(treatment.pro ?? 0);
    const neutral = Number(treatment.neutral ?? 0);
    const contra = Number(treatment.contra ?? 0);
    const ownVote = ['pro', 'neutral', 'contra'].includes(treatment.own_vote) ? treatment.own_vote : null;

    const communityBadge=treatment.is_community_preview?'<span class="community-preview-badge">Community-Vorschlag · noch nicht geprüft</span>':'';
    const treatmentTitle=treatment.is_community_preview?treatmentName:`<a class="treatment-card-title-link" href="therapie_detail.html?treat_id=${encodeURIComponent(treatment.treat_id)}">${treatmentName}</a>`;
    const distanceHtml = treatment.nearest_provider_distance_km === null
        ? ""
        : `<span class="treatment-card-muted">Nächster Anbieter: ${escapeHtml(formatDistanceKm(treatment.nearest_provider_distance_km))}</span>`;

    return `
        <article class="treatment-card${treatment.is_community_preview ? " is-community-preview" : ""}" data-treat-id="${treatment.treat_id}">
            <div class="treatment-card-accent"></div>

            <div class="treatment-card-main-header">
                <div class="treatment-card-rank-large">
                    <strong>#${index + 1}</strong>
                    <span>Rang</span>
                </div>

                <div class="treatment-card-title-area">
                    <h3 class="treatment-card-title">${treatmentTitle}</h3>${communityBadge}

                    <div class="treatment-card-meta">
                        ${categoryHtml}
                        ${distanceHtml}
                    </div>
                </div>

                <div class="treatment-card-provider-summary">
                    <span class="treatment-card-provider-summary-label">Anbieter</span>
                    <div class="treatment-card-provider-detail">
                        ${providerHtml}
                        <span>${escapeHtml(providerCountLabel)}</span>
                    </div>
                </div>

            </div>

            <div class="treatment-card-content-grid">
                <section class="treatment-card-info-panel treatment-card-classification-panel">
                    <h4 class="treatment-card-section-heading">Einordnung</h4>

                    <div class="treatment-card-classification-list">
                    <div class="treatment-card-info-block">
                        <div class="treatment-card-mini-label">Kategorie</div>
                        <div class="treatment-card-classification-value">${category}</div>
                    </div>

                    <div class="treatment-card-info-block">
                        <div class="treatment-card-mini-label">Unterkategorie</div>
                        <div class="treatment-card-classification-value">${subcategory}</div>
                    </div>
                    </div>
                </section>

                <section class="treatment-card-info-panel treatment-card-rating-panel">
                    <h4 class="treatment-card-section-heading">
                        Bewertung
                        <span class="treatment-card-section-count">(${totalVotes} Bewertungen)</span>
                    </h4>

                    ${totalVotes > 0 ? `
                        <div class="treatment-card-rating-tiles">
                            <div class="treatment-card-rating-tile treatment-card-rating-positive">
                                <div class="treatment-card-rating-value">${positiveRatio}%</div>
                                <div class="treatment-card-rating-label">Positive Erfahrungen</div>
                                <div class="treatment-card-rating-count">${pro} positiv</div>
                            </div>

                            <div class="treatment-card-rating-tile treatment-card-rating-neutral">
                                <div class="treatment-card-rating-value">${neutralRatio}%</div>
                                <div class="treatment-card-rating-label">Neutrale Erfahrungen</div>
                                <div class="treatment-card-rating-count">${neutral} neutral</div>
                            </div>

                            <div class="treatment-card-rating-tile treatment-card-rating-negative">
                                <div class="treatment-card-rating-value">${negativeRatio}%</div>
                                <div class="treatment-card-rating-label">Negative Erfahrungen</div>
                                <div class="treatment-card-rating-count">${contra} negativ</div>
                            </div>
                        </div>
                    ` : `
                        <div class="treatment-card-rating-empty">
                            Noch keine Bewertungen vorhanden.
                        </div>
                    `}
                </section>
            </div>

            <section class="treatment-card-own-rating">
                <div class="treatment-card-own-rating-header">
                    <h4 class="treatment-card-section-heading">Deine Bewertung</h4>
                </div>

                <div class="treatment-card-vote-buttons${ownVote ? ' has-selection' : ''}">
                    <button
                        type="button"
                        class="treatment-card-vote-button treatment-card-vote-positive${ownVote === 'pro' ? ' is-selected' : ''}"
                        data-treat-id="${treatment.treat_id}"
                        data-treatment-name="${rawTreatmentName}"
                        data-vote-type="hilft"
                        aria-pressed="${ownVote === 'pro'}"
                    >
                        Positiv${ownVote === 'pro' ? ' ✓' : ''}
                    </button>

                    <button
                        type="button"
                        class="treatment-card-vote-button treatment-card-vote-neutral${ownVote === 'neutral' ? ' is-selected' : ''}"
                        data-treat-id="${treatment.treat_id}"
                        data-treatment-name="${rawTreatmentName}"
                        data-vote-type="gleich"
                        aria-pressed="${ownVote === 'neutral'}"
                    >
                        Neutral${ownVote === 'neutral' ? ' ✓' : ''}
                    </button>

                    <button
                        type="button"
                        class="treatment-card-vote-button treatment-card-vote-negative${ownVote === 'contra' ? ' is-selected' : ''}"
                        data-treat-id="${treatment.treat_id}"
                        data-treatment-name="${rawTreatmentName}"
                        data-vote-type="verschlechterung"
                        aria-pressed="${ownVote === 'contra'}"
                    >
                        Negativ${ownVote === 'contra' ? ' ✓' : ''}
                    </button>
                </div>
            </section>

            <footer class="treatment-card-footer treatment-card-footer-with-compare">
                <button
                    type="button"
                    class="treatment-compare-add-button ${isTreatmentSelectedForCompare(treatment.treat_id) ? "is-selected" : ""}"
                    data-treat-id="${escapeHtml(treatment.treat_id)}"
                >
                    ${isTreatmentSelectedForCompare(treatment.treat_id) ? "Ausgewählt" : "+ vergleichen"}
                </button>
            </footer>
        </article>
    `;
}

function handleTreatmentCompareClick(button) {
    const treatId = Number(button.getAttribute("data-treat-id"));

    if (!treatId) {
        return;
    }

    const treatment = currentTreatments.find(function (currentTreatment) {
        return Number(currentTreatment.treat_id) === treatId;
    }) || selectedTreatmentsForCompare.find(function (selectedTreatment) {
        return Number(selectedTreatment.treat_id) === treatId;
    });

    if (treatment) {
        addTreatmentToCompareSelection(treatment);
    }
}

function addTreatmentToCompareSelection(treatment) {
    const treatId = Number(treatment.treat_id);

    if (!treatId) {
        return;
    }

    if (!isTreatmentSelectedForCompare(treatId)) {
        if (selectedTreatmentsForCompare.length >= treatmentCompareMaxItems) {
            alert(`Du kannst maximal ${treatmentCompareMaxItems} Therapien gleichzeitig vergleichen.`);
            return;
        }

        selectedTreatmentsForCompare.push({ ...treatment });
		currentTreatmentCompareMapData = null;
        currentTreatmentCompareMapKey = "";
    }

    renderTreatmentCompareSelection();
    refreshTreatmentDisplay();
}

function removeTreatmentFromCompareSelection(treatId) {
    selectedTreatmentsForCompare = selectedTreatmentsForCompare.filter(function (treatment) {
        return Number(treatment.treat_id) !== Number(treatId);
    });
    
	currentTreatmentCompareMapData = null;
    currentTreatmentCompareMapKey = "";
	
    if (selectedTreatmentsForCompare.length === 0) {
        showOnlyTreatmentCompareSelection = false;
    }

    refreshTreatmentDisplay();
}

function isTreatmentSelectedForCompare(treatId) {
    return selectedTreatmentsForCompare.some(function (treatment) {
        return Number(treatment.treat_id) === Number(treatId);
    });
}

function syncSelectedTreatmentsWithCurrentResults() {
    if (selectedTreatmentsForCompare.length === 0) {
        showOnlyTreatmentCompareSelection = false;
        return;
    }

    selectedTreatmentsForCompare = selectedTreatmentsForCompare.map(function (selectedTreatment) {
        const freshTreatment = currentTreatments.find(function (currentTreatment) {
            return Number(currentTreatment.treat_id) === Number(selectedTreatment.treat_id);
        });

        return freshTreatment ? { ...freshTreatment } : selectedTreatment;
    });
}

function renderTreatmentCompareSelection() {
    const container = document.getElementById("treatment-compare-selection");
    const chipsContainer = document.getElementById("treatment-compare-chips");
    const statusElement = document.getElementById("treatment-compare-status");
    const hitViewButton = document.getElementById("treatment-results-hit-view-button");
    const compareViewButton = document.getElementById("treatment-compare-show-button");
    const clearButton = document.getElementById("treatment-compare-clear-button");

    const hasSelection = selectedTreatmentsForCompare.length > 0;

    if (container) {
        container.classList.toggle("is-hidden", !hasSelection);
    }

    if (chipsContainer) {
        chipsContainer.innerHTML = hasSelection
            ? selectedTreatmentsForCompare.map(function (treatment) {
                const name = treatment.behandlung || "Unbekannte Therapie";

                return `
                    <span class="treatment-compare-chip">
                        <span class="treatment-compare-chip-name">${escapeHtml(name)}</span>
                        <button
                            type="button"
                            class="treatment-compare-chip-remove"
                            data-treat-id="${escapeHtml(treatment.treat_id)}"
                            aria-label="${escapeHtml(name)} aus Vergleich entfernen"
                        >
                            ×
                        </button>
                    </span>
                `;
            }).join("")
            : "";
    }

    if (statusElement) {
        statusElement.textContent = hasSelection
            ? `${selectedTreatmentsForCompare.length} von ${treatmentCompareMaxItems} Therapien ausgewählt.`
            : "";
    }

    if (hitViewButton) {
        hitViewButton.classList.toggle("is-active", !showOnlyTreatmentCompareSelection);
    }

    if (compareViewButton) {
        compareViewButton.disabled = !hasSelection;
        compareViewButton.classList.toggle("is-active", showOnlyTreatmentCompareSelection);
    }

    if (clearButton) {
        clearButton.disabled = !hasSelection;
    }
}

async function submitTreatmentVote(treatId, treatmentName, voteType, button) {
    if (!treatId || !treatmentName || !voteType || !button) {
        return;
    }

    const voteContainer = button.closest(".treatment-card, tr");
    const buttonsInCard = voteContainer
        ? voteContainer.querySelectorAll(".treatment-card-vote-button, .treatment-table-vote-button")
        : [button];

    buttonsInCard.forEach(function (cardButton) {
        cardButton.disabled = true;
        cardButton.classList.add("is-saving");
    });

    try {
        const isCommunity=treatId<0;
        const response = await fetch(isCommunity?"api/vote_community_submission.php":"api/inc_votes_db.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ...(isCommunity?{submission_id:Math.abs(treatId)}:{treat_id:treatId}),
                type: voteType
            })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.message || "Bewertung konnte nicht gespeichert werden.");
        }

        if(isCommunity){await loadTreatmentResults();}else{await refreshSingleTreatment(treatId, result.vote);}

    } catch (error) {
        console.error("Fehler beim Speichern der Bewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden.");
    } finally {
        buttonsInCard.forEach(function (cardButton) {
            cardButton.disabled = false;
            cardButton.classList.remove("is-saving");
        });
    }
}

async function refreshSingleTreatment(treatId, ownVote = null) {
    const filters = getTreatmentFilters();
    const params = new URLSearchParams();
    params.set("treat_id", String(treatId));

    const currentCity = getCurrentTreatmentCity();

    if (filters.onlyCurrentCity && currentCity !== "") {
        params.set("provider_city", currentCity);
    }

    if (filters.radiusKm > 0 && currentTreatmentUserLocation) {
        params.set("provider_lat", String(currentTreatmentUserLocation.lat));
        params.set("provider_lng", String(currentTreatmentUserLocation.lng));
        params.set("radius_km", String(filters.radiusKm));
    }

    if (currentTreatmentUserLocation) {
        params.set("include_map", "1");
        params.set("lat", String(currentTreatmentUserLocation.lat));
        params.set("lng", String(currentTreatmentUserLocation.lng));
    }

    const response = await fetch(`api/treatments_search.php?${params.toString()}`);

    if (!response.ok) {
        throw new Error("Einzelnes Treatment konnte nicht neu geladen werden.");
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.items) || data.items.length !== 1) {
        throw new Error("Unerwartetes API-Format beim Einzelladen.");
    }

    const updatedTreatment = {
        ...normalizeTreatment(data.items[0]),
        own_vote: ownVote
    };
    const index = currentTreatments.findIndex(function (treatment) {
        return Number(treatment.treat_id) === Number(treatId);
    });

    if (index === -1) {
        return;
    }

    currentTreatments[index] = updatedTreatment;

    selectedTreatmentsForCompare = selectedTreatmentsForCompare.map(function (treatment) {
        return Number(treatment.treat_id) === Number(treatId) ? updatedTreatment : treatment;
    });

    applyClientSideTreatmentSort();
    refreshTreatmentDisplay();
}

function buildTreatmentCategoryHtml(treatment) {
    const category = String(treatment.typ || "").trim();

    if (!category) {
        return `<span class="treatment-table-muted">—</span>`;
    }

    return `
        <div class="treatment-table-badge-row">
            <span class="treatment-table-badge">${escapeHtml(category)}</span>
        </div>
    `;
}

function buildTreatmentExperienceHtml(treatment, mode = "all") {
    const totalVotes = Number(treatment.total_votes ?? 0);

    const positiveRatio = Number(treatment.positive_ratio ?? 0);
    const neutralRatio = Number(treatment.neutral_ratio ?? 0);
    const negativeRatio = Number(treatment.negative_ratio ?? 0);

    if (mode === "positive" || mode === "negative") {
        const isNegative = mode === "negative";
        const ratio = isNegative ? negativeRatio : positiveRatio;
        const badgeClass = isNegative ? "treatment-table-badge-negative" : "treatment-table-badge-positive";
        const prefix = isNegative ? "-" : "+";

        return `<div class="treatment-table-experience-grid is-single${treatment.own_vote ? " has-selection" : ""}">
            ${buildTreatmentTableVoteButton(treatment, isNegative ? "contra" : "pro", prefix, ratio, badgeClass)}
            <span class="treatment-table-vote-count">(n=${totalVotes})</span>
        </div>`;
    }

    return `
        <div class="treatment-table-experience-grid${treatment.own_vote ? " has-selection" : ""}">
            ${buildTreatmentTableVoteButton(treatment, "pro", "+", positiveRatio, "treatment-table-badge-positive")}
            ${buildTreatmentTableVoteButton(treatment, "neutral", "=", neutralRatio, "treatment-table-badge-neutral")}
            ${buildTreatmentTableVoteButton(treatment, "contra", "−", negativeRatio, "treatment-table-badge-negative")}
            <span class="treatment-table-vote-count">(n=${totalVotes})</span>
        </div>
    `;
}

function getSavedTreatmentResultsView() {
    try { return localStorage.getItem("lcn_result_view_preference") === "cards" ? "cards" : "table"; }
    catch (_) { return "table"; }
}

function buildTreatmentTableVoteButton(treatment, type, prefix, ratio, badgeClass) {
    const selected = treatment.own_vote === type;
    const labels = { pro: "Positive", neutral: "Neutrale", contra: "Negative" };
    return `<button type="button"
        class="treatment-table-experience-value treatment-table-vote-button ${badgeClass}${selected ? " is-selected" : ""}"
        data-treat-id="${escapeHtml(treatment.treat_id)}" data-treatment-name="${escapeHtml(treatment.behandlung || "Behandlung")}"
        data-vote-type="${type}" aria-pressed="${selected}"
        aria-label="${labels[type]} Erfahrung: ${ratio} Prozent. Jetzt abstimmen">${prefix}${ratio}%</button>`;
}

function buildTreatmentProviderHtml(treatment) {
    const filters = getTreatmentFilters();
    const providerCount = Number(treatment.provider_count ?? 0);
    const matchingProviderCount = Number(treatment.matching_provider_count ?? 0);
    const unlocatedProviderCount = Number(treatment.unlocated_provider_count ?? 0);
    const hasSearchArea = (filters.onlyCurrentCity && getCurrentTreatmentCity() !== "")
        || filters.radiusKm > 0
        || filters.acceptsGkv;
    const displaysWholeResultAsSearchArea = filters.sortKey === "matching_provider_count" && !hasSearchArea;

    if (providerCount <= 0) {
        return `<span class="treatment-provider-bubble treatment-provider-bubble-empty">0</span>`;
    }

    if (displaysWholeResultAsSearchArea) {
        return `<span class="treatment-provider-bubble" title="${providerCount} Anbieter im Suchgebiet, ${providerCount} Anbieter gesamt">${providerCount}/${providerCount}</span>`;
    }

    if (hasSearchArea) {
        if (filters.includeNoCoords && unlocatedProviderCount > 0) {
            return `<span class="treatment-provider-bubble" title="${matchingProviderCount} Anbieter im Suchgebiet, ${unlocatedProviderCount} ohne Koordinaten, ${providerCount} Anbieter gesamt">${matchingProviderCount}+?/${providerCount}</span>`;
        }
        return `<span class="treatment-provider-bubble" title="${matchingProviderCount} Anbieter im Suchgebiet, ${providerCount} Anbieter gesamt">${matchingProviderCount}/${providerCount}</span>`;
    }

    if (filters.mappedProvidersOnly) {
        const totalProviderCount = Number(treatment.total_provider_count ?? providerCount);
        return `<span class="treatment-provider-bubble" title="${providerCount} kartierte von ${totalProviderCount} Anbietern">${providerCount}</span>`;
    }

    return `<span class="treatment-provider-bubble">${providerCount}</span>`;
}

function initTreatmentMap() {
    const mapElement = document.getElementById("treatment-map");

    if (!mapElement) {
        return;
    }

    if (typeof L === "undefined") {
        console.error("Leaflet wurde nicht geladen.");
        updateTreatmentMapStatus("Die Karte konnte nicht geladen werden, weil Leaflet fehlt.");
        return;
    }

    treatmentMap = L.map("treatment-map", {
        zoomControl: false,
        scrollWheelZoom: false
    }).setView(
        [treatmentDefaultMapCenter.lat, treatmentDefaultMapCenter.lng],
        6
    );

    mapElement.addEventListener("click", function () {
        treatmentMap.scrollWheelZoom.enable();
        mapElement.classList.add("is-scroll-zoom-active");
    });

    mapElement.addEventListener("mouseleave", function () {
        treatmentMap.scrollWheelZoom.disable();
        mapElement.classList.remove("is-scroll-zoom-active");
    });

    L.control.zoom({
        position: "topright"
    }).addTo(treatmentMap);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere"
    }).addTo(treatmentMap);

    treatmentUserLocationIcon = L.icon({
        iconUrl: window.LCNImages.urls["map-marker-red"],
        shadowUrl: window.LCNImages.urls["map-marker-shadow"],
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

function bindTreatmentMapEvents() {
    const mapToggleButton = document.getElementById("treatment-map-toggle-button");
    const mapContent = document.getElementById("treatment-map-content");

    if (mapToggleButton && mapContent) {
        mapToggleButton.addEventListener("click", function () {
            const isCollapsed = mapContent.classList.toggle("is-collapsed");
            mapToggleButton.classList.toggle("is-collapsed", isCollapsed);
            mapToggleButton.setAttribute("aria-expanded", String(!isCollapsed));

            if (!isCollapsed && treatmentMap) {
                setTimeout(function () {
                    treatmentMap.invalidateSize();
                }, 50);
            }
        });
    }
}

async function applyTreatmentLocationFromInput() {
    const locationInput = document.getElementById("treatment-location-input");
    const query = locationInput ? String(locationInput.value || "").trim() : "";

    if (query === "") {
        alert("Bitte zuerst einen Kartenstandort eingeben, z. B. 50677 Köln.");
        return;
    }

    updateTreatmentLocationStatus("Kartenstandort wird gesucht ...");
    updateTreatmentMapStatus("Kartenstandort wird gesucht ...");

    try {
        const geocodedLocation = await geocodeTreatmentLocation(query);
        currentTreatmentUserLocation = geocodedLocation;

        if (locationInput) {
            locationInput.value = geocodedLocation.label;
        }

        saveTreatmentLocationPreference();
        updateTreatmentLocationClearButton();

        const cityText = geocodedLocation.city
            ? ` · Stadt: ${geocodedLocation.city}`
            : "";

        updateTreatmentLocationStatus(`Kartenstandort gesetzt: ${geocodedLocation.label}${cityText}`);
        updateTreatmentUserLocationMarker();
        updateTreatmentRadiusCircle();

        if (treatmentMap) {
            treatmentMap.setView([geocodedLocation.lat, geocodedLocation.lng], currentTreatmentLocationMode === "city" ? 11 : 10);
        }

        await loadTreatmentResults();

    } catch (error) {
        console.error("Fehler beim Geocoding:", error);
        updateTreatmentLocationStatus("Kartenstandort konnte nicht gefunden werden.");
        updateTreatmentMapStatus("Kartenstandort konnte nicht gefunden werden.");
        alert("Der Kartenstandort konnte nicht gefunden werden.");
    }
}

function resetTreatmentLocation(shouldReload = true) {
    currentTreatmentUserLocation = null;
    localStorage.removeItem(treatmentLocationStorageKey);
    localStorage.removeItem(sharedLocationStorageKey);
    localStorage.setItem(sharedLocationClearedStorageKey, "1");
    setInputValue("treatment-location-input", "");
    setInputValue("treatment-radius-input", "100");
    updateTreatmentLocationStatus("Kein Kartenstandort gesetzt.");
    clearTreatmentUserLocationMarker();
    clearTreatmentRadiusCircle();
    clearTreatmentProviderMarkers();

    setTreatmentLocationMode("radius");
    updateTreatmentLocationClearButton();

    if (treatmentMap) {
        treatmentMap.setView([treatmentDefaultMapCenter.lat, treatmentDefaultMapCenter.lng], 6);
    }

    updateTreatmentMapStatus("Bitte Kartenstandort setzen, um die nächsten Anbieterstandorte der gefundenen Therapien auf der Karte zu sehen.");

    if (shouldReload) {
        loadTreatmentResults();
    }
}

function setTreatmentLocationMode(mode) {
    currentTreatmentLocationMode = mode === "city" ? "city" : "radius";
    const radiusButton = document.getElementById("treatment-location-mode-radius-button");
    const cityButton = document.getElementById("treatment-location-mode-city-button");
    const radiusEnabledInput = document.getElementById("treatment-radius-enabled-input");

    if (radiusButton) {
        const active = currentTreatmentLocationMode === "radius";
        radiusButton.classList.toggle("is-active", active);
        radiusButton.setAttribute("aria-pressed", String(active));
    }

    if (cityButton) {
        const active = currentTreatmentLocationMode === "city";
        cityButton.classList.toggle("is-active", active);
        cityButton.setAttribute("aria-pressed", String(active));
    }

    if (radiusEnabledInput) {
        radiusEnabledInput.disabled = currentTreatmentLocationMode !== "radius";
    }

    updateTreatmentRadiusInputState();
    updateTreatmentUserLocationMarker();
    saveTreatmentLocationPreference();
}

function updateTreatmentRadiusInputState() {
    const enabledInput = document.getElementById("treatment-radius-enabled-input");
    const radiusInput = document.getElementById("treatment-radius-input");
    const includeNoCoordsInput = document.getElementById("treatment-include-no-coords-input");
    const mappedProvidersOnlyInput = document.getElementById("treatment-mapped-providers-only-input");
    const enabled = currentTreatmentLocationMode === "radius" && Boolean(enabledInput && enabledInput.checked);

    if (radiusInput) {
        radiusInput.disabled = !enabled;
        radiusInput.classList.toggle("is-disabled", !enabled);
    }
    if (includeNoCoordsInput) {
        const includeNoCoordsDisabled = !enabled || Boolean(mappedProvidersOnlyInput?.checked);
        includeNoCoordsInput.disabled = includeNoCoordsDisabled;
        if (includeNoCoordsDisabled) includeNoCoordsInput.checked = false;
    }
    updateTreatmentRadiusCircle();
    updateTreatmentSortAvailability();
}

function saveTreatmentLocationPreference() {
    if (!currentTreatmentUserLocation) return;
    localStorage.setItem(treatmentLocationStorageKey, JSON.stringify({ ...currentTreatmentUserLocation, mode: currentTreatmentLocationMode }));
    localStorage.setItem(sharedLocationStorageKey, JSON.stringify({
        location: currentTreatmentUserLocation.label,
        label: currentTreatmentUserLocation.label,
        city: currentTreatmentUserLocation.city || "",
        lat: currentTreatmentUserLocation.lat,
        lng: currentTreatmentUserLocation.lng
    }));
    localStorage.removeItem(sharedLocationClearedStorageKey);
}

async function restoreTreatmentLocationPreference() {
    try {
        const sharedRaw = localStorage.getItem(sharedLocationStorageKey);
        const treatmentRaw = localStorage.getItem(treatmentLocationStorageKey);
        let stored = sharedRaw ? JSON.parse(sharedRaw) : null;
        const treatmentPreference = treatmentRaw ? JSON.parse(treatmentRaw) : null;

        if (!stored && !localStorage.getItem(sharedLocationClearedStorageKey)
            && treatmentPreference && typeof treatmentPreference.label === "string") {
            stored = { ...treatmentPreference, location: treatmentPreference.label };
            localStorage.setItem(sharedLocationStorageKey, JSON.stringify(stored));
        }

        const storedLocation = String(stored?.location || stored?.label || "").trim();
        if (!stored || storedLocation === "") {
            updateTreatmentLocationClearButton();
            return;
        }

        if (!hasValidCoordinates(stored.lat, stored.lng)) {
            stored = await geocodeTreatmentLocation(storedLocation);
            localStorage.setItem(sharedLocationStorageKey, JSON.stringify({
                ...stored,
                location: stored.label
            }));
        }

        currentTreatmentUserLocation = {
            lat: Number(stored.lat),
            lng: Number(stored.lng),
            label: String(stored.label || "Gespeicherter Standort"),
            city: String(stored.city || "")
        };
        setTreatmentLocationMode(treatmentPreference?.mode || "radius");
        setInputValue("treatment-location-input", currentTreatmentUserLocation.label);
        updateTreatmentLocationStatus(`Gespeicherter Standort: ${currentTreatmentUserLocation.label}`);
        updateTreatmentUserLocationMarker();
        updateTreatmentLocationClearButton();
    } catch (error) {
        console.warn("Gespeicherter Therapiestandort konnte nicht geladen werden:", error);
        updateTreatmentLocationClearButton();
    }
}

function updateTreatmentLocationClearButton() {
    const button = document.getElementById("treatment-location-clear-button");
    if (button) button.classList.toggle("is-hidden", !currentTreatmentUserLocation);
}

async function geocodeTreatmentLocation(query) {
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
        city: data.result.city || ""
    };
}

function getTreatmentMapDataForCurrentView(treatments) {
    if (!showOnlyTreatmentCompareSelection) {
        return currentTreatmentMapData;
    }

    const expectedKey = buildTreatmentCompareMapKey(treatments);

    if (
        currentTreatmentCompareMapData
        && currentTreatmentCompareMapKey === expectedKey
    ) {
        return currentTreatmentCompareMapData;
    }

    return null;
}

function buildTreatmentCompareMapKey(treatments) {
    const filters = getTreatmentFilters();

    const treatmentIds = (treatments || [])
        .map(function (treatment) {
            return Number(treatment.treat_id || 0);
        })
        .filter(function (treatId) {
            return treatId > 0;
        })
        .sort(function (a, b) {
            return a - b;
        })
        .join(",");

    const locationKey = currentTreatmentUserLocation
        ? `${currentTreatmentUserLocation.lat},${currentTreatmentUserLocation.lng},${getCurrentTreatmentCity()}`
        : "no-location";

    return [
        treatmentIds,
        locationKey,
        filters.onlyCurrentCity ? "city:1" : "city:0",
        `radius:${filters.radiusKm}`
    ].join("|");
}

async function refreshTreatmentCompareMapDataIfNeeded(treatments) {
    if (!showOnlyTreatmentCompareSelection) {
        return;
    }

    if (!currentTreatmentUserLocation) {
        return;
    }

    if (!treatments || treatments.length === 0) {
        currentTreatmentCompareMapData = null;
        currentTreatmentCompareMapKey = "";
        return;
    }

    const requestedKey = buildTreatmentCompareMapKey(treatments);

    if (
        currentTreatmentCompareMapData
        && currentTreatmentCompareMapKey === requestedKey
    ) {
        return;
    }

    try {
        const response = await fetch(buildTreatmentCompareMapUrl(treatments));

        if (!response.ok) {
            throw new Error("Vergleichs-Kartendaten konnten nicht geladen werden.");
        }

        const data = await response.json();

        if (!data.ok) {
            throw new Error("Unerwartetes API-Format für Vergleichs-Kartendaten.");
        }

        if (!showOnlyTreatmentCompareSelection) {
            return;
        }

        if (buildTreatmentCompareMapKey(getDisplayedTreatments()) !== requestedKey) {
            return;
        }

        currentTreatmentCompareMapData = data.map && typeof data.map === "object"
            ? data.map
            : null;

        currentTreatmentCompareMapKey = requestedKey;

        renderTreatmentMap(getDisplayedTreatments(), currentTreatmentCompareMapData);

    } catch (error) {
        console.warn("Vergleichs-Kartendaten konnten nicht aktualisiert werden:", error);
    }
}

function buildTreatmentCompareMapUrl(treatments) {
    const filters = getTreatmentFilters();
    const params = new URLSearchParams();

    const treatmentIds = (treatments || [])
        .map(function (treatment) {
            return Number(treatment.treat_id || 0);
        })
        .filter(function (treatId) {
            return treatId > 0;
        });

    params.set("treat_ids", treatmentIds.length > 0 ? treatmentIds.join(",") : "0");

    const currentCity = getCurrentTreatmentCity();

    if (filters.onlyCurrentCity && currentCity !== "") {
        params.set("provider_city", currentCity);
    }

    if (filters.radiusKm > 0 && currentTreatmentUserLocation) {
        params.set("provider_lat", String(currentTreatmentUserLocation.lat));
        params.set("provider_lng", String(currentTreatmentUserLocation.lng));
        params.set("radius_km", String(filters.radiusKm));
    }

    params.set("min_positive", "0");
    params.set("max_negative", "100");
    params.set("min_provider", "0");
    params.set("only_with_provider", "0");
    params.set("sort", "name");
    params.set("direction", "asc");

    params.set("include_map", "1");
    params.set("lat", String(currentTreatmentUserLocation.lat));
    params.set("lng", String(currentTreatmentUserLocation.lng));

    return `api/treatments_search.php?${params.toString()}`;
}

function filterTreatmentMapDataForTreatments(mapData, treatments) {
    if (!mapData || typeof mapData !== "object") {
        return null;
    }

    const treatmentIds = new Set(
        (treatments || [])
            .map(function (treatment) {
                return Number(treatment.treat_id || 0);
            })
            .filter(function (treatId) {
                return treatId > 0;
            })
    );

    if (treatmentIds.size === 0) {
        return {
            ...mapData,
            providers: [],
            legend: []
        };
    }

    const filteredProviders = Array.isArray(mapData.providers)
        ? mapData.providers.filter(function (provider) {
            return treatmentIds.has(Number(provider.treat_id || 0));
        })
        : [];

    const filteredLegend = Array.isArray(mapData.legend)
        ? mapData.legend.filter(function (item) {
            return treatmentIds.has(Number(item.treat_id || 0));
        })
        : [];

    return {
        ...mapData,
        providers: filteredProviders,
        legend: filteredLegend
    };
}

function renderTreatmentMap(treatments, mapData) {
    if (!treatmentMap) {
        return;
    }

    clearTreatmentProviderMarkers();
    updateTreatmentUserLocationMarker();
    updateTreatmentRadiusCircle();
    clearTreatmentMapLegend();

    if (!currentTreatmentUserLocation) {
        updateTreatmentMapStatus("Bitte Kartenstandort setzen, um die nächsten Anbieterstandorte der gefundenen Therapien auf der Karte zu sehen.");
        return;
    }

    const displayedTreatments = treatments || [];
    const rawMapData = mapData && typeof mapData === "object" ? mapData : currentTreatmentMapData;
    const activeMapData = filterTreatmentMapDataForTreatments(rawMapData, displayedTreatments);

    const useAllMatchingProviders = activeMapData
        && activeMapData.mode === "all_matching_providers"
        && Array.isArray(activeMapData.providers);

    const groups = useAllMatchingProviders
        ? groupAllMatchingProvidersByLocation(activeMapData.providers, displayedTreatments)
        : groupTreatmentsByNearestProviderLocation(displayedTreatments);

    const groupValues = Array.from(groups.values());

    if (groupValues.length === 0) {
        updateTreatmentMapStatus("Für die aktuell angezeigten Therapien gibt es keine koordinierten Anbieterstandorte.");
        return;
    }

    treatmentMarkerGroup = L.featureGroup();

	groupValues.forEach(function (group) {
		const treatmentCountAtLocation = group.treatmentIds instanceof Set
			? group.treatmentIds.size
			: 1;

		const markerOptions = useAllMatchingProviders
			? { icon: createTreatmentColorMarkerIcon(group.colorIndex, treatmentCountAtLocation) }
			: {};

		const marker = L.marker([group.lat, group.lng], markerOptions);

		marker.bindPopup(
			useAllMatchingProviders
				? buildAllMatchingProvidersPopupHtml(group)
				: buildTreatmentMapPopupHtml(group)
		);

		treatmentMarkerGroup.addLayer(marker);
	});

    treatmentMarkerGroup.addTo(treatmentMap);

    const bounds = L.latLngBounds([
        [currentTreatmentUserLocation.lat, currentTreatmentUserLocation.lng]
    ]);

    groupValues.forEach(function (group) {
        bounds.extend([group.lat, group.lng]);
    });

    if (treatmentRadiusCircle) {
        bounds.extend(treatmentRadiusCircle.getBounds());
    }

    treatmentMap.fitBounds(bounds, {
        padding: [34, 34],
        maxZoom: 10
    });

    const filters = getTreatmentFilters();
    const cityPart = filters.onlyCurrentCity && getCurrentTreatmentCity()
        ? ` in deiner Stadt „${getCurrentTreatmentCity()}“`
        : "";
    const radiusPart = filters.radiusKm > 0
        ? ` im Radius von ${filters.radiusKm} km`
        : "";
    const viewPart = showOnlyTreatmentCompareSelection
        ? " in der Vergleichsansicht"
        : "";

    if (useAllMatchingProviders) {
        renderTreatmentMapLegend([], displayedTreatments);

        const providerCount = groupValues.reduce(function (sum, group) {
            return sum + group.providers.length;
        }, 0);

        const treatmentCount = countUniqueTreatmentsInProviderGroups(groupValues);

        updateTreatmentMapStatus(
            `${providerCount} Anbieterstandorte für ${treatmentCount} Therapien${viewPart}${cityPart}${radiusPart} auf der Karte. Farben zeigen die Therapie-Zuordnung.`
        );
        return;
    }

    const treatmentCountOnMap = groupValues.reduce(function (sum, group) {
        return sum + group.treatments.length;
    }, 0);

    updateTreatmentMapStatus(
        `${treatmentCountOnMap} Therapien${viewPart}${cityPart}${radiusPart} mit nächstem Anbieterstandort auf der Karte. Mehrere Therapien am selben Standort werden in einem Popup gebündelt.`
    );
}

function groupTreatmentsByNearestProviderLocation(treatments) {
    const groups = new Map();

    treatments.forEach(function (treatment) {
        const provider = treatment.nearest_provider;

        if (!provider || !hasValidCoordinates(provider.loc_lat, provider.loc_lng)) {
            return;
        }

        const lat = Number(provider.loc_lat);
        const lng = Number(provider.loc_lng);
        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

        if (!groups.has(key)) {
            groups.set(key, {
                lat,
                lng,
                provider,
                treatments: []
            });
        }

        groups.get(key).treatments.push(treatment);
    });

    return groups;
}

function groupAllMatchingProvidersByLocation(providers, treatments) {
    const groups = new Map();
    const treatmentById = new Map();
    const colorIndexByTreatId = buildTreatmentColorIndexMap(treatments);

    treatments.forEach(function (treatment) {
        const treatId = Number(treatment.treat_id || 0);

        if (treatId > 0) {
            treatmentById.set(treatId, treatment);
        }
    });

    providers.forEach(function (provider) {
        if (!provider || !hasValidCoordinates(provider.loc_lat, provider.loc_lng)) {
            return;
        }

        const treatId = Number(provider.treat_id || 0);

        if (!treatmentById.has(treatId)) {
            return;
        }

        const lat = Number(provider.loc_lat);
        const lng = Number(provider.loc_lng);
        const drId = Number(provider.dr_id || 0);
        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        const colorIndex = colorIndexByTreatId.has(treatId)
            ? colorIndexByTreatId.get(treatId)
            : 0;

        if (!groups.has(key)) {
            groups.set(key, {
                lat,
                lng,
                colorIndex,
                providers: [],
                providerMap: new Map(),
                treatmentIds: new Set()
            });
        }

        const group = groups.get(key);
        group.colorIndex = Math.min(group.colorIndex, colorIndex);
        group.treatmentIds.add(treatId);

        if (!group.providerMap.has(drId)) {
            const providerEntry = {
                provider,
                treatments: []
            };

            group.providerMap.set(drId, providerEntry);
            group.providers.push(providerEntry);
        }

        const treatment = treatmentById.get(treatId);

        group.providerMap.get(drId).treatments.push({
            treat_id: treatId,
            behandlung: treatment.behandlung || provider.treatment_name || "Unbekannte Therapie",
            distance_km: provider.distance_km ?? null,
            color_index: colorIndex
        });
    });

    groups.forEach(function (group) {
        delete group.providerMap;
    });

    return groups;
}

function buildTreatmentColorIndexMap(treatments) {
    const colorIndexByTreatId = new Map();

    (treatments || []).slice(0, 5).forEach(function (treatment, index) {
        const treatId = Number(treatment.treat_id || 0);

        if (treatId > 0 && !colorIndexByTreatId.has(treatId)) {
            colorIndexByTreatId.set(treatId, index);
        }
    });

    return colorIndexByTreatId;
}

function countUniqueTreatmentsInProviderGroups(groups) {
    const ids = new Set();

    groups.forEach(function (group) {
        group.treatmentIds.forEach(function (treatId) {
            if (treatId > 0) {
                ids.add(treatId);
            }
        });
    });

    return ids.size;
}

function createTreatmentColorMarkerIcon(colorIndex, treatmentCountAtLocation = 1) {
    const safeIndex = Number.isFinite(Number(colorIndex)) ? Number(colorIndex) : 0;
    const color = treatmentMapMarkerColors[Math.abs(safeIndex) % treatmentMapMarkerColors.length];
    const count = Number(treatmentCountAtLocation || 1);
    const label = count > 1 ? String(count) : "";

    return L.divIcon({
        className: "treatment-colored-marker-wrapper",
        html: `<span class="treatment-colored-marker" style="background:${escapeHtml(color)}">${escapeHtml(label)}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
    });
}

function buildTreatmentMapPopupHtml(group) {
    const provider = group.provider;
    const providerName = escapeHtml(provider.dr_display_name || "Anbieter");
    const address = buildProviderAddressText(provider);
    const treatments = group.treatments.slice().sort(function (a, b) {
        return String(a.behandlung || "").localeCompare(String(b.behandlung || ""), "de");
    });

    const visibleTreatments = treatments.slice(0, 4);
    const hiddenCount = Math.max(0, treatments.length - visibleTreatments.length);

    const treatmentListHtml = visibleTreatments.map(function (treatment) {
        const distance = treatment.nearest_provider_distance_km === null
            ? ""
            : ` <span class="treatment-map-popup-muted">(${escapeHtml(formatDistanceKm(treatment.nearest_provider_distance_km))})</span>`;

        return `
            <li>
                <a href="therapie_detail.html?treat_id=${encodeURIComponent(treatment.treat_id)}">
                    ${escapeHtml(treatment.behandlung || "Unbekannte Therapie")}
                </a>${distance}
            </li>
        `;
    }).join("");

    const moreHtml = hiddenCount > 0
        ? `<li class="treatment-map-popup-muted">+ ${hiddenCount} weitere Therapien an diesem Standort</li>`
        : "";

    const doctorLink = provider.dr_id
        ? `<a href="arzt_detail.html?id=${encodeURIComponent(provider.dr_id)}">Arzt-Steckbrief öffnen</a>`
        : "";

    return `
        <div class="treatment-map-popup">
            <strong>${providerName}</strong>
            ${address ? `<div class="treatment-map-popup-muted">${escapeHtml(address)}</div>` : ""}
            <ul>
                ${treatmentListHtml}
                ${moreHtml}
            </ul>
            <div class="treatment-map-popup-actions">
                ${doctorLink}
            </div>
        </div>
    `;
}

function buildAllMatchingProvidersPopupHtml(group) {
    const visibleProviders = group.providers.slice(0, 3);
    const hiddenProviderCount = Math.max(0, group.providers.length - visibleProviders.length);
    const providerBlocksHtml = visibleProviders.map(function (providerEntry) {
        const provider = providerEntry.provider;
        const providerName = escapeHtml(provider.dr_display_name || "Anbieter");
        const address = buildProviderAddressText(provider);
        const doctorLink = provider.dr_id
            ? `<a href="arzt_detail.html?id=${encodeURIComponent(provider.dr_id)}">Arzt-Steckbrief öffnen</a>`
            : "";

        const uniqueTreatments = dedupeProviderTreatments(providerEntry.treatments);
        const treatmentListHtml = uniqueTreatments.slice(0, 4).map(function (treatment) {
            const color = treatmentMapMarkerColors[Math.abs(Number(treatment.color_index || 0)) % treatmentMapMarkerColors.length];
            const distance = treatment.distance_km === null || treatment.distance_km === undefined
                ? ""
                : ` <span class="treatment-map-popup-muted">(${escapeHtml(formatDistanceKm(treatment.distance_km))})</span>`;

            return `
                <li>
                    <span class="treatment-map-popup-color-dot" style="background:${escapeHtml(color)}"></span>
                    <a href="therapie_detail.html?treat_id=${encodeURIComponent(treatment.treat_id)}">
                        ${escapeHtml(treatment.behandlung || "Unbekannte Therapie")}
                    </a>${distance}
                </li>
            `;
        }).join("");

        return `
            <div class="treatment-map-popup-provider-block">
                <strong>${providerName}</strong>
                ${address ? `<div class="treatment-map-popup-muted">${escapeHtml(address)}</div>` : ""}
                <ul>
                    ${treatmentListHtml}
                </ul>
                <div class="treatment-map-popup-actions">
                    ${doctorLink}
                </div>
            </div>
        `;
    }).join("<hr>");

    const moreProvidersHtml = hiddenProviderCount > 0
        ? `<div class="treatment-map-popup-muted">+ ${hiddenProviderCount} weitere Anbieter an diesem Standort</div>`
        : "";

    return `
        <div class="treatment-map-popup treatment-map-popup-wide">
            ${providerBlocksHtml}
            ${moreProvidersHtml}
        </div>
    `;
}

function dedupeProviderTreatments(treatments) {
    const byTreatId = new Map();

    treatments.forEach(function (treatment) {
        const treatId = Number(treatment.treat_id || 0);

        if (treatId > 0 && !byTreatId.has(treatId)) {
            byTreatId.set(treatId, treatment);
        }
    });

    return Array.from(byTreatId.values()).sort(function (a, b) {
        return String(a.behandlung || "").localeCompare(String(b.behandlung || ""), "de");
    });
}

function renderTreatmentMapLegend(legend, treatments) {
    clearTreatmentMapLegend();

    const mapContent = document.getElementById("treatment-map-content");

    if (!mapContent) {
        return;
    }

    const legendItems = buildTreatmentLegendItems(legend, treatments);

    if (legendItems.length === 0) {
        return;
    }

    const legendElement = document.createElement("div");
    legendElement.id = "treatment-map-legend";
    legendElement.className = "treatment-map-legend";

    legendElement.innerHTML = `
		<div class="treatment-map-legend-title">Farblegende</div>
		<div class="treatment-map-legend-hint">
			Zahl im Marker = Anzahl unterschiedlicher angezeigter Therapien an diesem Standort.
		</div>
		<div class="treatment-map-legend-list">
			${legendItems.map(function (item) {
				const color = treatmentMapMarkerColors[Math.abs(Number(item.color_index || 0)) % treatmentMapMarkerColors.length];

				return `
					<div class="treatment-map-legend-item">
						<span class="treatment-map-legend-dot" style="background:${escapeHtml(color)}"></span>
						<span>${escapeHtml(item.treatment_name || "Unbekannte Therapie")}</span>
					</div>
				`;
			}).join("")}
		</div>
	`;

    mapContent.appendChild(legendElement);
}

function buildTreatmentLegendItems(legend, treatments) {
    const treatmentIds = new Set(
        (treatments || [])
            .map(function (treatment) {
                return Number(treatment.treat_id || 0);
            })
            .filter(function (treatId) {
                return treatId > 0;
            })
    );

    if (Array.isArray(legend) && legend.length > 0) {
        return legend
            .filter(function (item) {
                return treatmentIds.has(Number(item.treat_id || 0));
            })
            .slice(0, 5)
            .map(function (item, index) {
                return {
                    treat_id: Number(item.treat_id || 0),
                    treatment_name: item.treatment_name || "",
                    color_index: Number.isFinite(Number(item.color_index)) ? Number(item.color_index) : index
                };
            });
    }

    return (treatments || []).slice(0, 5).map(function (treatment, index) {
        return {
            treat_id: Number(treatment.treat_id || 0),
            treatment_name: treatment.behandlung || "",
            color_index: index
        };
    });
}

function clearTreatmentMapLegend() {
    const existingLegend = document.getElementById("treatment-map-legend");

    if (existingLegend) {
        existingLegend.remove();
    }
}

function buildProviderAddressText(provider) {
    const street = [provider.loc_street, provider.loc_housenumber]
        .filter(Boolean)
        .join(" ")
        .trim();

    const city = [provider.loc_plz, provider.loc_city]
        .filter(Boolean)
        .join(" ")
        .trim();

    return [street, city].filter(Boolean).join(", ");
}


function updateTreatmentUserLocationMarker() {
    if (!treatmentMap) {
        return;
    }

    clearTreatmentUserLocationMarker();

    if (!currentTreatmentUserLocation) {
        return;
    }

    treatmentUserLocationMarker = L.marker([currentTreatmentUserLocation.lat, currentTreatmentUserLocation.lng], {
        icon: treatmentUserLocationIcon,
        zIndexOffset: 1000
    })
        .addTo(treatmentMap)
        .bindPopup(`<strong>Standort</strong><br>${escapeHtml(currentTreatmentUserLocation.label)}`);
}

function updateTreatmentRadiusCircle() {
    if (!treatmentMap) {
        return;
    }

    clearTreatmentRadiusCircle();

    if (!currentTreatmentUserLocation) {
        return;
    }

    const filters = getTreatmentFilters();

    if (filters.radiusKm <= 0) {
        return;
    }

    treatmentRadiusCircle = L.circle([currentTreatmentUserLocation.lat, currentTreatmentUserLocation.lng], {
        radius: filters.radiusKm * 1000,
        color: "#3388ff",
        weight: 2,
        opacity: 0.9,
        fillColor: "#3388ff",
        fillOpacity: 0.10,
        interactive: false
    }).addTo(treatmentMap);
}

function clearTreatmentUserLocationMarker() {
    if (treatmentMap && treatmentUserLocationMarker) {
        treatmentMap.removeLayer(treatmentUserLocationMarker);
    }

    treatmentUserLocationMarker = null;
}

function clearTreatmentRadiusCircle() {
    if (treatmentMap && treatmentRadiusCircle) {
        treatmentMap.removeLayer(treatmentRadiusCircle);
    }

    treatmentRadiusCircle = null;
}

function clearTreatmentProviderMarkers() {
    if (treatmentMap && treatmentMarkerGroup) {
        treatmentMap.removeLayer(treatmentMarkerGroup);
    }

    treatmentMarkerGroup = null;
}

function updateTreatmentMapStatus(message) {
    const statusElement = document.getElementById("treatment-map-status");
    const mapContent = document.getElementById("treatment-map-content");
    const messageText = String(message || "");

    if (statusElement) {
        statusElement.textContent = messageText;
    }

    if (mapContent) {
        mapContent.classList.toggle(
            "is-location-required",
            messageText.startsWith("Bitte Kartenstandort setzen")
        );
    }
}

function updateTreatmentLocationStatus(message) {
    const statusElement = document.getElementById("treatment-location-status");

    if (statusElement) {
        statusElement.textContent = message;
    }
}

function getCurrentTreatmentCity() {
    if (!currentTreatmentUserLocation || !currentTreatmentUserLocation.city) {
        return "";
    }

    return String(currentTreatmentUserLocation.city).trim();
}

function hasValidCoordinates(lat, lng) {
    const latNumber = Number(lat);
    const lngNumber = Number(lng);

    if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) {
        return false;
    }

    return latNumber >= -90 && latNumber <= 90 && lngNumber >= -180 && lngNumber <= 180;
}

function formatDistanceKm(distanceKm) {
    const distance = Number(distanceKm);

    if (Number.isNaN(distance)) {
        return "—";
    }

    if (distance < 10) {
        return `${distance.toFixed(1).replace(".", ",")} km`;
    }

    return `${Math.round(distance)} km`;
}

function updateTreatmentResultsCount(filteredCount, totalCount) {
    const countElement = document.getElementById("treatment-results-count");

    if (!countElement) {
        return;
    }

    const filters = getTreatmentFilters();
    const currentCity = getCurrentTreatmentCity();

    const citySuffix = filters.onlyCurrentCity && currentCity
        ? ` · nur in meiner Stadt: ${currentCity}`
        : "";

	const radiusSuffix = filters.radiusKm > 0
		? ` · Radius: ${filters.radiusKm} km`
		: "";

    if (showOnlyTreatmentCompareSelection) {
        countElement.textContent = `${selectedTreatmentsForCompare.length} Therapien in der Vergleichsansicht${citySuffix}${radiusSuffix}`;
        return;
    }

    if (filteredCount === totalCount) { 
        if (filteredCount === 1) {
            countElement.textContent = `1 Therapie gefunden${citySuffix}${radiusSuffix}`;
            return;
        }

        countElement.textContent = `${filteredCount} Therapien gefunden${citySuffix}${radiusSuffix}`;
        return;
    }

    countElement.textContent = `${filteredCount} von ${totalCount} Therapien gefunden${citySuffix}${radiusSuffix}`;
}

function clampNumber(value, min, max) {
    const number = Number(value);

    if (Number.isNaN(number)) {
        return min;
    }

    return Math.min(max, Math.max(min, number));
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

function escapeHtmlAttribute(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
