from __future__ import annotations

import csv
from pathlib import Path


INPUT = Path(r"C:\Users\willi\Downloads\doctors_missing_locations_88.csv")
OUTPUT = Path(r"C:\xampp\htdocs\lcn\outputs\doctors_location_review_20260726\doctors_missing_locations_88_consolidated.sql")
DELETE_OUTPUT = Path(r"C:\xampp\htdocs\lcn\outputs\doctors_location_review_20260726\delete_closed_doctor_1066.sql")

# Bereits einzeln in lcn_test_db korrigiert: im Sammelskript nicht überschreiben.
SPECIAL_EXCLUSIONS = {1063, 1068, 1073, 1085, 1086, 1087, 1104, 1110, 1123, 1126, 1136, 1144, 1146}
# Bereits auf eine Haupt-ID zusammengeführt: Arzt nicht erneut anlegen/aktualisieren.
MERGED_DUPLICATES = {1082: 668, 1127: 549, 1129: 573, 1134: 591}
DELETE_IDS = {1066}

# Extraktionsartefakte aus sichtbarem Seitentext.
ADDRESS_OVERRIDES = {
    1062: ("DE", "13467", "Berlin", "Robinienweg", "2"),
    1078: ("DE", "40221", "Düsseldorf", "Fährstraße", "1"),
    # Spätere verbindliche Einzelentscheidung: neue Tätigkeit, alte eigene Praxis geschlossen.
    1084: ("DE", "50858", "Köln", "Jakob-Kaiser-Straße", "11"),
    # Spätere verbindliche Einzelentscheidung des Nutzers.
    1088: ("DE", "57234", "Wilnsdorf", "Am Haardtchen", "8a"),
}

ADDITIONAL_LOCATIONS = [
    (1065, "Weiterer Praxisstandort", "DE", "12043", "Berlin", "Erkstraße", "3", "https://www.praxis-bast.de/"),
    (1088, "Weiterer Praxisstandort", "DE", "57299", "Burbach", "Burgweg", "23", "https://kermani-james.de"),
    (1092, "Weiterer Praxisstandort", "DE", "65760", "Eschborn", "Kurt-Schumacher-Straße", "6–8", "https://www.ganzheitliche-neurologie-frankfurt.de/"),
    (1105, "Weiterer Praxisstandort", "DE", "77880", "Sasbach", "Alter Sportplatz", "13", "https://www.gemeinschaftspraxis-achern.de/"),
]

# Nur abschließend belegte Namen/Titel. Vermutungen aus der Übergabe bleiben bewusst draußen.
PERSON_UPDATES = [
    (1081, "Ulrike Lürbke", "Ulrike", "Lürbke", None, 0, None),
    (1084, "Annette Gude", "Annette", "Gude", None, 0, "NICE IN AND OUT"),
    (1088, "Dr. med. Hamid Kermani", "Hamid", "Kermani", "Dr. med.", 1, "Kermani & James"),
    (1121, "Dr. Martin Schnitzer", "Martin", "Schnitzer", "Dr.", 1, None),
    (1125, "Prof. Dr. Michael Stark", "Michael", "Stark", "Prof. Dr.", 1, None),
    (1135, "Dr. med. Manfred Hechler", "Manfred", "Hechler", "Dr. med.", 1, None),
    (1139, "Dr. Danny Couckuyt", "Danny", "Couckuyt", "Dr.", 1, None),
    (1143, "PD Dr. med. Benjamin Luchting", "Benjamin", "Luchting", "PD Dr. med.", 1, None),
]

# Abweichende, verifizierte offizielle Domains. Suchmaschinen/Verzeichnisse werden nie übernommen.
WEBSITE_OVERRIDES = {
    1064: "https://praxis-dr-med-arlt.de/",
    1088: "https://kermani-james.de",
    1094: "https://www.anuvindati-bensheim.de/",
    1101: "https://www.paluch-paluch.de/",
    1112: "https://zentrum-funktionelle-medizin.de/",
    1131: "https://www.habichtswald-privat-klinik.de/",
}


def q(value: object | None) -> str:
    if value is None or value == "":
        return "NULL"
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def clean(value: str) -> str:
    return (value or "").lstrip("\ufeff").strip()


with INPUT.open("r", encoding="utf-8-sig", newline="") as handle:
    rows = list(csv.DictReader(handle))

by_id = {int(row["dr_id"]): row for row in rows}
standard_rows = []
for dr_id, row in sorted(by_id.items()):
    if dr_id in SPECIAL_EXCLUSIONS or dr_id in MERGED_DUPLICATES or dr_id in DELETE_IDS:
        continue
    address = ADDRESS_OVERRIDES.get(
        dr_id,
        (
            clean(row["found_country"]),
            clean(row["found_plz"]),
            clean(row["found_city"]),
            clean(row["found_street"]),
            clean(row["found_housenumber"]),
        ),
    )
    if not all(address):
        raise ValueError(f"Unvollständige bestätigte Adresse für dr_id {dr_id}: {address}")
    standard_rows.append((dr_id, *address))

website_rows = []
for dr_id, row in sorted(by_id.items()):
    if dr_id in SPECIAL_EXCLUSIONS or dr_id in MERGED_DUPLICATES or dr_id in DELETE_IDS or dr_id == 1084:
        continue
    url = WEBSITE_OVERRIDES.get(dr_id, clean(row["normalized_website"]))
    if url:
        website_rows.append((dr_id, url))

lines: list[str] = []
lines += [
    "-- Konsolidierte Standortbereinigung für doctors_missing_locations_88.csv",
    "-- Erzeugt aus dem lokalen Recherche-/Review-Stand; NICHT automatisch ausgeführt.",
    "-- Spätere verbindliche Einzelentscheidungen haben Vorrang vor älteren CSV-Einstufungen.",
    "-- Ziel: lcn_test_db. Vor Ausführung Datenbanksicherung erstellen und Kontrollabfragen prüfen.",
    "",
    "SET NAMES utf8mb4;",
    "USE lcn_test_db;",
    "START TRANSACTION;",
    "",
    "-- Bewusst aus allen Sammelupdates ausgeschlossen (bereits einzeln korrigiert):",
    "-- 1063, 1068, 1073, 1085, 1086, 1087, 1104, 1110, 1123, 1126, 1136, 1144, 1146",
    "-- Bereits zusammengeführt; Zieladressen wurden lesend kontrolliert: 1082->668, 1127->549, 1129->573, 1134->591.",
    "",
    "-- ============================================================",
    "-- A. STANDARDADRESSEN / VERBINDLICH BESTÄTIGTE PRIMÄRSTANDORTE",
    "-- ============================================================",
    "DROP TEMPORARY TABLE IF EXISTS tmp_lcn_primary_locations;",
    "CREATE TEMPORARY TABLE tmp_lcn_primary_locations (",
    "  dr_id BIGINT UNSIGNED PRIMARY KEY,",
    "  loc_country CHAR(2) NOT NULL,",
    "  loc_plz VARCHAR(20) NOT NULL,",
    "  loc_city VARCHAR(120) NOT NULL,",
    "  loc_street VARCHAR(255) NOT NULL,",
    "  loc_housenumber VARCHAR(40) NOT NULL",
    ") ENGINE=Memory;",
    "",
    "INSERT INTO tmp_lcn_primary_locations",
    "  (dr_id, loc_country, loc_plz, loc_city, loc_street, loc_housenumber)",
    "VALUES",
]
for index, row in enumerate(standard_rows):
    suffix = ";" if index == len(standard_rows) - 1 else ","
    lines.append("  (" + ", ".join([str(row[0]), *(q(v) for v in row[1:])]) + ")" + suffix)

lines += [
    "",
    "-- Schutzprüfung: Eine nicht vorhandene Arzt-ID wird unten weder aktualisiert noch neu als Arzt angelegt.",
    "SELECT t.dr_id AS fehlende_arzt_id",
    "FROM tmp_lcn_primary_locations t",
    "LEFT JOIN tbl_drs_03 d ON d.dr_id = t.dr_id",
    "WHERE d.dr_id IS NULL;",
    "",
    "-- Alle vorhandenen Standorte der betroffenen Person zunächst auf sekundär setzen.",
    "UPDATE tbl_drs_locations_03 l",
    "JOIN tmp_lcn_primary_locations t ON t.dr_id = l.dr_id",
    "SET l.loc_is_primary = 0;",
    "",
    "-- Je Person die bisherige Primärzeile bzw. kleinste loc_id als neuen Primärstandort aktualisieren.",
    "UPDATE tbl_drs_locations_03 l",
    "JOIN (",
    "  SELECT dr_id, MIN(loc_id) AS target_loc_id",
    "  FROM tbl_drs_locations_03",
    "  GROUP BY dr_id",
    ") x ON x.target_loc_id = l.loc_id",
    "JOIN tmp_lcn_primary_locations t ON t.dr_id = l.dr_id",
    "SET l.loc_label = 'Primärstandort',",
    "    l.loc_is_primary = 1,",
    "    l.loc_country = t.loc_country,",
    "    l.loc_plz = t.loc_plz,",
    "    l.loc_city = t.loc_city,",
    "    l.loc_street = t.loc_street,",
    "    l.loc_housenumber = t.loc_housenumber,",
    "    l.loc_lat = NULL,",
    "    l.loc_lng = NULL,",
    "    l.loc_geo_type = NULL,",
    "    l.loc_address_visibility = 'full';",
    "",
    "-- Falls für einen vorhandenen Arzt noch gar keine Standortzeile existiert, Primärstandort anlegen.",
    "INSERT INTO tbl_drs_locations_03",
    "  (dr_id, loc_label, loc_is_primary, loc_country, loc_plz, loc_city, loc_street, loc_housenumber, loc_address_visibility)",
    "SELECT t.dr_id, 'Primärstandort', 1, t.loc_country, t.loc_plz, t.loc_city, t.loc_street, t.loc_housenumber, 'full'",
    "FROM tmp_lcn_primary_locations t",
    "JOIN tbl_drs_03 d ON d.dr_id = t.dr_id",
    "LEFT JOIN tbl_drs_locations_03 l ON l.dr_id = t.dr_id",
    "WHERE l.loc_id IS NULL;",
    "",
    "-- ============================================================",
    "-- B. BESTÄTIGTE NAMENS- UND TITELKORREKTUREN",
    "-- ============================================================",
]
for dr_id, display, first, last, title, is_dr, org in PERSON_UPDATES:
    org_sql = "dr_org_name" if org is None else q(org)
    lines += [
        f"UPDATE tbl_drs_03 SET dr_display_name={q(display)}, dr_firstname={q(first)}, dr_lastname={q(last)},",
        f"  dr_title_raw={q(title)}, dr_is_dr={is_dr}, dr_org_name={org_sql}",
        f"WHERE dr_id={dr_id};",
    ]
lines += [
    "",
    "-- Organisationsname der aktiven Klinik aktualisieren; Organisation bleibt Organisation.",
    "UPDATE tbl_drs_03",
    "SET dr_org_name='Habichtswald Privat-Klinik', dr_display_name='Habichtswald Privat-Klinik'",
    "WHERE dr_id=1131;",
    "",
    "-- ============================================================",
    "-- C. MEHRFACHSTANDORTE (GENAU EIN PRIMÄRSTANDORT BLEIBT ERHALTEN)",
    "-- ============================================================",
]
for dr_id, label, country, plz, city, street, house, website in ADDITIONAL_LOCATIONS:
    lines += [
        "INSERT INTO tbl_drs_locations_03",
        "  (dr_id, loc_label, loc_is_primary, loc_country, loc_plz, loc_city, loc_street, loc_housenumber, loc_website, loc_address_visibility)",
        f"SELECT {dr_id}, {q(label)}, 0, {q(country)}, {q(plz)}, {q(city)}, {q(street)}, {q(house)}, {q(website)}, 'full'",
        f"WHERE EXISTS (SELECT 1 FROM tbl_drs_03 WHERE dr_id={dr_id})",
        "  AND NOT EXISTS (",
        "    SELECT 1 FROM tbl_drs_locations_03",
        f"    WHERE dr_id={dr_id} AND COALESCE(loc_country,'')={q(country)} AND COALESCE(loc_plz,'')={q(plz)}",
        f"      AND COALESCE(loc_city,'')={q(city)} AND COALESCE(loc_street,'')={q(street)}",
        f"      AND COALESCE(loc_housenumber,'')={q(house)}",
        "  );",
        "",
    ]
lines += [
    "-- ============================================================",
    "-- D. GESCHLOSSENE PRAXIS LÖSCHEN (BEWUSST IN SEPARATER SQL-DATEI)",
    "-- ============================================================",
    "-- Hauptimport enthält absichtlich kein DELETE.",
    "-- 1066 wird ausschließlich durch delete_closed_doctor_1066.sql entfernt.",
    "-- 1084 bleibt aktiv und wurde oben auf NICE IN AND OUT umgestellt.",
    "",
    "-- ============================================================",
    "-- E. OFFIZIELLE WEBSEITEN AKTUALISIEREN",
    "-- ============================================================",
    "DROP TEMPORARY TABLE IF EXISTS tmp_lcn_websites;",
    "CREATE TEMPORARY TABLE tmp_lcn_websites (dr_id BIGINT UNSIGNED PRIMARY KEY, website VARCHAR(600) NOT NULL) ENGINE=Memory;",
    "INSERT INTO tmp_lcn_websites (dr_id, website) VALUES",
]
for index, (dr_id, url) in enumerate(website_rows):
    suffix = ";" if index == len(website_rows) - 1 else ","
    lines.append(f"  ({dr_id}, {q(url)}){suffix}")
lines += [
    "",
    "UPDATE tbl_drs_03 d",
    "JOIN tmp_lcn_websites w ON w.dr_id = d.dr_id",
    "SET d.dr_website = w.website;",
    "",
    "UPDATE tbl_drs_locations_03 l",
    "JOIN tmp_lcn_websites w ON w.dr_id = l.dr_id",
    "SET l.loc_website = w.website",
    "WHERE l.loc_is_primary = 1;",
    "",
    "-- 1084: Exakte URL der aktuellen NICE-IN-AND-OUT-Teamseite lag nicht als kopierbarer Link vor.",
    "-- Daher bewusst kein geratenes Website-UPDATE für 1084; Adresse und Organisation sind dennoch verbindlich aktualisiert.",
    "",
    "-- ============================================================",
    "-- KONTROLLABFRAGEN VOR COMMIT",
    "-- ============================================================",
    "-- Fehlende oder unvollständige Primäradressen im bearbeiteten Satz",
    "SELECT t.dr_id, d.dr_display_name, l.loc_id, l.loc_country, l.loc_plz, l.loc_city, l.loc_street, l.loc_housenumber",
    "FROM tmp_lcn_primary_locations t",
    "JOIN tbl_drs_03 d ON d.dr_id=t.dr_id",
    "LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=t.dr_id AND l.loc_is_primary=1",
    "WHERE l.loc_id IS NULL OR NULLIF(TRIM(l.loc_country),'') IS NULL OR NULLIF(TRIM(l.loc_plz),'') IS NULL",
    "   OR NULLIF(TRIM(l.loc_city),'') IS NULL OR NULLIF(TRIM(l.loc_street),'') IS NULL OR NULLIF(TRIM(l.loc_housenumber),'') IS NULL;",
    "",
    "-- Mehrere Primärstandorte",
    "SELECT dr_id, COUNT(*) AS primary_count",
    "FROM tbl_drs_locations_03 WHERE loc_is_primary=1",
    "GROUP BY dr_id HAVING COUNT(*) > 1;",
    "",
    "-- Personen/Organisationen ohne Primärstandort",
    "SELECT d.dr_id, d.dr_display_name",
    "FROM tbl_drs_03 d",
    "LEFT JOIN tbl_drs_locations_03 l ON l.dr_id=d.dr_id AND l.loc_is_primary=1",
    "WHERE l.loc_id IS NULL",
    "ORDER BY d.dr_id;",
    "",
    "-- Verbliebene Koordinatenlücken",
    "SELECT l.dr_id, d.dr_display_name, l.loc_id, l.loc_is_primary, l.loc_plz, l.loc_city, l.loc_street, l.loc_housenumber",
    "FROM tbl_drs_locations_03 l",
    "JOIN tbl_drs_03 d ON d.dr_id=l.dr_id",
    "WHERE l.loc_lat IS NULL OR l.loc_lng IS NULL",
    "ORDER BY l.dr_id, l.loc_is_primary DESC, l.loc_id;",
    "",
    "-- Erwartete Mehrstandorte und Primäranzahl für die vier bestätigten Fälle",
    "SELECT dr_id, COUNT(*) AS location_count, SUM(loc_is_primary=1) AS primary_count",
    "FROM tbl_drs_locations_03",
    "WHERE dr_id IN (1065,1088,1092,1105)",
    "GROUP BY dr_id ORDER BY dr_id;",
    "",
    "-- Hauptimport dauerhaft übernehmen. Dieser Lauf enthält keine DELETE-Anweisung.",
    "COMMIT;",
]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

delete_lines = [
    "-- Separater finaler Löschlauf für die vollständig geschlossene Praxis dr_id 1066.",
    "-- Erst nach erfolgreichem Hauptimport doctors_missing_locations_88_consolidated.sql ausführen.",
    "SET NAMES utf8mb4;",
    "USE lcn_test_db;",
    "START TRANSACTION;",
    "",
    "-- Vorher-Kontrolle: genau die zu löschende Person und abhängigen Zeilenzahlen anzeigen.",
    "SELECT dr_id, dr_display_name, dr_website FROM tbl_drs_03 WHERE dr_id=1066;",
    "SELECT",
    "  (SELECT COUNT(*) FROM tbl_drs_locations_03 WHERE dr_id=1066) AS locations_count,",
    "  (SELECT COUNT(*) FROM tbl_drs_sources_03 WHERE dr_id=1066) AS sources_count,",
    "  (SELECT COUNT(*) FROM tbl_cpl_drs2treatments_03 WHERE dr_id=1066) AS treatments_count,",
    "  (SELECT COUNT(*) FROM tbl_cpl_drs2terms_03 WHERE dr_id=1066) AS terms_count,",
    "  (SELECT COUNT(*) FROM tbl_drs_votes_03 WHERE dr_id=1066) AS votes_count,",
    "  (SELECT COUNT(*) FROM lcn_raw_doctor_votes WHERE dr_id=1066) AS raw_votes_count;",
    "",
    "DELETE FROM tbl_cpl_drs2treatments_03 WHERE dr_id=1066;",
    "DELETE FROM tbl_cpl_drs2terms_03 WHERE dr_id=1066;",
    "DELETE FROM tbl_drs_sources_03 WHERE dr_id=1066;",
    "DELETE FROM tbl_drs_votes_03 WHERE dr_id=1066;",
    "DELETE FROM lcn_raw_doctor_votes WHERE dr_id=1066;",
    "DELETE FROM tbl_drs_locations_03 WHERE dr_id=1066;",
    "DELETE FROM tbl_drs_03 WHERE dr_id=1066;",
    "",
    "-- Nachher-Kontrolle muss doctor_count = 0 ergeben.",
    "SELECT COUNT(*) AS doctor_count FROM tbl_drs_03 WHERE dr_id=1066;",
    "COMMIT;",
]
DELETE_OUTPUT.write_text("\n".join(delete_lines) + "\n", encoding="utf-8")

print(
    f"{OUTPUT}\n{DELETE_OUTPUT}\n"
    f"standard={len(standard_rows)} websites={len(website_rows)} names={len(PERSON_UPDATES)} additional={len(ADDITIONAL_LOCATIONS)}"
)
