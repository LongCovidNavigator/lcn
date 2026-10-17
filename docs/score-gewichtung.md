# Aktuelle Score-Gewichtung

Stand: 17. Oktober 2026 – ersetzt die ältere Gewichtung im Funktionsprüfbericht.

## Behandler

| Bereich | Teilaspekt | Maximum |
|---|---|---:|
| Belastung: 30 | Termin-Anpassung | 6 |
| | Ersttermin aus der Ferne | 3 |
| | Folgetermin aus der Ferne | 3 |
| | Persönliche Anreise | 18 |
| Zugang: 30 | Eigene Gesamtkosten | 20 |
| | Wartezeit Ersttermin | 5 |
| | Wartezeit Folgetermin | 5 |
| Erfahrungen und Angebot: 40 | Zustandsveränderung | 30 |
| | Therapieanzahl | 7 |
| | Kategorienvielfalt | 3 |

Sind Erst- UND Folgetermin aus der Ferne bestätigt, erhält der gesamte Belastungsbereich 30 Punkte, unabhängig von Wartezimmer und Entfernung. Erfasste Telefon- oder Videooptionen brauchen mindestens zehn Antworten und eine Ja-Mehrheit. Fehlen Videoantworten, kann die hinterlegte Bestätigung beider Online-Termine einspringen. Ein alleiniger Ersttermin reicht nicht.

Ohne diesen Sonderfall gelten die bisherigen Stufen relativ zu den neuen Gewichten. Anreise nach Luftlinie bis 20 / 50 / 100 / 300 / 800 / über 800 km: 14,4 / 10,8 / 7,2 / 3,6 / 1,8 / 0 Punkte. Therapieanzahl steigt linear bis 60 Einträgen, Kategorienvielfalt bis acht bekannten Kategorien. Redaktionelle Top-Therapien geben keine Punkte.

## Therapien

| Bereich | Teilaspekt | Maximum |
|---|---|---:|
| Belastung: 30 | Durchführungssetting | 5 |
| | Crash-/PEM-Risiko | 10 |
| | Entfernung | 15 |
| Zugang: 30 | Kosten, eine gemeinsame Basis | 20 |
| | Zugangsweg | 10 |
| Erfahrungen: 40 | Zustandsveränderung | 30 |
| | Gamechanger | 10 |

Anbieteranzahl hat keinen Einfluss auf den Score. Entfernung bezieht sich auf den nächstgelegenen bestätigten Anbieterstandort, unabhängig von Filtern der Behandlerliste. Vorläufige Zuordnungen bleiben ausgeschlossen. Bis 20 / 50 / 100 / 300 / 800 / über 800 km: 12 / 9 / 6 / 3 / 1,5 / 0 Punkte. Selbstmanagement zu Hause erhält 15 Punkte ohne Anreise. Bei einer zu Hause durchführbaren Therapie ist keine Anreise erforderlich, wenn ein bestätigter Anbieter beide Online-Termine oder Hausbesuche ermöglicht. Unbekannte Standorte bleiben fehlende Angaben.

Durchführungssetting selbstständig zu Hause / Hausbesuch / ambulant / stationär: 5 / 3,33 / 1,67 / 0 Punkte. Crash-/PEM-Risiko keines / niedrig / mittel / hoch: 10 / 6,67 / 3,33 / 0. Zugang Selbstmanagement / frei erhältlich oder privater Anbieter / Rezept / nur Studie: 10 / 6,67 / 3,33 / 0. Zustandsveränderung Verschlechterung / keine Veränderung / Verbesserung / Heilung: 0 / 10 / 20 / 30. Gamechanger: Ja-Anteil mal zehn.

### Wahl der Kostenbasis

Gesamtkosten haben Vorrang. Einzelkosten übernehmen die vollen 20 Punkte, wenn:
- mindestens zehn auswertbare Einzelkostenangaben vorliegen UND
- die Gesamtkosten weniger als zehn auswertbare Angaben haben ODER dort mehr als die Hälfte „nicht anwendbar“ lautet ODER Einzelkosten mindestens 20 auswertbare Angaben mehr als Gesamtkosten haben.

„Nicht anwendbar“ zählt nicht als auswertbare Kostenangabe. Beide Kostenfelder bleiben sichtbar, doch nur eines geht in den Score ein; die verwendete Basis wird angegeben. Keine ausreichende Basis bedeutet einen fehlenden Kostenwert. Kosten werden je ausgewähltem Versicherungskontext ausgewertet.

## Fehlende Daten und Vergleich

Community-Teilwerte zählen ab zehn auswertbaren Antworten. Fehlende Teilwerte werden ausgelassen; der verbleibende Wert wird auf 100 normalisiert. Die Oberfläche zeigt erreichte und bewertbare Punkte. Persönliche Entfernung wird mit demselben Standort auch für Vergleichsprofile berechnet. Bei Therapien sind sieben Teilwerte möglich, Kosten werden dabei einmal gezählt. Kein multiplikativer Crash-Faktor.

Geprüft: beide reinen Score-Tests, Kostenbasis-Grenzen 19/20 zusätzliche Angaben, Mindestzahlen, überwiegend nicht anwendbare Gesamtkosten, Nullkosten, Versicherungswechsel, Ferntermin-Sonderfall, Distanzgrenzen, fehlende Angaben und Deckelungen. Die API liefert nur bestätigte Anbieterstandorte für die Berechnung. Browserprüfung für beide Dashboards ohne JavaScript-Fehler.
