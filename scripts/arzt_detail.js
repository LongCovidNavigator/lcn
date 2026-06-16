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

document.addEventListener("DOMContentLoaded", function () {
    loadDoctorDetail();
    setupDoctorDetailVoteButtons();
    setupTreatmentToggle();
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

        currentDoctorDetail = data.item;
        currentDoctorTerms = data.terms || {
            specialty: [],
            badge: [],
            accessibility: [],
            other: []
        };
        currentDoctorTreatmentsGrouped = data.treatments_grouped || {};
        treatmentSpectrumExpanded = false;
        selectedTreatmentCategorySlugs = new Set();

        renderDoctorDetail(currentDoctorDetail, currentDoctorTerms, currentDoctorTreatmentsGrouped);
        showDoctorDetailContent();

    } catch (error) {
        console.error("Fehler beim Laden des Arzt-Steckbriefs:", error);
        showDoctorDetailError(error.message || "Der Arzt-Steckbrief konnte nicht geladen werden.");
    }
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
    let cleanedName = String(name || "")
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

    if (normalized === "doctor") {
        return "Ärzt:in";
    }

    if (normalized === "physician") {
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

    if (doctor.has_coordinates && doctor.loc_lat && doctor.loc_lng) {
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
    const categoriesElement = document.getElementById("doctor-detail-treatment-categories");
    const summaryElement = document.getElementById("doctor-detail-treatment-summary");
    const toggleButton = document.getElementById("doctor-detail-treatment-toggle");

    if (!listElement) {
        return;
    }

    const groups = getVisibleTreatmentGroups(treatmentsGrouped);

    if (groups.length === 0) {
        listElement.innerHTML = `<span class="doctor-detail-muted">Noch kein Behandlungsspektrum hinterlegt.</span>`;

        if (categoriesElement) {
            categoriesElement.innerHTML = "";
        }

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

    const visibleGroups = getSelectedTreatmentGroups(groups);
    const visibleTreatmentsCount = visibleGroups.reduce(function (sum, group) {
        return sum + group.treatments.length;
    }, 0);

    if (summaryElement) {
        if (selectedTreatmentCategorySlugs.size === 0) {
            summaryElement.textContent = `${totalTreatments} Einträge in ${groups.length} Kategorien.`;
        } else {
            summaryElement.textContent = `${visibleTreatmentsCount} ausgewählte Einträge in ${visibleGroups.length} Kategorien.`;
        }
    }

    renderTreatmentCategoryChips(categoriesElement, groups, totalTreatments);

    if (visibleGroups.length === 0) {
        listElement.innerHTML = `<span class="doctor-detail-muted">Keine Kategorie ausgewählt.</span>`;
        return;
    }

    listElement.innerHTML = visibleGroups
        .map(function (group) {
            const visibleLimit = treatmentSpectrumExpanded ? group.treatments.length : 6;
            const visibleTreatments = group.treatments.slice(0, visibleLimit);
            const hiddenCount = group.treatments.length - visibleTreatments.length;

            const treatmentItems = visibleTreatments
                .map(function (treatment) {
                    return `
                        <li class="doctor-detail-treatment-item">
                            ${escapeHtml(treatment.behandlung || "Unbenannte Behandlung")}
                        </li>
                    `;
                })
                .join("");

            const hiddenText = hiddenCount > 0
                ? `<li class="doctor-detail-treatment-more">+ ${hiddenCount} weitere</li>`
                : "";

            return `
                <section id="doctor-detail-treatment-group-${escapeHtml(group.slug)}" class="doctor-detail-treatment-group">
                    <header class="doctor-detail-treatment-group-header">
                        <h4>${escapeHtml(group.type)}</h4>
                        <span>${group.treatments.length}</span>
                    </header>

                    <ul>
                        ${treatmentItems}
                        ${hiddenText}
                    </ul>
                </section>
            `;
        })
        .join("");

    const hasHiddenTreatments = visibleGroups.some(function (group) {
        return group.treatments.length > 6;
    });

    if (toggleButton) {
        toggleButton.classList.toggle("is-hidden", !hasHiddenTreatments);
        toggleButton.textContent = treatmentSpectrumExpanded
            ? "Details wieder kompakt anzeigen"
            : "Alle Details anzeigen";
    }
}

function renderTreatmentCategoryChips(categoriesElement, groups, totalTreatments) {
    if (!categoriesElement) {
        return;
    }

    const isAllActive = selectedTreatmentCategorySlugs.size === 0;

    const allChipHtml = `
        <button
            type="button"
            class="doctor-detail-treatment-category-chip doctor-detail-treatment-category-all ${isAllActive ? "is-active" : ""}"
            data-treatment-category="__all"
        >
            Alle
            <span>${totalTreatments}</span>
        </button>
    `;

    const categoryChipsHtml = groups
        .map(function (group) {
            const isActive = selectedTreatmentCategorySlugs.has(group.slug);

            return `
                <button
                    type="button"
                    class="doctor-detail-treatment-category-chip ${isActive ? "is-active" : ""}"
                    data-treatment-category="${escapeHtml(group.slug)}"
                >
                    ${escapeHtml(group.type)}
                    <span>${group.treatments.length}</span>
                </button>
            `;
        })
        .join("");

    categoriesElement.innerHTML = allChipHtml + categoryChipsHtml;

    categoriesElement.querySelectorAll("[data-treatment-category]").forEach(function (button) {
        button.addEventListener("click", function () {
            const categorySlug = button.getAttribute("data-treatment-category");

            if (categorySlug === "__all") {
                selectedTreatmentCategorySlugs.clear();
                treatmentSpectrumExpanded = false;
                renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
                return;
            }

            if (selectedTreatmentCategorySlugs.has(categorySlug)) {
                selectedTreatmentCategorySlugs.delete(categorySlug);
            } else {
                selectedTreatmentCategorySlugs.add(categorySlug);
            }

            treatmentSpectrumExpanded = false;
            renderTreatmentSpectrum(currentDoctorTreatmentsGrouped);
        });
    });
}

function getSelectedTreatmentGroups(groups) {
    if (selectedTreatmentCategorySlugs.size === 0) {
        return groups;
    }

    return groups.filter(function (group) {
        return selectedTreatmentCategorySlugs.has(group.slug);
    });
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