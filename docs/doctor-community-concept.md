# Arzt-Konzept: Community-Daten und Standort

Seit 22.09.2026 verwendet die reguläre Route `arzt_detail.html?id=627` das neue Vier-Ansichten-Konzept. Suchkarten, Startseite und Treatmentseiten verlinken bereits auf diese Route. Sie verwendet dieselbe Implementierung wie `arzt_detail_konzept.html?id=627`; der Entwurf behält zusätzlich die Behandlerauswahl mit allen 39 freigegebenen IDs. Stammdaten und Treatments kommen unverändert aus `api/doctor_detail.php`. Community-Verteilungen werden getrennt über `api/doctor_community.php?id=627` geladen.

Die reguläre Seite hat wieder die gemeinsame Seitennavigation, Footer, Such-Rücklink und einen Link zum Ergänzen des angezeigten Eintrags. Fehlende/ungültige IDs werden nicht durch einen Standardbehandler ersetzt. Der ältere Dummy unter `arzt_detail_dummy.php` verwendet seinen eingefrorenen bisherigen HTML-Aufbau aus `components/arzt_detail_legacy.html` und bleibt zum Vergleich verfügbar. Weitere Standorte stehen im Steckbrief; die Karte zeigt den Hauptstandort und den gewählten eigenen Standort.

## Datenbank und Schalter

Die drei neuen Tabellen liegen in der bestehenden **lcn_hybrid_database**:

- `doctor_community_options`: zulässige Frage/Kontext/Antwort-Kombinationen und Beschriftungen.
- `doctor_community_answers`: echte Antworten, getrennt von Dummy-Antworten.
- `doctor_community_dummy_answers`: ausschließlich synthetische Antworten für die 39 Behandler.

In der bereits vorhandenen geschützten Datei **C:/xampp/htdocs/private/lcn.env** steht neben der Datenbankkonfiguration:

```dotenv
LCN_DOCTOR_COMMUNITY_INCLUDE_DUMMY=1
```

`1` mischt die separat gespeicherten Dummy-Antworten in die Verteilungen der neuen Community-API. `0` liefert ausschließlich echte Antworten. Ohne Einstellung gilt `0`. Die Kennzeichnung und die Anzahl von echten und Dummy-Antworten bleiben in der Antwort getrennt sichtbar. Der Schalter wirkt beim nächsten API-Aufruf; nach Änderung die Seite neu laden. Er verändert weder die gewählte Datenbank noch alte Arztbewertungen oder die übrigen Seiten.

## Antwortstruktur

Eine Zeile ist eine Antwort eines pseudonymen Teilnehmers auf eine Frage bei einem Behandler. Der Primärschlüssel `(dr_id, respondent_key, question_key, context_key)` verhindert doppelte Antworten; spätere Änderungen ersetzen diese Zeile. `option_value` zählt ab 1 und ist durch einen Fremdschlüssel auf den Optionskatalog beschränkt.

| Frage | Kontext | Optionen |
|---|---|---|
| `adaptation` | leer | 5 Anpassungsstufen |
| `appointment_first_onsite`, `appointment_first_phone`, `appointment_first_video` | leer | 1 Ja, 2 Nein |
| `appointment_followup_onsite`, `appointment_followup_phone`, `appointment_followup_video` | leer | 1 Ja, 2 Nein |
| `costs` | `gkv` oder `pkv` | 6 Eigenkostenstufen |
| `wait` | leer | 5 Wartezeitstufen |
| `effect` | leer | Verschlechterung, keine Veränderung, Verbesserung, Heilung |

Versicherung ist ein eigener Kontext, keine Kostenstufe. Zusätzliche Versicherungssysteme können später im Katalog ergänzt werden. Fehlende Antworten sind keine Zeile, niemals eine Nein-Stimme. Prozentwerte beziehen sich nur auf die beantwortete Frage im betreffenden Kontext. Summen können durch Rundung um wenige Zehntel von 100 % abweichen. Gleichstände haben keinen einzelnen Schwerpunkt. Ohne Antworten bleiben Prozente und Mittelwert `null`.

Die alten pro/neutral/contra-Bewertungen werden nicht umgedeutet oder kopiert. Eine alte positive Stimme sagt beispielsweise nicht, ob jemand Verbesserung oder Heilung meint.

## Migration und reproduzierbare Dummy-Daten

```powershell
C:/xampp/php/php.exe scripts/prepare_doctor_community.php
C:/xampp/php/php.exe tests/doctor_community_smoke.php
```

Der CLI-Befehl legt die Tabellen aus `migrations/011_doctor_community.sql` an, ergänzt den Optionskatalog und erzeugt deterministische, je Behandler und Frage variierende Antworten. Es sind 30.426 Antworten für 39 Behandler und 11 Frage/Kontext-Kombinationen. Wiederholtes Ausführen überschreibt keine bestehenden Dummy-Antworten und erzeugt keine Duplikate. Manuell verfeinerte Werte bleiben erhalten. Das Skript ist gegen Aufruf über HTTP gesperrt und auf die lokale Hybrid-Datenbank begrenzt.

Eigene Angaben werden über `api/doctor_community_answer.php` gespeichert. GET `api/doctor_community.php` liefert zusätzlich `own_answers`. Die vorhandene HttpOnly-Cookie-Kennung `lcn_voter` wird serverseitig gehasht; pro Arzt, Frage und Kontext ersetzt eine neue Auswahl die bisherige Antwort (atomarer Upsert). Zurücksetzen löscht nur die eigenen Antworten zur aktuellen Praxis. JSON-POST und gleiche Origin sind Pflicht, IDs/Fragen/Werte werden serverseitig validiert. Die alte Pro/Neutral/Contra-Missbrauchsauswertung ist nicht auf diese Fragebögen übertragen. Es gibt noch keine zusätzliche Ratenbegrenzung für diesen Endpunkt. Dummy-Antworten werden niemals beschrieben. Der Standort bleibt lokal gespeichert.

Die Zuordnung gilt für diesen Browser: Nach Löschen des Cookies oder auf einem anderen Gerät können frühere Angaben nicht wieder zugeordnet werden. Die Antworten bleiben dabei in der Datenbank. Die Browserkennung ist keine verifizierte Personenidentität.

## Gemeinsamer Standort

Der Entwurf verwendet `lcn_shared_location_preference` und `lcn_shared_location_cleared` sowie dieselbe `api/geocode_location.php` wie die bestehenden Seiten. Ältere Arzt-/Treatment-Standortwerte werden beim Lesen berücksichtigt; Entfernen leert alle drei Standortschlüssel. Änderungen aus anderen Tabs werden per `storage`-Ereignis übernommen. Die Karte verwendet weiterhin Leaflet, Esri World Topo und die vorhandenen Markersymbole; Entfernung ist Luftlinie. Die bestehende Ortssuche ist derzeit auf Deutschland begrenzt.

## Datenabdeckung

Siehe [Auswertung der 39 Behandler](doctor-profile-coverage.md). Neu erzeugen mit:

```powershell
C:/xampp/php/php.exe scripts/audit_doctor_profiles.php | Set-Content -Encoding utf8 docs/doctor-profile-coverage.md
```
