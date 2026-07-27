# Fasynation-Auswertung durch Codex

Dieser Ordner enthält ausschließlich die neue, inhaltliche Auswertung der Fasynation-Quellen. Ergebnisse aus dem bisherigen Python-Matching werden nicht ungeprüft übernommen.

Alle CSV-Dateien verwenden:

- UTF-8
- Komma als Trennzeichen
- eine Kopfzeile
- stabile IDs
- genau eine Tabellenzeile pro Objekt beziehungsweise Beziehung
- Originalbelege aus den lokalen Fasynation-Texten

## Tabellen

### `00_queue.csv`

Persistente Arbeitswarteschlange in der Reihenfolge `blog_0001` bis `blog_0070`. Zulässige Statuswerte sind `offen`, `in_bearbeitung`, `abgeschlossen`, `review` und `fehler`. Vor Beginn eines Artikels wird dessen Status auf `in_bearbeitung` gesetzt; erst nach erfolgreichem Schreiben und Prüfen aller zugehörigen CSV-Zeilen wird er auf `abgeschlossen` gesetzt.

### `01_quellenstatus.csv`

Arbeitsstand pro Fasynation-Artikel. So ist jederzeit erkennbar, welche Quellen noch offen, in Bearbeitung, abgeschlossen oder zur erneuten Prüfung markiert sind.

### `02_anbieter.csv`

Personen, Praxen, Kliniken, Zentren, Coaches und Programme. Die Tabelle unterscheidet einen bloß erwähnten Namen von einem tatsächlich als Behandler oder Anbieter beschriebenen Akteur.

### `03_massnahmen.csv`

Therapien und Diagnostiken. `measure_type` verwendet vorrangig `therapie` oder `diagnostik`; weitere Werte müssen begründet werden.

### `04_anbieter_massnahmen.csv`

Die zentrale Zuordnungstabelle. Eine Zeile wird nur angelegt, wenn die Quelle eine konkrete Beziehung zwischen Anbieter und Maßnahme enthält.

Zulässige Werte für `relation_type`:

- `bietet_an`
- `wendet_an`
- `empfiehlt`
- `entwickelte`
- `forscht_zu`
- `spricht_ueber`
- `nur_erwaehnt`
- `unklar`

Die eigentliche Ansicht „Wer bietet was an?“ verwendet nur `bietet_an` und nach Prüfung gegebenenfalls `wendet_an`.

### `05_review.csv`

Unsichere Namen, Normalisierungen und Beziehungen. Offene Fälle bleiben getrennt von den belastbaren Ergebnissen.

## Belegstandard

Jede relevante Zeile enthält:

- die lokale Quellen-ID,
- den wörtlichen, möglichst kurzen Beleg,
- den notwendigen Kontext,
- eine Sicherheitseinstufung,
- einen Reviewstatus.

Die Nähe zweier Begriffe im Text reicht nicht als Beleg für eine Anbieter–Maßnahmen-Beziehung.
