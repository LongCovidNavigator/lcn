# Reduzierte Treatment-Detailseite (2026-09-25)

## Therapiealternativen (2026-10-19, aktueller Stand)

### Tabellen und Verknüpfungsvorschläge

Vereinfachter Dialog: Ein bereichsbezogener Knopf legt den Zusammenhang fest; dort erscheint keine Typauswahl. Eine bekannte Gruppe wird als fester Text übernommen. Es bleibt nur der passende Suchpicker für den neuen Eintrag. Ausgewählte Namen bleiben im Feld stehen (`retainSelection` im gemeinsamen Picker, für andere Aufrufer standardmäßig deaktiviert). Manuelle Änderungen verwerfen die alte ID und deaktivieren das Absenden bis zur nächsten gültigen Auswahl. Bereits im jeweiligen Feld vorhandene Einträge werden nicht erneut angeboten. Quelle und Begründung liegen eingeklappt unter „Quelle oder Hinweis ergänzen (optional)“. Nur „Andere Verknüpfung vorschlagen“ bietet die vollständige Zusammenhangsauswahl. Der Browser-Test prüft sichtbare Maus-/Tastaturauswahl, feste Gruppe, fehlende Typauswahl und Verwerfen veralteter IDs.

Die bisherigen Kartenlisten sind Tabellen mit „Eintrag“, „Zusammenhang“ und „Rückmeldungen“. Jede konkrete Zuordnung behält ✓/×. Unter den Tabellen sowie in einem allgemeinen Ergänzungsbereich kann über den bestehenden Katalogsuchdialog eine Verknüpfung vorgeschlagen werden. Die neun deutschen Eingaberichtungen umfassen alternative Therapie, Gruppenzugehörigkeit/Gruppenmitglied, Handelsname/Wirkstoff, Anwendungsform und Kombination/Bestandteil. Vor dem Absenden erscheint ein vollständiger deutscher Satz zur Richtung. Quelle und Begründung sind optional. Neue Gruppennamen lassen sich direkt vorschlagen; eine noch fehlende Therapie wird über das vorhandene Eintragsformular separat zur Prüfung vorgeschlagen und kann nach Freigabe verknüpft werden.

`api/treatment_relationship_proposals.php` speichert ausschließlich ausstehende `community_submissions` mit einem normalisierten `treatment_relationship`-Objekt. Doppelte Vorschläge, Selbstverweise, falsche Ziele, ungültige Quellen und zyklische Kombinationen werden abgefangen. Die Vorschläge erscheinen in einer gesonderten Tabelle mit „Prüfung ausstehend“, auch auf beteiligten Seiten, und besitzen eigene Community-Rückmeldungen. Ausstehende Angaben erscheinen nicht als recherchierte Beziehungen.

Die vorhandene authentifizierte Freigabeoberfläche bezeichnet sie als „Verknüpfung ergänzen“ und zeigt den Zusammenhang auf Deutsch. Erst `lcnApproveTreatmentRelationship` schreibt die gerichtete Beziehung oder typisierte Alias-Kopplung. Die vorhandenen Freitext-Alias-Typen werden ohne Schemaänderung um `application_form` und `combination_component` für ausdrücklich geprüfte Formen/Bestandteile ergänzt; sie werden in der UI deutsch benannt. Bereits als Formgruppe erkannte Zuordnungen behalten ihre Alias-ID und Stimmen. Vorschlagsstimmen werden auf den endgültigen Zuordnungsschlüssel übernommen. Wiederholte Übernahme erzeugt keine doppelten Kopplungen.

Tests: `php tests/treatment_relationship_proposals.php` prüft die fünf Speicherarten und die Freigabe in einer vollständig zurückgerollten Transaktion. `node tests/treatment_relationship_tables.cjs` prüft echte Vorschläge, freie Gruppennamen, Dubletten, Eingabefehler und Tabellen in 24 Breiten-/Seitenkombinationen; seine zwei eindeutig markierten Vorschläge werden anschließend entfernt. `tests/env_request_snapshot.php` sichert die Anfrage-lokale Konfiguration gegen verschwindende Prozessvariablen bei parallelen Apache-Anfragen ab.

Alle konkreten Zuordnungen besitzen die vorhandenen schlichten ✓-/×-Rückmeldungen mit Zählern, eigener Auswahl, Wechsel und Zurücknahme. Dies gilt für gespeicherte direkte Beziehungen, Gruppenzugehörigkeit (auch ohne Gruppenseite), Mitglieder/Formen, Wirkstoff/Handelsname, weitere Handelsnamen, Kombinationen und Bestandteile einschließlich Text ohne eigene Detailseite. Leere Felder und reine Gruppenüberschriften enthalten keine behauptete Zuordnung und keine Abstimmung.

Rückmeldungen verwenden die vorhandene Tabelle `catalog_relation_feedback` und den bestehenden Endpunkt mit neuen validierten Schlüsselräumen: `tr` (Relation-ID), `ag` (Alias-ID/zugeordnetes Mitglied), `bn` (Wirkstoff/Handelsname), `bs` (Formulierung/Basiswirkstoff), `cp` (Kombination/Bestandteil) und `cn` (Kombination/normalisierter Textbestandteil). Hin- und Rückansichten derselben Zuordnung teilen den Schlüssel. Stimmen ändern keine Alias- oder Therapiebeziehungen. Jeder Schreibzugriff prüft die aktuelle Zuordnung, den Request-Ursprung und den bestehenden Abstimmungsschutz; der Browser übermittelt keine frei anlegbaren Behauptungen. Keine Schemaänderung. Die bisherigen Behandler-Schlüssel bleiben erhalten.

Zusätzliche Prüfung: `node tests/treatment_discovery_feedback.cjs` bestätigt echte Speicherung, Wiederanzeige auf der Rückseite, Widerspruch, Zurücknahme mit Bereinigung der Teststimme, alle Feldarten, 24 Breitenprüfungen und Ablehnung erfundener Verbindungen. `php tests/treatment_discovery.php` validiert sämtliche generierten Rückmeldungsschlüssel im Katalog. `php tests/catalog_relation_feedback.php` prüft die vorhandene Speichersemantik in einer zurückgerollten Transaktion.

Die Detailseite zeigt alle ausgehenden gespeicherten Treatment-Beziehungen gemeinsam unter „Alternative Therapien“, unabhängig vom Beziehungstyp. Identische verlinkte Ziele erscheinen einmal; Ziele ohne aufrufbare Detailseite erscheinen als Text. Datenbank und gespeicherte Beziehungstypen bleiben unverändert.

Die bisherige Symptomentdeckung wird auf allen Therapie-Detailseiten nicht mehr gerendert. Die Symptomzuordnungen und die Community-Frage zur hilfreichen Wirkung bleiben erhalten. Der pauschale Kasten über beliebige gemeinsame Alias-Bezeichnungen entfällt ebenfalls.

Die lesende Logik in `api/_treatment_discovery.php` berücksichtigt den gesamten aktuellen Therapiekatalog:
- Gruppen entstehen aus gemeinsamen `umbrella_term`-Alias-IDs. Bei existierender eindeutiger Gruppenseite wird „Gehört zu“ verlinkt; sonst bleibt der Oberbegriff als Text sichtbar. Ein exakt passender kanonischer Gruppeneintrag wird auch dann gefunden, wenn ihm selbst die Oberbegriff-Kopplung fehlt (NAD⁺). H2-Blocker besitzt eine ausdrücklich hinterlegte Anzeigeauflösung auf die bestehende Seite H2-Antihistaminika; andere unterschiedliche Gruppentitel werden nicht geraten.
- Medikamentengruppen zeigen ihre Mitglieder ohne Handelsnamen, Kombinationen oder den Gruppeneintrag selbst. Andere Gruppen zeigen „Verfahren dieser Gruppe“ bzw. bei Stoff-/Ernährungsgruppen neutral „Einträge dieser Gruppe“. Wirkstoffmitglieder zeigen weitere Gruppenmitglieder und eigene Handelsnamen.
- `generic_name`, `active_ingredient` und `trade_name` werden auf eindeutige kanonische Eintragsnamen aufgelöst. Gruppenseiten können Suchaliase von Einzelwirkstoffen tragen; sie werden deshalb aus der Wirkstoff-/Markenauflösung ausgeschlossen. Eine eigene Formulierung mit Wirkstoff- und Handelsname (z. B. niedrig dosiertes Aripiprazol) wird nicht zum Handelsnamen erklärt. Handelsnamen zeigen den zugehörigen Wirkstoff oder die Wirkstoffkombination und weitere Handelsnamen derselben Substanz.
- Formen werden nur innerhalb bestehender Oberbegriff-Zuordnungen angezeigt, wenn die Mitgliedsnamen den Oberbegriff mit Formzusatz enthalten. NAD⁺ zeigt oral, subkutan und Infusion. Keine automatische Gleichsetzung von Anwendungsformen.
- Kombinationseinträge werden an ihrem eigenen Namen mit getrenntem `+`/`&`, Kombi-/Kombination-Kennzeichnung oder Triple-Kennzeichnung erkannt; bloßes Teilen eines zusammengesetzten Suchalias macht einen Einzelstoff nicht zur Kombination. Das Ladungszeichen in NAD⁺/NAD+ ist kein Kombinationstrenner. Bestandteile werden aus den vorhandenen zusammengesetzten Namen auf kanonische Einträge oder eindeutige einfache Aliase aufgelöst. Bestehende zusammengesetzte Alias-Kopplungen verbinden auch die Einzelanwendungsformen mit ihren Kombinationen. Fehlende eigene Einträge werden als Text angezeigt (Nirmatrelvir/Ritonavir), niemals als URL mit ID 0. Diagnostische Kombinationen werden als kombinierte Untersuchungen beschriftet.

Keine Migration und keine Datenbankschreibzugriffe. Selbstverweise, doppelte Links innerhalb eines Feldes und mehrdeutige Zielauflösungen werden vermieden. Abkürzungen, Schreibweisen oder beliebige gemeinsame Suchbegriffe erzeugen für sich keine Therapiealternative.

Prüfung: `php tests/treatment_discovery.php` prüft alle 810 Einträge auf gültige Ziele/Selbstverweise/Duplikate, die verschiedenen Rollen, fehlende Ziele und 20 HTTP-Detailseiten. `node tests/treatment_discovery.cjs` prüft tatsächliche Gruppen-/Marken-/Form-/Kombinationsnavigation, 42 Ansichten bei 390/768/1440 px, entfernte Symptomvorschläge und JavaScript-Fehler.

Die folgenden Abschnitte dokumentieren frühere Entwicklungsstände; für Therapiealternativen gilt die obige Beschreibung.

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

## Feste Kostenbezugsgrößen

Die bestätigte Dropdown-Liste ersetzt freie Bezugsgrößentexte: Behandlung/Sitzung, Anwendung, Packung Tabletten, Packung Kapseln, Flasche, Ampulle, Fertigspritze, Tube/Tiegel und Rezeptur. Packungen erfordern eine positive ganze Stückzahl, Flasche/Ampulle einen positiven ml-Inhalt, Tube/Tiegel g oder ml, Rezeptur ml/g/Tabletten/Kapseln. Bei Fertigspritzen ist der Inhalt optional. Keine automatische Standardisierung auf 100 Stück.

Einheit und Inhalt erscheinen unmittelbar an der Kostenskala. Eigene Entwürfe speichern diese strukturiert pro Versicherung; Änderungen löschen die bisherige Preiswahl. Alte Freitext-Kostenentwürfe werden nicht automatisch umgedeutet. Andere Antworten bleiben erhalten. Die fiktive Diagrammverteilung ist ausdrücklich nicht auf Packungsgröße oder Wirkstärke bezogen; weiterhin keine echten Kostenaggregation oder DB-Änderung.

Geprüft mit `tests/treatments_nd_cost_basis.cjs`: ungültige Menge, Mengenwechsel, erneute Preiswahl, Reload und Sitzung ohne Mengenangabe; außerdem bestehende Tests für Versicherungswechsel und mobile Darstellung.

## Vereinfachung der Bezugsgröße (ersetzt die vorherige Detailfestlegung)

Auf Nutzerwunsch nur drei grobe Kategorien: Behandlung / Anwendung; Packung (Tabletten / Kapseln); Flasche / Ampulle / Spritze. Keine Stückzahl, ml/g, Dosierung oder Rezeptur-Sonderoption. Preisstufen bleiben unverändert. Ein Kategorienwechsel behält die grobe Preiswahl. Frühere eindeutig zuordenbare Kategorien werden zusammengeführt und ihre Mengen entfernt; nicht zuordenbare Rezeptur-/Tubenentwürfe werden nicht geraten. Keine DB-Änderung.

Kosten-Sonderantwort: „nicht anwendbar“ steht als erster, optisch abgesetzter Kreis vor den acht verbundenen Kostenpunkten. Kein Verbindungstrich zur Skala. Sie bleibt im gemeinsamen Nenner der Prozentverteilung enthalten. Die Versicherungsumschaltung enthält nur GKV/PKV. Antwort-Indizes bleiben stabil; Rendering liest Prozente über den Antwortindex statt DOM-Reihenfolge. Geprüft mit `tests/treatments_nd_cost_na.cjs`.
