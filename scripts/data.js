/**
 * Loads treatment data and initializes filters and table rendering.
 */
/**
 * Loads treatment data and initializes filters and table rendering.
 */
async function loadData() {
    try {
        const response = await fetch("assets/data/long_covid_treatments_corrected.json");
        if (!response.ok) throw new Error(`Fehler beim Laden der JSON-Datei: ${response.status} ${response.statusText}`);
        const treatments = await response.json();
        if (!Array.isArray(treatments)) throw new Error("Ungültige JSON-Struktur. Erwartetes Format: Array.");
        
        // Determine max value for costs
        const maxCost = treatments.reduce((max, item) => {
            const costMax = parseFloat(item["Kosten max"]) || 0;
            return Math.max(max, costMax);
        }, 0);

        // Update slider attributes dynamically
        const kostenMinSlider = document.getElementById("kosten-min-slider");
        const kostenMaxSlider = document.getElementById("kosten-max-slider");

        kostenMinSlider.max = maxCost;
        kostenMaxSlider.max = maxCost;
		
		// Set the default value to max
        kostenMinSlider.value = maxCost;
        kostenMaxSlider.value = maxCost;

        // Update slider display values
        document.getElementById("kosten-min-value").textContent = kostenMinSlider.value;
        document.getElementById("kosten-max-value").textContent = kostenMaxSlider.value;

        renderSections(treatments);

        // Add event listeners for filters
        document.getElementById("search-input").addEventListener("input", applyFilters);
        document.getElementById("nutzen-filter").addEventListener("change", applyFilters);
        document.getElementById("wirkgeschwindigkeit-filter").addEventListener("change", applyFilters);
        kostenMinSlider.addEventListener("input", applyFilters);
        kostenMaxSlider.addEventListener("input", applyFilters);
        document.getElementById("crashrisiko-filter").addEventListener("change", applyFilters);
    } catch (error) {
        document.getElementById("error-log").textContent = error.message;
        console.error(error.message);
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
