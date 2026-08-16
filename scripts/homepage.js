const featuredTreatments = [
    { id: 2, name: "Pacing", icon: "pacing" },
    { id: 1, name: "Low Dose Naltrexone (LDN)", icon: "capsule" },
    { id: 5, name: "Ivabradin", icon: "heart" },
    { id: 169, name: "H1-Antihistaminika", icon: "shield" },
    { id: 3, name: "Pyridostigmin / Mestinon", icon: "neural" },
    { id: 14, name: "Hyperbare Sauerstofftherapie (HBO)", icon: "oxygen" },
    { id: 17, name: "Immunadsorption", icon: "drop" },
    { id: 468, name: "Stellatumblockade (SGB)", icon: "neck" },
    { id: 319, name: "Mikronährstoffe", icon: "leaf" },
    { id: 346, name: "Physiotherapie (angepasst)", icon: "pacing" },
    { id: 176, name: "Atemtherapie", icon: "lungs" }
];

const featuredTreatmentInitialCount = 11;
const featuredTreatmentAdditionalCount = 40;

document.addEventListener("DOMContentLoaded", loadFeaturedTreatments);

async function loadFeaturedTreatments() {
    const list = document.getElementById("featured-treatments-list");
    const moreButton = document.getElementById("featured-treatments-more");
    if (!list || !moreButton) return;

    try {
        const ids = featuredTreatments.map(function (treatment) { return treatment.id; }).join(",");
        const responses = await Promise.all([
            fetch(`api/treatments_search.php?treat_ids=${encodeURIComponent(ids)}&sort=name&direction=asc`),
            fetch("api/treatments_search.php?sort=total_votes&direction=desc&limit=60")
        ]);
        const data = await responses[0].json();
        const additionalData = await responses[1].json();
        if (!responses[0].ok || !data.ok || !responses[1].ok || !additionalData.ok) {
            throw new Error(data.message || additionalData.message || "Daten konnten nicht geladen werden.");
        }

        const treatmentsById = new Map((data.items || []).map(function (item) {
            return [Number(item.treat_id), item];
        }));

        const editorialIds = new Set(featuredTreatments.map(function (treatment) { return treatment.id; }));
        const additionalTreatments = (additionalData.items || [])
            .filter(function (treatment) { return !editorialIds.has(Number(treatment.treat_id)); })
            .slice(0, featuredTreatmentAdditionalCount)
            .map(function (treatment) {
                return {
                    id: Number(treatment.treat_id),
                    name: treatment.behandlung || "Behandlung",
                    icon: getFeaturedTreatmentIconName(treatment.typ),
                    data: treatment
                };
            });
        const displayedTreatments = featuredTreatments.concat(additionalTreatments);

        list.innerHTML = displayedTreatments.map(function (editorialTreatment, index) {
            const treatment = treatmentsById.get(editorialTreatment.id) || {};
            return buildFeaturedTreatmentHtml(editorialTreatment, editorialTreatment.data || treatment, index);
        }).join("");

        moreButton.hidden = displayedTreatments.length <= featuredTreatmentInitialCount;
        moreButton.addEventListener("click", function () {
            const expanded = moreButton.getAttribute("aria-expanded") === "true";
            moreButton.setAttribute("aria-expanded", String(!expanded));
            moreButton.textContent = expanded ? "Weitere anzeigen" : "Weniger anzeigen";
            list.classList.toggle("is-expanded", !expanded);
        });
    } catch (error) {
        console.error("Behandlungen für die Startseite konnten nicht geladen werden:", error);
        list.innerHTML = '<p class="featured-treatments-status">Die Behandlungen konnten gerade nicht geladen werden.</p>';
    }
}

function buildFeaturedTreatmentHtml(editorialTreatment, treatment, index) {
    const type = escapeHomepageHtml(treatment.typ || "Typ nicht angegeben");
    const detailHref = `therapie_detail.html?treat_id=${encodeURIComponent(editorialTreatment.id)}`;
    return `
        <article class="featured-treatment${index < 3 ? " is-featured" : " is-compact"}${index >= featuredTreatmentInitialCount ? " is-treatment-extra" : ""}">
            <span class="featured-treatment-rank" aria-label="Position ${index + 1}">${index + 1}</span>
            <span class="featured-treatment-icon featured-treatment-icon-${editorialTreatment.icon}" aria-hidden="true">
                ${getFeaturedTreatmentIcon(editorialTreatment.icon)}
            </span>
            <div class="featured-treatment-main">
                <h3><a href="${detailHref}">${escapeHomepageHtml(editorialTreatment.name)}</a></h3>
                <span class="featured-treatment-type">${type}</span>
                <div class="featured-treatment-votes"
                     aria-label="Bewertungen: ${Number(treatment.pro || 0)} positiv, ${Number(treatment.neutral || 0)} neutral, ${Number(treatment.contra || 0)} negativ">
                    ${buildFeaturedTreatmentVote("pro", "Positiv", treatment.pro)}
                    ${buildFeaturedTreatmentVote("neutral", "Neutral", treatment.neutral)}
                    ${buildFeaturedTreatmentVote("contra", "Negativ", treatment.contra)}
                </div>
            </div>
        </article>`;
}

function getFeaturedTreatmentIconName(type) {
    const normalizedType = String(type || "").toLocaleLowerCase("de-DE");
    if (normalizedType.includes("arzneimittel")) return "capsule";
    if (normalizedType.includes("bewegung") || normalizedType.includes("rehabilitation")) return "pacing";
    if (normalizedType.includes("nahrung") || normalizedType.includes("ernährung") || normalizedType.includes("pflanz")) return "leaf";
    if (normalizedType.includes("prozedur") || normalizedType.includes("gerät")) return "oxygen";
    return "neural";
}

function buildFeaturedTreatmentVote(type, label, count) {
    return `<span class="featured-treatment-vote featured-treatment-vote-${type}" title="${label}">
        ${getVoteIcon(type)}<span class="visually-hidden">${label}: </span><strong>${Number(count || 0)}</strong>
    </span>`;
}

function getFeaturedTreatmentIcon(icon) {
    const icons = {
        pacing: '<svg viewBox="0 0 32 32"><circle cx="17" cy="6" r="3"/><path d="m13 13 5-3 4 5 5 1M16 12l-2 7-5 7M14 19l7 6"/></svg>',
        capsule: '<svg viewBox="0 0 32 32"><path d="M9 25a6 6 0 0 1 0-8l8-8a6 6 0 1 1 8 8l-8 8a6 6 0 0 1-8 0Z"/><path d="m13 13 8 8"/></svg>',
        heart: '<svg viewBox="0 0 32 32"><path d="M16 26S5 20 5 12a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 8-11 14-11 14Z"/><path d="m9 16 4-1 2-4 3 8 2-3h4"/></svg>',
        shield: '<svg viewBox="0 0 32 32"><path d="M16 4 26 8v7c0 6-4 10-10 13C10 25 6 21 6 15V8Z"/><path d="M12 16h8M16 12v8"/></svg>',
        neural: '<svg viewBox="0 0 32 32"><circle cx="8" cy="17" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="24" cy="14" r="2"/><circle cx="19" cy="25" r="2"/><path d="m10 16 4-7m4-1 5 5m0 3-3 7m-3 1-7-6m1-2 11-2"/></svg>',
        oxygen: '<svg viewBox="0 0 32 32"><circle cx="11" cy="20" r="5"/><circle cx="21" cy="10" r="4"/><circle cx="24" cy="23" r="3"/><circle cx="9" cy="8" r="2"/></svg>',
        drop: '<svg viewBox="0 0 32 32"><path d="M16 4S8 14 8 20a8 8 0 0 0 16 0C24 14 16 4 16 4Z"/><path d="M12 21c.5 2 2 3 4 3"/></svg>',
        neck: '<svg viewBox="0 0 32 32"><path d="M12 5c-4 3-4 9 0 12v7l-4 3M20 5c4 3 4 9 0 12v7l4 3M12 17c2 2 6 2 8 0M16 9v9"/></svg>',
        leaf: '<svg viewBox="0 0 32 32"><path d="M26 6C15 6 8 11 8 20c0 4 3 6 6 6 9 0 12-9 12-20Z"/><path d="M7 27c4-7 9-11 15-15"/></svg>',
        lungs: '<svg viewBox="0 0 32 32"><path d="M15 5v11M17 5v11M14 13c-3 0-4 2-5 5l-2 7c4 2 8 0 8-5M18 13c3 0 4 2 5 5l2 7c-4 2-8 0-8-5"/></svg>'
    };
    return icons[icon] || icons.capsule;
}

const featuredExperts = [
    ["Dr. Michael Stingl", "AT", "Wien"],
    ["Prof. Dr. Carmen Scheibenbogen", "DE", "Berlin"],
    ["Dr. Michael Kacik", "DE", "Münster"],
    ["Dr. Beate Jaeger", "DE", "Deutschland"],
    ["Dr. Maja Strasser", "CH", "Solothurn"],
    ["PD Dr. Dr. Bettina Hohberger", "DE", "Erlangen"],
    ["Prof. Dr. Uta Behrends", "DE", "München"],
    ["Dr. Herbert Renz-Polster", "DE", "Deutschland"],
    ["Dr. Kristina Schultheiß", "DE", "Immenstadt / online"],
    ["Dr. Astrid Weber", "DE", "Koblenz"],
    ["Dr. Kirsten Wittke", "DE", "Berlin"],
    ["Dr. Judith Bellmann-Strobl", "DE", "Berlin"],
    ["Prof. Dr. Gabriela Riemekasten", "DE", "Lübeck"],
    ["Prof. Dr. Andreas Stallmach", "DE", "Jena"],
    ["Dr. Kai Störring", "DE", "Köln"],
    ["Dr. Thomas B. Fischer", "DE", "Düsseldorf"],
    ["Dr. Christian Gogoll", "DE", "Berlin"],
    ["Prof. Dr. Michael Stark", "DE", "Hamburg"],
    ["Dr. Bodo Kuklinski", "DE", "Rostock"],
    ["Dr. Gregory Fretz", "CH", "Chur"],
    ["Prof. Dr. Kathryn Hoffmann", "AT", "Wien"],
    ["Prof. Dr. Eva Untersmayr-Elsenhuber", "AT", "Wien"],
    ["Dr. Katharina Millesi", "AT", "Wien"],
    ["Dr. Christoph Lisch", "AT", "Tirol"],
    ["Dr. Cordula Warlitz", "DE", "München"],
    ["Dr. Daniel Vilser", "DE", "Jena"],
    ["Dr. Sylvia Grotjohann", "DE", "Berlin"],
    ["Dr. Ruth Biallowons", "DE", "Düsseldorf"],
    ["Dr. Anke Risse", "DE", "Berlin"],
    ["Dr. Anja Oelke", "DE", "Halle (Saale)"],
    ["Dr. Paolo Contin", "CH", "Binningen"],
    ["Dr. Florian Strasser", "CH", "Schaffhausen"],
    ["Apheresis Center Cyprus", "CY", "Larnaca"],
    ["Dr. Michael Wittke", "DE", "Celle"],
    ["Dr. Stefan Pieper", "DE", "Konstanz"],
    ["Dr. Wilfried Bieger", "DE", "München"],
    ["Dr. Jacqueline Metzner", "DE", "Überlingen"],
    ["Dr. Sophia Wachner", "DE", "München"]
];

document.addEventListener("DOMContentLoaded", loadFeaturedExperts);

async function loadFeaturedExperts() {
    const list = document.getElementById("featured-experts-list");
    const moreButton = document.getElementById("featured-experts-more");
    if (!list || !moreButton) return;

    let doctors = [];

    try {
        const response = await fetch("api/doctors_search.php?lat=51.1657&lng=10.4515&radiusKm=all&includeNoCoords=1");
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "Daten konnten nicht geladen werden.");
        doctors = Array.isArray(data.items) ? data.items : [];
    } catch (error) {
        // Die feste redaktionelle Liste bleibt auch ohne Datenbank-Anreicherung vollständig sichtbar.
        console.warn("Datenbank-Anreicherung der Expert:innen-Liste nicht verfügbar:", error);
    }

    const editorialList = featuredExperts.map(function (entry) {
        const matchedDoctor = doctors.find(function (doctor) {
            return normalizeExpertName(doctor.dr_display_name) === normalizeExpertName(entry[0]);
        });

        return Object.assign({}, matchedDoctor || {}, {
            dr_display_name: entry[0],
            editorial_flag: entry[1],
            editorial_location: entry[2],
            editorial_fallback: !matchedDoctor
        });
    });

    const initialEntries = editorialList.slice(0, 11);
    const longlist = editorialList.slice(11);
    list.innerHTML = buildFeaturedExpertsHtml(initialEntries, 0, false);
    moreButton.hidden = false;
    list.addEventListener("click", handleFeaturedExpertVote);

    moreButton.addEventListener("click", function () {
        const isExpanded = moreButton.getAttribute("aria-expanded") === "true";

        if (isExpanded) {
            list.querySelectorAll(".featured-expert.is-longlist").forEach(function (card) { card.remove(); });
        } else {
            list.insertAdjacentHTML("beforeend", buildFeaturedExpertsHtml(longlist, initialEntries.length, true));
        }

        moreButton.setAttribute("aria-expanded", String(!isExpanded));
        moreButton.querySelector("span:first-child").textContent = isExpanded ? "Weitere anzeigen" : "Weniger anzeigen";
        moreButton.classList.toggle("is-expanded", !isExpanded);
    });
}

function buildFeaturedExpertsHtml(doctors, rankOffset, isLonglist) {
    return doctors.map(function (doctor, index) {
        const rank = rankOffset + index + 1;
        const classes = ["featured-expert", rank <= 3 ? "is-featured" : "is-compact"];
        if (isLonglist) classes.push("is-longlist");

        const name = escapeHomepageHtml(doctor.dr_display_name || "");
        const institution = escapeHomepageHtml(doctor.loc_label || doctor.dr_org_name || doctor.specialty_labels || "");
        const location = `${getCountryFlag(doctor.editorial_flag)}<span>${escapeHomepageHtml(doctor.editorial_location)}</span>`;
        const initials = getExpertInitials(doctor);
        const ownVote = ["pro", "neutral", "contra"].includes(doctor.own_vote) ? doctor.own_vote : "";
        const votes = doctor.dr_id ? `
            <div class="featured-expert-votes${ownVote ? " has-selection" : ""}"
                 aria-label="Bewertung: ${Number(doctor.pro || 0)} positiv, ${Number(doctor.neutral || 0)} neutral, ${Number(doctor.contra || 0)} negativ"
                 data-own-vote="${ownVote}">
                ${buildFeaturedVoteButton(doctor.dr_id, "pro", "Positiv", doctor.pro, ownVote)}
                ${buildFeaturedVoteButton(doctor.dr_id, "neutral", "Neutral", doctor.neutral, ownVote)}
                ${buildFeaturedVoteButton(doctor.dr_id, "contra", "Negativ", doctor.contra, ownVote)}
            </div>` : "";
        const profileHref = doctor.dr_id
            ? `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`
            : `aerzte_karte.html?search=${encodeURIComponent(doctor.dr_display_name || "")}`;

        return `
            <article class="${classes.join(" ")}"${doctor.editorial_fallback ? ' data-profile-match="missing"' : ""}>
                <span class="featured-expert-rank" aria-label="Redaktionelle Reihenfolge ${rank}">${String(rank).padStart(2, "0")}</span>
                <span class="featured-expert-avatar" aria-hidden="true">${escapeHomepageHtml(initials)}</span>
                <div class="featured-expert-main">
                    <div class="featured-expert-title-row">
                        <h3><a href="${profileHref}">${name}</a></h3>
                        <span class="featured-expert-location">${location}</span>
                    </div>
                    ${institution ? `<p>${institution}</p>` : ""}
                    <div class="featured-expert-footer">
                        ${votes}
                    </div>
                </div>
            </article>`;
    }).join("");
}

function normalizeExpertName(value) {
    return String(value || "")
        .toLocaleLowerCase("de-DE")
        .replace(/\b(?:prof|pd|dr)\.?\b/g, " ")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9äöü]/g, "");
}

function getExpertInitials(doctor) {
    const parts = [doctor.dr_firstname, doctor.dr_lastname].filter(Boolean);
    const source = parts.length ? parts : String(doctor.dr_display_name || "").split(/\s+/).filter(function (part) {
        return !/^(prof|pd|dr)$/i.test(part.replace(/\./g, ""));
    });
    const relevant = source.length > 1 ? [source[0], source[source.length - 1]] : source;
    return relevant.map(function (part) { return part.charAt(0); }).join("").toLocaleUpperCase("de-DE");
}

function getCountryFlag(countryCode) {
    const flags = {
        DE: '<svg class="featured-country-flag" viewBox="0 0 18 12" aria-hidden="true"><path fill="#171717" d="M0 0h18v4H0z"/><path fill="#d71920" d="M0 4h18v4H0z"/><path fill="#f6c800" d="M0 8h18v4H0z"/></svg>',
        AT: '<svg class="featured-country-flag" viewBox="0 0 18 12" aria-hidden="true"><path fill="#ed2939" d="M0 0h18v12H0z"/><path fill="#fff" d="M0 4h18v4H0z"/></svg>',
        CH: '<svg class="featured-country-flag" viewBox="0 0 18 12" aria-hidden="true"><path fill="#d52b1e" d="M0 0h18v12H0z"/><path fill="#fff" d="M7.5 2h3v8h-3z"/><path fill="#fff" d="M5 4.5h8v3H5z"/></svg>',
        CY: '<svg class="featured-country-flag" viewBox="0 0 18 12" aria-hidden="true"><path fill="#fff" d="M0 0h18v12H0z"/><path fill="#d57800" d="m5 5 3-2 5 2-2 2H7z"/><path fill="none" stroke="#4f7942" stroke-width=".8" d="M6 8c2 1 4 1 6 0"/></svg>'
    };
    return flags[countryCode] || "";
}

function buildFeaturedVoteButton(drId, type, label, count, ownVote) {
    const isSelected = ownVote === type;
    return `
        <button type="button"
                class="featured-vote-button featured-vote-${type}${isSelected ? " is-selected" : ""}"
                data-dr-id="${Number(drId)}" data-type="${type}" aria-pressed="${isSelected}"
                aria-label="${label}: ${Number(count || 0)} Stimmen">
            ${getVoteIcon(type)}
            <strong>${Number(count || 0)}</strong>
        </button>`;
}

function getVoteIcon(type) {
    if (type === "neutral") {
        return '<svg class="featured-vote-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M7 8h.01M13 8h.01M7.2 12.5h5.6"/></svg>';
    }

    const transform = type === "contra" ? ' transform="translate(0 20) scale(1 -1)"' : "";
    return `<svg class="featured-vote-icon" viewBox="0 0 20 20" aria-hidden="true"><g${transform}><path d="M7.5 8.2 10 3.5c.5-.9 1.8-.5 1.7.5l-.3 3h3.2c1.2 0 2 .9 1.7 2l-1 5c-.2.8-.8 1.3-1.6 1.3H7.5zM4 8.2h3.5v7.1H4z"/></g></svg>`;
}

async function handleFeaturedExpertVote(event) {
    const button = event.target.closest(".featured-vote-button");
    if (!button) return;

    const group = button.closest(".featured-expert-votes");
    const drId = Number(button.dataset.drId);
    const voteType = button.dataset.type;
    if (!group || !drId || !["pro", "neutral", "contra"].includes(voteType)) return;

    const buttons = group.querySelectorAll(".featured-vote-button");
    buttons.forEach(function (item) {
        item.disabled = true;
        item.classList.add("is-saving");
    });

    try {
        const response = await fetch("api/inc_doctor_votes.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dr_id: drId, type: voteType })
        });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok || !data.ok) throw new Error(data.error || "Vote konnte nicht gespeichert werden.");

        const previousVote = group.dataset.ownVote || "";
        if (data.changed) {
            if (previousVote) updateFeaturedVoteCount(group, previousVote, -1);
            updateFeaturedVoteCount(group, voteType, 1);
        }

        group.dataset.ownVote = voteType;
        group.classList.add("has-selection");
        buttons.forEach(function (item) {
            const selected = item.dataset.type === voteType;
            item.classList.toggle("is-selected", selected);
            item.setAttribute("aria-pressed", String(selected));
        });
    } catch (error) {
        console.error("Fehler beim Speichern der Startseitenbewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden.");
    } finally {
        buttons.forEach(function (item) {
            item.disabled = false;
            item.classList.remove("is-saving");
        });
    }
}

function updateFeaturedVoteCount(group, type, difference) {
    const count = group.querySelector(`.featured-vote-${type} strong`);
    if (!count) return;
    count.textContent = String(Math.max(0, Number(count.textContent || 0) + difference));
}

function escapeHomepageHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value || "");
    return element.innerHTML;
}
