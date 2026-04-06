# Doctor ↔ Treatment Mapping Rules (LCN)

Status: Review
Version: 0.2

## Ziel
Dieses Regelwerk definiert den verbindlichen Standard für die Recherche, Bewertung,
Speicherung und spätere Konsolidierung von Doctor↔Treatment-Zuordnungen im Long Covid Navigator.

## Kernregel für Kopplungen
Eine Kopplung zwischen Arzt/Ärztin und Behandlung darf **nur** angelegt werden, wenn aus der
bearbeiteten Quelle hinreichend klar hervorgeht, dass die Behandlung tatsächlich durchgeführt,
angeboten, verschrieben, verabreicht oder praktisch eingesetzt wird.

Nicht ausreichend für eine Kopplung sind insbesondere:
- bloße Erwähnung
- allgemeine Information
- theoretische Expertise
- Interview-/Vortragskontext ohne Praxisbezug
- vermutete Ableitung ohne klaren Beleg

Wichtig:
- Diagnostik, supportive Maßnahmen, lifestylebezogene Maßnahmen und haushalts-/umfeldbezogene
  Maßnahmen können im Behandlungsspektrum mitgeführt werden.
- Maßgeblich bleibt aber auch dort immer der konkrete Praxisbezug in der Quelle.
- Reine allgemeine Beratung ohne hinreichend konkrete Maßnahme erzeugt nicht automatisch
  eine belastbare Kopplung.

### Konkretheitsregel für Einträge
Für die operative Batch-Datei sollen nur solche Einträge als eigene Zeile geführt werden,
die hinreichend konkret sind.

Beibehalten werden insbesondere:
- konkrete Untersuchungen
- konkrete diagnostische Maßnahmen
- konkrete therapeutische Maßnahmen
- konkrete supportive Maßnahmen
- konkrete lifestylebezogene Maßnahmen
- konkrete haushalts-/umfeldbezogene Maßnahmen

Nicht als eigener Eintrag geführt werden insbesondere:
- reine allgemeine Anamnesebegriffe
- reine allgemeine Beratungsbegriffe ohne konkrete Maßnahme
- reine Oberüberschriften ohne klaren Einzelbezug
- reine Grenzwerte, Schwellenwerte oder Kriterienbeschreibungen
- reine Disclaimer-Texte

Beispielhafte Anwendung:
- `EKG` oder `10 Min. passiver Stehtest` sind hinreichend konkrete Einträge
- `Eingehende Anamnese` ist ohne weitere Konkretisierung kein eigener Eintrag
- 
## Arbeitsprinzipien
- Keine Rateschlüsse.
- Unsichere Fälle bleiben offen und werden nicht in die finale Koppellogik übernommen.
- Ziel ist eine sehr hohe Trefferqualität; wenige Fehler sind tolerierbar, aber Schätzungen
  sind nicht zulässig.
- Der Prozess ist quellenbasiert, iterativ und speicherbar.
- Jede Quelle bzw. jeder Batch erhält eine eigene Arbeitsdatei.
- Fachliche Extraktion, technisches Matching und Import bleiben getrennte Arbeitsschritte.
- IDs und Bearbeitungsstatus sind getrennt zu führen.
- Die Batch-Datei ist nicht nur Extraktionsdatei, sondern auch Review-Artefakt.

## Bewertungslogik
### evidence_strength
- `high` = Quelle sagt klar, dass die Behandlung / Maßnahme durchgeführt, angeboten,
  verschrieben, verabreicht oder praktisch eingesetzt wird
- `medium` = sehr starker Hinweis auf praktische Durchführung, aber sprachlich etwas indirekter
- `low` wird im operativen Batch-Standard nicht verwendet

Regel:
- Für aufgenommene Batch-Einträge sind nur `high` und `medium` zulässig.
- Fälle unterhalb dieser Schwelle werden nicht als belastbare Kopplung geführt.

## Entscheidungslogik
Die operative Batch-Datei bildet zwei verschiedene Arbeitsschritte ab:
- fachliches Matching Dr2T
- technisches ID-Mapping

Deshalb werden Review-Bedarfe getrennt geführt.

### decision
- `1` = final include
- `0` = final exclude
- leer / `NULL` = noch nicht final entschieden

Grundprinzipien:
- `decision` wird im Regelfall erst spät gesetzt, meist nach fachlicher Bereinigung und technischem Matching.
- Frühere Setzung ist zulässig, wenn ein Fall bereits belastbar entschieden ist.
- Am Ende eines sauber abgeschlossenen Batches sollen alle Einträge `decision = 0` oder `decision = 1` haben.
- Ein leerer `decision`-Wert ist nur ein Zwischenzustand und signalisiert unvollständige Bearbeitung.

### review_mapping
- `0` = kein fachliches Review nötig
- `1` = fachliches Review durch den Nutzer nötig

### review_mapping_notes
- Begründung für fachlichen Review-Bedarf
- nur befüllen, wenn `review_mapping = 1`

### review_matching
- `0` = kein technisches Matching-Review nötig
- `1` = technisches Matching-Review durch den Nutzer nötig

### review_matching_notes
- Begründung für technischen Matching-Review-Bedarf
- nur befüllen, wenn `review_matching = 1`

### Zusammenspiel von decision und Review-Feldern
- Solange ein Eintrag noch Review-Bedarf hat, können `review_mapping` und/oder `review_matching` auf `1` stehen.
- Wenn eine Review-Frage geklärt wurde, wird das jeweilige Review-Feld aktiv auf `0` gesetzt.
- Wenn `decision = 0` oder `decision = 1` gesetzt wird, sollen `review_mapping` und `review_matching` auf `0` stehen.
- Ein Eintrag mit gesetztem `decision` und gleichzeitig offenem Review-Feld (`=1`) gilt als inkonsistent und muss erneut geprüft werden.

Wichtige Klarstellung:
- Ein Review führt nicht immer direkt zu einer finalen Aufnahmeentscheidung.
- Ein Mapping-Review kann ergeben: aufnehmen, nicht aufnehmen oder weiterbearbeiten.
- Ein Matching-Review klärt primär die technische Zuordnung und führt nicht automatisch zu einer finalen Include-Entscheidung.

Zusatzregel:
- `decision = 0` wird im nachgelagerten technischen Matching und Import nicht weiterverarbeitet.
- Offene Fälle bleiben sichtbar in der Batch-Datei und werden nicht stillschweigend entfernt.

### Zusatzregel für Backlog und Alias-Pflege
- Offene technische Matching-Fälle bleiben sichtbar in der Batch-Datei und werden nicht
  stillschweigend entfernt.
- Fehlende Alias-Zuordnungen und sinnvolle Alias-Ergänzungen sollen sichtbar im Matching File
  bzw. im Backlog geführt werden.
- Alias-Backlog-Felder dienen nur für sinnvolle, konkret begründbare Alias-Ergänzungen und
  nicht als allgemeines Notizfeld.
- Bereits gematchte Fälle mit sinnvoller Alias-Ergänzung sollen nach Möglichkeit mit
  `alias_name` und `alias_type` dokumentiert werden.

## recommendation_type
Das Feld `recommendation_type` wird in der Batch-Datei sichtbar geführt und dient weiterhin der
fachlich nachvollziehbaren Einordnung, **was für eine Art Treatment / Maßnahme** der jeweilige
Eintrag beschreibt.

Wichtig:
- Das Feld bleibt Bestandteil der operativen Datei.

### Grundsatz
`recommendation_type` soll aus der **Treatment-Typisierung** befüllt werden, wie sie
in der Datenbank über `tbl_treatments_03.typ` geführt wird.

Das bedeutet:
- Die Einordnung beschreibt die **Art des Treatments / der Maßnahme**.
- Es soll **keine freie Parallel-Terminologie** neben den bereits etablierten Typen entstehen.
- Primär sollen die **bereits vorhandenen Werte aus `tbl_treatments_03.typ`** verwendet werden.

### Zulässige Werte
- Standard sind die bereits in `tbl_treatments_03.typ` vorhandenen Einträge.
- Diese bilden die primäre Referenz für die Befüllung von `recommendation_type`.
- Neue Werte sind grundsätzlich möglich, sollen aber **nicht eigenständig eingeführt** werden.
- Wenn ein neuer Wert fachlich sinnvoll erscheint, ist dies **vorher mit dem Nutzer abzustimmen**.

Aktuell vorhandene Werte in `tbl_treatments_03.typ` sind insbesondere:
- `Behandlung`
- `Diagnose`
- `Diätmaßnahme`
- `Elementares Hilfsmittel`
- `experimenteller Wirkstoff / Aptamer`
- `Gerät/Prozedur`
- `Hausmittel`
- `Hilfsmittel`
- `Infusion`
- `Infusion/Immuntherapie`
- `Kombination`
- `Komplementärer Ansatz`
- `Lifestyleanpassung`
- `Lokaltherapie`
- `Lokaltherapie / Antiseptikum`
- `Maßnahme`
- `Maßnahme/Drink`
- `Medikament`
- `Medikament / experimenteller Versuch`
- `Medikament / Injektion`
- `Medikament / komplementärer Ansatz`
- `Medikament / lokal`
- `Medikament/Biologikum`
- `Medikamentenklasse`
- `Medikamentenkombi`

### Operative Regel
- Bei bereits bekannten oder gematchten Treatments soll sich `recommendation_type` an dem
  vorhandenen Typ-Eintrag orientieren.
- Bei noch offenen oder noch nicht gematchten Fällen soll nach Möglichkeit ein bereits
  vorhandener Typ verwendet werden, sofern dieser fachlich sauber passt.
- Es sollen **nicht vorschnell neue Begriffe oder Sammelkategorien** eingeführt werden.
- Wenn keine belastbare Zuordnung zu einem vorhandenen Typ möglich ist, bleibt der Fall offen
  und wird zur Abstimmung markiert.

### Ziel
Diese Regel dient dazu, dass:
- lokale Batch-Dateien und Datenbank fachlich konsistent bleiben,
- dieselbe Maßnahme nicht mit wechselnder Terminologie beschrieben wird,
- und neue Typen nur kontrolliert und bewusst ergänzt werden.

## Abgrenzung von Diagnostik, Behandlung und Empfehlung
Für die fachliche Einordnung gilt:
- Diagnostik wird im LCN-Kontext mit gesammelt und kann unter Behandlungen mitgeführt werden.
- Supportive, lifestylebezogene und haushaltsbezogene Maßnahmen werden ebenfalls mit gesammelt
  und nicht stillschweigend ausgeschlossen.
- Die fachliche Kategorie muss möglichst sichtbar sein.
- Maßgeblich bleibt immer der konkrete Praxisbezug in der Quelle.
- Bloße allgemeine Beratung ohne hinreichend konkrete Maßnahme oder Anwendung reicht nicht aus.

## Sortierung innerhalb eines Arztes
### sort_order
Optionales Feld für Reihenfolge / Bekanntheit / Relevanz einer Behandlung innerhalb des
Behandlungsspektrums eines Arztes.

Wenn keine belastbare Reihenfolge vorliegt, bleibt das Feld leer.

## Fortschrittslogik
Der Fortschritt der Quellenbearbeitung wird in `source_processing_plan.csv` gepflegt,
nicht über lose Chat-Notizen.

Die fachliche Arbeitsgrundlage je Quelle ist die operative Batch-Datei.

## Dateiprinzip
- Ein zentrales Regelwerk in Markdown
- Eine Quellen-Masterdatei zur Steuerung und Statuspflege (`source_processing_plan.csv`)
- Eine operative Batch-Datei pro Quelle / Batch
- Als operative Vorlage dient aktuell `mapping_drs2treat_master.csv`
- Technisches Matching ergänzt die Batch-Datei um Matching-Felder
- Spätere Konsolidierung der Batch-Dateien in einen separaten Konsolidierungsstand ohne Dubletten

## Expertencheck vor neuer Quelle
Bevor das Regelwerk auf eine neue Quelle angewendet wird, ist kurz zu prüfen:
- Soll dieses Regelwerk für die Quelle voll angewendet werden?
- Gibt es für diese Quelle eine bewusst vereinfachte Arbeitsweise?
- Gibt es quellenbezogene Sonderregeln, die vor dem operativen Chat festgehalten werden sollen?

Beispiel:
- Bei einer Quelle wie Stingl kann entschieden werden, dass nahezu alles aufgenommen wird,
  außer klar negativen oder eindeutig nicht belastbaren Fällen.
- Solche Vereinfachungen dürfen verwendet werden, müssen aber vorab explizit entschieden
  und für die Quelle dokumentiert werden.


## Unterschiedliche Arbeitsansichten für Mapping und Matching
Mapping-File und Matching-File dürfen unterschiedliche Spaltenreihenfolgen haben,
wenn dies der operativen Prüfung dient.

Grundprinzipien:
- Die inhaltlichen Kernfelder bleiben konsistent.
- Die Reihenfolge darf an den jeweiligen Arbeitsschritt angepasst werden.
- Im Mapping stehen fachliche Prüfung, Evidenz und recommendation_type stärker im Vordergrund.
- Im Matching stehen technische Zuordnung, IDs, Match-Status, Match-Notes und Alias-Backlog stärker im Vordergrund.

Wichtig:
- Unterschiedliche Spaltenreihenfolgen sind zulässig.
- Werte dürfen dabei nicht verschoben oder semantisch verändert werden.
- Maßgeblich bleibt die Feldbedeutung, nicht die starre Position.

### Zusatzregel für Webseiten: Kontextvererbung über relevante Versorgungsabschnitte
Wenn auf einer Arztwebsite konkrete diagnostische, therapeutische oder supportive Maßnahmen
innerhalb eines klar krankheits- oder versorgungsbezogenen Abschnitts oder einer klar
krankheitsbezogenen Unterseite genannt werden, darf der Kontext dieser Überschrift / Unterseite
auf die darunter aufgeführten konkreten Einzelmaßnahmen übertragen werden.

Dies gilt nicht nur für fest benannte LCN-Kernbegriffe wie Long Covid, Post Covid, ME/CFS,
POTS oder MCAS, sondern auch für eng verwandte Kontexte, sofern der Zusammenhang im
konkreten Website-Kontext erkennbar ist.

Voraussetzungen:
- der Abschnitt oder die Unterseite ist der Versorgung, Behandlung, Diagnostik oder Sprechstunde
  klar zugeordnet
- der Kontext ist für den LCN-Arbeitskontext relevant oder eng verwandt
- die Unterpunkte sind hinreichend konkret
- es handelt sich nicht nur um allgemeine Information, reine Theorie oder allgemeines
  Leistungsspektrum ohne solchen Kontext

Wenn eine Website in einem klar krankheits- oder versorgungsbezogenen Abschnitt bzw. auf einer klar krankheitsbezogenen Unterseite konkrete Therapieformen, Therapierichtungen, Behandlungsverfahren oder supportiv-integrative Maßnahmen als Teil der tatsächlichen Versorgung aufführt, dürfen diese auch dann als eigene 4.1-Zeilen aufgenommen werden, wenn sie begrifflich breiter sind als klassische Einzelmaßnahmen.
Voraussetzung ist, dass aus dem Seitenkontext hervorgeht, dass sie praktisch angeboten bzw. eingesetzt werden und nicht nur allgemein erläutert werden.