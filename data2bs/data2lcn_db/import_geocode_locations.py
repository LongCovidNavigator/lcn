import csv
import os
from decimal import Decimal, InvalidOperation
from pathlib import Path

from lcn_env import lcn_env_path
import mysql.connector
from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = lcn_env_path()
CSV_PATH = SCRIPT_DIR / "geocode_locations_review.csv"

# Zunächst nur kontrollieren. Noch keine Änderungen speichern.
APPLY_CHANGES = True

# Diese beiden Fälle wurden manuell geprüft und freigegeben.
MANUALLY_APPROVED_LOC_IDS = {
    1102,
    1142,
}


load_dotenv(ENV_PATH)


def parse_coordinate(value, field_name, loc_id):
    try:
        coordinate = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        raise ValueError(
            f"loc_id {loc_id}: Ungültiger Wert für {field_name}: {value!r}"
        )

    if field_name == "Latitude" and not Decimal("-90") <= coordinate <= Decimal("90"):
        raise ValueError(
            f"loc_id {loc_id}: Latitude außerhalb des gültigen Bereichs"
        )

    if field_name == "Longitude" and not Decimal("-180") <= coordinate <= Decimal("180"):
        raise ValueError(
            f"loc_id {loc_id}: Longitude außerhalb des gültigen Bereichs"
        )

    return coordinate


if not CSV_PATH.exists():
    raise FileNotFoundError(f"Prüfdatei fehlt: {CSV_PATH}")

connection = mysql.connector.connect(
    host=os.getenv("LCN_DB_HOST"),
    port=int(os.getenv("LCN_DB_PORT")),
    user=os.getenv("LCN_DB_USERNAME"),
    password=os.getenv("LCN_DB_PASSWORD"),
    database=os.getenv("LCN_DB_DATABASE"),
)

cursor = connection.cursor(dictionary=True)

try:
    cursor.execute("SELECT DATABASE() AS database_name")
    database_name = cursor.fetchone()["database_name"]

    if database_name != "lcn_test_db":
        raise RuntimeError(
            f"Abbruch: Verbunden mit '{database_name}' statt 'lcn_test_db'"
        )

    with CSV_PATH.open(
        "r",
        newline="",
        encoding="utf-8-sig",
    ) as csv_file:
        rows = list(csv.DictReader(csv_file, delimiter=";"))

    if len(rows) != 91:
        raise RuntimeError(
            f"Abbruch: Erwartet wurden 91 CSV-Zeilen, gefunden wurden {len(rows)}"
        )

    prepared_updates = []
    skipped_existing = []
    rejected_rows = []

    seen_loc_ids = set()

    for row in rows:
        loc_id = int(row["loc_id"])
        status = row["pruefstatus"].strip()

        if loc_id in seen_loc_ids:
            raise RuntimeError(
                f"Abbruch: loc_id {loc_id} kommt mehrfach in der CSV vor"
            )

        seen_loc_ids.add(loc_id)

        approved = (
            status == "safe"
            or (
                status == "review_required"
                and loc_id in MANUALLY_APPROVED_LOC_IDS
            )
        )

        if not approved:
            rejected_rows.append(
                {
                    "loc_id": loc_id,
                    "status": status,
                    "name": row["dr_display_name"],
                }
            )
            continue

        latitude = parse_coordinate(
            row["loc_lat_vorschlag"],
            "Latitude",
            loc_id,
        )
        longitude = parse_coordinate(
            row["loc_lng_vorschlag"],
            "Longitude",
            loc_id,
        )

        cursor.execute(
            """
            SELECT
                l.loc_id,
                l.dr_id,
                d.dr_display_name,
                l.loc_lat,
                l.loc_lng
            FROM tbl_drs_locations_03 l
            JOIN tbl_drs_03 d
                ON d.dr_id = l.dr_id
            WHERE l.loc_id = %s
            """,
            (loc_id,),
        )

        database_row = cursor.fetchone()

        if database_row is None:
            raise RuntimeError(
                f"Abbruch: loc_id {loc_id} existiert nicht in der Datenbank"
            )

        csv_dr_id = int(row["dr_id"])

        if database_row["dr_id"] != csv_dr_id:
            raise RuntimeError(
                f"Abbruch: dr_id stimmt bei loc_id {loc_id} nicht überein"
            )

        if (
            database_row["loc_lat"] is not None
            or database_row["loc_lng"] is not None
        ):
            skipped_existing.append(loc_id)
            continue

        prepared_updates.append(
            {
                "loc_id": loc_id,
                "dr_id": csv_dr_id,
                "name": row["dr_display_name"],
                "latitude": latitude,
                "longitude": longitude,
                "status": status,
            }
        )

    print()
    print("Datenbank:", database_name)
    print("CSV-Zeilen:", len(rows))
    print("Vorbereitete Updates:", len(prepared_updates))
    print("Bereits vorhandene Koordinaten:", len(skipped_existing))
    print("Nicht freigegebene Zeilen:", len(rejected_rows))
    print("Modus:", "UPDATE" if APPLY_CHANGES else "NUR VORSCHAU")

    if rejected_rows:
        print()
        print("Nicht freigegebene Zeilen:")

        for row in rejected_rows:
            print(
                f"- loc_id {row['loc_id']} | "
                f"{row['name']} | "
                f"{row['status']}"
            )

        raise RuntimeError(
            "Abbruch: Es sind nicht freigegebene CSV-Zeilen vorhanden"
        )

    if len(prepared_updates) != 91:
        raise RuntimeError(
            "Abbruch: Es wurden nicht genau 91 Updates vorbereitet"
        )

    print()
    print("Erste fünf vorbereitete Updates:")

    for update in prepared_updates[:5]:
        print(
            f"loc_id {update['loc_id']} | "
            f"{update['name']} | "
            f"{update['latitude']}, {update['longitude']}"
        )

    if not APPLY_CHANGES:
        print()
        print("Vorschau erfolgreich.")
        print("Es wurden keine Datenbankdaten verändert.")

    else:
        update_sql = """
            UPDATE tbl_drs_locations_03
            SET
                loc_lat = %s,
                loc_lng = %s,
                loc_geo_type = 'Point'
            WHERE loc_id = %s
              AND (loc_lat IS NULL OR loc_lng IS NULL)
        """

        updated_count = 0

        for update in prepared_updates:
            cursor.execute(
                update_sql,
                (
                    update["latitude"],
                    update["longitude"],
                    update["loc_id"],
                ),
            )

            if cursor.rowcount != 1:
                raise RuntimeError(
                    f"Abbruch: loc_id {update['loc_id']} "
                    f"wurde nicht genau einmal aktualisiert"
                )

            updated_count += cursor.rowcount

        if updated_count != 91:
            raise RuntimeError(
                f"Abbruch: Erwartet waren 91 Updates, ausgeführt wurden "
                f"{updated_count}"
            )

        connection.commit()

        print()
        print("Import erfolgreich.")
        print("Aktualisierte Standorte:", updated_count)

except Exception:
    connection.rollback()
    raise

finally:
    cursor.close()
    connection.close()