/**
 * Dynamically maps column headers to their indices for a given table.
 * @param {string} tableSelector - The CSS selector for the table.
 * @returns {Object} A mapping of header names to 1-based indices.
 */
function mapColumnHeaders(tableSelector) {
    const headerMap = {};
    const headers = document.querySelectorAll(`${tableSelector} thead th`);
    headers.forEach((header, index) => {
        headerMap[header.textContent.trim()] = index + 1; // 1-based index for nth-child
    });
    return headerMap;
}

// Example usage after DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Map headers for each table
    const uebersichtHeaderMap = mapColumnHeaders(".uebersicht-table");
    const lcnHeaderMap = mapColumnHeaders(".lcn-table");

    // Debugging: Log both header maps
    console.log("Übersicht Header Map:", uebersichtHeaderMap);
    console.log("LCN Header Map:", lcnHeaderMap);

    // Apply styles dynamically to the "Bewertung" column in Übersicht table
    if (uebersichtHeaderMap["Bewertung"] !== undefined) {
        const bewertungIndex = uebersichtHeaderMap["Bewertung"];
        const style = document.createElement("style");
        style.textContent = `
            table.uebersicht-table th:nth-child(${bewertungIndex}),
            table.uebersicht-table td:nth-child(${bewertungIndex}) {
                width: 200px; /* Adjust width */
                text-align: center;
                vertical-align: middle;
            }
        `;
        document.head.appendChild(style);
    } else {
        console.warn("Bewertung column not found in Übersicht table!");
    }
});
