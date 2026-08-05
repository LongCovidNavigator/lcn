# LCN – Rechercheschema für Therapie-Datensätze

**Arbeitsstand:** v0.1  
**Erstellt am:** 2026-07-27

## Zweck

Dieses Dokument ist ein fachlicher Zwischenstand. Es ist noch nicht die endgültige Arbeitsanweisung und noch nicht das endgültige Importformat. Es legt fest, welche Informationen ein ideal angereicherter Therapie-Datensatz enthalten soll, welche Ergebnisse zulässig sind und welche Quellen bevorzugt werden.

Grundregeln:

- Keine schwammigen Platzhalter oder unbelegten Freitextergebnisse.
- Wenn ein Pflichtfeld nicht belastbar beantwortet werden kann, bleibt es leer und wird als offene Recherche markiert.
- Nutzererfahrungen und redaktionell recherchierte Informationen werden als unterschiedliche Quellen behandelt, aber nicht als doppelte fachliche Felder angelegt.
- Bestehende Wertelisten für Typ, Unterkategorie, Alias-Typen und Symptome werden übernommen und nicht während einer Einzelrecherche frei erweitert.

## 1 – Identität, Einordnung und Quellen

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| Hauptname | Einheitliche, verständliche Bezeichnung des Eintrags. | Genau ein Name; keine Alternativnamen, Klassenbegriffe oder Erklärungen im Feld. | Ja | Fachinformation, Herstellerinformation, Leitlinie, offizielles Register | Vorschlag möglich | Redaktionell geprüfte Fachquelle | Alternativnamen gehören ausschließlich in die Alias-Struktur. |

| Typ | Bestehende LCN-Hauptkategorie des Eintrags. | Genau ein Wert aus der bestehenden Typ-Werteliste. | Ja | Inhaltliche Einordnung anhand der Definitionen der LCN-Typen | Nein | Redaktionelle Zuordnung | Werteliste wird aus der bestehenden Datenbank übernommen und nicht frei erweitert. |

| Unterkategorie | Bestehende LCN-Unterkategorie innerhalb des gewählten Typs. | Genau ein Wert aus der für den Typ zulässigen Unterkategorie-Liste; leer nur, wenn für den Typ keine Unterkategorie vorgesehen ist. | Ja | Inhaltliche Einordnung anhand der LCN-Unterkategorien | Nein | Redaktionelle Zuordnung | Werteliste wird aus der bestehenden Datenbank übernommen. |

| Aliasse und Beziehungstyp | Alternative Bezeichnungen und Suchbegriffe mit genauer Beziehung zum Haupteintrag. | Beliebig viele Zeilen; je Alias genau ein Alias-Typ aus der bestehenden Alias-Werteliste. | Ja | Fachinformation, AMIce, Hersteller, WHO/BfArM, gebräuchliche Fach- und Patientensprache | Vorschlag möglich | Redaktionell geprüfte Fachquelle | Keine freien, untypisierten Suchbegriffe. Bestehende Alias-Typen werden vor dem Test per SQL vollständig übernommen. |

| Kurzbeschreibung | Sachliche Erklärung, was der Eintrag ist. | 1–2 vollständige Sätze; maximal 500 Zeichen; keine Nutzenbewertung, Empfehlung oder ausführliche Wirkmechanismus-Erklärung. | Ja | Fachinformation, offizielle Institution, seriöse Fachquelle | Nein | Redaktionell geprüfte Fachquelle | Soll das bisherige unsystematische Feld „weitere Hinweise“ perspektivisch ersetzen. |

| Quellen und weiterführende Links | Nachweise für die im Datensatz enthaltenen Sachinformationen. | Mindestens eine strukturierte Quelle; pro Quelle Titel, Organisation, URL, Abrufdatum und Zuordnung zu den belegten Feldern. | Ja | Primärquellen und offizielle Register | Quelle vorschlagen | Je Feld möglichst Primärquelle | Keine pauschale Quellenliste ohne Bezug zu den belegten Angaben. |

| Stand des Datensatzes | Datum der letzten vollständigen redaktionellen Prüfung des gesamten Eintrags. | Exaktes Datum im Format YYYY-MM-DD. | Automatisch/organisatorisch | Redaktioneller Prüfprozess | Nein | Redaktion | Ein Datum für den Gesamtdatensatz; keine Datumsangabe pro Einzelfeld. |

## 2 – Standardisierte Klassifikationen

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| ICHI-Zuordnung | Offizielle Einordnung der Gesundheitsintervention in ICHI. | ICHI-Code, offizieller Titel, Target-Code und -Titel, Action-Code und -Titel, Means-Code und -Titel sowie Referenzlink; leer, wenn keine belastbare Zuordnung gefunden wird. | Ja, testweise | WHO ICHI Browser/Coding Tool | Nein | WHO ICHI | Keine selbst erfundene Zuordnung. Nicht jeder LCN-Eintrag wird eindeutig codierbar sein. |

| ATC-Code | Offizielle anatomisch-therapeutisch-chemische Klassifikation eines Arzneimittels/Wirkstoffs. | Ein oder mehrere vollständige ATC-Codes mit offizieller Bezeichnung; nur für Arzneimittel. | Ja | BfArM ATC-Klassifikation, WHO ATC/DDD | Nein | BfArM/WHO | Bei mehreren Wirkstoffen sind mehrere Codes zulässig. |

## 3 – Arzneimittelinformationen

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| Wirkstoff | Pharmakologisch wirksame Substanz oder Wirkstoffkombination. | Normierter Wirkstoffname; bei Kombinationen mehrere klar getrennte Wirkstoffe. | Ja | AMIce, Fachinformation, EMA/PEI/BfArM | Nein | Zugelassene Fachinformation/AMIce | Nur für Arzneimittel oder arzneimittelbezogene Einträge. |

| Handelsnamen | In Deutschland gebräuchliche Marken- oder Produktnamen. | Beliebig viele Handelsnamen; jeweils als Handelsname gekennzeichnet. | Ja | AMIce, Fachinformation, Hersteller | Vorschlag möglich | AMIce/Fachinformation | Handelsnamen werden zusätzlich als Alias verknüpft, nicht statt der Alias-Struktur. |

| Medikamentenklasse | Pharmakologische oder therapeutische Klasse des Wirkstoffs. | Ein oder mehrere normierte Klassenbegriffe; keine freie Werbe- oder Umgangssprache. | Ja | ATC, Fachinformation, BfArM/WHO | Nein | ATC/Fachinformation | „Medikamentengruppe“ wird nicht als zusätzlicher Begriff geführt. |

| Applikationsform | Art, wie das Arzneimittel angewendet wird. | Ein oder mehrere Festwerte: oral \| intravenös \| intramuskulär \| subkutan \| nasal \| inhalativ \| transdermal \| rektal \| topisch \| sublingual \| sonstige definierte Form. | Ja | Fachinformation/AMIce | Ja, tatsächlich genutzt | Fachinformation | Darreichungsform und Applikationsweg können später getrennt werden, falls im Test nötig. |

## 4 – Zugang, Durchführung und Finanzierung

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| Zugangs-/Verschreibungsstatus | Welche formale Voraussetzung erfüllt sein muss, damit die Maßnahme bezogen oder begonnen werden kann. | Genau ein Wert: frei erhältlich \| apothekenpflichtig ohne Rezept \| verschreibungspflichtig / ärztliche Verordnung erforderlich \| nur über spezialisierten Anbieter oder Einrichtung zugänglich. | Ja | Fachinformation, BfArM/AMIce, Anbieter, gesetzliche Regelungen | Ja, als tatsächlicher Zugang | Offizielle Fachinformation bzw. verbindliche Anbieterinformation | Enthält keine Aussage zum Durchführungsort und keine Aussage zur Kostenübernahme. |

| Durchführungssetting | Niedrigste notwendige Stufe der personellen und räumlichen Unterstützung bei der eigentlichen Anwendung. | Genau ein Wert: selbstständig zu Hause \| zu Hause mit professioneller Unterstützung \| ambulant in Praxis/Einrichtung \| stationär. | Ja | Fachinformation, Leitlinie, Anbieterbeschreibung | Ja, tatsächliches Setting | Fachinformation bzw. typische Anbieterpraxis | Ersetzt „selbstständig umsetzbar“ und „Durchführungsort“. Es wird die niedrigste regulär mögliche Stufe gewählt. |

| Bezugs-/Anbieterart | Typische Stelle, über die das Produkt oder die Leistung bezogen beziehungsweise angeboten wird. | Ein oder mehrere Festwerte: Apotheke \| Arztpraxis \| Klinik \| Physiotherapie/Ergotherapie \| Psychotherapie/Beratung \| Sanitätshaus \| Labor/Diagnostikzentrum \| Onlinehandel \| sonstige definierte Anbieterart. | Ja | Anbieter, Fachinformation, Versorgungsverzeichnisse | Ja | Redaktionell geprüfte Anbieterinformationen | Nicht mit konkreten Anbietern verwechseln; diese bleiben in der bestehenden Koppeltabelle. |

| Kostenübernahme | Ob und unter welchen Bedingungen die Kosten typischerweise von Versicherungen getragen werden. | Je Kostenträger separat: GKV regulär \| GKV Einzelfall \| GKV keine reguläre Übernahme; PKV regulär \| PKV Einzelfall \| PKV keine reguläre Übernahme; zusätzlich Selbstzahleranteil: ja/nein. | Ja, teilweise | G-BA-Richtlinien, GKV-Spitzenverband, offizielle Kasseninformationen, Fachinformation, Gebühren-/Leistungskataloge | Ja, tatsächliche Übernahme | Offizielle Regelung; Nutzerangabe nur als Erfahrung | GKV und PKV werden symmetrisch erfasst. Einzelfallentscheidungen dürfen nicht als reguläre Übernahme dargestellt werden. |

| Übernahmehinweis | Kurze Erklärung der Bedingungen oder Einschränkungen der Kostenübernahme. | Maximal 2 Sätze; muss Kostenträger und Bedingung nennen; keine pauschale Rechts- oder Leistungszusage. | Ja | G-BA, GKV-Spitzenverband, Versicherer, gesetzliche Grundlagen | Ja, als Erfahrungshinweis | Offizielle Regelung | Beispiel: „GKV nur nach Einzelfallprüfung und vorheriger Genehmigung.“ |

## 5 – Zeit, Häufigkeit und Behandlungsumfang

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| Zeitaufwand pro Anwendung | Dauer einer einzelnen Einnahme, Sitzung oder Durchführung. | Zahl oder Spanne plus Einheit Minuten/Stunden; bei Einnahme ohne relevanten Zeitaufwand: unter 5 Minuten. | Ja | Anbieter, Fachinformation, Behandlungsprotokoll | Ja | Anbieter/Fachinformation; Nutzer für tatsächliche Dauer | Nicht die Gesamtdauer des Behandlungszeitraums. |

| Häufigkeit | Wie oft die Anwendung innerhalb eines Zeitraums erfolgt. | Zahl plus Intervall, z. B. 1× täglich, 3× wöchentlich, nach Bedarf; keine unbestimmten Begriffe wie „regelmäßig“. | Ja | Fachinformation, Protokoll, Anbieter | Ja | Fachinformation/Protokoll; Nutzer für tatsächliche Anwendung | Bei variabler Dosierung ist eine klar bezeichnete typische Spanne zulässig. |

| Typischer Behandlungsumfang | Typische Gesamtzahl der Anwendungen oder Sitzungen. | Zahl oder Spanne plus Einheit Anwendungen/Sitzungen; bei dauerhafter Anwendung: dauerhaft. | Ja, teilweise | Fachinformation, Protokoll, Anbieter | Ja | Fachinformation/Protokoll; Nutzer für tatsächlichen Umfang | Keine Wirkversprechen aus der Zahl ableiten. |

| Gesamtdauer des Behandlungszeitraums | Zeitraum vom Beginn bis zum vorgesehenen Ende einer typischen Behandlungsserie. | Zahl oder Spanne plus Einheit Tage/Wochen/Monate/Jahre; bei dauerhafter Anwendung: dauerhaft. | Ja, teilweise | Fachinformation, Protokoll, Anbieter | Ja | Fachinformation/Protokoll; Nutzer für tatsächliche Dauer | Ergänzt den typischen Behandlungsumfang und darf nicht mit Sitzungsdauer verwechselt werden. |

| Zeit bis zur wahrgenommenen Wirkung | Zeit zwischen Beginn der Anwendung und einer von Nutzer:innen wahrgenommenen Veränderung. | Zahl oder Spanne plus Einheit Stunden/Tage/Wochen/Monate; keine Wirkung = eigener Antwortwert. | Nur eingeschränkt | Studien-/Anbieterangaben nur als Zusatz; keine redaktionelle Wirkungsaussage | Ja | Nutzererfahrung | Primär ein Nutzerfeld; recherchierte Angaben müssen klar als Quelle gekennzeichnet werden. |

## 6 – Kosten

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| Kosten pro Einheit | Preis einer einzelnen Sitzung, Anwendung, Packung oder Abrechnungseinheit. | Euro-Betrag oder Spanne plus eindeutige Bezugsgröße und Preisdatum. | Ja | Preislisten, Anbieter, Apotheken-/Produktpreise, Gebührenordnungen | Ja | Aktuelle Anbieter-/Produktpreise; Nutzer für tatsächlich gezahlte Kosten | Beispiel: 150–250 EUR pro HBO-Sitzung. |

| Laufende Kosten | Regelmäßig wiederkehrende Kosten bei dauerhafter oder wiederholter Anwendung. | Euro-Betrag oder Spanne pro Woche/Monat/Jahr plus Preisdatum; leer, wenn nicht zutreffend. | Ja | Preislisten, Anbieter, Apotheken-/Produktpreise | Ja | Aktuelle Anbieter-/Produktpreise; Nutzer für tatsächliche Kosten | Nicht zusätzlich ausfüllen, wenn die laufenden Kosten vollständig durch „Kosten pro Einheit“ und Häufigkeit abgebildet sind. |

| Typische Gesamtkosten | Geschätzte Gesamtkosten einer typischen Behandlungsserie. | Euro-Betrag oder Spanne plus zugrunde gelegter Behandlungsumfang und Preisdatum. | Ja, wenn Umfang und Einzelpreis belastbar sind | Anbieterpreise, Protokolle; nachvollziehbare Berechnung | Ja | Berechnung aus geprüften Einzelpreisen und typischem Umfang | Berechnung muss nachvollziehbar sein; keine scheinpräzise Zahl ohne Annahmen. |

| Tatsächlich gezahlte Kosten | Konkrete Kosten einer Nutzererfahrung. | Euro-Betrag plus Kennzeichnung: pro Einheit \| laufend \| gesamt; optional Erstattungsanteil. | Nein | Nicht recherchierbar | Ja | Nutzererfahrung | Bleibt dieselbe Kosteninformation mit anderer Quelle; keine zweite redaktionelle Kostenschätzung. |

## 7 – Nutzererfahrungen

| Information | Definition | Zulässige Form / Skala | Recherche möglich? | Geeignete Recherchequelle | Nutzerabfrage möglich? | Angestrebte Primärquelle | Hinweise / Abgrenzung |
|---|---|---|---|---|---|---|---|
| Wahrgenommene Wirkung | Persönlich wahrgenommener Verlauf unter der Maßnahme. | Bestehende Skala: positiv \| neutral \| negativ. | Nein | Nicht recherchierbar | Ja | Nutzererfahrung | Keine medizinische Wirksamkeit ableiten. |

| Relevante Symptome | Symptome, wegen derer die Maßnahme genutzt wurde oder bei denen eine Veränderung wahrgenommen wurde. | Mehrfachauswahl ausschließlich aus der bestehenden Symptom-Werteliste. | Eingeschränkt | Fachquellen können Vorschläge liefern | Ja | Nutzererfahrung; redaktionell ergänzte Symptomzuordnung separat kennzeichnen | Symptom-Werteliste und spätere Koppeltabelle müssen vor dem Produktivtest geprüft werden. |

| Crash-/PEM-Erfahrung | Vom Nutzer erlebte PEM- oder Crash-Reaktion im zeitlichen Zusammenhang mit der Anwendung. | Kein Crash/PEM \| leicht \| mittel \| stark. | Nein | Nicht recherchierbar | Ja | Nutzererfahrung | Der genaue Fragewortlaut und Zeitraum werden später im Nutzerformular festgelegt. |

| Tatsächlicher Behandlungsumfang | Vom Nutzer tatsächlich absolvierte Anwendungen und Gesamtdauer. | Anzahl Anwendungen/Sitzungen plus Zeitraum in Tagen/Wochen/Monaten/Jahren. | Nein | Nicht recherchierbar | Ja | Nutzererfahrung | Dient zur Interpretation von Kosten und Wirkungseintritt. |

## Vorläufiger Quellenkatalog

| Themenbereich | Quelle | Eignung | URL | Vorgesehene Felder |
|---|---|---|---|---|
| Arzneimittel-Zulassung und Produktdaten | BfArM AMIce | Zulassungsdaten der deutschen Arzneimittelbehörden; Fach- und Gebrauchsinformationen recherchierbar. | https://www.bfarm.de/DE/Arzneimittel/Arzneimittelinformationen/Arzneimittel-recherchieren/AMIce/_node.html | Wirkstoff, Handelsname, Zulassungs-/Verschreibungsinformationen, Fachinformation |
| ATC Deutschland | BfArM ATC-Klassifikation | Deutsche ATC-Klassifikation und jährliche Veröffentlichungen. | https://www.bfarm.de/DE/Kodiersysteme/Klassifikationen/ATC/_node.html | ATC-Code, Medikamentenklasse |
| ICHI | WHO ICHI Browser | Offizieller Browser für die International Classification of Health Interventions. | https://icd.who.int/dev11/l-ichi/en | ICHI-Code, Target, Action, Means, Referenzlink |
| GKV Arzneimittel | G-BA Arzneimittel-Richtlinie | Regelt Grundsätze und Anlagen zur Verordnung zulasten der GKV. | https://www.g-ba.de/richtlinien/3/ | GKV-Kostenübernahme, Verordnungsfähigkeit |
| Off-Label-Use | G-BA Off-Label-Use | Offizielle Informationen und Anlagen zur Verordnungsfähigkeit im Off-Label-Use. | https://www.g-ba.de/themen/arzneimittel/arzneimittel-richtlinie-anlagen/off-label-use/ | GKV regulär/Einzelfall/keine reguläre Übernahme bei Off-Label-Anwendungen |
| Hilfsmittel | GKV-Spitzenverband Hilfsmittelverzeichnis | Informationen zur Leistungspflicht und zu gelisteten Hilfsmitteln. | https://www.gkv-spitzenverband.de/krankenversicherung/hilfsmittel/hilfsmittelverzeichnis/hilfsmittelverzeichnis.jsp | Hilfsmittel, Bezugs-/Anbieterart, GKV-Orientierung |

## Offene Punkte vor dem ersten belastbaren Test

- **Typ-Werteliste:** Vollständige aktuelle DISTINCT-Liste aus tbl_treatments_03.typ übernehmen. Nächster Schritt: SQL-Abfrage erforderlich.
- **Unterkategorie-Werteliste:** Vollständige gültige Kombination Typ + Unterkategorie übernehmen. Nächster Schritt: SQL-Abfrage erforderlich.
- **Alias-Typen:** Vollständige aktuelle Alias-Type-Werteliste plus Bedeutung und bestehende Nutzungsregeln übernehmen. Nächster Schritt: SQL-Abfrage erforderlich.
- **Symptom-Werteliste:** Struktur, Spalten und 106 vorhandene Symptome prüfen; entscheiden, welche Werte produktiv zulässig sind. Nächster Schritt: SQL-Abfrage erforderlich.
- **PKV-Kostenübernahme:** Es gibt meist keine zentrale verbindliche Gesamtliste wie bei der GKV; Skala und Primärquelle im Test prüfen. Nächster Schritt: Test/Recherche.
- **ICHI-Praxistauglichkeit:** Mit 2–3 sehr unterschiedlichen LCN-Einträgen testen, ob eindeutige Zuordnungen realistisch sind. Nächster Schritt: Test.

## Geplanter Test

Das Schema wird zunächst mit zwei bis drei deutlich unterschiedlichen Einträgen getestet, zum Beispiel einem Arzneimittel, einer apparativen Behandlung und einer Selbstmanagement-Maßnahme. Erst danach werden das endgültige Markdown-Arbeitsprotokoll und die spätere Datenbankstruktur festgelegt.


## Block 0 – Dubletten- und Abgrenzungsprüfung

Dieser Block muss vor jeder Neuanlage, Umbenennung oder strukturellen Änderung eines Therapieeintrags vollständig geprüft werden.

Ziel ist es, unnötige Dubletten zu verhindern und sauber zu unterscheiden zwischen:

* identischen Einträgen,
* echten Synonymen,
* Schreib- und Sprachvarianten,
* Wirkstoffen und Handelsnamen,
* Ober- und Unterbegriffen,
* eigenständigen Verfahren,
* Kombinationen und Behandlungsprotokollen.

Ein neuer Hauptdatensatz darf erst vorgeschlagen werden, nachdem Hauptnamen, Aliasse, normalisierte Schreibweisen, Abkürzungen, Langformen, deutsche und englische Varianten sowie Wirkstoff- und Handelsnamen gegen den bestehenden Datenbestand geprüft wurden.

---

### Vorgeschlagener Hauptname

**Vorgeschlagener Hauptname:**
`...`

#### Anforderungen

* genau eine eindeutige und verständliche Bezeichnung,
* korrekte deutsche Rechtschreibung,
* keine zusätzlichen Erklärungen in Klammern, sofern sie nicht zur eindeutigen Abgrenzung erforderlich sind,
* kein Handelsname als Hauptname, wenn der Wirkstoff der geeignetere Haupteintrag ist,
* keine Abkürzung als Hauptname, wenn eine allgemein verständliche Langform existiert,
* keine Kombination als eigenständiger Eintrag, ohne vorher die enthaltenen Einzelmaßnahmen und bestehenden Kombinationsbezüge zu prüfen.

---

### Art des Eintrags

Genau eine primäre Eintragsart auswählen.

* [ ] Wirkstoff
* [ ] Arzneimittelklasse
* [ ] medizinisches oder therapeutisches Verfahren
* [ ] Diagnostik
* [ ] Hilfsmittel
* [ ] Nahrungsergänzungsmittel
* [ ] Produkt- oder Handelsname
* [ ] Therapiekonzept
* [ ] Kombinationsbehandlung oder Kombinationsprotokoll
* [ ] Beratung, Schulung oder Selbstmanagement
* [ ] sonstiges

**Begründung der Zuordnung:**
`...`

#### Abgrenzungsregeln

* **Wirkstoff:** pharmakologisch wirksame Substanz, beispielsweise Cetirizin oder Prednisolon.
* **Arzneimittelklasse:** Gruppe von Wirkstoffen mit gemeinsamer pharmakologischer oder therapeutischer Einordnung, beispielsweise H1-Antihistaminika oder Betablocker.
* **Produkt- oder Handelsname:** geschützter oder produktbezogener Name eines Arzneimittels, Hilfsmittels oder Präparats.
* **Medizinisches oder therapeutisches Verfahren:** Behandlung, Intervention oder medizinische Prozedur.
* **Diagnostik:** Untersuchung oder Verfahren zur Erhebung diagnostischer Informationen.
* **Therapiekonzept:** übergeordnetes Vorgehen, das mehrere einzelne Maßnahmen enthalten kann.
* **Kombinationsbehandlung oder Kombinationsprotokoll:** bewusst festgelegte Kombination mehrerer Wirkstoffe, Verfahren oder Maßnahmen.
* **Beratung, Schulung oder Selbstmanagement:** Maßnahmen, bei denen Information, Verhaltensanpassung oder selbstständige Umsetzung im Mittelpunkt stehen.

---

### Bekannte Aliasse und alternative Bezeichnungen

Alle auffindbaren Bezeichnungen sammeln. Zu jedem Alias muss später ein zulässiger Alias-Typ vergeben werden.

| Bereich                                | Gefundene Bezeichnungen |
| -------------------------------------- | ----------------------- |
| Abkürzungen                            |                         |
| ausgeschriebene Langformen             |                         |
| deutsche Varianten                     |                         |
| englische Varianten                    |                         |
| Wirkstoffnamen                         |                         |
| Handels- oder Produktnamen             |                         |
| alternative Schreibweisen              |                         |
| historische oder frühere Bezeichnungen |                         |
| gebräuchliche Patient:innenbegriffe    |                         |
| Ober- oder Sammelbegriffe              |                         |
| Kombinationsbegriffe                   |                         |

#### Regeln

* Ein Alias ist nicht automatisch ein Synonym.
* Handelsname und Wirkstoff müssen als unterschiedliche Beziehungen gekennzeichnet werden.
* Oberbegriffe dürfen mit mehreren eigenständigen Einträgen verknüpft sein.
* Kombinationsbegriffe dürfen auf mehrere enthaltene Maßnahmen verweisen.
* Schreibvarianten, Abkürzungen und Sprachvarianten sollen nach Möglichkeit erhalten werden, wenn sie die Auffindbarkeit verbessern.
* Neue Alias-Typen dürfen nicht während einer Einzelrecherche frei erfunden werden.
* Es dürfen nur die im LCN-Rechercheschema festgelegten Alias-Typen verwendet werden.
* Fehlt ein passender Alias-Typ, wird dies als offener Strukturpunkt dokumentiert.

---

### Prüfung im bestehenden Datenbestand

Vor einer Entscheidung müssen mindestens folgende Prüfungen durchgeführt werden:

* [ ] Hauptnamen nach vollständiger Bezeichnung durchsucht
* [ ] Hauptnamen nach bedeutungstragenden Bestandteilen durchsucht
* [ ] bestehende Aliasse durchsucht
* [ ] Groß- und Kleinschreibung normalisiert
* [ ] Bindestriche, Leerzeichen und Zusammenschreibung geprüft
* [ ] Umlaute und umgeschriebene Umlaute geprüft
* [ ] Singular- und Pluralformen geprüft
* [ ] Abkürzung und ausgeschriebene Langform geprüft
* [ ] deutsche und englische Bezeichnungen geprüft
* [ ] Wirkstoff und Handelsnamen geprüft
* [ ] Arzneimittelklasse oder übergeordneter Gruppenbegriff geprüft
* [ ] mögliche Kombinationen und Kombinationsprotokolle geprüft
* [ ] ähnlich klingende, fachlich aber unterschiedliche Einträge geprüft

**Verwendete Suchbegriffe:**
`...`

**Durchsuchte Tabellen oder Datenquellen:**
`...`

---

### Ähnliche bestehende Einträge

Alle fachlich oder sprachlich ähnlichen Einträge aufführen. Nicht nur den wahrscheinlichsten Treffer nennen.

| treat_id | bestehender Hauptname | gefundener Alias oder Suchtreffer | Verhältnis zum vorgeschlagenen Eintrag | Begründung |
| -------: | --------------------- | --------------------------------- | -------------------------------------- | ---------- |
|          |                       |                                   |                                        |            |

#### Zulässige Verhältnisse

Für jeden geprüften bestehenden Eintrag genau eine Beziehung auswählen:

* `echte Dublette`
* `Synonym`
* `Schreibvariante`
* `Abkürzung oder Langform`
* `deutsche oder englische Sprachvariante`
* `Handelsname`
* `Wirkstoffbezug`
* `Arzneimittelklasse oder Oberbegriff`
* `Unterform oder spezifische Ausprägung`
* `Bestandteil einer Kombination`
* `Kombinationsbegriff`
* `verwandter, aber eigenständiger Eintrag`
* `fachlich nicht identisch`
* `weitere Abgrenzungsrecherche erforderlich`

---

### Fachliche Abgrenzung

#### Leitfrage

Warum ist der vorgeschlagene Eintrag bereits durch einen vorhandenen Datensatz abgedeckt oder warum benötigt er einen eigenständigen Hauptdatensatz?

**Abgrenzungsbegründung:**
`...`

Die Begründung muss konkret benennen:

* worin die fachliche Übereinstimmung oder Abweichung besteht,
* ob dieselbe Maßnahme, derselbe Wirkstoff oder nur ein verwandter Begriff gemeint ist,
* ob der Unterschied für Suche, Darstellung, Anbieterzuordnung oder Nutzerbewertung relevant ist,
* ob getrennte Bewertungen sinnvoll wären,
* ob der Begriff lediglich als Alias erhalten werden sollte,
* ob es sich um eine Kombination mehrerer bereits vorhandener Einträge handelt.

Nicht ausreichend sind Begründungen wie:

* „klingt ähnlich“,
* „wird manchmal so genannt“,
* „scheint dasselbe zu sein“,
* „könnte ein neuer Eintrag sein“,
* „zur Sicherheit getrennt anlegen“.

---

### Kategoriezuordnung

**Typ:**
`...`

**Unterkategorie:**
`...`

**Begründung:**
`...`

#### Regeln

* Es darf nur ein bestehender Typ aus der festgelegten LCN-Werteliste verwendet werden.
* Die Unterkategorie muss für den ausgewählten Typ zulässig sein.
* Neue Kategorien oder Unterkategorien dürfen nicht innerhalb einer Einzelrecherche spontan angelegt werden.
* Fehlt eine passende Kategorie, wird dies als offener Strukturpunkt dokumentiert.
* Einträge bleiben grundsätzlich gemeinsam in der Therapietabelle; unterschiedliche Arten von Maßnahmen werden über Typ, Unterkategorie und ergänzende Strukturen unterschieden.

---

### Entscheidung

Genau eine Hauptentscheidung auswählen.

* [ ] bestehenden Datensatz unverändert verwenden
* [ ] bestehenden Datensatz verwenden und Alias ergänzen
* [ ] bestehenden Datensatz umbenennen
* [ ] bestehende Datensätze zusammenführen
* [ ] neuen eigenständigen Datensatz anlegen
* [ ] Kombinationsbeziehung ergänzen, aber keinen neuen Hauptdatensatz anlegen
* [ ] weitere Recherche erforderlich
* [ ] strukturelle Entscheidung außerhalb der Einzelrecherche erforderlich

**Betroffene treat_id:**
`...`

**Endgültiger Hauptname:**
`...`

**Neu anzulegende oder zu ergänzende Aliasse:**
`...`

**Notwendige Folgeänderungen:**
`...`

**Entscheidungsbegründung:**
`...`

---

### Abschlusskontrolle

* [ ] Hauptname ist eindeutig und korrekt geschrieben.
* [ ] Der Eintrag ist nicht bereits als Hauptname vorhanden.
* [ ] Der Eintrag ist nicht bereits ausreichend als Alias abgedeckt.
* [ ] Wirkstoff, Handelsname und Arzneimittelklasse wurden voneinander abgegrenzt.
* [ ] Oberbegriffe und Unterformen wurden geprüft.
* [ ] Kombinationen wurden von Einzelmaßnahmen abgegrenzt.
* [ ] Typ und Unterkategorie entsprechen den bestehenden Wertelisten.
* [ ] Die Entscheidung ist nachvollziehbar begründet.
* [ ] Alle vorgesehenen Folgeänderungen wurden dokumentiert.
* [ ] Erst nach dieser Prüfung beginnt die inhaltliche Anreicherung des Therapieeintrags.


### Zusatzprüfung bei englischsprachigen Hauptnamen

Ein englischsprachiger Hauptname darf nur bestehen bleiben, wenn der englische Begriff auch im deutschsprachigen medizinischen, therapeutischen oder patientennahen Kontext tatsächlich als etablierte Bezeichnung verwendet wird.

Existiert eine etablierte, fachlich gleichwertige und für Betroffene verständlichere deutsche Bezeichnung, wird diese als Hauptname bevorzugt. Der bisherige englische Begriff bleibt als Suchalias erhalten.

Eine bloße wörtliche Übersetzung ist nicht ausreichend. Entscheidend ist, unter welchem Namen die konkrete Behandlung im deutschsprachigen Raum tatsächlich bezeichnet wird.

#### Recherchefrage

Nicht nur prüfen:

> Wie lautet die deutsche Übersetzung?

Sondern:

> Unter welchem Namen wird diese konkrete Behandlung im deutschsprachigen medizinischen, therapeutischen und patientennahen Umfeld tatsächlich bezeichnet?

#### Vor der Entscheidung prüfen

* [ ] Wird der englische Begriff in Deutschland als etablierter Fach- oder Praxisbegriff verwendet?
* [ ] Existiert eine etablierte und fachlich gleichwertige deutsche Bezeichnung?
* [ ] Ist die deutsche Bezeichnung für Betroffene verständlicher?
* [ ] Existiert der vorgeschlagene deutsche Name bereits als Hauptname?
* [ ] Ist der deutsche Name bereits als Alias einem anderen Treatment zugeordnet?
* [ ] Bezeichnen der englische und der deutsche Begriff tatsächlich dieselbe Behandlung?
* [ ] Wird durch die Übersetzung eine bestehende Dublette sichtbar?
* [ ] Bleibt die fachliche Bedeutung bei einer Umbenennung vollständig erhalten?

Ähnliche oder gleichlautende Namen sind lediglich ein Prüfhinweis. Sie reichen nicht als Begründung für eine Zusammenführung oder Umbenennung aus.

#### Entscheidungsregel

Genau eine Entscheidung auswählen:

* [ ] **Englischen Hauptnamen beibehalten:** Der Begriff ist im deutschsprachigen Umfeld etabliert und es existiert keine gleichwertige gebräuchliche deutsche Bezeichnung.
* [ ] **Deutschen Hauptnamen verwenden:** Eine etablierte, fachlich gleichwertige und verständlichere deutsche Bezeichnung ist vorhanden. Der englische Begriff wird als Alias erhalten.
* [ ] **Gemischten Namen verwenden:** Ein englischer Konzeptbegriff ist etabliert, wird aber durch eine deutsche Langform, Erläuterung oder verständliche Abkürzungsauflösung ergänzt.
* [ ] **In die Dublettenprüfung verschieben:** Die deutsche Bezeichnung gehört bereits zu einem fachlich identischen bestehenden Treatment.
* [ ] **Weitere Recherche erforderlich:** Die tatsächliche Verwendung im deutschsprachigen Raum ist noch nicht ausreichend belegt.

#### Bevorzugte Quellen

Die tatsächliche deutschsprachige Verwendung wird in dieser Reihenfolge geprüft:

1. deutschsprachige Leitlinien und Fachgesellschaften,
2. deutsche Universitätskliniken und medizinische Einrichtungen,
3. deutschsprachige Fachliteratur,
4. seriöse deutschsprachige Patienteninformationen,
5. Anbieter-, Hersteller- und Verbandsseiten nur ergänzend.

#### Ergebnisdokumentation

**Bisheriger englischer Name:**
`...`

**Gefundene deutsche Bezeichnung:**
`...`

**Im deutschsprachigen Umfeld überwiegend verwendeter Begriff:**
`...`

**Entscheidung:**
`Englischer Hauptname | deutscher Hauptname | gemischter Hauptname | Dublettenprüfung | weitere Recherche`

**Künftiger Hauptname:**
`...`

**Als Alias zu erhaltende Bezeichnungen:**
`...`

**Begründung mit Quellen:**
`...`

### Zusatzprüfung bei Abkürzungen in neuen Treatment-Namen

Bei jedem neuen Treatment-Namen und bei jeder Umbenennung muss geprüft werden, ob eine enthaltene Abkürzung für Betroffene ausreichend verständlich und im deutschsprachigen medizinischen oder patientennahen Umfeld tatsächlich gebräuchlich ist.

Abkürzungen sind grundsätzlich sinnvoll für die Wiedererkennung und die Suche. Sie sollen aber nur dann Teil des Hauptnamens sein, wenn sie dort einen echten Verständlichkeits- oder Wiedererkennungswert haben.

#### Grundregel

Für den Hauptnamen gelten drei Fälle:

1. **Sehr bekannte Abkürzung als Hauptname**

   Eine allgemein bekannte medizinische Abkürzung darf ohne Langform als Hauptname verwendet werden, wenn die Abkürzung deutlich bekannter ist als ihre ausgeschriebene Form.

   Beispiele:

   * `MRT`
   * `CT`
   * `EKG`
   * `COVID-19`

   Die Langform muss in diesem Fall nicht in den Hauptnamen aufgenommen werden.

2. **Gebräuchliche Abkürzung hinter der Langform**

   Ist die Abkürzung fachlich gebräuchlich und für die Wiedererkennung hilfreich, aber nicht allgemein verständlich, wird folgende Form verwendet:

   > **Etablierte Langform (Abkürzung)**

   Beispiel:

   > `Palmitoylethanolamid (PEA)`

   Verwendet wird die im deutschsprachigen Raum fachlich etablierte Langform.

3. **Unübliche Abkürzung nicht im Hauptnamen**

   Ist die Abkürzung wenig bekannt, schwer verständlich oder für die Wiedererkennung nicht wesentlich, wird sie nicht in den Hauptnamen aufgenommen.

   Sie bleibt dennoch als Suchalias erhalten.

#### Auswahl der Langform

* Bevorzugt wird die fachlich etablierte deutsche Langform.
* Existiert keine gleichwertige und gebräuchliche deutsche Langform, wird die etablierte englische Originalbezeichnung verwendet.
* Es darf keine künstliche Übersetzung erfunden werden.
* Es darf keine zusätzliche dritte Bezeichnung konstruiert werden, wenn bereits eine etablierte deutsche oder englische Form existiert.
* Produkt-, Geräte-, Studien- oder Wirkstoffcodes ohne sinnvolle Langform bleiben unverändert.
* Eine unübliche Abkürzung darf nur dann im Hauptnamen verbleiben, wenn sie fachlich etabliert und für die eindeutige Wiedererkennung notwendig ist.

#### Aliasse

Unabhängig davon, wie der Hauptname gebildet wird, gelten für die Suche folgende Regeln:

* Jede bekannte Abkürzung wird als Suchalias aufgenommen.
* Die ausgeschriebene Langform wird als Alias aufgenommen, wenn sie nicht bereits Hauptname ist.
* Deutsche und englische Varianten bleiben als sinnvolle Aliasse erhalten.
* Frühere Hauptnamen bleiben als Alias erhalten, sofern sie fachlich korrekt oder gebräuchlich waren.
* Alternative korrekte Schreibweisen bleiben als Alias erhalten.
* Der neue Hauptname wird als `primary_name` geführt.
* Reine Schreibfehler oder offensichtlich falsche Bezeichnungen müssen nicht als Alias erhalten werden.

#### Prüfung vor dem Eintrag

Vor jeder Neuanlage oder Umbenennung prüfen:

* [ ] Ist die Abkürzung allgemein bekannt?
* [ ] Ist die Abkürzung bekannter als die Langform?
* [ ] Ist die Abkürzung fachlich gebräuchlich?
* [ ] Ist die Abkürzung für die Wiedererkennung hilfreich?
* [ ] Existiert eine etablierte deutsche Langform?
* [ ] Existiert nur eine etablierte englische Originalbezeichnung?
* [ ] Ist die Langform bereits als Hauptname vorhanden?
* [ ] Ist die Abkürzung bereits als Alias vorhanden?
* [ ] Gibt es einen fachlich identischen oder sehr ähnlichen Eintrag?
* [ ] Entsteht durch die Umbenennung eine Slug-Kollision?
* [ ] Handelt es sich um eine Dublette, einen Oberbegriff, eine Unterform oder einen eigenständigen Eintrag?

Ähnliche Namen oder gleiche Abkürzungen sind nur ein Prüfhinweis. Eine Zusammenführung erfolgt nur, wenn fachlich tatsächlich dieselbe Behandlung, Untersuchung oder Maßnahme gemeint ist.

#### Entscheidungsregel

Genau eine Entscheidung auswählen:

* [ ] **Abkürzung allein verwenden:** Die Abkürzung ist allgemein bekannt und deutlich gebräuchlicher als die Langform.
* [ ] **Langform mit Abkürzung verwenden:** Die Abkürzung ist gebräuchlich und hilfreich, aber nicht allgemein verständlich.
* [ ] **Nur Langform verwenden:** Die Abkürzung ist zu unüblich oder bringt keinen ausreichenden Wiedererkennungswert.
* [ ] **Code unverändert verwenden:** Es handelt sich um einen etablierten Produkt-, Geräte-, Studien- oder Wirkstoffcode ohne sinnvolle Langform.
* [ ] **Weitere Recherche erforderlich:** Verbreitung, Langform oder fachliche Bedeutung sind nicht ausreichend geklärt.

#### Ergebnisdokumentation

**Bisheriger Name:**
`...`

**Gefundene Abkürzung:**
`...`

**Gefundene Langform:**
`...`

**Etablierte Sprache der Langform:**
`Deutsch | Englisch`

**Bekanntheitsgrad der Abkürzung:**
`allgemein bekannt | fachlich gebräuchlich | wenig gebräuchlich`

**Entscheidung für den Hauptnamen:**
`Abkürzung allein | Langform (Abkürzung) | nur Langform | Code unverändert | weitere Recherche`

**Künftiger Hauptname:**
`...`

**Als Alias zu erhaltende Formen:**
`...`

**Begründung:**
`...`


## Regel für Kombinationen, Alternativen und zusammengefasste Maßnahmen

- **Echte Kombinationen** als eigenen Eintrag führen:

  **Therapie A & Therapie B (Kombi)**

- Das Zeichen **`&` ausschließlich für echte Kombinationen** verwenden.
- In normalen Namen immer **„und“ ausschreiben**.
- Jede Komponente einer Kombination muss zusätzlich als **eigener Treatment-Eintrag** existieren.
- Die Einzelbestandteile werden als Suchaliase mit dem Kombinationseintrag verknüpft.
- Der Kombinationsname wird umgekehrt auch bei den Einzelbehandlungen als Suchalias hinterlegt.
- **Alternativen niemals als Kombination führen.**  
  Aus `Therapie A / Therapie B` werden zwei getrennte Einträge.
- **Schrägstriche grundsätzlich vermeiden.** Sie sind nur zulässig, wenn sie Bestandteil einer festen Fachbezeichnung oder einer bewusst verkürzten Schreibweise sind, zum Beispiel:
  - `Long-/Post-COVID-Reha`
  - `VQ-SPECT/CT`
- Schrägstriche dürfen nicht verwendet werden, um mehrere unterschiedliche Therapien, Untersuchungen oder Leistungen unsauber zusammenzufassen.
- Mehrere versehentlich zusammengefasste Maßnahmen werden aufgeteilt. Ärzt:innen-, Quellen- und weitere Verknüpfungen werden fachlich passend auf die neuen Einträge übertragen.
- Diagnostik und Therapie nicht in einem gemeinsamen Treatment-Datensatz vermischen.
- Unbestimmte Zusätze wie `+ Begleitmittel` entfernen oder konkret benennen.
- Sammelnamen nach einer Aufteilung nur dann als Alias erhalten, wenn sie für die Suche sinnvoll sind.
- Vor neuen Einträgen immer auf bestehende Hauptnamen, Aliasse, Slugs und fachliche Dubletten prüfen.


# Regel für Oberbegriffe und Aliasverknüpfungen bei neuen Treatments

Bei jeder neuen Behandlung oder Diagnostik ist zu prüfen, ob der Eintrag:

* ein konkretes Einzelverfahren,
* ein Ober- oder Sammelbegriff,
* oder Teil eines bereits vorhandenen Oberbegriffs ist.

## Vorgehen

1. **Vor Neuanlage Dubletten prüfen**

   * Hauptnamen, Aliasse, Abkürzungen und ähnliche Oberbegriffe durchsuchen.
   * Keine nahezu gleichbedeutenden Oberbegriffe parallel anlegen, wenn keine klare fachliche Abgrenzung besteht.

2. **Oberbegriffe dürfen bestehen bleiben**

   * Ein allgemeiner Begriff ist nicht automatisch ungeeignet.
   * Er muss aber fachlich sinnvoll, verständlich und von ähnlichen Oberbegriffen abgrenzbar sein.

3. **Unterbegriffe direkt mitprüfen**

   * Bei einem neuen Oberbegriff vorhandene konkrete Treatments sammeln, die echte Unterarten, Einzelverfahren oder klare Bestandteile sind.
   * Bei einem neuen konkreten Treatment prüfen, ob es zu bestehenden Oberbegriffen gehört.

4. **Aliasrichtung**

   * Den vorhandenen Alias des Oberbegriffs zusätzlich mit passenden konkreten Treatments verknüpfen.
   * Keine neuen Aliasdatensätze anlegen, wenn der Begriff bereits existiert.
   * Konkrete Aliasse nicht automatisch mit dem Oberbegriff verknüpfen.

5. **Restriktiv zuordnen**

   * Nur verknüpfen bei einer echten fachlichen Hierarchie.
   * Nicht ausreichend sind bloße thematische Nähe, ähnliche Wirkung, gemeinsame Anwendung oder dieselbe Kategorie.

6. **Mehrfachzuordnung ist erlaubt**

   * Ein konkretes Treatment darf mehreren passenden Oberbegriffen zugeordnet werden.

7. **Kategorien nicht doppelt pflegen**

   * `typ` und `unterkategorie` bleiben die strukturelle Einordnung.
   * Aliasverknüpfungen nur ergänzen, wenn sie einen zusätzlichen Nutzen für die Freitextsuche bringen.

## Dokumentation

Für jede neue Oberbegriff-Verknüpfung in `tbl_cpl_treatments2aliases_03`:

```text
note = Oberbegriff-Alias für konkrete Treatment-Suche
```

Vor dem Einfügen immer prüfen:

* Alias-ID existiert,
* Treatment-ID existiert,
* Verbindung besteht noch nicht,
* keine Selbstverknüpfung,
* keine Dublette.


## Ergänzende Regeln für neue Treatment-Recherchen

### Ober- und Unterbegriffe

- Sinnvolle Ober- und Sammelbegriffe dürfen neben konkreten Treatments bestehen bleiben.
- Konkrete Unterbegriffe werden zusätzlich als eigene Treatments geführt.
- Der Oberbegriff kann als Suchalias mit fachlich passenden Unterbegriffen verknüpft werden.
- Nur echte Unterarten oder Bestandteile verknüpfen, nicht bloß thematisch verwandte Treatments.

### Wirkstoffe und Markenprodukte

- Wirkstoff und Markenprodukt dürfen jeweils als eigene Treatments geführt werden, wenn beide separat gesucht, beschrieben oder bewertet werden sollen.
- Wirkstoff und Marke gegenseitig über Aliasse auffindbar machen:
  - Marke beim Wirkstoff: `trade_name`
  - Wirkstoff bei der Marke: `generic_name`
- Spezielle Dosierungen, Darreichungsformen und Marken nicht automatisch mit dem allgemeinen Wirkstoff gleichsetzen.
- Ärzte- und Quellenverknüpfungen nur übertragen, wenn sie nachweislich auch für den neuen Eintrag gelten.

### Aufteilungen und frühere Sammelnamen

- Werden zusammengefasste Einträge aufgeteilt, Ärzte, Quellen und weitere Verknüpfungen fachlich passend übertragen.
- Den früheren Sammelnamen als `alternate_name` bei den daraus entstandenen Treatments erhalten, sofern er als Suchbegriff sinnvoll ist.
- Diagnostik, Therapie, Produkt und Wirkstoff nicht allein wegen gemeinsamer Nennung in einen Datensatz zusammenfassen.

### Aliasse

- Jedes Treatment benötigt einen exakt passenden Alias vom Typ `primary_name`.
- Derselbe Alias darf mit mehreren Treatments verknüpft sein.
- Mehrfach vorhandene Aliastexte nicht automatisch löschen oder zusammenführen.
- Verwaiste alte Hauptnamen entweder sinnvoll neu verknüpfen oder löschen, wenn sie keinen Suchwert mehr haben.
- Aliasse bilden Suchbeziehungen ab; bestehende Daten nicht ohne konkreten Fehler „bereinigen“.

### Ungewöhnliche Produkt-, Geräte- und Eigennamen

- Einen ungewöhnlichen Namen nicht allein deshalb ändern, weil ein allgemeinerer Fachbegriff existiert.
- Eigennamen, Geräte-, System- und Produktnamen unverändert lassen, sofern sie korrekt und eindeutig identifizierbar sind.
- Nur bei tatsächlicher Unklarheit, falscher Bezeichnung oder fachlicher Dublette recherchieren und ändern.
- Keine erklärenden Zusätze, Oberbegriffe oder neuen Treatments ohne konkreten Bedarf erfinden.

### Löschen

- Nur löschen, wenn kein eigenständiges Treatment, Versorgungsangebot oder sinnvoller Sucheinstieg vorliegt.
- Vor dem Löschen alle Ärzte-, Quellen-, Symptom-, Alias- und sonstigen Treatment-Verknüpfungen prüfen.
- Verwaiste Aliasdatensätze anschließend separat kontrollieren und gegebenenfalls löschen.