# Fünf Startseitenentwürfe für den Long Covid Navigator

Die Entwürfe basieren auf der aktuellen index.html, dem aktuellen Startseiten-Screenshot (tests/home-chapters-1440.png), dem gemeinsamen Header und den Styles der öffentlichen Seiten und Detailseiten. Es handelt sich um grafische Konzeptentwürfe, keine Änderungen an der produktiven Startseite. Texte in den generierten Bildern sind Vorschläge und können kleine Darstellungsfehler enthalten.

## Was die heutige Startseite schwer macht

Die Suche kommt erst nach zwei langen redaktionellen Listen und einer großen Hausarztkarte. „Empfehlung“, „Ergänzung“ und „Suche“ beschreiben eher die interne Gliederung als das konkrete Anliegen. „Ergänzung“ führt zuerst zu einer Hausarztsuche. Wiederholte Kästen, blaue Schaltflächen, große Abstände und lange Listen geben sehr vielen Elementen dasselbe Gewicht. Die medizinische Zielgruppe braucht einen eindeutigen nächsten Schritt.

## Gemeinsame Grundlage

Farben aus dem vorhandenen Design: Marineblau #17365D für Text, Blau #0878E3 für Hauptaktionen, Türkis #00817D sparsam als Akzent, Hintergrund #F7FAFC und Rahmen #E1EAFA. Große gut lesbare Schrift, klare Überschriften und wenige gleichzeitig sichtbare Optionen. Keine Heilungszusage im Einstieg; stattdessen „Finde Unterstützung, die zu dir passt.“ Die Redaktion zeigt nur wenige Teaser, die vollständigen Listen bleiben auf ihren eigenen Seiten.

Navigation: Therapien · Behandler · Hausärzte · Mitmachen · Über uns. „Hausärzte“ verweist auf hausarzt_suche.html. „Mitmachen“ führt zur eigenen Beitragszeile. Diese enthält gleichberechtigt „Behandlung ergänzen“ (behandlung_vorschlagen.html) und „Behandler ergänzen“ (arzt_vorschlagen.html). „Hausarztpraxis ergänzen“ bleibt zusätzlich als kontextbezogener Link bei der Hausarztsuche sinnvoll. Die Auswahl der passenden Kategorie im Formular sollte bei einer Umsetzung geprüft werden.

## 01 – Ruhiger Kompass

Das vertraute Landschaftsmotiv bleibt als dezente seitliche Illustration erhalten. Zwei klar erkennbare Einstiege stehen direkt oben, die Hausarztsuche bekommt eine kurze eigene Zeile. Redaktion und Beiträge folgen nachgeordnet.

Warum: Kontinuität zur vorhandenen Seite bei deutlich leichterer Orientierung. Das Bild vermittelt Ruhe, ohne die ganze Seite zu dominieren. Beste Gesamtlösung, wenn die Startseite emotional und zugleich praktisch sein soll.

## 02 – Suche zuerst

Eine zentrale Suchfläche wird zum Hauptmotiv. Therapien und Behandler können über Reiter gewählt werden, darunter stehen kurze Einstiege und die eigene Beitragszeile.

Warum: Wer bereits weiß, was er sucht, kann sofort beginnen. Die Suchfläche sollte bei einer Umsetzung auf die vorhandenen Suchseiten verweisen beziehungsweise deren Filter nutzen; eine neue globale Suchfunktion ist durch das Mockup noch nicht vorhanden. Besonders passend, wenn die Plattform als Recherchewerkzeug auftreten soll.

## 03 – Drei klare Wege

Drei gleichwertige Einstiege: Therapien, Behandler und Hausärzte. Ein zurückhaltendes Gesprächsmotiv bringt eine menschliche Ebene hinein. Beiträge werden als eigener Bereich sichtbar.

Warum: Die drei Suchanliegen sind sofort verständlich. Hausärzte werden sichtbar, ohne unter „Ergänzung“ versteckt zu sein. Das Bild ist ein Konzeptmotiv und zeigt keine reale gelistete Praxis. Besonders passend, wenn Hausärzte eine zentrale Rolle auf der Plattform spielen sollen.

## 04 – Klar & redaktionell

Eine ruhige typografische Gestaltung mit einer markanteren Überschrift und asymmetrischer Flächenaufteilung. Wenige redaktionelle Hinweise ersetzen die langen Listen. Die Mitmachzeile erhält eine eigene helle Fläche.

Warum: Die Seite wirkt kuratiert und erwachsen. Die Serifenschrift in der Hauptüberschrift wäre eine bewusste Erweiterung des bisherigen Schriftsystems; Farben und Bedienelemente bleiben anschlussfähig. Besonders passend, wenn Orientierung und redaktionelle Einordnung im Vordergrund stehen.

## 05 – Schritt für Schritt

Ein zentraler Bereich mit drei großen, untereinander angeordneten Wegen. Keine großen Bilder, wenig Ablenkung, kurze Texte. Redaktion und Mitmachen bleiben kompakt und klar getrennt.

Warum: Dieser Ansatz reduziert die Zahl gleichzeitiger visueller Reize am stärksten. Besonders passend für einen möglichst einfachen Einstieg. Die tatsächliche Zugänglichkeit muss bei der Umsetzung mit Kontrast-, Tastatur-, Mobil- und Nutzertests geprüft werden; das Bild allein belegt sie nicht.

## Empfehlung

Variante 01 als gestalterische Basis, kombiniert mit der einfachen Entscheidungshilfe aus Variante 05. Hausärzte erhalten einen eigenen Menüpunkt und eine kompakte Suchzeile. „Gemeinsam Wissen erweitern“ wird eine echte zusätzliche Zeile mit den beiden Beitragsarten. Die Redaktion zeigt zunächst höchstens zwei bis drei Teaser je Bereich, keine zehn Einträge. Eine große Karte gehört auf die Hausarzt-Suchseite.

Für Mobilgeräte: Einstiege und Beitragskarten untereinander, große Bedienflächen, kurze Textabsätze; kein automatisch laufendes Karussell. Das ist eine Umsetzungsempfehlung, kein separat ausgearbeitetes mobiles Mockup.

## Erstellung

Fünf eigenständige grafische Mockups mit dem eingebauten ImageGen-Werkzeug, kein CLI/API-Fallback. Die genauen englischen Generierungsprompts stehen in prompts.json. Die Bilddateien und die Vergleichsgalerie liegen in diesem Ordner.

## Hinweise nach der Bildprüfung

Variante 01 verwendet im Bild ebenfalls eine Serifenschrift für Überschriften; diese ist eine mögliche gestalterische Erweiterung. Für maximale Einheitlichkeit kann dort die vorhandene serifenlose Schrift übernommen werden. Die Bilder zeigen teils redaktionelle Artikel als Platzhalter. Bei einer Umsetzung können diese Flächen stattdessen auf die bereits vorhandenen Therapie- und Behandlerauswahlen verweisen. Ein neuer Artikelbereich ist dafür nicht erforderlich. Formulierungen wie ‚offen für Long Covid‘ oder ‚qualifiziert‘ sollten bei gelisteten Praxen nur mit entsprechender Datengrundlage erscheinen; neutraler ist ‚Hausärztliche Anlaufstellen finden‘. Das bestehende Logo bleibt bei einer Umsetzung erhalten.
