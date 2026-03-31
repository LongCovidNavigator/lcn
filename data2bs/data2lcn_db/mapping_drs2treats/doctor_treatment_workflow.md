# Doctor ↔ Treatment Workflow (LCN)

Status: Review
Version: 0.2

## Zielbild
Produktseitig ist das Ziel doctor-zentriert: Das Behandlungsspektrum aller Ärzt:innen
soll möglichst vollständig, individuell (je Arzt, Therapeut oder Organisation) und
korrekt abgebildet werden. Operativ erfolgt die Recherche quellenbasiert und iterativ.
## Kurzablauf
Der Kurzablauf und der nachfolgende Section-/Task-Block beschreiben denselben Workflow.
Der Kurzablauf ist die kompakte Übersicht; der Section-/Task-Block ist die ausführliche Arbeitsfassung.

### Section 1) Workflowanalyse
1.1 Prompting-Feedback-Loop durchführen  
1.2 Workflow-Dokument anpassen  
1.3 Leitlinien anpassen  
1.4 Quellenmaster updaten  
1.5 Prompt für Section 2 erstellen  

### Section 2) Quelle auswählen
2.1 Aufwand-Nutzen und Recherche-Komplexität je Quelle bewerten  
2.2 Bearbeitungsreihenfolge festlegen  
2.3 Fokus der jeweiligen Quellenrunde definieren / nächste Quelle festlegen  

### Section 3) Verfahrensbestimmung
3.1 Expertencheck für die Quelle durchführen  
3.2 Suchverfahren für die Quelle festlegen  
3.3 Umsetzungsmethode festlegen  
3.4 Verfahren basierend auf Suchverfahren und Umsetzungsmethode entwickeln und ggf. implementieren  

### Section 4) Matching Dr2T, ID-Mapping und Validierung
4.1 Matching File befüllen
4.2 Fachliche Bereinigung / Review
4.3 ID-Mapping
4.4 Backlog für fehlende Ärzte und Behandlungen im Matching File führen
4.5 QA vor Import

### Section 5) Hochladen in die Datenbank
5.1 Dubletten prüfen  
5.2 Matching File in die Zieltabelle importieren  
5.3 Tabelle bzw. Upload in der Datenbank validieren  
5.4 Status im Quellenmaster aktualisieren  
5.5 Prompt für Section 6 erstellen  

### Section 6) Qualitätssicherung
6.1 Coverage-/Validierungsschritt einbauen  
6.2 Batch-Dateien konsolidieren  

## Section- und Task-Struktur
Der folgende Block ist die ausführliche Fassung des Kurzablaufs.
Er beschreibt denselben Workflow detaillierter mit Input, Output und Einzahl-Zielen.

### Section 1) Workflowanalyse
**Ziel:** Feedback aus der letzten Iteration auswerten und die zentralen Arbeitsdokumente aktualisieren.

**Input**
- Chatti-Quellen
- Masterfiles
- Feedback aus der Iteration davor
- ggf. Datenbankstrukturen

**Output**
- aktualisierte Chatti-Quellen
- aktualisierte Masterfiles
- 10/10-Prompt für Section 2

**Tasks**
**1.1 Prompting-Feedback-Loop durchführen**  
→ zahlt ein auf `doctor_treatment_workflow.md`, `doctor_treatment_mapping_rules.md`, `mapping_drs2treat_master.csv`

**1.2 Workflow-Dokument anpassen**  
→ zahlt ein auf `doctor_treatment_workflow.md`

**1.3 Leitlinien anpassen**  
→ zahlt ein auf `doctor_treatment_mapping_rules.md`

**1.4 Quellenmaster updaten**  
→ zahlt ein auf `mapping_drs2treat_master.csv`

**1.5 Prompt für Section 2 erstellen**  
→ zahlt ein auf 10/10-Prompt für Section 2

### Section 2) Quelle auswählen
**Ziel:** Die nächste Quelle auf Basis von QA-Auswertung und Quellenplanung auswählen.

**Input**
- 10/10-Prompt aus Section 1
- QA-Auswertung
- `source_processing_plan_v2.csv`

**Output**
- aktualisierte `source_processing_plan_v2.csv`
- nächste Quelle aus `source_processing_plan_v2.csv`

**Tasks**
**2.1 Aufwand-Nutzen und Recherche-Komplexität je Quelle bewerten**  
→ zahlt ein auf `source_processing_plan_v2.csv`

**2.2 Bearbeitungsreihenfolge festlegen**  
→ zahlt ein auf `source_processing_plan_v2.csv`

**2.3 Fokus der jeweiligen Quellenrunde definieren / nächste Quelle festlegen**  
→ zahlt ein auf `source_processing_plan_v2.csv`

### Section 3) Verfahrensbestimmung
**Ziel:** Für die ausgewählte Quelle das  Suchverfahren, die Umsetzungsmethode und Leitlinienmodus festlegen und bei Bedarf direkt vorbereiten.

**Input**
- ausgewählte Quelle
- 10/10-Prompt aus Section 2
- Chatti-Quellen
- relevante Pfade
- ggf. Datenbankstrukturen

**Output**
- 10/10-Prompt für Section 4 mit Verfahren und Umsetzungsmethode
- ggfs. Notizen für Leitlinienmodus (wenn komplex)

**Tasks**
**3.1 Expertencheck für die Quelle durchführen**  
→ zahlt ein auf 10/10-Prompt für Section 4

**3.2 Suchverfahren für die Quelle festlegen**  
→ zahlt ein auf 10/10-Prompt für Section 4

**3.3 Umsetzungsmethode festlegen**  
→ zahlt ein auf 10/10-Prompt für Section 4

**3.4 Leitlinienmodus inkl. Vereinfachungsgrad und Begriffslogik festlegen**  
→ zahlt ein auf 10/10-Prompt für Section 4

**3.5 Prompt für Section 4 inkl. Workflow-Auszug erstellen**  
→ zahlt ein auf 10/10-Prompt für Section 4

### Section 4) Matching Dr2T, ID-Mapping und Validierung
**Ziel:** Das Matching File befüllen, fachlich bereinigen, technische IDs zuordnen, Backlog mitführen und den validierten Stand für den Upload vorbereiten.

**Input**
- 10/10-Prompt aus Section 3
- Quelle
- Pfade
- `mapping_drs2treat_master.csv`
- ggf. weitere Matching-Referenzen
- ggf. Treatments-Tabelle / Alias-Referenz / Datenbank-Referenz

**Output**
- Matching File
- 10/10-Prompt für Section 5

**Tasks**
**4.1 Matching File befüllen**  
→ zahlt ein auf Matching File

**4.2 Fachliche Bereinigung / Review**  
→ zahlt ein auf Matching File  
→ beinhaltet insbesondere: schwammige, zu allgemeine oder nicht hinreichend konkrete Einträge entfernen, behalten oder als Grenzfall dokumentieren

**4.3 ID-Mapping**  
→ zahlt ein auf Matching File  
→ beinhaltet das technische Matching der bereits fachlich bestätigten Behandlungseinträge gegen die Treatment-Referenz / Datenbank zur Ermittlung belastbarer `treat_id`

**4.4 Backlog für fehlende Ärzte und Behandlungen im Matching File führen**  
→ zahlt ein auf Matching File  
→ beinhaltet auch offene Matching-Fälle, fehlende Alias-Zuordnungen und noch nicht sauber auflösbare Begriffe

**4.5 QA vor Import**  
→ zahlt ein auf Matching File und 10/10-Prompt für Section 5  
→ beinhaltet auch: unsichere Matches final entscheiden oder offen lassen

### Section 5) Hochladen in die Datenbank
**Ziel:** Den validierten Stand in die Zieltabelle hochladen und den Upload fachlich sowie technisch validieren.

**Input**
- 10/10-Prompt aus Section 4
- Matching File
- `.env`
- ggf. Datenbankstrukturen

**Output**
- Datenbank
- 10/10-Prompt für Section 6

**Tasks**
**5.1 Dubletten prüfen**  
→ zahlt ein auf Matching-Tabelle und Upload-Validierung

**5.2 Matching File in die Zieltabelle importieren**  
→ zahlt ein auf Matching-Tabelle in der Datenbank

**5.3 Tabelle bzw. Upload in der Datenbank validieren**  
→ zahlt ein auf validierten DB-Stand

**5.4 Status im Quellenmaster aktualisieren**  
→ zahlt ein auf `source_processing_plan_v2.csv`

**5.5 Prompt für Section 6 erstellen**  
→ zahlt ein auf 10/10-Prompt für Section 6

**Technischer Input für diese Section**
- `.env` unter `C:\xampp\htdocs\lcn\data2bs\data2lcn_db\.env`
- Aufbau über `LCN_DB_HOST`, `LCN_DB_PORT`, `LCN_DB_USERNAME`, `LCN_DB_PASSWORD`, `LCN_DB_DATABASE`

### Section 6) Qualitätssicherung
**Ziel:** Mehrquellen-QA, Coverage und Konsolidierung nach mehreren bearbeiteten Quellen.

**Input**
- 10/10-Prompt aus Section 5
- Matching-Tabelle
- Drs-Tabelle
- Treatments-Tabelle
- vorhandene Batch-/Konsolidierungsstände

**Output**
- QA-/Coverage-Stand
- Konsolidierungsstand
- 10/10-Prompt für Section 1

**Tasks**
**6.1 Coverage-/Validierungsschritt einbauen**  
→ zahlt ein auf QA-/Coverage-Stand

**6.2 Batch-Dateien konsolidieren**  
→ zahlt ein auf Konsolidierungsstand

## Pilotquellen
Geplanter Start:
- Dr. Stingl PDF
- Strasser PDF

Diese beiden Quellen dienen als Testlauf für den administrativen Ablauf, das Regelwerk und das
Batch-Dateiformat.

Bei Dokumentquellen wie Stingl und Strasser ist besonders wichtig:
- saubere Evidenzdokumentation
- klare Trennung zwischen Behandlung, Empfehlung, Diagnostik und supportiver Maßnahme
- fachliche Review vor technischem Matching

## Erweiterte Quellenliste (aktuell geplant)
- PDFs von Dr. Stingl
- PDFs von Strasser
- URLs aus tbl_drs_03
- Restliche Quellen aus tbl_treatments_sources_03 außer Stingl und Strasser
- Restliche Quellen aus `tbl_sources_03` (außer Fasynation)
- Fasynation
- bereitgestellte Listen mit Seiten
- bereitgestellte Listen mit Dokumenten
- Expertenwissen des Nutzers
- Internetrecherche (durch ChatGPT / Web)
- Long Covid Deutschland Facebook Gruppe
- Long Covid Chat Köln

## Fokuslogik pro Quelle
Die Bearbeitung einer Quelle kann unterschiedlich fokussiert sein, z. B.:
- auf genau einen Arzt
- auf eine bestimmte Behandlung
- auf einen Symptomkomplex
- auf eine klar definierte Teilmenge innerhalb einer Quelle

Der administrative Ablauf bleibt möglichst stabil.
Variieren dürfen insbesondere:
- fachlicher Fokus
- Quellentyp
- Extraktionslogik
- Review-Schwerpunkte
- quellenbezogene Sonderregeln

## Speicherung
- Fortschritt im Quellenmaster
- Pro Quelle / Batch eine operative Batch-Datei
- Als operative Vorlage dient aktuell `mapping_drs2treat_master.csv`
- Die Batch-Datei ist Arbeits-, Review- und Übergabeartefakt
- Matching ergänzt die Batch-Datei nur um technische Matching-Felder
- Spätere Zusammenführung in einen separaten Konsolidierungsstand

## Operative Batch-Datei
Die operative Batch-Datei führt mindestens folgende Felder:

- id
- decision
- dr_id
- doctor_name
- treatment_name_raw
- treatment_name_normalized
- review_mapping
- review_mapping_notes
- recommendation_type
- evidence_excerpt
- evidence_strength
- treat_id
- treat_match_status
- match_notes
- review_matching
- review_matching_notes
- alias_name
- alias_type
- sort_order
- notes
- source_batch_id
- source_id
- source_name

Hinweis:
- Mapping-File und Matching-File dürfen unterschiedliche Spaltenreihenfolgen haben,
  wenn dies der operativen Prüfung dient.
- Maßgeblich bleibt die Feldbedeutung, nicht die starre Position.


## Fachliche Review vor Matching
Vor technischem Matching wird die Batch-Datei fachlich geprüft.

Dabei werden insbesondere geprüft:
- klare Evidenz für praktische Anwendung
- offene Fälle
- exclude-Fälle
- Trennung zwischen Behandlung, Empfehlung, Diagnostik und supportiver Maßnahme
- Nachvollziehbarkeit der evidence_excerpt-Dokumentation

## Technisches Matching
Technisches Matching ist ein eigener Arbeitsschritt nach der fachlichen Review.

Grundprinzipien:
- Matching und Import bleiben getrennte Arbeitsschritte
- Das Matching ergänzt nur technische Matching-Felder
- Im Matching-Schritt erfolgt kein Import in die Koppeltabelle
- Im Matching-Schritt werden keine neuen Treatments angelegt
- Bereits vorhandene treat_id werden geschützt und nicht blind überschrieben
- decision = 0 wird nicht gematcht
- Primärer Matching-Input ist treatment_name_normalized
- Fallback ist treatment_name_raw

## Import-Vorbereitung
Die Import-Vorbereitung erfolgt erst nach fachlicher Review und technischem Matching.

Standards:
- Import standardmäßig als Dry Run
- Echter Import nur explizit per Apply-Flag
- Dry Run erzeugt eine lokale Preview-CSV
- Import erfolgt nur für matched_exact und matched_alias
- Die Duplikatprüfung orientiert sich an der realen Zieltabelle
- Die Preview soll doctor_name aus der CSV und treatment_name aus der Treatment-Referenz enthalten

## recommendation_type
Das Feld `recommendation_type` wird in der Batch-Datei sichtbar geführt und darf nicht nur in
`notes` versteckt werden.

Es dient der nachvollziehbaren Trennung unterschiedlicher Maßnahmenarten im Review- und
Weiterverarbeitungsprozess.

Die fachlichen Definitionen, erlaubten Werte und Beispiele werden im Regelwerk gepflegt,
nicht im Workflow-Dokument.

## Batch-Kennung
Jede Quelleniteration erhält eine eindeutige `source_batch_id`.

Die `source_batch_id` wird konsistent verwendet in:
- der operativen Batch-Datei
- Matching-Dateien / Matching-Ergebnissen
- Import-Preview-Dateien
- dem Quellenmaster

## Validierung / Coverage
Als eigener Zwischenschritt vorgesehen:
- Wie viele Ärzte haben mindestens ein Treatment-Match?
- Wie viele Treatments haben mindestens ein Doctor-Match?
- Welche Ärzte haben noch gar kein Match?
- Welche Treatments haben noch gar kein Match?
- Führt die Coverage-Lage zu einer Anpassung der Quellenreihenfolge?

Dieser Schritt ist vor allem nach mehreren bearbeiteten Batches relevant und muss nicht
zwingend nach jeder Einzelquelle vollständig durchgeführt werden.

## Prompting-Feedback-Loop
Nach jeder Iteration:
- Was lief gut?
- Was war unklar?
- Welche Instruktionen sollten im nächsten Prompt präziser sein?
- Müssen Fokus, Extraktion oder Speicherung angepasst werden?
- War der Source-Kontext früh genug geklärt?
- War die Ziel-Batch-Datei vor Start eindeutig?
- Waren Sonderregeln der Quelle klar genug?
- War die Abgrenzung zwischen Behandlung, Empfehlung, Diagnostik und supportiver Maßnahme sauber genug?
- Müssen Workflow, Regelwerk, Batch-Template oder Quellenmaster angepasst werden?

## Prompt-Regeln für alle zukünftigen Prompts, die von ChatGPT für uns erstellt werden sollen

Diese Regeln gelten für alle zukünftigen Prompts im Doctor↔Treatment-Workflow.

### Ziel
Prompts sollen so gebaut werden, dass:
- keine Annahmen getroffen werden
- fehlende Informationen früh sichtbar werden
- Widersprüche und Unklarheiten nicht übergangen werden
- Halluzinationen, Rateschlüsse und unnötige Nacharbeit möglichst vermieden werden
- der jeweils aktuelle Workflow-Schritt klar im Prompt verankert ist

### Verbindliche Regeln
- Keine Annahmen treffen.
- Keine Lücken durch Modellierung, Rekonstruktion oder Schätzung schließen.
- Fehlende Informationen ausdrücklich benennen.
- Widersprüche ausdrücklich benennen.
- Unklarheiten ausdrücklich benennen.
- Nicht stillschweigend glätten, zusammenziehen oder umdeuten.
- Keine neuen Records erfinden.
- Keine Rekonstruktion ohne belastbare Grundlage.
- Begrifflich konsistent bleiben.
- Der passende Eintrag der jeweils bearbeiteten Section aus `doctor_treatment_workflow.md` ist im Prompt ausdrücklich mitzuführen.
- Der Prompt soll sich dabei mindestens auf Ziel, Input, Output und relevante Tasks der jeweiligen Section beziehen.

### Pflichtblock für zukünftige Prompts
Jeder zukünftige Prompt soll am Ende zusätzlich verlangen:

1. Was brauchst du noch von mir?
2. Welche Infos fehlen dir?
3. Wo gibt es Widersprüche oder Unklarheiten?
4. Welche Punkte sollten künftig standardmäßig in diesen Prompt-Typ aufgenommen werden?

### Mini-Template für Prompt-Verankerung im Workflow
Dieser Baustein soll in zukünftigen workflowbezogenen Prompts sinngemäß mitgeführt werden:

> Beziehe den passenden Eintrag der bearbeiteten Section aus `doctor_treatment_workflow.md` ausdrücklich mit ein und arbeite daran entlang.  
> Nenne dabei mindestens:
> - Ziel der Section
> - Input
> - Output
> - relevante Tasks

### Mini-Template für den Pflichtblock am Prompt-Ende
Dieser Baustein soll in zukünftigen Prompts sinngemäß mitgeführt werden:

> Bitte beantworte am Ende zusätzlich:
> 1. Was brauchst du noch von mir?
> 2. Welche Infos fehlen dir?
> 3. Wo gibt es Widersprüche oder Unklarheiten?
> 4. Welche Punkte sollten künftig standardmäßig in diesen Prompt-Typ aufgenommen werden?

### Zweck dieser Regeln
Diese Prompt-Regeln dienen dazu,
- unnötige Fehlversuche zu vermeiden
- Quellenkontext, Arbeitsmodus und Zielartefakte früher zu klären
- Raten und Halluzinationen aktiv zu verhindern
- die Qualität der Prompts iterativ zu verbessern
- den Workflow konsistent an den tatsächlichen Arbeitsprozess zu binden

## Sequenzielle Bearbeitung innerhalb einer Section

Die Tasks einer Section werden im Regelfall **sequenziell** bearbeitet, nicht parallel in einer einzigen Sammelantwort.

Grundprinzipien:
- Innerhalb einer Section wird immer nur der **aktuell nächste sinnvolle Task** bearbeitet.
- Spätere Tasks derselben Section sollen erst bearbeitet werden, wenn die davorliegenden Tasks ausreichend geklärt oder abgeschlossen sind.
- Wenn Tasks inhaltlich aufeinander aufbauen, ist diese Reihenfolge verbindlich.
- Antworten sollen sich auf den jeweils aktuellen Task konzentrieren und nicht vorzeitig Ergebnisse für alle Folgetasks zusammenziehen.
- Ziel ist ein operativ klarer, kürzerer und besser prüfbarer Arbeitsablauf.

Wichtig:
- Eine Section kann in einem Chat bearbeitet werden, aber nicht zwingend in einer einzigen Antwort.
- Wenn sinnvoll, soll innerhalb der Section schrittweise von Task zu Task gearbeitet werden.
- Der Prompt für eine Section soll deshalb klar machen, ob
  - die ganze Section nur vorbereitet wird,
  - ein einzelner Task bearbeitet wird,
  - oder mehrere Tasks nacheinander in getrennten Teilschritten bearbeitet werden.