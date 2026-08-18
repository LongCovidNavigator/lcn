let currentDoctorDetail = null;
let currentDoctorTerms = {
    specialty: [],
    badge: [],
    accessibility: [],
    other: []
};

let currentDoctorTreatmentsGrouped = {};
let currentDoctorAnalysis = null;
let treatmentSpectrumExpanded = false;
const treatmentSpectrumBatchSize = 30;
let treatmentSpectrumVisibleCount = 6;
let selectedTreatmentCategorySlugs = new Set();
let treatmentCategorySelectionMode = "all";

let treatmentSearchQuery = "";
let treatmentCategorySearchQuery = "";
let treatmentSubcategoryFilter = null;
let treatmentCategoryDrilldownLabel = "";
let treatmentSortMode = "name_asc";
let treatmentOnlyRated = false;
let treatmentViewMode = "categories";
let treatmentPositiveMin = 0;
let treatmentVotesMin = 0;
let treatmentNegativeMax = 100;
let treatmentCategoryDropdownOpen = false;
let treatmentAnalysisFilter = null;

let currentTreatmentCategoryOptions = [];
let doctorDetailMap = null;


document.addEventListener("DOMContentLoaded", function () {
    setDoctorDetailSuggestionLinks();
    loadDoctorDetail();
    setupDoctorDetailVoteButtons();
    setupTreatmentToggle();
    setupTreatmentControlEvents();
    setupTreatmentAnalysisFilters();
    setupDoctorDetailLocationControl();
});

function setDoctorDetailSuggestionLinks() {
    const doctorId = getDoctorIdFromUrl();
    if (!doctorId) return;
    const href = `arzt_vorschlagen.html?existing_target_id=${encodeURIComponent(doctorId)}`;
    document.querySelectorAll("[data-detail-suggestion-link]").forEach(function (link) { link.href = href; });
}

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
        currentDoctorAnalysis = data.analysis || null;

        resetTreatmentControlsState();
        renderDoctorDetail(currentDoctorDetail, currentDoctorTerms, currentDoctorTreatmentsGrouped);
        updateDoctorDetailVoteSelection(currentDoctorDetail.own_vote || null);
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
    treatmentSubcategoryFilter = null;
    treatmentCategoryDrilldownLabel = "";
    treatmentSortMode = "name_asc";
    treatmentOnlyRated = false;
    treatmentViewMode = getSavedDoctorDetailTreatmentView();
    treatmentPositiveMin = 0;
    treatmentVotesMin = 0;
    treatmentNegativeMax = 100;
    treatmentCategoryDropdownOpen = false;
    treatmentAnalysisFilter = null;
    currentTreatmentCategoryOptions = [];
}

function setupTreatmentAnalysisFilters() {
    const summary = document.getElementById("doctor-detail-treatment-offer-summary");

    if (!summary) return;

    const activateFilter = function (target) {
        const filterType = target.getAttribute("data-treatment-analysis-filter");
        const threshold = Number(target.getAttribute("data-treatment-analysis-threshold") || 0);

        treatmentAnalysisFilter = filterType;
        treatmentViewMode = "table";
        treatmentCategorySelectionMode = "all";
        selectedTreatmentCategorySlugs = new Set();
        treatmentSubcategoryFilter = null;
        treatmentCategoryDrilldownLabel = "";
        treatmentSearchQuery = "";
        treatmentOnlyRated = true;
        treatmentNegativeMax = 100;
        treatmentSpectrumExpanded = false;

        if (filterType === "positive") {
            treatmentPositiveMin = threshold;
            treatmentVotesMin = 0;
            treatmentSortMode = "positive_desc";
        } else if (filterType === "frequent") {
            treatmentPositiveMin = 0;
            treatmentVotesMin = threshold;
            treatmentSortMode = "votes_desc";
        }

        renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
        const scrollTarget = window.matchMedia("(max-width: 760px)").matches
            ? document.getElementById("doctor-detail-treatments")
            : document.querySelector(".doctor-detail-treatment-panel");
        scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    summary.addEventListener("click", function (event) {
        const target = event.target.closest("[data-treatment-analysis-filter]");
        if (target) activateFilter(target);
    });

    summary.addEventListener("keydown", function (event) {
        const target = event.target.closest("[data-treatment-analysis-filter]");
        if (target && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            activateFilter(target);
        }
    });
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
        treatmentSpectrumVisibleCount += treatmentSpectrumBatchSize;
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
            treatmentSubcategoryFilter = null;
            treatmentCategoryDrilldownLabel = "";

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
            if (treatmentViewMode === "cards" || treatmentViewMode === "table") {
                try { localStorage.setItem("lcn_result_view_preference", treatmentViewMode); } catch (_) {}
            }
            treatmentCategoryDrilldownLabel = "";
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
            treatmentSubcategoryFilter = null;
            treatmentCategoryDrilldownLabel = "";
            treatmentCategorySearchQuery = "";
            treatmentSpectrumExpanded = false;
            treatmentCategoryDropdownOpen = true;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        if (clearButton) {
            treatmentCategorySelectionMode = "custom";
            selectedTreatmentCategorySlugs.clear();
            treatmentSubcategoryFilter = null;
            treatmentCategoryDrilldownLabel = "";
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
        const categoryBackButton = event.target.closest("[data-treatment-category-back]");

        if (categoryBackButton) {
            treatmentViewMode = "categories";
            treatmentCategorySelectionMode = "all";
            selectedTreatmentCategorySlugs.clear();
            treatmentSubcategoryFilter = null;
            treatmentCategoryDrilldownLabel = "";
            treatmentSpectrumExpanded = false;
            treatmentCategoryDropdownOpen = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

        const overviewCard = event.target.closest("[data-treatment-category-card]");

        if (overviewCard) {
            activateTreatmentCategoryCard(overviewCard);
            return;
        }

        const tableSortButton = event.target.closest("[data-treatment-table-sort]");

        if (tableSortButton) {
            setTreatmentTableSort(tableSortButton.getAttribute("data-treatment-table-sort"));
            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
            return;
        }

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

        await loadDoctorDetail();

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
    setText("doctor-detail-sticky-title", name);
    setText("doctor-detail-name", name);
    setText("doctor-detail-subtitle", buildSubtitle(label, plz, city));
    setText("doctor-detail-sticky-location", [plz, city].filter(Boolean).join(" ") || "Standort nicht hinterlegt");
    setText("doctor-detail-avatar", buildInitials(name));
    setText("doctor-detail-sticky-avatar", buildInitials(name));

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
    renderPracticeFeatureGroups(safeTerms);
    renderTreatmentSpectrum(treatmentsGrouped);
    renderDoctorLocationMap(doctor);
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

    element.innerHTML = ratingHtml;
}

function buildRatingTilesHtml(stats) {
    return `
        <div class="doctor-detail-rating-tiles">
            <div class="doctor-detail-rating-tile doctor-detail-rating-positive">
                <div class="doctor-detail-rating-value">${stats.proRatio}%</div>
                <div class="doctor-detail-rating-label">Positiv <span class="doctor-detail-rating-count">(${stats.pro})</span></div>
            </div>

            <div class="doctor-detail-rating-tile doctor-detail-rating-neutral">
                <div class="doctor-detail-rating-value">${stats.neutralRatio}%</div>
                <div class="doctor-detail-rating-label">Neutral <span class="doctor-detail-rating-count">(${stats.neutral})</span></div>
            </div>

            <div class="doctor-detail-rating-tile doctor-detail-rating-negative">
                <div class="doctor-detail-rating-value">${stats.contraRatio}%</div>
                <div class="doctor-detail-rating-label">Negativ <span class="doctor-detail-rating-count">(${stats.contra})</span></div>
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
        <div class="doctor-detail-contact-entry">
            <div class="doctor-detail-mini-label">Website</div>
            <a class="doctor-detail-website-link" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(cleanWebsiteLabel(website))}
            </a>
        </div>
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
        element.innerHTML = element.classList.contains("doctor-detail-feature-list")
            ? `<div class="doctor-detail-feature-empty"><span aria-hidden="true">◎</span><p>${escapeHtml(emptyText)}</p></div>`
            : `<span class="doctor-detail-muted">${escapeHtml(emptyText)}</span>`;
        return;
    }

    const featureList = element.classList.contains("doctor-detail-feature-list");
    const accessibilityList = elementId === "doctor-detail-accessibility";

    element.innerHTML = terms
        .map(function (term) {
            if (featureList) {
                const featureIcon = accessibilityList ? getAccessibilityIcon(term.term_code) : "✓";

                return `
                    <div class="doctor-detail-feature-row${accessibilityList ? " is-accessibility" : ""}" title="${escapeHtml(term.term_desc || term.term_code || "")}">
                        <span class="doctor-detail-feature-icon" aria-hidden="true">${featureIcon}</span>
                        <span class="doctor-detail-feature-label">${escapeHtml(term.term_label)}</span>
                        <strong class="doctor-detail-feature-status">Ja</strong>
                    </div>
                `;
            }

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

const doctorPracticeFeatureGroups = [
    {
        id: "expertise",
        codes: [
            "long-covid-expertise",
            "postvac-expertise",
            "mecfs-knowledgeable",
            "pots-expertise",
            "mcas-expertise",
            "mecfs-aware"
        ],
        separatedCodes: new Set(["mecfs-aware"]),
        emptyText: "Keine Angaben zur fachlichen Erfahrung hinterlegt."
    },
    {
        id: "diagnostics",
        codes: [
            "provides-mecfs-diagnosis",
            "accepts-mecfs-diagnosis",
            "treats-mecfs-offlabel",
            "offers-immunodiagnostics",
            "provides-attestations"
        ],
        emptyText: "Keine Angaben zu Diagnostik und Behandlung hinterlegt."
    },
    {
        id: "patient-experience",
        codes: ["patients-feel-heard", "gender-sensitive", "lgbtq-friendly"],
        emptyText: "Keine Erfahrungen von Patient:innen hinterlegt."
    },
    {
        id: "care-contact",
        codes: ["telemedicine-phone", "telemedicine-video", "home-visits-available", "email-contact"],
        emptyText: "Keine Angaben zu Kontakt und Versorgung hinterlegt."
    },
    {
        id: "practice-access",
        codes: [
            "wheelchair-accessible",
            "automatic-doors",
            "wheelchair-ramps",
            "parking-nearby",
            "infection-control-protocols"
        ],
        emptyText: "Keine Angaben zu Barrierefreiheit und Praxisbesuch hinterlegt."
    }
];

function renderPracticeFeatureGroups(terms) {
    const allTerms = [...(terms.badge || []), ...(terms.accessibility || [])];
    const termsByCode = new Map(allTerms.map(function (term) {
        return [String(term.term_code || ""), term];
    }));
    const assignedCodes = new Set();

    doctorPracticeFeatureGroups.forEach(function (group) {
        const groupTerms = group.codes
            .map(function (code) {
                const term = termsByCode.get(code);
                if (term) assignedCodes.add(code);
                return term;
            })
            .filter(Boolean);

        renderPracticeFeatureGroup(group, groupTerms);
    });

    const unassignedTerms = allTerms.filter(function (term) {
        return !assignedCodes.has(String(term.term_code || ""));
    });

    if (unassignedTerms.length > 0) {
        console.warn("Nicht eingeordnete Praxismerkmale:", unassignedTerms);
    }
}

function renderPracticeFeatureGroup(group, terms) {
    const element = document.getElementById(`doctor-detail-${group.id}`);
    const countElement = document.getElementById(`doctor-detail-${group.id}-count`);
    if (!element) return;

    if (countElement) countElement.textContent = `${terms.length} / ${group.codes.length}`;

    if (terms.length === 0) {
        element.innerHTML = `<div class="doctor-detail-feature-group-empty">${escapeHtml(group.emptyText)}</div>`;
        return;
    }

    element.innerHTML = terms.map(function (term) {
        const isSeparated = group.separatedCodes?.has(String(term.term_code || ""));
        return `
            <div class="doctor-detail-feature-row${isSeparated ? " is-separated" : ""}" title="${escapeHtml(term.term_desc || term.term_code || "")}">
                <span class="doctor-detail-feature-icon" aria-hidden="true">✓</span>
                <span class="doctor-detail-feature-label">${escapeHtml(term.term_label)}</span>
                <strong class="doctor-detail-feature-status">Ja</strong>
            </div>
        `;
    }).join("");
}

function getAccessibilityIcon(termCode) {
    const icons = {
        "telemedicine-phone": "☎",
        "telemedicine-video": "▣",
        "wheelchair-accessible": "♿",
        "automatic-doors": "↔",
        "wheelchair-ramps": "◿",
        "home-visits-available": "⌂",
        "infection-control-protocols": "✥",
        "email-contact": "✉",
        "parking-nearby": "P"
    };

    return icons[String(termCode || "")] || "◆";
}

function renderDoctorLocationMap(doctor) {
    const mapElement = document.getElementById("doctor-detail-map");
    const distanceElement = document.getElementById("doctor-detail-distance");
    const ownLocationInput = document.getElementById("doctor-detail-own-location-input");
    const ownLocationClear = document.getElementById("doctor-detail-own-location-clear");
    const savedLocation = getSavedSharedLocation();

    if (ownLocationInput && document.activeElement !== ownLocationInput) {
        ownLocationInput.value = savedLocation?.label || "";
    }
    if (ownLocationClear) ownLocationClear.classList.toggle("is-hidden", !savedLocation);

    if (!mapElement) {
        return;
    }

    if (!hasDoctorCoordinates(doctor) || typeof L === "undefined") {
        mapElement.innerHTML = `<span class="doctor-detail-muted">Keine Kartenposition hinterlegt.</span>`;

        if (distanceElement) {
            distanceElement.textContent = "Entfernung nicht verfügbar";
        }

        return;
    }

    const lat = Number(doctor.loc_lat);
    const lng = Number(doctor.loc_lng);

    if (doctorDetailMap) {
        doctorDetailMap.remove();
        doctorDetailMap = null;
        mapElement.replaceChildren();
    }

    doctorDetailMap = L.map(mapElement, {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: true
    }).setView([lat, lng], 15);

    mapElement.onclick = function () {
        doctorDetailMap.scrollWheelZoom.enable();
        mapElement.classList.add("is-scroll-zoom-active");
    };

    mapElement.onmouseleave = function () {
        doctorDetailMap.scrollWheelZoom.disable();
        mapElement.classList.remove("is-scroll-zoom-active");
    };

    L.control.zoom({
        position: "topright"
    }).addTo(doctorDetailMap);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere"
    }).addTo(doctorDetailMap);

    L.marker([lat, lng])
        .addTo(doctorDetailMap)
        .bindPopup(`<strong>Praxis</strong><br>${escapeHtml(buildAddressPlainText(doctor))}`);

    if (distanceElement) {
        if (savedLocation) {
            const distance = calculateDistanceKm(savedLocation.lat, savedLocation.lng, lat, lng);
            distanceElement.textContent = `ca. ${formatDistanceKm(distance)} km (Luftlinie)`;
        } else {
            distanceElement.textContent = "Standort nicht gesetzt";
        }
    }

    if (savedLocation) {
        const ownLocationIcon = L.icon({
            iconUrl: window.LCNImages.urls["map-marker-red"],
            shadowUrl: window.LCNImages.urls["map-marker-shadow"],
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        L.marker([savedLocation.lat, savedLocation.lng], {
            icon: ownLocationIcon,
            zIndexOffset: 1000,
            title: `Standort: ${savedLocation.label}`
        })
            .addTo(doctorDetailMap)
            .bindPopup(`<strong>Standort</strong><br>${escapeHtml(savedLocation.label)}`);

        fitDoctorDetailMapToLocations();
    }

    window.setTimeout(function () {
        doctorDetailMap?.invalidateSize();
        fitDoctorDetailMapToLocations();
    }, 0);

    function fitDoctorDetailMapToLocations() {
        if (!doctorDetailMap || !savedLocation) {
            return;
        }

        doctorDetailMap.fitBounds(L.latLngBounds([
            [lat, lng],
            [savedLocation.lat, savedLocation.lng]
        ]), {
            padding: [30, 30]
        });
    }
}

function setupDoctorDetailLocationControl() {
    const input = document.getElementById("doctor-detail-own-location-input");
    const clearButton = document.getElementById("doctor-detail-own-location-clear");
    if (!input) return;

    input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        saveDoctorDetailLocationFromInput();
    });

    input.addEventListener("change", saveDoctorDetailLocationFromInput);

    clearButton?.addEventListener("click", function () {
        clearSharedDoctorLocation();
    });
}

function activateTreatmentCategoryCard(categoryCard) {
    const categorySlug = categoryCard.getAttribute("data-treatment-category-slug");

    if (!categorySlug) {
        return;
    }

    treatmentViewMode = "table";
    treatmentCategorySelectionMode = "custom";
    selectedTreatmentCategorySlugs = new Set([categorySlug]);
    treatmentSubcategoryFilter = categoryCard.hasAttribute("data-treatment-subcategory")
        ? categoryCard.getAttribute("data-treatment-subcategory")
        : null;
    treatmentCategoryDrilldownLabel = categoryCard.querySelector("h4")?.textContent?.trim() || "Ausgewählte Kategorie";
    treatmentSearchQuery = "";
    treatmentOnlyRated = false;
    treatmentPositiveMin = 0;
    treatmentNegativeMax = 100;
    treatmentSpectrumExpanded = false;
    treatmentCategoryDropdownOpen = false;
    renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
}

async function saveDoctorDetailLocationFromInput() {
    const input = document.getElementById("doctor-detail-own-location-input");
    const query = input?.value.trim() || "";

    if (query === "") {
        clearSharedDoctorLocation();
        return;
    }

    input.disabled = true;

    try {
        const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "Standort nicht gefunden.");

        const result = data.result || {};
        const location = {
            location: result.formatted || query,
            label: result.formatted || query,
            city: result.city || "",
            lat: Number(result.lat),
            lng: Number(result.lng)
        };

        if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
            throw new Error("Der Standort enthält keine gültigen Koordinaten.");
        }

        localStorage.setItem("lcn_shared_location_preference", JSON.stringify(location));
        localStorage.removeItem("lcn_shared_location_cleared");
        input.value = location.label;
        renderDoctorLocationMap(currentDoctorDetail || {});
    } catch (error) {
        console.error("Der Standort konnte nicht übernommen werden:", error);
        alert("Der Standort konnte nicht gefunden werden. Bitte gib die Adresse oder den Ort eindeutiger ein.");
    } finally {
        input.disabled = false;
    }
}

function clearSharedDoctorLocation() {
    localStorage.removeItem("lcn_shared_location_preference");
    localStorage.removeItem("lcn_doctor_location_preference");
    localStorage.removeItem("lcn_treatment_location_preference");
    localStorage.setItem("lcn_shared_location_cleared", "1");

    const input = document.getElementById("doctor-detail-own-location-input");
    if (input) input.value = "";
    renderDoctorLocationMap(currentDoctorDetail || {});
}

function getSavedSharedLocation() {
    try {
        const value = localStorage.getItem("lcn_shared_location_preference");
        const location = value ? JSON.parse(value) : null;
        const hasCoordinates = location?.lat !== null && location?.lat !== undefined
            && location?.lng !== null && location?.lng !== undefined;
        const lat = Number(location?.lat);
        const lng = Number(location?.lng);

        const label = String(location?.label || location?.location || location?.city || "Eigener Standort").trim();

        return hasCoordinates && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, label } : null;
    } catch (error) {
        return null;
    }
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const toRadians = value => value * Math.PI / 180;
    const earthRadiusKm = 6371;
    const latDelta = toRadians(lat2 - lat1);
    const lngDelta = toRadians(lng2 - lng1);
    const a = Math.sin(latDelta / 2) ** 2
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lngDelta / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceKm(distance) {
    return distance < 10 ? distance.toFixed(1).replace(".", ",") : Math.round(distance).toString();
}

function renderTreatmentSpectrum(treatmentsGrouped) {
    const listElement = document.getElementById("doctor-detail-treatments");
    const summaryElement = document.getElementById("doctor-detail-treatment-summary");
    const toggleButton = document.getElementById("doctor-detail-treatment-toggle");

    if (!listElement) {
        return;
    }

    listElement.classList.toggle("is-table-view", treatmentViewMode === "table");
    listElement.classList.toggle("is-category-view", treatmentViewMode === "categories");

    const groups = getVisibleTreatmentGroups(treatmentsGrouped);
    renderTreatmentOfferSummary(currentDoctorAnalysis);

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
        treatmentVotesMin > 0 ||
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

    if (treatmentViewMode === "categories") {
        listElement.innerHTML = buildTreatmentCategoryOverviewHtml(groups, visibleEntries);

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

    if (!treatmentSpectrumExpanded) {
        treatmentSpectrumExpanded = true;
        treatmentSpectrumVisibleCount = treatmentSpectrumBatchSize;
    }

    const visibleLimit = Math.min(treatmentSpectrumVisibleCount, visibleEntries.length);
    const displayedEntries = visibleEntries.slice(0, visibleLimit);

    listElement.innerHTML = displayedEntries
        .map(buildTreatmentCardItemHtml)
        .join("");

    const hiddenTreatmentCount = Math.max(0, visibleEntries.length - displayedEntries.length);

    if (toggleButton) {
        toggleButton.classList.toggle("is-hidden", hiddenTreatmentCount === 0);
        toggleButton.textContent = `Weitere ${Math.min(treatmentSpectrumBatchSize, hiddenTreatmentCount)} Kacheln laden`;
    }
}

function renderTreatmentControlsState() {
    const controls = document.querySelector(".doctor-detail-treatment-controls");
    if (controls) {
        controls.classList.toggle("is-categories-only", treatmentViewMode === "categories");
    }

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

    const normalizedSearch = normalizeGermanSearchValue(treatmentCategorySearchQuery);
    const visibleOptions = currentTreatmentCategoryOptions.filter(function (category) {
        if (!normalizedSearch) {
            return true;
        }

        return normalizeGermanSearchValue(category.label).includes(normalizedSearch);
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
    const normalizedSearchQuery = normalizeGermanSearchValue(treatmentSearchQuery);

    return entries
        .filter(function (entry) {
            const treatmentName = normalizeGermanSearchValue(entry.treatment?.behandlung);
            const treatmentSubcategory = String(entry.treatment?.unterkategorie || "").trim();
            const stats = getTreatmentVoteStats(entry.treatment);

            if (treatmentSubcategoryFilter !== null && treatmentSubcategory !== treatmentSubcategoryFilter) {
                return false;
            }

            if (normalizedSearchQuery && !treatmentName.includes(normalizedSearchQuery)) {
                return false;
            }

            if (treatmentOnlyRated && stats.totalVotes === 0) {
                return false;
            }

            if (stats.positiveRatio < treatmentPositiveMin) {
                return false;
            }

            if (stats.totalVotes < treatmentVotesMin) {
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
    const categoryCompare = String(a?.categoryType || "").localeCompare(String(b?.categoryType || ""), "de", { sensitivity: "base" });
    const statsA = getTreatmentVoteStats(a.treatment);
    const statsB = getTreatmentVoteStats(b.treatment);
    const providersA = getTreatmentProviderCount(a.treatment);
    const providersB = getTreatmentProviderCount(b.treatment);

    if (treatmentSortMode === "name_desc") {
        return -nameCompare;
    }

    if (treatmentSortMode === "positive_desc") {
        return (statsB.positiveRatio - statsA.positiveRatio)
            || (statsB.totalVotes - statsA.totalVotes)
            || nameCompare;
    }

    if (treatmentSortMode === "positive_asc") {
        return (statsA.positiveRatio - statsB.positiveRatio)
            || (statsA.totalVotes - statsB.totalVotes)
            || nameCompare;
    }

    if (treatmentSortMode === "category_asc") {
        return categoryCompare || nameCompare;
    }

    if (treatmentSortMode === "category_desc") {
        return -categoryCompare || nameCompare;
    }

    if (treatmentSortMode === "providers_desc") {
        return (providersB - providersA) || nameCompare;
    }

    if (treatmentSortMode === "providers_asc") {
        return (providersA - providersB) || nameCompare;
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

    if (treatmentSortMode === "votes_asc") {
        return (statsA.totalVotes - statsB.totalVotes)
            || (statsA.positiveRatio - statsB.positiveRatio)
            || nameCompare;
    }

    return nameCompare;
}

function getTreatmentProviderCount(treatment) {
    return Number(treatment?.provider_count || treatment?.provider_total || treatment?.provider_count_total || 0);
}

function setTreatmentTableSort(sortKey) {
    const sortModes = {
        name: ["name_asc", "name_desc"],
        category: ["category_asc", "category_desc"],
        experience: ["positive_desc", "positive_asc"],
        votes: ["votes_desc", "votes_asc"],
        providers: ["providers_desc", "providers_asc"]
    };
    const modes = sortModes[sortKey];
    if (!modes) return;

    treatmentSortMode = treatmentSortMode === modes[0] ? modes[1] : modes[0];
}

function buildTreatmentTableSortHeader(label, sortKey) {
    const sortModes = {
        name: ["name_asc", "name_desc"],
        category: ["category_asc", "category_desc"],
        experience: ["positive_desc", "positive_asc"],
        votes: ["votes_desc", "votes_asc"],
        providers: ["providers_desc", "providers_asc"]
    };
    const modes = sortModes[sortKey] || [];
    const activeIndex = modes.indexOf(treatmentSortMode);
    const descendingFirst = sortKey === "experience" || sortKey === "votes" || sortKey === "providers";
    const arrow = activeIndex === 0
        ? (descendingFirst ? "↓" : "↑")
        : activeIndex === 1
            ? (descendingFirst ? "↑" : "↓")
            : "↕";

    return `<button type="button" class="doctor-detail-treatment-table-sort" data-treatment-table-sort="${sortKey}">${label}<span aria-hidden="true">${arrow}</span></button>`;
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
    const providerCount = Number(treatment.provider_count || treatment.provider_total || treatment.provider_count_total || 0);

    const titleHtml = detailUrl
        ? `<a class="doctor-detail-treatment-link" href="${escapeHtml(detailUrl)}">${escapeHtml(name)}</a>`
        : `<span class="doctor-detail-treatment-name">${escapeHtml(name)}</span>`;

    return `
        <li class="doctor-detail-treatment-item doctor-detail-treatment-item-with-rating">
            <div class="doctor-detail-treatment-item-main">
                <div class="doctor-detail-treatment-item-topline">
                    ${titleHtml}
                    <span class="doctor-detail-treatment-rank-badge" title="Anbieter gesamt">${providerCount || rank}</span>
                </div>

                ${ratingHtml}
            </div>
        </li>
    `;
}

function buildTreatmentTableHtml(entries) {
    const categoryBackHtml = treatmentCategoryDrilldownLabel
        ? `
            <div class="doctor-detail-treatment-category-drilldown-bar">
                <div>
                    <span>Gefilterte Kategorie</span>
                    <strong>${escapeHtml(treatmentCategoryDrilldownLabel)}</strong>
                </div>
                <button type="button" data-treatment-category-back>
                    ← Zurück zu Kategorien
                </button>
            </div>
        `
        : "";

    return `
        ${categoryBackHtml}
        <div class="doctor-detail-treatment-table-wrap">
            <table class="doctor-detail-treatment-table doctor-detail-treatment-table-detailed">
                <thead>
                    <tr>
                        <th>Rang</th>
                        <th>${buildTreatmentTableSortHeader("Therapie", "name")}</th>
                        <th>${buildTreatmentTableSortHeader("Kategorie", "category")}</th>
                        <th>${buildTreatmentTableSortHeader("Erfahrung", "experience")}</th>
                        <th>${buildTreatmentTableSortHeader("Bewertungen", "votes")}</th>
                        <th>${buildTreatmentTableSortHeader("Anbieter gesamt", "providers")}</th>
                    </tr>
                </thead>

                <tbody>
                    ${entries.map(buildTreatmentTableRowHtml).join("")}
                </tbody>
            </table>

            <table class="doctor-detail-treatment-compact-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Therapie</th>
                        <th>Positiv</th>
                        <th>
                            <span class="doctor-detail-treatment-provider-heading-full">Anbieter</span>
                            <span class="doctor-detail-treatment-provider-heading-short" aria-label="Anbieter">#</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(buildTreatmentCompactTableRowHtml).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function buildTreatmentCompactTableRowHtml(entry) {
    const treatment = entry.treatment;
    const stats = getTreatmentVoteStats(treatment);
    const name = treatment.behandlung || "Unbenannte Behandlung";
    const detailUrl = buildTreatmentDetailUrl(treatment);
    const providerCount = Number(treatment.provider_count || treatment.provider_total || treatment.provider_count_total || 0);
    const titleHtml = detailUrl
        ? `<a href="${escapeHtml(detailUrl)}">${escapeHtml(name)}</a>`
        : `<strong>${escapeHtml(name)}</strong>`;
    const ratingHtml = stats.totalVotes > 0
        ? `<span class="doctor-detail-treatment-compact-positive">+${stats.positiveRatio}%</span><small>(n=${stats.totalVotes})</small>`
        : `<span class="doctor-detail-treatment-compact-muted">Keine Bewertungen</span>`;

    return `
        <tr>
            <td>${entry.rank}</td>
            <td>
                ${titleHtml}
                <small class="doctor-detail-treatment-compact-category">${escapeHtml(entry.categoryType)}</small>
            </td>
            <td>
                <div class="doctor-detail-treatment-compact-rating">${ratingHtml}</div>
            </td>
            <td>
                <span class="doctor-detail-treatment-provider-badge">${providerCount > 0 ? escapeHtml(providerCount) : "–"}</span>
            </td>
        </tr>
    `;
}

function buildTreatmentTableRowHtml(entry) {
    const treatment = entry.treatment;
    const stats = getTreatmentVoteStats(treatment);
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
                <span class="doctor-detail-treatment-vote-total">${stats.totalVotes}</span>
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

function normalizeGermanSearchValue(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("de-DE")
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss");
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
        setupDoctorDetailStickyHeader();
    }
}

function buildTreatmentCategoryOverviewHtml(groups, visibleEntries) {
    const categoryCards = groups.flatMap(function (group) {
        const groupEntries = visibleEntries.filter(function (entry) {
            return entry.categorySlug === group.slug;
        });
        const subcategoryCounts = new Map();
        let entriesWithoutSubcategory = 0;

        groupEntries.forEach(function (entry) {
            const subcategory = String(entry.treatment?.unterkategorie || "").trim();

            if (subcategory) {
                subcategoryCounts.set(subcategory, (subcategoryCounts.get(subcategory) || 0) + 1);
            } else {
                entriesWithoutSubcategory += 1;
            }
        });

        if (subcategoryCounts.size === 0) {
            return groupEntries.length > 0
                ? [{
                    parent: "",
                    type: group.type,
                    count: groupEntries.length,
                    categorySlug: group.slug,
                    subcategory: null
                }]
                : [];
        }

        const cards = Array.from(subcategoryCounts.entries()).map(function ([subcategory, count]) {
            return {
                parent: group.type,
                type: subcategory,
                count,
                categorySlug: group.slug,
                subcategory
            };
        });

        if (entriesWithoutSubcategory > 0) {
            cards.push({
                parent: group.type,
                type: "Weitere Behandlungen",
                count: entriesWithoutSubcategory,
                categorySlug: group.slug,
                subcategory: ""
            });
        }

        return cards;
    });

    return categoryCards
        .sort(function (a, b) {
            return b.count - a.count || a.type.localeCompare(b.type, "de");
        })
        .map(function (card, index) {
            const treatmentLabel = card.count === 1 ? "Therapie" : "Therapien";
            const sizeClass = index < 2
                ? "is-featured"
                : index < 4
                    ? "is-medium"
                    : "is-compact";
            const themeClass = `is-theme-${(index % 6) + 1}`;
            const parentHtml = card.parent
                ? `<span class="doctor-detail-treatment-category-overview-parent">${escapeHtml(card.parent)}</span>`
                : "";
            const subcategoryAttribute = card.subcategory !== null
                ? ` data-treatment-subcategory="${escapeHtml(card.subcategory)}"`
                : "";

            return `
                <button
                    type="button"
                    class="doctor-detail-treatment-category-overview-card ${sizeClass} ${themeClass} ${card.parent ? "has-subcategory" : ""}"
                    data-treatment-category-card
                    data-treatment-category-slug="${escapeHtml(card.categorySlug)}"
                    ${subcategoryAttribute}
                    aria-label="${escapeHtml(card.type)}: ${card.count} ${treatmentLabel} in der Tabelle anzeigen"
                >
                    <span class="doctor-detail-treatment-category-overview-icon" aria-hidden="true">${getTreatmentCategoryIcon(card.parent || card.type)}</span>
                    <div class="doctor-detail-treatment-category-overview-copy">
                        ${parentHtml}
                        <h4>${escapeHtml(card.type)}</h4>
                        <strong>${card.count}</strong>
                        <span>${treatmentLabel}</span>
                    </div>
                </button>
            `;
        })
        .join("");
}

function renderTreatmentOfferSummary(analysis) {
    const summary = document.getElementById("doctor-detail-treatment-offer-summary");

    if (!summary) {
        return;
    }

    if (!analysis || !analysis.profile || !analysis.ratings) {
        summary.innerHTML = `<span class="doctor-detail-muted">Keine Profilanalyse verfügbar.</span>`;
        return;
    }

    const profile = analysis.profile;
    const specialties = Array.isArray(analysis.specialties) ? analysis.specialties.slice(0, 2) : [];
    const topTreatments = Array.isArray(analysis.ratings.top_treatments) ? analysis.ratings.top_treatments : [];
    const mostRatedTreatments = Array.isArray(analysis.ratings.most_rated_treatments) ? analysis.ratings.most_rated_treatments : [];
    const specialtyCards = specialties.map(function (specialty) {
        return `
            <div class="doctor-detail-analysis-specialty-card">
                <span class="doctor-detail-analysis-specialty-icon" aria-hidden="true"></span>
                <strong>Spezialgebiet: ${escapeHtml(specialty.name)} (${specialty.treatment_count})</strong>
            </div>
        `;
    }).join("");
    const topTreatmentHtml = topTreatments.length > 0
        ? `<ol class="doctor-detail-analysis-top-list">${topTreatments.map(function (treatment, index) {
            return `<li><span class="doctor-detail-analysis-rank" aria-hidden="true">${index + 1}</span><div class="doctor-detail-analysis-entry-copy"><span class="doctor-detail-analysis-treatment-name">${escapeHtml(treatment.name)}</span><span class="doctor-detail-analysis-treatment-meta"><strong>${treatment.positive_ratio} % positiv</strong><i aria-hidden="true">·</i><small>n=${treatment.total_votes}</small></span></div></li>`;
        }).join("")}</ol>`
        : `<span class="doctor-detail-muted">Noch keine bewerteten Behandlungen.</span>`;
    const mostRatedTreatmentHtml = mostRatedTreatments.length > 0
        ? `<ol class="doctor-detail-analysis-top-list is-most-rated">${mostRatedTreatments.map(function (treatment, index) {
            return `<li><span class="doctor-detail-analysis-rank" aria-hidden="true">${index + 1}</span><div class="doctor-detail-analysis-entry-copy"><span class="doctor-detail-analysis-treatment-name">${escapeHtml(treatment.name)}</span><span class="doctor-detail-analysis-treatment-meta"><strong>${treatment.total_votes} Bewertungen</strong><i aria-hidden="true">·</i><small>${treatment.positive_ratio} % positiv</small></span></div></li>`;
        }).join("")}</ol>`
        : `<span class="doctor-detail-muted">Noch keine bewerteten Behandlungen.</span>`;

    summary.removeAttribute("title");
    summary.innerHTML = `
        <div class="doctor-detail-analysis-identity-column">
            <div class="doctor-detail-analysis-section is-profile">
                <span class="doctor-detail-analysis-profile-icon" aria-hidden="true">${getTreatmentAnalysisIcon("profile")}</span>
                <div class="doctor-detail-analysis-profile-copy">
                    <small>Dokumentiertes LCN-Profil</small>
                    <strong>${escapeHtml(profile.label)}</strong>
                    <span>${profile.treatment_count} ${profile.treatment_count === 1 ? "Behandlung" : "Behandlungen"}</span>
                </div>
            </div>
            <div class="doctor-detail-analysis-section is-specialties ${analysis.versatile ? "has-versatile" : ""}">
                <div class="doctor-detail-analysis-versatile-heading">
                    <span class="doctor-detail-analysis-versatile-marker" aria-hidden="true">${getTreatmentAnalysisIcon("specialties")}</span>
                    <div class="doctor-detail-analysis-versatile-copy"><small>Spezialgebiete</small>${analysis.versatile ? `<strong class="doctor-detail-analysis-versatile">Vielseitig</strong>` : ""}</div>
                </div>
                <div class="doctor-detail-analysis-specialty-list">
                    ${specialtyCards || `<span class="doctor-detail-muted">Keine LCN-Spezialgebiete ausgewiesen.</span>`}
                </div>
            </div>
        </div>
        <div class="doctor-detail-analysis-section is-ratings is-positive-ratings ${treatmentAnalysisFilter === "positive" ? "is-filter-active" : ""}" role="button" tabindex="0" data-treatment-analysis-filter="positive" data-treatment-analysis-threshold="${analysis.ratings.positive_threshold}" aria-label="Besonders positiv bewertete Behandlungen in der Tabelle anzeigen">
            <div class="doctor-detail-analysis-rating-heading">
                <span class="doctor-detail-analysis-rating-icon" aria-hidden="true">${getTreatmentAnalysisIcon("positive")}</span>
                <div class="doctor-detail-analysis-rating-copy"><small>Behandlungserfahrungen</small><strong>${analysis.ratings.highly_positive_count} besonders positiv bewertete Behandlungen</strong><span class="doctor-detail-analysis-rating-threshold">(Mindestens ${analysis.ratings.positive_threshold} % positive Erfahrungen)</span></div>
            </div>
            ${topTreatmentHtml}
        </div>
        <div class="doctor-detail-analysis-section is-ratings is-frequent-ratings ${treatmentAnalysisFilter === "frequent" ? "is-filter-active" : ""}" role="button" tabindex="0" data-treatment-analysis-filter="frequent" data-treatment-analysis-threshold="${analysis.ratings.frequent_votes_threshold}" aria-label="Besonders häufig bewertete Behandlungen in der Tabelle anzeigen">
            <div class="doctor-detail-analysis-rating-heading">
                <span class="doctor-detail-analysis-rating-icon" aria-hidden="true">${getTreatmentAnalysisIcon("frequent")}</span>
                <div class="doctor-detail-analysis-rating-copy"><small>Bewertungshäufigkeit</small><strong>${analysis.ratings.frequently_rated_count} besonders häufig bewertete Behandlungen</strong><span class="doctor-detail-analysis-rating-threshold">(Mindestens ${analysis.ratings.frequent_votes_threshold} Bewertungen)</span></div>
            </div>
            ${mostRatedTreatmentHtml}
        </div>
    `;
}

function getSavedDoctorDetailTreatmentView() {
    try { return localStorage.getItem("lcn_result_view_preference") === "cards" ? "cards" : "table"; }
    catch (_) { return "table"; }
}

function updateDoctorDetailVoteSelection(ownVote) {
    const group = document.querySelector('.doctor-detail-vote-buttons');

    if (group) {
        group.classList.toggle('has-selection', Boolean(ownVote));
    }

    document.querySelectorAll('.doctor-detail-vote-main-button').forEach(function (button) {
        const selected = button.getAttribute('data-type') === ownVote;
        const baseLabel = button.getAttribute('data-type') === 'pro'
            ? 'Positiv'
            : (button.getAttribute('data-type') === 'neutral' ? 'Neutral' : 'Negativ');

        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.textContent = selected ? `${baseLabel} ✓` : baseLabel;
    });
}

function getTreatmentAnalysisIcon(type) {
    const icons = {
        profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5"></circle><path d="m9 13-1.5 8 4.5-2.5 4.5 2.5L15 13"></path><path d="m12 5.8 1 2 2.2.3-1.6 1.6.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.6L11 7.8Z"></path></svg>',
        specialties: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"></path></svg>',
        positive: '<svg viewBox="0 0 24 24"><path d="M7 10v10H3V10h4Zm0 9h9.2a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 17.7 8H14l.5-2.5A2.9 2.9 0 0 0 12 2l-5 8v9Z"></path></svg>',
        frequent: '<svg viewBox="0 0 24 24"><path d="M4 20v-8h4v8H4Zm6 0V7h4v13h-4Zm6 0V3h4v17h-4Z"></path></svg>'
    };

    return icons[type] || "";
}

function getTreatmentCategoryIcon(categoryName) {
    const normalized = String(categoryName || "").toLowerCase();

    if (normalized.includes("diagnost")) return "⌕";
    if (normalized.includes("arznei")) return "✚";
    if (normalized.includes("nahrung")) return "⌁";
    if (normalized.includes("bewegung") || normalized.includes("rehabilitation")) return "↗";
    if (normalized.includes("selbstmanagement") || normalized.includes("alltag")) return "◉";
    if (normalized.includes("infusion")) return "◇";
    if (normalized.includes("ernährung") || normalized.includes("diät")) return "♧";
    if (normalized.includes("hilfsmittel")) return "✦";
    if (normalized.includes("verfahren") || normalized.includes("prozedur")) return "⌁";
    if (normalized.includes("coaching") || normalized.includes("beratung")) return "◎";

    return "＋";
}

function setupDoctorDetailStickyHeader() {
    const headerElement = document.querySelector(".doctor-detail-sticky-header");
    const profileElement = document.querySelector(".doctor-detail-profile-card");

    if (!headerElement || !profileElement || headerElement.dataset.stickyInitialized === "true") {
        return;
    }

    headerElement.dataset.stickyInitialized = "true";
    let profileEnd = profileElement.getBoundingClientRect().bottom + window.scrollY;
    let ticking = false;

    const updateStickyState = function () {
        const desktopStickyEnabled = window.matchMedia("(min-width: 1101px)").matches;

        if (!desktopStickyEnabled) {
            headerElement.classList.remove("is-compact-sticky");
            document.documentElement.style.setProperty("--doctor-detail-sticky-offset", "0px");
            return;
        }

        profileEnd = profileElement.getBoundingClientRect().bottom + window.scrollY;
        const isCompact = headerElement.classList.contains("is-compact-sticky");
        const activationPoint = profileEnd;
        const deactivationPoint = profileEnd - 64;

        if (!isCompact && window.scrollY >= activationPoint) {
            headerElement.classList.add("is-compact-sticky");
        } else if (isCompact && window.scrollY <= deactivationPoint) {
            headerElement.classList.remove("is-compact-sticky");
        }

        const stickyOffset = headerElement.classList.contains("is-compact-sticky")
            ? headerElement.offsetHeight
            : 0;
        document.documentElement.style.setProperty("--doctor-detail-sticky-offset", `${stickyOffset}px`);
    };

    const requestStickyUpdate = function () {
        if (ticking) {
            return;
        }

        ticking = true;
        window.requestAnimationFrame(function () {
            updateStickyState();
            ticking = false;
        });
    };

    window.addEventListener("scroll", requestStickyUpdate, { passive: true });

    window.addEventListener("resize", function () {
        headerElement.classList.remove("is-compact-sticky");
        profileEnd = profileElement.getBoundingClientRect().bottom + window.scrollY;
        requestStickyUpdate();
    });

    updateStickyState();
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
