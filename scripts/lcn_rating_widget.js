document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/api/get_bewertung.php");
  const daten = await res.json();

  document.querySelectorAll(".lcn-rating-widget").forEach(widget => {
    const therapieName = widget.dataset.name?.trim().toLowerCase();
    if (!therapieName) return;

    const eintrag = daten.find(e => e.Behandlung?.toLowerCase() === therapieName);
    if (!eintrag) {
      widget.innerHTML = `<span style="color: gray">Keine Bewertungsdaten gefunden.</span>`;
      return;
    }

    const v = eintrag["Verbesserung (%)"]?.toFixed(1) || "?";
    const n = eintrag["Neutral (%)"]?.toFixed(1) || "?";
    const s = eintrag["Verschlechterung (%)"]?.toFixed(1) || "?";
    const safeName = encodeURIComponent(eintrag.Behandlung);

    widget.innerHTML = `
      <div class="lcn-widget-box">
        <strong>${v}%</strong> berichten Verbesserung<br>
        ${n}% neutral, ${s}% Verschlechterung<br>
        <a href="/bewertung.html#${safeName}">💬 Bewertungen</a> |
        <a href="/lcnprotocol.html#${safeName}">📊 Protokoll</a>
      </div>
    `;
  });
});
