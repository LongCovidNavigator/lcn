# Rückmeldungen zu recherchierten Behandlerdaten

Die Übersicht von `arzt_detail.html` bietet Bestätigung und Widerspruch je Box und je Feld. Das Verhalten folgt `scripts/treatment_taxonomy.js`: eine Stimme pro Person und Feld, ein erneuter Klick auf die eigene ✓-Bestätigung nimmt diese direkt zurück, sowohl an der Box als auch am einzelnen Feld. Die Rückfrage schützt das Zurücknehmen von Änderungsvorschlägen und den Wechsel zur Bestätigung. Eine reine Bestätigung lässt sich im Dialog am jeweiligen Feld ohne zusätzliche Rückfrage zurücknehmen. × an einer insgesamt bestätigten Box öffnet den Dialog, statt die Bestätigung zu löschen. Die Infobox bietet „Vorschläge ansehen“.

## Zählung

- Gesamt-✓ einer Box bestätigt alle drei Felder dieser Box.
- Alle drei Felder mit Ja ergeben eine Bestätigung der Box pro Person.
- Mindestens ein Nein ergibt einen Widerspruch zur Box pro Person, unabhängig von der Zahl widersprochener Felder. Andere Ja-Stimmen bleiben erhalten.
- Nur teilweise bestätigte Felder ohne Nein zählen auf Boxebene weder als Ja noch als Nein.
- Ein Änderungsvorschlag ist ein Nein zum aktuellen Feld und eine Zustimmung zum konkreten Vorschlag. Gleiche Vorschläge werden ohne Beachtung der Groß-/Kleinschreibung gruppiert. Je Feld unterstützt eine Person höchstens eine Auswahl.
- Ein neuer Vorschlag ersetzt den eigenen Vorschlag für dieses Feld. Die Zustimmung zum alten Vorschlag entfällt, andere Felder und Boxen bleiben erhalten.
- Feldweises Zurücknehmen löscht nur die Stimme und gegebenenfalls den Vorschlag dieses Feldes. Bestätigen des ursprünglichen Werts entfernt nur den Vorschlag dieses Feldes. Gesamtbestätigung beziehungsweise Gesamtrücknahme betreffen alle Felder der betreffenden Box.

Alle vier Dialoge verwenden jetzt dieselben Layoutklassen wie die Therapie-Übersicht (`ux-taxonomy-community`): Felder untereinander, „… ändern“ je Feld, aktueller Eintrag und Community-Vorschläge darunter. Es gibt keine Checkboxauswahl und kein gemeinsames „Korrektur einreichen“ mehr. Textkorrekturen werden direkt am Feld mit Enter oder ✓ gespeichert; die Eintragsart unterstützt ebenfalls Enter. Unterstützen und Zurücknehmen eines Vorschlags erfolgen direkt im Dialog. Andere Felder bleiben dabei erhalten.

Medizinische Ergänzungen nutzen dieselbe `LCNCatalogRelations.combo` wie die Behandlungen. Auswahl mit Pfeiltasten und Enter sowie Enter für einen neuen Begriff speichern direkt. Einzelne Einträge lassen sich im Bearbeitungsbereich mit × entfernen. Der Dialog bleibt nach dem Speichern geöffnet, damit weitere Angaben korrigiert werden können. Der Footer zeigt nur den Speicherhinweis und „Schließen“.

Medizinische Angaben bieten einzelne Einträge mit ×, Suchvorschläge aus dem Katalog und aus eingereichten Begriffen sowie die ausdrückliche Option zum Hinzufügen eines neuen Begriffs. Ungeprüfte Vorschläge einschließlich der eigenen Auswahl bleiben sichtbar. Recherchierte Daten werden nicht automatisch überschrieben; eine separate redaktionelle Prüfoberfläche ist noch nicht umgesetzt.

## Datenbank und API

Vor dem Rollout beide Migrationen in der Behandlerdatenbank ausführen:

1. `migrations/20261029_doctor_profile_feedback.sql`
2. `migrations/20261029_doctor_profile_field_feedback.sql`

Beide wurden lokal angewendet. Neue Stimmen liegen in `doctor_profile_field_feedback`, eindeutig nach Behandler, Box, Feld und anonymem respondent_key. Alte Rückmeldungen aus `doctor_profile_feedback` werden bei Lesezugriffen berücksichtigt und beim ersten Schreiben je Person und Box innerhalb einer Transaktion übernommen. Eine frühere Gesamtbestätigung bestätigt alle Felder; ein alter Widerspruch betrifft nur seine ausdrücklich korrigierten Felder. Ein Datenbanklock serialisiert gleichzeitige Änderungen derselben Person und Box. Zähler, eigene Auswahl und Vorschläge werden aus einem konsistenten Lesesnapshot ermittelt.

`GET api/doctor_profile_feedback.php?id=613` liefert `own`, `totals`, `field_votes`, `proposals` und medizinische `options`. POST nimmt `id`, `section` (`identity`, `medical`, `location`, `contact`), `stance` (1, -1 oder 0), optional `field`, `corrections` und `clear_fields` entgegen. Ohne `field` betrifft 1 oder 0 die ganze Box. Bei -1 werden nur die in `corrections` übergebenen Felder geändert; `clear_fields` nimmt ausdrücklich bezeichnete Felder zurück. Die bestehenden Origin-, Cookie- und Missbrauchsprüfungen bleiben aktiv. Community-Neueinträge verwenden weiterhin ihren bisherigen Ablauf.

## Verifikation

- `tests/doctor_profile_field_votes.cjs`: gemischte Stimmen, Teilbestätigung, Gesamtzählung pro Person, Vorschlagswechsel, isolierte Rücknahme, Erhalt anderer Angaben und Feldaktionen im Dialog.
- `tests/doctor_profile_term_proposals.cjs`: Entfernen/Wiederherstellen, Katalogsuche, neue Begriffe, echte Speicherung und Unterstützung durch eine zweite Nutzersitzung.
- `tests/doctor_profile_feedback_withdrawal.cjs`: Bestätigung an-/abwählen, Rückfragen, Beibehalten, Anzeigen und Wechsel vom Widerspruch zur Bestätigung.

Die Browserprüfungen entfernen ihre eigenen Rückmeldungen anschließend.


Aktuelle UI-Prüfung nach der Vereinheitlichung: `node tests/doctor_profile_treatment_dialogs.cjs`. Sie prüft alle vier Dialoge, vertikale Anordnung, Enter für Text/Eintragsart/medizinische Begriffe, Dropdown-Tastaturbedienung, direkte Entfernung sowie mobile Darstellung. Alle POST-Antworten werden im Browser simuliert, damit UI-Tests keine echten Stimmen erzeugen und keine gemeinsame lokale Voting-Sperre auslösen. Die zuvor beschriebenen UI-Tests beziehen sich auf den früheren Dialogaufbau; die serverseitigen Zählregeln wurden bei dieser Umstellung nicht verändert.


„Einordnung des Behandlers“ unterstützt mehrere Checkboxen. Bestehende einzelne Einordnungen bleiben vorausgewählt; weitere Rollen lassen sich ergänzen. Enter oder ✓ speichert die gesamte Auswahl als einen Vorschlag für dieses Feld. Mindestens eine Einordnung ist erforderlich. Die Speicherung verwendet eine sortierte, deduplizierte Liste mit einem Wert pro Zeile; unterschiedliche Auswahlreihenfolgen ergeben denselben Vorschlag und keine zusätzlichen Stimmen. Die Anzeige fasst die Rollen mit „ · “ zusammen. Ergänzte Rollen: Osteopath:innen, Psycholog:innen und Sporttherapeut:innen. Der Browsertest prüft mehrere Rollen gleichzeitig, Wiederöffnen, Entfernen einer Rolle und Enter-Speicherung mit simulierten Antworten.


Der medizinische Dialog zeigt die einzelnen Einträge direkt, ohne zusätzlichen „Ändern“-Button. Darunter steht ein schmales Dropdown „Weiteren Eintrag hinzufügen …“. Die separate Hinzufügen-Schaltfläche und doppelte Darstellung unveränderter Werte entfallen. Dropdown-Auswahl, Enter und Tab speichern direkt; Tab geht nach erfolgreichem Speichern zur nächsten Eingabe. Bei fehlgeschlagener Speicherung bleibt die Eingabe erhalten. Eigene Korrekturen und der ursprüngliche Eintrag werden weiterhin klar unterschieden. Der Browsertest verwendet ausschließlich simulierte Schreibantworten.


Medizinische Vorschläge werden als konkrete Änderungen gegenüber dem recherchierten Eintrag dargestellt: je Begriff eine Zeile mit „entfernen“ (rot) oder „hinzufügen“ (grün). Gleichartige Änderungen aus verschiedenen vorgeschlagenen Listen werden zusammengezählt. Unterstützen und Zurücknehmen einer solchen Zeile ändern nur diesen Begriff in der eigenen Auswahl; andere Ergänzungen und Entfernungen bleiben erhalten. Die endgültige Liste wird weiterhin je Feld gespeichert. Das Ergänzungsfeld bleibt nach einer Entfernung verfügbar. Der simulierte UI-Test prüft „Post-Vac entfernen“, anschließend „MCAS hinzufügen“ sowie die isolierte Rücknahme der Entfernung bei erhaltener Ergänzung.


Das Land wird mit deutschem Namen angezeigt, einschließlich aktueller Angaben und Vorschläge. Die durchsuchbare Auswahl nutzt die zentrale ISO-3166-1-Liste aus `api/_profile_countries.php` und die gemeinsame Combobox ohne freie Neuanlage. Gespeichert wird der zweistellige Ländercode; die API lehnt unbekannte Werte vor dem Voting-Sicherheitszähler ab. Der UI-Test prüft „Deutschland“, Suche und Auswahl von „Frankreich“ sowie das Zurückweisen von „Fantasieland“ im Client und serverseitig ohne echte Schreibzugriffe.


Einzelbestätigungen für Mehrfachangaben:

- Je Fachrichtung, Spezialisierung, Zusatzqualifikation, Behandler-Einordnung und weiterem Standort gibt es einen eigenen ✓-Zähler. Ein erneuter Klick nimmt nur die eigene Bestätigung dieses Eintrags zurück.
- Die neue Migration `migrations/20261029_doctor_profile_item_feedback.sql` legt `doctor_profile_item_feedback` an (lokal angewendet). Einträge werden serverseitig gegen die recherchierten Ausgangswerte geprüft; die API akzeptiert zusätzlich `entry` bei `stance` 1 oder 0.
- `item_votes` liefert die Einzelzähler und eigene Auswahl. Frühere Gesamtbestätigungen werden beim Lesen als Bestätigung ihrer Einträge berücksichtigt. Einzelne Neutralstimmen überschreiben diese Vererbung, sodass man einen Eintrag zurücknehmen kann, ohne andere Bestätigungen zu verlieren.
- Ein Mehrfachfeld gilt erst als bestätigt, wenn alle recherchierten Einträge bestätigt sind. Teilbestätigungen sind neutral. Änderungsvorschläge bleiben Widersprüche; das Entfernen eines Eintrags zählt keine Bestätigung für den entfernten Wert. Beim Wechsel von einer Gesamtbestätigung zur Korrektur werden die Bestätigungen der anderen Einträge erhalten.
- Unterstützung einzelner Ergänzungs-/Entfernungszeilen bleibt auch bei Einordnungen und weiteren Standorten getrennt möglich. Feld- und Boxrücknahmen setzen die dazugehörigen Einzelstimmen zurück.

Prüfung: `tests/doctor_profile_item_votes.php` prüft die serverseitige Vererbung, isolierte Rücknahme, Teilbestätigung, Entfernungen und getrennte Zähler ohne Datenbank-Schreibzugriffe. Der simulierte Browser-Test prüft „Angiologie“ an/aus bei unveränderter „Innerer Medizin“ und eine einzelne Einordnung. Die echte lokale API-Antwort wurde zusätzlich lesend geprüft.
