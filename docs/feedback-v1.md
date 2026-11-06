# Feedback und Mitgestaltung V1

## Lokal ausprobieren

- Website: http://localhost/lcn/mitgestalten.html
- Administration: http://localhost/lcn/feedback_admin.php
- Ergänzende Symptomübersicht: http://localhost/lcn/symptome.php

Apache und MariaDB müssen laufen. Auf localhost verwendet das System die bestehende lokale Adminberechtigung. Online gelten die vorhandene HTTP-Authentifizierung und der konfigurierte Adminbenutzer. Gäste werden zusätzlich in der Feedback-API abgewiesen. Keine neue Anmeldung oder SaaS-Abhängigkeit.

Die sechs lokalen Beispielideen sind ausdrücklich als Testideen gekennzeichnet und haben keine erfundenen Stimmen. Neue Beiträge zunächst unter „Idee einreichen“ absenden, dann im Adminbereich freigeben. Dort Kommentare separat freigeben, Status und öffentliche Begründung ändern, offizielle Antworten schreiben und doppelte Ideen zusammenführen. Bei einer Zusammenführung ist die Ziel-ID anzugeben und die konkrete Aktion zu bestätigen. Die Quell-URL zeigt danach den Zielvorschlag. Private Meldungen erscheinen ausschließlich im Adminbereich.

## Abgrenzung

Produktfeedback ist ein eigenständiges System. Vorhandene Behandler-/Therapiekorrekturen, fachliche Bewertungen und deren Endpunkte wurden nicht geändert. Auf Detailseiten kommt lediglich ein zusätzlicher Link hinzu. Er übergibt die bestehenden IDs; die Feedback-API prüft deren Existenz. Die neue Symptomübersicht verwendet ausschließlich bestehende Symptome und bietet Suche, Kachel-/Tabellenansicht und Pagination; es gibt keine neuen medizinischen Symptomdetailseiten.

## Dateien und Schema

Kern: `api/_feedback.php`, `api/feedback.php`, `mitgestalten.html`, `feedback_admin.php`, `scripts/feedback.js`, `styles/feedback.css`.

Integration: `components/header.html`, `components/treatments_nd_view.php`, `index.html`, `freigaben.php`, `arzt_detail.html`, `therapie_detail.html`, `therapie_detail.php`, `scripts/feedback_context.js`. Zusatz: `symptome.php`.

Migration: `migrations/20261106_feedback.sql`; ausschließlich neue InnoDB/utf8mb4-Tabellen:

- `tbl_feedback_ideas`: Ideen, Moderation, Status, Kontext, private Kontaktadresse, offizielle Antwort, Weiterverweis bei Zusammenführung.
- `tbl_feedback_votes`: eindeutiger Primärschlüssel aus Idee und Browseridentität.
- `tbl_feedback_comments`: Kommentare mit eigenem Moderationsstatus.
- `tbl_feedback_reports`: ausschließlich private Meldungen und deren Bearbeitungsstand.
- `tbl_feedback_history`: Status-/Moderationsänderungen und Zusammenführungen mit Adminidentität, Zeitpunkt und optionaler öffentlicher Statusbegründung.
- `tbl_feedback_limits`: kurzlebige Zähler zum Spamschutz; keine Nachrichtentexte und keine Klartext-IP-Adressen.

Fremdschlüssel sichern die internen Beziehungen. Polymorphe Katalogbezüge werden serverseitig validiert, ohne bestehende Katalogtabellen oder Beziehungen zu verändern.

## Migration und Testdaten

Im Websiteverzeichnis mit vorhandener geschützter Konfiguration ausführen:

```powershell
php scripts/prepare_feedback.php
php scripts/seed_feedback.php
```

Beide Werkzeuge sind nur per CLI verfügbar und prüfen vor dem Datenbankzugriff das Profil `LOCAL_HYBRID`, einen Loopback-DB-Host und den Datenbanknamen `lcn_hybrid_database`. Die Migration ist additiv und wiederholbar. Die Seed-Datei ist separat und überschreibt vorhandene Ideen nicht. Keine automatische Seed-Ausführung online. Für eine spätere Freigabe ist die SQL-Migration über den bestehenden Deploymentprozess auszuführen; die lokalen Hilfsskripte bleiben absichtlich auf die lokale Datenbank begrenzt.

## API

Alle Aktionen liegen unter `api/feedback.php`. Antworten enthalten `ok`, Fehler zusätzlich `error`. POST benötigt JSON und eine passende Same-Origin-Origin/Referer-Angabe. GET-Aktionen haben keine fachlichen Schreibwirkungen; `config` initialisiert bei Bedarf das bestehende anonyme Browsercookie.

| Methode | action | Parameter / Ergebnis |
| --- | --- | --- |
| GET | config | Kategorien, Entwicklungsstände, private Meldekategorien, Adminberechtigung |
| GET | list | `q`, `category`, `status`, `sort` (votes/new/updated), `page`; 15 Ideen pro Seite |
| GET | detail | `id`, `page`; veröffentlichte Idee, Stimmen, eigene Unterstützung, bis zu 30 freigegebene Kommentare und letzte 100 Statusänderungen |
| POST | create | `title`, `description`, `category`; optional `display_name`, `email`, `entity_type`, `entity_id`; immer zunächst pending |
| POST | vote | `id`, `supported` als Boolean; idempotent setzen/entfernen, frischer Stimmenstand |
| POST | comment | `id`, `body`, optional `display_name`; immer zunächst pending |
| POST | report | `category`, `body`; optional `email`, `page_path`, `entity_type`, `entity_id`; ausschließlich privat |
| GET | admin_queue | `kind` (ideas/comments/reports), optional `state`, `page`; 30 Einträge pro Seite plus Dashboardzahlen |
| POST | admin_idea | `id`, `title`, `description`, `category`, `status`, `moderation`, optional `team_reply`, `reason` |
| POST | admin_comment | `id`, `moderation` (approved/hidden/deleted) |
| POST | admin_report | `id`, `status` (open/done/archived/deleted) |
| POST | admin_merge | `id` als Quelle, `target_id` als Ziel |

Kein öffentlicher Abruf privater Meldungen, Kontaktadressen oder ungeprüfter Kommentare. Kategorien und sieben Entwicklungsstände sind zentral in `api/_feedback.php` konfiguriert. Öffentliche Inhalte verwenden ausschließlich Textausgabe mit HTML-Escaping. HTTP: 201 bei Einreichung, 400 bei ungültigen Daten, 403 bei fehlender Berechtigung/falschem Ursprung, 404 bei nicht veröffentlichten Ideen, 405/415 bei falscher Methode/Medientyp, 413 bei zu großem Body, 429 bei Spamlimit und generische 500 bei internen Fehlern.

## Identität, Transaktionen und Sicherheit

Die vorhandene `lcn_voter`-Identität wird wiederverwendet: zufälliges HttpOnly-/SameSite-Lax-Cookie, Secure bei HTTPS, mit bestehendem Secret serverseitig per HMAC abgeleitet. IP-Adressen sind keine Abstimmungsidentität. Die separate Feedback-Ratenbegrenzung verwendet Browser-HMAC und Quell-IP-HMAC in Zehn-Minuten-Fenstern: 8 Einreichungen je Aktion, 60 Vote-Anfragen und 100 Adminänderungen. Abgelaufene Ratenzähler werden beim Schreiben entfernt. Gelöschte Cookies und mehrere Browser ermöglichen weitere Identitäten; Stimmen sind ausdrücklich keine repräsentative Umfrage.

Votes und Kommentare sperren den zugehörigen Ideendatensatz. Zusammenführungen sperren beide Ideen in sortierter ID-Reihenfolge und übernehmen Kommentare samt Moderationsstand sowie deduplizierte Stimmen in einer Transaktion. Quellideen und ihre Historie bleiben als Weiterverweise erhalten. Fremdschlüssel und eindeutige Constraints verhindern verwaiste interne Beziehungen und doppelte Stimmen.

Alle Adminaktionen werden serverseitig autorisiert. Es gibt keine neue schwache Adminanmeldung. Online muss weiterhin die vorhandene Webserverauthentifizierung den gesamten Betabereich schützen. Die bestehende Same-Origin-Prüfung für JSON-Schreibzugriffe wird als CSRF-Schutz verwendet; es werden weder Formular-POSTs noch Cross-Origin-POSTs akzeptiert. Fehlerdetails werden ausschließlich serverseitig protokolliert, nicht an Nutzer ausgegeben.

## Datenschutz und Aufbewahrung

Entsprechend der Produktentscheidung gibt es **keine automatische Löschung von Ideen, Kommentaren, Meldungen oder Kontaktadressen**. Nur technische kurzlebige Ratenzähler laufen automatisch ab. Öffentliche Beiträge bleiben nach Freigabe erhalten. Private Meldungen können im Adminbereich bearbeitet, archiviert und ausdrücklich gelöscht werden; Kommentare können freigegeben, ausgeblendet oder gelöscht werden. Ideen lassen sich ablehnen und archivieren. Archivieren ist keine Löschung.

E-Mail-Adressen sind optional, bleiben ausschließlich administrativ sichtbar und dienen nur Rückfragen; es gibt keine automatische Benachrichtigung und keinen E-Mail-Versand durch dieses Modul. Formulare weisen auf Öffentlichkeit, Moderation, sensible Gesundheitsdaten und die private Verwendung von Kontaktangaben hin. Keine zusätzlichen Tracker, Analysedienste oder externen Schnittstellen. Die Hinweise sind technische Produkttexte, keine rechtlich geprüften Rechtstexte.

## Tests

```powershell
php tests/feedback.php
node tests/feedback_ui.cjs
node tests/feedback_regression.cjs
php tests/database_environment.php
```

PHP-Datenbanktests verwenden ausschließlich die abgesicherte lokale Datenbank und rollen alle Fixtures zurück. Browser-/HTTP-Tests benötigen Playwright und den vorhandenen Edge-Kanal sowie Apache unter 127.0.0.1. Sie erzeugen eindeutig markierte lokale Testeinträge und entfernen nur diese anschließend per `tests/feedback_cleanup.php`. Das echte Spamlimit bleibt aktiv: häufige Wiederholungen innerhalb desselben Zehn-Minuten-Fensters können erwartungsgemäß mit 429 stoppen; dann nach Ablauf des Fensters erneut ausführen. Limits für echte Nutzer werden durch die Tests nicht zurückgesetzt.

Abgedeckt: Validierung, gültige/ungültige Katalog-IDs, verborgene ungeprüfte Ideen/Kommentare, Freigabe, Suche/Filter/Sortierung, acht parallele identische Vote-Anfragen, Zurücknehmen, XSS-Textdarstellung, Statushistorie, Merge-Deduplizierung und Kommentarmitnahme, private Meldungen, verweigerter Adminzugriff, Cross-Origin-Abweisung, Behandler-/Therapiekontext, Symptomübersicht und Layout bei 1440/768/390 Pixeln. Screenshots liegen unter `output/feedback-*.png`.

## Grenzen und vor einem Onlinebetrieb zu prüfen

- Keine automatischen E-Mails, Nutzerkonten, Anhänge oder verschachtelten Diskussionen.
- Ähnlichkeitssuche basiert auf SQL-LIKE-Worttreffern; sie erkennt keine semantischen Dubletten. Bei großen Datenmengen wäre Volltextindexierung sinnvoll.
- Individuelle Beiträge können medizinische Angaben enthalten; öffentliche Freigabe erfordert aktive Moderation.
- Keine automatische Rücknahme einer Zusammenführung. Die Administration bestätigt Quelle und Ziel vor Ausführung.
- Manuelle Bearbeitung eines fehlerhaften Katalogbezugs und eine dedizierte Kontaktadresslöschung sind in dieser V1 nicht als eigene Adminaktionen vorhanden.
- Aufbewahrung/Löschung, Datenschutzhinweise, Moderationszuständigkeit, HTTPS, Betazugang sowie Backups und Migration im Onlineworkflow vor Veröffentlichung prüfen.
- Kein Deployment und keine Änderungen an einer Online-Datenbank durch diese Umsetzung.

## Ergebnis der lokalen Abnahme (06.11.2026)

Erfolgreich ausgeführt: `tests/feedback.php` (13 Prüfungen mit Rollback), `tests/feedback_ui.cjs` (vollständige HTTP-/Browserabläufe und drei Bildschirmbreiten), `tests/feedback_regression.cjs` (bestehende Behandlerkorrekturansicht und Therapierückmeldungen ohne fachliche Schreibzugriffe), `tests/database_environment.php`, PHP-/JavaScript-Syntaxprüfungen und `git diff --check`. Zusätzlich Tastaturfokus, mobiles Menü einschließlich Escape und die Symptomübersicht geprüft. Alle isolierten HTTP-Testeinträge wurden wieder entfernt; nur die sechs gekennzeichneten Seed-Ideen bleiben bestehen.

Ein ebenfalls gestarteter älterer Bestandstest, `tests/doctor_profile_feedback_tiles.cjs`, scheitert am Selektor `.profile-correction-tile`. Diese Komponente fehlt bereits im unveränderten Git-Ausgangsstand; der bestehende Dialog verwendet `.doctor-profile-dialog` und einzeln aufklappbare Editoren. Der aktuelle Dialog wurde deshalb mit dem zusätzlichen lesenden Regressionstest geprüft, der erfolgreich besteht. Der alte Test und das bestehende Korrektursystem wurden nicht verändert.

Zwischenläufe deckten einen mobilen Umbruch bei langen Titeln auf (behoben) und erreichten nach mehreren Testwiederholungen das echte Spamlimit (429, erwartetes Verhalten). Die abschließende vollständige Testsuite bestand. Kein Online-Deployment, kein Commit und keine Änderung an bestehenden Katalog-/Bewertungstabellen.

## Schwebender Feedbackzugang und Homepage-Banner

Alle HTML-Seiten und gemeinsamen PHP-Seitentemplates binden `scripts/feedback_context.js` direkt und mit Versionskennung ein. Die gemeinsame Navigation besitzt zusätzlich einen gegen Mehrfachinitialisierung geschützten Fallback. Der blaue Feedbackbutton erscheint auch auf Vorschlagsformularen und Verwaltungsseiten. Die früheren großflächigen Feedbackkästen auf Detailseiten entfallen. Er wird nur bei offenen Dialogen verborgen; beim Ausfüllen von Formularfeldern bleibt er erreichbar. Das Formular bietet private Rückmeldungen und verlinkt separat zur öffentlichen Mitgestaltung. Das bestehende Korrektur-/Bewertungssystem bleibt unabhängig.

Beim Öffnen wird der Kontext eingefroren: Seitenname, bestehende Behandler-/Therapie-ID, aktiver Reiter sowie zuletzt ausgewählter oder sichtbarer Inhaltsbereich mit Überschrift und gegebenenfalls Element-ID. Der sichtbare Hinweis im Dialog zeigt den Bezug. ID und Typ werden mit der bestehenden API validiert; Reiter/Element/Name werden als lesbarer Kontextblock in der privaten Nachricht gespeichert. `page_path` enthält nur den lokalen Dateinamen, den bekannten Entitätsparameter und einen einfachen Abschnittsbezeichner. Suchbegriffe, sonstige URL-Parameter und Feldinhalte werden nicht automatisch übernommen. Ohne Absenden findet keine Kontextspeicherung statt. Es werden keine Bildschirmfotos angefertigt.

Der Lavendel-Motivationsbanner mit dem eigenen Bild steht zusätzlich auf der Startseite direkt nach dem Karussell und verlinkt zur Mitgestalten-Seite. Neue Datei: `styles/feedback_floating.css`. Der neue Test `node tests/feedback_floating.cjs` prüft Kontextpayload, private Übermittlung mit abgefangener Testantwort, Tastaturfokus, Eingabe-/Dialogsichtbarkeit, drei Bildschirmbreiten und die Bannerposition. Die Aktualisierung benötigt keine weitere Datenbankmigration.

Die direkte Einbindung wurde zusätzlich mit Chrome auf allen 20 HTML-Einstiegsseiten und den regulären PHP-Seiten überprüft, einschließlich Weiterleitungen. Der Test simuliert ein altes Navigationsskript und prüft das Vorschlagsformular mit fokussiertem Eingabefeld.

## Überarbeiteter Mitgestalten-Bereich

Die öffentliche Seite verwendet zusätzlich `styles/feedback_community.css`; die Adminoberfläche behält ihre eigene Struktur. Desktop/Tablet: Themenauswahl und kurze Orientierung links, Ideenliste rechts. Mobil: Themen als horizontal scrollbare Auswahl. Ideen enthalten klare Status-/Themenlabels, Unterstützung und einen direkten Diskussionseinstieg. Die Suche reagiert nach kurzer Eingabepause; Themen, Sortierung und Status werden direkt angewendet.

Die zweite Ansicht „Was sich entwickelt“ lädt die veröffentlichten Ideen für Geplant, In Arbeit und Umgesetzt. Leere Stände sind ausdrücklich als leer dargestellt, ohne fiktive Planungen. Pro Entwicklungsstand werden maximal drei Ideen und gegebenenfalls ein Einstieg in die vollständig paginierte Liste gezeigt.

Ideen- und Privatnachrichtenformulare öffnen sich in nativen modalen Dialogen. Vorhandene Links mit `#idee`/`#privat` funktionieren weiter. Pflichtfelder, optionale Angaben, Moderation und API bleiben erhalten. Fehler werden direkt im geöffneten Formular angezeigt; bei erfolgreicher Übermittlung schließt es und zeigt eine Bestätigung auf der Seite. Entwürfe bleiben beim Schließen erhalten. Auf Ideendetails entfällt der große Motivationsbanner, damit Diskussion und Entwicklungsstand im Mittelpunkt stehen.

Prüfung: `node tests/feedback_community.cjs` mit echten Lesedaten und abgefangener Testeinreichung; Themenfilter, Entwicklungsansicht, Formulare, bestehende Hashlinks, Detailansicht und Layout bei 1440/768/390 Pixeln. Neue Vorschauen unter `output/feedback-redesign-*.png`. Keine Datenbankmigration für diese UI-Überarbeitung.

## Vereinfachung: zwei Feedbackwege

Die öffentliche Oberfläche unterscheidet nur noch zwischen Verbesserungsvorschlägen zur Weiterentwicklung (öffentlich nach Moderation) und kritischem Feedback (vertraulich, nur für die Administration). Kategorienauswahl, Themenfilter und Kategorienlabels entfallen ebenso wie Anzeigename/Pseudonym in Vorschlags- und Kommentarformularen. Kommentare werden mit dem neutralen Label „Community-Beitrag“ dargestellt. Bestehende Daten bleiben erhalten; optionale Kontaktadressen bleiben privat und dienen nur Rückfragen.

Auch der schwebende Dialog enthält keine Kategorienauswahl mehr und ist als kritisches, vertrauliches Feedback beschriftet; er verlinkt zu öffentlichen Verbesserungsvorschlägen. Die API akzeptiert neue Vorschläge und private Nachrichten ohne Kategorie und verwendet intern den allgemeinen Wert. Das interne Schema und alte Datensätze werden nicht destruktiv geändert. Die Einleitung zum Vorschlagsformular lautet: „Teile hier deinen Verbesserungsvorschlag für die Weiterentwicklung des Navigators.“

Die Browserprüfung deckt nun ausdrücklich die Abwesenheit von Namens-/Kategorienfeldern und die Einreichung ohne diese Angaben ab.

## Reduzierte Übersicht und Auswahl im Formular

Die separate Ansicht „Was sich entwickelt“ und die komplette linke Erklärungsspalte entfallen vorerst. Statuslabels und administrative Statuspflege bleiben bestehen. Die öffentliche Seite konzentriert sich auf die Vorschlagsliste.

„Idee einbringen“ öffnet einen gemeinsamen Dialog mit zwei Optionen ganz oben: „Idee einbringen – Öffentlich nach Prüfung“ und „Vertrauliches Feedback geben – Nur für das LCN-Team“. Die beiden Formulare bleiben technisch getrennt: die öffentliche Option sendet `create`, die vertrauliche Option `report`. Beim Umschalten bleiben Entwürfe erhalten; private Angaben werden nicht in einen öffentlichen Vorschlag übernommen. Alte `#idee`-/`#privat`-Links wählen die passende Option im gemeinsamen Dialog vor. Die Bezeichnung „kritisches Feedback“ entfällt.

`tests/feedback_community.cjs` prüft die reduzierte Übersicht, beide Übermittlungsarten mit abgefangenen Antworten, getrennte Payloads, Entwurfserhalt, Direktlinks und drei Bildschirmgrößen.

## Direkter E-Mail-Kontakt

Vertrauliches Feedback wird nach dem Speichern serverseitig per PHP `mail()` weitergeleitet. Die Empfängeradresse wird nicht im Formular angezeigt. `LCN_FEEDBACK_NOTIFY_TO` und `LCN_FEEDBACK_NOTIFY_FROM` überschreiben Empfänger bzw. Absender; als Empfänger dient standardmäßig die vom Betreiber angegebene Feedback-Adresse. Für den Absender werden alternativ die vorhandenen Benachrichtigungseinstellungen verwendet. Die optionale Besucheradresse wird ausschließlich als Reply-To gesetzt. Versandfehler werden mit Beitrags-ID ohne Nachrichteninhalt protokolliert; die Nachricht bleibt im Adminbereich erhalten, und die Formularbestätigung weist auf die fehlgeschlagene Übergabe hin. Es erfolgt kein automatischer Wiederholungsversuch. Ein erfolgreiches `mail()` bestätigt nur die Übergabe an den Mailserver, nicht die Zustellung. Lokal braucht XAMPP einen erreichbaren Mailserver; `localhost:25` allein richtet keinen Versand ein. Frühere Einreichungen werden nicht rückwirkend verschickt.

## Bestätigbarer Seitenbezug für beide Beitragswege

„Idee einbringen“ und „Vertrauliches Feedback geben“ enthalten dieselbe Seitenbezug-Auswahl. Die Herkunft wird bei Navigation zu Mitgestalten kurzzeitig im eigenen Browser zwischengespeichert oder aus einem internen Referrer bestimmt. Beim schwebenden Button wird sie beim Öffnen erfasst. Unnötige URL-Parameter, Suchtexte und Feldinhalte werden nicht übernommen. Der Nutzer muss den vorgeschlagenen Bezug bestätigen, „Ohne Seitenbezug“ wählen oder eine andere Seite auswählen. Es gibt kein stillschweigendes Bestätigen.

Die Auswahl enthält Hauptseiten der Navigation sowie „Behandler-Detailseite“ und „Therapie-Detailseite“. Bei Detailseiten erscheinen eine Suche und eine native Trefferauswahl; nur bestehende Einträge mit echten IDs können zugeordnet werden. Beim Wechseln oder Entfernen werden alte Entitäts-/Reiter-/Bereichsdaten verworfen. Die UI verwendet „Behandler:in“ und „Therapie“; technische Typen und bestehende URL-Namen bleiben kompatibel.

Neue Dateien: `scripts/feedback_page_reference.js`, `styles/feedback_reference.css`, `api/_feedback_page_reference.php`, `migrations/20261106_feedback_page_references.sql`. Die additive Tabelle `tbl_feedback_page_references` speichert Seitenpfad, Reiter und Bereich pro Idee mit Fremdschlüssel. `php scripts/prepare_feedback.php` führt lokal auch diese Migration wiederholbar aus. Vor einem späteren Online-Deployment muss die neue SQL-Migration dort über den freigegebenen Migrationsworkflow eingespielt werden. Keine Online-Datenbank wurde geändert.

Öffentliche Ideen zeigen ihren bestätigten Bezug nach Freigabe in der Detailansicht; die Administration erhält ihn bereits in der Warteschlange. Private Nachrichten verwenden die bestehende private Spalte `page_path`; bestätigte Reiter-/Bereichsbezeichnungen werden serverseitig an die private Nachricht angehängt. Beschreibungen öffentlicher Ideen werden dafür nicht verändert.

Neue GET-Aktionen in `api/feedback.php`: `reference_search` (`type=doctor|treatment`, `q`, maximal zehn Treffer) und `reference_info` (`entity_type`, `entity_id`, lesbarer Name). Neue optionale Schreibparameter: `reference_mode` (`confirm|none|other`), `page_path`, `page_section`, `page_element` sowie die bestehenden Entitätsfelder. Der Server prüft lokale erlaubte Seiten, ID-Konsistenz, Textgrenzen und den angegebenen Bestätigungsmodus; externe URLs, Dateipfade und veraltete Entitätsangaben bei „Ohne Seitenbezug“ werden abgewiesen. Legacy-API-Aufrufe ohne neuen Bestätigungsmodus bleiben kompatibel.

Erfolgreiche Tests: `php tests/feedback_page_reference.php` mit Rollback, `node tests/feedback_page_reference.cjs` mit echten Suchdaten und abgefangenen Übermittlungen, vollständiger API-/Adminablauf `node tests/feedback_ui.cjs` inklusive gespeicherter Referenz sowie `node tests/feedback_community.cjs`. Geprüft wurden automatische Herkunft und aktiver Reiter, Pflichtbestätigung, Entfernen, beide Detailseitensuchen, Hauptseitenwahl, getrennte öffentliche/private Daten und Layout bei 1440/768/390 Pixeln. Testdatensätze wurden zurückgerollt oder entfernt.
