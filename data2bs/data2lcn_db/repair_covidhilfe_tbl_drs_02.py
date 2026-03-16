#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
REPAIR: Covidhilfe -> tbl_drs_02 + tbl_drs_locations_02
- Handles concatenated JSON in covidhilfe_com_196.json
- Extracts website/email from row OR from doctor_location (primary)
- DRY_RUN by default. Use --apply to write changes.
"""

from __future__ import annotations

import json
import os
import re
import sys
import argparse
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

# -------------------------
# PATHS / ENV
# -------------------------

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
MARKET_DIR = BASE_DIR / "market"
COVIDHILFE_PATH = MARKET_DIR / "covidhilfe_com_196.json"

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
# LOGGING
# -------------------------

def log(msg: str) -> None:
    print(msg, flush=True)

def warn(msg: str) -> None:
    print(f"WARNING: {msg}", flush=True)

def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(code)

# -------------------------
# HELPERS
# -------------------------

def norm_ws(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def truthy_title_is_dr(title: Optional[str]) -> int:
    t = (title or "").strip().lower()
    return 1 if ("dr" in t or "prof" in t) else 0

def pick_first_nonempty(*vals: Optional[str]) -> Optional[str]:
    for v in vals:
        v = norm_ws(v)
        if v:
            return v
    return None

# -------------------------
# JSON LOADERS (ROBUST)
# -------------------------

def split_concat_json(text: str) -> List[Dict[str, Any]]:
    """
    Robust splitter for concatenated JSON objects.
    Splits on boundaries like: }{ with whitespace between.
    """
    text = text.lstrip("\ufeff").strip()
    if not text:
        raise ValueError("covidhilfe file is empty after trimming")

    parts: List[str] = []
    last = 0
    for m in re.finditer(r"}\s*{", text):
        cut = m.start() + 1
        parts.append(text[last:cut].strip())
        last = m.start() + 1
    parts.append(text[last:].strip())

    docs: List[Dict[str, Any]] = []
    for i, p in enumerate(parts, start=1):
        p = p.strip()
        if not p:
            continue
        try:
            docs.append(json.loads(p))
        except json.JSONDecodeError as e:
            snippet = p[:400].replace("\r", "\\r").replace("\n", "\\n")
            raise json.JSONDecodeError(
                f"Chunk #{i} JSON parse failed: {e.msg}. Snippet: {snippet}",
                p,
                e.pos
            )
    return docs

def load_covidhilfe_rows(path: Path) -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    text = text.lstrip("\ufeff").strip()

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
# DB LAYER
# -------------------------

@dataclass
class SourceIds:
    covidhilfe: int

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

def ensure_covidhilfe_source(db: DB) -> SourceIds:
    db.exec("INSERT IGNORE INTO tbl_sources (source_code, source_name) VALUES (%s,%s)", ("covidhilfe","CovidHilfe"))
    r = db.q1("SELECT source_id FROM tbl_sources WHERE source_code=%s", ("covidhilfe",))
    if not r:
        die("source_id not found for covidhilfe")
    return SourceIds(covidhilfe=int(r[0]))

# -------------------------
# MAPPING: covidhilfe row -> dr fields + locations
# -------------------------

def extract_locations(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    locs = row.get("doctor_location") or []
    out: List[Dict[str, Any]] = []
    if isinstance(locs, list):
        for i, l in enumerate(locs):
            if not isinstance(l, dict):
                continue

            # NOTE: in your sample it's street_name not street
            street = pick_first_nonempty(l.get("street"), l.get("street_name"))
            housenumber = pick_first_nonempty(l.get("street_number"), l.get("house_number"))

            out.append({
                "loc_label": l.get("label"),
                "loc_is_primary": 1 if (str(l.get("location_type") or "").lower() == "primary" or i == 0) else 0,
                "loc_country": l.get("country_code") or l.get("country"),
                "loc_plz": l.get("postal_code"),
                "loc_city": l.get("city"),
                "loc_street": street,
                "loc_housenumber": housenumber,
                "loc_phone": l.get("phone"),
                "loc_email": l.get("email"),
                "loc_website": l.get("website"),
                "loc_lat": l.get("latitude"),
                "loc_lng": l.get("longitude"),
            })
    return out

def map_covidhilfe(row: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    title = norm_ws(row.get("title"))
    first = norm_ws(row.get("first_name"))
    last  = norm_ws(row.get("last_name"))

    # row-level website/email sometimes empty; often exists in primary location
    row_website = norm_ws(row.get("website"))
    row_email   = norm_ws(row.get("email"))

    locations = extract_locations(row)

    # find primary location (best-effort)
    primary_loc = None
    for l in locations:
        if int(l.get("loc_is_primary") or 0) == 1:
            primary_loc = l
            break
    if primary_loc is None and locations:
        primary_loc = locations[0]

    # fallback website/email from primary location
    loc_website = norm_ws(primary_loc.get("loc_website")) if primary_loc else ""
    loc_email   = norm_ws(primary_loc.get("loc_email")) if primary_loc else ""

    website = pick_first_nonempty(row_website, loc_website)
    email   = pick_first_nonempty(row_email, loc_email)

    display = " ".join([p for p in [title, first, last] if p]).strip() or norm_ws(row.get("name")) or f"covidhilfe_{row.get('id')}"

    # insurance accepted
    ins = row.get("insurance_accepted") or []
    ins_codes = {i.get("code") for i in ins if isinstance(i, dict)}
    accepts_gkv = "yes" if ("public" in ins_codes or "gkv" in ins_codes) else ("unknown" if not ins_codes else "no")
    accepts_pkv = "yes" if ("private" in ins_codes or "pkv" in ins_codes) else ("unknown" if not ins_codes else "no")

    dr = {
        "dr_type": "physician",
        "dr_is_dr": truthy_title_is_dr(title),
        "dr_title_raw": title or None,
        "dr_firstname": first or None,
        "dr_lastname": last or None,
        "dr_org_name": None,
        "dr_display_name": display,
        "dr_website": website,
        "dr_email": email,
        "dr_accepts_gkv": accepts_gkv,
        "dr_accepts_pkv": accepts_pkv,
        "dr_notes": None,
    }
    return dr, locations

# -------------------------
# DB OPS
# -------------------------

def upsert_dr_by_external_id(
    db: DB,
    sids: SourceIds,
    external_id: str,
    dr_fields: Dict[str, Any],
    source_url: Optional[str],
    payload_json: str,
) -> int:
    """
    Ensures:
      - tbl_drs_sources_02 has (source_id, external_id) -> dr_id
      - tbl_drs_02 row exists and is updated with repaired website/email
    """
    # 1) resolve existing dr_id by source mapping
    r = db.q1(
        "SELECT dr_id FROM tbl_drs_sources_02 WHERE source_id=%s AND external_id=%s",
        (sids.covidhilfe, external_id),
    )
    if r:
        dr_id = int(r[0])
        # update dr core fields (repair)
        db.exec(
            """
            UPDATE tbl_drs_02
            SET dr_title_raw=%s,
                dr_firstname=%s,
                dr_lastname=%s,
                dr_display_name=%s,
                dr_website=%s,
                dr_email=%s,
                dr_accepts_gkv=%s,
                dr_accepts_pkv=%s
            WHERE dr_id=%s
            """,
            (
                dr_fields.get("dr_title_raw"),
                dr_fields.get("dr_firstname"),
                dr_fields.get("dr_lastname"),
                dr_fields.get("dr_display_name"),
                dr_fields.get("dr_website"),
                dr_fields.get("dr_email"),
                dr_fields.get("dr_accepts_gkv"),
                dr_fields.get("dr_accepts_pkv"),
                dr_id,
            ),
        )
    else:
        # 2) insert new provider
        dr_id = db.exec(
            """
            INSERT INTO tbl_drs_02
              (dr_type, dr_is_dr, dr_title_raw, dr_firstname, dr_lastname, dr_org_name,
               dr_display_name, dr_website, dr_email, dr_accepts_gkv, dr_accepts_pkv, dr_notes)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                dr_fields.get("dr_type","physician"),
                int(dr_fields.get("dr_is_dr",0)),
                dr_fields.get("dr_title_raw"),
                dr_fields.get("dr_firstname"),
                dr_fields.get("dr_lastname"),
                dr_fields.get("dr_org_name"),
                dr_fields.get("dr_display_name"),
                dr_fields.get("dr_website"),
                dr_fields.get("dr_email"),
                dr_fields.get("dr_accepts_gkv","unknown"),
                dr_fields.get("dr_accepts_pkv","unknown"),
                dr_fields.get("dr_notes"),
            ),
        )

        # 3) insert source link
        db.exec(
            """
            INSERT INTO tbl_drs_sources_02 (dr_id, source_id, external_id, source_url, payload_json)
            VALUES (%s,%s,%s,%s,%s)
            """,
            (dr_id, sids.covidhilfe, external_id, source_url, payload_json),
        )

    return dr_id

def upsert_locations(db: DB, dr_id: int, locations: List[Dict[str, Any]]) -> int:
    """
    Inserts missing locations. Returns number inserted (best-effort).
    """
    inserted = 0
    for loc in locations:
        # dedupe by core address fields
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
            continue

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
                int(loc.get("loc_is_primary") or 0),
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
        inserted += 1

    return inserted

# -------------------------
# MAIN
# -------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes to DB")
    args = ap.parse_args()
    dry = not args.apply

    if not COVIDHILFE_PATH.exists():
        die(f"Datei fehlt: {COVIDHILFE_PATH}")

    log(f"[{'DRY_RUN' if dry else 'APPLY'}] DB: {DB_HOST}:{DB_PORT}/{DB_NAME} | ENV: {ENV_PATH}")
    log(f"[{'DRY_RUN' if dry else 'APPLY'}] file: {COVIDHILFE_PATH}")

    rows = load_covidhilfe_rows(COVIDHILFE_PATH)
    log(f"[{'DRY_RUN' if dry else 'APPLY'}] covidhilfe rows loaded: {len(rows)}")

    db = DB()
    try:
        sids = ensure_covidhilfe_source(db)

        updated_or_inserted = 0
        loc_inserted_total = 0

        for idx, row in enumerate(rows, start=1):
            ext_id = row.get("id")
            if ext_id is None:
                warn(f"row #{idx} has no id -> skip")
                continue
            ext_id = str(ext_id)

            dr_fields, locations = map_covidhilfe(row)

            slug = row.get("slug")
            source_url = f"https://covidhilfe.com/verzeichnis/aerzte/{slug}" if slug else "https://covidhilfe.com/verzeichnis/aerzte"
            payload = json.dumps(row, ensure_ascii=False)

            if dry:
                # just count what we'd do
                updated_or_inserted += 1
                loc_inserted_total += len(locations)
            else:
                dr_id = upsert_dr_by_external_id(db, sids, ext_id, dr_fields, source_url, payload)
                inserted = upsert_locations(db, dr_id, locations)
                updated_or_inserted += 1
                loc_inserted_total += inserted

            if idx % 50 == 0:
                if not dry:
                    db.commit()
                log(f"... {idx}/{len(rows)}")

        if dry:
            db.rollback()
            log("[DRY_RUN] rollback ✅")
        else:
            db.commit()
            log("[APPLY] commit ✅")

        log("--- Summary ---")
        log(f"providers processed : {updated_or_inserted}")
        log(f"locations inserted  : {loc_inserted_total}  (DRY_RUN counts raw locations)")

    except MySQLError as e:
        db.rollback()
        die(f"MySQL error: {e}")
    except Exception:
        db.rollback()
        warn("Unhandled exception (rollback).")
        traceback.print_exc()
        sys.exit(2)
    finally:
        db.close()

if __name__ == "__main__":
    main()
