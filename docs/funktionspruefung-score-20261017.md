# Funktionsprüfung und aktuelle Score-Gewichtung

Historischer Stand vor der Umstellung auf 30/30/40. Aktuelle Gewichtung: siehe score-gewichtung.md.

Stand: 17. Oktober 2026. Lokal geprüft; keine Produktionsfreigaben vorgenommen.

## Ergebnis der Funktionsprüfung

Erfolgreich geprüft:
- Neue Behandler und Therapien über die tatsächlichen HTTP-Endpunkte einreichen und in der jeweiligen Gegenseite sofort als vorläufig finden.
- Vorläufige Behandler bewerten; Kostenkontext von Deutschland nach Österreich verschieben, ohne eine zweite Kostenstimme anzulegen.
- Freigeben: Bewertungen, Zuordnungen, Community-Rückmeldungen, Adresse und Koordinaten übernehmen.
- Vorläufige Behandlerseite nach Freigabe auf regulären Eintrag weiterleiten.
- Symptomvorschläge für Behandler und Therapien einreichen und freigeben; Wiederholung erzeugt keine doppelte Symptomverknüpfung.
- Zuordnung entfernen, neue Zuordnung vorschlagen, identische Vorschläge zusammenfassen und Vorschlag ablehnen.
- Doppelte Entscheidung über einen bereits abgeschlossenen Antrag blockieren.
- Kostenstimmen für freigegebene Einträge: Land, Versicherungsart und Währung wechseln; Wert erhalten und alte Zuordnung entfernen.
- Symptomstimmen: aktualisieren, unabhängig abstimmen, zurücknehmen, ungültige IDs abweisen.
- Score-Berechnungen: Mindestzahlen, fehlende Werte, Anbieterbegrenzung und Online-Kriterien.
- Browser: Freigabetabelle nach Art filtern, suchen, sortieren und Details öffnen; Heilungssortierung in beiden Detailtabellen; Rückmeldungssortierung bei Behandlern; Kachel- und Kategorienpräferenz nach Reload; Suchdropdown innerhalb des sichtbaren Bereichs; keine JavaScript-Fehler in den geprüften Detailansichten.

Gefunden und behoben:
1. Strukturierte Bewertungen auf vorläufigen Behandlerseiten wurden bei Freigabe nicht übernommen.
2. Rückmeldungen zu neu angelegten Einträgen waren nach Freigabe nicht den regulären Zuordnungen zugeordnet.
3. Vorläufige Behandler konnten mehrere Kostenkontexte halten; Kontextwechsel wird jetzt wie beim regulären Eintrag verarbeitet.
4. Österreichische und Schweizer Länderangaben gingen beim Freigeben einer Standortangabe verloren.
5. Alte vorläufige Behandlerlinks führten nach Freigabe weiter in den vorläufigen Abstimmungsbereich; jetzt Weiterleitung.
6. Bereits abgeschlossene Anträge konnten erneut entschieden werden; jetzt serverseitig blockiert.
7. Freigabeübersicht zeigte nur die ersten 200 Anträge ohne Hinweis; die neue Tabelle lädt bei Bedarf weitere Seiten.
8. Ein älterer Abstimmungstest erwartete fälschlich noch mehrere Kostenstimmen je Nutzer; an die aktuelle Vorgabe angepasst.

Datenbanktests laufen mit Rollback. Der HTTP-Test entfernt ausschließlich seine eindeutig gekennzeichneten Testeinträge wieder. Bestehende Nutzerbeiträge wurden nicht freigegeben oder abgelehnt.

Nicht Teil dieser Prüfung: Lasttest auf ALL-INKL, Wiederherstellung eines Backups, Datenbankbereinigung, automatische Freigaberegeln, Recherche echter Online-Angebote und ein vollständiger Test auf echten Mobilgeräten.

## Behandler: maximal 100 Punkte

| Aspekt | Maximum | Aktuelle Berechnung |
|---|---:|---|
| Termin-Anpassung | 20 | Fünf Stufen: 0 / 5 / 10 / 15 / 20 Punkte, nach Antwortanteilen gemittelt. |
| Ersttermin aus der Ferne | 10 | Höherer Ja-Anteil aus Telefon oder Video × 10. |
| Folgetermin aus der Ferne | 10 | Höherer Ja-Anteil aus Telefon oder Video × 10. |
| Eigene Gesamtkosten | 15 | Übernommen / bis 100 / 500 / 1.000 / 5.000 / 10.000 / 25.000 / über 25.000: 15 / 13,5 / 11,25 / 9 / 6,75 / 4,5 / 2,25 / 0. |
| Wartezeit Ersttermin | 5 | Fünf Stufen: 5 / 3,75 / 2,5 / 1,25 / 0. |
| Wartezeit Folgetermin | 5 | Wie Ersttermin. |
| Zustandsveränderung | 15 | Verschlechterung / keine Veränderung / Verbesserung / Heilung: 0 / 5 / 10 / 15. |
| Zahl dokumentierter Therapien | 10 | Linear bis 60 Therapien; ab 60 volle 10 Punkte. Null Einträge gelten als fehlende Recherche. |
| Kategorienvielfalt | 2 | Linear bis acht bekannte Kategorien; unbekannte Kategorie zählt nicht. |
| Redaktionelle Top-Therapien | 1 | Ab vier zugeordneten Top-Therapien 1 Punkt; sonst 0. |
| Persönliche Anreise | 7 | Erst- und Folgetermin per Video bestätigt: 7. Sonst Luftlinie bis 20 / 50 / 100 / 300 / 800 / über 800 km: 5,6 / 4,2 / 2,8 / 1,4 / 0,7 / 0. |

Ferntermine im Score berücksichtigen Telefon ODER Video. Die grüne Kennzeichnung „100 % online möglich“ verlangt dagegen Video für Erst- UND Folgetermin. Diese Unterscheidung ist aktuell beabsichtigt im Code, kann fachlich noch abgestimmt werden.

## Therapien: maximal 100 Punkte

| Aspekt | Maximum | Aktuelle Berechnung |
|---|---:|---|
| Zustandsveränderung | 25 | Verschlechterung / keine Veränderung / Verbesserung / Heilung: 0 / 8,33 / 16,67 / 25. |
| Crash-/PEM-Risiko | 20 | Keines / niedrig / mittel / hoch: 20 / 13,33 / 6,67 / 0. |
| Gamechanger | 10 | Ja-Anteil × 10. |
| Kosten je Einheit | 10 | Übernommen oder kostenlos: 10; acht Kostenstufen von 10 bis 0 in gleichen Schritten. „Nicht anwendbar“ wird ausgelassen. |
| Gesamtkosten | 10 | Wie Kosten je Einheit, mit den eigenen höheren Kostengrenzen. |
| Durchführungssetting | 10 | Selbstständig zu Hause / Hausbesuch / ambulant / stationär: 10 / 6,67 / 3,33 / 0. |
| Zugang | 10 | Selbstmanagement / frei erhältlich oder privater Anbieter / Rezept / nur Studie: 10 / 6,67 / 3,33 / 0. |
| Anbieteranzahl | 5 | 0,5 Punkte je bestätigtem Anbieter, volle 5 ab zehn; vorläufige Zuordnungen zählen nicht. Bei selbstständig umsetzbarem Selbstmanagement ausgelassen. |

## Gemeinsame Regeln und Punkte zur Abstimmung

- Community-Teilwerte werden erst ab zehn auswertbaren Antworten berücksichtigt.
- Fehlende Teilwerte geben keinen Nullpunkt-Abzug: Die vorhandenen Teilwerte werden auf 100 hochgerechnet. Daher sind 100 Punkte bei vollständigen Daten die Grundgewichtung; bei fehlenden Daten verschieben sich die wirksamen Anteile.
- Kosten richten sich nach dem ausgewählten Versicherungs- und Währungskontext.
- Symptome gehen derzeit in keinen der beiden Gesamtscores ein.
- Bei Therapien zählen Zustandsveränderung und Gamechanger zusammen 35 Punkte; beide beschreiben verwandte Erfahrungen.
- Therapiekosten zählen zweimal mit zusammen 20 Punkten. Das ist die aktuelle Gewichtung, noch keine abschließende fachliche Entscheidung.
- Bei Behandlern bekommen Umfang, Kategorienvielfalt und redaktionelle Auswahl zusammen 13 Punkte.
- Ferntermine zählen bei Behandlern bis zu 20 Punkte und können zusätzlich die vollen sieben Anreisepunkte ermöglichen.

Quellen im Repository: scripts/doctor_dashboard_score.js, scripts/treatment_dashboard_score.js und components/treatments_nd_reduced.php.
