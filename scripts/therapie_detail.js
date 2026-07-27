let currentTreatmentDetail = null;
let treatmentProviderMap = null;
let treatmentProviderMarkerLayer = null;
let currentProviderViewMode = "list";
let currentProviderSortMode = "name";
let currentProviderLocation = null;


document.addEventListener("DOMContentLoaded", function () {
    loadTreatmentDetail();
    setupTreatmentDetailVoteButtons();
    setupProviderViewSwitch();
});

async function loadTreatmentDetail() {
    const treatId = getTreatIdFromUrl();

    if (!treatId) {
        showTreatmentDetailError("Keine gültige Therapie-ID in der URL gefunden.");
        return;
    }

    try {
        const treatment = await fetchTreatmentById(treatId);

        currentTreatmentDetail = treatment;

        renderTreatmentDetail(currentTreatmentDetail);
        showTreatmentDetailContent();
        renderTreatmentProviderMap(currentTreatmentDetail.providers);
    } catch (error) {
        console.error("Fehler beim Laden des Therapie-Steckbriefs:", error);
        showTreatmentDetailError(error.message || "Der Therapie-Steckbrief konnte nicht geladen werden.");
    }
}

async function fetchTreatmentById(treatId) {
    const response = await fetch(`api/treatments_detail.php?treat_id=${encodeURIComponent(treatId)}`);
    const data = await response.json();

    if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.message || "Der Therapie-Steckbrief konnte nicht geladen werden.");
    }

    return normalizeTreatmentDetail(data.item);
}

function normalizeTreatmentDetail(treatment) {
    return {
        treat_id: Number(treatment.treat_id ?? 0),
        slug: treatment.slug || "",
        behandlung: treatment.behandlung || "",
        typ: treatment.typ || "",
        aufwand: treatment.aufwand || "",
        crashrisiko: treatment.crashrisiko || "",
        eskalationsstufe: treatment.eskalationsstufe || "",
        kosten: treatment.kosten || "",
        nutzen: treatment.nutzen || "",
        wirkgeschwindigkeit: treatment.wirkgeschwindigkeit || "",
        wirkmechanismus: treatment.wirkmechanismus || "",
        indikationen_anwendungsgebiete: treatment.indikationen_anwendungsgebiete || "",
        pro: Number(treatment.pro ?? 0),
        neutral: Number(treatment.neutral ?? 0),
        contra: Number(treatment.contra ?? 0),
        total_votes: Number(treatment.total_votes ?? 0),
        positive_ratio: Number(treatment.positive_ratio ?? 0),
        neutral_ratio: Number(treatment.neutral_ratio ?? 0),
        negative_ratio: Number(treatment.negative_ratio ?? 0),
        provider_count: Number(treatment.provider_count ?? 0),
        providers: Array.isArray(treatment.providers) ? treatment.providers.map(normalizeProvider) : [],
        sources: Array.isArray(treatment.sources) ? treatment.sources : [],
        aliases: Array.isArray(treatment.aliases) ? treatment.aliases : []
    };
}

function normalizeProvider(provider) {
    return {
        ...provider,
        dr_id: Number(provider.dr_id ?? 0),
        sort_order: Number(provider.sort_order ?? 0),
        dr_is_dr: Number(provider.dr_is_dr ?? 0),
        loc_lat: provider.loc_lat === null || provider.loc_lat === undefined || provider.loc_lat === "" ? null : Number(provider.loc_lat),
        loc_lng: provider.loc_lng === null || provider.loc_lng === undefined || provider.loc_lng === "" ? null : Number(provider.loc_lng),
        has_coordinates: provider.has_coordinates === true || provider.has_coordinates === 1 || provider.has_coordinates === "1",
        pro: Number(provider.pro ?? 0),
        neutral: Number(provider.neutral ?? 0),
        contra: Number(provider.contra ?? 0),
        total_votes: Number(provider.total_votes ?? 0),
        positive_ratio: Number(provider.positive_ratio ?? 0),
        neutral_ratio: Number(provider.neutral_ratio ?? 0),
        negative_ratio: Number(provider.negative_ratio ?? 0)
    };
}

function setupTreatmentDetailVoteButtons() {
    const contentElement = document.getElementById("treatment-detail-content");

    if (!contentElement) {
        return;
    }

    contentElement.addEventListener("click", handleTreatmentDetailVote);
}

function setupProviderViewSwitch() {
    document.addEventListener("click", async function (event) {
        const viewButton = event.target.closest(".treatment-detail-provider-view-button");

        if (viewButton) {
            const nextMode = viewButton.getAttribute("data-provider-view");

            if (!["cards", "list"].includes(nextMode)) {
                return;
            }

            currentProviderViewMode = nextMode;

            if (currentTreatmentDetail) {
                renderTreatmentProviders(currentTreatmentDetail.providers);
            }

            return;
        }

        const sortButton = event.target.closest(".treatment-detail-provider-sort-button");

        if (sortButton) {
            const nextSort = sortButton.getAttribute("data-provider-sort");

            if (!["name", "rating", "distance"].includes(nextSort)) {
                return;
            }

            if (nextSort === "distance" && !currentProviderLocation) {
                focusProviderLocationInput();
                alert("Bitte zuerst einen Standort eingeben, damit nach Entfernung sortiert werden kann.");
                return;
            }

            currentProviderSortMode = nextSort;

            if (currentTreatmentDetail) {
                renderTreatmentProviders(currentTreatmentDetail.providers);
            }

            return;
        }

        const setLocationButton = event.target.closest(".treatment-detail-provider-location-set-button");

        if (setLocationButton) {
            await handleProviderLocationSubmit();
            return;
        }

        const resetLocationButton = event.target.closest(".treatment-detail-provider-location-reset-button");

		if (resetLocationButton) {
			currentProviderLocation = null;

			if (currentProviderSortMode === "distance") {
				currentProviderSortMode = "name";
			}

			if (currentTreatmentDetail) {
				renderTreatmentProviders(currentTreatmentDetail.providers);
				renderTreatmentProviderMap(currentTreatmentDetail.providers);
			}

			return;
		}
    });

    document.addEventListener("keydown", async function (event) {
        const input = event.target.closest("#treatment-detail-provider-location-input");

        if (!input) {
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            await handleProviderLocationSubmit();
        }
    });
}

async function handleTreatmentDetailVote(event) {
    const button = event.target.closest(".treatment-detail-vote-button");

    if (!button) {
        return;
    }

    if (!currentTreatmentDetail || !currentTreatmentDetail.treat_id || !currentTreatmentDetail.behandlung) {
        alert("Die Therapie konnte nicht bewertet werden, weil technische Angaben fehlen.");
        return;
    }

    const treatId = Number(currentTreatmentDetail.treat_id);
    const treatmentName = String(currentTreatmentDetail.behandlung || "").trim();
    const voteType = button.getAttribute("data-vote-type");

    if (!treatId || !treatmentName || !voteType) {
        alert("Die Bewertung konnte nicht gespeichert werden, weil technische Angaben fehlen.");
        return;
    }

    setTreatmentDetailVoteButtonsDisabled(true);

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

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.error) {
            throw new Error(result.message || "Bewertung konnte nicht gespeichert werden.");
        }

        currentTreatmentDetail = await fetchTreatmentById(treatId);
        renderTreatmentDetail(currentTreatmentDetail);
        renderTreatmentProviderMap(currentTreatmentDetail.providers);
    } catch (error) {
        console.error("Fehler beim Speichern der Therapiebewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden. Details stehen in der Konsole.");
    } finally {
        setTreatmentDetailVoteButtonsDisabled(false);
    }
}

function setTreatmentDetailVoteButtonsDisabled(isDisabled) {
    document.querySelectorAll(".treatment-detail-vote-button").forEach(function (button) {
        button.disabled = isDisabled;
        button.classList.toggle("is-saving", isDisabled);
    });
}

function getTreatIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("treat_id"));

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function renderTreatmentDetail(treatment) {
    const name = treatment.behandlung || "Unbekannte Therapie";
    const category = treatment.typ || "Noch nicht hinterlegt.";
    const providerCount = Number(treatment.provider_count || 0);
    const totalVotes = Number(treatment.total_votes || 0);

    document.title = `${name} | Long Covid Navigator`;

    setText("treatment-detail-title", name);
    setText("treatment-detail-subtitle", buildTreatmentSubtitle(treatment));
    setText("treatment-detail-avatar", buildTreatmentInitials(name));
    setText("treatment-detail-provider-count", String(providerCount));
    setText("treatment-detail-total-votes", String(totalVotes));

    renderTreatmentTags(treatment);
    renderTreatmentRating(treatment);
    renderCompactText("treatment-detail-category", category);
    renderTreatmentProviderCard(treatment);
    renderTreatmentProviders(treatment.providers);
    renderTreatmentSources(treatment.sources);
    renderTreatmentAliases(treatment);
}

function buildTreatmentSubtitle(treatment) {
    const parts = [];

    if (treatment.typ) {
        parts.push(treatment.typ);
    }

    if (Number(treatment.provider_count || 0) === 1) {
        parts.push("1 Anbieter hinterlegt");
    } else {
        parts.push(`${Number(treatment.provider_count || 0)} Anbieter hinterlegt`);
    }

    return parts.join(" · ");
}

function buildTreatmentInitials(name) {
    const cleanedName = String(name || "")
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    const parts = cleanedName
        .split(/\s+/)
        .map(part => part.trim())
        .filter(part => part.length > 0 && /[\p{L}\p{N}]/u.test(part));

    if (parts.length === 0) {
        return "TH";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderTreatmentTags(treatment) {
    const element = document.getElementById("treatment-detail-tags");

    if (!element) {
        return;
    }

    const tags = [];

    if (treatment.typ) {
        tags.push(treatment.typ);
    }

    if (Number(treatment.provider_count || 0) > 0) {
        tags.push(`${Number(treatment.provider_count || 0)} Anbieter`);
    } else {
        tags.push("Keine Anbieter hinterlegt");
    }

    if (Number(treatment.total_votes || 0) > 0) {
        tags.push(`${Number(treatment.total_votes || 0)} Bewertungen`);
    } else {
        tags.push("Noch keine Bewertungen");
    }

    element.innerHTML = tags
        .map(tag => `<span class="treatment-detail-tag">${escapeHtml(tag)}</span>`)
        .join("");
}

function renderTreatmentRating(treatment) {
    const element = document.getElementById("treatment-detail-rating");
    const cardTotalElement = document.getElementById("treatment-detail-rating-card-total");

    if (!element) {
        return;
    }

    const stats = getTreatmentVoteStats(treatment);

    if (cardTotalElement) {
        cardTotalElement.textContent = `(${stats.totalVotes} insgesamt)`;
    }

    if (stats.totalVotes === 0) {
        element.innerHTML = `
            <div class="treatment-detail-rating-empty">
                Noch keine Bewertungen vorhanden.
            </div>

            ${buildOwnRatingHtml()}
        `;
        return;
    }

    element.innerHTML = `
        ${buildRatingTilesHtml(stats)}

        <div class="treatment-detail-rating-total">
            ${stats.totalVotes} Bewertungen insgesamt
        </div>

        ${buildOwnRatingHtml()}
    `;
}

function buildRatingTilesHtml(stats) {
    return `
        <div class="treatment-detail-rating-tiles">
            <div class="treatment-detail-rating-tile treatment-detail-rating-positive">
                <div class="treatment-detail-rating-value">${stats.positiveRatio}%</div>
                <div class="treatment-detail-rating-label">Positiv</div>
                <div class="treatment-detail-rating-count">${stats.pro}</div>
            </div>

            <div class="treatment-detail-rating-tile treatment-detail-rating-neutral">
                <div class="treatment-detail-rating-value">${stats.neutralRatio}%</div>
                <div class="treatment-detail-rating-label">Neutral</div>
                <div class="treatment-detail-rating-count">${stats.neutral}</div>
            </div>

            <div class="treatment-detail-rating-tile treatment-detail-rating-negative">
                <div class="treatment-detail-rating-value">${stats.negativeRatio}%</div>
                <div class="treatment-detail-rating-label">Negativ</div>
                <div class="treatment-detail-rating-count">${stats.contra}</div>
            </div>
        </div>
    `;
}

function buildOwnRatingHtml() {
    return `
        <div class="treatment-detail-own-rating">
            <h4 class="treatment-detail-own-rating-heading">Diese Therapie bewerten</h4>

            <div class="treatment-detail-vote-buttons">
                <button
                    type="button"
                    class="treatment-detail-vote-button treatment-detail-vote-main-button treatment-detail-vote-main-positive"
                    data-vote-type="hilft"
                >
                    Positiv
                </button>

                <button
                    type="button"
                    class="treatment-detail-vote-button treatment-detail-vote-main-button treatment-detail-vote-main-neutral"
                    data-vote-type="gleich"
                >
                    Neutral
                </button>

                <button
                    type="button"
                    class="treatment-detail-vote-button treatment-detail-vote-main-button treatment-detail-vote-main-negative"
                    data-vote-type="verschlechterung"
                >
                    Negativ
                </button>
            </div>
        </div>
    `;
}

function getTreatmentVoteStats(treatment) {
    const pro = Number(treatment.pro || 0);
    const neutral = Number(treatment.neutral || 0);
    const contra = Number(treatment.contra || 0);
    const totalVotes = Number(treatment.total_votes || (pro + neutral + contra));

    return {
        pro,
        neutral,
        contra,
        totalVotes,
        positiveRatio: totalVotes > 0 ? Math.round((pro / totalVotes) * 100) : 0,
        neutralRatio: totalVotes > 0 ? Math.round((neutral / totalVotes) * 100) : 0,
        negativeRatio: totalVotes > 0 ? Math.round((contra / totalVotes) * 100) : 0
    };
}

function renderTreatmentProviderCard(treatment) {
    const element = document.getElementById("treatment-detail-provider-card");

    if (!element) {
        return;
    }

    const providerCount = Number(treatment.provider_count || 0);

    if (providerCount === 0) {
        element.innerHTML = `
            <span class="treatment-detail-provider-bubble treatment-detail-provider-bubble-empty">0</span>
            <span class="treatment-detail-muted">Noch kein Anbieter hinterlegt.</span>
        `;
        return;
    }

    const label = providerCount === 1
        ? "1 Anbieter ist aktuell mit dieser Therapie verknüpft."
        : `${providerCount} Anbieter sind aktuell mit dieser Therapie verknüpft.`;

    element.innerHTML = `
        <span class="treatment-detail-provider-bubble">${providerCount}</span>
        <span>${escapeHtml(label)}</span>
    `;
}

function renderTreatmentProviders(providers) {
    const element = document.getElementById("treatment-detail-providers");

    if (!element) {
        return;
    }

    if (!Array.isArray(providers) || providers.length === 0) {
        element.innerHTML = `
            <div class="treatment-detail-empty-box">
                Für diese Therapie sind aktuell keine Anbieter hinterlegt.
            </div>
        `;
        return;
    }

    const sortedProviders = sortProvidersForDisplay(providers);
    const rankedProviders = sortedProviders.map(function (provider, index) {
        return {
            ...provider,
            display_rank: index + 1
        };
    });

    const providersOnMap = rankedProviders.filter(provider => hasValidCoordinates(provider));
    const providersWithoutMap = rankedProviders.filter(provider => !hasValidCoordinates(provider));

    let providersHtml = "";

    if (currentProviderViewMode === "list") {
        providersHtml = `
            <section class="treatment-detail-provider-group">
                <div class="treatment-detail-provider-group-header">
                    <h3>Alle Anbieter</h3>
                    <span>${rankedProviders.length}</span>
                </div>

                ${buildProviderListHtml(rankedProviders)}
            </section>
        `;
    } else {
        providersHtml = `
            ${buildProviderGroupHtml("Auf der Karte angezeigt", providersOnMap, "Diese Anbieter haben nutzbare Koordinaten und werden auf der Karte angezeigt.")}
            ${buildProviderGroupHtml("Nicht auf der Karte angezeigt", providersWithoutMap, "Diese Anbieter bleiben in der Liste sichtbar, haben aber aktuell keine nutzbaren Koordinaten.")}
        `;
    }

    element.innerHTML = `
        ${buildProviderViewSwitchHtml()}

        <div class="treatment-detail-provider-list-inner treatment-detail-provider-view-${currentProviderViewMode}">
            ${providersHtml}
        </div>
    `;
}

function buildProviderViewSwitchHtml() {
    const locationValue = currentProviderLocation ? currentProviderLocation.label : "";
    const locationStatus = currentProviderLocation
        ? `Aktiver Standort: ${currentProviderLocation.label}`
        : "Für die Entfernungssortierung bitte einen Standort eingeben.";

    return `
        <div class="treatment-detail-provider-controls" aria-label="Anbieteransicht und Sortierung">
            <div class="treatment-detail-provider-controls-grid">
                <section class="treatment-detail-provider-control-card">
                    <h3>Anbieteransicht</h3>

                    <div class="treatment-detail-provider-view-switch">
                        <button
                            type="button"
                            class="treatment-detail-provider-view-button ${currentProviderViewMode === "cards" ? "is-active" : ""}"
                            data-provider-view="cards"
                        >
                            Kacheln
                        </button>

                        <button
                            type="button"
                            class="treatment-detail-provider-view-button ${currentProviderViewMode === "list" ? "is-active" : ""}"
                            data-provider-view="list"
                        >
                            Liste
                        </button>
                    </div>
                </section>

                <section class="treatment-detail-provider-control-card">
                    <h3>Sortierung</h3>

                    <div class="treatment-detail-provider-sort-switch">
                        <button
                            type="button"
                            class="treatment-detail-provider-sort-button ${currentProviderSortMode === "name" ? "is-active" : ""}"
                            data-provider-sort="name"
                        >
                            Alphabetisch
                        </button>

                        <button
                            type="button"
                            class="treatment-detail-provider-sort-button ${currentProviderSortMode === "rating" ? "is-active" : ""}"
                            data-provider-sort="rating"
                        >
                            Bewertung positiv
                        </button>

                        <button
                            type="button"
                            class="treatment-detail-provider-sort-button ${currentProviderSortMode === "distance" ? "is-active" : ""}"
                            data-provider-sort="distance"
                        >
                            Entfernung
                        </button>
                    </div>
                </section>

                <section class="treatment-detail-provider-control-card treatment-detail-provider-control-card-location">
                    <h3>Standort / Entfernung</h3>

                    <div class="treatment-detail-provider-location-controls">
                        <input
                            id="treatment-detail-provider-location-input"
                            class="treatment-detail-provider-location-input"
                            type="text"
                            value="${escapeAttribute(locationValue)}"
                            placeholder="PLZ oder Ort, z. B. Köln"
                            autocomplete="off"
                        >

                        <button
                            type="button"
                            class="treatment-detail-provider-location-set-button"
                        >
                            Standort setzen
                        </button>

                        <button
                            type="button"
                            class="treatment-detail-provider-location-reset-button"
                            ${currentProviderLocation ? "" : "disabled"}
                        >
                            Zurücksetzen
                        </button>
                    </div>

                    <div class="treatment-detail-provider-location-status">${escapeHtml(locationStatus)}</div>
                </section>
            </div>
        </div>
    `;
}

function buildProviderGroupHtml(title, providers, note) {
    const count = Array.isArray(providers) ? providers.length : 0;

    let contentHtml = "";

    if (count === 0) {
        contentHtml = `
            <div class="treatment-detail-empty-box">
                Keine Einträge in diesem Bereich.
            </div>
        `;
    } else if (currentProviderViewMode === "list") {
        contentHtml = buildProviderListHtml(providers);
    } else {
        contentHtml = `
            <div class="treatment-detail-provider-card-grid">
                ${providers.map(provider => buildProviderCardHtml(provider)).join("")}
            </div>
        `;
    }

    return `
        <section class="treatment-detail-provider-group">
            <div class="treatment-detail-provider-group-header">
                <h3>${escapeHtml(title)}</h3>
                <span>${count}</span>
            </div>

            ${note ? `<p class="treatment-detail-provider-group-note">${escapeHtml(note)}</p>` : ""}

            ${contentHtml}
        </section>
    `;
}

function buildProviderListHtml(providers) {
    return `
        <div class="treatment-detail-provider-table-wrap">
            <table class="treatment-detail-provider-table">
                <thead>
                    <tr>
                        <th>Rang</th>
                        <th>Anbieter</th>
                        <th>Standort</th>
                        <th>Karte</th>
                        <th>Entfernung</th>
                        <th>Bewertung</th>
                        <th>Versorgung</th>
                        <th>Kontakt</th>
                        <th></th>
                    </tr>
                </thead>

                <tbody>
                    ${providers.map(provider => buildProviderTableRowHtml(provider)).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function buildProviderTableRowHtml(provider) {
    const name = provider.dr_display_name || "Unbekannter Anbieter";
    const location = buildProviderLocation(provider) || "Kein Standort hinterlegt";
    const careBadges = buildProviderCareBadges(provider);
    const contactLinks = buildProviderContactLinks(provider);
    const ratingHtml = buildProviderRatingCompactHtml(provider);
    const mapStatusHtml = buildProviderMapStatusHtml(provider);
    const distanceHtml = buildProviderDistanceHtml(provider);
    const rankHtml = buildProviderRankBadgeHtml(provider);
    const detailUrl = provider.dr_id
        ? `arzt_detail.html?id=${encodeURIComponent(provider.dr_id)}`
        : "";

    return `
        <tr>
            <td class="treatment-detail-provider-rank-cell">
                ${rankHtml}
            </td>

            <td>
                <strong>${escapeHtml(name)}</strong>
            </td>

            <td>${escapeHtml(location)}</td>

            <td>${mapStatusHtml}</td>

            <td>${distanceHtml}</td>

            <td>${ratingHtml}</td>

            <td>
                <div class="treatment-detail-provider-meta">
                    ${careBadges}
                </div>
            </td>

            <td>
                <div class="treatment-detail-provider-contact">
                    ${contactLinks}
                </div>
            </td>

            <td>
                ${detailUrl ? `
                    <a class="treatment-detail-provider-detail-link" href="${detailUrl}">
                        Steckbrief
                    </a>
                ` : ""}
            </td>
        </tr>
    `;
}

function buildProviderRankBadgeHtml(provider) {
    const rank = Number(provider.display_rank || 0);

    if (!rank) {
        return `<span class="treatment-detail-provider-rank-badge">–</span>`;
    }

    return `<span class="treatment-detail-provider-rank-badge">#${rank}</span>`;
}

function buildProviderMapStatusHtml(provider) {
    if (hasValidCoordinates(provider)) {
        return `
            <span class="treatment-detail-map-status treatment-detail-map-status-yes">
                Ja
            </span>
        `;
    }

    return `
        <span class="treatment-detail-map-status treatment-detail-map-status-no">
            Nein
        </span>
    `;
}

function buildProviderDistanceHtml(provider) {
    if (!currentProviderLocation) {
        return `<span class="treatment-detail-muted">–</span>`;
    }

    if (!hasValidCoordinates(provider)) {
        return `<span class="treatment-detail-muted">nicht verfügbar</span>`;
    }

    const distanceKm = calculateDistanceKm(
        currentProviderLocation.lat,
        currentProviderLocation.lng,
        Number(provider.loc_lat),
        Number(provider.loc_lng)
    );

    return `<span class="treatment-detail-provider-distance">${formatDistanceKm(distanceKm)}</span>`;
}

function sortProvidersForDisplay(providers) {
    const providersCopy = Array.isArray(providers) ? [...providers] : [];

    providersCopy.sort(function (providerA, providerB) {
        if (currentProviderSortMode === "rating") {
            const ratingDiff = Number(providerB.positive_ratio || 0) - Number(providerA.positive_ratio || 0);

            if (ratingDiff !== 0) {
                return ratingDiff;
            }

            const voteDiff = Number(providerB.total_votes || 0) - Number(providerA.total_votes || 0);

            if (voteDiff !== 0) {
                return voteDiff;
            }

            return compareProviderNames(providerA, providerB);
        }

        if (currentProviderSortMode === "distance" && currentProviderLocation) {
            const distanceA = getProviderDistanceForSorting(providerA);
            const distanceB = getProviderDistanceForSorting(providerB);

            if (distanceA !== distanceB) {
                return distanceA - distanceB;
            }

            return compareProviderNames(providerA, providerB);
        }

        return compareProviderNames(providerA, providerB);
    });

    return providersCopy;
}

function compareProviderNames(providerA, providerB) {
    const nameA = String(providerA.dr_display_name || "").trim();
    const nameB = String(providerB.dr_display_name || "").trim();

    return nameA.localeCompare(nameB, "de", {
        sensitivity: "base",
        numeric: true
    });
}

function getProviderDistanceForSorting(provider) {
    if (!currentProviderLocation || !hasValidCoordinates(provider)) {
        return Number.POSITIVE_INFINITY;
    }

    return calculateDistanceKm(
        currentProviderLocation.lat,
        currentProviderLocation.lng,
        Number(provider.loc_lat),
        Number(provider.loc_lng)
    );
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const earthRadiusKm = 6371;
    const dLat = degreesToRadians(lat2 - lat1);
    const dLng = degreesToRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(degreesToRadians(lat1))
        * Math.cos(degreesToRadians(lat2))
        * Math.sin(dLng / 2)
        * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
}

function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function formatDistanceKm(distanceKm) {
    if (!Number.isFinite(distanceKm)) {
        return "–";
    }

    if (distanceKm < 10) {
        return `${distanceKm.toFixed(1).replace(".", ",")} km`;
    }

    return `${Math.round(distanceKm)} km`;
}

async function handleProviderLocationSubmit() {
    const input = document.getElementById("treatment-detail-provider-location-input");

    if (!input) {
        return;
    }

    const query = input.value.trim();

    if (!query) {
        alert("Bitte gib eine PLZ oder einen Ort ein.");
        input.focus();
        return;
    }

    setProviderLocationControlsDisabled(true);

    try {
        const geocodedLocation = await geocodeProviderLocation(query);

        currentProviderLocation = geocodedLocation;
        currentProviderSortMode = "distance";

        if (currentTreatmentDetail) {
			renderTreatmentProviders(currentTreatmentDetail.providers);
			renderTreatmentProviderMap(currentTreatmentDetail.providers);
		}


    } catch (error) {
        console.error("Fehler beim Geocoding des Anbieter-Standorts:", error);
        alert(error.message || "Der Standort konnte nicht gefunden werden.");
    } finally {
        setProviderLocationControlsDisabled(false);
    }
}

async function geocodeProviderLocation(query) {
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

function setProviderLocationControlsDisabled(isDisabled) {
    document.querySelectorAll(
        ".treatment-detail-provider-location-set-button, .treatment-detail-provider-location-reset-button, .treatment-detail-provider-location-input"
    ).forEach(function (element) {
        element.disabled = isDisabled;
        element.classList.toggle("is-saving", isDisabled);
    });
}

function focusProviderLocationInput() {
    const input = document.getElementById("treatment-detail-provider-location-input");

    if (input) {
        input.focus();
    }
}

function buildProviderCardHtml(provider) {
    const name = provider.dr_display_name || "Unbekannter Anbieter";
    const location = buildProviderLocation(provider);
    const careBadges = buildProviderCareBadges(provider);
    const contactLinks = buildProviderContactLinks(provider);
    const rankHtml = buildProviderRankBadgeHtml(provider);
    const detailUrl = provider.dr_id
        ? `arzt_detail.html?id=${encodeURIComponent(provider.dr_id)}`
        : "";

    return `
        <article class="treatment-detail-provider-card">
            <div class="treatment-detail-provider-card-topline">
                ${rankHtml}

                ${detailUrl ? `
                    <a class="treatment-detail-provider-detail-link" href="${detailUrl}">
                        Steckbrief öffnen
                    </a>
                ` : ""}
            </div>

            <div class="treatment-detail-provider-card-header">
                <div>
                    <h3>${escapeHtml(name)}</h3>
                    <p>${escapeHtml(location || "Kein Standort hinterlegt")}</p>
                </div>
            </div>

            ${buildProviderRatingCardHtml(provider)}
            ${currentProviderLocation ? `<div class="treatment-detail-provider-card-distance">Entfernung: ${buildProviderDistanceHtml(provider)}</div>` : ""}

            <div class="treatment-detail-provider-card-body">
                ${careBadges ? `
                    <div class="treatment-detail-provider-meta">
                        ${careBadges}
                    </div>
                ` : ""}

                ${contactLinks ? `
                    <div class="treatment-detail-provider-contact">
                        ${contactLinks}
                    </div>
                ` : ""}
            </div>
        </article>
    `;
}

function buildProviderRatingCardHtml(provider) {
    const stats = getProviderVoteStats(provider);

    if (stats.totalVotes === 0) {
        return `
            <div class="treatment-detail-provider-rating-empty">
                Noch keine Arztbewertungen.
            </div>
        `;
    }

    return `
        <div class="treatment-detail-provider-rating">
            <div class="treatment-detail-provider-rating-item treatment-detail-provider-rating-positive">
                <strong>${stats.positiveRatio}%</strong>
                <span>positiv</span>
            </div>

            <div class="treatment-detail-provider-rating-item treatment-detail-provider-rating-neutral">
                <strong>${stats.neutralRatio}%</strong>
                <span>neutral</span>
            </div>

            <div class="treatment-detail-provider-rating-item treatment-detail-provider-rating-negative">
                <strong>${stats.negativeRatio}%</strong>
                <span>negativ</span>
            </div>

            <div class="treatment-detail-provider-rating-total">
                n = ${stats.totalVotes}
            </div>
        </div>
    `;
}

function buildProviderRatingCompactHtml(provider) {
    const stats = getProviderVoteStats(provider);

    if (stats.totalVotes === 0) {
        return `<span class="treatment-detail-muted">Noch keine Bewertungen</span>`;
    }

    return `
        <div class="treatment-detail-provider-rating-compact">
            <span class="is-positive">${stats.positiveRatio}%</span>
            <span class="is-neutral">${stats.neutralRatio}%</span>
            <span class="is-negative">${stats.negativeRatio}%</span>
            <small>n=${stats.totalVotes}</small>
        </div>
    `;
}

function getProviderVoteStats(provider) {
    const pro = Number(provider.pro || 0);
    const neutral = Number(provider.neutral || 0);
    const contra = Number(provider.contra || 0);
    const totalVotes = Number(provider.total_votes || (pro + neutral + contra));

    return {
        pro,
        neutral,
        contra,
        totalVotes,
        positiveRatio: totalVotes > 0 ? Math.round((pro / totalVotes) * 100) : 0,
        neutralRatio: totalVotes > 0 ? Math.round((neutral / totalVotes) * 100) : 0,
        negativeRatio: totalVotes > 0 ? Math.round((contra / totalVotes) * 100) : 0
    };
}

function buildProviderLocation(provider) {
    const parts = [];

    if (provider.loc_label && provider.loc_label !== "Praxis") {
        parts.push(provider.loc_label);
    }

    const cityParts = [];

    if (provider.loc_plz) {
        cityParts.push(provider.loc_plz);
    }

    if (provider.loc_city) {
        cityParts.push(provider.loc_city);
    }

    if (cityParts.length > 0) {
        parts.push(cityParts.join(" "));
    }

    return parts.join(" · ");
}

function buildProviderCareBadges(provider) {
    const badges = [];

    if (provider.dr_accepts_gkv === "yes") {
        badges.push(`<span class="treatment-detail-care-badge treatment-detail-care-badge-positive">GKV</span>`);
    }

    if (provider.dr_accepts_pkv === "yes") {
        badges.push(`<span class="treatment-detail-care-badge treatment-detail-care-badge-positive">PKV / Selbstzahler</span>`);
    }

    return badges.join("");
}

function buildProviderContactLinks(provider) {
    const links = [];

    const website = provider.loc_website || provider.dr_website;
    const email = provider.loc_email || provider.dr_email;
    const phone = provider.loc_phone;

    if (website) {
        const safeWebsite = normalizeExternalUrl(website);

        links.push(`
            <a href="${escapeAttribute(safeWebsite)}" target="_blank" rel="noopener noreferrer">
                Website
            </a>
        `);
    }

    if (email) {
        links.push(`
            <a href="mailto:${escapeAttribute(email)}">
                E-Mail
            </a>
        `);
    }

    if (phone) {
        links.push(`
            <a href="tel:${escapeAttribute(phone)}">
                Telefon
            </a>
        `);
    }

    return links.join("");
}

function renderTreatmentProviderMap(providers) {
    const panelElement = document.getElementById("treatment-detail-provider-map-panel");
    const mapElement = document.getElementById("treatment-detail-provider-map");
    const countElement = document.getElementById("treatment-detail-provider-map-count");

    if (!panelElement || !mapElement || typeof L === "undefined") {
        return;
    }

    const providersWithCoords = Array.isArray(providers)
        ? providers.filter(provider => hasValidCoordinates(provider))
        : [];

    const hasProviderMarkers = providersWithCoords.length > 0;
    const hasUserLocation = currentProviderLocation
        && Number.isFinite(Number(currentProviderLocation.lat))
        && Number.isFinite(Number(currentProviderLocation.lng));

    if (!hasProviderMarkers && !hasUserLocation) {
        panelElement.classList.add("is-hidden");
        return;
    }

    panelElement.classList.remove("is-hidden");

    if (countElement) {
        const providerCountLabel = providersWithCoords.length === 1
            ? "1 Anbieterstandort"
            : `${providersWithCoords.length} Anbieterstandorte`;

        countElement.textContent = hasUserLocation
            ? `${providerCountLabel} + dein Standort`
            : `${providerCountLabel} mit Koordinaten`;
    }

    if (!treatmentProviderMap) {
        treatmentProviderMap = L.map(mapElement, {
            scrollWheelZoom: false
        });

        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
            attribution: "Tiles © Esri"
        }).addTo(treatmentProviderMap);
    }

    if (treatmentProviderMarkerLayer) {
        treatmentProviderMarkerLayer.clearLayers();
    } else {
        treatmentProviderMarkerLayer = L.featureGroup().addTo(treatmentProviderMap);
    }

    providersWithCoords.forEach(function (provider) {
        const marker = L.marker([Number(provider.loc_lat), Number(provider.loc_lng)]);
        marker.bindPopup(buildProviderMapPopupHtml(provider));
        marker.addTo(treatmentProviderMarkerLayer);
    });

    if (hasUserLocation) {
		const userMarker = L.marker(
			[Number(currentProviderLocation.lat), Number(currentProviderLocation.lng)],
			{
				icon: buildUserLocationMapIcon(),
				zIndexOffset: 1000
			}
		);

		userMarker
			.bindPopup(`
				<div class="treatment-detail-map-popup">
					<strong>Standort</strong><br>
					<span>${escapeHtml(currentProviderLocation.label || "Gesetzter Standort")}</span>
				</div>
			`)
			.addTo(treatmentProviderMarkerLayer)
			.openPopup();
	}

    setTimeout(function () {
        treatmentProviderMap.invalidateSize();

        const bounds = treatmentProviderMarkerLayer.getBounds();

        if (bounds.isValid()) {
            treatmentProviderMap.fitBounds(bounds, {
                padding: [28, 28],
                maxZoom: 10
            });
        }
    }, 0);
}

function buildUserLocationMapIcon() {
    return L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}



function hasValidCoordinates(provider) {
    if (!provider || provider.has_coordinates !== true) {
        return false;
    }

    if (
        provider.loc_lat === null
        || provider.loc_lng === null
        || provider.loc_lat === undefined
        || provider.loc_lng === undefined
        || String(provider.loc_lat).trim() === ""
        || String(provider.loc_lng).trim() === ""
    ) {
        return false;
    }

    const lat = Number(provider.loc_lat);
    const lng = Number(provider.loc_lng);
    const country = String(provider.loc_country || "").trim().toUpperCase();

    if (
        !Number.isFinite(lat)
        || !Number.isFinite(lng)
        || lat < -90
        || lat > 90
        || lng < -180
        || lng > 180
    ) {
        return false;
    }

    if (country === "DE") {
        return lat >= 47 && lat <= 56 && lng >= 5 && lng <= 16;
    }

    if (country === "AT") {
        return lat >= 46 && lat <= 50 && lng >= 9 && lng <= 18;
    }

    if (country === "CH") {
        return lat >= 45 && lat <= 48.5 && lng >= 5 && lng <= 11;
    }

    return true;
}

function buildProviderMapPopupHtml(provider) {
    const name = provider.dr_display_name || "Unbekannter Anbieter";
    const location = buildProviderLocation(provider);
    const detailUrl = provider.dr_id
        ? `arzt_detail.html?id=${encodeURIComponent(provider.dr_id)}`
        : "";

    return `
        <div class="treatment-detail-map-popup">
            <strong>${escapeHtml(name)}</strong>
            ${location ? `<br><span>${escapeHtml(location)}</span>` : ""}
            ${detailUrl ? `<br><a href="${detailUrl}">Steckbrief öffnen</a>` : ""}
        </div>
    `;
}

function renderTreatmentSources(sources) {
    const element = document.getElementById("treatment-detail-sources");

    if (!element) {
        return;
    }

    if (!Array.isArray(sources) || sources.length === 0) {
        element.innerHTML = `
            <div class="treatment-detail-empty-box">
                Für diese Therapie sind aktuell keine Quellen hinterlegt.
            </div>
        `;
        return;
    }

    element.innerHTML = sources
        .map(source => buildSourceCardHtml(source))
        .join("");
}

function buildSourceCardHtml(source) {
    const title = source.display_name || source.title || source.citation_text || "Unbenannte Quelle";
    const citation = source.citation_text || source.source_detail || "";
    const sourceType = translateSourceType(source.source_type);
    const sourceUrl = source.source_url || source.landing_url || "";

    return `
        <article class="treatment-detail-source-card">
            <div class="treatment-detail-source-card-main">
                <h3>${escapeHtml(title)}</h3>

                <div class="treatment-detail-source-meta">
                    ${sourceType ? `<span class="treatment-detail-source-badge">${escapeHtml(sourceType)}</span>` : ""}
                    ${citation ? `<span>${escapeHtml(citation)}</span>` : ""}
                </div>
            </div>

            ${sourceUrl ? `
                <a class="treatment-detail-source-link" href="${escapeAttribute(normalizeExternalUrl(sourceUrl))}" target="_blank" rel="noopener noreferrer">
                    Quelle öffnen
                </a>
            ` : ""}
        </article>
    `;
}

function translateSourceType(sourceType) {
    const type = String(sourceType || "").trim().toLowerCase();

    const labels = {
        study: "Studie",
        guideline: "Leitlinie",
        review: "Review",
        website: "Website",
        protocol: "Protokoll",
        expert: "Expert:innen-PDF",
        association: "Verband / Organisation"
    };

    return labels[type] || sourceType || "";
}

function renderTreatmentAliases(treatment) {
    const sectionElement = document.getElementById("treatment-detail-alias-section");
    const listElement = document.getElementById("treatment-detail-aliases");

    if (!sectionElement || !listElement) {
        return;
    }

    const treatmentName = normalizeForCompare(treatment.behandlung);

    const aliases = treatment.aliases
        .filter(alias => alias && alias.alias)
        .filter(alias => normalizeForCompare(alias.alias) !== treatmentName);

    if (aliases.length === 0) {
        sectionElement.classList.add("is-hidden");
        listElement.innerHTML = "";
        return;
    }

    sectionElement.classList.remove("is-hidden");

    listElement.innerHTML = aliases
        .map(alias => {
            const label = translateAliasType(alias.alias_type);

            return `
                <span class="treatment-detail-alias-chip">
                    ${escapeHtml(alias.alias)}
                    ${label ? `<small>${escapeHtml(label)}</small>` : ""}
                </span>
            `;
        })
        .join("");
}

function translateAliasType(aliasType) {
    const type = String(aliasType || "").trim().toLowerCase();

    const labels = {
        primary_name: "Hauptname",
        alternate_name: "Alternativname",
        trade_name: "Handelsname",
        generic_name: "Wirkstoffname",
        spelling_variant: "Schreibvariante",
        umbrella_term: "Oberbegriff",
        long_name: "Langname",
        combo_alias_for_single_search: "Kombi-Suchbegriff",
        combo_alias_for_single_search_de: "Kombi-Suchbegriff"
    };

    return labels[type] || aliasType || "";
}

function normalizeForCompare(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function normalizeExternalUrl(url) {
    const cleanUrl = String(url || "").trim();

    if (!cleanUrl) {
        return "";
    }

    if (/^https?:\/\//i.test(cleanUrl)) {
        return cleanUrl;
    }

    return `https://${cleanUrl}`;
}

function renderCompactText(elementId, text) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    const cleanText = String(text || "").trim();

    if (!cleanText) {
        element.innerHTML = `<span class="treatment-detail-muted">Noch nicht hinterlegt.</span>`;
        return;
    }

    element.innerHTML = escapeHtml(cleanText);
}

function showTreatmentDetailContent() {
    const statusElement = document.getElementById("treatment-detail-status");
    const contentElement = document.getElementById("treatment-detail-content");

    if (statusElement) {
        statusElement.classList.add("is-hidden");
    }

    if (contentElement) {
        contentElement.classList.remove("is-hidden");
    }
}

function showTreatmentDetailError(message) {
    const statusElement = document.getElementById("treatment-detail-status");
    const contentElement = document.getElementById("treatment-detail-content");

    if (contentElement) {
        contentElement.classList.add("is-hidden");
    }

    if (statusElement) {
        statusElement.classList.remove("is-hidden");
        statusElement.classList.add("treatment-detail-status-error");
        statusElement.textContent = message || "Der Therapie-Steckbrief konnte nicht geladen werden.";
    }
}

function setText(elementId, text) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = text;
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

function escapeAttribute(value) {
    return escapeHtml(value);
}
