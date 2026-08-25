# LCN Datenbank-Zielschema v0.1

Stand: 2026-08-25

## Zweck

Dieses Dokument beschreibt das erste bereinigte Zielschema für `LCN_DUMMY`. Es basiert auf:

- dem vollständigen BETA-Dump vom 24.08.2026,
- dem aktuellen API-/Cron-Code vom 25.08.2026,
- den bereits vorgesehenen Bereichen Symptome und Quellen.

`LCN_DUMMY` ist eine Fixture- und Referenzdatenbank. Änderungen an BETA/TEST sind daraus **nicht automatisch abzuleiten**; eine spätere Übernahme erfolgt ausschließlich über eigene, geprüfte Migrationen.

## Grundregeln

1. API-kompatible Tabellen- und Spaltennamen bleiben bestehen.
2. Nur Tabellen, die aktuell vom PHP-Code benötigt werden oder fachlich bereits als nächster Datenbereich vorgesehen sind, gehören in das DUMMY-Template.
3. IDs in Eltern- und Kindtabellen verwenden kompatible Datentypen.
4. Eindeutige Beziehungen werden durch Foreign Keys abgesichert.
5. Reine Kopplungstabellen löschen ihre Beziehungen bei Löschung eines Elternobjekts per `ON DELETE CASCADE`.
6. Optionale Quellenverweise werden bei Löschung der Quelle auf `NULL` gesetzt.
7. Import-/Kompatibilitätstabellen bleiben nur erhalten, solange die aktuelle API sie benötigt.
8. Neue fachliche Felder werden nicht erfunden, solange API/Feature-Modell nicht festgelegt ist.
9. Alle DUMMY-Stammdaten sind eindeutig als Testdaten erkennbar.
10. DUMMY wird niemals automatisch aus BETA überschrieben.

## Tabellen im DUMMY-Template

### Ärzte / Praxen

- `tbl_drs_03`
- `tbl_drs_locations_03`
- `tbl_terms_03`
- `tbl_sources_03`
- `tbl_cpl_drs2terms_03`
- `tbl_cpl_drs2treatments_03`
- `tbl_drs_votes_03`
- `doctor_votes`
- `lcn_raw_doctor_votes` — vorläufige Kompatibilitätsschicht

### Behandlungen

- `tbl_treatments_03`
- `tbl_aliases_03`
- `tbl_cpl_treatments2aliases_03`
- `tbl_treatments_sources_03`
- `tbl_cpl_treatments2sources_03`
- `treatment_votes`
- `lcn_votes` — vorläufige Kompatibilitätsschicht
- `lcn_raw_votes` — vorläufige Kompatibilitätsschicht

### Symptome / vorbereitetes Zielschema

- `tbl_symptoms`
- `tbl_cpl_treatments2sym_03`

Diese Tabellen werden aktuell von den geprüften Such-/Detail-APIs noch nicht ausgelesen, sind aber fachlich bereits vorgesehen und bleiben Bestandteil des Zielschema-Templates.

### Community

- `community_submissions`
- `community_submission_votes`
- `submission_notification_runs`

### Voting / Missbrauchsschutz

- `vote_abuse_events`
- `vote_monitoring_runs`
- `vote_request_events`
- `vote_source_blocks`

## Nicht in v0.1 übernommen

Folgende Tabellen werden weder vom geprüften API-/Cron-Code benötigt noch für das bereits festgelegte nächste Zielschema benötigt:

- `lcn_import_treatments_market`
- `lcn_raw_wiki`
- `tbl_cpl_drs2sym`
- `tbl_cpl_drs2terms_02`
- `tbl_cpl_drs2treatments`
- `tbl_cpl_sym2treatments`
- `tbl_drs`
- `tbl_drs_02`
- `tbl_drs_locations_02`
- `tbl_drs_sources_02`
- `tbl_drs_sources_03`
- `tbl_drs_votes_02`
- `tbl_sources`
- `tbl_symptoms_backup_premerge_20260824`
- `tbl_terms_02`
- `tbl_treatments`
- `tbl_treatment_aliases_03`

`tbl_schema_migrations` wird nicht aus dem Altbestand kopiert. Eine spätere echte Migrationsstrategie soll neu und bewusst aufgebaut werden.

## Schema-Bereinigungen in DUMMY v0.1

### Referentielle Integrität

Neu bzw. konsequent abgesichert:

- Standort → Arzt
- Arzt-Term-Zuordnung → Arzt
- Arzt-Term-Zuordnung → Term
- Arzt-Term-Zuordnung → Quelle
- Arzt-Behandlung-Zuordnung → Arzt
- Arzt-Behandlung-Zuordnung → Behandlung
- aggregierte Arztvotes → Arzt
- individuelle Arztvotes → Arzt
- Treatment-Alias-Zuordnung → Treatment/Alias
- Treatment-Quellen-Zuordnung → Treatment/Quelle
- Treatment-Symptom-Zuordnung → Treatment/Symptom
- individuelle Treatment-Votes → Treatment
- Community-Votes → Community-Submission
- Vote-Block → Abuse-Event

### ID-Typen

- `tbl_cpl_drs2treatments_03.dr_id` wird auf `BIGINT UNSIGNED` vereinheitlicht.
- `lcn_raw_doctor_votes.dr_id` wird auf `BIGINT UNSIGNED` vereinheitlicht.
- `tbl_symptoms.sym_id` wird auf `INT UNSIGNED` vereinheitlicht, passend zur Kopplungstabelle.

### Löschregeln

- abhängige Standorte, Zuordnungen und Votes: `ON DELETE CASCADE`
- optionaler Source-Verweis bei Arzt-Term: `ON DELETE SET NULL`
- Abuse-Event-Verweise in Votes/Blocks: `ON DELETE SET NULL`

### Zusätzliche Checks / Indizes

- `dr_is_dr` nur 0/1
- `loc_is_primary` nur 0/1
- Latitude: -90 bis 90
- Longitude: -180 bis 180
- Symptom-Index auf Kategorie und Name
- Tabellenstandard: `utf8mb4_unicode_ci`; Hash-/Key-Felder behalten bei Bedarf `ascii_bin`

## Bewusst verbleibende Kompatibilitätsschichten

Die aktuelle API nutzt parallel historische/aggregierte Votes. Deshalb bleiben zunächst:

- `lcn_raw_doctor_votes`
- `tbl_drs_votes_03`
- `lcn_raw_votes`
- `lcn_votes`

Sie werden im DUMMY-Template unterstützt, aber nicht als langfristiges Idealmodell betrachtet. Eine spätere Bereinigung erfordert eine separate API-/Migrationsentscheidung.

## Polymorphe Beziehungen ohne klassischen Foreign Key

Einige Tabellen speichern je nach `entity_type` bzw. `target_type` entweder Arzt- oder Treatment-IDs. Ein normaler SQL-Foreign-Key kann darauf nicht korrekt zeigen. Das betrifft insbesondere:

- `community_submissions.existing_target_id`
- `community_submissions.duplicate_target_id`
- `community_submissions.approved_target_id`
- `community_submission_votes.migrated_target_id`
- `vote_abuse_events.target_id`
- `vote_request_events.target_id`

Diese bleiben in v0.1 bewusst ohne falschen Foreign Key.

## Noch nicht modellierte Arzt-Features

Im aktuellen API-/DB-Modell fehlen weiterhin eigenständige Strukturen für z. B.:

- Kassensitz
- Selbstzahler als eigener Status
- Ersttermin-/Folgetermin-/Gesamtkosten
- Wartezeit
- Wartelistenstatus

Diese werden **nicht** in v0.1 erfunden. Wenn das Feature/API-Modell dafür feststeht, wird das Zielschema gezielt erweitert und die DUMMY-Fixtures werden ergänzt.

## Dummy-ID-Konvention

Für kuratierte Fixtures wird zunächst ein klar erkennbarer Bereich verwendet:

- Ärzte: `900001` ff.
- Standorte: `910001` ff.
- Treatments: `900001` ff. (unter der aktuellen API-Grenze 999999)
- Terms: `920001` ff., wenn zusätzliche reine Test-Terms benötigt werden
- Aliasse: `930001` ff.
- Treatment-Quellen: `940001` ff.
- Symptome: `950001` ff.

Bestehende echte Taxonomien können später bewusst als Referenzdaten übernommen werden; reale Arzt-/Praxisdaten werden nicht als Fixtures verwendet.

## Dateien

- `LCN_DUMMY_SCHEMA_v0_1.sql` — erzeugt die leere, bereinigte Dummy-Struktur
- Fixture-SQL wird separat gehalten und erst nach Freigabe der Fixture-Matrix erstellt.

## Nächste Schritte

1. `LCN_DUMMY_SCHEMA_v0_1.sql` lokal als neue Datenbank testen.
2. API-Verbindung per `.env` auf `lcn_dummy_db` umschalten und Smoke-Test durchführen.
3. Fixture-Matrix freigeben.
4. `LCN_DUMMY_FIXTURES_v0_1.sql` erstellen.
5. Erst danach Online-DUMMY und Backup-Integration planen.
