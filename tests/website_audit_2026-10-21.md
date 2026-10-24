# Website-Prüfung vom 21.10.2026

## Umfang
Lokale XAMPP-Website, ohne Detailseiten: Startseite, Therapie- und Arztsuche, Hausarztsuche, beide Top-Seiten, Behandler-/Therapievorschlag, allgemeiner Eintragseinstieg, Impressum, Datenschutz und Dummy-Übersicht. Desktop 1280 px und Mobilansicht 390 px.

## Bestanden
- Keine lokalen HTTP-Ladefehler oder defekten geprüften internen Links; Detail-, Verwaltungs- und Aktionslinks ausgenommen.
- Kein horizontaler Seitenüberlauf in den geprüften Ansichten.
- Karten-/Tabellenumschaltung und Filter-Reset in beiden Katalogsuchen.
- Tabellenansicht und mobiles Hauptmenü auf beiden Top-Seiten.
- Pflichtfeldvalidierung der beiden Vorschlagsformulare; keine neuen Einträge abgesendet.
- Hausarztsuche lädt 57 Anlaufstellen.
- Arztsuche: GKV-Filter (117 Treffer), Radiusabfrage, exakte Suche, Tippfehler, keine Treffer, Leeren.
- Therapiesuche: Anbieterfilter, Kategorieabfrage, Kartenanreicherung bei Ivabradin; Namen, Aliase und Oberbegriffgruppen, Enter und Leeren.
- Erweiterter Regressionstest: node tests/catalog_search.cjs; PHP-Syntax und git diff --check.

## Suchänderung
Ähnliche Namen werden bei fehlenden wörtlichen Treffern berücksichtigt. Ab vier Zeichen ein Editierfehler, ab acht Zeichen zwei; benachbarte Buchstabendreher zählen als ein Fehler. Es werden die nächstliegenden Begriffe berücksichtigt. Kurze Kürzel bleiben unverändert. Die Therapie-Smart-Suche verwendet weiterhin dieselbe Klassifikation für Namen, Aliase und Ober-/Kombibegriffe. Ähnliche Therapievorschläge sind in ihrer Beschreibung gekennzeichnet.

## Offene Befunde
1. Ortsfilter der Arztsuche ist eine Teilwortsuche. city=Berlin liefert auch Überlingen (26 Treffer insgesamt). Ursache: LIKE '%Berlin%' findet die Zeichenfolge in Überlingen. Für eine reine Stadtauswahl ist das zu unscharf.
2. Bei blockierten externen Diensten bleiben die Karten auf top_behandler.html und top_behandlungen.html bei „Standorte werden geladen …“ stehen. ensureLeaflet in scripts/top_recommendation_map.js lädt die Bibliothek von unpkg.com; ein Ladefehler führt zu einer unbehandelten Promise-Ablehnung. Listen, Tabellen und Navigation bleiben nutzbar.
3. Kartenkacheln und einige Markerbilder sind externe Ressourcen; bei blockierten externen Hosts fehlen sie. Dies wurde absichtlich als Ausfalltest geprüft, ist kein Nachweis eines Ausfalls beim Anbieter.

## Grenzen
Kein vollständiger Test jeder Filterkombination, kein Versand neuer Vorschläge oder Bewertungen, keine Freigaben/Administration, keine erneute Detailseitenprüfung. Externe Karten-/Geocodingdienste wurden nicht vollständig Ende zu Ende geprüft. Beim ersten unbeschränkten Startseitenaufruf trat ein DOMContentLoaded-Timeout auf; der anschließende Test blockierte externe Hosts und lief durch.
