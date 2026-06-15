let map;
let radiusCircle;
let doctorMarkerGroup;
let userLocationMarker;
let userLocationIcon;
let currentDoctors = [];

let currentDoctorSortKey = "name";
let currentDoctorSortDirection = "asc";

let currentLocation = null;

const defaultMapCenter = {
    lat: 51.1657,
    lng: 10.4515,
    label: "Deutschland"
};

document.addEventListener("DOMContentLoaded", function () {
    const mapElement = document.getElementById("doctor-map");

    const locationInput = document.getElementById("doctor-location-input");

    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const radiusInput = document.getElementById("doctor-radius-input");
    const radiusButton = document.getElementById("doctor-radius-button");
    const radiusFilterButton = document.getElementById("doctor-radius-filter-button");
    const radiusFilterMenu = document.getElementById("doctor-radius-filter-menu");

    const mapSection = document.getElementById("doctor-map-section");
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

    updateRadiusInputState();
    setupDoctorSortMenu();

    radiusFilterButton.addEventListener("click", function (event) {
        event.stopPropagation();

        const sortMenu = document.getElementById("doctor-sort-menu");
        if (sortMenu) {
            sortMenu.classList.remove("show");
        }

        radiusFilterMenu.classList.toggle("show");
    });

    document.addEventListener("click", function (event) {
        if (
            !radiusFilterButton.contains(event.target) &&
            !radiusFilterMenu.contains(event.target)
        ) {
            radiusFilterMenu.classList.remove("show");
        }
    });

    radiusEnabledInput.addEventListener("change", function () {
        updateRadiusInputState();
        applySearchFromControls();
    });

    radiusButton.addEventListener("click", function () {
        applySearchFromControls();
        radiusFilterMenu.classList.remove("show");
    });

    locationInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            applySearchFromControls();
            radiusFilterMenu.classList.remove("show");
        }
    });

    radiusInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            applySearchFromControls();
            radiusFilterMenu.classList.remove("show");
        }
    });

    if (mapSection && mapToggleButton) {
        mapToggleButton.addEventListener("click", function () {
            const isHidden = mapSection.classList.toggle("is-hidden");

            mapToggleButton.textContent = isHidden
                ? "Karte anzeigen"
                : "Karte ausblenden";

            if (!isHidden && map) {
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

function setupDoctorSortMenu() {
    const sortButton = document.getElementById("doctor-sort-button");
    const sortMenu = document.getElementById("doctor-sort-menu");
    const radiusFilterMenu = document.getElementById("doctor-radius-filter-menu");
    const locationInput = document.getElementById("doctor-location-input");

    if (!sortButton || !sortMenu) {
        return;
    }

    sortButton.addEventListener("click", function (event) {
        event.stopPropagation();

        const radiusFilterMenuElement = document.getElementById("doctor-radius-filter-menu");
        if (radiusFilterMenuElement) {
            radiusFilterMenuElement.classList.remove("show");
        }

        sortMenu.classList.toggle("show");
    });

    sortMenu.querySelectorAll("button[data-sort-key]").forEach(function (button) {
        button.addEventListener("click", function (event) {
            event.stopPropagation();

            const clickedKey = button.getAttribute("data-sort-key");

            if (clickedKey === "distance" && !currentLocation) {
                sortMenu.classList.remove("show");

                if (radiusFilterMenu) {
                    radiusFilterMenu.classList.add("show");
                }

                if (locationInput) {
                    setTimeout(function () {
                        locationInput.focus();
                    }, 50);
                }

                const statusElement = document.getElementById("doctor-map-status");

                if (statusElement) {
                    statusElement.textContent =
                        "Für die Sortierung nach Entfernung bitte zuerst einen Standort eingeben.";
                }

                return;
            }

            if (clickedKey === currentDoctorSortKey) {
                currentDoctorSortDirection =
                    currentDoctorSortDirection === "asc" ? "desc" : "asc";
            } else {
                currentDoctorSortKey = clickedKey;

                if (
                    clickedKey === "name" ||
                    clickedKey === "negative_ratio" ||
                    clickedKey === "distance"
                ) {
                    currentDoctorSortDirection = "asc";
                } else {
                    currentDoctorSortDirection = "desc";
                }
            }

            const label = button.textContent.trim();
            const directionLabel = getDoctorSortDirectionLabel(
                currentDoctorSortKey,
                currentDoctorSortDirection
            );

            sortButton.textContent = `Sortieren: ${label} ${directionLabel} ▾`;
            sortMenu.classList.remove("show");

            currentDoctors = sortDoctors(
                currentDoctors,
                currentDoctorSortKey,
                currentDoctorSortDirection
            );

            renderDoctorCards(currentDoctors);
            renderDoctorResultsTable(currentDoctors);
        });
    });

    document.addEventListener("click", function (event) {
        const clickedInsideSort =
            sortButton.contains(event.target) ||
            sortMenu.contains(event.target);

        if (!clickedInsideSort) {
            sortMenu.classList.remove("show");
        }
    });
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
            result = String(a.dr_display_name || "").localeCompare(
                String(b.dr_display_name || ""),
                "de",
                { sensitivity: "base" }
            );
        }

        return direction === "desc" ? -result : result;
    });

    return doctorsCopy;
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
}

function updateRadiusInputState() {
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    if (!radiusEnabledInput || !radiusInput) {
        return;
    }

    const isEnabled = radiusEnabledInput.checked;

    radiusInput.disabled = !isEnabled;
    radiusInput.classList.toggle("is-disabled", !isEnabled);
}

function getSearchSettingsFromControls() {
    const locationInput = document.getElementById("doctor-location-input");
    const radiusEnabledInput = document.getElementById("doctor-radius-enabled-input");
    const radiusInput = document.getElementById("doctor-radius-input");

    const locationQuery = locationInput ? locationInput.value.trim() : "";
    const radiusEnabled = radiusEnabledInput ? radiusEnabledInput.checked : false;
    const radiusKm = Number(radiusInput.value);

    if (radiusEnabled && locationQuery === "") {
        alert("Bitte zuerst einen Standort eingeben, wenn die Radiusbegrenzung aktiv ist.");
        return null;
    }

    if (radiusEnabled && (Number.isNaN(radiusKm) || radiusKm < 1 || radiusKm > 500)) {
        alert("Bitte einen Radius zwischen 1 und 500 km eingeben.");
        return null;
    }

    return {
        locationQuery,
        radiusEnabled,
        radiusKm
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
        statusElement.textContent = "Suche alle Ärzte mit Koordinaten. Kein Standort gesetzt.";
    }
}

async function loadDoctorsFromSearchApi(settings) {
    const statusElement = document.getElementById("doctor-map-status");
    const countElement = document.getElementById("doctor-map-count");

    const centerForApi = currentLocation || defaultMapCenter;

    const radiusParam = settings.radiusEnabled
        ? encodeURIComponent(settings.radiusKm)
        : "all";

    const url =
        `api/doctors_search.php?lat=${encodeURIComponent(centerForApi.lat)}` +
        `&lng=${encodeURIComponent(centerForApi.lng)}` +
        `&radiusKm=${radiusParam}`;

    const [searchResponse, votesByDoctorId] = await Promise.all([
        fetch(url),
        loadDoctorVotesById()
    ]);

    if (!searchResponse.ok) {
        throw new Error(`HTTP-Fehler: ${searchResponse.status}`);
    }

    const data = await searchResponse.json();

    if (!data.ok) {
        throw new Error(data.message || "API-Antwort war nicht erfolgreich.");
    }

    let enrichedDoctors = addVotesToDoctors(data.items, votesByDoctorId);

	if (!currentLocation) {
		enrichedDoctors = enrichedDoctors.map(function (doctor) {
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

        const sortButton = document.getElementById("doctor-sort-button");
        if (sortButton) {
            sortButton.textContent = "Sortieren: Name A–Z ▾";
        }
    }

    currentDoctors = sortDoctors(
        enrichedDoctors,
        currentDoctorSortKey,
        currentDoctorSortDirection
    );

    renderDoctorMarkers(currentDoctors);
    renderDoctorCards(currentDoctors);
    renderDoctorResultsTable(currentDoctors);

    if (countElement) {
        countElement.textContent = `${currentDoctors.length} Ärzte`;
    }

    if (statusElement) {
        if (settings.radiusEnabled) {
            statusElement.textContent =
                `${currentDoctors.length} Ärzte im Umkreis von ${settings.radiusKm} km gefunden. Entfernung: Luftlinie.`;
        } else if (currentLocation) {
            statusElement.textContent =
                `${currentDoctors.length} Ärzte mit Koordinaten gefunden. Entfernung: Luftlinie zum Standort.`;
        } else {
            statusElement.textContent =
                `${currentDoctors.length} Ärzte mit Koordinaten gefunden. Kein Standort gesetzt.`;
        }
    }
}

async function loadDoctorVotesById() {
    try {
        const response = await fetch("api/get_doctor_votes.php");

        if (!response.ok) {
            throw new Error(`HTTP-Fehler bei get_doctor_votes.php: ${response.status}`);
        }

        const voteDoctors = await response.json();
        const votesByDoctorId = new Map();

        (voteDoctors || []).forEach(function (doctor) {
            const drId = Number(doctor.dr_id);

            if (!Number.isFinite(drId)) {
                return;
            }

            votesByDoctorId.set(drId, {
                pro: Number(doctor.pro ?? 0),
                neutral: Number(doctor.neutral ?? 0),
                contra: Number(doctor.contra ?? 0)
            });
        });

        return votesByDoctorId;

    } catch (error) {
        console.error("Bewertungen konnten nicht geladen werden:", error);
        return new Map();
    }
}

function addVotesToDoctors(doctors, votesByDoctorId) {
    return (doctors || []).map(function (doctor) {
        const drId = Number(doctor.dr_id);
        const votes = votesByDoctorId.get(drId) || {
            pro: 0,
            neutral: 0,
            contra: 0
        };

        return {
            ...doctor,
            pro: votes.pro,
            neutral: votes.neutral,
            contra: votes.contra
        };
    });
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

    button.disabled = true;
    button.classList.add("is-saving");

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

        currentDoctors = currentDoctors.map(function (doctor) {
            if (Number(doctor.dr_id) !== drId) {
                return doctor;
            }

            return {
                ...doctor,
                pro: Number(doctor.pro ?? 0) + (voteType === "pro" ? 1 : 0),
                neutral: Number(doctor.neutral ?? 0) + (voteType === "neutral" ? 1 : 0),
                contra: Number(doctor.contra ?? 0) + (voteType === "contra" ? 1 : 0)
            };
        });

        currentDoctors = sortDoctors(
            currentDoctors,
            currentDoctorSortKey,
            currentDoctorSortDirection
        );

        renderDoctorCards(currentDoctors);
        renderDoctorResultsTable(currentDoctors);

    } catch (error) {
        console.error("Fehler beim Speichern der Ärztebewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden. Details stehen in der Konsole.");

        button.disabled = false;
        button.classList.remove("is-saving");
    }
}

function renderDoctorMarkers(doctors) {
    if (doctorMarkerGroup) {
        map.removeLayer(doctorMarkerGroup);
        doctorMarkerGroup = null;
    }

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
            <article class="doctor-card doctor-card-v2">
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
                    <span class="doctor-card-muted">Mehr Details später</span>
                    ${websiteHtml}
                </div>
            </article>
        `;
    }).join("");
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

    if (!tableBody) {
        return;
    }

    if (!doctors || doctors.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">Keine Ärztinnen oder Ärzte gefunden.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = doctors.map(function (doctor, index) {
        const name = escapeHtml(doctor.dr_display_name || "Unbekannter Arzt");
        const plz = escapeHtml(doctor.loc_plz || "");
        const city = escapeHtml(doctor.loc_city || "");
        const distance = getDoctorDistanceText(doctor, true);

        const website = doctor.loc_website || doctor.dr_website || "";
        const websiteHtml = website
            ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Website</a>`
            : "-";

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${name}</td>
                <td>${plz} ${city}</td>
                <td>${distance}</td>
                <td>${websiteHtml}</td>
            </tr>
        `;
    }).join("");
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
            ${websiteHtml}
        </div>
    `;
}

function getDoctorDistanceText(doctor, shortText = false) {
    if (!currentLocation) {
        return "-";
    }

    if (doctor.distance_km === null || doctor.distance_km === undefined) {
        return "-";
    }

    return shortText
        ? `${escapeHtml(doctor.distance_km)} km`
        : `${escapeHtml(doctor.distance_km)} km Luftlinie`;
}

function buildDoctorInitials(name) {
    const parts = String(name)
        .replace("Dr.", "")
        .replace("Dr", "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return "DR";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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