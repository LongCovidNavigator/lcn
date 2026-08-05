#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import mecfsmed doctors into *_03 tables (idempotent) + strict DB-winner rule.

Modes:
- default (no --all / no --id): import exactly 1 record (pick_best among truly missing)
- --id <ID>                  : import exactly that mecfsmed record
- --all                      : iterate all rows
- --commit                   : commit instead of rollback

Rules:
1) Idempotent by (source_id, external_id) in tbl_drs_sources_03
2) Sourcefile dupes:
   - Group key = normalized first_name|last_name
   - Winner per group:
       a) if any ext_id already linked in tbl_drs_sources_03 => that ext_id wins
       b) else pick_best(group) wins
   - all losers of same group are skipped
3) DB-winner rule:
   - If same person (first+last) already exists in tbl_drs_03,
     skip import unless already linked by (source_id, external_id)

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

JSON_CANDIDATES = [
    BASE_DIR / "market" / "mecfsmed_de.json",
    BASE_DIR.parent / "market" / "mecfsmed_de.json",
    Path("/mnt/data/mecfsmed_de.json"),
]
MECFSMED_PATH = next((p for p in JSON_CANDIDATES if p.exists()), JSON_CANDIDATES[0])

print(f"Using JSON file: {MECFSMED_PATH}")

SKIPPED_LOG_PATH = BASE_DIR / "skipped_duplicates_mecfsmed_03.json"
PREVIEW_DIR = BASE_DIR / "preview_mecfsmed_03"

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


def norm_name_key(s: Any) -> str:
    s = norm_ws(s).lower()
    if not s:
        return ""
    for a, b in UML_MAP:
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_url(url: Any) -> Optional[str]:
    u = norm_ws(url)
    if not u:
        return None
    if not re.match(r"^https?://", u, flags=re.I):
        u = "https://" + u
    u = re.sub(r"^https?://www\.", "https://", u, flags=re.I)
    return u.rstrip("/")


def looks_like_email(s: str) -> bool:
    s = norm_ws(s)
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s))


def make_dupe_key(first_name: Any, last_name: Any, fallback_id: Any = None) -> str:
    f = norm_name_key(first_name)
    l = norm_name_key(last_name)
    if f and l:
        return f"{f}|{l}"
    return f"id:{fallback_id}"


def split_street_housenumber(street_raw: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Beispiele:
    - 'Neumarkt 8–10' -> ('Neumarkt', '8–10')
    - 'Musterstraße 12' -> ('Musterstraße', '12')
    - 'Am Markt 3a' -> ('Am Markt', '3A')
    - 'Konrad-Goldmann-Str. 5 B' -> ('Konrad-Goldmann-Str.', '5B')
    - sonst: (kompletter String, None)
    """
    s = norm_ws(street_raw)
    if not s:
        return None, None

    # Hausnummer am Ende:
    # 12
    # 12a / 12 A
    # 8-10 / 8–10
    # 5 B
    m = re.match(
        r"^(.*?)\s+(\d+\s*[A-Za-z]?(?:\s*[-–/]\s*\d+\s*[A-Za-z]?)*)$",
        s
    )
    if m:
        street = norm_ws(m.group(1))
        house = norm_ws(m.group(2))

        # "5 B" -> "5B"
        house = re.sub(r"^(\d+)\s+([A-Za-z])$", r"\1\2", house)
        # auch in Bereichen Leerzeichen bereinigen: "8 - 10" -> "8-10"
        house = re.sub(r"\s*([\-–/])\s*", r"\1", house)
        # "5b" -> "5B"
        house = re.sub(r"^(\d+)([A-Za-z])$", lambda x: f"{x.group(1)}{x.group(2).upper()}", house)

        return street or None, house or None

    return s, None


def insurance_to_acceptance(value: Any) -> Tuple[str, str]:
    s = norm_ws(value).lower()

    if s in {"beides", "both", "gkv und pkv", "gesetzlich und privat"}:
        return "yes", "yes"

    if s in {"gkv", "gesetzlich", "public"}:
        return "yes", "no"

    if s in {"pkv", "privat", "private"}:
        return "no", "yes"

    if not s:
        return "unknown", "unknown"

    return "unknown", "unknown"


def safe_attr(rec: Dict[str, Any], key: str) -> Any:
    attrs = rec.get("attributes")
    if isinstance(attrs, dict):
        return attrs.get(key)
    return rec.get(key)


def get_rel_list(rec: Dict[str, Any], rel_name: str) -> List[Dict[str, Any]]:
    attrs = rec.get("attributes", {})
    rel = attrs.get(rel_name) if isinstance(attrs, dict) else None
    if not isinstance(rel, dict):
        return []
    data = rel.get("data")
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    return []


def extract_dr_type_from_professions(rec: Dict[str, Any]) -> Optional[str]:
    for item in get_rel_list(rec, "professions"):
        attrs = item.get("attributes", {}) if isinstance(item.get("attributes"), dict) else {}
        value = norm_ws(attrs.get("type"))
        if value:
            return value
    return None


def slugify_term_code(s: str) -> str:
    s = norm_name_key(s)
    s = s.replace("/", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def map_existing_term_code(term_type: str, label: str) -> str:
    label_norm = norm_ws(label).lower()

    mapping = {
        ("badge", "akzeptiert die diagnose me/cfs"): "accepts-mecfs-diagnosis",
        ("badge", "gendersensibel"): "gender-sensitive",
        ("badge", "queer-/transfreundlich"): "lgbtq-friendly",
        ("badge", "expertise in long/post covid"): "long-covid-expertise",
        ("badge", "kennt sich mit me/cfs aus"): "mecfs-knowledgeable",
        ("badge", "ich habe mich ernstgenommen gefühlt"): "patients-feel-heard",
        ("badge", "kennt sich mit pots/dysautonomien aus"): "pots-expertise",
        ("badge", "stellt gutachten bzw. atteste aus"): "provides-attestations",
        ("badge", "stellt die diagnose für me/cfs (g93.3)"): "provides-mecfs-diagnosis",
        ("badge", "behandelt me/cfs (z. b. off-label)"): "treats-mecfs-offlabel",
        ("badge", "macht immundiagnostik"): "offers-immunodiagnostics",
        ("badge", "hat von me/cfs schon einmal gehört"): "mecfs-aware",
        ("badge", "kennt sich mit mcas aus"): "mcas-expertise",

        ("accessibility", "online-terminvereinbarung möglich"): "online-scheduling",
        ("accessibility", "die praxis ist reizarm"): "low-stimulation-environment",
        ("accessibility", "hausbesuche möglich"): "home-visits-available",
        ("accessibility", "in der praxis wird auf infektionsschutz geachtet (z. b. maske tragen)"): "infection-control-protocols",
        ("accessibility", "praxis hat luftfilter"): "air-filtration",
        ("accessibility", "es gibt automatische türen"): "automatic-doors",
        ("accessibility", "kontakt per e-mail möglich"): "email-contact",
        ("accessibility", "die praxis ist stufenlos erreichbar"): "step-free-access",
        ("accessibility", "praxis hat eine klimaanlage"): "air-conditioning",
    }

    return mapping.get((term_type, label_norm), slugify_term_code(label_norm))


def relation_items_to_terms(
    rec: Dict[str, Any],
    rel_name: str,
    term_type: str,
    code_prefix: str
) -> List[Tuple[str, str, str]]:
    out: List[Tuple[str, str, str]] = []
    seen = set()

    for item in get_rel_list(rec, rel_name):
        attrs = item.get("attributes", {}) if isinstance(item.get("attributes"), dict) else {}

        label = norm_ws(
            attrs.get("option")
            or attrs.get("type")
            or attrs.get("name")
            or attrs.get("label")
            or attrs.get("title")
        )
        if not label:
            continue

        term_code = map_existing_term_code(term_type, label)
        key = (term_type, term_code, label)
        if key in seen:
            continue

        seen.add(key)
        out.append((term_type, term_code, label))

    return out


def mecfsmed_profile_url(rec: Dict[str, Any]) -> Optional[str]:
    slug = norm_ws(safe_attr(rec, "slug"))
    if slug:
        return f"https://mecfsmed.de/adressen/{slug}"
    website = normalize_url(safe_attr(rec, "website"))
    return website


# -------------------------
# JSON loader
# -------------------------
def split_concat_json(text: str) -> List[Dict[str, Any]]:
    text = text.lstrip("\ufeff").strip()
    parts: List[str] = []
    last = 0
    for m in re.finditer(r"}\s*{", text):
        cut = m.start() + 1
        parts.append(text[last:cut].strip())
        last = m.start() + 1
    parts.append(text[last:].strip())

    docs: List[Dict[str, Any]] = []
    for p in parts:
        if p:
            docs.append(json.loads(p))
    return docs


def load_rows(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"File missing: {path}")

    text = path.read_text(encoding="utf-8", errors="replace").lstrip("\ufeff").strip()

    try:
        obj = json.loads(text)
        docs = [obj]
    except json.JSONDecodeError:
        docs = split_concat_json(text)

    rows: List[Dict[str, Any]] = []
    for d in docs:
        data = d.get("data", [])
        if isinstance(data, list):
            rows.extend(data)

    return rows


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
# Schema helpers
# -------------------------
def ensure_source_mecfsmed(db: DB) -> int:
    db.exec(
        "INSERT IGNORE INTO tbl_sources_03 (source_code, source_name) VALUES (%s,%s)",
        ("mecfsmed", "MECFSMED"),
    )
    r = db.q1("SELECT source_id FROM tbl_sources_03 WHERE source_code=%s", ("mecfsmed",))
    if not r:
        raise RuntimeError("source_id missing for mecfsmed in tbl_sources_03")
    return int(r[0])


def _sql_norm_expr(col: str) -> str:
    expr = f"LOWER(TRIM(COALESCE({col},'')))"
    for a, b in UML_MAP:
        expr = f"REPLACE({expr}, '{a}', '{b}')"
    return expr


def find_dr_by_first_last(db: DB, first: Any, last: Any) -> Optional[int]:
    f = norm_name_key(first)
    l = norm_name_key(last)
    if not f or not l:
        return None

    r = db.q1(
        f"""
        SELECT dr_id
        FROM tbl_drs_03
        WHERE {_sql_norm_expr('dr_firstname')} = %s
          AND {_sql_norm_expr('dr_lastname')}  = %s
        LIMIT 1
        """,
        (f, l),
    )
    return int(r[0]) if r else None


def existing_winner_in_db(db: DB, rec: Dict[str, Any]) -> Optional[int]:
    return find_dr_by_first_last(db, safe_attr(rec, "first_name"), safe_attr(rec, "last_name"))


# -------------------------
# Terms
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


def load_existing_terms(db: DB) -> Dict[Tuple[str, str], Dict[str, Any]]:
    rows = db.qall(
        """
        SELECT
            term_id,
            term_type,
            term_code,
            term_label,
            term_desc
        FROM tbl_terms_03
        """
    )

    out: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for term_id, term_type, term_code, term_label, term_desc in rows:
        key = (str(term_type), str(term_code))
        out[key] = {
            "term_id": int(term_id),
            "term_type": term_type,
            "term_code": term_code,
            "term_label": term_label,
            "term_desc": term_desc,
        }

    return out


# -------------------------
# Mapping
# -------------------------
def map_record(rec: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], List[Tuple[str, str, str]]]:
    title_raw = safe_attr(rec, "title")
    title = normalize_title_raw(title_raw)
    first = norm_ws(safe_attr(rec, "first_name")) or None
    last = norm_ws(safe_attr(rec, "last_name")) or None
    email = norm_ws(safe_attr(rec, "email")) or None
    website = normalize_url(safe_attr(rec, "website"))
    insurance = safe_attr(rec, "insurance")

    accepts_gkv, accepts_pkv = insurance_to_acceptance(insurance)

    display_name = " ".join([x for x in [title, first, last] if x]).strip()
    if not display_name:
        display_name = f"mecfsmed_{rec.get('id')}"

    is_dr = 1 if title and "dr" in title.lower() else 0
    dr_type = extract_dr_type_from_professions(rec)

    dr = {
        "dr_type": dr_type,
        "dr_is_dr": is_dr,
        "dr_title_raw": title,
        "dr_firstname": first,
        "dr_lastname": last,
        "dr_org_name": None,
        "dr_display_name": display_name,
        "dr_website": website,
        "dr_email": email if email and looks_like_email(email) else None,
        "dr_accepts_gkv": accepts_gkv,
        "dr_accepts_pkv": accepts_pkv,
        "dr_notes": None,
    }

    street_raw = safe_attr(rec, "street")
    street, housenumber = split_street_housenumber(street_raw)

    location = {
        "loc_label": None,
        "loc_is_primary": 1,
        "loc_country": "DE",
        "loc_plz": norm_ws(safe_attr(rec, "zipcode")) or None,
        "loc_city": norm_ws(safe_attr(rec, "city")) or None,
        "loc_street": street,
        "loc_housenumber": housenumber,
        "loc_phone": norm_ws(safe_attr(rec, "phone")) or None,
        "loc_email": email if email and looks_like_email(email) else None,
        "loc_website": website,
        "loc_lat": safe_attr(rec, "lat"),
        "loc_lng": safe_attr(rec, "lng"),
        "loc_address_visibility": "full",
        "loc_geo_type": None,
    }

    terms: List[Tuple[str, str, str]] = []
    terms.extend(relation_items_to_terms(rec, "treatment_options", "badge", "treatment_option"))
    terms.extend(relation_items_to_terms(rec, "accessibility_options", "accessibility", "accessibility_option"))

    return dr, location, terms


# -------------------------
# Upserts
# -------------------------
def insert_or_match_dr(db: DB, source_id: int, ext_id: str, dr: Dict[str, Any]) -> int:
    r = db.q1(
        "SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s",
        (source_id, ext_id),
    )
    if r:
        return int(r[0])

    dr_id = find_dr_by_first_last(db, dr.get("dr_firstname"), dr.get("dr_lastname"))
    if dr_id:
        return dr_id

    return db.exec(
        """
        INSERT INTO tbl_drs_03
          (dr_type, dr_is_dr, dr_title_raw, dr_firstname, dr_lastname, dr_org_name,
           dr_display_name, dr_website, dr_email, dr_accepts_gkv, dr_accepts_pkv, dr_notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            dr.get("dr_type"),
            int(dr.get("dr_is_dr", 0)),
            dr.get("dr_title_raw"),
            dr.get("dr_firstname"),
            dr.get("dr_lastname"),
            dr.get("dr_org_name"),
            dr.get("dr_display_name"),
            dr.get("dr_website"),
            dr.get("dr_email"),
            dr.get("dr_accepts_gkv", "unknown"),
            dr.get("dr_accepts_pkv", "unknown"),
            dr.get("dr_notes"),
        ),
    )


def backfill_dr_if_missing(db: DB, dr_id: int, dr: Dict[str, Any]) -> None:
    db.exec(
        """
        UPDATE tbl_drs_03
        SET
          dr_title_raw   = COALESCE(dr_title_raw, %s),
          dr_org_name    = COALESCE(dr_org_name, %s),
          dr_website     = COALESCE(dr_website, %s),
          dr_email       = COALESCE(dr_email, %s),
          dr_accepts_gkv = CASE
            WHEN dr_accepts_gkv = 'unknown' AND %s IN ('yes','no') THEN %s
            ELSE dr_accepts_gkv
          END,
          dr_accepts_pkv = CASE
            WHEN dr_accepts_pkv = 'unknown' AND %s IN ('yes','no') THEN %s
            ELSE dr_accepts_pkv
          END
        WHERE dr_id = %s
        """,
        (
            dr.get("dr_title_raw"),
            dr.get("dr_org_name"),
            dr.get("dr_website"),
            dr.get("dr_email"),
            dr.get("dr_accepts_gkv"),
            dr.get("dr_accepts_gkv"),
            dr.get("dr_accepts_pkv"),
            dr.get("dr_accepts_pkv"),
            dr_id,
        ),
    )


def upsert_source_row(db: DB, dr_id: int, source_id: int, ext_id: str, url: Optional[str], payload: str) -> None:
    db.exec(
        """
        INSERT INTO tbl_drs_sources_03 (dr_id, source_id, external_id, source_url, payload_json)
        VALUES (%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          dr_id = VALUES(dr_id),
          source_url = COALESCE(VALUES(source_url), source_url),
          payload_json = COALESCE(VALUES(payload_json), payload_json)
        """,
        (dr_id, source_id, ext_id, url, payload),
    )


def ensure_votes(db: DB, dr_id: int) -> None:
    db.exec(
        "INSERT IGNORE INTO tbl_drs_votes_03 (dr_id, vote_improved, vote_neutral, vote_worsened) VALUES (%s,0,0,0)",
        (dr_id,),
    )


def insert_location_if_missing(db: DB, dr_id: int, loc: Dict[str, Any]) -> None:
    r = db.q1(
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
            loc.get("loc_country"),
            loc.get("loc_plz"),
            loc.get("loc_city"),
            loc.get("loc_street"),
            loc.get("loc_housenumber"),
        ),
    )

    if r:
        loc_id = int(r[0])
        db.exec(
            """
            UPDATE tbl_drs_locations_03
            SET
              loc_label = COALESCE(loc_label, %s),
              loc_phone = COALESCE(loc_phone, %s),
              loc_email = COALESCE(loc_email, %s),
              loc_website = COALESCE(loc_website, %s),
              loc_lat = COALESCE(loc_lat, %s),
              loc_lng = COALESCE(loc_lng, %s),
              loc_address_visibility = COALESCE(loc_address_visibility, %s),
              loc_is_primary = CASE
                WHEN loc_is_primary = 0 AND %s = 1 THEN 1
                ELSE loc_is_primary
              END
            WHERE loc_id = %s
            """,
            (
                loc.get("loc_label"),
                loc.get("loc_phone"),
                loc.get("loc_email"),
                loc.get("loc_website"),
                loc.get("loc_lat"),
                loc.get("loc_lng"),
                loc.get("loc_address_visibility"),
                int(loc.get("loc_is_primary", 0)),
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
            loc.get("loc_label"),
            int(loc.get("loc_is_primary", 0)),
            loc.get("loc_country"),
            loc.get("loc_plz"),
            loc.get("loc_city"),
            loc.get("loc_street"),
            loc.get("loc_housenumber"),
            loc.get("loc_phone"),
            loc.get("loc_email"),
            loc.get("loc_website"),
            loc.get("loc_lat"),
            loc.get("loc_lng"),
            loc.get("loc_address_visibility"),
            loc.get("loc_geo_type"),
        ),
    )


# -------------------------
# Winner logic
# -------------------------
def pick_best(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    def score(rec: Dict[str, Any]) -> float:
        s = 0.0

        for k in ["id"]:
            if rec.get(k):
                s += 1.0

        for k in ["title", "first_name", "last_name", "street", "zipcode", "city", "phone", "email", "website", "slug", "lat", "lng"]:
            if safe_attr(rec, k):
                s += 1.0

        rel_bonus = [
            ("professions", 2.0),
            ("treatment_options", 3.0),
            ("accessibility_options", 2.0),
        ]
        for rel_name, base in rel_bonus:
            items = get_rel_list(rec, rel_name)
            if items:
                s += base + min(3.0, 0.2 * len(items))

        return s

    best = rows[0]
    best_score = -1.0
    for r in rows:
        sc = score(r)
        if sc > best_score:
            best = r
            best_score = sc
    return best


def build_dupe_groups(rows: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for rec in rows:
        key = make_dupe_key(safe_attr(rec, "first_name"), safe_attr(rec, "last_name"), rec.get("id"))
        groups.setdefault(key, []).append(rec)
    return groups


def find_group_winner_ext_id(db: DB, source_id: int, group_rows: List[Dict[str, Any]]) -> str:
    for rec in group_rows:
        ext_id = str(rec.get("id"))
        linked = db.q1(
            "SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s",
            (source_id, ext_id),
        )
        if linked:
            return ext_id

    return str(pick_best(group_rows).get("id"))


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
# Preview helpers
# -------------------------
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


def collect_preview_rows(
    rec: Dict[str, Any],
    dr_id: int,
    source_id: int,
    dr: Dict[str, Any],
    location: Dict[str, Any],
    terms: List[Tuple[str, str, str]],
    existing_terms: Dict[Tuple[str, str], Dict[str, Any]],
    preview: Dict[str, List[Dict[str, Any]]],
    fake_term_ids: Dict[Tuple[str, str], int],
    next_fake_term_id_ref: Dict[str, int],
) -> None:
    ext_id = str(rec.get("id"))
    source_url = mecfsmed_profile_url(rec)
    payload = json.dumps(rec, ensure_ascii=False)

    preview["drs"].append({
        "dr_id": dr_id,
        "dr_type": dr.get("dr_type"),
        "dr_is_dr": dr.get("dr_is_dr"),
        "dr_title_raw": dr.get("dr_title_raw"),
        "dr_firstname": dr.get("dr_firstname"),
        "dr_lastname": dr.get("dr_lastname"),
        "dr_org_name": dr.get("dr_org_name"),
        "dr_display_name": dr.get("dr_display_name"),
        "dr_website": dr.get("dr_website"),
        "dr_email": dr.get("dr_email"),
        "dr_accepts_gkv": dr.get("dr_accepts_gkv"),
        "dr_accepts_pkv": dr.get("dr_accepts_pkv"),
        "dr_notes": dr.get("dr_notes"),
    })

    preview["locations"].append({
        "loc_id": None,
        "dr_id": dr_id,
        "loc_label": location.get("loc_label"),
        "loc_is_primary": location.get("loc_is_primary"),
        "loc_country": location.get("loc_country"),
        "loc_plz": location.get("loc_plz"),
        "loc_city": location.get("loc_city"),
        "loc_street": location.get("loc_street"),
        "loc_housenumber": location.get("loc_housenumber"),
        "loc_phone": location.get("loc_phone"),
        "loc_email": location.get("loc_email"),
        "loc_website": location.get("loc_website"),
        "loc_lat": location.get("loc_lat"),
        "loc_lng": location.get("loc_lng"),
        "loc_address_visibility": location.get("loc_address_visibility"),
        "loc_geo_type": location.get("loc_geo_type"),
        "created_at": None,
    })

    preview["sources"].append({
        "dr_source_id": None,
        "dr_id": dr_id,
        "source_id": source_id,
        "external_id": ext_id,
        "source_url": source_url,
        "payload_json": payload,
        "created_at": None,
    })

    preview["votes"].append({
        "dr_id": dr_id,
        "vote_improved": 0,
        "vote_neutral": 0,
        "vote_worsened": 0,
        "updated_at": None,
    })

    for term_type, term_code, term_label in terms:
        existing = existing_terms.get((term_type, term_code))

        if existing:
            term_id = existing["term_id"]
        else:
            key = (term_type, term_code)
            if key not in fake_term_ids:
                fake_term_ids[key] = next_fake_term_id_ref["value"]
                next_fake_term_id_ref["value"] += 1

                preview["new_terms"].append({
                    "term_id": fake_term_ids[key],
                    "term_type": term_type,
                    "term_code": term_code,
                    "term_label": term_label,
                    "term_desc": None,
                })

            term_id = fake_term_ids[key]

        preview["cpl_terms"].append({
            "dr_id": dr_id,
            "term_id": term_id,
            "source_id": source_id,
            "confidence": "high",
            "created_at": None,
            "term_type": term_type,
            "term_code": term_code,
            "term_label": term_label,
        })


def flush_preview_rows(preview: Dict[str, List[Dict[str, Any]]]) -> None:
    ensure_preview_dir()

    drs = dedupe_rows(preview["drs"], ["dr_id"])
    locations = dedupe_rows(preview["locations"], ["dr_id", "loc_country", "loc_plz", "loc_city", "loc_street", "loc_housenumber"])
    sources = dedupe_rows(preview["sources"], ["dr_id", "source_id", "external_id"])
    votes = dedupe_rows(preview["votes"], ["dr_id"])
    cpl_terms = dedupe_rows(preview["cpl_terms"], ["dr_id", "term_id", "source_id"])
    new_terms = dedupe_rows(preview["new_terms"], ["term_id"])

    write_csv(PREVIEW_DIR / "preview_tbl_drs_03.csv", drs)
    write_csv(PREVIEW_DIR / "preview_tbl_drs_locations_03.csv", locations)
    write_csv(PREVIEW_DIR / "preview_tbl_drs_sources_03.csv", sources)
    write_csv(PREVIEW_DIR / "preview_tbl_drs_votes_03.csv", votes)
    write_csv(PREVIEW_DIR / "preview_tbl_cpl_drs2terms_03.csv", cpl_terms)
    write_csv(PREVIEW_DIR / "preview_new_terms_03.csv", new_terms)

    print(f"Preview written to: {PREVIEW_DIR}")


# -------------------------
# CLI
# -------------------------
def parse_args() -> Dict[str, Any]:
    args = {"commit": False, "id": None, "all": False, "limit": None, "start": 0}
    it = iter(sys.argv[1:])
    for a in it:
        if a == "--commit":
            args["commit"] = True
        elif a == "--id":
            args["id"] = next(it)
        elif a == "--all":
            args["all"] = True
        elif a == "--limit":
            args["limit"] = int(next(it))
        elif a == "--start":
            args["start"] = int(next(it))
        else:
            print(f"WARNING: Unbekanntes Argument ignoriert: {a}")
    return args


def short_name(rec: Dict[str, Any]) -> str:
    return " ".join([
        norm_ws(safe_attr(rec, "title")),
        norm_ws(safe_attr(rec, "first_name")),
        norm_ws(safe_attr(rec, "last_name")),
    ]).strip()

def normalize_title_raw(title: Any) -> Optional[str]:
    t = norm_ws(title)
    if not t:
        return None

    tl = t.lower()

    has_prof = "prof" in tl
    has_dr = "dr" in tl

    if has_prof and has_dr:
        return "Prof. Dr."
    if has_dr:
        return "Dr."

    return t

# -------------------------
# Main
# -------------------------
def main() -> None:
    args = parse_args()
    commit = args["commit"]
    pick_id = args["id"]
    do_all = args["all"]
    start = int(args["start"] or 0)
    limit = args["limit"]

    rows = load_rows(MECFSMED_PATH)
    print(f"Loaded {len(rows)} mecfsmed rows from {MECFSMED_PATH}")

    dupe_groups = build_dupe_groups(rows)

    db = DB()
    try:
        source_id = ensure_source_mecfsmed(db)
        existing_terms = load_existing_terms(db)

        preview: Dict[str, List[Dict[str, Any]]] = {
            "drs": [],
            "locations": [],
            "sources": [],
            "votes": [],
            "cpl_terms": [],
            "new_terms": [],
        }
        fake_term_ids: Dict[Tuple[str, str], int] = {}
        next_fake_term_id_ref = {"value": 900000}

        group_winner_cache: Dict[str, str] = {}
        for key, grp in dupe_groups.items():
            if len(grp) > 1:
                group_winner_cache[key] = find_group_winner_ext_id(db, source_id, grp)

        if pick_id is not None:
            work = [r for r in rows if str(r.get("id")) == str(pick_id)]
            if not work:
                print(f"ERROR: id {pick_id} not found in file", file=sys.stderr)
                sys.exit(2)
        elif do_all:
            work = rows[start:]
            if limit is not None:
                work = work[:limit]
        else:
            missing_candidates = []
            for r in rows:
                ext_id = str(r.get("id"))
                already_linked = db.q1(
                    "SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s",
                    (source_id, ext_id),
                )
                winner_dr_id = existing_winner_in_db(db, r)
                if not already_linked and winner_dr_id is None:
                    missing_candidates.append(r)

            if not missing_candidates:
                print("Nichts zu importieren: keine echten Missing-Kandidaten gefunden.")
                db.rollback()
                db.close()
                return

            work = [pick_best(missing_candidates)]

        stats = {
            "processed": 0,
            "imported": 0,
            "skipped_sourcefile_dupe": 0,
            "skipped_db_winner": 0,
            "skipped_other": 0,
        }
        skipped_log: List[Dict[str, Any]] = []

        for idx, rec in enumerate(work, start=1):
            ext_id = str(rec.get("id"))
            dupe_key = make_dupe_key(safe_attr(rec, "first_name"), safe_attr(rec, "last_name"), rec.get("id"))

            if dupe_key in group_winner_cache:
                winner_ext_id = group_winner_cache[dupe_key]
                if ext_id != winner_ext_id:
                    stats["processed"] += 1
                    stats["skipped_sourcefile_dupe"] += 1
                    skipped_log.append({
                        "reason": "duplicate_loser_in_sourcefile",
                        "dupe_key": dupe_key,
                        "winner_ext_id": winner_ext_id,
                        "skipped_ext_id": ext_id,
                        "slug": safe_attr(rec, "slug"),
                        "name": short_name(rec),
                    })
                    continue

            already_linked = db.q1(
                "SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s",
                (source_id, ext_id),
            )
            winner_dr_id = existing_winner_in_db(db, rec)

            if winner_dr_id is not None and not already_linked:
                stats["processed"] += 1
                stats["skipped_db_winner"] += 1
                skipped_log.append({
                    "reason": "duplicate_winner_already_in_db",
                    "dupe_key": dupe_key,
                    "winner_dr_id": int(winner_dr_id),
                    "skipped_ext_id": ext_id,
                    "slug": safe_attr(rec, "slug"),
                    "name": short_name(rec),
                })
                continue

            dr, location, terms = map_record(rec)

            dr_id = insert_or_match_dr(db, source_id, ext_id, dr)
            backfill_dr_if_missing(db, dr_id, dr)

            collect_preview_rows(
                rec=rec,
                dr_id=dr_id,
                source_id=source_id,
                dr=dr,
                location=location,
                terms=terms,
                existing_terms=existing_terms,
                preview=preview,
                fake_term_ids=fake_term_ids,
                next_fake_term_id_ref=next_fake_term_id_ref,
            )

            payload = json.dumps(rec, ensure_ascii=False)
            upsert_source_row(db, dr_id, source_id, ext_id, mecfsmed_profile_url(rec), payload)

            ensure_votes(db, dr_id)
            insert_location_if_missing(db, dr_id, location)

            for term_type, code, label in terms:
                term_id = upsert_term(db, term_type, code, label)
                link_term(db, dr_id, term_id, source_id)

            stats["processed"] += 1
            stats["imported"] += 1

            print(f"Imported candidate: ext_id={ext_id} | {short_name(rec)} | dr_id={dr_id}")

            if do_all and (idx % 25 == 0):
                print(f"... {idx}/{len(work)} processed | imported={stats['imported']} skipped={stats['skipped_sourcefile_dupe'] + stats['skipped_db_winner']}")

        flush_preview_rows(preview)

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
            print(f"{k:26s}: {v}")
        print(f"skipped_total             : {stats['skipped_sourcefile_dupe'] + stats['skipped_db_winner'] + stats['skipped_other']}")

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
