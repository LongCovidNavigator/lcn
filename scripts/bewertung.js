// =========================
// DB-backed Bewertung (no localStorage)
// =========================

async function loadBewertungData() {
  try {
    const [jsonRes, wikiRes, votesRes] = await Promise.all([
      fetch("/api/treatments_from_db.php"),
      fetch("/api/structure_content.php"),
      fetch("/api/get_votes_db.php"),
    ]);

    if (!jsonRes.ok || !wikiRes.ok || !votesRes.ok) {
      throw new Error("Fehler beim Laden der Datenquellen");
    }

    const json = await jsonRes.json();
    const wiki = await wikiRes.json();
    const votesRaw = await votesRes.json();

    // Map: Behandlung(lower) -> {Behandlung, pro, neutral, contra}
    const votesMap = new Map(
      (votesRaw || [])
        .filter(v => v && v.Behandlung)
        .map(v => [String(v.Behandlung).toLowerCase(), v])
    );

    const gesamt = mergeBehandlungen(json, wiki);
    renderBewertungTable(gesamt, votesMap);

  } catch (err) {
    console.error("Fehler beim Laden der Daten:", err.message);
  }
}

function mergeBehandlungen(jsonList, wikiList) {
  const wikiMap = new Map(
    (wikiList || []).map(e => [String(e.Behandlung || e.title || "").toLowerCase(), e])
  );

  const merged = (jsonList || []).map(j => {
    const key = String(j.Behandlung || "").toLowerCase();
    const wikiMatch = wikiMap.get(key);
    return { ...j, url: wikiMatch ? wikiMatch.url : null };
  });

  const jsonKeys = new Set((jsonList || []).map(e => String(e.Behandlung || "").toLowerCase()));
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
  tableBody.innerHTML = "";

  treatments.forEach((item, index) => {
    const key = String(item.Behandlung || "").toLowerCase();
    const dbVote = votesMap?.get(key);

    const votes = dbVote ? {
      hilft: Number(dbVote.pro ?? 0),
      gleich: Number(dbVote.neutral ?? 0),
      verschlechterung: Number(dbVote.contra ?? 0),
    } : { hilft: 0, gleich: 0, verschlechterung: 0 };

    const totalVotes = votes.hilft + votes.gleich + votes.verschlechterung;
    const improvementRatio = totalVotes > 0 ? Math.round((votes.hilft / totalVotes) * 100) : 0;
    const worseningRatio = totalVotes > 0 ? Math.round((votes.verschlechterung / totalVotes) * 100) : 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>
        ${item.url
          ? `<a href="${item.url}" target="_blank">${item.Behandlung}</a>`
          : (item.Behandlung || "-")}
      </td>
      <td class="vote-buttons">
        <button class="vote-button" data-treatment="${item.Behandlung}" data-type="hilft">
          ↗ (<span class="vote-count">${votes.hilft}</span>)
        </button>
        <button class="vote-button" data-treatment="${item.Behandlung}" data-type="gleich">
          = (<span class="vote-count">${votes.gleich}</span>)
        </button>
        <button class="vote-button" data-treatment="${item.Behandlung}" data-type="verschlechterung">
          ↘ (<span class="vote-count">${votes.verschlechterung}</span>)
        </button>
      </td>
      <td>${improvementRatio}%</td>
      <td>${worseningRatio}%</td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll(".vote-button").forEach(btn => {
    btn.addEventListener("click", handleVote);
  });
}

async function handleVote(event) {
  const button = event.target.closest(".vote-button");
  const treatment = button.getAttribute("data-treatment");
  const voteType = button.getAttribute("data-type");

  try {
    const res = await fetch("/api/inc_votes_db.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treatment, type: voteType })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Vote increment failed");
    }

    // Nach dem Increment: komplette Vote-Liste neu laden (Single Source of Truth)
    const votesRes = await fetch("/api/get_votes_db.php");
    if (!votesRes.ok) throw new Error("get_votes_db failed");
    const votesRaw = await votesRes.json();

    const votesMap = new Map(
      (votesRaw || [])
        .filter(v => v && v.Behandlung)
        .map(v => [String(v.Behandlung).toLowerCase(), v])
    );

    const key = String(treatment || "").toLowerCase();
    const dbVote = votesMap.get(key);
    const votes = dbVote ? {
      hilft: Number(dbVote.pro ?? 0),
      gleich: Number(dbVote.neutral ?? 0),
      verschlechterung: Number(dbVote.contra ?? 0),
    } : { hilft: 0, gleich: 0, verschlechterung: 0 };

    // Update nur diese Zeile
    const row = button.closest("tr");
    row.querySelectorAll(".vote-button").forEach(btn => {
      const t = btn.getAttribute("data-type");
      const span = btn.querySelector(".vote-count");
      if (!span) return;
      if (t === "hilft") span.textContent = votes.hilft;
      if (t === "gleich") span.textContent = votes.gleich;
      if (t === "verschlechterung") span.textContent = votes.verschlechterung;
    });

    const totalVotes = votes.hilft + votes.gleich + votes.verschlechterung;
    const improvementRatio = totalVotes > 0 ? ((votes.hilft / totalVotes) * 100).toFixed(2) : "0.00";
    const worseningRatio = totalVotes > 0 ? ((votes.verschlechterung / totalVotes) * 100).toFixed(2) : "0.00";

    row.querySelector("td:nth-last-child(2)").textContent = `${improvementRatio}%`;
    row.querySelector("td:last-child").textContent = `${worseningRatio}%`;

  } catch (err) {
    console.error("❌ Vote Fehler:", err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadBewertungData();

  const tableHeaders = document.querySelectorAll(".bewertung-table thead th");
  tableHeaders.forEach((header, index) => {
    header.addEventListener("click", () => sortTableByColumn(index));
  });
});
