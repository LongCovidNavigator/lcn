// =========================
// DB-backed Bewertung (no localStorage)
// + Sortierbutton
// + Mindestbewertungen-Filter
// + Höchstwert-Anzeige
// =========================

let treatmentBewertungData = [];
let currentTreatmentVotesMap = new Map();
let currentTreatmentSortKey = "name";
let currentTreatmentSortDirection = "asc";
let currentTreatmentMinVotes = 0;

document.addEventListener("DOMContentLoaded", () => {
  setupTreatmentSortMenu();
  setupTreatmentFilterMenu();
  setupTreatmentMinVotesFilter();
  loadBewertungData();
});

function setupTreatmentFilterMenu() {
  const filterButton = document.getElementById("treatment-filter-button");
  const filterMenu = document.getElementById("treatment-filter-menu");

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

function setupTreatmentSortMenu() {
  const sortButton = document.getElementById("treatment-sort-button");
  const sortMenu = document.getElementById("treatment-sort-menu");

  if (!sortButton || !sortMenu) {
    return;
  }

  sortButton.addEventListener("click", () => {
    sortMenu.classList.toggle("show");
  });

  sortMenu.querySelectorAll("button[data-sort-key]").forEach(button => {
    button.addEventListener("click", () => {
      const clickedKey = button.getAttribute("data-sort-key");

      if (clickedKey === currentTreatmentSortKey) {
        currentTreatmentSortDirection =
          currentTreatmentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentTreatmentSortKey = clickedKey;

        if (clickedKey === "name" || clickedKey === "negative_ratio") {
          currentTreatmentSortDirection = "asc";
        } else {
          currentTreatmentSortDirection = "desc";
        }
      }

      const label = button.textContent.trim();
      const directionLabel = getTreatmentSortDirectionLabel(
        currentTreatmentSortKey,
        currentTreatmentSortDirection
      );

      sortButton.textContent = `Sortieren: ${label} ${directionLabel} ▾`;

      sortMenu.classList.remove("show");
      renderBewertungTable(treatmentBewertungData, currentTreatmentVotesMap);
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

function getTreatmentSortDirectionLabel(sortKey, direction) {
  if (sortKey === "name") {
    return direction === "asc" ? "A–Z" : "Z–A";
  }

  return direction === "asc" ? "↑" : "↓";
}

function setupTreatmentMinVotesFilter() {
  const input = document.getElementById("treatment-min-votes-input");
  const filterMenu = document.getElementById("treatment-filter-menu");

  if (!input) {
    return;
  }

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const value = Number(input.value);

    currentTreatmentMinVotes = Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;

    input.value = currentTreatmentMinVotes;

    if (filterMenu) {
      filterMenu.classList.remove("show");
    }

    renderBewertungTable(treatmentBewertungData, currentTreatmentVotesMap);
  });
}

async function loadBewertungData() {
  try {
    const [jsonRes, wikiRes, votesRes] = await Promise.all([
      fetch("api/treatments_from_db.php"),
      fetch("api/structure_content.php"),
      fetch("api/get_votes_db.php"),
    ]);

    if (!jsonRes.ok || !wikiRes.ok || !votesRes.ok) {
      throw new Error("Fehler beim Laden der Datenquellen");
    }

    const json = await jsonRes.json();
    const wiki = await wikiRes.json();
    const votesRaw = await votesRes.json();

    const votesMap = new Map(
      (votesRaw || [])
        .filter(v => v && v.Behandlung)
        .map(v => [String(v.Behandlung).toLowerCase(), v])
    );

    const gesamt = mergeBehandlungen(json, wiki);

    treatmentBewertungData = gesamt;
    currentTreatmentVotesMap = votesMap;

    updateTreatmentMaxVotesDisplay(treatmentBewertungData, currentTreatmentVotesMap);
    renderBewertungTable(treatmentBewertungData, currentTreatmentVotesMap);

  } catch (err) {
    console.error("Fehler beim Laden der Daten:", err.message);

    const tableBody = document.querySelector(".bewertung-table tbody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6">Fehler beim Laden der Bewertungsdaten.</td>
        </tr>
      `;
    }
  }
}

function mergeBehandlungen(jsonList, wikiList) {
  const wikiMap = new Map(
    (wikiList || []).map(e => [String(e.Behandlung || e.title || "").toLowerCase(), e])
  );

  const merged = (jsonList || []).map(j => {
    const key = String(j.Behandlung || "").toLowerCase();
    const wikiMatch = wikiMap.get(key);

    return {
      ...j,
      url: wikiMatch ? wikiMatch.url : null
    };
  });

  const jsonKeys = new Set(
    (jsonList || []).map(e => String(e.Behandlung || "").toLowerCase())
  );

  const extraWiki = (wikiList || [])
    .filter(e => !jsonKeys.has(String(e.Behandlung || e.title || "").toLowerCase()))
    .map(e => ({
      Behandlung: e.Behandlung || e.title,
      url: e.url
    }));

  return [...merged, ...extraWiki];
}

function renderBewertungTable(treatments, votesMap) {
  const tableBody = document.querySelector(".bewertung-table tbody");

  if (!tableBody) {
    console.error("Tabellenkörper nicht gefunden.");
    return;
  }

  tableBody.innerHTML = "";

  const filteredTreatments = filterTreatmentsByMinVotes(
    treatments,
    votesMap,
    currentTreatmentMinVotes
  );

  const sortedTreatments = sortTreatments(
    filteredTreatments,
    votesMap,
    currentTreatmentSortKey,
    currentTreatmentSortDirection
  );

  sortedTreatments.forEach((item, index) => {
    const stats = getTreatmentVoteStats(item, votesMap);
    const treatmentName = item.Behandlung || "-";

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>
        ${item.url
          ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(treatmentName)}</a>`
          : escapeHtml(treatmentName)}
      </td>
      <td class="vote-buttons">
        <button class="vote-button" data-treatment="${escapeHtml(treatmentName)}" data-type="hilft">
          ↗ (<span class="vote-count">${stats.hilft}</span>)
        </button>
        <button class="vote-button" data-treatment="${escapeHtml(treatmentName)}" data-type="gleich">
          = (<span class="vote-count">${stats.gleich}</span>)
        </button>
        <button class="vote-button" data-treatment="${escapeHtml(treatmentName)}" data-type="verschlechterung">
          ↘ (<span class="vote-count">${stats.verschlechterung}</span>)
        </button>
      </td>
      <td>${stats.totalVotes}</td>
      <td>${stats.improvementRatio}%</td>
      <td>${stats.worseningRatio}%</td>
    `;

    tableBody.appendChild(row);
  });

  document.querySelectorAll(".vote-button").forEach(btn => {
    btn.addEventListener("click", handleVote);
  });
}

function updateTreatmentMaxVotesDisplay(treatments, votesMap) {
  const display = document.getElementById("treatment-max-votes-display");

  if (!display) {
    return;
  }

  const maxVotes = Math.max(
    0,
    ...(treatments || []).map(treatment => {
      const stats = getTreatmentVoteStats(treatment, votesMap);
      return stats.totalVotes;
    })
  );

  display.textContent = `Höchstwert: ${maxVotes}`;
}

function filterTreatmentsByMinVotes(treatments, votesMap, minVotes) {
  return [...(treatments || [])].filter(treatment => {
    const stats = getTreatmentVoteStats(treatment, votesMap);
    return stats.totalVotes >= minVotes;
  });
}

function sortTreatments(treatments, votesMap, sortKey, direction) {
  const treatmentsCopy = [...(treatments || [])];

  treatmentsCopy.sort((a, b) => {
    const statsA = getTreatmentVoteStats(a, votesMap);
    const statsB = getTreatmentVoteStats(b, votesMap);

    let result = 0;

    if (sortKey === "positive_ratio") {
      result = statsA.improvementRatio - statsB.improvementRatio;
    } else if (sortKey === "negative_ratio") {
      result = statsA.worseningRatio - statsB.worseningRatio;
    } else if (sortKey === "total_votes") {
      result = statsA.totalVotes - statsB.totalVotes;
    } else {
      result = String(a.Behandlung || "").localeCompare(
        String(b.Behandlung || ""),
        "de",
        { sensitivity: "base" }
      );
    }

    return direction === "desc" ? -result : result;
  });

  return treatmentsCopy;
}

function getTreatmentVoteStats(item, votesMap) {
  const key = String(item.Behandlung || "").toLowerCase();
  const dbVote = votesMap?.get(key);

  const hilft = dbVote ? Number(dbVote.pro ?? 0) : 0;
  const gleich = dbVote ? Number(dbVote.neutral ?? 0) : 0;
  const verschlechterung = dbVote ? Number(dbVote.contra ?? 0) : 0;

  const totalVotes = hilft + gleich + verschlechterung;

  return {
    hilft,
    gleich,
    verschlechterung,
    totalVotes,
    improvementRatio: totalVotes > 0 ? Math.round((hilft / totalVotes) * 100) : 0,
    worseningRatio: totalVotes > 0 ? Math.round((verschlechterung / totalVotes) * 100) : 0
  };
}

async function handleVote(event) {
  const button = event.target.closest(".vote-button");

  if (!button) {
    return;
  }

  const treatment = button.getAttribute("data-treatment");
  const voteType = button.getAttribute("data-type");

  try {
    const res = await fetch("api/inc_votes_db.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        treatment,
        type: voteType
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Vote increment failed");
    }

    await loadBewertungData();

  } catch (err) {
    console.error("❌ Vote Fehler:", err.message);
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