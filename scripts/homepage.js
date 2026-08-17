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

const featuredTreatmentInitialCount = 10;
const featuredTreatmentAdditionalCount = 40;
const featuredTreatmentDataById = new Map();

document.addEventListener("DOMContentLoaded", loadFeaturedTreatments);
window.addEventListener("homepage:location-changed", loadFeaturedTreatments);

async function loadFeaturedTreatments() {
    const list = document.getElementById("featured-treatments-list");
    const moreButton = document.getElementById("featured-treatments-more");
    if (!list) return;
    const initialCount = Math.max(1, Number(list.dataset.initialCount || featuredTreatmentInitialCount));
    const teaserMode = list.dataset.listMode === "teaser";
    const fullViewSwitch = list.dataset.fullViewSwitch === "true";

    try {
        const ids = featuredTreatments.map(function (treatment) { return treatment.id; }).join(",");
        const locationQuery = buildHomepageLocationQuery();
        const responses = await Promise.all([
            fetch(`api/treatments_search.php?treat_ids=${encodeURIComponent(ids)}&sort=name&direction=asc${locationQuery}`),
            fetch(`api/treatments_search.php?sort=total_votes&direction=desc&limit=60${locationQuery}`)
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

        const enrichedTreatments = displayedTreatments.map(function (editorialTreatment) {
            const entry = {
                editorial: editorialTreatment,
                data: editorialTreatment.data || treatmentsById.get(editorialTreatment.id) || {}
            };
            featuredTreatmentDataById.set(Number(editorialTreatment.id), entry.data);
            return entry;
        });
        const initialTreatments = enrichedTreatments.slice(0, initialCount);
        if (fullViewSwitch) {
            const viewButtons = document.querySelectorAll("[data-featured-treatment-view]");
            const renderFullView = function (view) {
                const mode = view === "table" ? "table" : "cards";
                const viewSwitch = viewButtons[0]?.closest(".featured-page-view-switch");
                viewSwitch?.remove();
                saveSharedViewPreference(mode);
                list.classList.toggle("is-card-mode", mode === "cards");
                list.classList.toggle("is-table-mode", mode === "table");
                list.innerHTML = mode === "cards"
                    ? buildFeaturedTreatmentGridHtml(initialTreatments)
                    : buildFeaturedTreatmentTableOnlyHtml(initialTreatments);
                const remainingGroup = list.querySelector(".featured-ranking-group.is-rest");
                if (viewSwitch && remainingGroup) remainingGroup.insertBefore(viewSwitch, remainingGroup.children[1] || null);
                viewButtons.forEach(function (button) {
                    button.classList.toggle("is-active", button.dataset.featuredTreatmentView === mode);
                    button.setAttribute("aria-pressed", String(button.dataset.featuredTreatmentView === mode));
                });
            };
            viewButtons.forEach(function (button) {
                button.addEventListener("click", function () { renderFullView(button.dataset.featuredTreatmentView); });
            });
            renderFullView(getSharedViewPreference());
        } else {
            list.innerHTML = teaserMode
                ? buildTreatmentTeaserHtml(initialTreatments)
                : buildFeaturedTreatmentsHtml(initialTreatments);
        }
        if (!list.dataset.voteBound) {
            list.addEventListener("click", handleFeaturedTreatmentVote);
            list.dataset.voteBound = "true";
        }

        if (!moreButton) return;
        moreButton.hidden = teaserMode || displayedTreatments.length <= initialCount;
        moreButton.onclick = function () {
            const expanded = moreButton.getAttribute("aria-expanded") === "true";
            moreButton.setAttribute("aria-expanded", String(!expanded));
            moreButton.textContent = expanded ? "Weitere anzeigen" : "Weniger anzeigen";
            const tableBody = list.querySelector(".featured-treatments-table tbody");
            if (expanded) {
                list.querySelectorAll(".featured-treatment-table-row.is-treatment-extra").forEach(function (row) { row.remove(); });
            } else if (tableBody) {
                tableBody.insertAdjacentHTML("beforeend", buildFeaturedTreatmentTableRowsHtml(
                    enrichedTreatments.slice(initialCount),
                    initialCount,
                    true
                ));
            }
        };
    } catch (error) {
        console.error("Behandlungen für die Startseite konnten nicht geladen werden:", error);
        list.innerHTML = '<p class="featured-treatments-status">Die Behandlungen konnten gerade nicht geladen werden.</p>';
    }
}

function buildTreatmentTeaserHtml(treatments) {
    return `<ol class="compact-ranking-list">${treatments.map(function (entry) {
        const treatment = entry.data || {};
        const total = Number(treatment.total_votes || 0);
        const ratio = treatment.positive_ratio !== undefined
            ? Math.round(Number(treatment.positive_ratio || 0))
            : total ? Math.round((Number(treatment.pro || 0) / total) * 100) : 0;
        return `<li><a href="therapie_detail.html?treat_id=${encodeURIComponent(entry.editorial.id)}">${escapeHomepageHtml(entry.editorial.name)}</a><span class="compact-experience" aria-label="${ratio} Prozent positive Erfahrungen">+${ratio}%</span></li>`;
    }).join("")}</ol>`;
}

function buildFeaturedTreatmentGridHtml(treatments) {
    const topEntries = treatments.slice(0, 3);
    const remainingEntries = treatments.slice(3);
    return `<section class="featured-ranking-group is-top"><h3>Top 3 Behandlungen</h3><div class="featured-ranking-card-grid">${buildFeaturedTreatmentCardsHtml(topEntries, 0)}</div></section><section class="featured-ranking-group is-rest"><h3>Weitere Behandlungen</h3><div class="featured-ranking-card-grid">${buildFeaturedTreatmentCardsHtml(remainingEntries, 3)}</div></section>`;
}

function buildFeaturedTreatmentCardsHtml(treatments, rankOffset) {
    return treatments.map(function (entry, index) {
        return buildFeaturedTreatmentHtml(entry.editorial, entry.data, rankOffset + index);
    }).join("");
}

function buildFeaturedTreatmentTableOnlyHtml(treatments) {
    const topEntries = treatments.slice(0, 3);
    const tableEntries = treatments.slice(3);
    return `<section class="featured-ranking-group is-top"><h3>Top 3 Behandlungen</h3><div class="featured-ranking-card-grid">${buildFeaturedTreatmentCardsHtml(topEntries, 0)}</div></section><section class="featured-ranking-group is-rest"><h3>Weitere Behandlungen</h3><div class="featured-treatments-table-wrap"><table class="featured-treatments-table"><thead><tr><th scope="col">Platz</th><th scope="col">Behandlung</th><th scope="col">Kategorie</th><th scope="col">Erfahrung <span class="featured-treatment-table-header-note">(n = Votes)</span></th><th scope="col">Anbieter gesamt</th><th scope="col">Entfernung / Ort</th></tr></thead><tbody>${buildFeaturedTreatmentTableRowsHtml(tableEntries, 3, false)}</tbody></table></div></section>`;
}

function buildFeaturedTreatmentsHtml(treatments) {
    const cardsHtml = treatments.slice(0, 3).map(function (entry, index) {
        return buildFeaturedTreatmentHtml(entry.editorial, entry.data, index);
    }).join("");
    const tableEntries = treatments.slice(3);
    if (!tableEntries.length) return cardsHtml;

    return `${cardsHtml}
        <div class="featured-treatments-table-wrap">
            <table class="featured-treatments-table">
                <thead><tr>
                    <th scope="col">Platz</th>
                    <th scope="col">Therapie</th>
                    <th scope="col">Kategorie</th>
                    <th scope="col">Erfahrung <span class="featured-treatment-table-header-note">(n = Votes)</span></th>
                    <th scope="col">Anbieter gesamt</th>
                    <th scope="col">Entfernung / Ort</th>
                </tr></thead>
                <tbody>${buildFeaturedTreatmentTableRowsHtml(tableEntries, 3, false)}</tbody>
            </table>
        </div>`;
}

function buildFeaturedTreatmentTableRowsHtml(treatments, rankOffset, isExtra) {
    return treatments.map(function (entry, index) {
        const treatment = entry.data || {};
        const name = escapeHomepageHtml(entry.editorial.name || treatment.behandlung || "Behandlung");
        const href = `therapie_detail.html?treat_id=${encodeURIComponent(entry.editorial.id)}`;
        const category = String(treatment.typ || "").trim();
        const providerCount = Number(treatment.provider_count || 0);
        const distance = treatment.nearest_provider_distance_km;
        const city = treatment.nearest_provider && treatment.nearest_provider.loc_city
            ? escapeHomepageHtml(treatment.nearest_provider.loc_city)
            : "";
        const locationHtml = distance !== null && distance !== undefined && distance !== ""
            ? `<strong>${formatFeaturedTreatmentDistance(distance)}</strong>${city ? `<small>${city}</small>` : ""}`
            : city ? `<small>${city}</small>` : '<span class="featured-treatment-table-muted">—</span>';

        return `<tr class="featured-treatment-table-row${isExtra ? " is-treatment-extra" : ""}">
            <td class="featured-treatment-table-rank">${rankOffset + index + 1}</td>
            <td class="featured-treatment-table-name"><a href="${href}">${name}</a></td>
            <td>${category ? `<span class="featured-treatment-table-badge">${escapeHomepageHtml(category)}</span>` : '<span class="featured-treatment-table-muted">—</span>'}</td>
            <td>${buildFeaturedTreatmentTableExperienceHtml(treatment)}</td>
            <td><span class="featured-treatment-provider-bubble${providerCount ? "" : " is-empty"}">${providerCount}</span></td>
            <td><span class="featured-treatment-table-location">${locationHtml}</span></td>
        </tr>`;
    }).join("");
}

function buildFeaturedTreatmentTableExperienceHtml(treatment) {
    const pro = Number(treatment.pro || 0);
    const neutral = Number(treatment.neutral || 0);
    const contra = Number(treatment.contra || 0);
    const total = Number(treatment.total_votes || (pro + neutral + contra));
    const positiveRatio = treatment.positive_ratio !== undefined ? Number(treatment.positive_ratio) : total ? Math.round((pro / total) * 100) : 0;
    const neutralRatio = treatment.neutral_ratio !== undefined ? Number(treatment.neutral_ratio) : total ? Math.round((neutral / total) * 100) : 0;
    const negativeRatio = treatment.negative_ratio !== undefined ? Number(treatment.negative_ratio) : total ? Math.round((contra / total) * 100) : 0;
    const ownVote = ["pro", "neutral", "contra"].includes(treatment.own_vote) ? treatment.own_vote : "";
    return `<span class="featured-treatment-table-experience">
        ${buildFeaturedTreatmentTableVoteButton(treatment, "pro", "+", positiveRatio, "is-positive", ownVote)}
        ${buildFeaturedTreatmentTableVoteButton(treatment, "neutral", "=", neutralRatio, "is-neutral", ownVote)}
        ${buildFeaturedTreatmentTableVoteButton(treatment, "contra", "−", negativeRatio, "is-negative", ownVote)}
        <small>(n=${total})</small>
    </span>`;
}

function buildFeaturedTreatmentTableVoteButton(treatment, type, prefix, ratio, className, ownVote) {
    const selected = ownVote === type;
    return `<button type="button" class="${className} featured-treatment-vote-button${selected ? " is-selected" : ""}"
        data-treat-id="${Number(treatment.treat_id)}" data-type="${type}" aria-pressed="${selected}"
        aria-label="${type === "pro" ? "Positive" : type === "neutral" ? "Neutrale" : "Negative"} Erfahrung: ${ratio} Prozent. Jetzt abstimmen">${prefix}${ratio}%</button>`;
}

function formatFeaturedTreatmentDistance(value) {
    const distance = Number(value);
    if (!Number.isFinite(distance)) return "—";
    return `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} km`.replace(".", ",");
}

function buildFeaturedTreatmentHtml(editorialTreatment, treatment, index) {
    const type = escapeHomepageHtml(treatment.typ || "Typ nicht angegeben");
    const detailHref = `therapie_detail.html?treat_id=${encodeURIComponent(editorialTreatment.id)}`;
    const providerCount = Number(treatment.provider_count || 0);
    const distance = treatment.nearest_provider_distance_km;
    const city = treatment.nearest_provider?.loc_city || "";
    const totalVotes = Number(treatment.total_votes || (Number(treatment.pro || 0) + Number(treatment.neutral || 0) + Number(treatment.contra || 0)));
    return `
        <article class="featured-treatment is-featured">
            <span class="featured-treatment-rank" aria-label="Position ${index + 1}">${index + 1}</span>
            <div class="featured-treatment-main">
                <div class="featured-treatment-card-header">
                    <h3><a href="${detailHref}">${escapeHomepageHtml(editorialTreatment.name)}</a></h3>
                </div>
                <div class="featured-treatment-card-facts">
                    <span><small>Kategorie</small><strong>${type}</strong></span>
                    <span><small>Anbieter</small><strong>${providerCount}</strong></span>
                    <span><small>Entfernung / Ort</small><strong>${distance !== null && distance !== undefined ? formatFeaturedTreatmentDistance(distance) : "—"}</strong>${city ? `<em>${escapeHomepageHtml(city)}</em>` : ""}</span>
                </div>
                <div class="featured-treatment-votes"
                     aria-label="Bewertungen: ${Number(treatment.pro || 0)} positiv, ${Number(treatment.neutral || 0)} neutral, ${Number(treatment.contra || 0)} negativ">
                    ${buildFeaturedTreatmentVote(editorialTreatment.id, "pro", "Positiv", treatment.pro, treatment.own_vote, totalVotes)}
                    ${buildFeaturedTreatmentVote(editorialTreatment.id, "neutral", "Neutral", treatment.neutral, treatment.own_vote, totalVotes)}
                    ${buildFeaturedTreatmentVote(editorialTreatment.id, "contra", "Negativ", treatment.contra, treatment.own_vote, totalVotes)}
                    <span class="featured-treatment-card-vote-count">(n=${totalVotes})</span>
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

function buildFeaturedTreatmentVote(treatId, type, label, count, ownVote, totalVotes) {
    const selected = ownVote === type;
    const ratio = totalVotes ? Math.round((Number(count || 0) / totalVotes) * 100) : 0;
    return `<button type="button" class="featured-treatment-vote featured-treatment-vote-button featured-treatment-vote-${type}${selected ? " is-selected" : ""}"
        data-treat-id="${Number(treatId)}" data-type="${type}" aria-pressed="${selected}" title="${label}" aria-label="${label}: ${Number(count || 0)}. Jetzt abstimmen">
        <span>${label}</span><strong>${type === "pro" ? "+" : type === "neutral" ? "=" : "−"}${ratio}%</strong>
    </button>`;
}

async function handleFeaturedTreatmentVote(event) {
    const button = event.target.closest(".featured-treatment-vote-button");
    if (!button) return;
    const treatId = Number(button.dataset.treatId || 0);
    const type = button.dataset.type || "";
    const container = button.closest(".featured-treatment, tr");
    const buttons = container ? container.querySelectorAll(".featured-treatment-vote-button") : [button];
    if (!treatId || !["pro", "neutral", "contra"].includes(type)) return;

    buttons.forEach(function (item) { item.disabled = true; item.classList.add("is-saving"); });
    try {
        const response = await fetch("api/inc_votes_db.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ treat_id: treatId, type: type })
        });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.message || "Bewertung konnte nicht gespeichert werden.");

        const refreshed = await fetch(`api/treatments_search.php?treat_id=${encodeURIComponent(treatId)}`);
        const data = await refreshed.json();
        if (!refreshed.ok || !data.ok || !Array.isArray(data.items) || !data.items[0]) throw new Error("Bewertung konnte nicht aktualisiert werden.");
        const treatment = Object.assign({}, data.items[0], { own_vote: result.vote || null });
        const cachedTreatment = featuredTreatmentDataById.get(treatId);
        if (cachedTreatment) Object.assign(cachedTreatment, treatment);
        const row = button.closest("tr");
        if (row) {
            const cell = button.closest("td");
            if (cell) cell.innerHTML = buildFeaturedTreatmentTableExperienceHtml(treatment);
        } else {
            const voteGroup = button.closest(".featured-treatment-votes");
            if (voteGroup) {
                const totalVotes = Number(treatment.total_votes || (Number(treatment.pro || 0) + Number(treatment.neutral || 0) + Number(treatment.contra || 0)));
                voteGroup.innerHTML = [
                    buildFeaturedTreatmentVote(treatId, "pro", "Positiv", treatment.pro, treatment.own_vote, totalVotes),
                    buildFeaturedTreatmentVote(treatId, "neutral", "Neutral", treatment.neutral, treatment.own_vote, totalVotes),
                    buildFeaturedTreatmentVote(treatId, "contra", "Negativ", treatment.contra, treatment.own_vote, totalVotes),
                    `<span class="featured-treatment-card-vote-count">(n=${totalVotes})</span>`
                ].join("");
            }
        }
    } catch (error) {
        console.error("Fehler beim Speichern der Behandlungsbewertung:", error);
        alert("Die Bewertung konnte nicht gespeichert werden.");
        buttons.forEach(function (item) { item.disabled = false; item.classList.remove("is-saving"); });
    }
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
window.addEventListener("homepage:location-changed", loadFeaturedExperts);
document.addEventListener("DOMContentLoaded", initNearbyGps);

async function loadFeaturedExperts() {
    const list = document.getElementById("featured-experts-list");
    const moreButton = document.getElementById("featured-experts-more");
    if (!list) return;
    const initialCount = Math.max(1, Number(list.dataset.initialCount || 10));
    const teaserMode = list.dataset.listMode === "teaser";
    const fullViewSwitch = list.dataset.fullViewSwitch === "true";

    let doctors = [];

    try {
        const storedLocation = getHomepageSharedLocation();
        const origin = storedLocation || homepageGermanyCenter;
        const response = await fetch(`api/doctors_search.php?lat=${encodeURIComponent(origin.lat)}&lng=${encodeURIComponent(origin.lng)}&radiusKm=all&includeNoCoords=1`);
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

    const initialEntries = editorialList.slice(0, initialCount);
    const longlist = editorialList.slice(initialCount);
    if (fullViewSwitch) {
        const viewButtons = document.querySelectorAll("[data-featured-view]");
        const renderFullView = function (view) {
            const mode = view === "table" ? "table" : "cards";
            const viewSwitch = viewButtons[0]?.closest(".featured-page-view-switch");
            viewSwitch?.remove();
            saveSharedViewPreference(mode);
            list.classList.toggle("is-card-mode", mode === "cards");
            list.classList.toggle("is-table-mode", mode === "table");
            list.innerHTML = mode === "cards"
                ? buildFeaturedExpertGridHtml(initialEntries)
                : buildFeaturedExpertTableHtml(initialEntries);
            const remainingGroup = list.querySelector(".featured-ranking-group.is-rest");
            if (viewSwitch && remainingGroup) remainingGroup.insertBefore(viewSwitch, remainingGroup.children[1] || null);
            viewButtons.forEach(function (button) {
                button.classList.toggle("is-active", button.dataset.featuredView === mode);
                button.setAttribute("aria-pressed", String(button.dataset.featuredView === mode));
            });
        };
        viewButtons.forEach(function (button) {
            button.addEventListener("click", function () { renderFullView(button.dataset.featuredView); });
        });
        renderFullView(getSharedViewPreference());
    } else {
        list.innerHTML = teaserMode
            ? buildExpertTeaserHtml(initialEntries)
            : buildFeaturedExpertsHtml(initialEntries, 0, false);
    }
    if (!list.dataset.voteBound) {
        list.addEventListener("click", handleFeaturedExpertVote);
        list.dataset.voteBound = "true";
    }
    if (!moreButton) return;
    moreButton.hidden = teaserMode || longlist.length === 0;

    moreButton.onclick = function () {
        const isExpanded = moreButton.getAttribute("aria-expanded") === "true";

        if (isExpanded) {
            list.querySelectorAll(".featured-expert-table-row.is-longlist").forEach(function (row) { row.remove(); });
        } else {
            const tableBody = list.querySelector(".featured-experts-table tbody");
            if (tableBody) tableBody.insertAdjacentHTML("beforeend", buildFeaturedExpertTableRowsHtml(longlist, initialEntries.length, true));
        }

        moreButton.setAttribute("aria-expanded", String(!isExpanded));
        moreButton.querySelector("span:first-child").textContent = isExpanded ? "Weitere anzeigen" : "Weniger anzeigen";
        moreButton.classList.toggle("is-expanded", !isExpanded);
    };
}

function getSharedViewPreference() {
    try { return localStorage.getItem("lcn_result_view_preference") === "cards" ? "cards" : "table"; }
    catch (_) { return "table"; }
}

function saveSharedViewPreference(view) {
    try { localStorage.setItem("lcn_result_view_preference", view === "table" ? "table" : "cards"); }
    catch (_) { /* Die Ansicht bleibt für die aktuelle Seite trotzdem aktiv. */ }
}

function buildExpertTeaserHtml(doctors) {
    return `<ol class="compact-ranking-list">${doctors.map(function (doctor) {
        const total = Number(doctor.total_votes || (Number(doctor.pro || 0) + Number(doctor.neutral || 0) + Number(doctor.contra || 0)));
        const ratio = doctor.positive_ratio !== undefined
            ? Math.round(Number(doctor.positive_ratio || 0))
            : total ? Math.round((Number(doctor.pro || 0) / total) * 100) : 0;
        const href = doctor.dr_id
            ? `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`
            : `aerzte_karte.html?search=${encodeURIComponent(doctor.dr_display_name || "")}`;
        return `<li><a href="${href}">${escapeHomepageHtml(doctor.dr_display_name || "")}</a><span class="compact-experience" aria-label="${ratio} Prozent positive Erfahrungen">+${ratio}%</span></li>`;
    }).join("")}</ol>`;
}

function buildFeaturedExpertsHtml(doctors, rankOffset, isLonglist) {
    const featured = doctors.slice(0, Math.max(0, 3 - rankOffset));
    const tableEntries = doctors.slice(featured.length);
    const cardsHtml = featured.map(function (doctor, index) {
        const rank = rankOffset + index + 1;
        const classes = ["featured-expert", "is-featured"];
        if (isLonglist) classes.push("is-longlist");

        const name = escapeHomepageHtml(doctor.dr_display_name || "");
        const institution = escapeHomepageHtml(doctor.loc_label || doctor.dr_org_name || doctor.specialty_labels || "");
        const location = `${getCountryFlag(doctor.editorial_flag)}<span>${escapeHomepageHtml(doctor.editorial_location)}</span>`;
        const ownVote = ["pro", "neutral", "contra"].includes(doctor.own_vote) ? doctor.own_vote : "";
        const votes = doctor.dr_id ? buildFeaturedExpertCardExperienceHtml(doctor, ownVote) : "";
        const profileHref = doctor.dr_id
            ? `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`
            : `aerzte_karte.html?search=${encodeURIComponent(doctor.dr_display_name || "")}`;
        const supply = buildFeaturedExpertSupplyHtml(doctor);
        const contact = buildFeaturedExpertContactHtml(doctor) || '<span class="featured-expert-card-muted">k. A.</span>';
        const distance = getFeaturedExpertDistanceHtml(doctor);

        return `
            <article class="${classes.join(" ")}"${doctor.editorial_fallback ? ' data-profile-match="missing"' : ""}>
                <span class="featured-expert-rank" aria-label="Redaktionelle Reihenfolge ${rank}">${String(rank).padStart(2, "0")}</span>
                <div class="featured-expert-main">
                    <div class="featured-expert-title-row">
                        <h3><a href="${profileHref}">${name}</a></h3>
                        <span class="featured-expert-location">${location}</span>
                    </div>
                    ${institution ? `<p>${institution}</p>` : ""}
                    <div class="featured-expert-card-facts">
                        <span><small>Versorgung (GKV, PKV)</small><strong>${supply}</strong></span>
                        <span><small>Entfernung</small><strong>${distance}</strong></span>
                        <span><small>Kontakt</small><strong>${contact}</strong></span>
                    </div>
                    <div class="featured-expert-footer">
                        ${votes}
                    </div>
                </div>
            </article>`;
    }).join("");

    if (!tableEntries.length) return cardsHtml;

    return `${cardsHtml}
        <div class="featured-experts-table-wrap">
            <table class="featured-experts-table">
                <thead>
                    <tr>
                        <th scope="col">Platz</th>
                        <th scope="col">Ärzt:in</th>
                        <th scope="col">Erfahrung <span class="featured-expert-table-header-note">(n = Votes)</span></th>
                        <th scope="col">Standort</th>
                        <th scope="col">Entfernung</th>
                        <th scope="col">Versorgung <span class="featured-expert-table-header-note">(GKV, PKV)</span></th>
                        <th scope="col">Kontakt</th>
                    </tr>
                </thead>
                <tbody>${buildFeaturedExpertTableRowsHtml(tableEntries, rankOffset + featured.length, isLonglist)}</tbody>
            </table>
        </div>`;
}

function buildFeaturedExpertGridHtml(doctors) {
    const topDoctors = doctors.slice(0, 3);
    const remainingDoctors = doctors.slice(3);
    return `<section class="featured-ranking-group is-top"><h3>Top 3 Ärzt:innen</h3><div class="featured-ranking-card-grid">${buildFeaturedExpertCardsHtml(topDoctors, 0)}</div></section><section class="featured-ranking-group is-rest"><h3>Weitere Ärzt:innen</h3><div class="featured-ranking-card-grid">${buildFeaturedExpertCardsHtml(remainingDoctors, 3)}</div></section>`;
}

function buildFeaturedExpertCardsHtml(doctors, rankOffset) {
    return doctors.map(function (doctor, index) {
        const name = escapeHomepageHtml(doctor.dr_display_name || "");
        const institution = escapeHomepageHtml(doctor.loc_label || doctor.dr_org_name || doctor.specialty_labels || "");
        const profileHref = doctor.dr_id
            ? `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`
            : `aerzte_karte.html?search=${encodeURIComponent(doctor.dr_display_name || "")}`;
        const ownVote = ["pro", "neutral", "contra"].includes(doctor.own_vote) ? doctor.own_vote : "";
        return `<article class="featured-expert is-featured featured-expert-grid-card"${doctor.editorial_fallback ? ' data-profile-match="missing"' : ""}>
            <span class="featured-expert-rank" aria-label="Redaktionelle Reihenfolge ${rankOffset + index + 1}">${String(rankOffset + index + 1).padStart(2, "0")}</span>
            <div class="featured-expert-main"><div class="featured-expert-title-row"><h3><a href="${profileHref}">${name}</a></h3><span class="featured-expert-location">${getCountryFlag(doctor.editorial_flag)}<span>${escapeHomepageHtml(doctor.editorial_location)}</span></span></div>
            ${institution ? `<p>${institution}</p>` : ""}<div class="featured-expert-card-facts"><span><small>Versorgung</small><strong>${buildFeaturedExpertSupplyHtml(doctor)}</strong></span><span><small>Entfernung</small><strong>${getFeaturedExpertDistanceHtml(doctor)}</strong></span><span><small>Kontakt</small><strong>${buildFeaturedExpertContactHtml(doctor) || "k. A."}</strong></span></div>
            <div class="featured-expert-footer">${doctor.dr_id ? buildFeaturedExpertCardExperienceHtml(doctor, ownVote) : ""}</div></div></article>`;
    }).join("");
}

function buildFeaturedExpertTableHtml(doctors) {
    const topDoctors = doctors.slice(0, 3);
    const tableDoctors = doctors.slice(3);
    return `<section class="featured-ranking-group is-top"><h3>Top 3 Ärzt:innen</h3><div class="featured-ranking-card-grid">${buildFeaturedExpertCardsHtml(topDoctors, 0)}</div></section><section class="featured-ranking-group is-rest"><h3>Weitere Ärzt:innen</h3><div class="featured-experts-table-wrap"><table class="featured-experts-table"><thead><tr><th scope="col">Platz</th><th scope="col">Ärzt:in</th><th scope="col">Erfahrung <span class="featured-expert-table-header-note">(n = Votes)</span></th><th scope="col">Standort</th><th scope="col">Entfernung</th><th scope="col">Versorgung</th><th scope="col">Kontakt</th></tr></thead><tbody>${buildFeaturedExpertTableRowsHtml(tableDoctors, 3, false)}</tbody></table></div></section>`;
}

function buildFeaturedExpertCardExperienceHtml(doctor, ownVote) {
    const pro = Number(doctor.pro || 0);
    const neutral = Number(doctor.neutral || 0);
    const contra = Number(doctor.contra || 0);
    const total = pro + neutral + contra;
    const ratios = {
        pro: total ? Math.round((pro / total) * 100) : 0,
        neutral: total ? Math.round((neutral / total) * 100) : 0,
        contra: total ? Math.round((contra / total) * 100) : 0
    };
    return `<div class="featured-expert-card-experience featured-expert-votes${ownVote ? " has-selection" : ""}" data-own-vote="${ownVote}">
        ${buildFeaturedExpertCardVoteButton(doctor.dr_id, "pro", "Positiv", "+", ratios.pro, pro, ownVote)}
        ${buildFeaturedExpertCardVoteButton(doctor.dr_id, "neutral", "Neutral", "=", ratios.neutral, neutral, ownVote)}
        ${buildFeaturedExpertCardVoteButton(doctor.dr_id, "contra", "Negativ", "−", ratios.contra, contra, ownVote)}
        <span class="featured-expert-card-vote-count">(n=${total})</span>
    </div>`;
}

function buildFeaturedExpertCardVoteButton(drId, type, label, prefix, ratio, count, ownVote) {
    const selected = ownVote === type;
    return `<button type="button" class="featured-vote-button featured-expert-card-vote featured-vote-${type}${selected ? " is-selected" : ""}"
        data-dr-id="${Number(drId)}" data-type="${type}" data-count="${count}" data-prefix="${prefix}"
        aria-pressed="${selected}" aria-label="${label}: ${ratio} Prozent. Jetzt abstimmen"><span>${label}</span><strong>${prefix}${ratio}%</strong></button>`;
}

function buildFeaturedExpertTableRowsHtml(doctors, rankOffset, isLonglist) {
    return doctors.map(function (doctor, index) {
        const rank = rankOffset + index + 1;
        const name = escapeHomepageHtml(doctor.dr_display_name || "");
        const institution = escapeHomepageHtml(doctor.loc_label || doctor.dr_org_name || doctor.specialty_labels || "");
        const ownVote = ["pro", "neutral", "contra"].includes(doctor.own_vote) ? doctor.own_vote : "";
        const profileHref = doctor.dr_id
            ? `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`
            : `aerzte_karte.html?search=${encodeURIComponent(doctor.dr_display_name || "")}`;
        const votes = doctor.dr_id
            ? buildFeaturedExpertTableExperienceHtml(doctor, ownVote)
            : `<a class="featured-expert-profile-search" href="${profileHref}">Eintrag ansehen</a>`;
        const supply = buildFeaturedExpertSupplyHtml(doctor);
        const contact = buildFeaturedExpertContactHtml(doctor);

        return `
            <tr class="featured-expert-table-row${isLonglist ? " is-longlist" : ""}"${doctor.editorial_fallback ? ' data-profile-match="missing"' : ""}>
                <td class="featured-expert-table-rank">${String(rank).padStart(2, "0")}</td>
                <td>
                    <span class="featured-expert-table-name"><a href="${profileHref}">${name}</a>${institution ? `<small>${institution}</small>` : ""}</span>
                </td>
                <td>${votes}</td>
                <td><span class="featured-expert-table-location">${getCountryFlag(doctor.editorial_flag)}<span>${escapeHomepageHtml(doctor.editorial_location)}</span></span></td>
                <td class="featured-expert-table-distance">${getFeaturedExpertDistanceHtml(doctor)}</td>
                <td>${supply}</td>
                <td>${contact}</td>
            </tr>`;
    }).join("");
}

function getFeaturedExpertDistanceHtml(doctor) {
    if (!getHomepageSharedLocation() || doctor.distance_km === null || doctor.distance_km === undefined) {
        return '<span class="featured-expert-card-muted">—</span>';
    }
    return `${formatFeaturedTreatmentDistance(doctor.distance_km)}`;
}

function buildFeaturedExpertTableExperienceHtml(doctor, ownVote) {
    const pro = Number(doctor.pro || 0);
    const neutral = Number(doctor.neutral || 0);
    const contra = Number(doctor.contra || 0);
    const total = pro + neutral + contra;
    const ratios = {
        pro: total ? Math.round((pro / total) * 100) : 0,
        neutral: total ? Math.round((neutral / total) * 100) : 0,
        contra: total ? Math.round((contra / total) * 100) : 0
    };

    return `<div class="featured-expert-table-experience featured-expert-votes${ownVote ? " has-selection" : ""}" data-own-vote="${ownVote}">
        ${buildFeaturedTableVoteButton(doctor.dr_id, "pro", "+", ratios.pro, pro, ownVote, "Positive Erfahrung")}
        ${buildFeaturedTableVoteButton(doctor.dr_id, "neutral", "=", ratios.neutral, neutral, ownVote, "Neutrale Erfahrung")}
        ${buildFeaturedTableVoteButton(doctor.dr_id, "contra", "−", ratios.contra, contra, ownVote, "Negative Erfahrung")}
        <span class="featured-expert-table-vote-count">(n=${total})</span>
    </div>`;
}

function buildFeaturedTableVoteButton(drId, type, prefix, ratio, count, ownVote, label) {
    const isSelected = ownVote === type;
    return `<button type="button" class="featured-vote-button featured-table-vote-button featured-vote-${type}${isSelected ? " is-selected" : ""}"
                    data-dr-id="${Number(drId)}" data-type="${type}" data-count="${count}" data-prefix="${prefix}"
                    aria-pressed="${isSelected}" aria-label="${label}: ${ratio} Prozent. Jetzt abstimmen"><strong>${prefix}${ratio}%</strong></button>`;
}

function buildFeaturedExpertSupplyHtml(doctor) {
    const badges = [];
    if ([1, "1", true, "true"].includes(doctor.dr_accepts_gkv)) badges.push("GKV");
    if ([1, "1", true, "true"].includes(doctor.dr_accepts_pkv)) badges.push("PKV");
    return badges.length
        ? badges.map(function (label) { return `<span class="featured-expert-table-badge">${label}</span>`; }).join(" ")
        : '<span class="featured-expert-supply-empty">Keine Angabe vorhanden</span>';
}

function buildFeaturedExpertContactHtml(doctor) {
    const links = [];
    const website = doctor.loc_website || doctor.dr_website;
    const email = doctor.loc_email || doctor.dr_email;
    const phone = doctor.loc_phone || doctor.dr_phone;
    if (website) links.push(`<a class="featured-expert-table-badge" href="${escapeHomepageHtml(website)}" target="_blank" rel="noopener">Web</a>`);
    if (email) links.push(`<a class="featured-expert-table-badge" href="mailto:${escapeHomepageHtml(email)}">Mail</a>`);
    if (phone) links.push(`<a class="featured-expert-table-badge" href="tel:${escapeHomepageHtml(phone)}">Tel</a>`);
    return links.join(" ");
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
    if (group.classList.contains("featured-expert-table-experience") || group.classList.contains("featured-expert-card-experience")) {
        const target = group.querySelector(`.featured-vote-${type}`);
        if (target) target.dataset.count = String(Math.max(0, Number(target.dataset.count || 0) + difference));
        const buttons = Array.from(group.querySelectorAll(".featured-table-vote-button, .featured-expert-card-vote"));
        const total = buttons.reduce(function (sum, button) { return sum + Number(button.dataset.count || 0); }, 0);
        buttons.forEach(function (button) {
            const ratio = total ? Math.round((Number(button.dataset.count || 0) / total) * 100) : 0;
            const strong = button.querySelector("strong");
            if (strong) strong.textContent = `${button.dataset.prefix || ""}${ratio}%`;
        });
        const totalLabel = group.querySelector(".featured-expert-table-vote-count, .featured-expert-card-vote-count");
        if (totalLabel) totalLabel.textContent = `(n=${total})`;
        return;
    }
    const count = group.querySelector(`.featured-vote-${type} strong`);
    if (!count) return;
    count.textContent = String(Math.max(0, Number(count.textContent || 0) + difference));
}

let nearbyGpsMap = null;
let nearbyGpsMarkers = null;
let nearbyGpsRadiusCircle = null;
let nearbyGpsUserIcon = null;
let nearbyGpsProviderIcon = null;
let nearbyGpsMarkersByLocation = new Map();
const homepageSharedLocationStorageKey = "lcn_shared_location_preference";
const homepageSharedLocationClearedStorageKey = "lcn_shared_location_cleared";
const homepageGermanyCenter = { lat: 51.1657, lng: 10.4515, label: "Deutschland" };
const homepagePrimaryCareTreatmentId = 409;

function initNearbyGps() {
    const form = document.getElementById("nearby-gps-form");
    if (!form) return;
    form.addEventListener("submit", searchNearbyGps);
    window.addEventListener("storage", handleHomepageLocationStorageChange);
    restoreHomepageLocationAndLoadGps();
}

async function restoreHomepageLocationAndLoadGps() {
    const input = document.getElementById("nearby-gps-location");
    let stored = null;
    try {
        const raw = localStorage.getItem(homepageSharedLocationStorageKey);
        stored = raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("Der gemeinsame Standort konnte nicht gelesen werden:", error);
    }

    const locationText = String(stored?.location || stored?.label || "").trim();
    if (input) input.value = locationText;

    if (locationText) {
        try {
            let restoredLocation = stored;
            if (!hasHomepageCoordinates(stored)) {
                const response = await fetch(`api/geocode_location.php?q=${encodeURIComponent(locationText)}`);
                const data = await response.json();
                if (!response.ok || !data.ok || !data.result) throw new Error("Der gespeicherte Standort konnte nicht gefunden werden.");
                restoredLocation = data.result;
                saveHomepageSharedLocation(restoredLocation, locationText);
                if (input) input.value = String(restoredLocation.formatted || locationText);
            }
            await loadNearbyGpsForLocation({
                lat: Number(restoredLocation.lat),
                lng: Number(restoredLocation.lng),
                formatted: String(restoredLocation.formatted || restoredLocation.label || locationText),
                city: String(restoredLocation.city || "")
            }, true);
        } catch (error) {
            console.error("Gespeicherter Standort konnte nicht geladen werden:", error);
            await loadGpsAcrossGermany();
        }
        return;
    }

    await loadGpsAcrossGermany();
}

function hasHomepageCoordinates(location) {
    return location
        && location.lat !== null && location.lat !== "" && location.lat !== undefined
        && location.lng !== null && location.lng !== "" && location.lng !== undefined
        && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
}

function getHomepageSharedLocation() {
    try {
        const stored = JSON.parse(localStorage.getItem(homepageSharedLocationStorageKey) || "null");
        return hasHomepageCoordinates(stored) ? { lat: Number(stored.lat), lng: Number(stored.lng) } : null;
    } catch (error) {
        return null;
    }
}

function buildHomepageLocationQuery() {
    const location = getHomepageSharedLocation();
    if (!location) return "";
    const params = new URLSearchParams({ include_map: "1", lat: String(location.lat), lng: String(location.lng) });
    return `&${params.toString()}`;
}

function handleHomepageLocationStorageChange(event) {
    if (![homepageSharedLocationStorageKey, homepageSharedLocationClearedStorageKey].includes(event.key)) return;
    restoreHomepageLocationAndLoadGps();
    window.dispatchEvent(new CustomEvent("homepage:location-changed"));
}

async function searchNearbyGps(event) {
    event.preventDefault();
    const input = document.getElementById("nearby-gps-location");
    const status = document.getElementById("nearby-gps-status");
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    const radiusInput = document.getElementById("nearby-gps-radius");
    const query = String(input.value || "").trim();
    const radiusKm = Math.min(500, Math.max(1, Number(radiusInput?.value || 50)));
    if (!query) return;
    if (radiusInput) radiusInput.value = String(radiusKm);

    submitButton.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Standort und hausärztliche Behandlungen werden gesucht …";
    try {
        const geoResponse = await fetch(`api/geocode_location.php?q=${encodeURIComponent(query)}`);
        const geoData = await geoResponse.json();
        if (!geoResponse.ok || !geoData.ok || !geoData.result) throw new Error("Der Standort konnte nicht gefunden werden.");
        const location = geoData.result;
        saveHomepageSharedLocation(location, query);
        await loadNearbyGpsForLocation(location, false, radiusKm);
        window.dispatchEvent(new CustomEvent("homepage:location-changed"));
    } catch (error) {
        console.error("Hausärzt:innen in der Nähe konnten nicht geladen werden:", error);
        status.textContent = error.message || "Die Suche konnte gerade nicht ausgeführt werden.";
        status.classList.add("is-error");
    } finally {
        submitButton.disabled = false;
    }
}

async function loadGpsAcrossGermany() {
    const status = document.getElementById("nearby-gps-status");
    status.classList.remove("is-error");
    status.textContent = "Hausärztliche Anlaufstellen in Deutschland werden geladen …";
    try {
        const response = await fetch(buildHomepagePrimaryCareUrl(homepageGermanyCenter));
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error("Die hausärztlichen Behandlungen sind gerade nicht verfügbar.");
        const gps = getHomepagePrimaryCareProviders(data, false);
        renderNearbyGps(homepageGermanyCenter, gps, false);
        status.textContent = `${gps.length} hausärztliche Anlaufstellen in Deutschland auf der Karte.`;
    } catch (error) {
        console.error("Deutschlandweite Hausärzt:innen konnten nicht geladen werden:", error);
        status.textContent = error.message || "Die deutschlandweite Karte konnte gerade nicht geladen werden.";
        status.classList.add("is-error");
    }
}

async function loadNearbyGpsForLocation(location, restored, requestedRadiusKm) {
    const status = document.getElementById("nearby-gps-status");
    const radiusInput = document.getElementById("nearby-gps-radius");
    const radiusKm = Number.isFinite(Number(requestedRadiusKm))
        ? Math.min(500, Math.max(1, Number(requestedRadiusKm)))
        : Math.min(500, Math.max(1, Number(radiusInput?.value || 50)));
    if (radiusInput) radiusInput.value = String(radiusKm);
    status.classList.remove("is-error");
    status.textContent = restored ? "Hausärztliche Anlaufstellen am gespeicherten Standort werden geladen …" : "Hausärzt:innen in der Nähe werden geladen …";
    const response = await fetch(buildHomepagePrimaryCareUrl(location, radiusKm));
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Die hausärztlichen Behandlungen sind gerade nicht verfügbar.");
    const gps = getHomepagePrimaryCareProviders(data, true);
    renderNearbyGps(location, gps, true, radiusKm);
    status.textContent = gps.length
        ? `${gps.length} Anbieter der hausärztlichen Behandlung im Umkreis von ${radiusKm} km gefunden.`
        : `Im Umkreis von ${radiusKm} km wurden aktuell keine Anbieter der hausärztlichen Behandlung gefunden.`;
}

function buildHomepagePrimaryCareUrl(location, radiusKm) {
    const params = new URLSearchParams({
        treat_ids: String(homepagePrimaryCareTreatmentId),
        only_with_provider: "1",
        include_map: "1",
        mapped_providers_only: "1",
        lat: String(location.lat),
        lng: String(location.lng)
    });
    if (Number.isFinite(radiusKm)) {
        params.set("provider_lat", String(location.lat));
        params.set("provider_lng", String(location.lng));
        params.set("radius_km", String(radiusKm));
    }
    return `api/treatments_search.php?${params.toString()}`;
}

function getHomepagePrimaryCareProviders(data, sortByDistance) {
    const providers = Array.isArray(data?.map?.providers) ? data.map.providers.slice() : [];
    providers.sort(function (a, b) {
        if (sortByDistance) return Number(a.distance_km || 0) - Number(b.distance_km || 0);
        return String(a.dr_display_name || "").localeCompare(String(b.dr_display_name || ""), "de", { sensitivity: "base" });
    });
    return providers;
}

function saveHomepageSharedLocation(location, fallbackText) {
    const label = String(location.formatted || location.label || fallbackText || "").trim();
    try {
        localStorage.setItem(homepageSharedLocationStorageKey, JSON.stringify({
            location: label,
            label,
            city: String(location.city || ""),
            lat: Number(location.lat),
            lng: Number(location.lng)
        }));
        localStorage.removeItem(homepageSharedLocationClearedStorageKey);
    } catch (error) {
        console.warn("Der gemeinsame Standort konnte nicht gespeichert werden:", error);
    }
}

function renderNearbyGps(location, doctors, hasUserLocation, radiusKm) {
    const results = document.getElementById("nearby-gps-results");
    const list = document.getElementById("nearby-gps-list");
    const allLink = document.getElementById("nearby-gps-all");
    const heading = document.getElementById("nearby-gps-results-heading");
    results.hidden = false;
    heading.textContent = hasUserLocation ? "Die nächsten Anlaufstellen" : "Hausärztliche Anlaufstellen in Deutschland";
    list.innerHTML = doctors.length ? doctors.slice(0, 5).map(function (doctor) { return buildNearbyGpCard(doctor, hasUserLocation); }).join("")
        : '<p class="nearby-gps-status">Versuche alternativ die vollständige Ärzt:innensuche.</p>';
    if (allLink.dataset.preserveHref !== "true") {
        allLink.href = `therapie_detail.html?treat_id=${homepagePrimaryCareTreatmentId}`;
    }

    if (typeof L === "undefined") return;
    if (!nearbyGpsMap) {
        window.LCNImages?.configureLeaflet(L);
        nearbyGpsMap = L.map("nearby-gps-map", { zoomControl: false, scrollWheelZoom: false })
            .setView([homepageGermanyCenter.lat, homepageGermanyCenter.lng], 6);
        document.getElementById("nearby-gps-map")?.addEventListener("click", function () {
            nearbyGpsMap.scrollWheelZoom.enable();
            this.classList.add("is-scroll-zoom-active");
        });
        document.getElementById("nearby-gps-map")?.addEventListener("mouseleave", function () {
            nearbyGpsMap.scrollWheelZoom.disable();
            this.classList.remove("is-scroll-zoom-active");
        });
        L.control.zoom({ position: "topright" }).addTo(nearbyGpsMap);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 19,
            attribution: "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap-Mitwirkende und weitere"
        }).addTo(nearbyGpsMap);
    }
    if (!nearbyGpsUserIcon || !nearbyGpsProviderIcon) {
        const imageUrls = window.LCNImages?.urls || {};
        nearbyGpsUserIcon = L.icon({
            iconUrl: imageUrls["map-marker-red"] || "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
            shadowUrl: imageUrls["map-marker-shadow"] || "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
        nearbyGpsProviderIcon = L.icon({
            iconUrl: imageUrls["map-marker-default"] || "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            iconRetinaUrl: imageUrls["map-marker-default-retina"] || "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
            shadowUrl: imageUrls["map-marker-shadow"] || "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
    }
    if (!nearbyGpsMarkers) {
        nearbyGpsMarkers = L.layerGroup().addTo(nearbyGpsMap);
    }
    nearbyGpsMarkers.clearLayers();
    nearbyGpsMarkersByLocation = new Map();
    if (nearbyGpsRadiusCircle) {
        nearbyGpsMap.removeLayer(nearbyGpsRadiusCircle);
        nearbyGpsRadiusCircle = null;
    }
    const bounds = [];
    if (hasUserLocation) {
        bounds.push([Number(location.lat), Number(location.lng)]);
        L.marker([location.lat, location.lng], { icon: nearbyGpsUserIcon })
            .bindPopup(`<strong>Dein Standort</strong><br>${escapeHomepageHtml(location.formatted || location.label || "")}`).addTo(nearbyGpsMarkers);
        nearbyGpsRadiusCircle = L.circle([location.lat, location.lng], {
            radius: Number(radiusKm || 50) * 1000,
            color: "#3388ff", weight: 2, opacity: .9,
            fillColor: "#3388ff", fillOpacity: .10, interactive: false
        }).addTo(nearbyGpsMap);
    }
    const providerGroups = groupNearbyGpsProviders(doctors);
    providerGroups.forEach(function (group) {
        bounds.push([group.lat, group.lng]);
        const marker = L.marker([group.lat, group.lng], {
            icon: group.doctors.length > 1 ? buildNearbyGpsCountIcon(group.doctors.length) : nearbyGpsProviderIcon,
            riseOnHover: true
        }).bindPopup(buildNearbyGpsGroupPopup(group)).addTo(nearbyGpsMarkers);
        nearbyGpsMarkersByLocation.set(group.key, marker);
    });
    bindNearbyGpCardHighlights(list);
    if (hasUserLocation && nearbyGpsRadiusCircle) nearbyGpsMap.fitBounds(nearbyGpsRadiusCircle.getBounds(), { padding: [28, 28] });
    else if (bounds.length > 0) nearbyGpsMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 7 });
    else nearbyGpsMap.setView([homepageGermanyCenter.lat, homepageGermanyCenter.lng], 6);
    setTimeout(function () { nearbyGpsMap.invalidateSize(); }, 0);
}

function buildNearbyGpCard(doctor, showDistance) {
    const href = `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`;
    const distance = showDistance && Number.isFinite(Number(doctor.distance_km))
        ? `${Number(doctor.distance_km).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`
        : "Versorgung";
    return `<article class="nearby-gp-card" data-location-key="${escapeHomepageHtml(getNearbyGpsLocationKey(doctor))}"><span class="nearby-gp-distance">${distance}</span><div><h4><a href="${href}">${escapeHomepageHtml(doctor.dr_display_name || "Hausärztliche Praxis")}</a></h4><p>${escapeHomepageHtml(formatDoctorAddress(doctor) || "Hausärztliche Behandlung")}</p></div></article>`;
}

function getNearbyGpsLocationKey(doctor) {
    return `${Number(doctor.loc_lat).toFixed(6)},${Number(doctor.loc_lng).toFixed(6)}`;
}

function groupNearbyGpsProviders(doctors) {
    const groups = new Map();
    doctors.forEach(function (doctor) {
        if (!Number.isFinite(Number(doctor.loc_lat)) || !Number.isFinite(Number(doctor.loc_lng))) return;
        const key = getNearbyGpsLocationKey(doctor);
        if (!groups.has(key)) groups.set(key, { key, lat: Number(doctor.loc_lat), lng: Number(doctor.loc_lng), doctors: [] });
        groups.get(key).doctors.push(doctor);
    });
    return Array.from(groups.values());
}

function buildNearbyGpsCountIcon(count) {
    return L.divIcon({
        className: "nearby-gps-count-marker",
        html: `<img src="${escapeHomepageHtml(window.LCNImages.urls["map-marker-default"])}" alt=""><span>${count}</span>`,
        iconSize: [31, 41], iconAnchor: [15, 41], popupAnchor: [0, -35]
    });
}

function buildNearbyGpsGroupPopup(group) {
    const address = formatDoctorAddress(group.doctors[0]);
    const entries = group.doctors.map(function (doctor) {
        const href = `arzt_detail.html?id=${encodeURIComponent(doctor.dr_id)}`;
        return `<li><a href="${href}">${escapeHomepageHtml(doctor.dr_display_name || "Hausärztliche Praxis")}</a></li>`;
    }).join("");
    return `<strong>${group.doctors.length > 1 ? `${group.doctors.length} Anlaufstellen` : escapeHomepageHtml(group.doctors[0].dr_display_name || "Hausärztliche Praxis")}</strong><br>${escapeHomepageHtml(address)}${group.doctors.length > 1 ? `<ul class="nearby-gps-popup-list">${entries}</ul>` : `<br><a href="arzt_detail.html?id=${encodeURIComponent(group.doctors[0].dr_id)}">Profil ansehen</a>`}`;
}

function bindNearbyGpCardHighlights(list) {
    list.querySelectorAll(".nearby-gp-card").forEach(function (card) {
        const marker = nearbyGpsMarkersByLocation.get(card.dataset.locationKey);
        const toggle = function (active) {
            card.classList.toggle("is-map-highlighted", active);
            if (!marker) return;
            marker.setZIndexOffset(active ? 1000 : 0);
            marker.getElement()?.classList.toggle("is-list-highlighted", active);
        };
        card.addEventListener("mouseenter", function () { toggle(true); });
        card.addEventListener("mouseleave", function () { toggle(false); });
        card.addEventListener("focusin", function () { toggle(true); });
        card.addEventListener("focusout", function () { toggle(false); });
    });
}

function formatDoctorAddress(doctor) {
    const street = [doctor.loc_street, doctor.loc_housenumber].filter(Boolean).join(" ");
    const city = [doctor.loc_plz, doctor.loc_city].filter(Boolean).join(" ");
    return [street, city].filter(Boolean).join(", ");
}

function escapeHomepageHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value || "");
    return element.innerHTML;
}
