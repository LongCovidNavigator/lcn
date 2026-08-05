#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import Fasynation into *_03 tables.

Input:
- fasynation_match_new.csv
- fasynation_match_problematic.csv

Behavior:
- imports match_new + match_problematic
- skips already existing DB entries
- deterministic mapping for problematic cases
- Fernberatung is mapped as badge term

Modes:
- default      -> DRY RUN (rollback)
- --commit     -> COMMIT

ENV (.env):
- LCN_DB_HOST
- LCN_DB_PORT
- LCN_DB_USERNAME
- LCN_DB_PASSWORD
- LCN_DB_DATABASE
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import traceback
from pathlib import Path
from lcn_env import lcn_env_path
from typing import Any, Dict, List, Optional, Tuple

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

MATCH_NEW_CANDIDATES = [
    BASE_DIR / "fasynation_match_new.csv",
    Path("/mnt/data/fasynation_match_new.csv"),
]
MATCH_PROBLEMATIC_CANDIDATES = [
    BASE_DIR / "fasynation_match_problematic.csv",
    Path("/mnt/data/fasynation_match_problematic.csv"),
]

MATCH_NEW_PATH = next((p for p in MATCH_NEW_CANDIDATES if p.exists()), MATCH_NEW_CANDIDATES[0])
MATCH_PROBLEMATIC_PATH = next((p for p in MATCH_PROBLEMATIC_CANDIDATES if p.exists()), MATCH_PROBLEMATIC_CANDIDATES[0])

SKIPPED_LOG_PATH = BASE_DIR / "skipped_fasynation_03.json"

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
# Helpers / normalization
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
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() == "nan":
        return ""
    return norm_ws(s)


def norm_name_key(s: Any) -> str:
    s = norm_ws(s).lower()
    if not s:
        return ""
    for a, b in UML_MAP:
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def make_person_key(first_name: Any, last_name: Any) -> str:
    f = norm_name_key(first_name)
    l = norm_name_key(last_name)
    if f and l:
        return f"{f}|{l}"
    return ""


def make_last_only_key(last_name: Any) -> str:
    l = norm_name_key(last_name)
    return l if l else ""


def make_org_key(org_name: Any) -> str:
    return norm_name_key(org_name)


def dr_flag_to_title(value: Any) -> Tuple[int, Optional[str]]:
    v = safe_str(value).lower()
    if v == "ja":
        return 1, "Dr."
    return 0, None


def make_display_name(title_raw: Optional[str], firstname: Optional[str], lastname: Optional[str], org_name: Optional[str]) -> str:
    if safe_str(org_name):
        return safe_str(org_name)
    bits = [safe_str(title_raw), safe_str(firstname), safe_str(lastname)]
    return " ".join([b for b in bits if b]).strip()


def normalize_country(value: Any) -> Optional[str]:
    v = safe_str(value)
    return v or None


def maybe_location_exists(country: Optional[str], plz: Optional[str], website: Optional[str]) -> bool:
    return bool(safe_str(country) or safe_str(plz) or safe_str(website))


def fernberatung_offered(value: Any) -> bool:
    v = safe_str(value).lower()
    return v in {"ja", "yes", "true", "1", "x"}


def read_csv_rows(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"CSV nicht gefunden: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        return [dict(r) for r in reader]


def append_skipped_log(entries: List[Dict[str, Any]]) -> None:
    try:
        existing: List[Dict[str, Any]] = []
        if SKIPPED_LOG_PATH.exists():
            existing = json.loads(SKIPPED_LOG_PATH.read_text(encoding="utf-8"))
            if not isinstance(existing, list):
                existing = []
        existing.extend(entries)
        SKIPPED_LOG_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


# -------------------------
# Deterministic problematic mapping
# -------------------------
PROBLEMATIC_MAPPING: Dict[str, Dict[str, Any]] = {
    "Schmerzzentrum Berlin": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Schmerzzentrum Berlin"},
    "Gemeinschaftspraxis Sterup": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Gemeinschaftspraxis Sterup"},
    "Hausarztpraxis Dufayet": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Hausarztpraxis Dufayet"},
    "Medissimo Arztpraxis": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Medissimo Arztpraxis"},
    "Habichtswaldklinik": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Habichtswaldklinik"},
    "Naturheilzentrum Breidenbach": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Naturheilzentrum Breidenbach"},
    "Uniklinik Mainz": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Uniklinik Mainz"},
    "Gesundheitszentrum Striller": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Gesundheitszentrum Striller"},
    "Rehaklinik Glotterbad": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Rehaklinik Glotterbad"},
    "Spezialklinik Neukirchen": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Spezialklinik Neukirchen"},
    "Schnakenberg / IPGD": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Schnakenberg / IPGD"},
    "Zillgens / Praganzmed-Praxis": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Zillgens / Praganzmed-Praxis"},
    "Hellstern bei Medivitum": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Hellstern bei Medivitum"},
    "Lembens & Lembens": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Lembens & Lembens"},
    "Blehe und Team": {"mode": "org", "dr_firstname": None, "dr_lastname": None, "dr_org_name": "Blehe und Team"},

    "Wolfgang Ries": {"mode": "person", "dr_firstname": "Wolfgang", "dr_lastname": "Ries", "dr_org_name": None},
    "M. Hechler": {"mode": "person", "dr_firstname": "M.", "dr_lastname": "Hechler", "dr_org_name": None},
    "B. Luchting (Leitung)": {"mode": "person", "dr_firstname": "B.", "dr_lastname": "Luchting", "dr_org_name": None},
    "Klaus Schmidt-Thomé": {"mode": "person", "dr_firstname": "Klaus", "dr_lastname": "Schmidt-Thomé", "dr_org_name": None},

    "Wunder": {"mode": "person_last_only", "dr_firstname": None, "dr_lastname": "Wunder", "dr_org_name": None},
    "Stark": {"mode": "person_last_only", "dr_firstname": None, "dr_lastname": "Stark", "dr_org_name": None},
    "Bückendorf": {"mode": "person_last_only", "dr_firstname": None, "dr_lastname": "Bückendorf", "dr_org_name": None},
    "Schrieck": {"mode": "person_last_only", "dr_firstname": None, "dr_lastname": "Schrieck", "dr_org_name": None},
    "Couckuyt": {"mode": "person_last_only", "dr_firstname": None, "dr_lastname": "Couckuyt", "dr_org_name": None},
}


# -------------------------
# Terms
# -------------------------
REMOTE_TERM_TYPE = "badge"
REMOTE_TERM_CODE = "remote-consultation"
REMOTE_TERM_LABEL = "Fernberatung"


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

    def q1(self, sql: str, params: Tuple[Any, ...] = ()) -> Optional[Tuple[Any, ...]]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        cur.close()
        return row

    def qall(self, sql: str, params: Tuple[Any, ...] = ()) -> List[Tuple[Any, ...]]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.close()
        return rows

    def exec(self, sql: str, params: Tuple[Any, ...] = ()) -> int:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        last = cur.lastrowid
        cur.close()
        return last

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()


# -------------------------
# Source / existing DB state
# -------------------------
def ensure_source_fasynation(db: DB) -> int:
    db.exec(
        "INSERT IGNORE INTO tbl_sources_03 (source_code, source_name) VALUES (%s,%s)",
        ("fasynation", "FASYNATION"),
    )
    row = db.q1("SELECT source_id FROM tbl_sources_03 WHERE source_code=%s", ("fasynation",))
    if not row:
        raise RuntimeError("source_id missing for fasynation in tbl_sources_03")
    return int(row[0])


def load_existing_indexes(db: DB) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    rows = db.qall(
        """
        SELECT
            dr_id,
            dr_firstname,
            dr_lastname,
            dr_org_name
        FROM tbl_drs_03
        """
    )

    person_idx: Dict[str, List[Dict[str, Any]]] = {}
    last_only_idx: Dict[str, List[Dict[str, Any]]] = {}
    org_idx: Dict[str, List[Dict[str, Any]]] = {}

    for dr_id, dr_firstname, dr_lastname, dr_org_name in rows:
        fn = safe_str(dr_firstname)
        ln = safe_str(dr_lastname)
        org = safe_str(dr_org_name)

        if fn and ln:
            key = make_person_key(fn, ln)
            if key:
                person_idx.setdefault(key, []).append({
                    "dr_id": int(dr_id),
                    "dr_firstname": fn,
                    "dr_lastname": ln,
                    "dr_org_name": org,
                })

        if (not fn) and ln:
            key = make_last_only_key(ln)
            if key:
                last_only_idx.setdefault(key, []).append({
                    "dr_id": int(dr_id),
                    "dr_firstname": fn,
                    "dr_lastname": ln,
                    "dr_org_name": org,
                })

        if org:
            key = make_org_key(org)
            if key:
                org_idx.setdefault(key, []).append({
                    "dr_id": int(dr_id),
                    "dr_firstname": fn,
                    "dr_lastname": ln,
                    "dr_org_name": org,
                })

    return {
        "person_idx": person_idx,
        "last_only_idx": last_only_idx,
        "org_idx": org_idx,
    }


def load_existing_source_links(db: DB, source_id: int) -> Dict[str, int]:
    rows = db.qall(
        """
        SELECT external_id, dr_id
        FROM tbl_drs_sources_03
        WHERE source_id=%s
        """,
        (source_id,),
    )
    return {str(ext): int(dr_id) for ext, dr_id in rows}


# -------------------------
# Terms / inserts
# -------------------------
def upsert_term(db: DB, term_type: str, code: str, label: str) -> int:
    row = db.q1(
        "SELECT term_id FROM tbl_terms_03 WHERE term_type=%s AND term_code=%s",
        (term_type, code),
    )
    if row:
        term_id = int(row[0])
        db.exec(
            "UPDATE tbl_terms_03 SET term_label=%s WHERE term_id=%s",
            (label, term_id),
        )
        return term_id

    return db.exec(
        "INSERT INTO tbl_terms_03 (term_type, term_code, term_label) VALUES (%s,%s,%s)",
        (term_type, code, label),
    )


def link_term(db: DB, dr_id: int, term_id: int, source_id: int) -> None:
    db.exec(
        "INSERT IGNORE INTO tbl_cpl_drs2terms_03 (dr_id, term_id, source_id, confidence) VALUES (%s,%s,%s,'high')",
        (dr_id, term_id, source_id),
    )


def insert_dr(db: DB, candidate: Dict[str, Any]) -> int:
    return db.exec(
        """
        INSERT INTO tbl_drs_03
          (dr_type, dr_is_dr, dr_title_raw, dr_firstname, dr_lastname, dr_org_name,
           dr_display_name, dr_website, dr_email, dr_accepts_gkv, dr_accepts_pkv, dr_notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            candidate.get("dr_type"),
            int(candidate.get("dr_is_dr", 0)),
            candidate.get("dr_title_raw"),
            candidate.get("dr_firstname"),
            candidate.get("dr_lastname"),
            candidate.get("dr_org_name"),
            candidate.get("dr_display_name"),
            candidate.get("dr_website"),
            candidate.get("dr_email"),
            candidate.get("dr_accepts_gkv"),
            candidate.get("dr_accepts_pkv"),
            candidate.get("dr_notes"),
        ),
    )


def upsert_source_row(db: DB, dr_id: int, source_id: int, candidate: Dict[str, Any]) -> None:
    db.exec(
        """
        INSERT INTO tbl_drs_sources_03 (dr_id, source_id, external_id, source_url, payload_json)
        VALUES (%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          dr_id = VALUES(dr_id),
          source_url = COALESCE(VALUES(source_url), source_url),
          payload_json = COALESCE(VALUES(payload_json), payload_json)
        """,
        (dr_id, source_id, candidate.get("external_id"), candidate.get("source_url"), candidate.get("payload_json")),
    )


def ensure_votes(db: DB, dr_id: int) -> None:
    db.exec(
        "INSERT IGNORE INTO tbl_drs_votes_03 (dr_id, vote_improved, vote_neutral, vote_worsened) VALUES (%s,0,0,0)",
        (dr_id,),
    )


def insert_location_if_missing(db: DB, dr_id: int, candidate: Dict[str, Any]) -> None:
    if not maybe_location_exists(candidate.get("loc_country"), candidate.get("loc_plz"), candidate.get("dr_website")):
        return

    row = db.q1(
        """
        SELECT loc_id FROM tbl_drs_locations_03
        WHERE dr_id=%s
          AND COALESCE(loc_country,'')=COALESCE(%s,'')
          AND COALESCE(loc_plz,'')=COALESCE(%s,'')
          AND COALESCE(loc_city,'')=COALESCE(%s,'')
          AND COALESCE(loc_street,'')=COALESCE(%s,'')
          AND COALESCE(loc_housenumber,'')=COALESCE(%s,'')
        LIMIT 1
        """,
        (
            dr_id,
            candidate.get("loc_country"),
            candidate.get("loc_plz"),
            None,
            None,
            None,
        ),
    )

    if row:
        loc_id = int(row[0])
        db.exec(
            """
            UPDATE tbl_drs_locations_03
            SET
              loc_website = COALESCE(loc_website, %s),
              loc_address_visibility = COALESCE(loc_address_visibility, %s),
              loc_is_primary = CASE
                WHEN loc_is_primary = 0 THEN 1
                ELSE loc_is_primary
              END
            WHERE loc_id = %s
            """,
            (
                candidate.get("dr_website"),
                "partial",
                loc_id,
            ),
        )
        return

    db.exec(
        """
        INSERT INTO tbl_drs_locations_03
          (dr_id, loc_label, loc_is_primary, loc_country, loc_plz, loc_city, loc_street, loc_housenumber,
           loc_phone, loc_email, loc_website, loc_lat, loc_lng, loc_address_visibility, loc_geo_type)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            dr_id,
            None,
            1,
            candidate.get("loc_country"),
            candidate.get("loc_plz"),
            None,
            None,
            None,
            None,
            None,
            candidate.get("dr_website"),
            None,
            None,
            "partial",
            None,
        ),
    )


# -------------------------
# Candidate mapping
# -------------------------
def map_new_row(row: Dict[str, Any]) -> Dict[str, Any]:
    dr_is_dr, dr_title_raw = dr_flag_to_title(row.get("Dr"))
    dr_firstname = safe_str(row.get("Vorname")) or None
    dr_lastname = safe_str(row.get("Nachname")) or None
    dr_org_name = None

    return {
        "candidate_type": "new",
        "raw_name_used": f"{safe_str(row.get('Vorname'))} {safe_str(row.get('Nachname'))}".strip(),
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": dr_is_dr,
        "dr_title_raw": dr_title_raw,
        "dr_firstname": dr_firstname,
        "dr_lastname": dr_lastname,
        "dr_org_name": dr_org_name,
        "dr_display_name": make_display_name(dr_title_raw, dr_firstname, dr_lastname, dr_org_name),
        "dr_website": safe_str(row.get("Link")) or None,
        "dr_email": None,
        "dr_accepts_gkv": None,
        "dr_accepts_pkv": None,
        "dr_notes": None,
        "loc_country": normalize_country(row.get("Land")),
        "loc_plz": safe_str(row.get("PLZ")) or None,
        "source_url": safe_str(row.get("Link")) or None,
        "external_id": f"fasynation:{safe_str(row.get('Nr'))}",
        "payload_json": json.dumps(row, ensure_ascii=False),
        "source_reason": "",
        "has_remote_consultation": fernberatung_offered(row.get("Fernberatung")),
    }


def map_problematic_row(row: Dict[str, Any]) -> Dict[str, Any]:
    raw_name = safe_str(row.get("Nachname")) or safe_str(row.get("Vorname"))
    mapped = PROBLEMATIC_MAPPING.get(raw_name)
    if not mapped:
        raise RuntimeError(f"Problematic name not mapped: {raw_name}")

    source_reason = safe_str(row.get("reason"))

    if mapped["mode"] == "org":
        dr_is_dr = 0
        dr_title_raw = None
    else:
        dr_is_dr, dr_title_raw = dr_flag_to_title(row.get("Dr"))

    return {
        "candidate_type": "problematic",
        "raw_name_used": raw_name,
        "mode": mapped["mode"],
        "dr_type": None,
        "dr_is_dr": dr_is_dr,
        "dr_title_raw": dr_title_raw,
        "dr_firstname": mapped.get("dr_firstname"),
        "dr_lastname": mapped.get("dr_lastname"),
        "dr_org_name": mapped.get("dr_org_name"),
        "dr_display_name": make_display_name(
            dr_title_raw,
            mapped.get("dr_firstname"),
            mapped.get("dr_lastname"),
            mapped.get("dr_org_name"),
        ),
        "dr_website": safe_str(row.get("Link")) or None,
        "dr_email": None,
        "dr_accepts_gkv": None,
        "dr_accepts_pkv": None,
        "dr_notes": None,
        "loc_country": normalize_country(row.get("Land")),
        "loc_plz": safe_str(row.get("PLZ")) or None,
        "source_url": safe_str(row.get("Link")) or None,
        "external_id": f"fasynation:{safe_str(row.get('Nr'))}",
        "payload_json": json.dumps({"source_row": row, "mapped": mapped}, ensure_ascii=False),
        "source_reason": source_reason,
        "has_remote_consultation": fernberatung_offered(row.get("Fernberatung")),
    }


def candidate_exists(candidate: Dict[str, Any], indexes: Dict[str, Dict[str, List[Dict[str, Any]]]], linked_ext: Dict[str, int]) -> Tuple[bool, str, Optional[int]]:
    ext_id = candidate["external_id"]
    if ext_id in linked_ext:
        return True, "source_already_linked", linked_ext[ext_id]

    mode = candidate["mode"]

    if mode == "person":
        key = make_person_key(candidate.get("dr_firstname"), candidate.get("dr_lastname"))
        matches = indexes["person_idx"].get(key, []) if key else []
        if matches:
            return True, "name_already_in_db", matches[0]["dr_id"]
        return False, "", None

    if mode == "person_last_only":
        key = make_last_only_key(candidate.get("dr_lastname"))
        matches = indexes["last_only_idx"].get(key, []) if key else []
        if matches:
            return True, "lastname_only_already_in_db", matches[0]["dr_id"]
        return False, "", None

    if mode == "org":
        key = make_org_key(candidate.get("dr_org_name"))
        matches = indexes["org_idx"].get(key, []) if key else []
        if matches:
            return True, "org_already_in_db", matches[0]["dr_id"]
        return False, "", None

    raise RuntimeError(f"Unknown mode: {mode}")


# -------------------------
# CLI
# -------------------------
def parse_args() -> Dict[str, Any]:
    args = {"commit": False}
    for a in sys.argv[1:]:
        if a == "--commit":
            args["commit"] = True
        else:
            print(f"WARNING: Unbekanntes Argument ignoriert: {a}")
    return args


# -------------------------
# Main
# -------------------------
def main() -> None:
    args = parse_args()
    commit = args["commit"]

    print("=== FASYNATION IMPORT _03 ===")
    print(f"ENV                : {ENV_PATH}")
    print(f"MATCH_NEW          : {MATCH_NEW_PATH}")
    print(f"MATCH_PROBLEMATIC  : {MATCH_PROBLEMATIC_PATH}")
    print(f"MODE               : {'COMMIT' if commit else 'DRY RUN'}")
    print()

    new_rows = read_csv_rows(MATCH_NEW_PATH)
    problematic_rows = read_csv_rows(MATCH_PROBLEMATIC_PATH)

    print(f"Loaded fasynation_match_new.csv         : {len(new_rows)}")
    print(f"Loaded fasynation_match_problematic.csv : {len(problematic_rows)}")

    db = DB()
    skipped_log: List[Dict[str, Any]] = []

    try:
        source_id = ensure_source_fasynation(db)
        indexes = load_existing_indexes(db)
        linked_ext = load_existing_source_links(db, source_id)

        print(f"source_id(fasynation): {source_id}")
        print(f"existing source links: {len(linked_ext)}")

        remote_term_id = upsert_term(db, REMOTE_TERM_TYPE, REMOTE_TERM_CODE, REMOTE_TERM_LABEL)
        print(f"remote term id       : {remote_term_id}")

        stats = {
            "candidates_new": 0,
            "candidates_problematic": 0,
            "imported": 0,
            "skipped_existing": 0,
            "term_links_added": 0,
        }

        all_candidates: List[Dict[str, Any]] = []

        for row in new_rows:
            stats["candidates_new"] += 1
            all_candidates.append(map_new_row(row))

        for row in problematic_rows:
            stats["candidates_problematic"] += 1
            all_candidates.append(map_problematic_row(row))

        for idx, candidate in enumerate(all_candidates, start=1):
            exists, reason, existing_dr_id = candidate_exists(candidate, indexes, linked_ext)

            if exists:
                stats["skipped_existing"] += 1
                skipped_log.append({
                    "reason": reason,
                    "existing_dr_id": existing_dr_id,
                    "external_id": candidate.get("external_id"),
                    "candidate_type": candidate.get("candidate_type"),
                    "raw_name_used": candidate.get("raw_name_used"),
                    "mode": candidate.get("mode"),
                })
                continue

            dr_id = insert_dr(db, candidate)
            upsert_source_row(db, dr_id, source_id, candidate)
            ensure_votes(db, dr_id)
            insert_location_if_missing(db, dr_id, candidate)

            if candidate.get("has_remote_consultation"):
                link_term(db, dr_id, remote_term_id, source_id)
                stats["term_links_added"] += 1

            mode = candidate["mode"]
            if mode == "person":
                key = make_person_key(candidate.get("dr_firstname"), candidate.get("dr_lastname"))
                if key:
                    indexes["person_idx"].setdefault(key, []).append({"dr_id": dr_id})
            elif mode == "person_last_only":
                key = make_last_only_key(candidate.get("dr_lastname"))
                if key:
                    indexes["last_only_idx"].setdefault(key, []).append({"dr_id": dr_id})
            elif mode == "org":
                key = make_org_key(candidate.get("dr_org_name"))
                if key:
                    indexes["org_idx"].setdefault(key, []).append({"dr_id": dr_id})

            linked_ext[candidate["external_id"]] = dr_id
            stats["imported"] += 1

            print(f"Imported: {candidate.get('external_id')} | {candidate.get('raw_name_used')} | dr_id={dr_id}")

            if idx % 25 == 0:
                print(f"... {idx}/{len(all_candidates)} processed | imported={stats['imported']} skipped={stats['skipped_existing']}")

        if skipped_log:
            append_skipped_log(skipped_log)
            print(f"Wrote log (append): {SKIPPED_LOG_PATH} (+{len(skipped_log)} entries)")

        if commit:
            db.commit()
            print("COMMIT ✅")
        else:
            db.rollback()
            print("DRY RUN ✅ (rollback)")

        print("---- Summary ----")
        for k, v in stats.items():
            print(f"{k:24s}: {v}")

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


if __name__ == "__main__":
    main()
