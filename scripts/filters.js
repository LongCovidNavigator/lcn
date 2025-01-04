function applyFilters() {
    try {
        // Get filter values
        const searchValue = document.getElementById("search-input").value.toLowerCase();
        const nutzenFilter = document.getElementById("nutzen-filter").value.toLowerCase();
        const wirkgeschwindigkeitFilter = document.getElementById("wirkgeschwindigkeit-filter").value.toLowerCase();
        const kostenMin = parseFloat(document.getElementById("kosten-min-slider").value);
        const kostenMax = parseFloat(document.getElementById("kosten-max-slider").value);
        const crashrisikoFilter = document.getElementById("crashrisiko-filter").value.toLowerCase();

        // Define hierarchies
        const nutzenHierarchy = ["sehr hoch", "hoch", "mittel", "gering"];
        const wirkgeschwindigkeitHierarchy = ["sofort", "schnell", "mittel", "langsam", "unbekannt"];

        // Get all tables in the sections container
        const tables = document.querySelectorAll("#sections-container table");

        tables.forEach((table) => {
            const rows = table.querySelectorAll("tbody tr"); // Target only rows in tbody

            let hasVisibleRow = false; // Track if any row matches the filters

            rows.forEach((row) => {
                const cells = Array.from(row.querySelectorAll("td"));

                // Search filter
                const matchesSearch = searchValue
                    ? cells.some((cell) => cell.textContent.toLowerCase().includes(searchValue))
                    : true;

                // Nutzen filter logic
                const nutzenCell = row.querySelector("td:nth-child(3)");
                const nutzenValue = nutzenCell ? nutzenCell.textContent.toLowerCase() : "unbekannt";
                const nutzenIndex = nutzenHierarchy.indexOf(nutzenValue);
                const nutzenFilterIndex = nutzenHierarchy.indexOf(nutzenFilter);
                const nutzenMatches = nutzenFilter
                    ? nutzenIndex !== -1 && nutzenIndex <= nutzenFilterIndex
                    : true;

                // Wirkgeschwindigkeit filter logic
                const wirkgeschwindigkeitCell = row.querySelector("td:nth-child(4)");
                const wirkgeschwindigkeitValue = wirkgeschwindigkeitCell
                    ? wirkgeschwindigkeitCell.textContent.toLowerCase()
                    : "unbekannt";
                const wirkgeschwindigkeitIndex = wirkgeschwindigkeitHierarchy.indexOf(
                    wirkgeschwindigkeitValue
                );
                const wirkgeschwindigkeitFilterIndex = wirkgeschwindigkeitHierarchy.indexOf(
                    wirkgeschwindigkeitFilter
                );
                const wirkgeschwindigkeitMatches = wirkgeschwindigkeitFilter
                    ? wirkgeschwindigkeitIndex !== -1 &&
                      wirkgeschwindigkeitIndex <= wirkgeschwindigkeitFilterIndex
                    : true;

                // Kosten min filter logic
                const kostenMinCell = parseFloat(row.querySelector("td:nth-child(6)")?.textContent || 0);
                const kostenMinMatches = !isNaN(kostenMinCell) ? kostenMinCell <= kostenMin : true;

                // Kosten max filter logic
                const kostenMaxCell = parseFloat(row.querySelector("td:nth-child(7)")?.textContent || 0);
                const kostenMaxMatches = !isNaN(kostenMaxCell) ? kostenMaxCell <= kostenMax : true;

                // Crashrisiko filter logic
                const crashrisikoCell = row.querySelector("td:nth-child(8)");
                const crashrisikoValue = crashrisikoCell
                    ? crashrisikoCell.textContent.toLowerCase()
                    : "unbekannt";
                const crashrisikoMatches = crashrisikoFilter
                    ? crashrisikoValue === crashrisikoFilter
                    : true;

                // Show or hide the row based on all filters
                const isVisible =
                    matchesSearch &&
                    nutzenMatches &&
                    wirkgeschwindigkeitMatches &&
                    kostenMinMatches &&
                    kostenMaxMatches &&
                    crashrisikoMatches;

                row.style.display = isVisible ? "" : "none";
                if (isVisible) hasVisibleRow = true; // Mark table as having at least one visible row
            });

            // Always show the table headers if there are rows in the table
            const thead = table.querySelector("thead");
            const tbody = table.querySelector("tbody");

            if (rows.length === 0) {
                // Hide the entire table if there are no rows at all
                table.style.display = "none";
            } else if (hasVisibleRow) {
                // Show the table and headers if there are matching rows
                table.style.display = "";
                if (thead) thead.style.display = "";
                if (tbody) tbody.style.display = "";
            } else {
                // Hide the body but keep the header if no rows match filters
                table.style.display = ""; // Ensure the table itself is visible
                if (thead) thead.style.display = "none";
                if (tbody) tbody.style.display = "none";
            }
        });

        // Update slider values next to the sliders
        document.getElementById("kosten-min-value").textContent = kostenMin;
        document.getElementById("kosten-max-value").textContent = kostenMax;
    } catch (error) {
        console.error("Error applying filters:", error.message);
    }
}
