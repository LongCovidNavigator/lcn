import csv
import os
import re
import time
import unicodedata
import math

from pathlib import Path

from lcn_env import lcn_env_path
import mysql.connector
import requests
from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = lcn_env_path()
OUTPUT_PATH = SCRIPT_DIR / "geocode_locations_review.csv"

load_dotenv(ENV_PATH)

API_KEY = os.getenv("GEOAPIFY_API_KEY")

if not API_KEY:
    raise RuntimeError("GEOAPIFY_API_KEY fehlt in der .env")


def normalize(value):
    if value is None:
        return ""

    value = str(value).strip().casefold()
    value = value.replace("ß", "ss")

    value = unicodedata.normalize("NFKD", value)
    value = "".join(
        char for char in value
        if not unicodedata.combining(char)
    )

    replacements = {
        "str.": "strasse",
        "straße": "strasse",
        "strasse": "strasse",
    }

    for old, new in replacements.items():
        value = value.replace(old, new)

    return re.sub(r"[^a-z0-9]", "", value)


def same_country(database_country, result_country):
    return normalize(database_country) == normalize(result_country)


def same_postcode(database_postcode, result_postcode):
    return normalize(database_postcode) == normalize(result_postcode)


def same_street(database_street, result_street):
    return normalize(database_street) == normalize(result_street)


def same_housenumber(database_number, result_number):
    return normalize(database_number) == normalize(result_number)


def same_city(database_city, result_city):
    db_city = normalize(database_city)
    api_city = normalize(result_city)

    if not db_city or not api_city:
        return False

    return (
        db_city == api_city
        or db_city in api_city
        or api_city in db_city
    )


def candidate_score(row, properties):
    score = 0

    if same_country(row["loc_country"], properties.get("country_code")):
        score += 40

    if same_postcode(row["loc_plz"], properties.get("postcode")):
        score += 30

    if same_street(row["loc_street"], properties.get("street")):
        score += 20

    if same_housenumber(
        row["loc_housenumber"],
        properties.get("housenumber"),
    ):
        score += 20

    if same_city(row["loc_city"], properties.get("city")):
        score += 10

    if properties.get("result_type") in {"building", "amenity"}:
        score += 5

    return score

def distance_in_meters(lat1, lon1, lat2, lon2):
    earth_radius = 6_371_000

    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    delta_phi = math.radians(float(lat2) - float(lat1))
    delta_lambda = math.radians(float(lon2) - float(lon1))

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2) ** 2
    )

    return 2 * earth_radius * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )


def tied_results_are_same_location(best_results):
    if len(best_results) <= 1:
        return True

    reference = best_results[0]

    reference_lat = reference.get("lat")
    reference_lon = reference.get("lon")

    if reference_lat is None or reference_lon is None:
        return False

    for candidate in best_results[1:]:
        candidate_lat = candidate.get("lat")
        candidate_lon = candidate.get("lon")

        if candidate_lat is None or candidate_lon is None:
            return False

        if distance_in_meters(
            reference_lat,
            reference_lon,
            candidate_lat,
            candidate_lon,
        ) > 100:
            return False

    return True

def determine_status(row, properties, tied_best_result):
    if tied_best_result:
        return "review_required"

    latitude = properties.get("lat")
    longitude = properties.get("lon")

    if latitude is None or longitude is None:
        return "review_required"

    country_matches = same_country(
        row["loc_country"],
        properties.get("country_code"),
    )
    postcode_matches = same_postcode(
        row["loc_plz"],
        properties.get("postcode"),
    )
    street_matches = same_street(
        row["loc_street"],
        properties.get("street"),
    )
    housenumber_matches = same_housenumber(
        row["loc_housenumber"],
        properties.get("housenumber"),
    )

    if (
        country_matches
        and postcode_matches
        and street_matches
        and housenumber_matches
    ):
        return "safe"

    return "review_required"


def build_deviation_text(row, properties, tied_best_result):
    deviations = []

    comparisons = [
        (
            "Land",
            row["loc_country"],
            properties.get("country_code"),
            same_country,
        ),
        (
            "PLZ",
            row["loc_plz"],
            properties.get("postcode"),
            same_postcode,
        ),
        (
            "Stadt",
            row["loc_city"],
            properties.get("city"),
            same_city,
        ),
        (
            "Straße",
            row["loc_street"],
            properties.get("street"),
            same_street,
        ),
        (
            "Hausnummer",
            row["loc_housenumber"],
            properties.get("housenumber"),
            same_housenumber,
        ),
    ]

    for label, database_value, api_value, comparison in comparisons:
        if not comparison(database_value, api_value):
            deviations.append(
                f"{label}: DB='{database_value}' / API='{api_value}'"
            )

    if tied_best_result:
        deviations.append("Mehrere gleich gut bewertete Treffer")

    if not deviations:
        return "keine"

    return " | ".join(deviations)


connection = mysql.connector.connect(
    host=os.getenv("LCN_DB_HOST"),
    port=int(os.getenv("LCN_DB_PORT")),
    user=os.getenv("LCN_DB_USERNAME"),
    password=os.getenv("LCN_DB_PASSWORD"),
    database=os.getenv("LCN_DB_DATABASE"),
)

cursor = connection.cursor(dictionary=True)

cursor.execute("SELECT DATABASE() AS database_name")
database_name = cursor.fetchone()["database_name"]

if database_name != "lcn_test_db":
    cursor.close()
    connection.close()
    raise RuntimeError(
        f"Abbruch: Verbunden mit '{database_name}' statt 'lcn_test_db'"
    )

cursor.execute("""
    SELECT
        l.loc_id,
        l.dr_id,
        d.dr_display_name,
        l.loc_country,
        l.loc_plz,
        l.loc_city,
        l.loc_street,
        l.loc_housenumber
    FROM tbl_drs_locations_03 l
    JOIN tbl_drs_03 d
        ON d.dr_id = l.dr_id
    WHERE l.loc_lat IS NULL
      AND l.loc_lng IS NULL
      AND NULLIF(TRIM(l.loc_country), '') IS NOT NULL
      AND NULLIF(TRIM(l.loc_plz), '') IS NOT NULL
      AND NULLIF(TRIM(l.loc_city), '') IS NOT NULL
      AND NULLIF(TRIM(l.loc_street), '') IS NOT NULL
      AND NULLIF(TRIM(l.loc_housenumber), '') IS NOT NULL
    ORDER BY l.loc_id
""")

rows = cursor.fetchall()

cursor.close()
connection.close()

fieldnames = [
    "loc_id",
    "dr_id",
    "dr_display_name",
    "urspruengliche_adresse",
    "suchadresse",
    "gefundene_formatierte_adresse",
    "loc_lat_vorschlag",
    "loc_lng_vorschlag",
    "treffertyp",
    "match_type",
    "confidence",
    "confidence_city_level",
    "confidence_street_level",
    "confidence_building_level",
    "gefundenes_land",
    "gefundene_plz",
    "gefundene_stadt",
    "gefundene_strasse",
    "gefundene_hausnummer",
    "abweichung",
    "pruefstatus",
    "anzahl_api_treffer",
]

session = requests.Session()

status_counts = {
    "safe": 0,
    "review_required": 0,
    "not_found": 0,
    "api_error": 0,
}

with OUTPUT_PATH.open(
    "w",
    newline="",
    encoding="utf-8-sig",
) as csv_file:
    writer = csv.DictWriter(
        csv_file,
        fieldnames=fieldnames,
        delimiter=";",
    )
    writer.writeheader()

    total = len(rows)

    for index, row in enumerate(rows, start=1):
        original_address = (
            f"{row['loc_street']} {row['loc_housenumber']}, "
            f"{row['loc_plz']} {row['loc_city']}, "
            f"{row['loc_country']}"
        )

        search_address = original_address

        print(
            f"[{index}/{total}] "
            f"loc_id {row['loc_id']}: {search_address}"
        )

        output_row = {
            "loc_id": row["loc_id"],
            "dr_id": row["dr_id"],
            "dr_display_name": row["dr_display_name"],
            "urspruengliche_adresse": original_address,
            "suchadresse": search_address,
            "gefundene_formatierte_adresse": "",
            "loc_lat_vorschlag": "",
            "loc_lng_vorschlag": "",
            "treffertyp": "",
            "match_type": "",
            "confidence": "",
            "confidence_city_level": "",
            "confidence_street_level": "",
            "confidence_building_level": "",
            "gefundenes_land": "",
            "gefundene_plz": "",
            "gefundene_stadt": "",
            "gefundene_strasse": "",
            "gefundene_hausnummer": "",
            "abweichung": "",
            "pruefstatus": "",
            "anzahl_api_treffer": 0,
        }

        try:
            response = session.get(
                "https://api.geoapify.com/v1/geocode/search",
                params={
                    "text": search_address,
                    "apiKey": API_KEY,
                    "limit": 5,
                    "format": "geojson",
                },
                timeout=30,
            )

            response.raise_for_status()

            features = response.json().get("features", [])
            output_row["anzahl_api_treffer"] = len(features)

            if not features:
                output_row["pruefstatus"] = "not_found"
                output_row["abweichung"] = "Kein API-Treffer"
                status_counts["not_found"] += 1
                writer.writerow(output_row)
                continue

            scored_features = []

            for feature in features:
                properties = feature.get("properties", {})
                score = candidate_score(row, properties)
                scored_features.append((score, properties))

            scored_features.sort(
                key=lambda item: item[0],
                reverse=True,
            )

            best_score, properties = scored_features[0]

            best_results = [
                candidate_properties
                for score, candidate_properties in scored_features
                if score == best_score
            ]

            ambiguous_tie = (
                    len(best_results) > 1
                    and not tied_results_are_same_location(best_results)
            )

            rank = properties.get("rank", {})

            status = determine_status(
                row,
                properties,
                ambiguous_tie,
            )

            output_row.update({
                "gefundene_formatierte_adresse":
                    properties.get("formatted", ""),
                "loc_lat_vorschlag":
                    properties.get("lat", ""),
                "loc_lng_vorschlag":
                    properties.get("lon", ""),
                "treffertyp":
                    properties.get("result_type", ""),
                "match_type":
                    rank.get("match_type", ""),
                "confidence":
                    rank.get("confidence", ""),
                "confidence_city_level":
                    rank.get("confidence_city_level", ""),
                "confidence_street_level":
                    rank.get("confidence_street_level", ""),
                "confidence_building_level":
                    rank.get("confidence_building_level", ""),
                "gefundenes_land":
                    properties.get("country_code", ""),
                "gefundene_plz":
                    properties.get("postcode", ""),
                "gefundene_stadt":
                    properties.get("city", ""),
                "gefundene_strasse":
                    properties.get("street", ""),
                "gefundene_hausnummer":
                    properties.get("housenumber", ""),
                "abweichung": build_deviation_text(
                                row,
                                properties,
                                ambiguous_tie,
                            ),
                "pruefstatus": status,
            })

            status_counts[status] += 1

        except requests.RequestException as error:
            output_row["pruefstatus"] = "api_error"
            output_row["abweichung"] = str(error)
            status_counts["api_error"] += 1

        writer.writerow(output_row)

        time.sleep(0.25)

print()
print("Geocoding abgeschlossen.")
print("Prüfdatei:", OUTPUT_PATH)
print("safe:", status_counts["safe"])
print("review_required:", status_counts["review_required"])
print("not_found:", status_counts["not_found"])
print("api_error:", status_counts["api_error"])
print()
print("Es wurden keine Datenbankdaten verändert.")