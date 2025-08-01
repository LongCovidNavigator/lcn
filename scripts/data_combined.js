async function loadData() {
    try {
        const urlsAttr = document.getElementById('data-config')?.dataset?.urls;
        if (!urlsAttr) throw new Error("Keine Datenquellen definiert.");
        const urls = JSON.parse(urlsAttr);

        const results = await Promise.all(urls.map(async (url) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Fehler bei ${url}: ${res.status}`);
            return res.json();
        }));

        const allTreatments = results.flat();

        const maxCost = allTreatments.reduce((max, item) => {
            const costMax = parseFloat(item["Kosten max"]) || 0;
            return Math.max(max, costMax);
        }, 0);

        const kostenMinSlider = document.getElementById("kosten-min-slider");
        const kostenMaxSlider = document.getElementById("kosten-max-slider");

        kostenMinSlider.max = maxCost;
        kostenMaxSlider.max = maxCost;
        kostenMinSlider.value = maxCost;
        kostenMaxSlider.value = maxCost;

        document.getElementById("kosten-min-value").textContent = maxCost;
        document.getElementById("kosten-max-value").textContent = maxCost;

        renderSections(allTreatments);

        document.getElementById("search-input").addEventListener("input", applyFilters);
        document.getElementById("nutzen-filter").addEventListener("change", applyFilters);
        document.getElementById("wirkgeschwindigkeit-filter").addEventListener("change", applyFilters);
        document.getElementById("crashrisiko-filter").addEventListener("change", applyFilters);
        kostenMinSlider.addEventListener("input", applyFilters);
        kostenMaxSlider.addEventListener("input", applyFilters);
    } catch (err) {
        console.error(err);
        document.getElementById("error-log").textContent = err.message;
    }
}



/**
 * Renders the table sections grouped by "Eskalationsstufe".
 * @param {Array} treatments - Array of treatment objects.
 */
function renderSections(treatments) {
    const sectionsContainer = document.getElementById("sections-container");
    const groupedData = treatments.reduce((acc, item) => {
        const group = item.Eskalationsstufe || "Unbekannt";
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
    }, {});

    Object.entries(groupedData).forEach(([group, items]) => {
        const section = document.createElement("div");
        section.className = "section";

        const heading = document.createElement("h2");
        heading.textContent = group;
        section.appendChild(heading);

        const table = document.createElement("table");
        table.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Behandlung</th>
                    <th>Nutzen</th>
                    <th>Wirkgeschwindigkeit</th>
                    <th>Aufwand</th>
                    <th>Kosten min</th>
                    <th>Kosten max</th>
                    <th>Crashrisiko</th>
                </tr>
            </thead>
            <tbody>
                ${items
                    .map(
                        (item, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${item.Behandlung || "-"}</td>
                            <td>${item.Nutzen || "-"}</td>
                            <td>${item.Wirkgeschwindigkeit || "-"}</td>
                            <td>${item.Aufwand || "-"}</td>
                            <td>${item["Kosten min"] || "-"}</td>
                            <td>${item["Kosten max"] || "-"}</td>
                            <td>${item.Crashrisiko || "-"}</td>
                        </tr>`
                    )
                    .join("")}
            </tbody>
        `;
        section.appendChild(table);
        sectionsContainer.appendChild(section);
    });
}

// Start loading data on page load
loadData();

