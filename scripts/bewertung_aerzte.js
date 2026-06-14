let doctorBewertungData = [];
let currentDoctorSortKey = "name";
let currentDoctorSortDirection = "asc";
let currentDoctorMinVotes = 0;

document.addEventListener("DOMContentLoaded", () => {
    setupDoctorSortMenu();
    setupDoctorFilterMenu();
    setupDoctorMinVotesFilter();
    loadDoctorBewertungData();
});

function setupDoctorFilterMenu() {
    const filterButton = document.getElementById("doctor-filter-button");
    const filterMenu = document.getElementById("doctor-filter-menu");

    if (!filterButton || !filterMenu) {
        return;
    }

    filterButton.addEventListener("click", () => {
        filterMenu.classList.toggle("show");
    });

    document.addEventListener("click", event => {
        const clickedInsideFilter =
            filterButton.contains(event.target) ||
            filterMenu.contains(event.target);

        if (!clickedInsideFilter) {
            filterMenu.classList.remove("show");
        }
    });
}

function setupDoctorSortMenu() {
    const sortButton = document.getElementById("doctor-sort-button");
    const sortMenu = document.getElementById("doctor-sort-menu");

    if (!sortButton || !sortMenu) {
        return;
    }

    sortButton.addEventListener("click", () => {
        sortMenu.classList.toggle("show");
    });

    sortMenu.querySelectorAll("button[data-sort-key]").forEach(button => {
        button.addEventListener("click", () => {
            const clickedKey = button.getAttribute("data-sort-key");

            if (clickedKey === currentDoctorSortKey) {
                currentDoctorSortDirection =
                    currentDoctorSortDirection === "asc" ? "desc" : "asc";
            } else {
				currentDoctorSortKey = clickedKey;

				if (clickedKey === "name" || clickedKey === "negative_ratio") {
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
            renderDoctorBewertungTable(doctorBewertungData);
        });
    });

    document.addEventListener("click", event => {
        const clickedInsideSort =
            sortButton.contains(event.target) ||
            sortMenu.contains(event.target);

        if (!clickedInsideSort) {
            sortMenu.classList.remove("show");
        }
    });
}


function setupDoctorMinVotesFilter() {
    const input = document.getElementById("doctor-min-votes-input");
    const filterMenu = document.getElementById("doctor-filter-menu");

    if (!input) {
        return;
    }

    input.addEventListener("keydown", event => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        const value = Number(input.value);

        currentDoctorMinVotes = Number.isFinite(value) && value > 0
            ? Math.floor(value)
            : 0;

        input.value = currentDoctorMinVotes;

        if (filterMenu) {
            filterMenu.classList.remove("show");
        }

        renderDoctorBewertungTable(doctorBewertungData);
    });
}



function getDoctorSortDirectionLabel(sortKey, direction) {
    if (sortKey === "name") {
        return direction === "asc" ? "A–Z" : "Z–A";
    }

    return direction === "asc" ? "↑" : "↓";
}


async function loadDoctorBewertungData() {
    const tbody = document.querySelector(".bewertung-table tbody");

    if (!tbody) {
        console.error("Tabellenkörper nicht gefunden.");
        return;
    }

    try {
        const response = await fetch("api/get_doctor_votes.php");

        if (!response.ok) {
            throw new Error(`HTTP-Fehler: ${response.status}`);
        }

        const doctors = await response.json();

        doctorBewertungData = doctors;
		updateDoctorMaxVotesDisplay(doctorBewertungData);
		renderDoctorBewertungTable(doctorBewertungData);

    } catch (error) {
        console.error("Fehler beim Laden der Ärztebewertungen:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6">Fehler beim Laden der Ärztebewertungen.</td>
            </tr>
        `;
    }
}

function renderDoctorBewertungTable(doctors) {
    const tbody = document.querySelector(".bewertung-table tbody");
    tbody.innerHTML = "";

    const filteredDoctors = filterDoctorsByMinVotes(doctors, currentDoctorMinVotes);

	const sortedDoctors = sortDoctors(
		filteredDoctors,
		currentDoctorSortKey,
		currentDoctorSortDirection
	);

    sortedDoctors.forEach((doctor, index) => {
        const pro = Number(doctor.pro ?? 0);
        const neutral = Number(doctor.neutral ?? 0);
        const contra = Number(doctor.contra ?? 0);

        const totalVotes = pro + neutral + contra;
        const proRatio = totalVotes > 0 ? Math.round((pro / totalVotes) * 100) : 0;
        const contraRatio = totalVotes > 0 ? Math.round((contra / totalVotes) * 100) : 0;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(doctor.dr_display_name)}</td>
            <td class="vote-buttons">
                <button class="vote-button" data-dr-id="${doctor.dr_id}" data-type="pro">
                    ↗ (<span class="vote-count">${pro}</span>)
                </button>
                <button class="vote-button" data-dr-id="${doctor.dr_id}" data-type="neutral">
                    = (<span class="vote-count">${neutral}</span>)
                </button>
                <button class="vote-button" data-dr-id="${doctor.dr_id}" data-type="contra">
                    ↘ (<span class="vote-count">${contra}</span>)
                </button>
            </td>
            <td>${totalVotes}</td>
            <td>${proRatio}%</td>
            <td>${contraRatio}%</td>
        `;

        tbody.appendChild(row);
    });

    document.querySelectorAll(".vote-button").forEach(button => {
        button.addEventListener("click", handleDoctorVote);
    });
}


function updateDoctorMaxVotesDisplay(doctors) {
    const display = document.getElementById("doctor-max-votes-display");

    if (!display) {
        return;
    }

    const maxVotes = Math.max(
        0,
        ...(doctors || []).map(doctor => {
            const stats = getDoctorVoteStats(doctor);
            return stats.totalVotes;
        })
    );

    display.textContent = `Höchstwert: ${maxVotes}`;
}


function filterDoctorsByMinVotes(doctors, minVotes) {
    return [...(doctors || [])].filter(doctor => {
        const stats = getDoctorVoteStats(doctor);
        return stats.totalVotes >= minVotes;
    });
}


function sortDoctors(doctors, sortKey, direction) {
    const doctorsCopy = [...(doctors || [])];

    doctorsCopy.sort((a, b) => {
        const statsA = getDoctorVoteStats(a);
        const statsB = getDoctorVoteStats(b);

        let result = 0;

        if (sortKey === "positive_ratio") {
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
        contraRatio: totalVotes > 0 ? Math.round((contra / totalVotes) * 100) : 0
    };
}

async function handleDoctorVote(event) {
    const button = event.target.closest(".vote-button");

    if (!button) {
        return;
    }

    const drId = button.getAttribute("data-dr-id");
    const voteType = button.getAttribute("data-type");

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

        await loadDoctorBewertungData();

    } catch (error) {
        console.error("Fehler beim Speichern der Ärztebewertung:", error);
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