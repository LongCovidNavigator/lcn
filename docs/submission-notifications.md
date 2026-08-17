# Benachrichtigungen über neue Community-Vorschläge

Der Bericht zählt Vorschläge seit dem letzten erfolgreichen oder übersprungenen Lauf. Eine E-Mail wird nur verschickt, wenn mindestens ein neuer Vorschlag eingegangen ist. Die Mail enthält außerdem die Gesamtzahl aller offenen Vorschläge und einen Link zur Freigabeseite.

## Konfiguration

Die vorhandenen Werte `LCN_MONITOR_TO` und `LCN_MONITOR_FROM` werden standardmäßig wiederverwendet. Optional können eigene Adressen gesetzt werden:

```env
LCN_SUBMISSION_NOTIFY_TO=empfang@example.org
LCN_SUBMISSION_NOTIFY_FROM=lcn@example.org
LCN_REVIEW_URL=https://example.org/lcn/freigaben.php
```

## Lokal testen

```text
php cron/send_submission_notifications.php --dry-run
```

Der Dry-Run verschickt keine E-Mail und zeigt den vollständigen Bericht in der Konsole.

## ALL-INKL-Cronjob

Täglich den geschützten HTTP-Endpunkt aufrufen:

```text
https://<domain>/<lcn-pfad>/cron/submission_notifications_http.php
```

Er nutzt dieselben HTTP-Basic-Zugangsdaten wie das Voting-Monitoring (`LCN_CRON_USERNAME` und `LCN_CRON_PASSWORD_HASH`). Empfohlen ist ein täglicher Lauf am Morgen. Wenn keine neuen Vorschläge vorliegen, wird keine Mail verschickt.
