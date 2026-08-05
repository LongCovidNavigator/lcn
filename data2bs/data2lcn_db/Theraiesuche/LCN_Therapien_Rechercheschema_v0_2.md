# LCN – Arbeitsanweisung für neue Treatment-Recherchen

**Version:** 2.0  
**Zweck:** Neue Treatments möglichst fachlich korrekt, verständlich, einheitlich und ohne spätere größere Datenbereinigung erfassen.

---

## 1. Ziel und Grundprinzip

Vor jeder Neuanlage wird zuerst geprüft, ob der gesuchte Inhalt bereits vorhanden ist:

- als Hauptname,
- als Alias,
- unter einer Abkürzung oder Langform,
- unter einer deutschen oder englischen Bezeichnung,
- als Wirkstoff oder Handelsname,
- als Ober- oder Unterbegriff,
- als Bestandteil einer Kombination,
- unter einer abweichenden Schreibweise,
- oder als fachlich ähnlicher, aber eigenständiger Eintrag.

Ein neuer Treatment-Datensatz wird nur angelegt, wenn der Inhalt fachlich eigenständig ist und nicht ausreichend durch einen bestehenden Eintrag abgedeckt wird.

Ziel ist keine theoretisch perfekte Datenbank. Neue Einträge sollen bereits bei der Recherche so sauber vorbereitet werden, dass ungefähr 90–95 % der später notwendigen Namens-, Alias-, Dubletten- und Abgrenzungsarbeit vermieden werden.

Grundregeln:

- Keine schwammigen Platzhalter.
- Keine unbelegten Freitextergebnisse.
- Fehlende Informationen bleiben leer und werden als offene Recherche markiert.
- Nutzererfahrungen und redaktionell recherchierte Informationen nicht vermischen.
- Bestehende Wertelisten für Typ, Unterkategorie, Alias-Typen und Symptome verwenden.
- Keine neuen Kategorien, Unterkategorien oder Alias-Typen während einer Einzelrecherche erfinden.
- Keine bestehenden Daten ohne konkreten fachlichen oder technischen Fehler „bereinigen“.

---

# Teil A – Prüfung vor jeder Neuanlage

## 2. Dubletten- und Abgrenzungsprüfung

Vor jeder Neuanlage, Umbenennung, Zusammenführung oder strukturellen Änderung müssen mindestens geprüft werden:

- vollständiger vorgeschlagener Name,
- bedeutungstragende Namensbestandteile,
- vorhandene Hauptnamen,
- vorhandene Aliasse,
- Singular- und Pluralformen,
- Groß- und Kleinschreibung,
- Bindestriche, Leerzeichen und Zusammenschreibung,
- Umlaute und umgeschriebene Umlaute,
- Abkürzung und ausgeschriebene Langform,
- deutsche und englische Varianten,
- Wirkstoff und Handelsnamen,
- Arzneimittelklasse oder Oberbegriff,
- Unterformen und spezifische Ausprägungen,
- Kombinationen und Behandlungsprotokolle,
- ähnlich klingende, fachlich aber unterschiedliche Einträge.

Ähnliche Namen sind nur ein Prüfhinweis. Eine Zusammenführung erfolgt ausschließlich, wenn fachlich tatsächlich dieselbe Maßnahme, Untersuchung, Substanz oder Leistung gemeint ist.

### Verwendete Suchbegriffe dokumentieren

```text
Vollständiger Name:
Namensbestandteile:
Abkürzungen:
Langformen:
Deutsche Varianten:
Englische Varianten:
Wirkstoffnamen:
Handelsnamen:
Schreibvarianten:
Oberbegriffe:
Kombinationsbegriffe:
```

---

## 3. Verhältnis zu bestehenden Einträgen bestimmen

Für jeden ähnlichen bestehenden Eintrag genau eine Beziehung auswählen:

- `echte Dublette`
- `Synonym`
- `Schreibvariante`
- `Abkürzung oder Langform`
- `deutsche oder englische Sprachvariante`
- `Handelsname`
- `Wirkstoffbezug`
- `Arzneimittelklasse oder Oberbegriff`
- `Unterform oder spezifische Ausprägung`
- `Bestandteil einer Kombination`
- `Kombinationsbegriff`
- `früherer Sammelname`
- `verwandter, aber eigenständiger Eintrag`
- `fachlich nicht identisch`
- `weitere Abgrenzungsrecherche erforderlich`

### Prüfungstabelle

| treat_id | bestehender Hauptname | gefundener Alias oder Suchtreffer | Verhältnis | Begründung |
|---:|---|---|---|---|

---

## 4. Eigenständiger Datensatz oder Alias?

Ein eigener Treatment-Datensatz ist sinnvoll, wenn der Eintrag separat:

- gesucht,
- beschrieben,
- Ärzt:innen oder Anbietern zugeordnet,
- bewertet,
- verglichen,
- fachlich abgegrenzt
- oder auf einer eigenen Detailseite dargestellt

werden soll.

Ein Alias genügt, wenn lediglich eine andere Bezeichnung derselben Sache vorliegt.

Nicht ausreichend für einen neuen Datensatz sind:

- bloße andere Schreibweise,
- reine Übersetzung,
- Abkürzung,
- Produktname ohne eigenständigen Bewertungs- oder Suchzweck,
- thematische Nähe,
- ähnliche Wirkung,
- gemeinsame Anwendung,
- dieselbe Kategorie.

---

## 5. Art des Eintrags bestimmen

Vor der Benennung genau eine primäre Eintragsart festlegen:

- Wirkstoff,
- Arzneimittelklasse,
- Arzneimittel- oder Produktmarke,
- medizinisches oder therapeutisches Verfahren,
- Diagnostik,
- Hilfsmittel,
- Nahrungsergänzungsmittel,
- Geräte-, System- oder Produktname,
- Therapiekonzept,
- Kombinationsbehandlung oder Kombinationsprotokoll,
- Beratung, Schulung oder Selbstmanagement,
- Versorgungsangebot,
- sonstiges.

Diagnostik, Therapie, Wirkstoff, Produkt und Versorgungsangebot nicht allein deshalb in einem Datensatz zusammenfassen, weil sie gemeinsam angeboten oder in derselben Quelle genannt werden.

---

# Teil B – Bildung des Hauptnamens

## 6. Allgemeine Anforderungen

Der Hauptname muss:

- genau eine klar erkennbare Maßnahme bezeichnen,
- fachlich korrekt sein,
- verständlich und möglichst gebräuchlich sein,
- korrekt geschrieben sein,
- zur bestehenden LCN-Namenslogik passen,
- von ähnlichen Treatments unterscheidbar sein.

Nicht in den Hauptnamen gehören:

- mehrere alternative Bezeichnungen,
- reine Suchbegriffe,
- unnötige Erklärungen,
- Werbeaussagen,
- nicht belegte Wirkversprechen,
- unbestimmte Zusätze wie `+ Begleitmittel`,
- unsaubere Aufzählungen mehrerer Maßnahmen,
- künstlich erfundene Übersetzungen,
- unnötige Klammerzusätze.

Erklärende Klammern nur verwenden, wenn sie für Abgrenzung, Verständlichkeit oder Wiedererkennung notwendig sind.

---

## 7. Deutsche und englische Namen

Ein englischer Hauptname darf bestehen bleiben, wenn er auch im deutschsprachigen medizinischen, therapeutischen oder patientennahen Umfeld als etablierte Bezeichnung verwendet wird.

Existiert eine fachlich gleichwertige, etablierte und verständlichere deutsche Bezeichnung:

- deutsche Bezeichnung als Hauptname,
- englische Bezeichnung als Alias.

Keine bloße wörtliche Übersetzung verwenden, wenn diese im deutschsprachigen Umfeld nicht tatsächlich gebräuchlich ist.

### Recherchefrage

Nicht nur:

> Wie lautet die deutsche Übersetzung?

Sondern:

> Unter welchem Namen wird diese konkrete Behandlung im deutschsprachigen Raum tatsächlich bezeichnet?

### Vor der Entscheidung prüfen

- Wird der englische Begriff in Deutschland als Fach- oder Praxisbegriff verwendet?
- Existiert eine etablierte deutsche Bezeichnung?
- Ist die deutsche Bezeichnung fachlich gleichwertig?
- Ist sie für Betroffene verständlicher?
- Existiert der deutsche Name bereits als Hauptname?
- Ist er bereits als Alias vorhanden?
- Bezeichnen beide Begriffe tatsächlich dieselbe Maßnahme?
- Entsteht durch die Übersetzung eine Dublette?
- Bleibt die fachliche Bedeutung vollständig erhalten?

### Entscheidungswerte

- `englischen Hauptnamen beibehalten`
- `deutschen Hauptnamen verwenden`
- `gemischten Namen verwenden`
- `in Dublettenprüfung verschieben`
- `weitere Recherche erforderlich`

### Bevorzugte Quellen

1. deutschsprachige Leitlinien und Fachgesellschaften,
2. deutsche Universitätskliniken und medizinische Einrichtungen,
3. deutschsprachige Fachliteratur,
4. seriöse deutschsprachige Patienteninformationen,
5. Anbieter-, Hersteller- und Verbandsseiten ergänzend.

---

## 8. Abkürzungen

### Fall 1 – allgemein bekannte Abkürzung

Sehr bekannte medizinische Abkürzungen dürfen allein als Hauptname verwendet werden:

- `MRT`
- `CT`
- `EKG`
- `COVID-19`

Die Langform muss nicht zusätzlich im Hauptnamen stehen.

### Fall 2 – Langform mit Abkürzung

Ist die Abkürzung fachlich gebräuchlich und für die Wiedererkennung hilfreich, aber nicht allgemein verständlich:

> **Etablierte Langform (Abkürzung)**

Beispiel:

> `Palmitoylethanolamid (PEA)`

### Fall 3 – nur Langform

Ist die Abkürzung wenig gebräuchlich, schwer verständlich oder nicht hilfreich, wird sie nicht in den Hauptnamen aufgenommen.

Sie bleibt als Suchalias erhalten.

### Codes und Eigennamen

Produkt-, Geräte-, Studien- und Wirkstoffcodes ohne sinnvolle etablierte Langform bleiben unverändert.

Keine künstliche Langform oder zusätzliche dritte Bezeichnung erfinden.

### Vor der Entscheidung prüfen

- Ist die Abkürzung allgemein bekannt?
- Ist sie bekannter als die Langform?
- Ist sie fachlich gebräuchlich?
- Ist sie für die Wiedererkennung hilfreich?
- Existiert eine etablierte deutsche Langform?
- Existiert nur eine etablierte englische Originalbezeichnung?
- Ist die Langform bereits als Hauptname vorhanden?
- Ist die Abkürzung bereits als Alias vorhanden?
- Gibt es einen fachlich identischen Eintrag?
- Entsteht eine Namens- oder Slug-Kollision?

### Entscheidungswerte

- `Abkürzung allein`
- `Langform mit Abkürzung`
- `nur Langform`
- `Code unverändert`
- `weitere Recherche erforderlich`

---

# Teil C – Kombinationen, Alternativen und Aufteilungen

## 9. Echte Kombinationen

Echte Kombinationen erhalten das Format:

> **Therapie A & Therapie B (Kombi)**

Bei drei Bestandteilen:

> **Therapie A, Therapie B & Therapie C (Kombi)**

Regeln:

- `&` ausschließlich für echte Kombinationen verwenden.
- In normalen Namen `und` ausschreiben.
- Jede Komponente muss zusätzlich als eigener Treatment-Eintrag existieren.
- Einzelbestandteile als Suchaliase mit der Kombination verknüpfen.
- Kombinationsnamen auch bei den Einzelbestandteilen als Suchalias hinterlegen.
- Kombinationen nicht anlegen, wenn nur zwei mögliche Alternativen gemeint sind.
- Wirkstoffkombinationen, Behandlungsprotokolle und lose gemeinsame Anwendung voneinander unterscheiden.

---

## 10. Alternativen und Schrägstriche

Alternativen niemals in einem Treatment zusammenfassen.

Aus:

> `Therapie A / Therapie B`

werden zwei eigenständige Treatments.

Schrägstriche grundsätzlich vermeiden.

Sie sind nur erlaubt, wenn sie Bestandteil einer festen Fachbezeichnung oder etablierten Kurzform sind, beispielsweise:

- `Long-/Post-COVID-Reha`
- `VQ-SPECT/CT`

Schrägstriche dürfen nicht verwendet werden, um unterschiedliche:

- Therapien,
- Diagnostiken,
- Körperregionen,
- Produkte,
- Beratungsleistungen
- oder Versorgungsangebote

in einem Namen zusammenzufassen.

---

## 11. Aufteilung zusammengefasster Einträge

Werden mehrere Maßnahmen getrennt:

- bestehende Ärzteverknüpfungen prüfen,
- Quellenverknüpfungen prüfen,
- Symptomverknüpfungen prüfen,
- sonstige Treatment-Verknüpfungen prüfen,
- nur fachlich passende Verknüpfungen übertragen,
- nichts blind auf alle neuen Einträge kopieren.

Den früheren Sammelnamen als `alternate_name` bei den entstandenen Treatments erhalten, wenn er als Suchbegriff sinnvoll bleibt.

Ein früherer Sammelname darf mit mehreren Treatments verknüpft sein.

---

# Teil D – Oberbegriffe und konkrete Treatments

## 12. Oberbegriffe dürfen bestehen bleiben

Ein allgemeiner Begriff ist nicht automatisch ungeeignet.

Sinnvolle Ober- und Sammelbegriffe dürfen neben konkreten Einzelmaßnahmen als eigene Treatments bestehen, wenn sie:

- einen verständlichen Sucheinstieg bieten,
- fachlich sinnvoll sind,
- von ähnlichen Oberbegriffen abgrenzbar sind,
- eigenständig beschrieben oder bewertet werden können.

Konkrete Unterbegriffe werden trotzdem als eigene Treatments geführt.

---

## 13. Oberbegriff-Aliasse

Bei einem neuen Oberbegriff:

- vorhandene konkrete Unterbegriffe sammeln,
- nur echte Unterarten, Einzelverfahren oder klare Bestandteile zuordnen.

Bei einem neuen konkreten Treatment:

- prüfen, ob es zu bestehenden Oberbegriffen gehört.

Der vorhandene Alias des Oberbegriffs kann zusätzlich mit konkreten Treatments verknüpft werden.

Nicht ausreichend für eine Verknüpfung sind:

- bloße thematische Nähe,
- ähnliche Wirkung,
- gemeinsame Anwendung,
- dieselbe Kategorie,
- Einsatz bei derselben Erkrankung.

Ein konkretes Treatment darf mehreren passenden Oberbegriffen zugeordnet werden.

### Dokumentation

```text
note = Oberbegriff-Alias für konkrete Treatment-Suche
```

Konkrete Unterbegriffe nicht automatisch als Aliasse beim Oberbegriff hinterlegen. Dadurch würde eine präzise Suche unnötig auch den allgemeinen Eintrag liefern.

---

## 14. Kategorien und Oberbegriffe nicht verwechseln

`typ` und `unterkategorie` dienen der strukturellen Einordnung.

Aliasverknüpfungen dienen der Freitextsuche.

Ein Oberbegriff-Alias ist nur nötig, wenn er einen zusätzlichen Suchnutzen bietet.

Keine Aliasverknüpfung allein deshalb anlegen, weil zwei Treatments dieselbe Kategorie haben.

---

# Teil E – Wirkstoffe und Markenprodukte

## 15. Wirkstoff und Marke

Wirkstoff und Handelsprodukt dürfen jeweils als eigene Treatments geführt werden, wenn beide separat:

- gesucht,
- beschrieben,
- Ärzt:innen oder Anbietern zugeordnet,
- bewertet,
- verglichen
- oder auf eigenen Detailseiten dargestellt

werden sollen.

Beispiel:

- Wirkstoff: `Pyridostigmin`
- Marke: `Mestinon`

Die Beziehung wird zusätzlich über Aliasse sichtbar gemacht:

- Marke beim Wirkstoff: `trade_name`
- Wirkstoff bei der Marke: `generic_name`

Wirkstoff und Marke bleiben trotzdem eigenständige Treatments.

---

## 16. Spezifische Arzneimittelformen

Folgende Ebenen nicht automatisch gleichsetzen:

- allgemeiner Wirkstoff,
- niedrig dosierte Anwendung,
- retardierte Darreichungsform,
- Wirkstoffkombination,
- Handelsprodukt,
- besondere Applikationsform,
- Entwicklungskandidat.

Beispiel:

- `Aripiprazol`
- `Niedrig dosiertes Aripiprazol (LDA)`
- `Abilify`

Diese dürfen getrennte Treatments sein, wenn getrennte Bewertungen oder Zuordnungen sinnvoll sind.

Ärzte- und Quellenverknüpfungen nur übertragen, wenn die Quelle tatsächlich auch für den neuen Eintrag gilt.

Ein Nachweis für eine niedrig dosierte Anwendung ist nicht automatisch ein Nachweis für den allgemeinen Wirkstoff.

Ein Nachweis für eine retardierte Darreichungsform gilt nicht automatisch für jede Morphin-Anwendung.

---

## 17. Recherchefelder für Arzneimittel

Bei Arzneimitteln zusätzlich recherchieren:

- normierter Wirkstoffname,
- Wirkstoffkombination,
- Handelsnamen,
- Medikamentenklasse,
- ATC-Code,
- Applikationsform,
- Zugangs- oder Verschreibungsstatus,
- Zulassungsstatus,
- Off-Label-Status für Long COVID,
- übliche Anwendung oder Dosierung nur mit belastbarer Quelle,
- Gegenanzeigen,
- Wechselwirkungen,
- Kosten- und Erstattungsinformationen.

### Zulassungsstatus unterscheiden

- Arzneimittel grundsätzlich zugelassen,
- in Deutschland zugelassen,
- für die konkrete Indikation zugelassen,
- Off-Label-Anwendung,
- Prüfpräparat oder Entwicklungskandidat.

Zulassung nicht als einfaches allgemeines Ja/Nein behandeln.

---

# Teil F – Aliasse

## 18. Grundregeln

Jedes Treatment benötigt einen exakt passenden Alias vom Typ:

```text
primary_name
```

Weitere mögliche Aliasse:

- Abkürzungen,
- Langformen,
- Synonyme,
- Schreibvarianten,
- Sprachvarianten,
- frühere Hauptnamen,
- Handelsnamen,
- Wirkstoffnamen,
- Oberbegriffe,
- Kombinationsbegriffe,
- historische Bezeichnungen.

Ein Alias ist nicht automatisch ein Synonym.

---

## 19. Mehrfachverknüpfungen

Derselbe Alias darf mit mehreren Treatments verknüpft sein.

Beispiele:

- Oberbegriff mit mehreren Unterbegriffen,
- alter Sammelname mit mehreren aufgeteilten Treatments,
- Kombinationsname mit seinen Bestandteilen,
- Wirkstoffname mit Marke und Kombination.

Mehrfach vorhandene Aliastexte nicht automatisch löschen oder zusammenführen.

Unterschiedliche Aliasdatensätze oder Alias-Typen können aus früheren Bereinigungen stammen und werden nur bei einem konkreten technischen oder fachlichen Problem verändert.

---

## 20. Alias-Typen

Nur bestehende Alias-Typen aus der Datenbank verwenden.

Keine neuen Alias-Typen während einer Einzelrecherche erfinden.

Typische bestehende Beziehungen:

```text
primary_name
alternate_name
abbreviation
long_form
long_form_en
language_variant_en
spelling_variant
synonym
trade_name
generic_name
umbrella_term
```

Die jeweils aktuelle Werteliste ist vor einer größeren Recherche direkt aus der Datenbank zu übernehmen.

---

## 21. Alte und verwaiste Aliasse

Nach Umbenennung, Aufteilung oder Löschung prüfen:

- Ist der alte Alias noch sinnvoll?
- Kann er einem oder mehreren bestehenden Treatments zugeordnet werden?
- Ist der Alias vollständig verwaist?
- Hat er noch Suchwert?

Vorgehen:

- sinnvoller alter Begriff → als `alternate_name` neu verknüpfen,
- sinnvoller Sammelname → mit mehreren passenden Treatments verknüpfen,
- kein Suchwert und keine Verknüpfung → Alias löschen,
- nicht automatisch pauschal bereinigen.

---

## 22. Aliasverknüpfung vor dem Einfügen prüfen

Vor jeder neuen Verbindung:

- Alias-ID existiert,
- Treatment-ID existiert,
- Verbindung besteht noch nicht,
- keine ungewollte Selbstverknüpfung,
- korrekter Alias-Typ,
- fachlich nachvollziehbare Beziehung,
- passende `note`, falls nötig.

---

# Teil G – Produkt-, Geräte- und Eigennamen

## 23. Eigennamen nicht künstlich normalisieren

Ungewöhnliche Produkt-, Geräte-, System- und Verfahrensnamen bleiben unverändert, wenn sie:

- korrekt geschrieben,
- eindeutig identifizierbar,
- tatsächlich gebräuchlich,
- fachlich eigenständig

sind.

Nicht allein deshalb umbenennen oder mit erklärenden Zusätzen versehen, weil ein allgemeinerer Fachbegriff existiert.

Keine künstlichen Probleme erzeugen.

Keine zusätzlichen Treatments, Klammererklärungen oder Verfahrensaliasse ohne konkreten Nutzen ergänzen.

---

## 24. Wann recherchiert oder geändert wird

Nur weiter prüfen, wenn mindestens eines zutrifft:

- Begriff lässt sich nicht eindeutig identifizieren,
- Schreibweise ist möglicherweise falsch,
- Begriff wird nur von einem einzelnen Anbieter verwendet,
- fachliche Bedeutung bleibt unklar,
- Bezeichnung ist mehrdeutig,
- es gibt möglicherweise einen bereits vorhandenen identischen Eintrag,
- ein Eintrag bezeichnet keine Therapie, Diagnostik oder sinnvolle Versorgungsleistung.

### Mögliche Entscheidungen

- `BEHALTEN`
- `UMBENENNEN`
- `AUFTEILEN`
- `ZUSAMMENFÜHREN`
- `ALIAS`
- `KLÄREN`
- `LÖSCHEN`

Die Entscheidung möglichst in einem klaren Wort kennzeichnen.

---

# Teil H – Versorgungs-, Beratungs- und Selbstmanagementangebote

## 25. Eigenständige Versorgungsangebote

Beratung, Coaching, Sprechstunden, hausärztliche Versorgung und Selbstmanagement dürfen als Treatments bestehen, wenn sie einen eigenständigen Such- oder Bewertungszweck haben.

Ein Eintrag muss nicht gelöscht werden, nur weil er keine einzelne medizinische Intervention bezeichnet.

Mögliche eigenständige Eintragsarten:

- Coaching,
- Ernährungsberatung,
- hausärztliche Behandlung,
- Spezialsprechstunde,
- Schulung,
- Selbstmanagementmaßnahme,
- Versorgungsangebot.

Nur ändern oder löschen, wenn:

- kein klarer Inhalt erkennbar ist,
- mehrere unabhängige Leistungen unsauber vermischt wurden,
- keine sinnvolle Such- oder Bewertungsfunktion besteht,
- der Eintrag lediglich eine einmalige Alltagshandlung beschreibt.

---

# Teil I – Kategorie und Einordnung

## 26. Typ und Unterkategorie

Für jeden neuen Eintrag:

- genau einen bestehenden `typ` verwenden,
- nur eine für diesen Typ bereits verwendete Unterkategorie verwenden,
- keine neue Kategorie spontan anlegen,
- `NULL` nur verwenden, wenn keine Unterkategorie vorgesehen oder fachlich beschlossen ist.

Fehlt eine passende Kategorie, wird dies als Strukturfrage dokumentiert und nicht innerhalb der Einzelrecherche eigenmächtig gelöst.

### Kategorie und Aliasbeziehungen

- `typ` und `unterkategorie` strukturieren,
- Aliasse verbessern die Suche.

Beides nicht doppelt pflegen.

---

# Teil J – Inhaltliche Anreicherung

## 27. Identität und Beschreibung

Für jeden neuen Treatment-Datensatz möglichst erfassen:

| Information | Anforderung |
|---|---|
| Hauptname | Genau ein eindeutiger Name |
| Typ | Bestehender LCN-Wert |
| Unterkategorie | Bestehender zulässiger Wert oder bewusst `NULL` |
| Eintragsart | Wirkstoff, Marke, Verfahren, Diagnostik usw. |
| Aliasse | Mit bestehendem Alias-Typ |
| Kurzbeschreibung | 1–2 sachliche Sätze, maximal etwa 500 Zeichen |
| Quellen | Strukturiert und feldbezogen |
| Prüfdatum | Datum der vollständigen redaktionellen Prüfung |

Die Kurzbeschreibung enthält:

- was der Eintrag ist,
- keine Nutzenbewertung,
- keine Empfehlung,
- keine ausführliche Wirkmechanismus-Erklärung,
- keine Werbeaussage.

---

## 28. Standardisierte Klassifikationen

### ICHI

Nur verwenden, wenn eine belastbare Zuordnung möglich ist.

Erfassen:

- ICHI-Code,
- offizieller Titel,
- Target-Code und Titel,
- Action-Code und Titel,
- Means-Code und Titel,
- Referenzlink.

Keine selbst erfundene Zuordnung.

### ATC

Nur für Arzneimittel oder Wirkstoffe.

Erfassen:

- vollständiger ATC-Code,
- offizielle Bezeichnung,
- bei mehreren Wirkstoffen mehrere Codes.

---

## 29. Zugang und Durchführung

### Zugangs- oder Verschreibungsstatus

Genau einen passenden Wert verwenden:

- frei erhältlich,
- apothekenpflichtig ohne Rezept,
- verschreibungspflichtig oder ärztliche Verordnung erforderlich,
- nur über spezialisierten Anbieter oder Einrichtung zugänglich.

Keine Aussage zum Durchführungsort oder zur Kostenübernahme in diesem Feld.

### Durchführungssetting

Niedrigste regulär notwendige Stufe:

- selbstständig zu Hause,
- zu Hause mit professioneller Unterstützung,
- ambulant in Praxis oder Einrichtung,
- stationär.

### Bezugs- oder Anbieterart

Ein oder mehrere Werte:

- Apotheke,
- Arztpraxis,
- Klinik,
- Physiotherapie oder Ergotherapie,
- Psychotherapie oder Beratung,
- Sanitätshaus,
- Labor oder Diagnostikzentrum,
- Onlinehandel,
- sonstige definierte Anbieterart.

Konkrete Anbieter bleiben in der bestehenden Anbieter- oder Arztverknüpfung.

---

## 30. Kostenübernahme

GKV und PKV getrennt erfassen.

### GKV

- regulär,
- Einzelfall,
- keine reguläre Übernahme.

### PKV

- regulär,
- Einzelfall,
- keine reguläre Übernahme.

Zusätzlich:

- Selbstzahleranteil: ja oder nein,
- kurzer Übernahmehinweis.

Einzelfallentscheidungen niemals als reguläre Kostenübernahme darstellen.

Keine pauschale Leistungszusage formulieren.

---

## 31. Zeit, Häufigkeit und Umfang

### Zeitaufwand pro Anwendung

- Zahl oder Spanne,
- Einheit Minuten oder Stunden,
- bei Einnahme ohne relevanten Aufwand: unter 5 Minuten.

### Häufigkeit

- Zahl plus Intervall,
- beispielsweise `1× täglich`, `3× wöchentlich`, `nach Bedarf`,
- keine unbestimmten Angaben wie `regelmäßig`.

### Typischer Behandlungsumfang

- Zahl oder Spanne,
- Einheit Anwendungen oder Sitzungen,
- bei dauerhafter Anwendung: `dauerhaft`.

### Gesamtdauer des Behandlungszeitraums

- Tage,
- Wochen,
- Monate,
- Jahre,
- oder `dauerhaft`.

Sitzungsdauer und Gesamtdauer nicht vermischen.

### Zeit bis zur wahrgenommenen Wirkung

Primär Nutzerfeld.

Mögliche Form:

- Stunden,
- Tage,
- Wochen,
- Monate,
- keine Wirkung.

Redaktionelle Angaben nur mit klarer Quelle und nicht als Wirkversprechen.

---

## 32. Kosten

### Kosten pro Einheit

Erfassen:

- Betrag oder Spanne,
- klare Bezugsgröße,
- Preisdatum.

Beispiel:

```text
150–250 EUR pro Sitzung, Preisstand 2026-07
```

### Laufende Kosten

Nur wenn regelmäßig wiederkehrend:

- Betrag pro Woche,
- Monat,
- Jahr,
- Preisdatum.

### Typische Gesamtkosten

Nur berechnen, wenn:

- Einzelpreis belastbar,
- typischer Behandlungsumfang belastbar,
- Berechnung nachvollziehbar.

Keine scheinpräzisen Zahlen ohne klare Annahmen.

### Tatsächlich gezahlte Kosten

Nur als Nutzererfahrung:

- Betrag,
- pro Einheit oder gesamt,
- optional Erstattungsanteil.

---

## 33. Nutzererfahrungen

Redaktionelle Informationen und Nutzererfahrungen getrennt behandeln.

Mögliche Nutzerfelder:

- wahrgenommene Wirkung,
- relevante Symptome,
- Crash- oder PEM-Erfahrung,
- tatsächlicher Behandlungsumfang,
- tatsächlich gezahlte Kosten,
- Zeit bis zur wahrgenommenen Wirkung.

### Wahrgenommene Wirkung

Bestehende Skala:

- positiv,
- neutral,
- negativ.

Keine medizinische Wirksamkeit daraus ableiten.

### Relevante Symptome

Nur Werte aus der bestehenden Symptom-Werteliste.

### Crash- oder PEM-Erfahrung

- kein Crash oder PEM,
- leicht,
- mittel,
- stark.

### Tatsächlicher Behandlungsumfang

- Anzahl der Anwendungen oder Sitzungen,
- tatsächlicher Zeitraum.

---

## 34. Umgang mit fehlenden Informationen

Keine schwammigen Platzhalter eintragen.

Wenn eine Information nicht belastbar recherchiert werden kann:

- Feld leer lassen,
- als offene Recherche kennzeichnen,
- keine plausible Antwort erfinden,
- keine Werbeaussage übernehmen,
- keine scheinpräzise Zahl erzeugen.

---

# Teil K – Quellenregeln

## 35. Quellenhierarchie

Möglichst Primärquellen verwenden.

### Arzneimittel

1. Fachinformation,
2. AMIce oder BfArM,
3. EMA oder PEI,
4. WHO oder BfArM ATC,
5. G-BA bei Erstattungs- und Off-Label-Fragen,
6. Hersteller ergänzend.

### Verfahren und Diagnostik

1. Leitlinien,
2. Fachgesellschaften,
3. Universitätskliniken,
4. Fachpublikationen,
5. offizielle Anbieterunterlagen,
6. Herstellerinformationen ergänzend.

### Produkte und Eigennamen

Hersteller- oder Anbieterseiten dürfen zur Identifikation genutzt werden.

Werbeaussagen nicht als unabhängigen Wirksamkeitsnachweis übernehmen.

### Quellenangabe

Für jede Quelle erfassen:

- Titel,
- Organisation,
- URL,
- Abrufdatum,
- welche Felder oder Aussagen damit belegt werden.

Keine pauschale Quellenliste ohne Bezug zu den Angaben.

---

## 36. Bevorzugte Quellen

### Arzneimittel und Zulassung

- BfArM AMIce
- Fachinformationen
- EMA
- PEI

### ATC

- BfArM ATC-Klassifikation
- WHO ATC/DDD

### Off-Label und GKV

- G-BA Arzneimittel-Richtlinie
- G-BA Off-Label-Use
- GKV-Spitzenverband

### Hilfsmittel

- GKV-Hilfsmittelverzeichnis

### Interventionen

- WHO ICHI Browser

---

# Teil L – Ergebnisformat einer Recherche

## 37. Bestandsprüfung

### Vorgeschlagener Hauptname

```text
...
```

### Eintragsart

```text
...
```

### Verwendete Suchbegriffe

```text
...
```

### Gefundene bestehende Einträge

| treat_id | Hauptname | gefundener Alias | Verhältnis | Begründung |
|---:|---|---|---|---|

---

## 38. Namensentscheidung

### Bisherige oder gefundene Bezeichnungen

| Bereich | Bezeichnungen |
|---|---|
| Abkürzungen | |
| Langformen | |
| deutsche Varianten | |
| englische Varianten | |
| Wirkstoffnamen | |
| Handelsnamen | |
| Schreibvarianten | |
| frühere Bezeichnungen | |
| Patient:innenbegriffe | |
| Oberbegriffe | |
| Kombinationsbegriffe | |

### Endgültiger Hauptname

```text
...
```

### Begründung

```text
...
```

---

## 39. Kategorieentscheidung

```text
Typ:
Unterkategorie:
Begründung:
```

Nur bestehende Werte verwenden.

---

## 40. Aliasentscheidung

| Alias | Alias-Typ | Verknüpfungsziel | Begründung oder Note |
|---|---|---|---|

Dabei ausdrücklich prüfen:

- Hauptname als `primary_name`,
- Abkürzung,
- Langform,
- Sprachvariante,
- Schreibvariante,
- früherer Hauptname,
- Handelsname,
- Wirkstoff,
- Oberbegriff,
- Kombinationsbegriff.

---

## 41. Beziehungen

```text
Oberbegriff:
Unterbegriffe:
Wirkstoff:
Handelsnamen:
Arzneimittelklasse:
Kombination:
Bestandteile:
frühere Sammelnamen:
verwandte, aber eigenständige Treatments:
```

---

## 42. Hauptentscheidung

Genau eine Entscheidung auswählen:

- bestehenden Datensatz unverändert verwenden,
- bestehenden Datensatz verwenden und Alias ergänzen,
- bestehenden Datensatz umbenennen,
- bestehende Datensätze zusammenführen,
- neuen eigenständigen Datensatz anlegen,
- neuen Kombinationsdatensatz anlegen,
- bestehenden Sammeldatensatz aufteilen,
- nur Aliasbeziehung ergänzen,
- weitere Recherche erforderlich,
- strukturelle Entscheidung erforderlich,
- löschen.

### Entscheidungskennzeichnung

Zusätzlich möglichst ein klares Kurzlabel verwenden:

- `BEHALTEN`
- `NEU`
- `UMBENENNEN`
- `ALIAS`
- `AUFTEILEN`
- `ZUSAMMENFÜHREN`
- `KLÄREN`
- `LÖSCHEN`

### Begründung

Die Begründung muss erklären:

- fachliche Gleichheit oder Abgrenzung,
- Relevanz für Suche und Detailseite,
- Relevanz für Anbieter- oder Arztzuordnung,
- Relevanz für getrennte Bewertungen,
- Grund für einen eigenen Datensatz oder Alias,
- notwendige Folgeänderungen.

Nicht ausreichend:

- „klingt ähnlich“,
- „scheint dasselbe zu sein“,
- „wird manchmal so genannt“,
- „zur Sicherheit neu anlegen“.

---

# Teil M – Technische Vorbereitung

## 43. Vor einer Neuanlage prüfen

- Hauptname existiert nicht bereits.
- Slug existiert nicht bereits.
- Exakter `primary_name`-Alias existiert oder kann wiederverwendet werden.
- Alias-Texte wurden durchsucht.
- Keine Dublette durch Groß-/Kleinschreibung.
- Keine Dublette durch Umlaute oder Bindestriche.
- Typ und Unterkategorie sind zulässig.
- Wirkstoff- und Markenbeziehungen sind geprüft.
- Oberbegriff-Beziehungen sind geprüft.
- Kombinationen und Bestandteile sind geprüft.

---

## 44. Bei neuen Treatments

Jeder neue Eintrag benötigt mindestens:

- `behandlung`,
- eindeutigen `slug`,
- `typ`,
- zulässige `unterkategorie` oder bewusst `NULL`,
- exakt passenden `primary_name`-Alias,
- mindestens eine belastbare Quelle,
- dokumentierte Dublettenprüfung.

---

## 45. Bei Umbenennungen

Vorher prüfen:

- Namenskollision,
- Slug-Kollision,
- vorhandene Aliasdatensätze,
- Ärzteverknüpfungen,
- Quellenverknüpfungen,
- Symptomverknüpfungen,
- sonstige aktive Treatment-Verknüpfungen.

Nachher:

- neuer Hauptname als `primary_name`,
- alter fachlich sinnvoller Name als `alternate_name`,
- offensichtlich falsche Schreibfehler nicht erhalten,
- bestehende Verknüpfungen kontrollieren.

---

## 46. Bei Zusammenführungen

Vor dem Löschen eines Treatments prüfen:

- Ärzteverknüpfungen,
- Quellenverknüpfungen,
- Symptomverknüpfungen,
- Aliasverknüpfungen,
- Rohdaten- oder Wiki-Verknüpfungen,
- weitere Tabellen mit `treat_id`,
- mögliche doppelte Zielverknüpfungen.

Frühere Hauptnamen, Abkürzungen, Schreibweisen und Sprachvarianten als sinnvolle Aliasse erhalten.

---

## 47. Bei Löschungen

Nur löschen, wenn kein eigenständiges:

- Treatment,
- Diagnostikangebot,
- Produkt,
- Versorgungsangebot,
- Beratungsangebot,
- Selbstmanagementangebot
- oder sinnvoller Sucheinstieg

vorliegt.

Vorher alle Verknüpfungen prüfen.

Nachher:

- verwaiste Aliasdatensätze kontrollieren,
- sinnvolle alte Namen neu verknüpfen,
- wertlose verwaiste Aliasse löschen,
- keine Aliasdatensätze pauschal entfernen.

---

# Teil N – Abschlusskontrolle je Rechercheblock

## 48. Fachliche Abschlusskontrolle

- Hauptname ist eindeutig.
- Hauptname ist korrekt geschrieben.
- Deutsche und englische Varianten wurden geprüft.
- Abkürzung und Langform wurden geprüft.
- Wirkstoff und Marke wurden geprüft.
- Ober- und Unterbegriffe wurden geprüft.
- Kombinationen und Bestandteile wurden geprüft.
- Ähnliche Einträge wurden fachlich abgegrenzt.
- Typ und Unterkategorie sind zulässig.
- Alle Aliasse haben einen bestehenden Alias-Typ.
- Folgeänderungen sind dokumentiert.

---

## 49. Technische Abschlusskontrolle

Nach Änderungen prüfen:

- keine doppelten Hauptnamen,
- keine doppelten Slugs,
- jedes Treatment hat einen exakt passenden `primary_name`-Alias,
- keine doppelten Treatment-Alias-Verknüpfungen,
- keine Verknüpfungen zu gelöschten Treatments,
- keine Verknüpfungen zu nicht vorhandenen Alias-IDs,
- verwaiste Aliasse geprüft,
- frühere Sammelnamen sinnvoll verknüpft,
- unzulässige `/`, `+` und `&` geprüft,
- Kategorien und Unterkategorien auf Ausreißer geprüft.

### Zulässige Sonderfälle

- `NAD⁺` enthält ein chemisches Pluszeichen und ist keine unsaubere Kombination.
- Feste Fachbezeichnungen wie `VQ-SPECT/CT` dürfen Schrägstriche enthalten.
- Ein Treatment kann mehrere global als `primary_name` typisierte Aliasse erhalten, wenn diese Begriffe Hauptnamen anderer Treatments und als Oberbegriffe zusätzlich verknüpft sind.
- Entscheidend ist, dass jedes Treatment mindestens einen exakt passenden eigenen `primary_name`-Alias besitzt.

---

# Teil O – Kompakte Pflichtausgabe für neue Treatments

## 50. Kurzformat

```text
Vorgeschlagener Hauptname:
Eintragsart:
Typ:
Unterkategorie:

Bestandsprüfung:
- vorhandene Hauptnamen:
- vorhandene Aliasse:
- ähnliche Treatments:
- Wirkstoff/Marken:
- Oberbegriffe:
- Kombinationen:

Entscheidung:
BEHALTEN | NEU | UMBENENNEN | ALIAS | AUFTEILEN | ZUSAMMENFÜHREN | KLÄREN | LÖSCHEN

Endgültiger Hauptname:

Aliasse:
- Alias | Alias-Typ | Ziel | Begründung

Beziehungen:
- Wirkstoff:
- Marken:
- Oberbegriff:
- Unterbegriffe:
- Kombination:
- Bestandteile:

Typ/Unterkategorie-Begründung:

Quellen:

Offene Recherche:

Notwendige Folgeänderungen:
```

---

# Teil P – Verbindliche Leitregel

Neue Treatments sollen nicht nur inhaltlich richtig recherchiert werden.

Bereits bei der Extraktion müssen gleichzeitig berücksichtigt werden:

- Dubletten,
- Namenslogik,
- Abkürzungen,
- deutsche und englische Varianten,
- Wirkstoff- und Markenbeziehungen,
- Kombinationen und Einzelbestandteile,
- Oberbegriffe und Unterbegriffe,
- Alias-Typen,
- bestehende Kategorien,
- getrennte Bewertbarkeit,
- Ärzte- und Quellenverknüpfungen,
- spätere Suchbarkeit.

Bei Unsicherheit nicht vorschnell neu anlegen.

Im Zweifel:

1. Bestand prüfen,
2. Beziehung bestimmen,
3. fachlich abgrenzen,
4. offene Frage markieren,
5. erst danach Änderung oder Neuanlage vorschlagen.