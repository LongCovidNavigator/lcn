#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Preview import of Fasynation into *_03 tables.

Input:
- fasynation_match_new.csv
- fasynation_match_problematic.csv

Behavior:
- match_new + match_problematic are candidates for import
- already existing DB entries are skipped
- creates preview CSVs for the rows that WOULD be inserted
- Fernberatung is mapped as a badge term instead of dr_notes

Output dir:
- preview_fasynation_03/
    - preview_tbl_drs_03.csv
    - preview_tbl_drs_locations_03.csv
    - preview_tbl_drs_sources_03.csv
    - preview_tbl_drs_votes_03.csv
    - preview_tbl_sources_03.csv          (only if source missing)
    - preview_new_terms_03.csv
    - preview_tbl_cpl_drs2terms_03.csv
    - preview_skipped_existing.csv
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

PREVIEW_DIR = BASE_DIR / "preview_fasynation_03"

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


# -------------------------
# Deterministic problematic mapping
# -------------------------
PROBLEMATIC_MAPPING: Dict[str, Dict[str, Any]] = {
    # org
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

    # persons
    "Wolfgang Ries": {"mode": "person", "dr_firstname": "Wolfgang", "dr_lastname": "Ries", "dr_org_name": None},
    "M. Hechler": {"mode": "person", "dr_firstname": "M.", "dr_lastname": "Hechler", "dr_org_name": None},
    "B. Luchting (Leitung)": {"mode": "person", "dr_firstname": "B.", "dr_lastname": "Luchting", "dr_org_name": None},
    "Klaus Schmidt-Thomé": {"mode": "person", "dr_firstname": "Klaus", "dr_lastname": "Schmidt-Thomé", "dr_org_name": None},

    # lastname only
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

    def rollback(self) -> None:
        self.conn.rollback()


# -------------------------
# CSV helpers
# -------------------------
def read_csv_rows(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"CSV nicht gefunden: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        return [dict(r) for r in reader]


def ensure_preview_dir() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)


def write_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return

    fieldnames = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        w.writeheader()
        w.writerows(rows)


def dedupe_rows(rows: List[Dict[str, Any]], key_fields: List[str]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for row in rows:
        key = tuple(row.get(k) for k in key_fields)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


# -------------------------
# Source / existing DB state
# -------------------------
def get_source_id(db: DB, source_code: str = "fasynation") -> Optional[int]:
    row = db.q1("SELECT source_id FROM tbl_sources_03 WHERE source_code=%s", (source_code,))
    return int(row[0]) if row else None


def get_max_dr_id(db: DB) -> int:
    row = db.q1("SELECT COALESCE(MAX(dr_id), 0) FROM tbl_drs_03")
    return int(row[0]) if row else 0


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


def load_existing_source_links(db: DB, source_id: Optional[int]) -> Dict[str, int]:
    if source_id is None:
        return {}

    rows = db.qall(
        """
        SELECT external_id, dr_id
        FROM tbl_drs_sources_03
        WHERE source_id=%s
        """,
        (source_id,),
    )
    return {str(ext): int(dr_id) for ext, dr_id in rows}


def load_existing_terms(db: DB) -> Dict[Tuple[str, str], Dict[str, Any]]:
    rows = db.qall(
        """
        SELECT term_id, term_type, term_code, term_label, term_desc
        FROM tbl_terms_03
        """
    )

    out: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for term_id, term_type, term_code, term_label, term_desc in rows:
        out[(str(term_type), str(term_code))] = {
            "term_id": int(term_id),
            "term_type": str(term_type),
            "term_code": str(term_code),
            "term_label": term_label,
            "term_desc": term_desc,
        }
    return out


# -------------------------
# Candidate mapping
# -------------------------
def map_new_row(row: Dict[str, Any]) -> Dict[str, Any]:
    dr_is_dr, dr_title_raw = dr_flag_to_title(row.get("Dr"))
    dr_firstname = safe_str(row.get("Vorname")) or None
    dr_lastname = safe_str(row.get("Nachname")) or None
    dr_org_name = None
    fachrichtung = safe_str(row.get("Fachrichtung")) or None

    dr_display_name = make_display_name(dr_title_raw, dr_firstname, dr_lastname, dr_org_name)

    return {
        "candidate_type": "new",
        "raw_name_used": f"{safe_str(row.get('Vorname'))} {safe_str(row.get('Nachname'))}".strip(),
        "mode": "person",
        "dr_type": fachrichtung,
        "dr_is_dr": dr_is_dr,
        "dr_title_raw": dr_title_raw,
        "dr_firstname": dr_firstname,
        "dr_lastname": dr_lastname,
        "dr_org_name": dr_org_name,
        "dr_display_name": dr_display_name,
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

    fachrichtung = safe_str(row.get("Fachrichtung")) or None
    source_reason = safe_str(row.get("reason"))

    if mapped["mode"] == "org":
        dr_is_dr = 0
        dr_title_raw = None
    else:
        dr_is_dr, dr_title_raw = dr_flag_to_title(row.get("Dr"))

    dr_display_name = make_display_name(
        dr_title_raw,
        mapped.get("dr_firstname"),
        mapped.get("dr_lastname"),
        mapped.get("dr_org_name"),
    )

    return {
        "candidate_type": "problematic",
        "raw_name_used": raw_name,
        "mode": mapped["mode"],
        "dr_type": fachrichtung,
        "dr_is_dr": dr_is_dr,
        "dr_title_raw": dr_title_raw,
        "dr_firstname": mapped.get("dr_firstname"),
        "dr_lastname": mapped.get("dr_lastname"),
        "dr_org_name": mapped.get("dr_org_name"),
        "dr_display_name": dr_display_name,
        "dr_website": safe_str(row.get("Link")) or None,
        "dr_email": None,
        "dr_accepts_gkv": None,
        "dr_accepts_pkv": None,
        "dr_notes": None,
        "loc_country": normalize_country(row.get("Land")),
        "loc_plz": safe_str(row.get("PLZ")) or None,
        "source_url": safe_str(row.get("Link")) or None,
        "external_id": f"fasynation:{safe_str(row.get('Nr'))}",
        "payload_json": json.dumps({
            "source_row": row,
            "mapped": mapped,
        }, ensure_ascii=False),
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
# Preview collection
# -------------------------
def ensure_remote_term_preview(
    candidate: Dict[str, Any],
    dr_id: int,
    source_id: Optional[int],
    preview: Dict[str, List[Dict[str, Any]]],
    existing_terms: Dict[Tuple[str, str], Dict[str, Any]],
    fake_term_ids: Dict[Tuple[str, str], int],
    next_fake_term_id_ref: Dict[str, int],
) -> None:
    if not candidate.get("has_remote_consultation"):
        return

    term_key = (REMOTE_TERM_TYPE, REMOTE_TERM_CODE)
    existing = existing_terms.get(term_key)

    if existing:
        term_id = existing["term_id"]
    else:
        if term_key not in fake_term_ids:
            fake_term_ids[term_key] = next_fake_term_id_ref["value"]
            next_fake_term_id_ref["value"] += 1

            preview["new_terms"].append({
                "term_id": fake_term_ids[term_key],
                "term_type": REMOTE_TERM_TYPE,
                "term_code": REMOTE_TERM_CODE,
                "term_label": REMOTE_TERM_LABEL,
                "term_desc": None,
            })

        term_id = fake_term_ids[term_key]

    preview["cpl_terms"].append({
        "dr_id": dr_id,
        "term_id": term_id,
        "source_id": source_id if source_id is not None else "__MISSING__",
        "confidence": "high",
        "created_at": None,
        "term_type": REMOTE_TERM_TYPE,
        "term_code": REMOTE_TERM_CODE,
        "term_label": REMOTE_TERM_LABEL,
        "candidate_type": candidate.get("candidate_type"),
        "raw_name_used": candidate.get("raw_name_used"),
    })


def collect_preview_rows(
    candidate: Dict[str, Any],
    dr_id: int,
    source_id: Optional[int],
    preview: Dict[str, List[Dict[str, Any]]],
    existing_terms: Dict[Tuple[str, str], Dict[str, Any]],
    fake_term_ids: Dict[Tuple[str, str], int],
    next_fake_term_id_ref: Dict[str, int],
) -> None:
    preview["drs"].append({
        "dr_id": dr_id,
        "dr_type": candidate.get("dr_type"),
        "dr_is_dr": candidate.get("dr_is_dr"),
        "dr_title_raw": candidate.get("dr_title_raw"),
        "dr_firstname": candidate.get("dr_firstname"),
        "dr_lastname": candidate.get("dr_lastname"),
        "dr_org_name": candidate.get("dr_org_name"),
        "dr_display_name": candidate.get("dr_display_name"),
        "dr_website": candidate.get("dr_website"),
        "dr_email": candidate.get("dr_email"),
        "dr_accepts_gkv": candidate.get("dr_accepts_gkv"),
        "dr_accepts_pkv": candidate.get("dr_accepts_pkv"),
        "dr_notes": candidate.get("dr_notes"),
        "candidate_type": candidate.get("candidate_type"),
        "raw_name_used": candidate.get("raw_name_used"),
        "source_reason": candidate.get("source_reason"),
    })

    if maybe_location_exists(candidate.get("loc_country"), candidate.get("loc_plz"), candidate.get("dr_website")):
        preview["locations"].append({
            "loc_id": None,
            "dr_id": dr_id,
            "loc_label": None,
            "loc_is_primary": 1,
            "loc_country": candidate.get("loc_country"),
            "loc_plz": candidate.get("loc_plz"),
            "loc_city": None,
            "loc_street": None,
            "loc_housenumber": None,
            "loc_phone": None,
            "loc_email": None,
            "loc_website": candidate.get("dr_website"),
            "loc_lat": None,
            "loc_lng": None,
            "loc_address_visibility": "partial",
            "loc_geo_type": None,
            "created_at": None,
            "candidate_type": candidate.get("candidate_type"),
            "raw_name_used": candidate.get("raw_name_used"),
        })

    preview["sources"].append({
        "dr_source_id": None,
        "dr_id": dr_id,
        "source_id": source_id if source_id is not None else "__MISSING__",
        "external_id": candidate.get("external_id"),
        "source_url": candidate.get("source_url"),
        "payload_json": candidate.get("payload_json"),
        "created_at": None,
        "candidate_type": candidate.get("candidate_type"),
        "raw_name_used": candidate.get("raw_name_used"),
    })

    preview["votes"].append({
        "dr_id": dr_id,
        "vote_improved": 0,
        "vote_neutral": 0,
        "vote_worsened": 0,
        "updated_at": None,
        "candidate_type": candidate.get("candidate_type"),
        "raw_name_used": candidate.get("raw_name_used"),
    })

    ensure_remote_term_preview(
        candidate=candidate,
        dr_id=dr_id,
        source_id=source_id,
        preview=preview,
        existing_terms=existing_terms,
        fake_term_ids=fake_term_ids,
        next_fake_term_id_ref=next_fake_term_id_ref,
    )


def flush_preview_rows(preview: Dict[str, List[Dict[str, Any]]]) -> None:
    ensure_preview_dir()

    drs = dedupe_rows(preview["drs"], ["dr_id"])
    locations = dedupe_rows(preview["locations"], ["dr_id", "loc_country", "loc_plz", "loc_website"])
    sources = dedupe_rows(preview["sources"], ["dr_id", "external_id"])
    votes = dedupe_rows(preview["votes"], ["dr_id"])
    skipped = dedupe_rows(preview["skipped"], ["external_id", "skip_reason", "existing_dr_id"])
    source_preview = dedupe_rows(preview["source_table"], ["source_code"])
    cpl_terms = dedupe_rows(preview["cpl_terms"], ["dr_id", "term_id", "source_id"])
    new_terms = dedupe_rows(preview["new_terms"], ["term_id"])

    write_csv(PREVIEW_DIR / "preview_tbl_drs_03.csv", drs)
    write_csv(PREVIEW_DIR / "preview_tbl_drs_locations_03.csv", locations)
    write_csv(PREVIEW_DIR / "preview_tbl_drs_sources_03.csv", sources)
    write_csv(PREVIEW_DIR / "preview_tbl_drs_votes_03.csv", votes)
    write_csv(PREVIEW_DIR / "preview_tbl_sources_03.csv", source_preview)
    write_csv(PREVIEW_DIR / "preview_tbl_cpl_drs2terms_03.csv", cpl_terms)
    write_csv(PREVIEW_DIR / "preview_new_terms_03.csv", new_terms)
    write_csv(PREVIEW_DIR / "preview_skipped_existing.csv", skipped)

    print(f"Preview written to: {PREVIEW_DIR}")


# -------------------------
# Main
# -------------------------
def main() -> None:
    print("=== FASYNATION PREVIEW IMPORT _03 ===")
    print(f"ENV                : {ENV_PATH}")
    print(f"MATCH_NEW          : {MATCH_NEW_PATH}")
    print(f"MATCH_PROBLEMATIC  : {MATCH_PROBLEMATIC_PATH}")
    print(f"PREVIEW_DIR        : {PREVIEW_DIR}")
    print()

    new_rows = read_csv_rows(MATCH_NEW_PATH)
    problematic_rows = read_csv_rows(MATCH_PROBLEMATIC_PATH)

    print(f"Loaded fasynation_match_new.csv         : {len(new_rows)}")
    print(f"Loaded fasynation_match_problematic.csv : {len(problematic_rows)}")

    db = DB()
    try:
        source_id = get_source_id(db, "fasynation")
        max_dr_id = get_max_dr_id(db)
        indexes = load_existing_indexes(db)
        linked_ext = load_existing_source_links(db, source_id)
        existing_terms = load_existing_terms(db)

        print(f"source_id(fasynation): {source_id if source_id is not None else 'MISSING'}")
        print(f"current max dr_id    : {max_dr_id}")
        print(f"existing source links: {len(linked_ext)}")

        preview: Dict[str, List[Dict[str, Any]]] = {
            "drs": [],
            "locations": [],
            "sources": [],
            "votes": [],
            "skipped": [],
            "source_table": [],
            "new_terms": [],
            "cpl_terms": [],
        }

        fake_term_ids: Dict[Tuple[str, str], int] = {}
        next_fake_term_id_ref = {"value": 900000}

        if source_id is None:
            preview["source_table"].append({
                "source_id": "__AUTO__",
                "source_code": "fasynation",
                "source_name": "FASYNATION",
            })

        next_dr_id = max_dr_id + 1

        stats = {
            "candidates_new": 0,
            "candidates_problematic": 0,
            "preview_imported": 0,
            "skipped_existing": 0,
            "preview_term_links": 0,
            "preview_new_terms": 0,
        }

        # process match_new
        for row in new_rows:
            stats["candidates_new"] += 1
            candidate = map_new_row(row)
            exists, reason, existing_dr_id = candidate_exists(candidate, indexes, linked_ext)

            if exists:
                stats["skipped_existing"] += 1
                preview["skipped"].append({
                    "candidate_type": candidate["candidate_type"],
                    "raw_name_used": candidate["raw_name_used"],
                    "external_id": candidate["external_id"],
                    "skip_reason": reason,
                    "existing_dr_id": existing_dr_id,
                    "dr_firstname": candidate.get("dr_firstname"),
                    "dr_lastname": candidate.get("dr_lastname"),
                    "dr_org_name": candidate.get("dr_org_name"),
                    "source_reason": candidate.get("source_reason"),
                })
                continue

            dr_id = next_dr_id
            next_dr_id += 1

            before_terms = len(preview["cpl_terms"])
            before_new_terms = len(preview["new_terms"])

            collect_preview_rows(
                candidate=candidate,
                dr_id=dr_id,
                source_id=source_id,
                preview=preview,
                existing_terms=existing_terms,
                fake_term_ids=fake_term_ids,
                next_fake_term_id_ref=next_fake_term_id_ref,
            )

            stats["preview_term_links"] += len(preview["cpl_terms"]) - before_terms
            stats["preview_new_terms"] += len(preview["new_terms"]) - before_new_terms
            stats["preview_imported"] += 1

        # process match_problematic
        for row in problematic_rows:
            stats["candidates_problematic"] += 1
            candidate = map_problematic_row(row)
            exists, reason, existing_dr_id = candidate_exists(candidate, indexes, linked_ext)

            if exists:
                stats["skipped_existing"] += 1
                preview["skipped"].append({
                    "candidate_type": candidate["candidate_type"],
                    "raw_name_used": candidate["raw_name_used"],
                    "external_id": candidate["external_id"],
                    "skip_reason": reason,
                    "existing_dr_id": existing_dr_id,
                    "dr_firstname": candidate.get("dr_firstname"),
                    "dr_lastname": candidate.get("dr_lastname"),
                    "dr_org_name": candidate.get("dr_org_name"),
                    "source_reason": candidate.get("source_reason"),
                })
                continue

            dr_id = next_dr_id
            next_dr_id += 1

            before_terms = len(preview["cpl_terms"])
            before_new_terms = len(preview["new_terms"])

            collect_preview_rows(
                candidate=candidate,
                dr_id=dr_id,
                source_id=source_id,
                preview=preview,
                existing_terms=existing_terms,
                fake_term_ids=fake_term_ids,
                next_fake_term_id_ref=next_fake_term_id_ref,
            )

            stats["preview_term_links"] += len(preview["cpl_terms"]) - before_terms
            stats["preview_new_terms"] += len(preview["new_terms"]) - before_new_terms
            stats["preview_imported"] += 1

        flush_preview_rows(preview)

        print("---- Summary ----")
        for k, v in stats.items():
            print(f"{k:24s}: {v}")

        print(f"preview_drs               : {len(preview['drs'])}")
        print(f"preview_locations         : {len(preview['locations'])}")
        print(f"preview_sources           : {len(preview['sources'])}")
        print(f"preview_votes             : {len(preview['votes'])}")
        print(f"preview_cpl_terms         : {len(preview['cpl_terms'])}")
        print(f"preview_new_terms         : {len(preview['new_terms'])}")
        print(f"preview_skipped           : {len(preview['skipped'])}")
        print(f"preview_source_table      : {len(preview['source_table'])}")

        db.rollback()
        print("DRY RUN ✅ (nur Preview, keine DB-Änderungen)")

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
