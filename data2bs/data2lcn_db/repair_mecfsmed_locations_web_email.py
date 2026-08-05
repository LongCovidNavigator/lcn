#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Repair / Fill MECFSmed:
- Write website/email into tbl_drs_02 (if empty)
- Insert 1 location into tbl_drs_locations_02 (from attributes)
- Match provider primarily by: firstname + lastname + PLZ
- DRY_RUN by default, commit only with --apply
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from lcn_env import lcn_env_path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

# -------------------------
# PATHS / ENV
# -------------------------

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = lcn_env_path()

# Files in ./market
MARKET_DIR = BASE_DIR / "market"
MECFSMED_PATH = MARKET_DIR / "mecfsmed_de.json"

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
# DB DRIVER
# -------------------------
try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except Exception:
    print("ERROR: mysql-connector-python fehlt. Installiere in deiner venv:", file=sys.stderr)
    print(r"  C:\xampp\htdocs\lcn\data2bs\.venv\Scripts\python.exe -m pip install mysql-connector-python", file=sys.stderr)
    sys.exit(1)

# -------------------------
# UTILS
# -------------------------

def log(msg: str) -> None:
    print(msg, flush=True)

def warn(msg: str) -> None:
    print(f"WARNING: {msg}", flush=True)

def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(code)

def norm_ws(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def norm_lower(s: Optional[str]) -> str:
    return norm_ws(s).lower()

def pick(*vals: Any) -> Optional[str]:
    """Return first non-empty string-ish."""
    for v in vals:
        if v is None:
            continue
        s = str(v).strip()
        if s != "":
            return s
    return None

def parse_args() -> Tuple[bool]:
    apply = "--apply" in sys.argv
    return apply

# -------------------------
# LOAD MECFSmed
# -------------------------

def load_mecfsmed_rows(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        die(f"Datei fehlt: {path}")
    obj = json.loads(path.read_text(encoding="utf-8"))
    data = obj.get("data", [])
    if not isinstance(data, list):
        return []
    return data

# -------------------------
# DB LAYER
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
# MATCHING
# -------------------------

def find_provider_by_name_plz(db: DB, first: str, last: str, plz: str) -> Optional[int]:
    first_n = norm_lower(first)
    last_n = norm_lower(last)
    plz_n = norm_ws(plz)

    if not last_n:
        return None

    # Match via drs + primary location PLZ (if locations already exist),
    # fallback: match via drs only + PLZ-less (not recommended).
    if plz_n:
        r = db.q1(
            """
            SELECT d.dr_id
            FROM tbl_drs_02 d
            JOIN tbl_drs_locations_02 l ON l.dr_id=d.dr_id AND l.loc_is_primary=1
            WHERE LOWER(COALESCE(d.dr_lastname,''))=%s
              AND (LOWER(COALESCE(d.dr_firstname,''))=%s OR %s = '')
              AND COALESCE(l.loc_plz,'')=%s
            LIMIT 1
            """,
            (last_n, first_n, first_n, plz_n),
        )
        if r:
            return int(r[0])

    # Fallback: if no locations exist yet (like your current situation),
    # match only on first+last in tbl_drs_02 (risky but acceptable for MECFSmed repair step).
    r = db.q1(
        """
        SELECT d.dr_id
        FROM tbl_drs_02 d
        WHERE LOWER(COALESCE(d.dr_lastname,''))=%s
          AND (LOWER(COALESCE(d.dr_firstname,''))=%s OR %s = '')
        LIMIT 1
        """,
        (last_n, first_n, first_n),
    )
    return int(r[0]) if r else None

# -------------------------
# UPDATES
# -------------------------

def update_provider_contact_if_empty(db: DB, dr_id: int, website: Optional[str], email: Optional[str]) -> Tuple[bool, bool]:
    row = db.q1("SELECT dr_website, dr_email FROM tbl_drs_02 WHERE dr_id=%s", (dr_id,))
    if not row:
        return (False, False)

    cur_web = norm_ws(row[0]) if row[0] else ""
    cur_mail = norm_ws(row[1]) if row[1] else ""

    did_web = False
    did_mail = False

    if website and cur_web == "":
        db.exec("UPDATE tbl_drs_02 SET dr_website=%s WHERE dr_id=%s", (website, dr_id))
        did_web = True

    if email and cur_mail == "":
        db.exec("UPDATE tbl_drs_02 SET dr_email=%s WHERE dr_id=%s", (email, dr_id))
        did_mail = True

    return (did_web, did_mail)

def insert_location_idempotent(db: DB, dr_id: int, loc: Dict[str, Any]) -> bool:
    """
    Returns True if inserted, False if already exists.
    """
    r = db.q1(
        """
        SELECT loc_id FROM tbl_drs_locations_02
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
        return False

    db.exec(
        """
        INSERT INTO tbl_drs_locations_02
          (dr_id, loc_label, loc_is_primary, loc_country, loc_plz, loc_city, loc_street, loc_housenumber,
           loc_phone, loc_email, loc_website, loc_lat, loc_lng)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            dr_id,
            loc.get("loc_label"),
            int(loc.get("loc_is_primary", 1)),
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
        ),
    )
    return True

# -------------------------
# MAIN
# -------------------------

def main() -> None:
    apply = parse_args()
    mode = "APPLY" if apply else "DRY_RUN"

    log(f"[{mode}] DB: {DB_HOST}:{DB_PORT}/{DB_NAME} | ENV: {ENV_PATH}")
    log(f"[{mode}] file: {MECFSMED_PATH}")

    rows = load_mecfsmed_rows(MECFSMED_PATH)
    log(f"[{mode}] mecfsmed rows loaded: {len(rows)}")

    db = DB()
    stats = {
        "rows": 0,
        "matched": 0,
        "not_found": 0,
        "web_filled": 0,
        "email_filled": 0,
        "loc_inserted": 0,
        "loc_exists": 0,
    }

    try:
        for i, item in enumerate(rows, start=1):
            stats["rows"] += 1
            attr = item.get("attributes") or {}
            if not isinstance(attr, dict):
                attr = {}

            first = norm_ws(pick(attr.get("first_name"), attr.get("firstname")) or "")
            last  = norm_ws(pick(attr.get("last_name"), attr.get("lastname")) or "")
            plz   = norm_ws(pick(attr.get("postal_code"), attr.get("zip"), attr.get("plz")) or "")

            website = norm_ws(pick(attr.get("website")) or "") or None
            email   = norm_ws(pick(attr.get("email")) or "") or None
            phone   = norm_ws(pick(attr.get("phone")) or "") or None

            # location fields in MECFSmed are not nested; they live in attributes
            country = pick(attr.get("country_code"), attr.get("country"))
            city    = pick(attr.get("city"))
            street  = pick(attr.get("street"), attr.get("street_name"))
            hn      = pick(attr.get("street_number"), attr.get("house_number"))
            lat     = attr.get("latitude")
            lng     = attr.get("longitude")

            dr_id = find_provider_by_name_plz(db, first, last, plz)
            if not dr_id:
                stats["not_found"] += 1
                continue

            stats["matched"] += 1

            did_web, did_mail = update_provider_contact_if_empty(db, dr_id, website, email)
            if did_web: stats["web_filled"] += 1
            if did_mail: stats["email_filled"] += 1

            loc = {
                "loc_label": pick(attr.get("practice_name"), attr.get("name")) or None,
                "loc_is_primary": 1,
                "loc_country": (str(country).upper()[:2] if country else None),
                "loc_plz": plz or None,
                "loc_city": city or None,
                "loc_street": street or None,
                "loc_housenumber": hn or None,
                "loc_phone": phone or None,
                "loc_email": email or None,
                "loc_website": website or None,
                "loc_lat": lat,
                "loc_lng": lng,
            }

            inserted = insert_location_idempotent(db, dr_id, loc)
            if inserted:
                stats["loc_inserted"] += 1
            else:
                stats["loc_exists"] += 1

            if i % 50 == 0:
                log(f"... {i}/{len(rows)}")

        if apply:
            db.commit()
            log("[APPLY] commit ✅")
        else:
            db.rollback()
            log("[DRY_RUN] rollback ✅")

        log("--- Summary ---")
        for k, v in stats.items():
            log(f"{k:12s}: {v}")

        if stats["not_found"] > 0:
            warn(f"{stats['not_found']} Einträge konnten nicht gematcht werden (Name/PLZ).")

    except MySQLError as e:
        db.rollback()
        die(f"MySQL error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
