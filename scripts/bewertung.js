async function loadBewertungData() {
    try {
        const [jsonRes, wikiRes] = await Promise.all([
            fetch("assets/data/long_covid_treatments_corrected.json"),
            fetch("api/get_therapien.php")
        ]);

        if (!jsonRes.ok || !wikiRes.ok) {
            throw new Error("Fehler beim Laden der Datenquellen");
        }

        const json = await jsonRes.json();
        const wiki = await wikiRes.json();

        const gesamt = mergeBehandlungen(json, wiki);
        renderBewertungTable(gesamt);
    } catch (err) {
        console.error("Fehler beim Laden der Daten:", err.message);
    }
}

function mergeBehandlungen(jsonList, wikiList) {
    const behandlungsNamen = new Set(jsonList.map(e => e.Behandlung.toLowerCase()));

    const gefilterteWiki = wikiList
        .filter(e => !behandlungsNamen.has((e.Behandlung || e.title || "").toLowerCase()))
        .map(e => ({
            Behandlung: e.Behandlung || e.title,
            id: e.id || e.slug
        }));

    return [...jsonList, ...gefilterteWiki];
}


function renderBewertungTable(treatments) {
    const tableBody = document.querySelector(".bewertung-table tbody");
    tableBody.innerHTML = ""; // Clear existing content

    treatments.forEach((item, index) => {
        // Get stored votes or initialize with random values
        let votes = localStorage.getItem(item.Behandlung);
        if (!votes) {
            votes = {
                hilft: Math.floor(Math.random() * 101), // Random between 0 and 100
                gleich: Math.floor(Math.random() * 101),
                verschlechterung: Math.floor(Math.random() * 101),
            };
            localStorage.setItem(item.Behandlung, JSON.stringify(votes));
        } else {
            votes = JSON.parse(votes);
        }

        // Calculate ratios
        const totalVotes = votes.hilft + votes.gleich + votes.verschlechterung;
        const improvementRatio = totalVotes > 0 ? Math.round((votes.hilft / totalVotes) * 100) : 0;
		const worseningRatio = totalVotes > 0 ? Math.round((votes.verschlechterung / totalVotes) * 100) : 0;


        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.Behandlung || "-"}</td>
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
            <td>${worseningRatio}%</td> <!-- New column -->
        `;

        tableBody.appendChild(row);
    });

    // Add event listeners for voting buttons
    document.querySelectorAll(".vote-button").forEach(button => {
        button.addEventListener("click", handleVote);
    });
}







function handleVote(event) {
    const button = event.target.closest(".vote-button");
    const treatment = button.getAttribute("data-treatment");
    const voteType = button.getAttribute("data-type");

    // Get stored votes or initialize
    const votes = JSON.parse(localStorage.getItem(treatment) || '{"hilft": 0, "gleich": 0, "verschlechterung": 0}');
    
    // Increment the vote count for the selected type
    votes[voteType] += 1;

    // Update local storage
    localStorage.setItem(treatment, JSON.stringify(votes));

    // Update the UI
    const voteCountSpan = button.querySelector(".vote-count");
    voteCountSpan.textContent = votes[voteType];

    // Recalculate ratios
    const totalVotes = votes.hilft + votes.gleich + votes.verschlechterung;
    const improvementRatio = totalVotes > 0 ? ((votes.hilft / totalVotes) * 100).toFixed(2) : "0.00";
    const worseningRatio = totalVotes > 0 ? ((votes.verschlechterung / totalVotes) * 100).toFixed(2) : "0.00";

    // Update the respective cells
    const row = button.closest("tr");
    row.querySelector("td:nth-last-child(2)").textContent = `${improvementRatio}%`; // "Verbesserung"
    row.querySelector("td:last-child").textContent = `${worseningRatio}%`; // "Verschlechterung"
}





// Load the data when the page loads
document.addEventListener("DOMContentLoaded", () => {
    loadBewertungData();

    // Attach event listeners to all table headers
    const tableHeaders = document.querySelectorAll(".bewertung-table thead th");
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

    const tableBody = document.querySelector(".bewertung-table tbody");
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

        } else {
            // Parse numbers and handle non-numeric values
			const numA = parseFloat(cellA);
			const numB = parseFloat(cellB);

			// Assign Infinity for non-numeric values to place them at the end
			const indexA = isNaN(numA) ? (isAscending ? Infinity : -Infinity) : numA;
			const indexB = isNaN(numB) ? (isAscending ? Infinity : -Infinity) : numB;


			// Perform numerical comparison
			return isAscending ? indexA - indexB : indexB - indexA;
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
    const headers = document.querySelectorAll(".bewertung-table thead th");
    headers.forEach(header => header.classList.remove("sorted-asc", "sorted-desc")); // Reset classes
    const sortedHeader = document.querySelector(`.bewertung-table thead th:nth-child(${columnIndex + 1})`);
    sortedHeader.classList.add(isAscending ? "sorted-asc" : "sorted-desc");
}
