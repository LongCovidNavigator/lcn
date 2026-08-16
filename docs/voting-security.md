# LCN Voting-Schutz und Monitoring

## Datenmodell

- `lcn_raw_doctor_votes` und `lcn_raw_votes`: historische/Fake-Basiswerte.
- `doctor_votes` und `treatment_votes`: pseudonyme natürliche Einzelstimmen.
- `tbl_drs_votes_03` und `lcn_votes`: natürliche Kompatibilitätsaggregate; öffentliche APIs berechnen natürliche Werte direkt aus den Einzelvotes.
- `vote_request_events`: kurzfristige technische Requestdaten ohne rohe IP.
- `vote_abuse_events`: deduplizierte erkannte Auffälligkeiten.
- `vote_source_blocks`: temporäre Sperren.
- `vote_monitoring_runs`: Status täglicher Berichtsläufe.

Öffentliche Statistiken zählen natürliche Votes mit `review_status IN ('active', 'suspicious')`. `excluded` wird nicht gezählt. Die historische Raw-Basis wird weiterhin addiert.

## Zentrale Startschwellen

Die Startwerte stehen ausschließlich in `lcnVoteSecurityConfig()` in `api/_vote_abuse.php`:

- Soft: mehr als 5 Requests/Minute.
- Soft: mehr als 30 Requests/10 Minuten.
- Soft: mehr als 10 unterschiedliche Voting-IDs je Quelle/10 Minuten.
- Hard: mehr als 100 Requests/10 Minuten.
- Hard: mehr als 50 unterschiedliche Voting-IDs je Quelle/10 Minuten.
- Temporäre Sperre: 30 Minuten.
- Target: mehr als 15 geänderte Votes/10 Minuten.
- Target: mehr als 40 geänderte Votes/Stunde.
- Richtung: mehr als 12 gleichgerichtete geänderte Votes/10 Minuten.
- Request-Aufbewahrung: 48 Stunden.

Soft-Signale lassen den Vote zu und markieren betroffene Votes nach Möglichkeit als `suspicious`. Target-Signale löschen oder verwerfen keine Votes. Hard-Signale blockieren nur vorübergehend.

## Manuelle Review-Beispiele

Verdächtigen Vote ausschließen:

```sql
UPDATE doctor_votes
SET review_status = 'excluded'
WHERE vote_id = 123;
```

Entscheidung rückgängig machen:

```sql
UPDATE doctor_votes
SET review_status = 'active',
    flag_reason = NULL,
    flagged_at = NULL,
    flag_event_id = NULL
WHERE vote_id = 123;
```

Für Therapien gelten dieselben Operationen in `treatment_votes`.

## Monitoring lokal prüfen

Der Dry-Run erzeugt immer einen Bericht, verschickt nichts und markiert keine Events als gemeldet:

```text
php cron/send_vote_monitoring_report.php --dry-run
```

Ein echter Lauf benötigt außerhalb des Webroots:

```env
LCN_MONITOR_TO=monitoring@example.org
LCN_MONITOR_FROM=lcn@example.org
```

Erst wenn `mail()` erfolgreich zurückkehrt, werden die enthaltenen Events über `reported_at` markiert. Bei einem Fehler bleibt der Status offen und der nächste Lauf berücksichtigt die Events erneut.

## ALL-INKL-Cronjob

Der HTTP-Einstiegspunkt ist:

```text
https://<produktive-domain>/<lcn-pfad>/cron/vote_monitoring_http.php
```

Er verwendet HTTP Basic Authentication und benötigt:

```env
LCN_CRON_USERNAME=<interner-benutzername>
LCN_CRON_PASSWORD_HASH=<password_hash-ausgabe>
```

Das Klartextpasswort gehört nur in den geschützten KAS-Cronjob beziehungsweise dessen Authentifizierung, nicht in Git oder URL-Parameter. Empfohlen ist ein täglicher Lauf; die konkrete Uhrzeit wird beim Deployment festgelegt.

## Noch extern zu erledigen

- Projekt-Absender- und Empfängeradresse festlegen.
- Mailtransport auf dem ALL-INKL-Zielsystem prüfen; falls `mail()` dort nicht geeignet ist, SMTP-Transport ergänzen.
- Cron-Zugangsdaten erzeugen und außerhalb des Webroots konfigurieren.
- HTTP-Cronjob im KAS täglich einrichten.
- HTTPS-, Mail- und Cron-End-to-End-Test auf dem Zielsystem durchführen.
