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
let currentViewMode = "cards";

let treatmentMap = null;
let treatmentMarkerGroup = null;
let treatmentUserLocationMarker = null;
let treatmentRadiusCircle = null;
let treatmentUserLocationIcon = null;
let currentTreatmentUserLocation = null;
let treatmentSmartSearchOverride = null;
let treatmentAliasSmartSuggestController = null;
let treatmentAliasSmartSuggestions = [];

const treatmentDefaultMapCenter = {
    lat: 51.1657,
    lng: 10.4515,
    label: "Deutschland"
};

document.addEventListener("DOMContentLoaded", function () {
    initTreatmentPage();
});

async function initTreatmentPage() {
    initTreatmentMap();
    bindTreatmentNavigationEvents();
    bindTreatmentSmartSearchEvents();
    bindTreatmentViewSwitchEvents();
    bindTreatmentCardContainerEvents();
    bindTreatmentMapEvents();
    await loadTreatmentResults();
}

async function loadTreatmentResults() {
    const tableBody = document.getElementById("treatment-results-body");
    const cardResults = document.getElementById("treatment-card-results");

    try {
        const url = buildTreatmentSearchUrl();
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Fehler beim Laden der Therapiedaten.");
        }

        const data = await response.json();

        if (!data.ok || !Array.isArray(data.items)) {
            throw new Error("Unerwartetes API-Format.");
        }

        currentTreatments = data.items.map(normalizeTreatment);
        currentCategories = Array.isArray(data.categories) ? data.categories : [];

        applyClientSideTreatmentSort();

        populateTreatmentCategorySelect(currentCategories);
        renderCurrentTreatmentView();

        updateTreatmentResultsCount(
            Number(data.count ?? currentTreatments.length),
            Number(data.total_count ?? currentTreatments.length)
        );

        renderTreatmentMap(currentTreatments);

    } catch (error) {
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

        updateTreatmentResultsCount(0, 0);
        renderTreatmentMap([]);
        updateTreatmentMapStatus("Die Kartendaten konnten nicht geladen werden.");
    }
}

function buildTreatmentSearchUrl() {
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
        params.set("sort", "name");
        params.set("direction", "asc");

        if (currentTreatmentUserLocation) {
            params.set("include_map", "1");
            params.set("lat", String(currentTreatmentUserLocation.lat));
            params.set("lng", String(currentTreatmentUserLocation.lng));
        }

        return `api/treatments_search.php?${params.toString()}`;
    }

    const activeSearchTerm = treatmentSmartSearchOverride
        ? String(treatmentSmartSearchOverride.searchTerm || "").trim()
        : filters.searchTerm;

    const activeSearchMode = treatmentSmartSearchOverride
        ? String(treatmentSmartSearchOverride.searchMode || "basic").trim()
        : "basic";

    if (activeSearchTerm !== "") {
        params.set("search", activeSearchTerm);
    }

    if (activeSearchMode !== "basic") {
        params.set("search_mode", activeSearchMode);
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

    if (filters.sortKey === "distance") {
        params.set("sort", "name");
        params.set("direction", "asc");
    } else {
        params.set("sort", filters.sortKey);
        params.set("direction", filters.sortDirection);
    }

    if (currentTreatmentUserLocation) {
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
        weitere_hinweise: treatment.weitere_hinweise || "",
        pro: Number(treatment.pro ?? 0),
        neutral: Number(treatment.neutral ?? 0),
        contra: Number(treatment.contra ?? 0),
        total_votes: Number(treatment.total_votes ?? 0),
        positive_ratio: Number(treatment.positive_ratio ?? 0),
        neutral_ratio: Number(treatment.neutral_ratio ?? 0),
        negative_ratio: Number(treatment.negative_ratio ?? 0),
        provider_count: Number(treatment.provider_count ?? 0),
        matching_provider_count: Number(treatment.matching_provider_count ?? 0),
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

    const applyButton = document.getElementById("treatment-filter-apply-button");
    const resetButton = document.getElementById("treatment-filter-reset-button");
    const sortSelect = document.getElementById("treatment-sort-select");
    const categorySelect = document.getElementById("treatment-category-select");
    const onlyWithProviderInput = document.getElementById("treatment-only-with-provider-input");
    const onlyCurrentCityInput = document.getElementById("treatment-only-current-city-input");
    const radiusInput = document.getElementById("treatment-radius-input");
    const minProviderInput = document.getElementById("treatment-min-provider-input");
    const locationInput = document.getElementById("treatment-location-input");
    const locationApplyButton = document.getElementById("treatment-location-apply-button");
    const locationResetButton = document.getElementById("treatment-location-reset-button");

    if (applyButton) {
        applyButton.addEventListener("click", function () {
            treatmentSmartSearchOverride = null;
            if (!validateLocationDependentFilters()) {
                return;
            }

            loadTreatmentResults();
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", resetTreatmentFilters);
    }

    if (sortSelect) {
        sortSelect.addEventListener("change", function () {
            if (!validateLocationDependentFilters()) {
                return;
            }

            loadTreatmentResults();
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener("change", function () {
            if (!validateLocationDependentFilters()) {
                return;
            }

            loadTreatmentResults();
        });
    }

    if (radiusInput) {
        radiusInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                normalizeRadiusInput();

                if (!validateLocationDependentFilters()) {
                    return;
                }

                loadTreatmentResults();
            }
        });

        radiusInput.addEventListener("blur", function () {
            normalizeRadiusInput();
        });
    }

    if (onlyWithProviderInput) {
        onlyWithProviderInput.addEventListener("change", function () {
            if (onlyWithProviderInput.checked && minProviderInput) {
                minProviderInput.value = Math.max(1, Number(minProviderInput.value || 0));
            }

            loadTreatmentResults();
        });
    }

    if (onlyCurrentCityInput) {
        onlyCurrentCityInput.addEventListener("change", function () {
            if (!validateLocationDependentFilters()) {
                return;
            }

            loadTreatmentResults();
        });
    }


    if (minProviderInput) {
        minProviderInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                loadTreatmentResults();
            }
        });
    }

    if (locationApplyButton) {
        locationApplyButton.addEventListener("click", applyTreatmentLocationFromInput);
    }

    if (locationResetButton) {
        locationResetButton.addEventListener("click", resetTreatmentLocation);
    }

    if (locationInput) {
        locationInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                applyTreatmentLocationFromInput();
            }
        });
    }

    bindRangePair(
        "treatment-min-positive-range",
        "treatment-min-positive-input",
        loadTreatmentResults
    );

    bindRangePair(
        "treatment-max-negative-range",
        "treatment-max-negative-input",
        loadTreatmentResults
    );
}

function bindTreatmentSmartSearchEvents() {
    const input = document.getElementById("treatment-alias-smart-input");
    const suggestionsBox = document.getElementById("treatment-alias-smart-suggestions");

    if (input) {
        input.addEventListener("input", function () {
            const query = String(input.value || "").trim();

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
        alert("Bitte zuerst deinen Kartenstandort setzen. Danach können Stadt- und Radiusfilter verwendet werden.");

        const onlyCurrentCityInput = document.getElementById("treatment-only-current-city-input");
        const radiusInput = document.getElementById("treatment-radius-input");

        if (onlyCurrentCityInput) {
            onlyCurrentCityInput.checked = false;
        }

        if (radiusInput) {
            radiusInput.value = "0";
        }

        clearTreatmentRadiusCircle();
        return false;
    }

    if (filters.onlyCurrentCity && !getCurrentTreatmentCity()) {
        alert("Aus dem Kartenstandort konnte keine Stadt erkannt werden. Bitte gib den Standort eindeutiger ein, z. B. 50677 Köln.");

        const onlyCurrentCityInput = document.getElementById("treatment-only-current-city-input");

        if (onlyCurrentCityInput) {
            onlyCurrentCityInput.checked = false;
        }

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

function bindTreatmentCardContainerEvents() {
    const cardResults = document.getElementById("treatment-card-results");

    if (!cardResults) {
        return;
    }

    cardResults.addEventListener("click", function (event) {
        const voteButton = event.target.closest(".treatment-card-vote-button");

        if (voteButton) {
            const treatmentName = voteButton.dataset.treatmentName || "";
            const voteType = voteButton.dataset.voteType || "";
            const treatId = Number(voteButton.dataset.treatId || 0);

            submitTreatmentVote(treatId, treatmentName, voteType, voteButton);
            return;
        }

        const detailButton = event.target.closest(".treatment-card-detail-button");

        if (detailButton) {
            const treatId = Number(detailButton.dataset.treatId || 0);

            if (!treatId) {
                alert("Für diese Therapie fehlt die technische ID.");
                return;
            }

            window.location.href = `therapie_detail.html?treat_id=${encodeURIComponent(treatId)}`;
        }
    });
}

function setTreatmentViewMode(viewMode) {
    currentViewMode = viewMode === "table" ? "table" : "cards";

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

function renderCurrentTreatmentView() {
    const tableBody = document.getElementById("treatment-results-body");
    const cardResults = document.getElementById("treatment-card-results");

    if (currentViewMode === "cards") {
        if (tableBody) {
            tableBody.innerHTML = "";
        }

        renderTreatmentCards(currentTreatments);
        return;
    }

    if (cardResults) {
        cardResults.innerHTML = "";
    }

    renderTreatmentResultsTable(currentTreatments);
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

    rangeInput.addEventListener("change", function () {
        onChangeCallback();
    });

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
    const onlyCurrentCityInput = document.getElementById("treatment-only-current-city-input");
    const radiusInput = document.getElementById("treatment-radius-input");

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
        onlyCurrentCity: onlyCurrentCityInput ? onlyCurrentCityInput.checked : false,
        radiusKm: radiusInput ? clampNumber(radiusInput.value, 0, 1000) : 0,
        minPositiveRatio: minPositiveInput ? clampNumber(minPositiveInput.value, 0, 100) : 0,
        maxNegativeRatio: maxNegativeInput ? clampNumber(maxNegativeInput.value, 0, 100) : 100,
        minProviderCount: minProviderCount,
        onlyWithProvider: onlyWithProvider
    };
}

function applyClientSideTreatmentSort() {
    const filters = getTreatmentFilters();

    if (filters.sortKey !== "distance") {
        return;
    }

    const directionFactor = filters.sortDirection === "desc" ? -1 : 1;

    currentTreatments.sort(function (a, b) {
        const distanceA = a.nearest_provider_distance_km === null ? Infinity : Number(a.nearest_provider_distance_km);
        const distanceB = b.nearest_provider_distance_km === null ? Infinity : Number(b.nearest_provider_distance_km);

        if (distanceA !== distanceB) {
            return (distanceA - distanceB) * directionFactor;
        }

        return String(a.behandlung || "").localeCompare(String(b.behandlung || ""), "de");
    });
}

function resetTreatmentFilters() {
    treatmentSmartSearchOverride = null;
    treatmentAliasSmartSuggestions = [];
    hideTreatmentAliasSmartSuggestions();
    setInputValue("treatment-alias-smart-input", "");
    setTreatmentAliasSmartStatus("Suche nach direktem Therapienamen, Alias/Synonym oder Oberbegriff/Kombibegriff.");
    setInputValue("treatment-sort-select", "name:asc");
    setInputValue("treatment-category-select", "");
    setInputValue("treatment-min-positive-range", "0");
    setInputValue("treatment-min-positive-input", "0");
    setInputValue("treatment-max-negative-range", "100");
    setInputValue("treatment-max-negative-input", "100");
    setInputValue("treatment-min-provider-input", "0");
    setInputValue("treatment-radius-input", "0");

    const onlyWithProviderInput = document.getElementById("treatment-only-with-provider-input");
    const onlyCurrentCityInput = document.getElementById("treatment-only-current-city-input");

    if (onlyWithProviderInput) {
        onlyWithProviderInput.checked = false;
    }

    if (onlyCurrentCityInput) {
        onlyCurrentCityInput.checked = false;
    }

    resetTreatmentLocation(false);
    loadTreatmentResults();
}

function setInputValue(id, value) {
    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.value = value;
}

function buildTreatmentTableRowHtml(treatment, index) {
    const treatmentName = escapeHtml(treatment.behandlung || "Unbekannte Therapie");
    const categoryHtml = buildTreatmentCategoryHtml(treatment);
    const experienceHtml = buildTreatmentExperienceHtml(treatment);
    const providerHtml = buildTreatmentProviderHtml(treatment);
    const distanceLocationHtml = buildTreatmentDistanceLocationHtml(treatment);

    return `
        <tr data-treat-id="${treatment.treat_id}">
            <td class="treatment-table-rank">${index + 1}</td>
            <td class="treatment-table-name">
                <a class="treatment-table-detail-link" href="therapie_detail.html?treat_id=${encodeURIComponent(treatment.treat_id)}">
                    ${treatmentName}
                </a>
            </td>
            <td>${categoryHtml}</td>
            <td>${experienceHtml}</td>
            <td>${providerHtml}</td>
            <td>${distanceLocationHtml}</td>
        </tr>
    `;
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

    if (!treatments || treatments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">Keine Therapien gefunden.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = treatments.map(function (treatment, index) {
        return buildTreatmentTableRowHtml(treatment, index);
    }).join("");
}

function renderTreatmentCards(treatments) {
    const cardResults = document.getElementById("treatment-card-results");

    if (!cardResults) {
        return;
    }

    if (!treatments || treatments.length === 0) {
        cardResults.innerHTML = `
            <p class="treatment-empty-state">Keine Therapien gefunden.</p>
        `;
        return;
    }

    cardResults.innerHTML = treatments.map(function (treatment, index) {
        return buildTreatmentCardHtml(treatment, index);
    }).join("");
}

function buildTreatmentCardHtml(treatment, index) {
    const treatmentName = escapeHtml(treatment.behandlung || "Unbekannte Therapie");
    const rawTreatmentName = escapeHtmlAttribute(treatment.behandlung || "");
    const categoryHtml = buildTreatmentCategoryHtml(treatment);
    const providerHtml = buildTreatmentProviderHtml(treatment);
    const noteText = String(treatment.weitere_hinweise || "").trim();
    const noteHtml = noteText
        ? escapeHtml(noteText)
        : `<span class="treatment-card-muted">Kein Hinweis hinterlegt.</span>`;

    const totalVotes = Number(treatment.total_votes ?? 0);
    const positiveRatio = Number(treatment.positive_ratio ?? 0);
    const neutralRatio = Number(treatment.neutral_ratio ?? 0);
    const negativeRatio = Number(treatment.negative_ratio ?? 0);

    const pro = Number(treatment.pro ?? 0);
    const neutral = Number(treatment.neutral ?? 0);
    const contra = Number(treatment.contra ?? 0);

    const distanceHtml = treatment.nearest_provider_distance_km === null
        ? ""
        : `<span class="treatment-card-muted">Nächster Anbieter: ${escapeHtml(formatDistanceKm(treatment.nearest_provider_distance_km))}</span>`;

    return `
        <article class="treatment-card" data-treat-id="${treatment.treat_id}">
            <div class="treatment-card-accent"></div>

            <div class="treatment-card-main-header">
                <div class="treatment-card-rank-large">
                    <strong>#${index + 1}</strong>
                    <span>Rang</span>
                </div>

                <div class="treatment-card-title-area">
                    <h3 class="treatment-card-title">${treatmentName}</h3>

                    <div class="treatment-card-meta">
                        ${categoryHtml}
                        ${distanceHtml}
                    </div>
                </div>

                <div class="treatment-card-provider-wrap">
                    <span class="treatment-card-provider-label">Anbieter</span>
                    ${providerHtml}
                </div>
            </div>

            <div class="treatment-card-content-grid">
                <section class="treatment-card-info-panel treatment-card-note-panel">
                    <h4 class="treatment-card-section-heading">Hinweis</h4>
                    <div class="treatment-card-main-text">${noteHtml}</div>
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

                <div class="treatment-card-vote-buttons">
                    <button
                        type="button"
                        class="treatment-card-vote-button treatment-card-vote-positive"
                        data-treat-id="${treatment.treat_id}"
                        data-treatment-name="${rawTreatmentName}"
                        data-vote-type="hilft"
                    >
                        Positiv
                    </button>

                    <button
                        type="button"
                        class="treatment-card-vote-button treatment-card-vote-neutral"
                        data-treat-id="${treatment.treat_id}"
                        data-treatment-name="${rawTreatmentName}"
                        data-vote-type="gleich"
                    >
                        Neutral
                    </button>

                    <button
                        type="button"
                        class="treatment-card-vote-button treatment-card-vote-negative"
                        data-treat-id="${treatment.treat_id}"
                        data-treatment-name="${rawTreatmentName}"
                        data-vote-type="verschlechterung"
                    >
                        Negativ
                    </button>
                </div>
            </section>

            <footer class="treatment-card-footer">
                <button
                    type="button"
                    class="treatment-card-detail-button"
                    data-treat-id="${treatment.treat_id}"
                >
                    Mehr Details
                </button>
            </footer>
        </article>
    `;
}

async function submitTreatmentVote(treatId, treatmentName, voteType, button) {
    if (!treatId || !treatmentName || !voteType || !button) {
        return;
    }

    const cardElement = button.closest(".treatment-card");
    const buttonsInCard = cardElement
        ? cardElement.querySelectorAll(".treatment-card-vote-button")
        : [];

    buttonsInCard.forEach(function (cardButton) {
        cardButton.disabled = true;
        cardButton.classList.add("is-saving");
    });

    try {
        const response = await fetch("api/inc_votes_db.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                treatment: treatmentName,
                type: voteType
            })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.message || "Bewertung konnte nicht gespeichert werden.");
        }

        await refreshSingleTreatment(treatId);

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

async function refreshSingleTreatment(treatId) {
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

    const updatedTreatment = normalizeTreatment(data.items[0]);
    const index = currentTreatments.findIndex(function (treatment) {
        return Number(treatment.treat_id) === Number(treatId);
    });

    if (index === -1) {
        return;
    }

    currentTreatments[index] = updatedTreatment;
    applyClientSideTreatmentSort();
    renderCurrentTreatmentView();
    renderTreatmentMap(currentTreatments);
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

function buildTreatmentExperienceHtml(treatment) {
    const totalVotes = Number(treatment.total_votes ?? 0);

    if (totalVotes === 0) {
        return `<span class="treatment-table-muted">Noch keine Bewertungen</span>`;
    }

    const positiveRatio = Number(treatment.positive_ratio ?? 0);
    const neutralRatio = Number(treatment.neutral_ratio ?? 0);
    const negativeRatio = Number(treatment.negative_ratio ?? 0);

    return `
        <div class="treatment-table-experience-grid">
            <span class="treatment-table-experience-value treatment-table-badge-positive">+${positiveRatio}%</span>
            <span class="treatment-table-experience-value treatment-table-badge-neutral">=${neutralRatio}%</span>
            <span class="treatment-table-experience-value treatment-table-badge-negative">-${negativeRatio}%</span>
            <span class="treatment-table-vote-count">(n=${totalVotes})</span>
        </div>
    `;
}

function buildTreatmentProviderHtml(treatment) {
    const filters = getTreatmentFilters();
    const providerCount = Number(treatment.provider_count ?? 0);
    const matchingProviderCount = Number(treatment.matching_provider_count ?? 0);
    const hasSearchArea = (filters.onlyCurrentCity && getCurrentTreatmentCity() !== "") || filters.radiusKm > 0;

    if (providerCount <= 0) {
        return `<span class="treatment-provider-bubble treatment-provider-bubble-empty">0</span>`;
    }

    if (hasSearchArea) {
        return `<span class="treatment-provider-bubble" title="${matchingProviderCount} Anbieter im Suchgebiet, ${providerCount} Anbieter gesamt">${matchingProviderCount}/${providerCount}</span>`;
    }

    return `<span class="treatment-provider-bubble">${providerCount}</span>`;
}

function buildTreatmentNoteHtml(treatment) {
    const note = String(treatment.weitere_hinweise || "").trim();

    if (!note) {
        return `<span class="treatment-table-muted">—</span>`;
    }

    return `
        <div class="treatment-table-note">
            ${escapeHtml(note)}
        </div>
    `;
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

    treatmentMap = L.map("treatment-map", { zoomControl: false }).setView(
        [treatmentDefaultMapCenter.lat, treatmentDefaultMapCenter.lng],
        6
    );

    L.control.zoom({
        position: "topright"
    }).addTo(treatmentMap);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere"
    }).addTo(treatmentMap);

    treatmentUserLocationIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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

        const cityText = geocodedLocation.city
            ? ` · Stadt: ${geocodedLocation.city}`
            : "";

        updateTreatmentLocationStatus(`Kartenstandort gesetzt: ${geocodedLocation.label}${cityText}`);
        updateTreatmentUserLocationMarker();
        updateTreatmentRadiusCircle();
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
    setInputValue("treatment-location-input", "");
    setInputValue("treatment-radius-input", "0");
    updateTreatmentLocationStatus("Kein Kartenstandort gesetzt.");
    clearTreatmentUserLocationMarker();
    clearTreatmentRadiusCircle();
    clearTreatmentProviderMarkers();

    const onlyCurrentCityInput = document.getElementById("treatment-only-current-city-input");

    if (onlyCurrentCityInput) {
        onlyCurrentCityInput.checked = false;
    }

    if (treatmentMap) {
        treatmentMap.setView([treatmentDefaultMapCenter.lat, treatmentDefaultMapCenter.lng], 6);
    }

    updateTreatmentMapStatus("Bitte Kartenstandort setzen, um die nächsten Anbieterstandorte der gefundenen Therapien auf der Karte zu sehen.");

    if (shouldReload) {
        loadTreatmentResults();
    }
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

function renderTreatmentMap(treatments) {
    if (!treatmentMap) {
        return;
    }

    clearTreatmentProviderMarkers();
    updateTreatmentUserLocationMarker();
    updateTreatmentRadiusCircle();

    if (!currentTreatmentUserLocation) {
        updateTreatmentMapStatus("Bitte Kartenstandort setzen, um die nächsten Anbieterstandorte der gefundenen Therapien auf der Karte zu sehen.");
        return;
    }

    const groups = groupTreatmentsByNearestProviderLocation(treatments || []);
    const groupValues = Array.from(groups.values());

    if (groupValues.length === 0) {
        updateTreatmentMapStatus("Für die aktuell gefundenen Therapien gibt es keine koordinierten Anbieterstandorte.");
        return;
    }

    treatmentMarkerGroup = L.featureGroup();

    groupValues.forEach(function (group) {
        const marker = L.marker([group.lat, group.lng]);
        marker.bindPopup(buildTreatmentMapPopupHtml(group));
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

    const treatmentCountOnMap = groupValues.reduce(function (sum, group) {
        return sum + group.treatments.length;
    }, 0);

    const filters = getTreatmentFilters();
    const cityPart = filters.onlyCurrentCity && getCurrentTreatmentCity()
        ? ` in deiner Stadt „${getCurrentTreatmentCity()}“`
        : "";
    const radiusPart = filters.radiusKm > 0
        ? ` im Radius von ${filters.radiusKm} km`
        : "";

    updateTreatmentMapStatus(
        `${treatmentCountOnMap} Therapien${cityPart}${radiusPart} mit nächstem Anbieterstandort auf der Karte. Mehrere Therapien am selben Standort werden in einem Popup gebündelt.`
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

function buildTreatmentMapPopupHtml(group) {
    const provider = group.provider;
    const providerName = escapeHtml(provider.dr_display_name || "Anbieter");
    const address = buildProviderAddressText(provider);
    const treatments = group.treatments.slice().sort(function (a, b) {
        return String(a.behandlung || "").localeCompare(String(b.behandlung || ""), "de");
    });

    const visibleTreatments = treatments.slice(0, 8);
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
            <hr>
            <div><strong>Therapien an diesem nächsten Standort:</strong></div>
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

    if (statusElement) {
        statusElement.textContent = message;
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