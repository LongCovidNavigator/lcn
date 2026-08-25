# LCN DUMMY Fixture-Matrix v0.1

Stand: 2026-08-25

Ziel: wenige, künstliche Datensätze, die möglichst viele aktuelle API-/UI-Fälle abdecken. Alle Namen tragen eindeutig `TEST`/`DUMMY`.

## Ärzte / Praxen

| ID | Dummy-Datensatz | Hauptzweck | Geplante Abdeckung |
|---:|---|---|---|
| 900001 | Dr. TEST Vollausstattung mit außergewöhnlich langem akademischem Titel | Maximalfall | alle aktuell vorhandenen Arztfelder, 3 Standorte, Website/E-Mail/Telefon, Koordinaten, GKV+PKV, viele Specialties/Badges/Accessibility-Terms, 20+ Treatments, viele Votes |
| 900002 | TEST Praxis Minimal | Null-/Leerfall | nur zwingende Felder + Ort; sonst möglichst `NULL`; keine Terms, keine Votes, keine Treatment-Zuordnung |
| 900003 | DUMMY Praxis Layout Extrem mit sehr sehr langem Praxis- und Organisationsnamen | Layout-Stress | langer Displayname, lange Adresse, viele Terms, 25–30 Treatments, viele Votes |
| 900004 | Dr. TEST Nur GKV | Versicherungsfall | GKV=yes, PKV=no, kompakte normale Daten |
| 900005 | Dr. TEST Nur PKV | Versicherungsfall | GKV=no, PKV=yes |
| 900006 | TEST Versorgung Unbekannt | Unknown-Fall | GKV=unknown, PKV=unknown, wenige Angaben |
| 900007 | TEST Praxis ohne Koordinaten | Karten-/Geocoding-Fall | vollständige Adresse, aber lat/lng `NULL` |
| 900008 | TEST Zentrum Mehrere Standorte | Standortlogik | 4 Standorte, genau einer primär, unterschiedliche Kontaktangaben |

## Arzt-Votes

Die obigen Ärzte werden so befüllt, dass gleichzeitig folgende Fälle entstehen:

- 900001: gemischt, viele Votes
- 900002: keine Votes
- 900003: überwiegend negativ, viele Votes
- 900004: 100 % positiv
- 900005: genau 1 Vote
- 900006: positiv/neutral/negativ exakt gemischt
- 900007: wenige Votes
- 900008: viele Votes

Zusätzlich werden die aktuell von der API parallel gelesenen Aggregat-/Raw-Tabellen konsistent mitbefüllt.

## Treatments

| ID | Dummy-Datensatz | Hauptzweck | Geplante Abdeckung |
|---:|---|---|---|
| 900001 | TEST Behandlung Vollausstattung | Maximalfall | alle Treatment-Felder, viele Ärzte, viele Aliasse, viele Quellen, viele Symptome, gemischte Votes |
| 900002 | TEST Tx | kurzer Name | Minimaler Treatment-Datensatz, 1 Arzt, 1 Vote |
| 900003 | TEST Behandlung mit außergewöhnlich langem Namen für Layout- und Umbruchtests | Layout-Stress | langer Name/Slug/Textfelder |
| 900004 | TEST Behandlung ohne Anbieter | Empty Provider | keine Arzt-Zuordnung |
| 900005 | TEST Behandlung Viele Anbieter | Provider-Stress | Zuordnung zu allen Dummy-Ärzten |
| 900006 | TEST Behandlung Viele Aliasse | Alias-Stress | 10+ Aliasse verschiedener Alias-Typen |
| 900007 | TEST Behandlung Viele Quellen | Quellen-Stress | mehrere Source-Typen, lange Titel/URLs/Autoren |
| 900008 | TEST Behandlung Viele Symptome | Symptom-Stress | viele Symptome aus mehreren Kategorien |
| 900009 | TEST Behandlung ohne Symptome | Empty Symptoms | bewusst keine Symptom-Zuordnung |
| 900010 | TEST Behandlung Negativ-Votes | Vote-Fall | überwiegend contra |

## Treatment-Votes

- 900001: viele gemischte Votes
- 900002: genau 1 positiver Vote
- 900003: keine Votes
- 900004: 100 % positiv
- 900005: große Vote-Zahl
- 900010: überwiegend negativ

`lcn_raw_votes`, `lcn_votes` und `treatment_votes` werden so befüllt, dass die aktuelle API ihre parallelen Datenquellen testen kann.

## Terms

Für den ersten Fixture-Lauf werden repräsentative Terms aus allen heute relevanten Gruppen verwendet:

- `specialty`
- `badge`
- `accessibility`

Zusätzlich soll der Vollausstattungs-/Layout-Datensatz genug Terms erhalten, um Umbruch, Sortierung und lange Listen zu testen.

## Symptome

Kleine künstliche Auswahl über mehrere Kategorien, plus ein Treatment mit vielen Zuordnungen. Keine Masse erforderlich.

Beispiel-Namenskonvention:

- `TEST Symptom kurz`
- `TEST Symptom mit außergewöhnlich langem Namen für Layouttests`

## Quellen und Aliasse

Quellen verwenden ausschließlich Testdomains wie `https://example.test/...` und eindeutig künstliche Titel.

Alias-Beispiele tragen ebenfalls `TEST`/`DUMMY`, damit sie nie als echte Synonyme interpretiert werden.

## Community-Submissions

Kleine Auswahl für die bestehenden Statusfälle:

- neuer Arzt / pending
- Treatment-Änderung / reviewing
- possible_duplicate
- approved
- rejected
- Submission mit Community-Votes

## Vote-Abuse / Monitoring

Gezielte wenige Datensätze:

- offenes Abuse-Event
- bestätigtes Event
- dismissed Event
- aktive Source-Sperre
- abgelaufene Source-Sperre
- Monitoring-Run `sent`
- Monitoring-Run `failed`

Damit können Admin-/Monitoring-Funktionen getestet werden, ohne künstlich tausende Requests erzeugen zu müssen.

## Noch nicht fixture-fähig in v0.1

Folgende gewünschte UI-Fälle sind noch nicht sauber im aktuellen Datenmodell vorhanden und werden erst nach dem entsprechenden Schema/API-Schritt ergänzt:

- Kassensitz ja/nein/unbekannt
- Selbstzahler separat
- Ersttermin-Kosten
- Folgetermin-Kosten
- typische Gesamtkosten
- Wartezeit
- Warteliste offen/geschlossen

Sie bleiben explizit Teil der geplanten DUMMY-Abdeckung, aber nicht durch Fantasiefelder simuliert.
