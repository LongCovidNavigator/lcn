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
    const tableBody = document.querySelector(".uebersicht-table tbody");
    tableBody.innerHTML = ""; // Clear existing content

    treatments.forEach((item, index) => {
        const votes = parseInt(localStorage.getItem(item.Behandlung) || 0, 10); // Get stored votes
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
            <td>
                <button class="upvote-button" data-treatment="${item.Behandlung}">
                    👍 <span class="vote-count">${votes}</span>
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });

    // Add event listeners for upvote buttons
    document.querySelectorAll(".upvote-button").forEach(button => {
        button.addEventListener("click", handleUpvote);
    });
}

function handleUpvote(event) {
    const button = event.target.closest(".upvote-button");
    const treatment = button.getAttribute("data-treatment");
    const voteCountSpan = button.querySelector(".vote-count");

    let currentVotes = parseInt(localStorage.getItem(treatment) || 0, 10);
    currentVotes += 1; // Increment vote count

    // Update UI
    voteCountSpan.textContent = currentVotes;

    // Save to local storage
    localStorage.setItem(treatment, currentVotes);
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
	// console.log("sortTableByColumn called with columnIndex:", columnIndex);

    const tableBody = document.querySelector(".uebersicht-table tbody");
    const rows = Array.from(tableBody.querySelectorAll("tr"));

    // Determine the sort order: ascending or descending
    const currentSortOrder = tableBody.getAttribute(`data-sort-order-${columnIndex}`);
    const isAscending = currentSortOrder !== "asc"; // Toggle sort order
    tableBody.setAttribute(`data-sort-order-${columnIndex}`, isAscending ? "asc" : "desc");

	console.log("Order:", isAscending," ",columnIndex);
    // Log column and sort order
    // console.log("Column Index:", columnIndex); // console.log("Current Sort Order:", currentSortOrder);
    // console.log("Current Sort Order:", currentSortOrder);

    // Define the hierarchies
    const nutzenHierarchy = ["sehr hoch", "hoch", "mittel", "gering"];
    const wirkgeschwindigkeitHierarchy = ["sofort", "schnell", "mittel", "langsam", "unbekannt"];
    const crashrisikoHierarchy = ["gering", "mittel", "hoch", "sehr hoch"];

    // Sort rows based on the specified column
    rows.sort((rowA, rowB) => {
        const cellA = rowA.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.toLowerCase().trim();
        const cellB = rowB.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.toLowerCase().trim();

        let indexA, indexB;

        // Handle hierarchical sorting
        if (columnIndex === 1) {
            // Behandlungsoptionen column (alphabetical sort)
            return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        } else if (columnIndex === 2) {
            // Nutzen column
            indexA = nutzenHierarchy.findIndex(h => cellA.startsWith(h));
            indexB = nutzenHierarchy.findIndex(h => cellB.startsWith(h));
        } else if (columnIndex === 3) {
            // Wirkgeschwindigkeit column
            indexA = wirkgeschwindigkeitHierarchy.findIndex(h => cellA.startsWith(h));
            indexB = wirkgeschwindigkeitHierarchy.findIndex(h => cellB.startsWith(h));
        } else if (columnIndex === 7) {
            // Crashrisiko column
            indexA = crashrisikoHierarchy.findIndex(h => cellA.startsWith(h));
            indexB = crashrisikoHierarchy.findIndex(h => cellB.startsWith(h));
        } else if (columnIndex === 4 || columnIndex === 5 || columnIndex === 6) {
            // Parse numbers and handle non-numeric values
			const numA = parseFloat(cellA);
			const numB = parseFloat(cellB);

			// Assign Infinity for non-numeric values to place them at the end
			const indexA = isNaN(numA) ? (isAscending ? Infinity : -Infinity) : numA;
			const indexB = isNaN(numB) ? (isAscending ? Infinity : -Infinity) : numB;


    // Perform numerical comparison
    return isAscending ? indexA - indexB : indexB - indexA;
        } else {
            // Fallback (alphabetical sort for unexpected cases)
            return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        }

        // Log values being compared and their hierarchy indices
        // console.log("Cell A:", cellA, "Index A:", indexA);
        // console.log("Cell B:", cellB, "Index B:", indexB);

        // Handle missing values in hierarchy
		if (indexA === -1) indexA = isAscending ? Infinity : -Infinity; // Always place non-matching values at the end
		if (indexB === -1) indexB = isAscending ? Infinity : -Infinity; // Always place non-matching values at the end


        return isAscending ? indexA - indexB : indexB - indexA;
    });

    // Append the sorted rows back to the table
    rows.forEach(row => tableBody.appendChild(row));

    // Update header to indicate sort direction
    const headers = document.querySelectorAll(".uebersicht-table thead th");
    headers.forEach(header => header.classList.remove("sorted-asc", "sorted-desc")); // Reset classes
    const sortedHeader = document.querySelector(`.uebersicht-table thead th:nth-child(${columnIndex + 1})`);
    sortedHeader.classList.add(isAscending ? "sorted-asc" : "sorted-desc");
}
