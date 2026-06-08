# Fasynation Matching-Regelwerk (LCN)

Status: Arbeitsfassung  
Version: 1.0

## Ziel
Dieses Dokument hält die aktuell beschlossenen Sonderregeln für das Doctor↔Treatment-Matching der Quelle **Fasynation** fest.

Es ergänzt das allgemeine Regelwerk für den LCN-Workflow um quellenbezogene Entscheidungen, damit spätere Matching-Chats konsistent, nachvollziehbar und mit möglichst wenig Fehlzuordnungen arbeiten.

---

## 1. Grundsatz für Fasynation
Für Fasynation gilt ein **eher aufnahmeorientierter Modus mit kontrollierter Plausibilität**.

Das bedeutet:
- Wir wollen eher **viel aufnehmen** als zu früh zu verwerfen.
- Trotzdem gilt weiterhin: **keine Rateschlüsse**.
- Eine bloße Erwähnung ohne sinnvollen Anbieterbezug reicht nicht.
- Patienten dürfen **nicht** als Anbieter modelliert werden.

---

## 2. Anbieterbegriff für Fasynation
Der Anbieterbegriff wird für Fasynation **bewusst weiter gefasst**.

Als Anbieter zählen insbesondere:
- Ärztinnen und Ärzte
- Therapeutinnen und Therapeuten
- Heilpraktikerinnen und Heilpraktiker
- Praxen / Kliniken / Institute
- Coaches
- Coaching-Anbieter
- sonstige Anbieter mit erkennbarem Interventions-, Therapie-, Beratungs-, Kurs- oder Programmangebot

### Nicht als Anbieter zählen
- Patienten
- Betroffene
- Kommentierende
- Community-Mitglieder
- reine Erfahrungsbericht-Erzähler ohne eigenes Angebotsprofil

Wichtig:
- **Patienten dürfen über Anbieter sprechen.**
- Solche Aussagen können als Evidenz für einen Anbieter relevant sein.
- Der Patient selbst wird dabei **nie** als Anbieter geführt.

---

## 3. Positivregel: Wann ein Match aufgenommen wird
Ein Match wird aufgenommen, wenn aus der Quelle hinreichend klar hervorgeht, dass ein Anbieter mit einer Maßnahme praktisch verbunden ist.

Das ist insbesondere der Fall, wenn der Anbieter die Maßnahme:
- durchführt
- anbietet
- anwendet
- einsetzt
- verordnet
- verschreibt
- empfiehlt als wiederkehrenden Teil seines Vorgehens
- als eigenes Coaching / Programm / Kurs / Begleitformat anbietet

Für Fasynation gilt dabei:
- Wenn der praktische Bezug plausibel und textlich ausreichend erkennbar ist, soll **eher aufgenommen** werden.
- Es braucht **keinen überstrengen Beweismaßstab**.
- Es dürfen auch breitere, interventionsnahe Begriffe aufgenommen werden, wenn der Anbieterbezug erkennbar ist.

---

## 4. Oberbegriffe und breitere Maßnahmen
Für Fasynation werden **reine Oberbegriffe nicht pauschal ausgeschlossen**.

Sie dürfen aufgenommen werden, wenn sie:
1. interventionsnah sind und
2. im Text erkennbar einem Anbieter praktisch zugeordnet werden können.

Beispiele möglicher aufnehmbarer Oberbegriffe:
- Pacing
- Coaching
- Atemtherapie
- Nervensystem-Regulation
- Entgiftung
- Mitochondrientherapie

Nicht aufnehmen:
- reine Zustandsbegriffe
- reine Ursachenbegriffe ohne Maßnahmencharakter
- reine Theoriekonzepte ohne Anbieterbezug
- reine Krankheitsmechanismen ohne Interventionsbezug

---

## 5. Was nicht ausreicht
Kein Match, wenn nur Folgendes vorliegt:
- allgemeine Krankheitserklärung ohne Anbieterbezug
- reine Theorie / Pathomechanismus / Ursachenmodell
- bloße Nennung eines Wirkstoffs, Verfahrens oder Tests ohne Anbieterbezug
- reine Patienten-Selbstaussage ohne Anbieterbezug
- reine Frage in Kommentaren
- reine Community-Diskussion ohne identifizierbaren Anbieter
- bloße Erwähnung einer Maßnahme ohne praktischen Bezug zu einem Anbieter

Kurzregel:
- **Maßnahme + Anbieterbezug = eher aufnehmbar**
- **Maßnahme ohne Anbieterbezug = nicht aufnehmbar**

---

## 6. Umgang mit Fasynation-spezifischen Quelltypen

### 6.1 Blogartikel / Übersichtsartikel
Aufnehmen, wenn ein Anbieter mit einer konkreten oder interventionsnahen Maßnahme praktisch verbunden wird.

Nicht aufnehmen, wenn der Text nur allgemein informiert und kein belastbarer Anbieterbezug erkennbar ist.

### 6.2 Interviews / Podcast-Verschriftlichungen / Transkripte
Aufnehmen, wenn aus dem Text hervorgeht, dass der Anbieter die Maßnahme selbst nutzt, anbietet, einsetzt oder als Teil seines Vorgehens vertritt.

Nicht automatisch alles aufnehmen, nur weil ein Experte darüber spricht.

### 6.3 Coaching / Programme / Kurse
Coaches und Coachings sollen ausdrücklich **mit hinein**.

Wenn ein Coach oder Anbieter ein konkretes Coaching-, Kurs-, Retraining-, Regulations-, Atem-, Meditations- oder Begleitprogramm anbietet, kann dies als Match aufgenommen werden.

### 6.4 Patientenkommentare
Kommentare dürfen als Evidenz genutzt werden, **wenn sie über einen Anbieter sprechen** und dabei eine konkrete oder interventionsnahe Maßnahme benennen.

Kommentare sind nicht verwertbar, wenn sie nur enthalten:
- Eigenbehandlung
- allgemeine Meinung
- bloße Frage
- unspezifische Erfahrung ohne Anbieterbezug

---

## 7. Diagnostik, Behandlung, supportive Maßnahmen
Für Fasynation dürfen mitgeführt werden:
- Diagnostik
- Behandlung
- supportive Maßnahmen
- Lifestyle-Maßnahmen
- Coaching / Programme / Kurse
- haushalts- und umfeldbezogene Maßnahmen

Voraussetzung bleibt immer:
- der Eintrag ist hinreichend konkret oder interventionsnah
- und einem Anbieter praktisch zugeordnet

---

## 8. Konservative Mindestgrenze
Trotz breiter Aufnahme gilt weiterhin:

**Wenn unklar bleibt, ob überhaupt ein Anbieterbezug vorliegt, dann kein Match.**

Die Erweiterung betrifft also den Anbieterbegriff und die Aufnahmebreite, **nicht** die Erlaubnis zum Raten.

---

## 9. Entscheidungslogik

### decision
- `1` = aufnehmen
- `0` = nicht aufnehmen
- leer / `NULL` = offen

### Include-Regel
`decision = 1`, wenn vorliegt:
- Anbieter vorhanden
- Maßnahme oder interventionsnaher Oberbegriff vorhanden
- praktischer Angebots-, Anwendungs- oder Erfahrungsbezug vorhanden

### Exclude-Regel
`decision = 0`, wenn vorliegt:
- kein Anbieterbezug
- nur Patient ohne Anbieterbezug
- nur Theorie / allgemeine Information
- nur Zustands- oder Ursachenbegriff ohne Maßnahmencharakter

### Offen-Regel
leer / `NULL`, wenn:
- Anbieterbezug nicht sauber entscheidbar
- Maßnahme zu unscharf
- Quelle widersprüchlich oder mehrdeutig

---

## 10. Review-Felder: kurz und standardisiert
Für Fasynation sollen `review_mapping_notes` und `review_matching_notes` **kurz, standardisiert und systematisch auswertbar** bleiben.

Keine langen Freitexte, außer wenn unbedingt nötig.

### Standardwerte für `review_mapping_notes`
- `anbieter unklar`
- `maßnahme zu allgemein`
- `praxisbezug unklar`
- `patient statt anbieter`
- `kommentar nur eigenbericht`
- `mehrdeutiger anbieter`
- `grenzfall coaching`
- `grenzfall diagnostik`
- `bezug nur theorie`
- `duplikatverdacht`

### Standardwerte für `review_matching_notes`
- `treatment unklar`
- `alias fehlt`
- `mehrdeutiges matching`
- `kein db-treffer`
- `mehrere mögliche treats`
- `normalisierung prüfen`

---

## 11. Empfehlung für review_mapping
`review_mapping = 1`, wenn die fachliche Kopplung noch nicht sauber entschieden werden kann.

Typische Fälle:
- Anbieter nicht sauber identifizierbar
- Kommentar spricht über Anbieter, aber Belastbarkeit unklar
- Maßnahme zu unscharf
- unklar, ob eigenes Angebot oder bloße Erwähnung
- unklarer Coaching-/Programmfall

Sonst:
- `review_mapping = 0`

---

## 12. Empfehlung für evidence_strength
- `high` = klarer praktischer Anbieterbezug
- `medium` = deutlicher, aber indirekterer Bezug
- `low` wird nicht verwendet

---

## 13. Operative Kurzregel
**Fasynation-Match ja, wenn:**
- konkrete oder interventionsnahe Maßnahme
- konkreter Anbieter
- praktischer Angebots-, Anwendungs- oder Erfahrungsbezug

**Fasynation-Match nein, wenn:**
- nur Patient
- nur Theorie
- nur allgemeine Information
- nur Kommentar ohne Anbieterbezug
- nur bloße Erwähnung

---

## 14. Verhältnis zum allgemeinen Regelwerk
Dieses Dokument ergänzt das allgemeine LCN-Regelwerk für die Quelle Fasynation.

Es überschreibt für Fasynation insbesondere folgende Standardannahmen:
- Anbieterbegriff wird weiter gefasst
- Coaches / Coachings werden ausdrücklich mitgeführt
- interventionsnahe Oberbegriffe dürfen aufgenommen werden
- Patienten dürfen Evidenz über Anbieter liefern, sind aber selbst nie Anbieter

Alle übrigen allgemeinen Workflow- und Matching-Regeln bleiben bestehen.
