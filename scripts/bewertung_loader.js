async function loadBewertungData() {
    try {
        const quelle = window.LCN_DATENQUELLE; // || "assets/data/long_covid_treatments_corrected.json";
        const response = await fetch(quelle);
		
        if (!response.ok) throw new Error(`Error loading JSON file: ${response.status} ${response.statusText}`);

        const treatments = await response.json();
        renderBewertungTable(treatments); // Render the table using the adapted function
    } catch (error) {
        console.error("Error loading data:", error.message);
    }
}