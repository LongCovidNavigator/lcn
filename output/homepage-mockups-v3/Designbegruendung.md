# Dritte Designrunde: fünf Wege durch dieselben Werkzeuge

Diese Runde verändert die Navigation und die Darstellung geöffneter Bereiche. Grundlage sind die tatsächlichen Werkzeuge in index.html und scripts/homepage.js sowie die zweite Designrunde. Die fünf Bilder sind Zustandsansichten: Ein großes Bild zeigt ein geöffnetes Werkzeug, eine kleine Zusatzansicht einen weiteren Zustand. Sie sind keine bedienbaren Prototypen.

## Was inhaltlich bleibt

Empfehlung: beide konkreten Katalogauswahlen mit jeweils zehn Einträgen, Verknüpfungszahlen und Links zu den Detailseiten sowie vollständigen Auswahllisten. Hausärzte: Ausgangsort, Suche, Karte, Ergebnisliste, vollständige Hausarztsuche und Praxisvorschlag. Suche: Weiterleitung zu den bestehenden Therapie- und Behandlersuchseiten. Ergänzen: Auswahl zwischen den bestehenden Vorschlagsformularen für Behandlung und Behandler. Projektinformationen bleiben nachgeordnet erreichbar.

Die Funktionen werden je nach Konzept erst nach der Bereichsauswahl sichtbar. Das bewusste Ausblenden inaktiver Bereiche entfernt keine Funktion. Es gibt weder einen neuen Artikelbereich noch eine neue globale Suche.

## Die fünf Konzepte

### 1. Seitliche Reiter

**Weg:** Empfehlung → Tabelle · Hausärzte → Karte · Suche → Suchseite · Ergänzen → Formularauswahl

**Gezeigter Zustand:** Geöffnet: Empfehlung. Kleiner Zweitzustand: Ergänzen.

**Warum:** Der Wegweiser bleibt beim Wechsel zwischen den Werkzeugen sichtbar. Besonders geeignet, wenn Nutzer mehrere Bereiche nacheinander vergleichen.

**Abwägung:** Benötigt auf dem Desktop Platz in der Breite. Mobil wird daraus eine kompakte Bereichsauswahl oberhalb des Inhalts.

### 2. Aufklappbare Kapitel

**Weg:** Kapitel anklicken → vorhandenes Werkzeug klappt direkt darunter auf

**Gezeigter Zustand:** Geöffnet: Hausärzte mit Karte und Ergebnisliste. Kleiner Zweitzustand: Ergänzen.

**Warum:** Die Startseite bleibt zunächst überschaubar. Karte und Tabellen müssen nicht gleichzeitig vollständig sichtbar sein. Kurze Zusammenfassungen erklären auch geschlossene Bereiche.

**Abwägung:** Ein Werkzeug ist erst nach dem Öffnen sichtbar. Der geöffnete Bereich sollte über einen direkten Link erreichbar und der Zustand beim Zurückkehren erhalten bleiben.

### 3. Eine Arbeitsfläche

**Weg:** Reiter wählen → Arbeitsfläche wechselt · Suche → Therapie- oder Behandlersuche öffnen

**Gezeigter Zustand:** Geöffnet: Suche. Kleiner Zweitzustand: Empfehlung.

**Warum:** Die Werkzeuge teilen sich einen festen, großzügigen Bereich. Suche und Ergänzen wirken wie gleichwertige Aufgaben statt wie zwei spätere Kästen auf einer langen Seite.

**Abwägung:** Nur der aktive Bereich ist sichtbar. Reiter müssen eindeutig benannt sein; für Mobilgeräte ist eine umbrechende Bereichsauswahl sinnvoll.

### 4. Finden oder ergänzen

**Weg:** Anliegen wählen → Unterbereich auswählen → Tabelle, Karte oder vorhandene Suchseite nutzen

**Gezeigter Zustand:** Geöffnet: Etwas finden / Hausärzte. Kleiner Zweitzustand: Einen Eintrag ergänzen.

**Warum:** Die erste Entscheidung ist in Alltagssprache formuliert. Die beiden grundverschiedenen Absichten – etwas finden oder einen Eintrag vorschlagen – erhalten ein klares visuelles Gewicht.

**Abwägung:** Die zusätzliche Navigationsebene kostet einen Auswahlvorgang. Direkte Links und ein gut gewählter Anfangszustand verhindern unnötige Umwege.

### 5. Kacheln, die sich öffnen

**Weg:** Kachel wählen → zugehöriger Inhalt öffnet sich direkt darunter

**Gezeigter Zustand:** Geöffnet: Empfehlung. Kleiner Zweitzustand: Ergänzen.

**Warum:** Ein grafischer Einstieg bleibt erhalten, während die konkrete Tabelle oder Karte auf derselben Seite erscheint. Die Verbindung zwischen Auswahl und Inhalt ist sichtbar.

**Abwägung:** Der Inhaltswechsel darf die Seite nicht unvermittelt springen lassen. Aktive Kachel, sichtbare Überschrift und Fokusführung müssen den Wechsel erklären.

## Empfehlung

Für eine grafisch stärkere Startseite bevorzuge ich **05 – Kacheln, die sich öffnen**: Die vier Hauptbereiche sind sofort erkennbar und der gewählte Inhalt öffnet sich direkt darunter. Das verbindet einen einladenden Einstieg mit den konkreten Werkzeugen.

**01 – Seitliche Reiter** ist die stärkste Alternative für die dauerhafte Nutzung am Desktop. Die Position aller Bereiche bleibt während des Arbeitens sichtbar.

**02 – Aufklappbare Kapitel** ist der vorsichtigste Umbau der heutigen Startseite. Die vorhandenen Abschnitte können weitgehend weiterverwendet werden.

## Wie Suche und Ergänzen konkreter werden

Suche wird ein eigener Zustand mit zwei klaren Einstiegen statt einer allgemeinen Überschrift am Seitenende:
- Therapien suchen → therapien_karte.html
- Behandler finden → aerzte_karte.html

Ergänzen wird eine erkennbare Aufgabe mit zwei gleichwertigen Optionen:
- Behandlung ergänzen → behandlung_vorschlagen.html
- Behandler ergänzen → arzt_vorschlagen.html

Der praxisbezogene Link bleibt zusätzlich bei der Hausarztsuche. Die bestehenden Top-Listen führen weiter zu top_behandlungen.html und top_behandler.html; die Hausarztsuche zu hausarzt_suche.html.

## Hinweise für eine spätere Umsetzung

Bereichsauswahl und aufklappbare Elemente müssen auch per Tastatur funktionieren und ihren geöffneten Zustand vermitteln. Direkte Bereichslinks sowie Zurück-Navigation sollten den passenden Zustand wiederherstellen. Wenn eine bisher verdeckte Karte geöffnet wird, muss die Kartenansicht ihre neue Fläche korrekt berechnen. Auf dem Smartphone werden die Navigationselemente passend umgeordnet, ohne Beschriftungen durch reine Symbole zu ersetzen. Das sind Umsetzungshinweise; eine mobile Detailausarbeitung ist in den Bildern nicht enthalten.

## Dateien und Erstellung

Fünf grafische Mockup-Boards mit dem eingebauten ImageGen-Werkzeug, ohne CLI-Fallback. Die genauen Prompts stehen in prompts.json. Namen und Katalogzahlen in den Bildtexten sind eine Momentaufnahme aus der bisherigen Referenz; bei einer Umsetzung bleiben die vorhandenen API-Daten maßgeblich. Kleine Abweichungen im Bildtext sind keine Funktionsänderung. Die bestehende Startseite wurde nicht verändert.

## Verbindliche Beschriftung der Empfehlungen

Die Auswahl bleibt redaktionell. Katalogzahlen sind weder eine Auswahlregel noch eine Bewertung. Falls ein generierter Bildtext die Auswahl als häufige Verknüpfung oder als auf Anzahlen basierend beschreibt, wird diese Formulierung bei der Umsetzung durch ‚Redaktionell zusammengestellt zur Orientierung – kein Wirksamkeitsranking‘ ersetzt. Die Miniaturen im Suchbereich illustrieren die vorhandenen Tabellen- und Kartenwerkzeuge; sie stellen keine zusätzliche Suchfunktion dar.
