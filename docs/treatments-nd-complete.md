# Vollständige ND-Datenbasis – Umstellung vom 24.09.2026

Die bestehenden ND-Testseiten wurden auf den nachgelieferten Datenstand umgestellt. Der SQL-Dump `C:/Users/willi/Downloads/lcn_hybrid_database (2).sql` wurde ausschließlich gelesen. Die Spalten aller elf betroffenen ND-Tabellen stimmen mit der laufenden `lcn_hybrid_database` überein. Kein Import, keine Migration und kein Daten-Schreibzugriff.

## URLs

- Übersicht: http://localhost/lcn/treatments_nd_test.php
- LDN: http://localhost/lcn/treatment_nd_test.php?id=2
- Pacing: http://localhost/lcn/treatment_nd_test.php?id=1
- HBOT: http://localhost/lcn/treatment_nd_test.php?id=11
- Feld-/Eintragsübersicht: http://localhost/lcn/treatments_nd_mapping.php

Der zuletzt ausdrücklich abgestimmte Aufbau mit fünf linken Ansichten bleibt erhalten, einschließlich der kombinierten PEM-/Setting-Grafiken und der Umfangs-/Medikamenteneingaben im Überblick. Die drei im Nachtrag empfohlenen Reiternamen wurden nicht als Auftrag verstanden, diese jüngsten Layoutentscheidungen wieder rückgängig zu machen.

## Quellen und aktueller Umfang

| Inhalt | Datenquelle | Umsetzung |
|---|---|---|
| 29 kanonische Treatments | tbl_treatments_nd | Alle vorhandenen fachlichen Felder; neu auch hinweis_apothekenrelevanz, gkv_kostenuebernahme_status, hinweis_gkv_kostenuebernahme |
| 117 Aliasverknüpfungen | tbl_cpl_treatments_nd2aliases + tbl_aliases_03 | Suche und Anzeige direkt über ND-ID; keine Legacy-Abhängigkeit |
| 106 Symptomverknüpfungen | tbl_cpl_treatments_nd2symptoms + tbl_symptoms | 74 aktive eindeutig gematchte/manuell normalisierte Beziehungen verwendbar; 28 unklare und 4 inaktive ausgeschlossen; gruppierte Chips |
| 114 Anbieterbeziehungen | tbl_cpl_entities2treatments_nd + tbl_entities_nd | 100 Bestand, 11 belegt, 3 Kandidaten; Kandidaten eigener gekennzeichneter Block; inaktive Entities ausgeschlossen |
| Standorte | tbl_drs_locations_03 | Ein deterministischer primärer Standort je Entity; einzige weiterhin erforderliche alte Anbieter-Hilfstabelle |
| Apotheken | tbl_treatment_pharmacies_nd + tbl_cpl_treatments_nd2pharmacies | Angebote, Orte, Quelle, Sicherheit; leerer Block entfällt |
| Kosten | tbl_treatment_costs_nd | Nur vorhandene Werte; Erstattung separat |
| 39 Studien | tbl_treatment_studies_nd | Kompakte Liste mit Titel, Link, Typ, Prüftag und Status |
| 851 feldbezogene Recherchezeilen | tbl_treatment_field_sources_nd | Quellen-/Sicherheitsdetails am jeweiligen Datenpunkt; allgemeinere Belege kompakt aufklappbar im Dashboard; kein Ersatz der Hauptwerte durch Rohrecherche |
| 33 Treatment-Beziehungen | tbl_cpl_treatments_nd_relations | Getrennte Gruppen: 19 verwandte Behandlungen, 7 alternative Präparate, 7 alternative Behandlungen; ursprüngliche Richtung eingehender Verweise bleibt erkennbar |
| 4 Community-Antworten | tbl_treatment_community_answers_nd | Alle aktuell suspicious: nur Prüfhinweis, keine Verteilung aus ungeprüften Antworten; aktive/freigegebene Werte werden separat aggregiert |

Die Alias-Suche nach „Psychologische Begleitung“ ergibt einmal Psychotherapie. Schlaftherapie zeigt jetzt ND-Symptome und ND-Anbieter trotz fehlender Legacy-ID. Ältere Aussagen über vollständig leere Beschreibungen/fehlende Beziehungstypen in der Prototyp-Historie sind durch diesen Nachtrag überholt.

### Status- und Linkregeln

- Symptomstatus explizit freigegeben: `eindeutig gematcht`, `manuell normalisiert nach LCN-Entscheid 2026-09-24`, zusätzlich aktiv=1 und gültige Symptom-ID. Unbekannte neue Statuswerte müssen geprüft werden, bevor sie öffentlich erscheinen.
- Anbieterstatus `bestand` und `belegt` werden sichtbar unterschieden. `kandidat` wird separat angezeigt, inklusive mittlerer Sicherheit/Recherchehinweisen. Es werden keine alten Arzt-Treatment-Zuordnungen als Ersatz ergänzt.
- Links zu Arzt-Details nur für IDs, die von der vorhandenen Arzt-API tatsächlich unterstützt werden. Andere aktive ND-Entities zeigen Name, vorhandenen Standort und Website, ohne auf eine nicht verfügbare Detailroute zu führen.
- Symptomüberschneidungen im Alternativenbereich werden ebenfalls ausschließlich aus aktiven, geklärten ND-Relationen berechnet. Sie sind kein Nachweis für Austauschbarkeit.
- Community: `active`/`approved` aggregierbar, `suspicious` nur als Prüfhinweis. Keine respondent_key oder individuellen Datensätze im HTML. Die bestehende dreistufige gespeicherte Gesamtbewertung wird nicht in die vierstufige Arzt-Skala umgedeutet.
- Die ausdrücklich gewünschten Dummydaten bleiben unabhängig schaltbar. Sie werden weder in echte Communitydaten noch eigene Testantworten gemischt. Eigene Eingaben verbleiben im Browser-Tab; kein neuer Speicher-Endpunkt.

## Dateien dieses Nachtrags

Neu:
- components/treatments_nd_evidence.php
- tests/treatments_nd_complete.php
- tests/treatments_nd_complete_browser.cjs
- docs/treatments-nd-complete.md

Geändert (ausschließlich bisherige ND-Prototypdateien):
- api/_treatments_nd.php
- components/treatments_nd_view.php
- treatment_nd_test.php
- treatments_nd_mapping.php
- styles/treatments_nd.css
- tests/treatments_nd_smoke.php
- docs/treatments-nd-prototype.md (Verweis auf diesen aktuellen Stand)

Die Übersicht treatments_nd_test.php verwendet automatisch die aktualisierte Repository-Suche; eine eigene Änderung ihrer Datei war nicht nötig. Bestehende produktive Treatment-/Arztseiten, alte Treatment-Suche sowie Daten wurden nicht verändert. Vorhandene Homepage-Änderungen stammen nicht aus diesem Auftrag.

## Prüfung

- `php tests/treatments_nd_complete.php`: Spaltenvergleich Dump/live für elf Tabellen, alle 29 HTTP-Details, Alias-Suche, Symptomstatus, Anbieterstatus, Studien/Quellen, Beziehungsgruppen, Schlaftherapie ohne Legacy-ID, Pacing ohne Medikamentenblock, LDN, HBOT, freigegebene/prüfbedürftige Communitywerte.
- `php tests/treatments_nd_smoke.php`: Übersicht, Such-Escaping, Detailseiten, NULL- und Fehlerverhalten.
- `node tests/treatments_nd_complete_browser.cjs`: Quellenaufklappen, Studienlinks, LDN-Apotheken, Pacing, Community-Prüfhinweis, Relationen, Mobilbreite, Alias-Suche und JavaScript-Fehler.

## Aktualisierung Zugang und Erstattung (25.09.2026)

Maßgeblicher aktueller Stand: Zugang zeigt die drei Vergleichsoptionen und den vollständigen Recherchetext. Zulassung und Off-Label zeigen jeweils drei Zustände inklusive Nicht anwendbar, auf Desktop nebeneinander. GKV verwendet ausschließlich den gespeicherten Ja/Nein-Status und zeigt Erklärung und Hinweis vollständig. Keine Datenbankänderungen.

GKV und besonderer Apothekenbezug integrieren klickbare eigene Antworten und abschaltbare, eindeutig fiktive Verteilungen direkt in ihren Ergebnisblock. Kostenangaben können dort ergänzt werden und erscheinen nach Eingabe direkt am Kostenblock; sie bleiben ein lokaler Testentwurf im Browser-Tab. Kein separater Zugang-Fragebogen.

Die früher beschriebenen sichtbaren Quellenaufklapper und Studien-Quellenlinks wurden auf Wunsch entfernt. Quellen bleiben intern verfügbar; Anbieter-Websites bleiben als Kontaktlinks erhalten. Die Feldübersicht ist entsprechend aktualisiert.

Zusätzliche Prüfung: tests/treatments_nd_access.cjs prüft Layout, GKV-Markierung, Dummy-Umschaltung, Auswahl und lokale Kostenspeicherung, Mobilbreite und das Ausblenden der Quellen.

## Zuordnung und Karten (weitere Korrektur 25.09.2026)

Durchführung/zeitlicher Rahmen samt eigenen Angaben sowie Medikamentenanwendung liegen jetzt in Reiter 2. Die vier Zeitdimensionen haben je vier anklickbare Vergleichskategorien und ausdrücklich fiktive, gemeinsam abschaltbare Testverteilungen. Genaue Freitexte bleiben ergänzbar und vorhandene Entwürfe bleiben erhalten. Zugeordnete Beschwerden liegen in Reiter 4.

Übersicht und Reiter 2 enthalten je eine Leaflet-Anbieterkarte aus gespeicherten ND-Verknüpfungen und Hauptstandortkoordinaten. Ungeprüfte Kandidaten werden ausgeschlossen, fehlende Koordinaten ausgewiesen. Ausgangsortsuche verwendet den vorhandenen Geocoding-Endpunkt und lokalen gemeinsamen Standort; beide Karten zeigen Luftlinien und sortierte Anbieterlisten. Apotheken ohne Koordinaten bleiben in der Anlaufstellenliste. Keine Datenbankänderungen.

Prüfung: tests/treatments_nd_timing_map.cjs (Zuordnung, Testverteilungen, Auswahl, echte Kartenmarker, gemeinsame Entfernung mit kontrollierter Geocoder-Antwort, Mobilbreite).

Kartendesign angeglichen: Beide ND-Karten verwenden jetzt das vorhandene top_recommendation_map.css und dessen Standortfeld, Löschen-Kreuz, Standortvorschläge, dunkelblauen aufklappbaren Kartenkopf und responsive Abstände. Esri World Topo, bestehende blaue/rote Registry-Pins, gruppierte Pins bei identischen Koordinaten, Zoom rechts oben und Scroll-Zoom erst nach Klick entsprechen den übrigen LCN-Karten. Bestehende produktive Kartenseiten wurden nicht verändert.

Weitere Korrektur Reiter 4: Gamechanger und Zeit bis zur Veränderung verwenden jetzt ausschließlich kombinierte Verteilungs-/Eingabegrafiken. Die bisherigen getrennten Simulationskarten einschließlich der Dashboard-Duplikate sind entfernt. Vorhandene Antwortschlüssel und Werte bleiben unverändert; Dummy-Umschaltung überschreibt eigene Antworten nicht. Anbieterkarte und Anbieterliste einschließlich separat gekennzeichneter Kandidaten stehen in Reiter 4. Die zuvor ausdrücklich gewünschten Karten in Reiter 1 und 2 bleiben ebenfalls erhalten. Prüfung: tests/treatments_nd_effect_combined.cjs.

Anbieterübersicht im Beta-Layout: Kachel-/Tabellenumschaltung mit gemeinsamem Ansichtsmerkmal, Suche nach Name/Ort, Sortierung A–Z/Z–A und Entfernung auf-/absteigend. Vorhandene Such-/Ansichts-CSS-Regeln aus aerzte_karte.css werden auf ND begrenzt wiederverwendet. Anbieter ohne Koordinaten bleiben auffindbar, die Karte verwendet nur gültige Standorte. Die doppelte statische bestätigte Anbieterliste in Reiter 4 ist durch diese Übersicht ersetzt; ungeprüfte Kandidaten bleiben getrennt. Browsertest tests/treatments_nd_provider_beta.cjs.

Dashboard-Korrektur: Das Dashboard zeigt wieder sämtliche Ergebnisgrafiken (11 Verteilungen), die vier recherchierten Zugangsskalen und vorhandene grafische Medikamentenauswahlen, geordnet nach Durchführung, Zugang und Erfahrungen. Es spiegelt die tatsächlichen Reitergrafiken, statt eine zweite Daten-/Antwortbasis zu führen. Anklicken aktualisiert dieselbe eigene Antwort; Dummy-Umschaltung und Zurücksetzen synchronisieren alle Darstellungen. Frühere Entfernung der Dashboard-Grafiken ist damit aufgehoben. Prüfung: tests/treatments_nd_dashboard.cjs.

Durchführung und Medikamentenanwendung grafisch zusammengeführt: Getrennte redaktionelle Tabellen entfallen. Die vier Zeitgrafiken enthalten den jeweiligen vollständigen Recherchewert direkt im selben Block wie die anklickbare Verteilung. Medikamentenanwendung ist offen sichtbar: Profil-/Dosisfelder als Symbolkarten, Anwendungsform sowie Einschleichen, Verträglichkeitsanpassung und Ausschleichen als kombinierte Recherche-/Verteilungs-/Eingabegrafiken. Neue ausdrücklich synthetische Verteilungen werden gemeinsam geschaltet; bestehende Antwortschlüssel bleiben erhalten. Freie Dosierungs- und Schemasätze werden ohne erfundene numerische Kurve vollständig angezeigt. Dashboard übernimmt auch die visuellen Profil- und Dosierungsblöcke. Test: tests/treatments_nd_medication_graphics.cjs.

Übersicht neu geordnet: Kurzbeschreibung zuerst innerhalb des Profils; Basisdaten ergänzt um vorhandene Handelsnamen, Medikamentenklasse, ATC und Aliase. Teaser „Anwendung und Zugang“ sowie „Anlaufstellen“ entfernt; Daten bleiben in Reiter 2/3/4. Verwandte Behandlungen und alternative Präparate/Behandlungen einschließlich eingehender Verweise und Kategorie-/Symptomverknüpfungen stehen jetzt direkt in der Übersicht statt als Dashboard-Link. Keine versteckten Aufklapplisten. Die ausdrücklich gewünschte Übersichtskarte bleibt erhalten.

Feste Medikamentenoptionen erscheinen als anklickbare Tabellen mit fiktiven Nutzeranteilen und eigener Auswahl. Alle festgelegten Anwendungsformen bleiben verfügbar. Exakte Dosierungen und Anwendungsschemata sind gemäß Schema strukturierte Freitexte und jetzt optionale Aufklapper. Dummy-Schalter und Dashboard synchronisieren auch Tabellen.
