# Doctors: lokale Hybrid-Version

Die bestehende Liste und Detailseite zeigen die 39 in `api/_doctor_hybrid.php` zentral ausgewählten LCN-IDs. Zusätzliche Entities und Community-Vorschläge werden dieser Entwicklungsansicht nicht beigemischt. Die Übersicht startet ohne gespeicherten Ortsfilter; der gespeicherte Standort bleibt erhalten.

## Darstellung

Seit 22.09.2026 zeigt `arzt_detail.html` das neue Vier-Ansichten-Konzept: Überblick, Termin, Zugang und Wirkung. Identität, Kontakt, alle Fachrichtungen / Zusatzqualifikationen / Spezialisierungen, Standorte und Behandlungsspektrum stammen aus den vorhandenen Daten. Die Community-Verteilungen werden separat aus den neuen Antworttabellen geladen, bei eingeschaltetem Konfigurationsschalter einschließlich gekennzeichneter Dummy-Angaben. Recherchewerte und alte Gesamtbewertungen werden nicht in neue Community-Antworten umgedeutet. Der bisherige Dummy-Aufbau bleibt unter `arzt_detail_dummy.php` erhalten. Details und offene Punkte: [Umstellungsbericht](doctor-detail-rollout.md).

## Datenquelle

- `api/doctor_detail.php` und `api/doctors_search.php`: `tbl_entities_nd`, begrenzt auf die 39 IDs; Fachprofil aus den drei neuen Profiltabellen, Kosten aus `tbl_costs_nd`.
- Standorte: `tbl_drs_locations_03`; Hauptstandort bevorzugt, sonst erster vorhandener Standort. Weitere Standorte erscheinen auf der Detailseite.
- Treatments: `tbl_cpl_drs2treatments_03` und `tbl_treatments_03`, über unveränderte LCN-IDs.
- Doctor-Bewertungen: bestehende Bewertungslogik, auf derselben Hybrid-Verbindung.
- Treatmentlinks aus diesen Profilen tragen `source=priority`. Die bestehende Treatment-Detail-API und deren Bewertungsendpunkt nutzen in diesem Kontext ebenfalls die Hybrid-Verbindung. Alle Treatment-Aufrufe nutzen ebenfalls die zentrale Verbindung.

Seit 30.10.2026 verwenden alle APIs dieselbe zentrale Verbindung aus `lcnDatabase()`. `lcnDoctorDatabase()` bleibt als kompatibler Funktionsname erhalten und gibt dieselbe PDO-Instanz zurück. Der Schalter `LCN_DB_ACTIVE_PROFILE` in der geschützten `lcn.env` wählt die Datenbank für Behandler und Behandlungen gemeinsam. `LCN_DOCTORS_DB_*` wird nicht mehr ausgewertet. Lokal muss das aktive Profil auf `lcn_hybrid_database` zeigen, online auf `d048c382`. Auch der ND-Prototyp verwendet diese Auswahl; ein bestimmter Datenbankname ist nicht mehr fest im Code vorgeschrieben.

## Prüfung am 20.09.2026

`php tests/hybrid_doctors_smoke.php` prüft lesend die exakten 39 IDs, alle Detailantworten einschließlich NULL-Werten, Treatment-Zuordnungen, Ablehnung anderer IDs, alle Fachrichtungsfilter, Namenssuche und einen Hybrid-Treatment-Link.

Die acht relevanten lokalen Tabellen wurden über temporäre Vergleichstabellen mit dem bereitgestellten SQL-Dump abgeglichen und stimmen überein. Für TIMESTAMP-Spalten wurde dabei dieselbe UTC-Sitzungszeitzone wie im Dump verwendet. Es wurden keine Testbewertungen abgegeben.

Konkrete Datenlücke: Keiner der 39 Behandler hat im Dump Standortkoordinaten. Adressen werden dargestellt; Kartenmarker, Entfernung und eine reine Umkreissuche benötigen ergänzte Koordinaten. Die vorhandene Kartenlogik bleibt erhalten.
