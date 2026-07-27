import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "C:/Users/willi/Downloads/doctors_missing_locations_88.csv";
const outputDir = "C:/xampp/htdocs/lcn/outputs/doctors_location_review_20260726";
const outputPath = path.join(outputDir, "doctors_location_manual_review.xlsx");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ""; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift().map((v, i) => i === 0 ? v.replace(/^\uFEFF/, "") : v);
  return rows.filter(r => r.some(v => v !== "")).map(values =>
    Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]))
  );
}

function classify(row) {
  const special = row.activity_status === "closed" || row.multiple_locations === "yes" ||
    Boolean(row.entity_issue) || row.plz_match === "no";
  if (special) return { priority: 1, group: "1 – Sonderfall" };
  if (["ambiguous", "manual_research_required"].includes(row.result_status))
    return { priority: 2, group: "2 – Offen" };
  if (row.result_status === "probable") return { priority: 3, group: "3 – Wahrscheinlich" };
  return { priority: 4, group: "4 – Direkt übernehmbar" };
}

const raw = parseCsv(await fs.readFile(inputPath, "utf8"));
const enriched = raw.map(row => ({ ...row, ...classify(row) }))
  .sort((a, b) => a.priority - b.priority || a.result_status.localeCompare(b.result_status) || Number(a.dr_id) - Number(b.dr_id));

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Übersicht");
const review = workbook.worksheets.add("Prüfliste");
const codebook = workbook.worksheets.add("Codebuch");
workbook.comments.setSelf({ displayName: "User" });

summary.showGridLines = false;
review.showGridLines = false;
codebook.showGridLines = false;

summary.getRange("A1:H2").merge();
summary.getRange("A1").values = [["Standortrecherche – manuelle Prüfmappe"]];
summary.getRange("A1:H2").format = {
  fill: "#16324F", font: { bold: true, color: "#FFFFFF", size: 18 },
  verticalAlignment: "center", horizontalAlignment: "left"
};
summary.getRange("A4:B4").values = [["Prüfgruppe", "Anzahl"]];
summary.getRange("A5:A8").values = [["1 – Sonderfall"], ["2 – Offen"], ["3 – Wahrscheinlich"], ["4 – Direkt übernehmbar"]];
summary.getRange("B5").formulas = [["=COUNTIF('Prüfliste'!$B$2:$B$89,A5)"]];
summary.getRange("B5:B8").fillDown();
summary.getRange("D4:E4").values = [["Qualitätsmerkmal", "Anzahl"]];
summary.getRange("D5:D8").values = [["PLZ-Konflikte"], ["Geschlossene Praxen"], ["Mehrstandorte"], ["Entitätsprobleme"]];
summary.getRange("E5:E8").formulas = [
  ["=COUNTIF('Prüfliste'!$O$2:$O$89,\"no\")"],
  ["=COUNTIF('Prüfliste'!$R$2:$R$89,\"closed\")"],
  ["=COUNTIF('Prüfliste'!$S$2:$S$89,\"yes\")"],
  ["=SUM('Prüfliste'!$AB$2:$AB$89)"],
];
summary.getRange("A10:H11").merge();
summary.getRange("A10").values = [["Empfohlene Reihenfolge: zuerst Sonderfälle, anschließend offene und wahrscheinliche Treffer prüfen. Erst danach bestätigte Adressen geocodieren."]];
summary.getRange("A10:H11").format = { fill: "#E8F1F8", font: { color: "#16324F" }, wrapText: true, verticalAlignment: "center" };
summary.getRange("A4:B8").format.borders = { preset: "outside", style: "thin", color: "#B8C6D1" };
summary.getRange("D4:E8").format.borders = { preset: "outside", style: "thin", color: "#B8C6D1" };
summary.getRange("A4:B4").format = { fill: "#2E5D7B", font: { bold: true, color: "#FFFFFF" } };
summary.getRange("D4:E4").format = { fill: "#2E5D7B", font: { bold: true, color: "#FFFFFF" } };
summary.getRange("B5:B8").format.numberFormat = "0";
summary.getRange("E5:E8").format.numberFormat = "0";
summary.getRange("A5:A5").format.fill = "#FDE2E1";
summary.getRange("A6:A6").format.fill = "#FFF2CC";
summary.getRange("A7:A7").format.fill = "#DDEBF7";
summary.getRange("A8:A8").format.fill = "#E2F0D9";
summary.getRange("A1:H11").format.font = { name: "Aptos", size: 11 };
summary.getRange("A1:H2").format.font = { name: "Aptos Display", size: 18, bold: true, color: "#FFFFFF" };
summary.getRange("A:A").format.columnWidth = 26;
summary.getRange("B:B").format.columnWidth = 12;
summary.getRange("C:C").format.columnWidth = 4;
summary.getRange("D:D").format.columnWidth = 25;
summary.getRange("E:E").format.columnWidth = 12;
summary.getRange("F:H").format.columnWidth = 12;

const headers = [
  "review_priority", "review_group", "dr_id", "dr_display_name", "dr_org_name", "website",
  "loc_country_existing", "loc_plz_existing", "found_country", "found_plz", "found_city",
  "found_street", "found_housenumber", "address_full", "plz_match", "result_status", "confidence",
  "activity_status", "multiple_locations", "alternate_locations", "entity_issue", "source_page_url",
  "evidence_note", "external_review_note", "validation_required", "review_decision", "review_comment", "entity_issue_flag"
];
const rows = enriched.map(row => [
  row.priority, row.group, row.dr_id, row.dr_display_name, row.dr_org_name === "NULL" ? "" : row.dr_org_name,
  row.website, row.loc_country, row.loc_plz, row.found_country, row.found_plz, row.found_city,
  row.found_street, row.found_housenumber, row.address_full, row.plz_match, row.result_status, row.confidence,
  row.activity_status, row.multiple_locations, row.alternate_locations, row.entity_issue, row.source_page_url,
  row.evidence_note, row.external_review_note, row.validation_required, "offen", "", null
]);
review.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
review.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
review.getRange("AB2").formulas = [["=IF(LEN(U2)>0,1,0)"]];
review.getRange(`AB2:AB${rows.length + 1}`).fillDown();
review.tables.add(`A1:AB${rows.length + 1}`, true, "LocationReviewTable").style = "TableStyleMedium2";
review.freezePanes.freezeRows(1);
review.freezePanes.freezeColumns(4);
review.getRange("A1:AB1").format = { fill: "#16324F", font: { bold: true, color: "#FFFFFF" }, wrapText: true, verticalAlignment: "center" };
review.getRange("A1:AB1").format.rowHeight = 34;
review.getRange(`Z2:AA${rows.length + 1}`).format = { fill: "#FFF2CC", wrapText: true };
review.getRange(`Z2:Z${rows.length + 1}`).dataValidation = { rule: { type: "list", values: ["offen", "freigeben", "ablehnen", "erneut recherchieren"] } };
review.getRange(`B2:B${rows.length + 1}`).conditionalFormats.add("containsText", { text: "1 – Sonderfall", format: { fill: "#F4CCCC", font: { bold: true, color: "#9C0006" } } });
review.getRange(`B2:B${rows.length + 1}`).conditionalFormats.add("containsText", { text: "2 – Offen", format: { fill: "#FFF2CC", font: { color: "#7F6000" } } });
review.getRange(`B2:B${rows.length + 1}`).conditionalFormats.add("containsText", { text: "3 – Wahrscheinlich", format: { fill: "#DDEBF7", font: { color: "#1F4E78" } } });
review.getRange(`B2:B${rows.length + 1}`).conditionalFormats.add("containsText", { text: "4 – Direkt übernehmbar", format: { fill: "#E2F0D9", font: { color: "#375623" } } });
review.getRange(`O2:O${rows.length + 1}`).conditionalFormats.add("containsText", { text: "no", format: { fill: "#F4CCCC", font: { bold: true, color: "#9C0006" } } });
review.getRange(`R2:R${rows.length + 1}`).conditionalFormats.add("containsText", { text: "closed", format: { fill: "#D9D9D9", font: { bold: true, color: "#595959" } } });
review.getRange("A:A").format.columnWidth = 10;
review.getRange("B:B").format.columnWidth = 22;
review.getRange("C:C").format.columnWidth = 10;
review.getRange("D:E").format.columnWidth = 24;
review.getRange("F:F").format.columnWidth = 28;
review.getRange("G:M").format.columnWidth = 15;
review.getRange("N:N").format.columnWidth = 38;
review.getRange("O:S").format.columnWidth = 18;
review.getRange("T:U").format.columnWidth = 42;
review.getRange("V:V").format.columnWidth = 45;
review.getRange("W:X").format.columnWidth = 55;
review.getRange("Y:Z").format.columnWidth = 20;
review.getRange("AA:AA").format.columnWidth = 45;
review.getRange("AB:AB").format.columnWidth = 16;
review.getRange(`A2:AB${rows.length + 1}`).format.verticalAlignment = "top";
review.getRange(`D2:AB${rows.length + 1}`).format.wrapText = true;
review.getRange(`C2:C${rows.length + 1}`).format.numberFormat = "@";
review.getRange(`H2:H${rows.length + 1}`).format.numberFormat = "@";
review.getRange(`J2:J${rows.length + 1}`).format.numberFormat = "@";

const codeRows = [
  ["Feld/Wert", "Bedeutung"],
  ["1 – Sonderfall", "PLZ-Konflikt, Mehrstandort, geschlossene Praxis oder Entitätsproblem; zuerst prüfen."],
  ["2 – Offen", "Recherche bleibt mehrdeutig oder erfordert zusätzliche manuelle Klärung."],
  ["3 – Wahrscheinlich", "Adresse ist plausibel und belegt, aber noch nicht abschließend freigegeben."],
  ["4 – Direkt übernehmbar", "Adresse ist bestätigt und weist keinen bekannten Sonderfall auf."],
  ["review_decision", "Manuelle Entscheidung: offen, freigeben, ablehnen oder erneut recherchieren."],
  ["activity_status", "Aktivitätsstatus; leer bedeutet nicht geprüft oder nicht ausdrücklich dokumentiert."],
  ["alternate_locations", "Weitere bekannte Standorte; nicht automatisch als Primärstandort verwenden."],
  ["entity_issue", "Hinweis auf Namens-, Personen-, Organisations- oder Dublettenprobleme."],
  ["validation_required", "Bleibt bis zur fachlichen Freigabe auf yes."],
];
codebook.getRangeByIndexes(0, 0, codeRows.length, 2).values = codeRows;
codebook.getRange("A1:B1").format = { fill: "#16324F", font: { bold: true, color: "#FFFFFF" } };
codebook.getRange(`A2:A${codeRows.length}`).format.font = { bold: true, color: "#16324F" };
codebook.getRange(`A1:B${codeRows.length}`).format.borders = { preset: "outside", style: "thin", color: "#B8C6D1" };
codebook.getRange("A:A").format.columnWidth = 28;
codebook.getRange("B:B").format.columnWidth = 85;
codebook.getRange(`A1:B${codeRows.length}`).format.wrapText = true;
codebook.freezePanes.freezeRows(1);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const summaryPreview = await workbook.render({ sheetName: "Übersicht", range: "A1:H11", scale: 1.4, format: "png" });
await fs.writeFile(path.join(outputDir, "preview_summary.png"), new Uint8Array(await summaryPreview.arrayBuffer()));
const listPreview = await workbook.render({ sheetName: "Prüfliste", range: "A1:Q14", scale: 1.0, format: "png" });
await fs.writeFile(path.join(outputDir, "preview_review_list.png"), new Uint8Array(await listPreview.arrayBuffer()));

const check = await workbook.inspect({ kind: "table", range: "Übersicht!A1:E11", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 6 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log(errors.ndjson);

console.log(JSON.stringify({ outputPath, rows: rows.length, groups: Object.fromEntries([1,2,3,4].map(p => [p, enriched.filter(r => r.priority === p).length])) }));
