#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Check fasynation.csv against tbl_drs_03 by normalized first+last name.

Ziel:
- anhand von Vorname + Nachname prüfen, welche Fasynation-Einträge
  bereits in tbl_drs_03 vorhanden sind
- neue Einträge erkennen
- problematische Fälle separat loggen

Output:
- fasynation_match_existing.csv
- fasynation_match_new.csv
- fasynation_match_problematic.csv

Schema-Annahme:
- tbl_drs_03.dr_id
- tbl_drs_03.dr_firstname
- tbl_drs_03.dr_lastname

ENV (.env):
- LCN_DB_HOST
- LCN_DB_PORT
- LCN_DB_USERNAME
- LCN_DB_PASSWORD
- LCN_DB_DATABASE
"""

from __future__ import annotations

import csv
import os
import re
import sys
import traceback
from pathlib import Path
from lcn_env import lcn_env_path
from typing import Any, Dict, List, Tuple, Optional

from dotenv import load_dotenv

try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except Exception:
    print("ERROR: mysql-connector-python fehlt. Installiere in deiner venv:", file=sys.stderr)
    print(r"  python -m pip install mysql-connector-python", file=sys.stderr)
    sys.exit(1)


# -------------------------
# Paths / ENV
# -------------------------
BASE_DIR = Path(__file__).resolve().parent

ENV_PATH = lcn_env_path()

CSV_CANDIDATES = [
    BASE_DIR / "market" / "fasynation.csv",
    BASE_DIR.parent / "market" / "fasynation.csv",
    Path("/mnt/data/fasynation.csv"),
]
FASYNATION_PATH = next((p for p in CSV_CANDIDATES if p.exists()), CSV_CANDIDATES[0])

OUT_EXISTING = BASE_DIR / "fasynation_match_existing.csv"
OUT_NEW = BASE_DIR / "fasynation_match_new.csv"
OUT_PROBLEMATIC = BASE_DIR / "fasynation_match_problematic.csv"

DB_TABLE = "tbl_drs_03"

if not ENV_PATH.exists():
    print(f"ERROR: .env nicht gefunden: {ENV_PATH}", file=sys.stderr)
    sys.exit(1)

load_dotenv(ENV_PATH)


def env(name: str, default: Optional[str] = None) -> str:
    v = os.getenv(name)
    if v is None or v.strip() == "":
        return default if default is not None else ""
    return v.strip()


DB_HOST = env("LCN_DB_HOST", "127.0.0.1")
DB_PORT = int(env("LCN_DB_PORT", "3306"))
DB_USER = env("LCN_DB_USERNAME", "")
DB_PASSWORD = env("LCN_DB_PASSWORD", "")
DB_NAME = env("LCN_DB_DATABASE", "")

if not DB_USER or not DB_NAME:
    print("ERROR: LCN_DB_USERNAME oder LCN_DB_DATABASE fehlt in der .env", file=sys.stderr)
    sys.exit(1)


# -------------------------
# Helpers / Normalization
# -------------------------
UML_MAP = (
    ("ä", "ae"),
    ("ö", "oe"),
    ("ü", "ue"),
    ("ß", "ss"),
)


def norm_ws(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def safe_str(v: Any) -> str:
    return norm_ws(v)


def norm_name_key(s: Any) -> str:
    s = norm_ws(s).lower()
    if not s:
        return ""
    for a, b in UML_MAP:
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def make_name_key(first_name: Any, last_name: Any) -> str:
    f = norm_name_key(first_name)
    l = norm_name_key(last_name)
    if f and l:
        return f"{f}|{l}"
    return ""


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


# -------------------------
# DB helper
# -------------------------
class DB:
    def __init__(self) -> None:
        safe_cfg = {
            "host": DB_HOST,
            "port": DB_PORT,
            "user": DB_USER,
            "password": "***",
            "database": DB_NAME,
        }
        print(f"Connecting to: {safe_cfg}")

        self.conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            autocommit=False,
        )

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    def rollback(self) -> None:
        self.conn.rollback()


def load_db_name_index(conn, table_name: str) -> Tuple[Dict[str, List[Dict[str, Any]]], int, int]:
    """
    Lädt alle bestehenden Ärzt:innen aus tbl_drs_03 und indexiert sie
    über normalisierten Vorname+Nachname.
    """
    sql = f"""
        SELECT dr_id, dr_firstname, dr_lastname
        FROM {table_name}
    """

    idx: Dict[str, List[Dict[str, Any]]] = {}
    cur = conn.cursor(dictionary=True)
    cur.execute(sql)

    count = 0
    skipped_empty = 0

    for rec in cur:
        count += 1
        first_name = safe_str(rec.get("dr_firstname"))
        last_name = safe_str(rec.get("dr_lastname"))

        if not first_name or not last_name:
            skipped_empty += 1
            continue

        key = make_name_key(first_name, last_name)
        if not key:
            skipped_empty += 1
            continue

        idx.setdefault(key, []).append(
            {
                "db_id": rec["dr_id"],
                "db_first_name": first_name,
                "db_last_name": last_name,
            }
        )

    cur.close()
    return idx, count, skipped_empty


# -------------------------
# CSV Loader
# -------------------------
EXPECTED_HEADER = [
    "Nr",
    "Dr",
    "Vorname",
    "Nachname",
    "PLZ",
    "Land",
    "Link",
    "Fernberatung",
    "Fachrichtung",
]


def load_fasynation_csv(path: Path) -> List[Dict[str, Any]]:
    """
    Robustes Laden der fasynation.csv.
    Falls einzelne Zeilen wegen Komma in der Fachrichtung zu viele Spalten haben,
    wird alles ab Spalte 9 wieder in Fachrichtung zusammengeführt.
    """
    if not path.exists():
        raise FileNotFoundError(f"CSV nicht gefunden: {path}")

    rows: List[Dict[str, Any]] = []

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)

        if not header:
            raise RuntimeError("CSV ist leer.")

        header_norm = [norm_ws(h) for h in header]
        if header_norm != EXPECTED_HEADER:
            raise RuntimeError(
                f"Unerwarteter Header.\nExpected: {EXPECTED_HEADER}\nGot     : {header_norm}"
            )

        for line_no, row in enumerate(reader, start=2):
            if not row or all(not norm_ws(x) for x in row):
                continue

            if len(row) < 9:
                row = row + [""] * (9 - len(row))
            elif len(row) > 9:
                row = row[:8] + [",".join(row[8:]).strip()]

            data = dict(zip(EXPECTED_HEADER, row))
            data["_line_no"] = line_no
            rows.append(data)

    return rows


# -------------------------
# Match logic
# -------------------------
def classify_rows(
    csv_rows: List[Dict[str, Any]],
    db_index: Dict[str, List[Dict[str, Any]]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    existing: List[Dict[str, Any]] = []
    new: List[Dict[str, Any]] = []
    problematic: List[Dict[str, Any]] = []

    seen_csv_keys = set()

    for row in csv_rows:
        nr = safe_str(row.get("Nr"))
        dr = safe_str(row.get("Dr"))
        first_name = safe_str(row.get("Vorname"))
        last_name = safe_str(row.get("Nachname"))
        plz = safe_str(row.get("PLZ"))
        land = safe_str(row.get("Land"))
        link = safe_str(row.get("Link"))
        fern = safe_str(row.get("Fernberatung"))
        fach = safe_str(row.get("Fachrichtung"))
        line_no = row.get("_line_no", "")

        base = {
            "line_no": line_no,
            "Nr": nr,
            "Dr": dr,
            "Vorname": first_name,
            "Nachname": last_name,
            "PLZ": plz,
            "Land": land,
            "Link": link,
            "Fernberatung": fern,
            "Fachrichtung": fach,
        }

        reason_parts = []
        if not first_name:
            reason_parts.append("missing_first_name")
        if not last_name:
            reason_parts.append("missing_last_name")

        if reason_parts:
            problematic.append(
                {
                    **base,
                    "reason": "|".join(reason_parts),
                    "normalized_key": "",
                    "db_match_count": 0,
                    "db_ids": "",
                    "db_first_name": "",
                    "db_last_name": "",
                }
            )
            continue

        key = make_name_key(first_name, last_name)
        if not key:
            problematic.append(
                {
                    **base,
                    "reason": "empty_normalized_key",
                    "normalized_key": "",
                    "db_match_count": 0,
                    "db_ids": "",
                    "db_first_name": "",
                    "db_last_name": "",
                }
            )
            continue

        if key in seen_csv_keys:
            problematic.append(
                {
                    **base,
                    "reason": "duplicate_in_fasynation_csv",
                    "normalized_key": key,
                    "db_match_count": 0,
                    "db_ids": "",
                    "db_first_name": "",
                    "db_last_name": "",
                }
            )
            continue

        seen_csv_keys.add(key)

        matches = db_index.get(key, [])
        db_ids = "|".join(str(x["db_id"]) for x in matches)

        if matches:
            existing.append(
                {
                    **base,
                    "normalized_key": key,
                    "db_match_count": len(matches),
                    "db_ids": db_ids,
                    "db_first_name": matches[0]["db_first_name"],
                    "db_last_name": matches[0]["db_last_name"],
                }
            )
        else:
            new.append(
                {
                    **base,
                    "normalized_key": key,
                    "db_match_count": 0,
                    "db_ids": "",
                    "db_first_name": "",
                    "db_last_name": "",
                }
            )

    return existing, new, problematic


# -------------------------
# Main
# -------------------------
def main() -> None:
    print("=== FASYNATION NAME CHECK ===")
    print(f"SCRIPT : {Path(__file__).resolve()}")
    print(f"ENV    : {ENV_PATH}")
    print(f"INPUT  : {FASYNATION_PATH}")
    print(f"TABLE  : {DB_TABLE}")
    print()

    print("Loading Fasynation CSV ...")
    csv_rows = load_fasynation_csv(FASYNATION_PATH)
    print(f"CSV rows loaded: {len(csv_rows)}")

    db = DB()
    try:
        print("DB connected ✅")
        print(f"Loading existing names from {DB_TABLE} ...")
        db_index, db_total, db_skipped_empty = load_db_name_index(db.conn, DB_TABLE)

        print(f"DB rows scanned           : {db_total}")
        print(f"DB rows skipped(no names) : {db_skipped_empty}")
        print(f"DB unique normalized keys : {len(db_index)}")

        print("Matching rows ...")
        existing, new, problematic = classify_rows(csv_rows, db_index)

        existing_fields = [
            "line_no",
            "Nr",
            "Dr",
            "Vorname",
            "Nachname",
            "PLZ",
            "Land",
            "Link",
            "Fernberatung",
            "Fachrichtung",
            "normalized_key",
            "db_match_count",
            "db_ids",
            "db_first_name",
            "db_last_name",
        ]
        new_fields = [
            "line_no",
            "Nr",
            "Dr",
            "Vorname",
            "Nachname",
            "PLZ",
            "Land",
            "Link",
            "Fernberatung",
            "Fachrichtung",
            "normalized_key",
            "db_match_count",
            "db_ids",
            "db_first_name",
            "db_last_name",
        ]
        problematic_fields = [
            "line_no",
            "Nr",
            "Dr",
            "Vorname",
            "Nachname",
            "PLZ",
            "Land",
            "Link",
            "Fernberatung",
            "Fachrichtung",
            "reason",
            "normalized_key",
            "db_match_count",
            "db_ids",
            "db_first_name",
            "db_last_name",
        ]

        write_csv(OUT_EXISTING, existing, existing_fields)
        write_csv(OUT_NEW, new, new_fields)
        write_csv(OUT_PROBLEMATIC, problematic, problematic_fields)

        print()
        print(f"Existing   : {len(existing)} -> {OUT_EXISTING}")
        print(f"New        : {len(new)} -> {OUT_NEW}")
        print(f"Problematic: {len(problematic)} -> {OUT_PROBLEMATIC}")

        print()
        print("---- Summary ----")
        print(f"csv_rows                  : {len(csv_rows)}")
        print(f"existing                  : {len(existing)}")
        print(f"new                       : {len(new)}")
        print(f"problematic               : {len(problematic)}")

        db.rollback()
        print("DRY RUN ✅ (nur Check, keine Änderungen an DB)")

    except MySQLError as e:
        db.rollback()
        print(f"ERROR MySQL: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception:
        db.rollback()
        traceback.print_exc()
        sys.exit(2)
    finally:
        db.close()
        print("DB connection closed.")


if __name__ == "__main__":
    main()
