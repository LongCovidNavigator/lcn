# KI-Kartenbilder für Verbesserungsvorschläge

Stand: 2026-11-06. Implementiert und lokal migriert, noch nicht mit Cloudflare-Zugangsdaten aktiviert.

## Aktivieren

1. Kostenlosen Cloudflare-Account anlegen: https://dash.cloudflare.com/sign-up . Kein Domainumzug nötig; die bestehende PHP-Seite ruft die REST API auf.
2. Im Dashboard zu Workers AI → Use REST API gehen. Die Vorlage Create a Workers AI API Token verwenden; sie benötigt Workers AI Read und Edit. Token auf das betreffende Konto begrenzen. Account-ID kopieren.
3. In der bestehenden geschützten Server-Konfiguration (lokal normalerweise `C:/xampp/htdocs/private/lcn.env`, nicht im öffentlichen `lcn`-Ordner) ergänzen:

```dotenv
LCN_FEEDBACK_AI_ENABLED=1
LCN_CLOUDFLARE_ACCOUNT_ID=ACCOUNT_ID_HIER_EINTRAGEN
LCN_CLOUDFLARE_AI_TOKEN=TOKEN_HIER_EINTRAGEN
```

Den echten Token nicht in Chat, JavaScript oder Git eintragen. Kein bezahltes Cloudflare-Abo für den ersten Test nötig. Die Variablen müssen auch auf dem späteren Webserver hinterlegt werden. Nach Änderungen Seite neu laden; bei serverweit gesetzten Prozessvariablen Apache neu starten.

4. Für andere Installationen zuerst die additive Migration `migrations/20261106_feedback_images.sql` ausführen. Lokal ausschließlich `php scripts/prepare_feedback_images.php` verwenden; das Skript prüft LOCAL_HYBRID und lcn_hybrid_database. Kein automatischer Datenbankumbau in Webrequests.
5. Unter Mitgestalten → Eigene Idee einbringen einen Titel und ein Motiv eingeben. Übermittlung bestätigen, Bild erstellen und Vorschlag einreichen. Im Adminbereich Bild prüfen und Vorschlag freigeben. Ein realer Cloudflare-Aufruf muss nach Hinterlegen der Zugangsdaten noch geprüft werden.
6. Abschalten: `LCN_FEEDBACK_AI_ENABLED=0`. Bereits gespeicherte Bilder und die 20 vorhandenen Motive bleiben nutzbar.

Offizielle Einrichtung: https://developers.cloudflare.com/workers-ai/get-started/rest-api/
Modell: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
Preise: https://developers.cloudflare.com/workers-ai/platform/pricing/

## Verhalten

- FLUX.1 Schnell, vier Rechenschritte, fest vorgegebener Illustrationsstil. Titel wird nur als bearbeitbarer Motivvorschlag eingesetzt. Nur das ausdrücklich bestätigte Motiv wird gesendet, nicht die übrigen Formularfelder.
- Vorschau ist direkt ausgewählt; vorhandenes Motiv oder Entfernen der Auswahl sind möglich. Kein Bild ist Pflicht. Ein fehlgeschlagener Versuch bewahrt die bisherige Auswahl.
- 100 reservierte Provideraufrufe pro UTC-Tag für diese Installation, zehn pro Browser-HMAC und IP-HMAC, zwei pro Entwurfs-ID und UTC-Tag. Entwurfs-IDs sind clientseitig und kein eigenständiger Missbrauchsschutz; Browser/IP und globales Limit gelten zusätzlich. Neue Browser oder verteilte IPs können das globale Kontingent ausschöpfen, aber nicht erhöhen.
- Reservierung vor dem Aufruf, mit Transaktion und Zeilensperren. Auch Providerfehler verbrauchen einen Versuch. Das Limit gilt pro Installation/Datenbank, nicht für andere Anwendungen desselben Cloudflare-Kontos. Das kostenlose Cloudflare-Kontingent wird kontoweit geteilt.
- Höchstens 55 Sekunden Wartezeit beim Provider, begrenzte Antwortgröße, validierte Rasterformate. Kein automatischer Retry oder Wechsel zu kostenpflichtigen Modellen.
- Bilddaten liegen in der neuen Tabelle tbl_feedback_images. Entwurf gehört zur vorhandenen anonymen Browseridentität. Zuordnung ist einmalig und erfolgt in derselben Transaktion wie die Einreichung. Eine fremde oder abgelaufene Bild-ID wird abgewiesen.
- Abruf ausschließlich über api/feedback_image.php: Gäste abgewiesen; Entwürfe nur für den Ersteller (24h) und Admin; eingereichte Bilder erst nach Freigabe öffentlich innerhalb der Beta. Admin kann eingereichte Bilder prüfen. Keine privaten Bilder in einem öffentlichen Upload-Ordner.
- Verwaiste Entwürfe älter als 24h werden bei einer späteren erfolgreichen Generierung entfernt, nicht durch einen Cronjob. Eingereichte Bilder bleiben beim Beitrag erhalten. Bildmotive aus dem vorhandenen Set werden ebenfalls beim Beitrag gespeichert.
- Generierte Prompttexte werden nicht in der Datenbank aufbewahrt. Provider-Zugangsdaten und Rohantworten werden nicht an den Browser ausgegeben. Hinweise zur optionalen externen Verarbeitung stehen im Formular und in datenschutz.html.

## Prüfung

- `php tests/feedback_images.php`: isolierte temporäre Quotenzähler; Transaktions-Rollback für Bildfixtures; Besitzerbindung, Einmalzuordnung, globale/Browser-/Entwurfsgrenzen und Providerformatprüfung.
- `node tests/feedback_images_ui.cjs`: Provider und Einreichung simuliert; Einwilligung, Vorschau, Auswahl, Fehlererhalt, Versuchslimit, Formularwechsel, Payload und mobile Breite.
- `node tests/feedback_community.cjs`: vorhandene Formularabläufe, ohne persistierte Einreichungen.

Der echte Anbieteraufruf sowie Qualität und Laufzeit des Modells sind bis zur Konfiguration ungetestet. Die im Gespräch erzeugten Dummy-Bilder stammen aus Imagegen; gleiche Qualität von FLUX ist damit nicht zugesichert.
