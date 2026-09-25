> Aktueller Datenstand: [Vollständige ND-Umstellung](treatments-nd-complete.md). Frühere Datenzahlen und Legacy-Regeln unten dokumentieren die Entwicklung und sind teilweise überholt.

# Treatment-ND-Testansicht

Stand: 24.09.2026. Separater, lesender Prototyp; keine Migration und keine Änderungen an bestehenden Seiten, APIs oder Daten. Vorhandene Änderungen an index.html, scripts/homepage.js und styles/homepage.css gehören nicht zu diesem Auftrag.

## Aufruf

- Übersicht: http://localhost/lcn/treatments_nd_test.php
- LDN: http://localhost/lcn/treatment_nd_test.php?id=2
- Pacing: http://localhost/lcn/treatment_nd_test.php?id=1
- Verwandte Treatments: http://localhost/lcn/treatment_nd_test.php?id=3
- Alias-Suche: http://localhost/lcn/treatments_nd_test.php?q=Psychologische%20Begleitung

Die Dateinamen folgen den bestehenden PHP-Testseiten; kein Routing und keine bestehende URL wurde geändert. Die Seiten sind mit noindex/nofollow gekennzeichnet. Das ist keine Zugangssperre.

## Neue Dateien

- treatments_nd_test.php: serverseitige Suche und Karten, ausschließlich ND-Treatments.
- treatment_nd_test.php: Kompakter Kopf und fünf Ansichten mit derselben linken Navigation und denselben Fragen wie die Arztseite: Überblick, Belastungshürden, Zugänglichkeit, Erfahrungen und Dashboard.
- api/_treatments_nd.php: lesendes Repository, kein öffentlicher JSON-Endpunkt.
- components/treatments_nd_view.php: gemeinsamer Rahmen, sichere Ausgabe, NULL-Filter und Quellenlinks.
- styles/treatments_nd.css: Ergänzungen zu styles/arzt_detail_konzept.css; bestehende Profil-, Karten- und Typografiestile werden wiederverwendet.
- scripts/treatments_nd.js: progressive linke Navigation mit Tastatursteuerung, Browser-Zurück und Hash-Navigation. Ohne JS bleiben alle Bereiche lesbar.
- tests/treatments_nd_smoke.php: DB-/HTTP-Integration.
- tests/treatments_nd_browser.cjs: Browserprüfung mit installiertem Edge/Playwright.
- docs/treatments-nd-prototype.md: diese Dokumentation.

Header und Footer werden aus den vorhandenen Komponenten eingebunden. Keine vorhandene Datei wurde geändert.

## Datenzugriff

Verwendet lcnDoctorDatabase() aus der vorhandenen Hybrid-Schicht und prüft explizit den Datenbanknamen lcn_hybrid_database. Kein Wechsel des Profils anderer APIs. Alle neuen SQL-Abfragen sind SELECTs; Eingaben werden gebunden und Ausgaben HTML-escaped. Externe Links erlauben nur HTTP/HTTPS.

Tabellen:

- tbl_treatments_nd: alle 29 aktuellen Datensätze, kein hartcodierter Katalog.
- tbl_treatment_costs_nd: landes-/währungsbezogene Kosten; Erstattung separat.
- tbl_treatment_pharmacies_nd und tbl_cpl_treatments_nd2pharmacies: konkrete Angebote mit Quelle und Sicherheit.
- tbl_cpl_treatments_nd_relations: ausgehende Beziehungen; ND-Ziele bevorzugt, sonst bestätigte Legacy-Ziele oder reiner Text.
- tbl_treatments_03: Auflösung von Legacy-Zielen verwandter Treatments.
- tbl_aliases_03 und tbl_cpl_treatments2aliases_03: Anzeige und Suche über legacy_treat_id.
- tbl_symptoms und tbl_cpl_sym2treatments: bestehende Symptomzuordnungen über legacy_treat_id.
- tbl_cpl_drs2treatments_03, tbl_entities_nd, tbl_drs_03, tbl_drs_locations_03: Anbieter mit aktiven ND-Namen und Legacy-Fallback, primäre Orte und Website.

Die vorhandene lcnDoctorSourceSql()-Auswahl ist auf bestimmte Ärzte beschränkt und wird absichtlich nicht für diese Anbieterabfrage verwendet. Anbieter werden ohne diese Einschränkung gezeigt; Websites sind verlinkt. Ein pauschaler Link auf Arzt-Detailseiten wurde vermieden, da diese nicht alle Bestandsanbieter akzeptieren.

## Verifizierter Datenstand und Lücken

- Alle 29 ND-Treatments laden; Name/Alias-Suche funktioniert, inklusive Psychologische Begleitung → Psychotherapie.
- LDN: 2 Apotheken, 10 Anbieter, 4 Symptome, 8 Aliasse und 1 Kostenzeile. Keine ausgehenden verwandten Treatments vorhanden.
- Pacing: 21 Anbieter, 3 Symptome, 2 Aliasse; kein Medikamentenblock.
- H1-Antihistaminika: verlinkte H2-Antihistaminika; NULL-Beziehungstyp bleibt neutral.
- Alle 32 Beziehungen haben derzeit NULL als Beziehungstyp. Vorhandene Begründungen, Quellen, Sicherheit und Review-Hinweise werden unverändert gezeigt.
- Schlaftherapie hat keine legacy_treat_id: keine übernommenen Aliasse, Symptome oder Anbieter. ND-Beziehungen funktionieren trotzdem.
- beschreibung, zugang und gkv_kostenuebernahme sind in allen 29 zentralen Datensätzen NULL. Zulassung und Off-Label-Status sind jeweils nur bei einem Datensatz befüllt. Die UI unterstützt diese Felder, ergänzt aber keine Inhalte.
- Separate Kostenzeilen liegen derzeit nur für LDN, HBOT, Immunadsorption, H.E.L.P.-Apherese und TPE vor. Apotheken nur bei LDN.
- NULL/Leerstrings erzeugen keine leeren Karten oder Zeilen. Vollständig leere Reiter zeigen höchstens einen kurzen Hinweis. Medikamentenfelder werden nur bei tatsächlichen Werten gezeigt.
- Legacy-Aliaszuordnungen werden unverändert übernommen; mögliche fachliche Unschärfen (z. B. Kombinationen in LDN-Aliassen) werden nicht automatisch korrigiert.

## Tests

```powershell
php tests/treatments_nd_smoke.php
node tests/treatments_nd_browser.cjs
```

Erfolgreich: alle 29 HTTP-Details, Übersicht, Suche inklusive Alias, LDN-Apotheken/-Kosten/-Anbieter/-Symptome, Pacing ohne leeren Medikamentenblock, verwandte ND-Ziele, NULL-Beziehungstypen, ungültige IDs (400/404), SQL-artige Suche und Ausgabe-Escaping. Browser: Suche und Detailaufruf, Linke Navigation mit fünf Ansichten, Home-Taste, 390px ohne horizontalen Überlauf, keine JS-Fehler. Desktop-/Mobile-Screenshots werden im Windows-Temp-Verzeichnis abgelegt und visuell geprüft.

## Vor einer regulären Übernahme

- Gemeinsame Designbausteine aus der umfangreichen Arzt-CSS-Datei extrahieren; aktuell absichtliche Wiederverwendung mit begrenzten ND-Overrides.
- Hybrid-DB-Verbindung und Anbieterauflösung in eine fachlich neutrale Repository-Schicht auslagern.
- Anbieter-Verlinkung mit einer gemeinsamen Route für alle Entity-/Legacy-Anbieter abstimmen.
- Suchpaginierung erst bei größerem Katalog ergänzen; derzeit werden alle 29 ND-Treatments angezeigt.
- Redaktionelle Statusbezeichnungen, Länder-/Währungsdarstellung und Recherchequellenmodell vereinheitlichen; Datenlücken vor Veröffentlichung redaktionell prüfen.
- Keine Voting-/Community-Daten oder Funktionen für diesen Prototyp ergänzt.

Layout-Anpassung: Der Überblick verwendet die Arzt-Komponenten overview-profile-grid, overview-identity und overview-groups. Anbieter, Apotheken und Hintergrundinformationen stehen im separaten Dashboard. Erfahrungsdaten werden nicht erfunden; die entsprechende Ansicht zeigt den fehlenden Datenstand.

## Anklickbare Nutzerfelder (Schema v0.13)

Ergänzt: components/treatments_nd_inputs.php, scripts/treatments_nd_inputs.js und tests/treatments_nd_inputs.cjs. Die linke Fünf-Reiter-Navigation bleibt unverändert.

- Reine Nutzerfelder: Crash-/PEM-Risiko (keines/niedrig/mittel/hoch), Gesamtbewertung (positiv/neutral/negativ), Gamechanger (ja/nein), Zeit bis Veränderung (Stunden/Tage/Wochen/Monate/keine Wirkung).
- Hybridfelder: Setting mit Mehrfachauswahl, vier Umfangsfelder, drei Kostenfelder, GKV und Hinweis, Apothekenrelevanz und Hinweis, Symptome aus tbl_symptoms mit Mehrfachauswahl.
- Für Arzneimittel: Applikationsform mit Mehrfachauswahl, Dosierung, Einnahmehäufigkeit, Ein-/Ausschleichen samt Schema und individuelle Dosisanpassung.
- Auswahlgrafiken markieren die eigene Antwort. Das Dashboard zeigt eigene Angaben; keine Community-Verteilung wird simuliert.
- Speicherung nur als Testentwurf in sessionStorage je treat_nd_id und Browser-Tab. Kein POST, keine DB-Änderung, keine Veröffentlichung oder Übernahme in redaktionelle Werte. Browser-Wiederherstellung kann die Tab-Sitzung erhalten; die Löschfunktion entfernt den Entwurf explizit.
- Keine Vorauswahl aus redaktionellen Angaben. Bei blockiertem Browserspeicher bleibt der Entwurf nur im aktuellen Seitenspeicher; der Status benennt das.
- Ohne JavaScript sind die Eingabeformulare verborgen, sodass keine Formulardaten versehentlich per GET übertragen werden.
- Die in v0.13 gestrichenen fünf körperlichen Ja/Nein-Felder sowie allgemeine PKV-Abfragen wurden nicht neu eingeführt. Referenzdokumente wurden nicht verändert; der mitgelieferte Rechercheprompt wurde nicht als Rechercheauftrag ausgeführt.

Browserprüfung: node tests/treatments_nd_inputs.cjs. Prüft Auswahl, Mehrfachauswahl, Freitext, Neuladen, Behandlungstrennung, Dashboard, Löschen, mobile Breite und ausbleibende Server-Schreibzugriffe.

## Visuelle Nutzer-Dummydaten und Zuordnungsübersicht

- `scripts/treatments_nd_demo.js`: zwei frei erfundene Beispielprofile (LDN / Ivabradin), je Frage n=100. Keine medizinischen Daten und keine Übernahme aus Recherchewerten. Auswahl über den Schalter oberhalb der linken Navigation. Voreinstellung: aus; `?id=2&demo=1#wirkung` schaltet die Vorschau ein. `demo_profile=ivabradin` wählt das zweite Profil. Der Zustand bleibt in der URL beim Neuladen erhalten.
- Visuelle Orientierung: die vorhandenen Treatment-Dummyseiten, insbesondere farbige Bewertungsbalken, Gamechanger-Kennzahl und horizontale Verteilungen. Zusätzlich erklären die Antwortkarten die Bedeutung der Auswahl. Die fünf Reiter bleiben bestehen.
- Simulationen: Gesamtbewertung, Gamechanger, Zeit bis Veränderung, PEM-Risiko, individuelle GKV-Erstattung und besondere Apothekenleistung. Jede Simulation trägt einen ausdrücklichen Dummy-Hinweis. Kosten- und Dosierungswerte werden nicht als Nutzer-Dummy erfunden.
- Eigene Formulare werden durch den Schalter oder Profilwechsel weder befüllt noch überschrieben. Keine Community-Speicherung oder Datenbankänderung.
- `treatments_nd_mapping.php`: vollständige Zuordnung der Felder zu Reiter, Erhebungsart, Datenquelle und Darstellungsform; darunter die dynamisch geladene Liste aller Treatments mit Typ, Unterkategorie und Legacy-ID.
- `tests/treatments_nd_demo.cjs`: Schalter, Profilwechsel, Neuladen, unveränderte eigene Angaben, mobile Breite, Übersicht und JavaScript-Fehler.

## Korrektur der Ansichten und Standard-Dummydaten

- Durchführung und zeitlicher Rahmen sowie Anwendung des Medikaments stehen jetzt im Überblick. Persönliche Eingaben bleiben im zweiten Reiter.
- Konkrete Anlaufstellen wurden aus Reiter 3 entfernt; die Anbieter/Apotheken stehen weiter im Dashboard.
- Dummydaten sind jetzt standardmäßig an (auch ohne URL-Parameter). demo=0 schaltet sie ab. Der zusätzliche Schalter im Kopf bleibt auch nach dem Scrollen zu einem Reiter erreichbar.
- Zustandsveränderung verwendet die Arzt-Skala: Verschlechterung / Keine Veränderung / Verbesserung / Heilung, mit denselben CSS-Komponenten effect-chart und effect-column. Die Balken sind zugleich Antwortauswahl. Heilung bleibt ausdrücklich subjektive Selbsteinschätzung.
- Diese UI-Änderung weicht bewusst von der dreistufigen Gesamtbewertung des v0.13-Rechercheschemas ab, entsprechend der ausdrücklichen Nutzeranweisung. Eigene neue Antworten werden separat als effect im Testentwurf gespeichert. Alte rating-Werte werden nicht in die neue Viererskala umgerechnet. Referenzdokumente und Datenbank bleiben unverändert.
- Layoutprüfung: node tests/treatments_nd_layout.cjs.

## Belastungshürden: Ergebnis und Eingabe zusammengeführt

PEM und Setting verwenden je eine anklickbare Balkenverteilung auf Basis der Arzt-Grafik. Die eigene Auswahl ist direkt im jeweiligen Balken markiert. PEM ist Einfachauswahl, Setting Mehrfachauswahl. Setting-Dummys beziehen sich auf 100 fiktive Personen und können wegen Mehrfachauswahl über 100 % summieren. Ausschalten der Dummydaten entfernt nur Prozentwerte, nie die eigene Auswahl.

Zeitlicher Umfang und Medikamenteneingaben stehen im Überblick direkt nach ihren redaktionellen Anzeigen. Der zweite Reiter enthält nur PEM und Setting. Die bisherigen Entwurfsschlüssel bleiben erhalten.

Alternativen: Der Bereich im Dashboard ist jetzt aus dem Überblick direkt erreichbar. Ergänzt wurden eingehende ND-Verweise mit erhaltener Originalrichtung sowie separate, transparent beschriftete Entdeckungslisten über gemeinsame Unterkategorie und Symptome. Diese berechneten Überschneidungen werden nicht als medizinische Alternativen oder Wirksamkeitsbelege ausgegeben. In der Hybrid-DB gibt es keine zusätzliche Legacy-Alternativen-Tabelle. Die ausgehenden 32 ND-Beziehungen haben weiterhin NULL-Beziehungstypen; LDN hat keine direkten ND-Beziehungen. Vorbereitete fiktive Alternativlisten aus dem alten UI-Dummy werden deshalb nicht als echte Beziehungen übernommen.

Prüfung: node tests/treatments_nd_burden.cjs.
