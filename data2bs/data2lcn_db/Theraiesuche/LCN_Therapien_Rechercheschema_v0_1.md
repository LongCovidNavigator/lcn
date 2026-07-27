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