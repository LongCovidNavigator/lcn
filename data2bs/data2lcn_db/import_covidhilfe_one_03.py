#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import covidhilfe doctors into *_03 tables (idempotent) + STRICT dupe-skip.

Modes:
- default (no --all): import exactly 1 record (pick_best)
- --id <UUID>       : import exactly that record
- --all             : iterate all rows (with --start/--limit optional)

Rules:
1) Idempotent by (source_id, external_id) in tbl_drs_sources_03
2) STRICT sourcefile dupes:
   - Group key = normalized first_name|last_name
   - Winner per group:
       a) if any ext_id of group already linked in tbl_drs_sources_03 => that ext_id wins
       b) else pick_best(group) wins
   - Any other ext_id in same group is SKIPPED.
3) DB-winner rule:
   - If the same person (first+last) already exists in tbl_drs_03 (normalized),
     then the DB entry is the winner:
       -> SKIP importing this covidhilfe record unless it's already linked by (source_id, external_id)

Usage:
  python import_covidhilfe_one_03.py                 # dry-run, one record (pick_best)
  python import_covidhilfe_one_03.py --commit        # commit, one record
  python import_covidhilfe_one_03.py --id <UUID>     # dry-run, specific record
  python import_covidhilfe_one_03.py --id <UUID> --commit
  python import_covidhilfe_one_03.py --all           # dry-run, all (rollback at end)
  python import_covidhilfe_one_03.py --all --commit  # commit all
  python import_covidhilfe_one_03.py --all --start 50 --limit 20
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
from pathlib import Path
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
ENV_PATH = BASE_DIR / ".env"

DEFAULT_JSON = BASE_DIR / "market" / "covidhilfe_com_196.json"
ALT_JSON = Path("/mnt/data/covidhilfe_com_196.json")
COVIDHILFE_PATH = ALT_JSON if ALT_JSON.exists() else DEFAULT_JSON

SKIPPED_LOG_PATH = BASE_DIR / "skipped_duplicates_covidhilfe_03.json"

if not ENV_PATH.exists():
    print(f"ERROR: .env nicht gefunden: {ENV_PATH}", file=sys.stderr)
    sys.exit(1)

load_dotenv(ENV_PATH)

def env(name: str, default: Optional[str] = None) -> str:
    v = os.getenv(name)
    if v is None or v.strip() == "":
        return default if default is not None else ""
    return v.strip()

DB_HOST = env("DB_HOST", "127.0.0.1")
DB_PORT = int(env("DB_PORT", "3306"))
DB_USER = env("DB_USER", "root")
DB_PASSWORD = env("DB_PASSWORD", "")
DB_NAME = env("DB_NAME", "lcn_database")

# -------------------------
# Normalization
# -------------------------
UML_MAP = (
    ("ä", "ae"),
    ("ö", "oe"),
    ("ü", "ue"),
    ("ß", "ss"),
)
GENERIC_LOC_LABELS = {"praxis", "practice", "clinic", "standort", "office"}

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

def normalize_title(raw: Any) -> Optional[str]:
    """Keep distinction: Prof. vs Dr. | Dr. med. => Dr."""
    t = norm_ws(raw).lower()
    if not t:
        return None
    if "prof" in t:
        return "Prof."
    if "dr" in t:
        return "Dr."
    return None

def normalize_url(url: Any) -> Optional[str]:
    u = norm_ws(url)
    if not u:
        return None
    if not re.match(r"^https?://", u, flags=re.I):
        u = "https://" + u
    u = re.sub(r"^https?://www\.", "https://", u, flags=re.I)
    u = u.rstrip("/")
    return u

def looks_like_email(s: str) -> bool:
    s = (s or "").strip()
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s))

def cc2(country_code: Any) -> Optional[str]:
    c = norm_ws(country_code).upper()
    if not c:
        return None
    return c[:2]

def num_or_none(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None

# -------------------------
# JSON loader (robust)
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

def load_covidhilfe_rows(path: Path) -> List[Dict[str, Any]]:
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
# Schema
# -------------------------
DDL = [
"""
CREATE TABLE IF NOT EXISTS tbl_sources_03 (
  source_id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  source_code VARCHAR(50) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (source_id),
  UNIQUE KEY uq_sources03_code (source_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
"""
CREATE TABLE IF NOT EXISTS tbl_drs_03 (
  dr_id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  dr_type ENUM('physician','heilpraktiker','clinic','practice','other') NOT NULL DEFAULT 'physician',
  dr_is_dr TINYINT(1) NOT NULL DEFAULT 0,
  dr_title_raw VARCHAR(120) NULL,
  dr_firstname VARCHAR(120) NULL,
  dr_lastname VARCHAR(120) NULL,
  dr_org_name VARCHAR(255) NULL,
  dr_display_name VARCHAR(255) NOT NULL,
  dr_website VARCHAR(600) NULL,
  dr_email VARCHAR(255) NULL,
  dr_accepts_gkv ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown',
  dr_accepts_pkv ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown',
  dr_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (dr_id),
  KEY idx_drs03_last_first (dr_lastname, dr_firstname),
  KEY idx_drs03_display (dr_display_name),
  KEY idx_drs03_type (dr_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
"""
CREATE TABLE IF NOT EXISTS tbl_drs_sources_03 (
  dr_source_id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  dr_id BIGINT(20) UNSIGNED NOT NULL,
  source_id INT(10) UNSIGNED NOT NULL,
  external_id VARCHAR(160) NULL,
  source_url VARCHAR(700) NULL,
  payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (dr_source_id),
  UNIQUE KEY uq_drs_sources03_src_ext (source_id, external_id),
  KEY idx_drs_sources03_dr (dr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
"""
CREATE TABLE IF NOT EXISTS tbl_drs_votes_03 (
  dr_id BIGINT(20) UNSIGNED NOT NULL,
  vote_improved INT(10) UNSIGNED NOT NULL DEFAULT 0,
  vote_neutral  INT(10) UNSIGNED NOT NULL DEFAULT 0,
  vote_worsened INT(10) UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (dr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
"""
CREATE TABLE IF NOT EXISTS tbl_drs_locations_03 (
  loc_id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  dr_id BIGINT(20) UNSIGNED NOT NULL,
  loc_label VARCHAR(255) NULL,
  loc_is_primary TINYINT(1) NOT NULL DEFAULT 0,
  loc_country CHAR(2) NULL,
  loc_plz VARCHAR(20) NULL,
  loc_city VARCHAR(120) NULL,
  loc_street VARCHAR(255) NULL,
  loc_housenumber VARCHAR(40) NULL,
  loc_phone VARCHAR(80) NULL,
  loc_email VARCHAR(255) NULL,
  loc_website VARCHAR(600) NULL,
  loc_lat DECIMAL(10,7) NULL,
  loc_lng DECIMAL(10,7) NULL,
  loc_address_visibility VARCHAR(20) NULL,
  loc_geo_type VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (loc_id),
  KEY idx_loc03_dr (dr_id),
  KEY idx_loc03_geo (loc_country, loc_plz, loc_city),
  KEY idx_loc03_latlng (loc_lat, loc_lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
"""
CREATE TABLE IF NOT EXISTS tbl_terms_03 (
  term_id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  term_type ENUM('badge','accessibility','language','specialty','meta','other') NOT NULL DEFAULT 'other',
  term_code VARCHAR(120) NOT NULL,
  term_label VARCHAR(255) NOT NULL,
  term_desc TEXT NULL,
  PRIMARY KEY (term_id),
  UNIQUE KEY uq_terms03_type_code (term_type, term_code),
  KEY idx_terms03_type (term_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
"""
CREATE TABLE IF NOT EXISTS tbl_cpl_drs2terms_03 (
  dr_id BIGINT(20) UNSIGNED NOT NULL,
  term_id INT(10) UNSIGNED NOT NULL,
  source_id INT(10) UNSIGNED NOT NULL,
  confidence ENUM('high','medium','low') NOT NULL DEFAULT 'high',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (dr_id, term_id, source_id),
  KEY idx_cpl03_term (term_id),
  KEY idx_cpl03_source (source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""",
]

def ensure_schema(db: DB) -> None:
    for stmt in DDL:
        db.exec(stmt)

def ensure_source_covidhilfe(db: DB) -> int:
    db.exec(
        "INSERT IGNORE INTO tbl_sources_03 (source_code, source_name) VALUES (%s,%s)",
        ("covidhilfe", "CovidHilfe"),
    )
    r = db.q1("SELECT source_id FROM tbl_sources_03 WHERE source_code=%s", ("covidhilfe",))
    if not r:
        raise RuntimeError("source_id missing for covidhilfe in tbl_sources_03")
    return int(r[0])

# -------------------------
# Mapping / upserts
# -------------------------
def cov_url(r: Dict[str, Any]) -> str:
    slug = r.get("slug")
    return f"https://covidhilfe.com/verzeichnis/aerzte/{slug}" if slug else "https://covidhilfe.com/verzeichnis/aerzte"

def upsert_term(db: DB, term_type: str, code: str, label: str) -> int:
    code = norm_ws(code)
    label = norm_ws(label) or code
    row = db.q1("SELECT term_id FROM tbl_terms_03 WHERE term_type=%s AND term_code=%s", (term_type, code))
    if row:
        term_id = int(row[0])
        db.exec("UPDATE tbl_terms_03 SET term_label=%s WHERE term_id=%s", (label, term_id))
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
              loc_geo_type = COALESCE(loc_geo_type, %s),
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
                loc.get("loc_geo_type"),
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

def pick_best(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    def score(r: Dict[str, Any]) -> float:
        s = 0.0
        for k in ["id", "slug", "title", "first_name", "last_name", "website", "email"]:
            if r.get(k):
                s += 1.0
        locs = r.get("doctor_location")
        if isinstance(locs, list) and locs:
            s += 3.0 + min(3.0, float(len(locs)))
        for k in ["specialties", "treatment_options", "accessibility_features", "languages", "insurance_accepted"]:
            v = r.get(k)
            if isinstance(v, list) and v:
                s += 1.0 + min(2.0, 0.2 * len(v))
        return s

    best = rows[0]
    bs = -1.0
    for r in rows:
        sc = score(r)
        if sc > bs:
            best, bs = r, sc
    return best

def build_dupe_groups(rows: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        k = f"{norm_name_key(r.get('first_name'))}|{norm_name_key(r.get('last_name'))}"
        if k == "|" or k.startswith("|") or k.endswith("|"):
            k = f"id:{r.get('id')}"
        groups.setdefault(k, []).append(r)
    return groups

def map_covidhilfe(row: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Tuple[str, str, str]]]:
    title_raw = normalize_title(row.get("title"))
    first = norm_ws(row.get("first_name")) or None
    last = norm_ws(row.get("last_name")) or None

    locations: List[Dict[str, Any]] = []
    locs = row.get("doctor_location") or []
    if isinstance(locs, list):
        for i, l in enumerate(locs):
            if not isinstance(l, dict):
                continue

            lat = num_or_none(l.get("latitude"))
            lng = num_or_none(l.get("longitude"))
            geo = l.get("geo") if isinstance(l.get("geo"), dict) else {}
            geo_type = norm_ws(geo.get("type")) or None

            coords = geo.get("coordinates")
            if (lat is None or lng is None) and isinstance(coords, list) and len(coords) >= 2:
                # GeoJSON order: [lng, lat]
                lng = lng if lng is not None else num_or_none(coords[0])
                lat = lat if lat is not None else num_or_none(coords[1])

            loc_label = norm_ws(l.get("label")) or None

            locations.append(
                {
                    "loc_label": loc_label,
                    "loc_is_primary": 1 if (i == 0 or l.get("location_type") == "primary") else 0,
                    "loc_country": cc2(l.get("country_code") or l.get("country")),
                    "loc_plz": norm_ws(l.get("postal_code")) or None,
                    "loc_city": norm_ws(l.get("city")) or None,
                    "loc_street": norm_ws(l.get("street") or l.get("street_name")) or None,
                    "loc_housenumber": norm_ws(l.get("street_number") or l.get("house_number")) or None,
                    "loc_phone": norm_ws(l.get("phone")) or None,
                    "loc_email": norm_ws(l.get("email")) or None,
                    "loc_website": normalize_url(l.get("website")),
                    "loc_lat": lat,
                    "loc_lng": lng,
                    "loc_address_visibility": norm_ws(l.get("address_visibility")) or None,
                    "loc_geo_type": geo_type,
                }
            )

    primary = next((x for x in locations if x.get("loc_is_primary") == 1), locations[0] if locations else None)

    website = normalize_url(row.get("website"))
    email = norm_ws(row.get("email"))

    if not website and primary and primary.get("loc_website"):
        website = primary["loc_website"]
    if (not email or not looks_like_email(email)) and primary and primary.get("loc_email") and looks_like_email(primary["loc_email"]):
        email = primary["loc_email"]
    if email and not looks_like_email(email):
        email = ""

    display = " ".join([p for p in [title_raw, first, last] if p]).strip()
    if not display:
        display = norm_ws(row.get("name")) or f"covidhilfe_{row.get('id')}"

    is_dr = 1 if title_raw == "Dr." else 0

    ins = row.get("insurance_accepted") or []
    codes = set()
    if isinstance(ins, list):
        for it in ins:
            if isinstance(it, dict):
                codes.add(norm_ws(it.get("code")).lower())
            elif isinstance(it, str):
                codes.add(norm_ws(it).lower())
    accepts_gkv = "yes" if ("public" in codes or "gkv" in codes) else ("unknown" if not codes else "no")
    accepts_pkv = "yes" if ("private" in codes or "pkv" in codes) else ("unknown" if not codes else "no")

    org_name = None
    if primary and primary.get("loc_label"):
        k = norm_ws(primary["loc_label"]).lower()
        if k and k not in GENERIC_LOC_LABELS:
            org_name = primary["loc_label"]

    dr = {
        "dr_type": "physician",
        "dr_is_dr": is_dr,
        "dr_title_raw": title_raw,
        "dr_firstname": first,
        "dr_lastname": last,
        "dr_org_name": org_name,
        "dr_display_name": display,
        "dr_website": website,
        "dr_email": email or None,
        "dr_accepts_gkv": accepts_gkv,
        "dr_accepts_pkv": accepts_pkv,
        "dr_notes": None,
    }

    terms: List[Tuple[str, str, str]] = []

    def add_dict_terms(term_type: str, items: Any) -> None:
        if not isinstance(items, list):
            return
        for it in items:
            if not isinstance(it, dict):
                continue
            code = norm_ws(it.get("code"))
            label = norm_ws(it.get("label")) or code
            if code:
                terms.append((term_type, code, label))

    add_dict_terms("specialty", row.get("specialties"))
    add_dict_terms("badge", row.get("treatment_options"))
    add_dict_terms("accessibility", row.get("accessibility_features"))
    add_dict_terms("language", row.get("languages"))

    return dr, locations, terms

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

def existing_winner_in_db(db: DB, row: Dict[str, Any]) -> Optional[int]:
    return find_dr_by_first_last(db, row.get("first_name"), row.get("last_name"))

def insert_or_match_dr(db: DB, source_id: int, ext_id: str, dr: Dict[str, Any]) -> int:
    r = db.q1("SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s", (source_id, ext_id))
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
            dr.get("dr_type", "physician"),
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
          dr_org_name   = COALESCE(dr_org_name, %s),
          dr_website    = COALESCE(dr_website, %s),
          dr_email      = COALESCE(dr_email, %s),
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

def upsert_source_row(db: DB, dr_id: int, source_id: int, ext_id: str, url: str, payload: str) -> None:
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

def find_group_winner_ext_id(db: DB, source_id: int, group_rows: List[Dict[str, Any]]) -> str:
    # 1) already linked by external_id?
    for r in group_rows:
        ext_id = str(r.get("id"))
        linked = db.q1(
            "SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s",
            (source_id, ext_id),
        )
        if linked:
            return ext_id
    # 2) else pick_best
    return str(pick_best(group_rows).get("id"))

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

def short_name(r: Dict[str, Any]) -> str:
    return f"{norm_ws(r.get('title'))} {norm_ws(r.get('first_name'))} {norm_ws(r.get('last_name'))}".strip()

def main() -> None:
    args = parse_args()
    commit = args["commit"]
    pick_id = args["id"]
    do_all = args["all"]
    start = int(args["start"] or 0)
    limit = args["limit"]

    rows = load_covidhilfe_rows(COVIDHILFE_PATH)
    print(f"Loaded {len(rows)} covidhilfe rows from {COVIDHILFE_PATH}")

    dupe_groups = build_dupe_groups(rows)

    db = DB()
    try:
        ensure_schema(db)
        source_id = ensure_source_covidhilfe(db)

        # Cache winner ext_id per dupe_key
        group_winner_cache: Dict[str, str] = {}
        for k, grp in dupe_groups.items():
            if len(grp) > 1:
                group_winner_cache[k] = find_group_winner_ext_id(db, source_id, grp)

        # Build worklist
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
            work = [pick_best(rows)]

        stats = {
            "processed": 0,
            "imported": 0,
            "skipped_sourcefile_dupe": 0,
            "skipped_db_winner": 0,
            "skipped_other": 0,
        }
        skipped_log: List[Dict[str, Any]] = []

        for idx, sel in enumerate(work, start=1):
            ext_id = str(sel.get("id"))
            dupe_key = f"{norm_name_key(sel.get('first_name'))}|{norm_name_key(sel.get('last_name'))}"

            # (A) STRICT sourcefile dupe skip
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
                        "slug": sel.get("slug"),
                        "name": short_name(sel),
                    })
                    continue

            # (B) DB-winner rule (unless already linked by external_id)
            already_linked = db.q1(
                "SELECT dr_id FROM tbl_drs_sources_03 WHERE source_id=%s AND external_id=%s",
                (source_id, ext_id),
            )
            winner_dr_id = existing_winner_in_db(db, sel)

            if winner_dr_id is not None and not already_linked:
                stats["processed"] += 1
                stats["skipped_db_winner"] += 1
                skipped_log.append({
                    "reason": "duplicate_winner_already_in_db",
                    "dupe_key": dupe_key,
                    "winner_dr_id": int(winner_dr_id),
                    "skipped_ext_id": ext_id,
                    "slug": sel.get("slug"),
                    "name": short_name(sel),
                })
                continue

            # (C) Import
            dr, locations, terms = map_covidhilfe(sel)
            dr_id = insert_or_match_dr(db, source_id, ext_id, dr)
            backfill_dr_if_missing(db, dr_id, dr)

            payload = json.dumps(sel, ensure_ascii=False)
            upsert_source_row(db, dr_id, source_id, ext_id, cov_url(sel), payload)
            ensure_votes(db, dr_id)

            for loc in locations:
                insert_location_if_missing(db, dr_id, loc)

            for (term_type, code, label) in terms:
                term_id = upsert_term(db, term_type, code, label)
                link_term(db, dr_id, term_id, source_id)

            stats["processed"] += 1
            stats["imported"] += 1

            # lightweight progress
            if do_all and (idx % 25 == 0):
                print(f"... {idx}/{len(work)} processed | imported={stats['imported']} skipped={stats['skipped_sourcefile_dupe'] + stats['skipped_db_winner']}")

        # Write log (append)
        if skipped_log:
            append_skipped_log(skipped_log)
            print(f"Wrote log (append): {SKIPPED_LOG_PATH} (+{len(skipped_log)} entries)")

        # Commit/Rollback
        if commit:
            db.commit()
            print("COMMIT ✅")
        else:
            db.rollback()
            print("DRY RUN ✅ (rollback)")

        # Summary
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