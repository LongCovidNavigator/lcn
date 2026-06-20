let currentDoctorDetail = null;
let currentDoctorTerms = {
    specialty: [],
    badge: [],
    accessibility: [],
    other: []
};

let currentDoctorTreatmentsGrouped = {};
let treatmentSpectrumExpanded = false;
let selectedTreatmentCategorySlugs = new Set();
let treatmentCategorySelectionMode = "all";

let treatmentSearchQuery = "";
let treatmentCategorySearchQuery = "";
let treatmentSortMode = "name_asc";
let treatmentOnlyRated = false;
let treatmentViewMode = "cards";
let treatmentPositiveMin = 0;
let treatmentNegativeMax = 100;
let treatmentCategoryDropdownOpen = false;

let currentTreatmentCategoryOptions = [];


document.addEventListener("DOMContentLoaded", function () {
    loadDoctorDetail();
    setupDoctorDetailVoteButtons();
    setupTreatmentToggle();
    setupTreatmentControlEvents();
});

async function loadDoctorDetail() {
    const doctorId = getDoctorIdFromUrl();

    if (!doctorId) {
        showDoctorDetailError("Keine gültige Arzt-ID in der URL gefunden.");
        return;
    }

    try {
        const response = await fetch(`api/doctor_detail.php?id=${encodeURIComponent(doctorId)}`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.message || "Der Arzt-Steckbrief konnte nicht geladen werden.");
        }

        currentDoctorDetail = data.item || {};
        currentDoctorTerms = normalizeTermsObject(data.terms || {});
        currentDoctorTreatmentsGrouped = data.treatments_grouped || {};

        resetTreatmentControlsState();
        renderDoctorDetail(currentDoctorDetail, currentDoctorTerms, currentDoctorTreatmentsGrouped);
        showDoctorDetailContent();

    } catch (error) {
        console.error("Fehler beim Laden des Arzt-Steckbriefs:", error);
        showDoctorDetailError(error.message || "Der Arzt-Steckbrief konnte nicht geladen werden.");
    }
}

function resetTreatmentControlsState() {
    treatmentSpectrumExpanded = false;
    selectedTreatmentCategorySlugs = new Set();
    treatmentCategorySelectionMode = "all";
    treatmentSearchQuery = "";
    treatmentCategorySearchQuery = "";
    treatmentSortMode = "name_asc";
    treatmentOnlyRated = false;
    treatmentViewMode = "cards";
    treatmentPositiveMin = 0;
    treatmentNegativeMax = 100;
    treatmentCategoryDropdownOpen = false;
    currentTreatmentCategoryOptions = [];
}

function setupDoctorDetailVoteButtons() {
    const contentElement = document.getElementById("doctor-detail-content");

    if (!contentElement) {
        return;
    }

    contentElement.addEventListener("click", handleDoctorDetailVote);
}

function setupTreatmentToggle() {
    const toggleButton = document.getElementById("doctor-detail-treatment-toggle");

    if (!toggleButton) {
        return;
    }

    toggleButton.addEventListener("click", function () {
        treatmentSpectrumExpanded = !treatmentSpectrumExpanded;
        renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
    });
}

function setupTreatmentControlEvents() {
    const controlsElement = document.getElementById("doctor-detail-treatment-categories");

    if (!controlsElement) {
        return;
    }

    controlsElement.addEventListener("input", function (event) {
        const target = event.target;

        if (target.id === "doctor-detail-treatment-search") {
            treatmentSearchQuery = target.value || "";
            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            focusInputAfterRender("doctor-detail-treatment-search");
            return;
        }

        if (target.id === "doctor-detail-treatment-category-search") {
            treatmentCategorySearchQuery = target.value || "";
            treatmentCategoryDropdownOpen = true;
            renderTreatmentCategoryDropdownOptions();
            focusInputAfterRender("doctor-detail-treatment-category-search");
            return;
        }

        if (target.matches("[data-treatment-positive-min]")) {
            treatmentPositiveMin = clampPercentage(target.value);
            syncTreatmentRangeInputs(controlsElement, "[data-treatment-positive-min]", treatmentPositiveMin);
            return;
        }

        if (target.matches("[data-treatment-negative-max]")) {
            treatmentNegativeMax = clampPercentage(target.value);
            syncTreatmentRangeInputs(controlsElement, "[data-treatment-negative-max]", treatmentNegativeMax);
        }
    });

    controlsElement.addEventListener("change", function (event) {
        const target = event.target;

        if (target.matches("[data-treatment-positive-min]")) {
            treatmentPositiveMin = clampPercentage(target.value);
            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (target.matches("[data-treatment-negative-max]")) {
            treatmentNegativeMax = clampPercentage(target.value);
            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (target.matches("[data-treatment-category-checkbox]")) {
            const categorySlug = target.getAttribute("data-treatment-category-checkbox");

            if (!categorySlug) {
                return;
            }

            treatmentCategorySelectionMode = "custom";

            if (target.checked) {
                selectedTreatmentCategorySlugs.add(categorySlug);
            } else {
                selectedTreatmentCategorySlugs.delete(categorySlug);
            }

            treatmentSpectrumExpanded = false;
            treatmentCategoryDropdownOpen = true;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
        }
    });

    controlsElement.addEventListener("click", function (event) {
        const viewButton = event.target.closest("[data-treatment-view]");
        const dropdownToggle = event.target.closest("[data-treatment-category-dropdown-toggle]");
        const selectAllButton = event.target.closest("[data-treatment-category-select-all]");
        const clearButton = event.target.closest("[data-treatment-category-clear]");
        const onlyRatedButton = event.target.closest("[data-treatment-only-rated]");
        const resetButton = event.target.closest("[data-treatment-reset-filters]");
        const sortButton = event.target.closest("[data-treatment-sort]");

        if (viewButton) {
            treatmentViewMode = viewButton.getAttribute("data-treatment-view") || "cards";
            treatmentSpectrumExpanded = false;
            treatmentCategoryDropdownOpen = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (dropdownToggle) {
            treatmentCategoryDropdownOpen = !treatmentCategoryDropdownOpen;
            renderTreatmentControlsState();
            return;
        }

        if (selectAllButton) {
            treatmentCategorySelectionMode = "all";
            selectedTreatmentCategorySlugs.clear();
            treatmentCategorySearchQuery = "";
            treatmentSpectrumExpanded = false;
            treatmentCategoryDropdownOpen = true;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (clearButton) {
            treatmentCategorySelectionMode = "custom";
            selectedTreatmentCategorySlugs.clear();
            treatmentSpectrumExpanded = false;
            treatmentCategoryDropdownOpen = true;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (onlyRatedButton) {
            treatmentOnlyRated = !treatmentOnlyRated;
            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (resetButton) {
            resetTreatmentControlsState();
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (sortButton) {
            treatmentSortMode = sortButton.getAttribute("data-treatment-sort") || "name_asc";
            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
        }
    });

    document.addEventListener("click", function (event) {
        const dropdown = document.getElementById("doctor-detail-treatment-category-dropdown");

        if (!dropdown || !treatmentCategoryDropdownOpen) {
            return;
        }

        if (!dropdown.contains(event.target)) {
            treatmentCategoryDropdownOpen = false;
            renderTreatmentControlsState();
        }
    });
}

async function handleDoctorDetailVote(event) {
    const button = event.target.closest(".doctor-detail-vote-button");

    if (!button) {
        return;
    }

    if (!currentDoctorDetail || !currentDoctorDetail.dr_id) {
        alert("Die Arzt-ID fehlt. Die Bewertung konnte nicht gespeichert werden.");
        return;
    }

    const drId = Number(currentDoctorDetail.dr_id);
    const voteType = button.getAttribute("data-type");

    if (!drId || !voteType) {
        alert("Die Bewertung konnte nicht gespeichert werden, weil technische Angaben fehlen.");
        return;
    }

    setDoctorDetailVoteButtonsDisabled(true);

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
            throw new Error(data.error || data.message || "Vote konnte nicht gespeichert werden.");
        }

        currentDoctorDetail = {
            ...currentDoctorDetail,
            pro: Number(currentDoctorDetail.pro || 0) + (voteType === "pro" ? 1 : 0),
            neutral: Number(currentDoctorDetail.neutral || 0) + (voteType === "neutral" ? 1 : 0),
            contra: Number(currentDoctorDetail.contra || 0) + (voteType === "contra" ? 1 : 0)
        };

        const stats = getDoctorDetailVoteStats(currentDoctorDetail);

        currentDoctorDetail.total_votes = stats.totalVotes;
        currentDoctorDetail.positive_ratio = stats.proRatio;
        currentDoctorDetail.neutral_ratio = stats.neutralRatio;
        currentDoctorDetail.negative_ratio = stats.contraRatio;

        renderRating(currentDoctorDetail);

    } catch (error) {
        console.error("Fehler beim Speichern der Ärztebewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden. Details stehen in der Konsole.");
    } finally {
        setDoctorDetailVoteButtonsDisabled(false);
    }
}

function setDoctorDetailVoteButtonsDisabled(isDisabled) {
    document.querySelectorAll(".doctor-detail-vote-button").forEach(function (button) {
        button.disabled = isDisabled;
        button.classList.toggle("is-saving", isDisabled);
    });
}

function getDoctorIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function renderDoctorDetail(doctor, terms, treatmentsGrouped) {
    const safeTerms = normalizeTermsObject(terms);
    const name = doctor.dr_display_name || "Unbekannte Ärztin / unbekannter Arzt";
    const label = doctor.loc_label || "";
    const city = doctor.loc_city || "";
    const plz = doctor.loc_plz || "";

    document.title = `${name} | Long Covid Navigator`;

    setText("doctor-detail-title", name);
    setText("doctor-detail-name", name);
    setText("doctor-detail-subtitle", buildSubtitle(label, plz, city));
    setText("doctor-detail-avatar", buildInitials(name));

    renderCityBadge(doctor);
    renderTags(doctor, safeTerms);
    renderActionBar(doctor);
    renderAddress(doctor);
    renderLocationLabel(label);
    renderRating(doctor);
    renderContact(doctor);
    renderWebsiteCard(doctor);
    renderCare(doctor);
    renderTermGroup("doctor-detail-specialties", safeTerms.specialty, "Keine Fachrichtung hinterlegt.");
    renderTermGroup("doctor-detail-badges", safeTerms.badge, "Keine zusätzlichen Erfahrungs-/Versorgungsangaben hinterlegt.");
    renderTermGroup("doctor-detail-accessibility", safeTerms.accessibility, "Keine Angaben zur Zugänglichkeit hinterlegt.");
    renderTreatmentSpectrum(treatmentsGrouped);
}

function normalizeTermsObject(terms) {
    return {
        specialty: dedupeTermsByLabel(Array.isArray(terms?.specialty) ? terms.specialty : []),
        badge: dedupeTermsByLabel(Array.isArray(terms?.badge) ? terms.badge : []),
        accessibility: dedupeTermsByLabel(Array.isArray(terms?.accessibility) ? terms.accessibility : []),
        other: dedupeTermsByLabel(Array.isArray(terms?.other) ? terms.other : [])
    };
}

function dedupeTermsByLabel(terms) {
    const seen = new Set();

    return terms.filter(function (term) {
        const label = String(term.term_label || "").trim().toLowerCase();

        if (!label || seen.has(label)) {
            return false;
        }

        seen.add(label);
        return true;
    });
}

function buildSubtitle(label, plz, city) {
    const locationText = [plz, city].filter(Boolean).join(" ");
    const parts = [label, locationText].filter(Boolean);

    return parts.length > 0
        ? parts.join(" · ")
        : "Noch keine Standortdetails vorhanden.";
}

function buildInitials(name) {
    const cleanedName = String(name || "")
        .replace(/\bprof\.?\s*dr\.?\s*med\.?\b/gi, " ")
        .replace(/\bprof\.?\s*dr\.?\b/gi, " ")
        .replace(/\bdr\.?\s*med\.?\b/gi, " ")
        .replace(/\bdr\.?\b/gi, " ")
        .replace(/\bprof\.?\b/gi, " ")
        .replace(/\bmed\.?\b/gi, " ")
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    const parts = cleanedName
        .split(/\s+/)
        .map(part => part.trim())
        .filter(part => part.length > 0 && /[\p{L}\p{N}]/u.test(part));

    if (parts.length === 0) {
        return "DR";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderCityBadge(doctor) {
    const element = document.getElementById("doctor-detail-city-badge");

    if (!element) {
        return;
    }

    const locationText = [doctor.loc_plz, doctor.loc_city].filter(Boolean).join(" ");

    if (!locationText) {
        element.classList.add("is-hidden");
        element.textContent = "";
        return;
    }

    element.classList.remove("is-hidden");
    element.textContent = `⌖ ${locationText}`;
}

function renderTags(doctor, terms) {
    const element = document.getElementById("doctor-detail-tags");

    if (!element) {
        return;
    }

    const tags = [];

    if (doctor.dr_type) {
        tags.push(formatDoctorType(doctor.dr_type));
    }

    if (Array.isArray(terms.specialty) && terms.specialty.length > 0) {
        tags.push(terms.specialty[0].term_label);
    }

    if (doctor.dr_accepts_gkv === "yes") {
        tags.push("GKV");
    }

    if (doctor.dr_accepts_pkv === "yes") {
        tags.push("PKV");
    }

    if (tags.length === 0) {
        tags.push("Versorgung k. A.");
    }

    element.innerHTML = tags
        .map(tag => `<span class="doctor-detail-tag">${escapeHtml(tag)}</span>`)
        .join("");
}

function formatDoctorType(type) {
    const normalized = String(type || "").trim().toLowerCase();

    if (normalized === "practice") {
        return "Praxis";
    }

    if (normalized === "doctor" || normalized === "physician") {
        return "Ärzt:in";
    }

    if (normalized === "clinic") {
        return "Klinik";
    }

    if (normalized === "organization") {
        return "Organisation";
    }

    return type || "Anbieter";
}

function renderActionBar(doctor) {
    const website = doctor.loc_website || doctor.dr_website || "";
    const email = doctor.loc_email || "";
    const phone = doctor.loc_phone || "";
    const routeUrl = buildRouteUrl(doctor);

    setActionLink("doctor-detail-action-website", website, "Website");
    setActionLink("doctor-detail-action-email", email ? `mailto:${email}` : "", "E-Mail");
    setActionLink("doctor-detail-action-phone", phone ? `tel:${String(phone).replace(/[^\d+]/g, "")}` : "", "Telefon");
    setActionLink("doctor-detail-action-route", routeUrl, "Route");
    setActionLink("doctor-detail-route-button", routeUrl, "Route planen");
}

function setActionLink(id, href, fallbackText) {
    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    if (!href) {
        element.classList.add("is-disabled");
        element.setAttribute("href", "#");
        element.setAttribute("aria-disabled", "true");
        return;
    }

    element.classList.remove("is-disabled");
    element.setAttribute("href", href);
    element.removeAttribute("aria-disabled");

    if (fallbackText && element.textContent.trim() === "") {
        element.textContent = fallbackText;
    }
}

function buildRouteUrl(doctor) {
    const address = buildAddressPlainText(doctor);

    if (hasDoctorCoordinates(doctor)) {
        return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(doctor.loc_lat)}&mlon=${encodeURIComponent(doctor.loc_lng)}#map=16/${encodeURIComponent(doctor.loc_lat)}/${encodeURIComponent(doctor.loc_lng)}`;
    }

    if (address) {
        return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
    }

    return "";
}

function buildAddressPlainText(doctor) {
    const streetLine = [doctor.loc_street, doctor.loc_housenumber].filter(Boolean).join(" ");
    const cityLine = [doctor.loc_plz, doctor.loc_city].filter(Boolean).join(" ");

    return [streetLine, cityLine, doctor.loc_country].filter(Boolean).join(", ");
}

function hasDoctorCoordinates(doctor) {
    return Boolean(
        doctor &&
        doctor.has_coordinates &&
        doctor.loc_lat !== null &&
        doctor.loc_lat !== undefined &&
        doctor.loc_lng !== null &&
        doctor.loc_lng !== undefined &&
        Number.isFinite(Number(doctor.loc_lat)) &&
        Number.isFinite(Number(doctor.loc_lng))
    );
}

function renderAddress(doctor) {
    const element = document.getElementById("doctor-detail-address");

    if (!element) {
        return;
    }

    const streetLine = [doctor.loc_street, doctor.loc_housenumber].filter(Boolean).join(" ");
    const cityLine = [doctor.loc_plz, doctor.loc_city].filter(Boolean).join(" ");
    const lines = [streetLine, cityLine].filter(Boolean);

    if (lines.length === 0) {
        element.innerHTML = `<span class="doctor-detail-muted">Keine Adresse vorhanden.</span>`;
        return;
    }

    element.innerHTML = lines
        .map(line => `<span>${escapeHtml(line)}</span>`)
        .join("<br>");
}

function renderLocationLabel(label) {
    const element = document.getElementById("doctor-detail-location-label");

    if (!element) {
        return;
    }

    element.textContent = label || "Keine Standort-/Einrichtungsbezeichnung vorhanden.";
}

function renderRating(doctor) {
    const element = document.getElementById("doctor-detail-rating");
    const summaryElement = document.getElementById("doctor-detail-rating-summary");
    const inlineTotalElement = document.getElementById("doctor-detail-rating-total-inline");
    const cardTotalElement = document.getElementById("doctor-detail-rating-card-total");

    const stats = getDoctorDetailVoteStats(doctor);
    const totalText = `(${stats.totalVotes} insgesamt)`;

    if (inlineTotalElement) {
        inlineTotalElement.textContent = totalText;
    }

    if (cardTotalElement) {
        cardTotalElement.textContent = totalText;
    }

    const ratingTilesHtml = buildRatingTilesHtml(stats);

    if (summaryElement) {
        summaryElement.innerHTML = ratingTilesHtml;
    }

    if (!element) {
        return;
    }

    const ratingHtml = stats.totalVotes === 0
        ? `
            <div class="doctor-detail-rating-empty">
                Noch keine Bewertungen vorhanden.
            </div>
        `
        : `
            ${ratingTilesHtml}

            <div class="doctor-detail-rating-total">
                ${stats.totalVotes} Bewertungen insgesamt
            </div>
        `;

    element.innerHTML = `
        ${ratingHtml}

        <div class="doctor-detail-own-rating">
            <h4 class="doctor-detail-own-rating-heading">Diese Praxis bewerten</h4>

            <div class="doctor-detail-vote-buttons">
                <button
                    type="button"
                    class="doctor-detail-vote-button doctor-detail-vote-main-button doctor-detail-vote-main-positive"
                    data-type="pro"
                >
                    Positiv
                </button>

                <button
                    type="button"
                    class="doctor-detail-vote-button doctor-detail-vote-main-button doctor-detail-vote-main-neutral"
                    data-type="neutral"
                >
                    Neutral
                </button>

                <button
                    type="button"
                    class="doctor-detail-vote-button doctor-detail-vote-main-button doctor-detail-vote-main-negative"
                    data-type="contra"
                >
                    Negativ
                </button>
            </div>
        </div>
    `;
}

function buildRatingTilesHtml(stats) {
    return `
        <div class="doctor-detail-rating-tiles">
            <div class="doctor-detail-rating-tile doctor-detail-rating-positive">
                <div class="doctor-detail-rating-value">${stats.proRatio}%</div>
                <div class="doctor-detail-rating-label">Positiv</div>
                <div class="doctor-detail-rating-count">${stats.pro}</div>
            </div>

            <div class="doctor-detail-rating-tile doctor-detail-rating-neutral">
                <div class="doctor-detail-rating-value">${stats.neutralRatio}%</div>
                <div class="doctor-detail-rating-label">Neutral</div>
                <div class="doctor-detail-rating-count">${stats.neutral}</div>
            </div>

            <div class="doctor-detail-rating-tile doctor-detail-rating-negative">
                <div class="doctor-detail-rating-value">${stats.contraRatio}%</div>
                <div class="doctor-detail-rating-label">Negativ</div>
                <div class="doctor-detail-rating-count">${stats.contra}</div>
            </div>
        </div>
    `;
}

function getDoctorDetailVoteStats(doctor) {
    const pro = Number(doctor.pro || 0);
    const neutral = Number(doctor.neutral || 0);
    const contra = Number(doctor.contra || 0);
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

function renderContact(doctor) {
    const element = document.getElementById("doctor-detail-contact");

    if (!element) {
        return;
    }

    const email = doctor.loc_email || "";
    const phone = doctor.loc_phone || "";
    const items = [];

    if (phone) {
        const phoneHref = String(phone).replace(/[^\d+]/g, "");

        items.push(`
            <div class="doctor-detail-contact-entry">
                <div class="doctor-detail-mini-label">Telefon</div>
                <a href="tel:${escapeHtml(phoneHref)}">${escapeHtml(phone)}</a>
            </div>
        `);
    }

    if (email) {
        items.push(`
            <div class="doctor-detail-contact-entry">
                <div class="doctor-detail-mini-label">E-Mail</div>
                <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
            </div>
        `);
    }

    if (items.length === 0) {
        element.innerHTML = `<span class="doctor-detail-muted">Keine Kontaktdaten vorhanden.</span>`;
        return;
    }

    element.innerHTML = items.join("");
}

function renderWebsiteCard(doctor) {
    const element = document.getElementById("doctor-detail-website-card");
    const website = doctor.loc_website || doctor.dr_website || "";

    if (!element) {
        return;
    }

    if (!website) {
        element.innerHTML = `<span class="doctor-detail-muted">Keine Website hinterlegt.</span>`;
        return;
    }

    element.innerHTML = `
        <a class="doctor-detail-website-link" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(cleanWebsiteLabel(website))}
        </a>
    `;
}

function cleanWebsiteLabel(url) {
    return String(url)
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/$/i, "");
}

function renderCare(doctor) {
    const element = document.getElementById("doctor-detail-care");

    if (!element) {
        return;
    }

    const tags = [];

    if (doctor.dr_accepts_gkv === "yes") {
        tags.push("GKV");
    }

    if (doctor.dr_accepts_pkv === "yes") {
        tags.push("PKV");
    }

    if (tags.length === 0) {
        element.innerHTML = `<span class="doctor-detail-muted">Keine Kassenangaben vorhanden.</span>`;
        return;
    }

    element.innerHTML = tags
        .map(tag => `<span class="doctor-detail-tag">${escapeHtml(tag)}</span>`)
        .join("");
}

function renderTermGroup(elementId, terms, emptyText) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    if (!Array.isArray(terms) || terms.length === 0) {
        element.innerHTML = `<span class="doctor-detail-muted">${escapeHtml(emptyText)}</span>`;
        return;
    }

    element.innerHTML = terms
        .map(function (term) {
            return `
                <span
                    class="doctor-detail-term-pill"
                    title="${escapeHtml(term.term_desc || term.term_code || "")}"
                >
                    ${escapeHtml(term.term_label)}
                </span>
            `;
        })
        .join("");
}

function renderTreatmentSpectrum(treatmentsGrouped) {
    const listElement = document.getElementById("doctor-detail-treatments");
    const summaryElement = document.getElementById("doctor-detail-treatment-summary");
    const toggleButton = document.getElementById("doctor-detail-treatment-toggle");

    if (!listElement) {
        return;
    }

    listElement.classList.toggle("is-table-view", treatmentViewMode === "table");

    const groups = getVisibleTreatmentGroups(treatmentsGrouped);

    if (groups.length === 0) {
        currentTreatmentCategoryOptions = [];
        listElement.innerHTML = `<span class="doctor-detail-muted">Noch kein Behandlungsspektrum hinterlegt.</span>`;
        renderTreatmentControlsState();

        if (summaryElement) {
            summaryElement.textContent = "Noch keine Behandlungen hinterlegt.";
        }

        if (toggleButton) {
            toggleButton.classList.add("is-hidden");
        }

        return;
    }

    const totalTreatments = groups.reduce(function (sum, group) {
        return sum + group.treatments.length;
    }, 0);

    currentTreatmentCategoryOptions = groups.map(function (group) {
        return {
            slug: group.slug,
            label: group.type,
            count: group.treatments.length
        };
    });

    const allEntries = flattenTreatmentGroups(groups);
    const selectedEntries = getSelectedTreatmentEntries(allEntries);
    const visibleEntries = getFilteredAndSortedTreatmentEntries(selectedEntries).map(function (entry, index) {
        return {
            ...entry,
            rank: index + 1
        };
    });

    const hasActiveFilter =
        treatmentSearchQuery.trim() !== "" ||
        treatmentOnlyRated ||
        treatmentCategorySelectionMode === "custom" ||
        treatmentPositiveMin > 0 ||
        treatmentNegativeMax < 100;

    if (summaryElement) {
        if (!hasActiveFilter) {
            summaryElement.textContent = `${totalTreatments} Einträge in ${groups.length} Kategorien.`;
        } else {
            summaryElement.textContent = `${visibleEntries.length} von ${totalTreatments} Einträgen sichtbar.`;
        }
    }

    renderTreatmentControlsState(groups, totalTreatments);

    if (selectedEntries.length === 0) {
        listElement.innerHTML = `<span class="doctor-detail-muted">Keine Kategorie ausgewählt.</span>`;

        if (toggleButton) {
            toggleButton.classList.add("is-hidden");
        }

        return;
    }

    if (visibleEntries.length === 0) {
        listElement.innerHTML = `<span class="doctor-detail-muted">Keine Behandlung passt zu Filter, Bewertung oder Suche.</span>`;

        if (toggleButton) {
            toggleButton.classList.add("is-hidden");
        }

        return;
    }

    if (treatmentViewMode === "table") {
        listElement.innerHTML = buildTreatmentTableHtml(visibleEntries);

        if (toggleButton) {
            toggleButton.classList.add("is-hidden");
        }

        return;
    }

    const groupedEntries = groupTreatmentEntriesByCategory(visibleEntries);

    listElement.innerHTML = groupedEntries
        .map(function (group) {
            const visibleLimit = treatmentSpectrumExpanded ? group.entries.length : 6;
            const visibleGroupEntries = group.entries.slice(0, visibleLimit);
            const hiddenCount = group.entries.length - visibleGroupEntries.length;

            const treatmentItems = visibleGroupEntries
                .map(function (entry) {
                    return buildTreatmentCardItemHtml(entry);
                })
                .join("");

            const hiddenText = hiddenCount > 0
                ? `<li class="doctor-detail-treatment-more">+ ${hiddenCount} weitere</li>`
                : "";

            return `
                <section id="doctor-detail-treatment-group-${escapeHtml(group.slug)}" class="doctor-detail-treatment-group">
                    <header class="doctor-detail-treatment-group-header">
                        <h4>${escapeHtml(group.type)}</h4>
                        <span>${group.entries.length}</span>
                    </header>

                    <ul>
                        ${treatmentItems}
                        ${hiddenText}
                    </ul>
                </section>
            `;
        })
        .join("");

    const hasHiddenTreatments = groupedEntries.some(function (group) {
        return group.entries.length > 6;
    });

    if (toggleButton) {
        toggleButton.classList.toggle("is-hidden", !hasHiddenTreatments);
        toggleButton.textContent = treatmentSpectrumExpanded
            ? "Details wieder kompakt anzeigen"
            : "Alle Details anzeigen";
    }
}

function renderTreatmentControlsState() {
    setFormValue("doctor-detail-treatment-search", treatmentSearchQuery);
    setFormValue("doctor-detail-treatment-category-search", treatmentCategorySearchQuery);
    syncTreatmentRangeInputs(document, "[data-treatment-positive-min]", treatmentPositiveMin);
    syncTreatmentRangeInputs(document, "[data-treatment-negative-max]", treatmentNegativeMax);

    document.querySelectorAll("[data-treatment-view]").forEach(function (button) {
        button.classList.toggle("is-active", button.getAttribute("data-treatment-view") === treatmentViewMode);
    });

    document.querySelectorAll("[data-treatment-sort]").forEach(function (button) {
        button.classList.toggle("is-active", button.getAttribute("data-treatment-sort") === treatmentSortMode);
    });

    const onlyRatedButton = document.querySelector("[data-treatment-only-rated]");

    if (onlyRatedButton) {
        onlyRatedButton.classList.toggle("is-active", treatmentOnlyRated);
    }

    renderTreatmentCategoryDropdownOptions();
}

function renderTreatmentCategoryDropdownOptions() {
    const dropdown = document.getElementById("doctor-detail-treatment-category-dropdown");
    const button = document.getElementById("doctor-detail-treatment-category-dropdown-button");
    const optionsElement = document.getElementById("doctor-detail-treatment-category-options");

    if (!dropdown || !button || !optionsElement) {
        return;
    }

    const selectedCount = treatmentCategorySelectionMode === "all"
        ? 0
        : selectedTreatmentCategorySlugs.size;

    button.textContent = selectedCount === 0 && treatmentCategorySelectionMode === "all"
        ? "Alle Kategorien ▾"
        : `${selectedCount} Kategorien ▾`;

    button.classList.toggle("is-active", treatmentCategorySelectionMode === "custom");
    dropdown.classList.toggle("is-open", treatmentCategoryDropdownOpen);

    const normalizedSearch = treatmentCategorySearchQuery.trim().toLowerCase();
    const visibleOptions = currentTreatmentCategoryOptions.filter(function (category) {
        if (!normalizedSearch) {
            return true;
        }

        return String(category.label || "").toLowerCase().includes(normalizedSearch);
    });

    if (visibleOptions.length === 0) {
        optionsElement.innerHTML = `<div class="doctor-detail-treatment-category-empty">Keine Kategorie gefunden.</div>`;
        return;
    }

    optionsElement.innerHTML = visibleOptions.map(function (category) {
        const checked = treatmentCategorySelectionMode === "all"
            ? true
            : selectedTreatmentCategorySlugs.has(category.slug);

        return `
            <label class="doctor-detail-treatment-category-option">
                <input
                    type="checkbox"
                    ${checked ? "checked" : ""}
                    data-treatment-category-checkbox="${escapeHtml(category.slug)}"
                >

                <span>${escapeHtml(category.label)}</span>
                <small>${category.count}</small>
            </label>
        `;
    }).join("");
}

function setFormValue(id, value) {
    const element = document.getElementById(id);

    if (element && element.value !== String(value)) {
        element.value = value;
    }
}

function focusInputAfterRender(id) {
    window.setTimeout(function () {
        const input = document.getElementById(id);

        if (!input) {
            return;
        }

        input.focus();

        const valueLength = input.value.length;

        try {
            input.setSelectionRange(valueLength, valueLength);
        } catch (error) {
            // Ignore unsupported input selection.
        }
    }, 0);
}

function syncTreatmentRangeInputs(container, selector, value) {
    container.querySelectorAll(selector).forEach(function (input) {
        input.value = value;
    });
}

function clampPercentage(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function getSelectedTreatmentEntries(entries) {
    if (treatmentCategorySelectionMode === "all") {
        return entries;
    }

    return entries.filter(function (entry) {
        return selectedTreatmentCategorySlugs.has(entry.categorySlug);
    });
}

function getFilteredAndSortedTreatmentEntries(entries) {
    const normalizedSearchQuery = treatmentSearchQuery.trim().toLowerCase();

    return entries
        .filter(function (entry) {
            const treatmentName = String(entry.treatment?.behandlung || "").toLowerCase();
            const stats = getTreatmentVoteStats(entry.treatment);

            if (normalizedSearchQuery && !treatmentName.includes(normalizedSearchQuery)) {
                return false;
            }

            if (treatmentOnlyRated && stats.totalVotes === 0) {
                return false;
            }

            if (stats.positiveRatio < treatmentPositiveMin) {
                return false;
            }

            if (stats.negativeRatio > treatmentNegativeMax) {
                return false;
            }

            return true;
        })
        .slice()
        .sort(compareTreatmentEntriesForCurrentSort);
}

function compareTreatmentEntriesForCurrentSort(a, b) {
    const nameCompare = String(a?.treatment?.behandlung || "").localeCompare(String(b?.treatment?.behandlung || ""), "de", { sensitivity: "base" });
    const statsA = getTreatmentVoteStats(a.treatment);
    const statsB = getTreatmentVoteStats(b.treatment);

    if (treatmentSortMode === "name_desc") {
        return -nameCompare;
    }

    if (treatmentSortMode === "positive_desc") {
        return (statsB.positiveRatio - statsA.positiveRatio)
            || (statsB.totalVotes - statsA.totalVotes)
            || nameCompare;
    }

    if (treatmentSortMode === "negative_desc") {
        return (statsB.negativeRatio - statsA.negativeRatio)
            || (statsB.totalVotes - statsA.totalVotes)
            || nameCompare;
    }

    if (treatmentSortMode === "votes_desc") {
        return (statsB.totalVotes - statsA.totalVotes)
            || (statsB.positiveRatio - statsA.positiveRatio)
            || nameCompare;
    }

    return nameCompare;
}

function flattenTreatmentGroups(groups) {
    return groups.flatMap(function (group) {
        return group.treatments.map(function (treatment) {
            return {
                treatment,
                categoryType: group.type,
                categorySlug: group.slug
            };
        });
    });
}

function groupTreatmentEntriesByCategory(entries) {
    const map = new Map();

    entries.forEach(function (entry) {
        if (!map.has(entry.categorySlug)) {
            map.set(entry.categorySlug, {
                type: entry.categoryType,
                slug: entry.categorySlug,
                entries: []
            });
        }

        map.get(entry.categorySlug).entries.push(entry);
    });

    return Array.from(map.values());
}

function buildTreatmentCardItemHtml(entry) {
    return buildTreatmentItemHtml(entry.treatment, entry.rank);
}

function buildTreatmentItemHtml(treatment, rank) {
    const name = treatment.behandlung || "Unbenannte Behandlung";
    const detailUrl = buildTreatmentDetailUrl(treatment);
    const ratingHtml = buildTreatmentRatingCompactHtml(treatment);

    const titleHtml = detailUrl
        ? `<a class="doctor-detail-treatment-link" href="${escapeHtml(detailUrl)}">${escapeHtml(name)}</a>`
        : `<span class="doctor-detail-treatment-name">${escapeHtml(name)}</span>`;

    return `
        <li class="doctor-detail-treatment-item doctor-detail-treatment-item-with-rating">
            <div class="doctor-detail-treatment-item-main">
                <div class="doctor-detail-treatment-item-topline">
                    <span class="doctor-detail-treatment-rank-badge">#${rank}</span>
                    ${titleHtml}
                </div>

                ${ratingHtml}
            </div>
        </li>
    `;
}

function buildTreatmentTableHtml(entries) {
    return `
        <div class="doctor-detail-treatment-table-wrap">
            <table class="doctor-detail-treatment-table">
                <thead>
                    <tr>
                        <th>Rang</th>
                        <th>Therapie</th>
                        <th>Kategorie</th>
                        <th>Erfahrung</th>
                        <th>Anbieter gesamt</th>
                    </tr>
                </thead>

                <tbody>
                    ${entries.map(buildTreatmentTableRowHtml).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function buildTreatmentTableRowHtml(entry) {
    const treatment = entry.treatment;
    const name = treatment.behandlung || "Unbenannte Behandlung";
    const detailUrl = buildTreatmentDetailUrl(treatment);
    const providerCount = Number(treatment.provider_count || treatment.provider_total || treatment.provider_count_total || 0);

    const titleHtml = detailUrl
        ? `<a class="doctor-detail-treatment-link" href="${escapeHtml(detailUrl)}">${escapeHtml(name)}</a>`
        : `<span class="doctor-detail-treatment-name">${escapeHtml(name)}</span>`;

    return `
        <tr>
            <td>
                <span class="doctor-detail-treatment-rank-badge">#${entry.rank}</span>
            </td>

            <td>
                ${titleHtml}
            </td>

            <td>
                <span class="doctor-detail-treatment-category-inline">${escapeHtml(entry.categoryType)}</span>
            </td>

            <td>
                ${buildTreatmentExperienceTableHtml(treatment)}
            </td>

            <td>
                <span class="doctor-detail-treatment-provider-badge">
                    ${providerCount > 0 ? escapeHtml(providerCount) : "—"}
                </span>
            </td>
        </tr>
    `;
}

function buildTreatmentExperienceTableHtml(treatment) {
    const stats = getTreatmentVoteStats(treatment);

    if (stats.totalVotes === 0) {
        return `<span class="doctor-detail-treatment-table-muted">noch keine</span>`;
    }

    return `
        <div class="doctor-detail-treatment-experience-row" title="${stats.totalVotes} Bewertungen insgesamt">
            <span class="doctor-detail-treatment-table-rating is-positive">+${stats.positiveRatio}%</span>
            <span class="doctor-detail-treatment-table-rating is-neutral">=${stats.neutralRatio}%</span>
            <span class="doctor-detail-treatment-table-rating is-negative">-${stats.negativeRatio}%</span>
            <small>(n=${stats.totalVotes})</small>
        </div>
    `;
}

function buildTreatmentDetailUrl(treatment) {
    const treatId = Number(treatment?.treat_id || 0);

    if (!treatId) {
        return "";
    }

    return `therapie_detail.html?treat_id=${encodeURIComponent(treatId)}`;
}

function buildTreatmentRatingCompactHtml(treatment) {
    const stats = getTreatmentVoteStats(treatment);

    if (stats.totalVotes === 0) {
        return `
            <span class="doctor-detail-treatment-rating-empty">
                noch keine Bewertungen
            </span>
        `;
    }

    return `
        <span class="doctor-detail-treatment-rating-compact" title="${stats.totalVotes} Bewertungen insgesamt">
            <span class="is-positive">${stats.positiveRatio}% positiv</span>
            <span class="is-neutral">${stats.neutralRatio}% neutral</span>
            <span class="is-negative">${stats.negativeRatio}% negativ</span>
            <small>n=${stats.totalVotes}</small>
        </span>
    `;
}

function getTreatmentVoteStats(treatment) {
    const pro = Number(treatment?.pro || 0);
    const neutral = Number(treatment?.neutral || 0);
    const contra = Number(treatment?.contra || 0);
    const totalVotes = pro + neutral + contra;

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

function getVisibleTreatmentGroups(treatmentsGrouped) {
    const rawGroups = treatmentsGrouped && typeof treatmentsGrouped === "object"
        ? Object.entries(treatmentsGrouped)
        : [];

    return rawGroups
        .filter(function ([, treatments]) {
            return Array.isArray(treatments) && treatments.length > 0;
        })
        .map(function ([type, treatments]) {
            return {
                type: type || "Ohne Kategorie",
                slug: slugify(type || "ohne-kategorie"),
                treatments: treatments
            };
        });
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "kategorie";
}

function showDoctorDetailContent() {
    const statusElement = document.getElementById("doctor-detail-status");
    const contentElement = document.getElementById("doctor-detail-content");

    if (statusElement) {
        statusElement.classList.add("is-hidden");
    }

    if (contentElement) {
        contentElement.classList.remove("is-hidden");
    }
}

function showDoctorDetailError(message) {
    const statusElement = document.getElementById("doctor-detail-status");
    const contentElement = document.getElementById("doctor-detail-content");

    setText("doctor-detail-title", "Arzt-Steckbrief nicht gefunden");
    setText("doctor-detail-subtitle", "");

    if (contentElement) {
        contentElement.classList.add("is-hidden");
    }

    if (statusElement) {
        statusElement.classList.remove("is-hidden");
        statusElement.classList.add("doctor-detail-status-error");
        statusElement.textContent = message;
    }
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
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