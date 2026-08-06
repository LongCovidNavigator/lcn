# Long Covid Navigator – Website

Dieses Repository enthält ausschließlich die lokal über XAMPP ausgeführte Website des Long Covid Navigators.

## Lokale Adresse

Bei laufendem Apache ist die Website erreichbar unter:

```text
http://localhost/lcn/
```

Der lokale Projektordner ist:

```text
C:\xampp\htdocs\lcn
```

## Zuständigkeiten der Repositories

- `lcn`: HTML, CSS, JavaScript, PHP-API und verwendete Website-Assets
- `lcn_data`: Datenaufbereitung, Importe, Exporte, Qualitätsprüfung und ältere Datenwerkzeuge
- Google Drive: große oder veränderliche Roh-, Arbeits- und Ausgabedaten aus `lcn_data/data/raw`, `data/working` und `data/output`

Das Datenprojekt befindet sich lokal unter:

```text
C:\python\lcn_data
```

## Wichtige Seiten

- `index.html`: Startseite
- `therapien_karte.html`: Therapiesuche
- `therapie_detail.html`: Therapiedetails
- `aerzte_karte.html`: Ärzt:innensuche
- `arzt_detail.html`: Ärzt:innendetails
- `impressum.html` und `datenschutz.html`: Rechtliche Seiten

Gemeinsame Bestandteile befinden sich unter `components`, Stylesheets unter `styles`, Browser-Skripte unter `scripts` und PHP-Endpunkte unter `api`.

## Bilder austauschen

Alle aktuell angezeigten Bildrollen sind zentral in `scripts/image-registry.js` hinterlegt. HTML und CSS verwenden nur semantische Schlüssel wie `home-hero` oder `brand-logo`.

Zum Ersetzen eines angezeigten Bildes:

1. Die neue Bilddatei unter `assets/images` ablegen.
2. In `scripts/image-registry.js` beim passenden Schlüssel nur den Dateipfad ändern.
3. Die fünf Hauptseiten im Browser prüfen.

Wenn die Logik der Registry selbst geändert wird, sollte zusätzlich die Versionsnummer am Script-Aufruf (`image-registry.js?v=...`) erhöht werden, damit Browser keine ältere Scriptversion aus dem Cache verwenden.

Vorhandene Bilddateien werden nicht automatisch gelöscht. Dadurch können Entwürfe und alternative Versionen im Asset-Ordner verbleiben.

Die Bilddateien sind unter `assets/images` nach Zweck gegliedert:

- `brand`: Logos und Markenvarianten
- `homepage`: Motive und Grafiken der Startseite
- `icons`: eigenständige Icons und Symbolgrafiken
- `drafts`: noch nicht fest zugeordnete Bildentwürfe

## Konfiguration und Geheimnisse

Lokale Zugangsdaten gehören in eine ignorierte `.env`-Datei oder in die dafür vorgesehene lokale Serverkonfiguration. Sie dürfen nicht committed werden. Die `.gitignore` schließt unter anderem `.env`, Datenbankdumps, Backups, Caches und Logs aus.

## Üblicher Arbeitsablauf

1. Änderungen lokal unter `http://localhost/lcn/` testen.
2. In SmartGit ausschließlich die beabsichtigten Änderungen prüfen und stagen.
3. Mit einer verständlichen Nachricht committen.
4. Den aktuellen Branch nach GitHub pushen.

Datenverarbeitung und erzeugte Arbeitsdateien gehören grundsätzlich in `lcn_data`, nicht in dieses Website-Repository.
