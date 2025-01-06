async function loadUebersichtData() {
    try {
        const response = await fetch("assets/data/long_covid_treatments_corrected.json");
        if (!response.ok) throw new Error(`Error loading JSON file: ${response.status} ${response.statusText}`);

        const treatments = await response.json();
        renderUebersichtTable(treatments); // Render the table using the adapted function
    } catch (error) {
        console.error("Error loading data:", error.message);
    }
}

/**
 * Renders a flat table with all treatments.
 * @param {Array} treatments - Array of treatment objects.
 */
function renderUebersichtTable(treatments) {
    const table = document.querySelector(".uebersicht-table");
    table.classList.add("uebersicht-table"); // Ensure the class is applied
    const tableBody = table.querySelector("tbody");
    tableBody.innerHTML = ""; // Clear existing content

    treatments.forEach((item, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.Behandlung || "-"}</td>
            <td>${item.Nutzen || "-"}</td>
            <td>${item.Wirkgeschwindigkeit || "-"}</td>
            <td>${item.Aufwand || "-"}</td>
            <td>${item["Kosten min"] || "-"}</td>
            <td>${item["Kosten max"] || "-"}</td>
            <td>${item.Crashrisiko || "-"}</td>
        `;

        tableBody.appendChild(row);
    });
}


// Load the data when the page loads
document.addEventListener("DOMContentLoaded", () => {
    loadUebersichtData();

    // Attach event listeners to all table headers
    const tableHeaders = document.querySelectorAll(".uebersicht-table thead th");
    tableHeaders.forEach((header, index) => {
        header.addEventListener("click", () => sortTableByColumn(index));
    });
});

/*
 * Sorts the Übersicht table by a specific column.
 * @param {number} columnIndex - The index of the column to sort by (0-based).
 */
 
 // Hierarchies for sorting
const nutzenHierarchy = ["sehr hoch", "hoch", "mittel", "gering"];
const wirkgeschwindigkeitHierarchy = ["sofort", "schnell", "mittel", "langsam", "unbekannt"];
const crashrisikoHierarchy = ["gering", "mittel", "hoch", "sehr hoch"];

 function sortTableByColumn(columnIndex) {
    const tableBody = document.querySelector(".uebersicht-table tbody");
    const rows = Array.from(tableBody.querySelectorAll("tr"));

    // Determine the sort order: ascending or descending
    const isAscending = tableBody.getAttribute(`data-sort-order-${columnIndex}`) !== "asc";
    tableBody.setAttribute(`data-sort-order-${columnIndex}`, isAscending ? "asc" : "desc");

    // Sort rows based on the specified column
    rows.sort((rowA, rowB) => {
        const cellA = rowA.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim().toLowerCase();
        const cellB = rowB.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim().toLowerCase();

        function getHierarchyIndex(value, hierarchy, isAscending) {
			// Find the first hierarchy value that matches the beginning of the string
			const index = hierarchy.findIndex(h => value.startsWith(h));
			return index === -1 ? hierarchy.length + (isAscending ? 0 : 1) : index; // Place unmatched values at the end
		}


        if (columnIndex === 2) {
            // Nutzen column
            const indexA = getHierarchyIndex(cellA, nutzenHierarchy, isAscending);
            const indexB = getHierarchyIndex(cellB, nutzenHierarchy, isAscending);
            return indexA - indexB;
        } else if (columnIndex === 3) {
            // Wirkgeschwindigkeit column
            const indexA = getHierarchyIndex(cellA, wirkgeschwindigkeitHierarchy, isAscending);
            const indexB = getHierarchyIndex(cellB, wirkgeschwindigkeitHierarchy, isAscending);
            return indexA - indexB;
        } else if (columnIndex === 7) {
            // Crashrisiko column
            const indexA = getHierarchyIndex(cellA, crashrisikoHierarchy, isAscending);
            const indexB = getHierarchyIndex(cellB, crashrisikoHierarchy, isAscending);
            return indexA - indexB;
        } else if (!isNaN(cellA) && !isNaN(cellB)) {
            // Numeric sort for numerical columns
            return isAscending ? cellA - cellB : cellB - cellA;
        } else {
            // Alphabetical sort for text columns
            return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        }
    });

    // Append the sorted rows back to the table
    rows.forEach(row => tableBody.appendChild(row));

    // Update header to indicate sort direction
    const headers = document.querySelectorAll(".uebersicht-table thead th");
    headers.forEach(header => header.classList.remove("sorted-asc", "sorted-desc")); // Reset classes
    const sortedHeader = document.querySelector(`.uebersicht-table thead th:nth-child(${columnIndex + 1})`);
    sortedHeader.classList.add(isAscending ? "sorted-asc" : "sorted-desc");
}
