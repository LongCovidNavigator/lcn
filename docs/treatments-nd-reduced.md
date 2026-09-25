# Reduzierte Treatment-Detailseite (2026-09-25)

Einstieg: `treatment_nd_test.php?id=2`, Branch `dev`. Die bestehende öffentliche Legacy-Seite bleibt getrennt. Keine Migration und keine Datenbankschreibzugriffe.

## Analyse und Zuordnung

- Navigation: bestehende nummerierte Arzt-Navigation (`arzt_detail_konzept.css`) und Treatment-Routing (`treatments_nd.js`), mit fünf Ansichten und gemeinsamem Treatment-Kopf.
- Gesamtbewertung: gemeinsames Arzt-Darstellungsprinzip und dessen `effect-chart`, `effect-column`, `bar-area`, `effect-bar`/Farben. Kosten verwenden die vorhandenen `interactive-dot-scale`- und `insurance-toggle`-Klassen. Ein gemeinsamer Renderer in `components/treatments_nd_reduced.php` bedient alle reduzierten Treatment-Fragen; die abweichenden Arzt-Skalen bleiben erhalten.
- Identität: `tbl_treatments_nd.treatmentname`, `beschreibung`, `typ`, `unterkategorie`; Aliasse über `tbl_cpl_treatments_nd2aliases`.
- Redaktionelle Durchführung/Zugang: `durchfuehrungssetting`, `zugang`. Zulassung/Off-Label nur als kompakte Überblicksangaben.
- Kosten: `tbl_treatment_costs_nd.preis_pro_einheit` und `typische_gesamtkosten`, jeweils separat mit gespeichertem Land/Währung und unverändertem Bezugsgrößentext.
- Symptome: vorhandene aktive und aufgelöste `tbl_cpl_treatments_nd2symptoms`-Relationen sowie `tbl_symptoms.sym_category`. Redaktionelle Zuordnung und fehlende Community-Veränderungsdaten werden separat beschriftet; keine Wirksamkeitsquote aus Relationenzahlen.
- Alternativen: `tbl_cpl_treatments_nd_relations.beziehungstyp` und bestehende Zielauflösung. Nur aufgelöste navigierbare Ziele in den drei definierten Gruppen; keine künstlichen Empfehlungen aus gemeinsamen Kategorien/Symptomen.
- Anbieter: bestehende `tbl_cpl_entities2treatments_nd`-Relationen und gespeicherte Standorte; vorhandene Leaflet-Karte, Geocoding, Entfernung und Listenansicht werden weiterverwendet. Nächster Anbieter wird aus allen Anbietern mit gültigen Koordinaten bestimmt; Luftlinie, keine Fahrstrecke.

## Community und Testentwürfe

Die vorhandene Community-Tabelle bietet `question_key`, `answer_value`, `answer_unit`, `review_status`. Nur `active`/`approved` und exakte erlaubte Antworten werden gezählt (Groß-/Kleinschreibung ignoriert). `gesamtbewertung` wird auf die vier vorgegebenen Antworten beschränkt. Alte positiv/neutral/negativ-Antworten werden nicht umgedeutet. PEM verwendet vorhandene Schlüssel `crashrisiko`/`pem_risiko`; Durchführung `durchfuehrungssetting`, Zugang `zugang`, Gamechanger `gamechanger`.

Beim Prüfen existierten ausschließlich prüfbedürftige alte Gesamtbewertungen. Standardmäßig daher 0 auswertbare Angaben, keine erfundenen Prozente. Optional `?demo=1` oder Kopf-Schalter: explizit fiktive Daten mit n=100 je Frage, niemals mit echten Antworten vermischt. Kostenbeispiele sind dieselben neutralen Testverteilungen je Versicherung, keine versicherungsspezifischen Behauptungen.

Die vorhandene Tabelle hat keinen verifizierten Versicherungskontext. Deshalb werden unzuordenbare gespeicherte Kostenwerte nicht auf GKV/PKV verteilt. Eigene Auswahl bleibt wie im bisherigen Prototyp ein lokaler Testentwurf in `sessionStorage`, getrennt nach Treatment, Frage und Versicherung. Keine Veröffentlichung/Backend-Abstimmung. Preis pro Einheit verlangt eine Bezugsgröße (außer nicht anwendbar). Neue DB-Felder werden nicht eingeführt.

Die vollständigen verbindlichen Zeit-/Umfangsskalen sind in `ND_CONTROLLED_TIMING` erhalten, werden aber nicht gerendert. Alte Prototypeingaben werden durch einen neuen versionierten Entwurfsschlüssel nicht versehentlich als neue Skalenwerte geladen.

## Prüfung

`php -l treatment_nd_test.php`, `php -l components/treatments_nd_reduced.php`, `php -l components/treatments_nd_view.php`, `node --check scripts/treatments_nd_reduced.js`.

`node tests/treatments_nd_reduced.cjs`: fünf Ansichten, direkte Auswahl, Reload-Persistenz, unabhängige Kostenkontexte, Tastaturauswahl im Donut, kein horizontaler Seitenüberlauf bei 390/768/1440 px und keine JS-Laufzeitfehler. Frühere ND-Browsertests prüfen absichtlich entfernte Fachblöcke/Dashboard und sind keine Spezifikation dieser reduzierten Ansicht.

Zusätzlich geprüft: `php tests/treatments_nd_reduced.php` (freigegebene exakte Kategorien, keine Umdeutung alter Antworten) und `node tests/treatments_nd_reduced_map.cjs` (Leaflet, nächster Anbieter, Filterrücksetzung, Marker-Popup). Provider-Marker werden lokal gezeichnet; ein Ausfall externer Hintergrundkacheln wird kenntlich gemacht.

## Visuelle Überarbeitung und Alternativenprüfung

Das Mockup bestimmt nun Farbwelt, kompakte nummerierte Navigation, gemeinsamen Treatment-Kopf mit kleinem Arzneimittelmotiv, rechte Kurzinfo, weich umrandete Karten, grüne Verteilungsbalken, farbige PEM-Segmente sowie Karte und Anbieterliste nebeneinander. Die fünf einzelnen Seitenzustände und die Regel einer Frage pro Zeile bleiben erhalten.

Read-only-Prüfung für LDN (`treat_nd_id=2`, `legacy_treat_id=1`):
- Keine direkte ausgehende oder eingehende Treatment-Relation; keine ND-Verknüpfung über gemeinsame Alias-IDs.
- Acht verschiedene Alias-Texte (zehn Zuordnungen, u. a. doppelte LDN-Schreibweisen).
- Im Legacy-Alias-System bestehen gemeinsame Alias-IDs zu `94` LDN & NAD⁺ (Kombi), `64` NAD⁺-Infusion, `65` NAD⁺ (oral). Diese drei Ziele fehlen im aktuellen ND-Katalog. Die lesende Alias-Peer-Abfrage berücksichtigt deshalb auch Legacy-Ziele und bevorzugt bei späterer Übernahme deren ND-Detailseite.
- 14 unterschiedliche andere ND-Treatments teilen vorhandene Symptombezüge mit LDN.

Der Reiter zeigt deshalb drei getrennte Arten der Navigation: explizit recherchierte Beziehungstypen, Verbindungen über gemeinsame Alias-Bezeichnungen und Verbindungen über gemeinsame Symptome. Alias-/Symptom-Verbindungen werden nicht in recherchierte Beziehungstypen umgedeutet. Leere direkte Beziehungen heißen ausdrücklich „Noch keine Verknüpfung hinterlegt“. Keine Aussage, dass medizinisch keine Alternativen existieren. Daten wurden nicht geändert.
