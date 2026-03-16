#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LCN Import: Doctors/Providers into tbl_drs_02 + locations + terms + sources + votes (counter table)

- Idempotent via tbl_drs_sources_02 (source_id, external_id)
- Re-runnable without duplicates (best-effort)
- Reads DB creds from .env in same folder as this script
- Reads JSON files from ./market/
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
import csv
import hashlib


from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

# -------------------------
# PATHS / ENV
# -------------------------

BASE_DIR = Path(__file__).resolve().parent

# .env in same folder as script (recommended)
ENV_PATH = BASE_DIR / ".env"

# Optional fallback: if you keep .env one folder above, uncomment:
# ENV_PATH = BASE_DIR.parent / ".env"

if not ENV_PATH.exists():
    print(f"ERROR: .env nicht gefunden: {ENV_PATH}", file=sys.stderr)
    print("Tipp: Lege die .env in den gleichen Ordner wie market2db.py oder passe ENV_PATH im Script an.", file=sys.stderr)
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

MARKET_DIR = BASE_DIR / "market"
COVIDHILFE_PATH = MARKET_DIR / "covidhilfe_com_196.json"
MECFSMED_PATH = MARKET_DIR / "mecfsmed_de.json"
FASYNATION_PATH = MARKET_DIR / "fasynation.csv"

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
# NORMALIZATION
# -------------------------

def norm_ws(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def extract_domain(url: Optional[str]) -> str:
    url = norm_ws(url)
    if not url:
        return ""
    url = re.sub(r"^https?://", "", url, flags=re.I)
    url = url.split("/")[0].split("?")[0].split("#")[0]
    url = url.lower().replace("www.", "")
    return url

# -------------------------
# JSON LOADERS
# -------------------------

def split_concat_json(text: str) -> List[Dict[str, Any]]:
    """
    Robust splitter for concatenated JSON objects.
    - trims whitespace
    - removes UTF-8 BOM if present
    - ignores empty chunks
    - provides helpful debug on parse errors
    """
    # remove BOM + trim
    text = text.lstrip("\ufeff").strip()
    if not text:
        raise ValueError("covidhilfe file is empty after trimming")

    # split boundary: }\s*{
    parts: List[str] = []
    last = 0

    # This finds boundaries like:
    # }\n{   or  }\r\n   {   etc.
    for m in re.finditer(r"}\s*{", text):
        # cut AFTER the first }
        cut = m.start() + 1
        parts.append(text[last:cut].strip())
        last = m.start() + 1  # start at '{' of next
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

def load_fasynation_csv(path: Path) -> List[Dict[str, Any]]:
    """
    Reads your exported FasyNation CSV.
    Expected columns (flexible): Dr, Vorname, Nachname, PLZ, Land, Link, Fernberatung, Fachrichtung
    We map by header names case-insensitively and tolerate missing columns.
    """
    if not path.exists():
        die(f"Datei fehlt: {path}")

    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            die("FasyNation CSV hat keine Header-Zeile (fieldnames leer).")

        # normalize header map
        def get(d: Dict[str, Any], *keys: str) -> str:
            for k in keys:
                for hk in d.keys():
                    if hk.strip().lower() == k.strip().lower():
                        return norm_ws(d.get(hk))
            return ""

        for r in reader:
            # keep the raw dict but also expose normalized standard keys
            row = dict(r)
            row["_dr"] = get(r, "dr", "dr-titel", "doktor")
            row["_firstname"] = get(r, "vorname", "first_name", "firstname")
            row["_lastname"] = get(r, "nachname", "last_name", "lastname")
            row["_plz"] = get(r, "plz", "postal_code", "zip")
            row["_country"] = get(r, "land", "country")
            row["_link"] = get(r, "link", "url", "source_url", "website")
            row["_remote"] = get(r, "fernberatung", "remote", "telemedizin")
            row["_specialty"] = get(r, "fachrichtung", "specialty", "bereich")
            rows.append(row)

    return rows


def load_covidhilfe(path: Path) -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    text = text.lstrip("\ufeff").strip()

    # First try: normal JSON
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



def load_mecfsmed(path: Path) -> List[Dict[str, Any]]:
    obj = json.loads(path.read_text(encoding="utf-8"))
    data = obj.get("data", [])
    return data if isinstance(data, list) else []

# -------------------------
# DB LAYER
# -------------------------

@dataclass
class SourceIds:
    covidhilfe: int
    mecfsmed: int
    fasynation: int

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

def ensure_sources(db: DB) -> SourceIds:
    db.exec("INSERT IGNORE INTO tbl_sources (source_code, source_name) VALUES (%s,%s)", ("covidhilfe","CovidHilfe"))
    db.exec("INSERT IGNORE INTO tbl_sources (source_code, source_name) VALUES (%s,%s)", ("mecfsmed","MECFSmed"))
    db.exec("INSERT IGNORE INTO tbl_sources (source_code, source_name) VALUES (%s,%s)", ("fasynation","FasyNation"))

    def sid(code: str) -> int:
        r = db.q1("SELECT source_id FROM tbl_sources WHERE source_code=%s", (code,))
        if not r:
            die(f"source_id not found for {code}")
        return int(r[0])

    return SourceIds(covidhilfe=sid("covidhilfe"), mecfsmed=sid("mecfsmed"), fasynation=sid("fasynation"))

# -------------------------
# UPSERT HELPERS
# -------------------------

def find_dr_by_source(db: DB, source_id: int, external_id: str) -> Optional[int]:
    r = db.q1("SELECT dr_id FROM tbl_drs_sources_02 WHERE source_id=%s AND external_id=%s", (source_id, external_id))
    return int(r[0]) if r else None

def find_dr_by_domain(db: DB, website: str) -> Optional[int]:
    dom = extract_domain(website)
    if not dom:
        return None
    r = db.q1(
        """
        SELECT dr_id
        FROM tbl_drs_02
        WHERE dr_website IS NOT NULL AND dr_website <> ''
          AND LOWER(REPLACE(REPLACE(dr_website,'https://',''),'http://','')) LIKE %s
        LIMIT 1
        """,
        (f"%{dom}%",),
    )
    return int(r[0]) if r else None

def insert_dr(db: DB, fields: Dict[str, Any]) -> int:
    return db.exec(
        """
        INSERT INTO tbl_drs_02
          (dr_type, dr_is_dr, dr_title_raw, dr_firstname, dr_lastname, dr_org_name,
           dr_display_name, dr_website, dr_email, dr_accepts_gkv, dr_accepts_pkv, dr_notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            fields.get("dr_type","physician"),
            int(fields.get("dr_is_dr",0)),
            fields.get("dr_title_raw"),
            fields.get("dr_firstname"),
            fields.get("dr_lastname"),
            fields.get("dr_org_name"),
            fields.get("dr_display_name"),
            fields.get("dr_website"),
            fields.get("dr_email"),
            fields.get("dr_accepts_gkv","unknown"),
            fields.get("dr_accepts_pkv","unknown"),
            fields.get("dr_notes"),
        ),
    )

def upsert_dr_source(db: DB, dr_id: int, source_id: int, external_id: Optional[str], source_url: Optional[str], payload: str) -> None:
    if external_id:
        db.exec(
            """
            INSERT INTO tbl_drs_sources_02 (dr_id, source_id, external_id, source_url, payload_json)
            VALUES (%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
              dr_id = VALUES(dr_id),
              source_url = COALESCE(VALUES(source_url), source_url),
              payload_json = COALESCE(VALUES(payload_json), payload_json)
            """,
            (dr_id, source_id, external_id, source_url, payload),
        )
    else:
        # no external_id => just insert once per (dr_id, source_id, source_url)
        r = db.q1(
            "SELECT dr_source_id FROM tbl_drs_sources_02 WHERE dr_id=%s AND source_id=%s AND source_url=%s LIMIT 1",
            (dr_id, source_id, source_url),
        )
        if not r:
            db.exec(
                "INSERT INTO tbl_drs_sources_02 (dr_id, source_id, external_id, source_url, payload_json) VALUES (%s,%s,NULL,%s,%s)",
                (dr_id, source_id, source_url, payload),
            )

def ensure_votes(db: DB, dr_id: int) -> None:
    db.exec("INSERT IGNORE INTO tbl_drs_votes_02 (dr_id, vote_improved, vote_neutral, vote_worsened) VALUES (%s,0,0,0)", (dr_id,))

def upsert_term(db: DB, term_type: str, code: str, label: str) -> int:
    code = norm_ws(code)
    label = norm_ws(label) or code
    r = db.q1("SELECT term_id FROM tbl_terms_02 WHERE term_type=%s AND term_code=%s", (term_type, code))
    if r:
        term_id = int(r[0])
        db.exec("UPDATE tbl_terms_02 SET term_label=%s WHERE term_id=%s", (label, term_id))
        return term_id
    return db.exec("INSERT INTO tbl_terms_02 (term_type, term_code, term_label) VALUES (%s,%s,%s)", (term_type, code, label))

def link_dr_term(db: DB, dr_id: int, term_id: int, source_id: int) -> None:
    db.exec(
        "INSERT IGNORE INTO tbl_cpl_drs2terms_02 (dr_id, term_id, source_id, confidence) VALUES (%s,%s,%s,'high')",
        (dr_id, term_id, source_id),
    )

def insert_location(db: DB, dr_id: int, loc: Dict[str, Any]) -> None:
    # prevent duplicates by exact match on key fields
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
        return

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
        ),
    )

# -------------------------
# MAPPERS
# -------------------------

def map_covidhilfe(row: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Tuple[str,str,str]]]:
    title = row.get("title")
    first = norm_ws(row.get("first_name"))
    last  = norm_ws(row.get("last_name"))
    website = norm_ws(row.get("website"))
    email = norm_ws(row.get("email"))

    display = " ".join([p for p in [title, first, last] if p]).strip() or norm_ws(row.get("name")) or f"covidhilfe_{row.get('id')}"
    is_dr = 1 if (title and "dr" in str(title).lower()) else 0

    ins = row.get("insurance_accepted") or []
    ins_codes = {i.get("code") for i in ins if isinstance(i, dict)}
    accepts_gkv = "yes" if ("public" in ins_codes or "gkv" in ins_codes) else ("unknown" if not ins_codes else "no")
    accepts_pkv = "yes" if ("private" in ins_codes or "pkv" in ins_codes) else ("unknown" if not ins_codes else "no")

    dr = {
        "dr_type": "physician",
        "dr_is_dr": is_dr,
        "dr_title_raw": title,
        "dr_firstname": first or None,
        "dr_lastname": last or None,
        "dr_org_name": None,
        "dr_display_name": display,
        "dr_website": website or None,
        "dr_email": email or None,
        "dr_accepts_gkv": accepts_gkv,
        "dr_accepts_pkv": accepts_pkv,
        "dr_notes": None,
    }

    # locations
    locations: List[Dict[str, Any]] = []
    locs = row.get("doctor_location") or []
    if isinstance(locs, list) and locs:
        for i, l in enumerate(locs):
            if not isinstance(l, dict):
                continue
            locations.append({
                "loc_label": l.get("label"),
                "loc_is_primary": 1 if i == 0 else 0,
                "loc_country": l.get("country_code") or l.get("country"),
                "loc_plz": l.get("postal_code"),
                "loc_city": l.get("city"),
                "loc_street": l.get("street"),
                "loc_housenumber": l.get("street_number"),
                "loc_phone": l.get("phone"),
                "loc_email": l.get("email"),
                "loc_website": l.get("website"),
                "loc_lat": l.get("latitude"),
                "loc_lng": l.get("longitude"),
            })

    # terms
    terms: List[Tuple[str,str,str]] = []
    def add(term_type: str, items: Any) -> None:
        if not isinstance(items, list):
            return
        for it in items:
            if not isinstance(it, dict):
                continue
            code = norm_ws(it.get("code"))
            label = norm_ws(it.get("label")) or code
            if code:
                terms.append((term_type, code, label))

    add("specialty", row.get("specialties"))
    add("badge", row.get("treatment_options"))
    add("accessibility", row.get("accessibility_features"))
    add("language", row.get("languages"))

    return dr, locations, terms

def map_mecfsmed(row: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Tuple[str,str,str]]]:
    rid = row.get("id")
    attr = row.get("attributes") or {}
    if not isinstance(attr, dict):
        attr = {}

    title = norm_ws(attr.get("title"))
    first = norm_ws(attr.get("first_name"))
    last  = norm_ws(attr.get("last_name"))
    org   = norm_ws(attr.get("practice_name")) or norm_ws(attr.get("name"))
    website = norm_ws(attr.get("website"))
    email = norm_ws(attr.get("email"))

    display = " ".join([p for p in [title, first, last] if p]).strip() or org or f"mecfsmed_{rid}"
    is_dr = 1 if ("dr" in title.lower()) else 0

    dr = {
        "dr_type": "physician",
        "dr_is_dr": is_dr,
        "dr_title_raw": title or None,
        "dr_firstname": first or None,
        "dr_lastname": last or None,
        "dr_org_name": None if (first or last) else (org or None),
        "dr_display_name": display,
        "dr_website": website or None,
        "dr_email": email or None,
        "dr_accepts_gkv": "unknown",
        "dr_accepts_pkv": "unknown",
        "dr_notes": None,
    }

    locations = [{
        "loc_label": org or None,
        "loc_is_primary": 1,
        "loc_country": attr.get("country_code") or attr.get("country"),
        "loc_plz": attr.get("postal_code") or attr.get("zip") or attr.get("plz"),
        "loc_city": attr.get("city"),
        "loc_street": attr.get("street"),
        "loc_housenumber": attr.get("street_number") or attr.get("house_number"),
        "loc_phone": attr.get("phone"),
        "loc_email": email or None,
        "loc_website": website or None,
        "loc_lat": attr.get("latitude"),
        "loc_lng": attr.get("longitude"),
    }]

    terms: List[Tuple[str,str,str]] = []
    def add(term_type: str, items: Any) -> None:
        if not isinstance(items, list):
            return
        for it in items:
            if not isinstance(it, dict):
                continue
            code = norm_ws(it.get("code") or it.get("slug"))
            label = norm_ws(it.get("label") or it.get("name")) or code
            if code:
                terms.append((term_type, code, label))

    add("specialty", attr.get("specialties"))
    add("badge", attr.get("treatment_options"))
    add("accessibility", attr.get("accessibility_features"))
    add("language", attr.get("languages"))

    return dr, locations, terms

def truthy(s: str) -> bool:
    s = (s or "").strip().lower()
    return s in {"1", "true", "yes", "ja", "y", "x", "✓"}

def map_fasynation(row: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Tuple[str,str,str]]]:
    dr_title = row.get("_dr") or ""
    first = row.get("_firstname") or ""
    last = row.get("_lastname") or ""
    plz = row.get("_plz") or ""
    country = row.get("_country") or ""
    link = row.get("_link") or ""
    remote = row.get("_remote") or ""
    specialty = row.get("_specialty") or ""

    # is_dr: either "Dr" column true-ish OR title contains dr
    is_dr = 1 if truthy(dr_title) or ("dr" in dr_title.lower()) else 0
    title_raw = "Dr." if truthy(dr_title) else (dr_title if dr_title else None)

    display = " ".join([p for p in [title_raw, first, last] if p]).strip()
    if not display:
        display = norm_ws(link) or "fasynation_entry"

    dr = {
        "dr_type": "physician",         # FasyNation list is medical resources; adjust later if needed
        "dr_is_dr": is_dr,
        "dr_title_raw": title_raw,
        "dr_firstname": first or None,
        "dr_lastname": last or None,
        "dr_org_name": None,
        "dr_display_name": display,
        "dr_website": None,             # we keep fasynation link in dr_sources, not as website
        "dr_email": None,
        "dr_accepts_gkv": "unknown",
        "dr_accepts_pkv": "unknown",
        "dr_notes": None,
    }

    locations: List[Dict[str, Any]] = [{
        "loc_label": None,
        "loc_is_primary": 1,
        "loc_country": country[:2].upper() if country else None,  # best-effort
        "loc_plz": plz or None,
        "loc_city": None,
        "loc_street": None,
        "loc_housenumber": None,
        "loc_phone": None,
        "loc_email": None,
        "loc_website": None,
        "loc_lat": None,
        "loc_lng": None,
    }]

    terms: List[Tuple[str,str,str]] = []

    # Fernberatung as meta term
    if truthy(remote):
        terms.append(("meta", "remote-consultation", "Fernberatung möglich"))

    # Fachrichtung as specialty term (code from label)
    if specialty:
        code = re.sub(r"[^a-z0-9]+", "-", specialty.strip().lower())
        code = re.sub(r"-+", "-", code).strip("-")
        terms.append(("specialty", code, specialty))

    return dr, locations, terms

def make_fasynation_external_id(row: Dict[str, Any]) -> str:
    base = "|".join([
        row.get("_firstname",""),
        row.get("_lastname",""),
        row.get("_plz",""),
        row.get("_link",""),
    ]).strip().lower()
    return hashlib.sha1(base.encode("utf-8")).hexdigest()

# -------------------------
# IMPORT LOOP
# -------------------------

def import_rows(
    db: DB,
    source_id: int,
    rows: List[Dict[str, Any]],
    mapper,
    url_builder,
    external_id_fn=None,
) -> None:
    for idx, row in enumerate(rows, start=1):
        ext_id = str(row.get("id")) if row.get("id") is not None else None
        if ext_id is None and external_id_fn is not None:
            ext_id = external_id_fn(row)

        dr_id = find_dr_by_source(db, source_id, ext_id) if ext_id else None

        dr_fields, locations, terms = mapper(row)

        # map row to fields + locs + terms
        dr_fields, locations, terms = mapper(row)

        primary_plz = ""
        if locations and isinstance(locations, list):
            primary_plz = locations[0].get("loc_plz") or ""

        dr_id = find_existing_dr_global(
            db=db,
            source_id=source_id,
            ext_id=ext_id,
            first=dr_fields.get("dr_firstname") or "",
            last=dr_fields.get("dr_lastname") or "",
            org=dr_fields.get("dr_org_name") or "",
            website=dr_fields.get("dr_website") or "",
            primary_plz=primary_plz,
        )

        if not dr_id:
            dr_id = insert_dr(db, dr_fields)

        payload = json.dumps(row, ensure_ascii=False)
        upsert_dr_source(db, dr_id, source_id, ext_id, url_builder(row), payload)
        ensure_votes(db, dr_id)

        for loc in locations:
            insert_location(db, dr_id, loc)

        for (term_type, code, label) in terms:
            term_id = upsert_term(db, term_type, code, label)
            link_dr_term(db, dr_id, term_id, source_id)

        if idx % 50 == 0:
            db.commit()
            log(f"...commit bei {idx} Einträgen")
def find_existing_dr_global(
    db: DB,
    source_id: int,
    ext_id: Optional[str],
    first: str,
    last: str,
    org: str,
    website: str,
    primary_plz: str,
) -> Optional[int]:
    # 1) by source external id
    if ext_id:
        dr_id = find_dr_by_source(db, source_id, ext_id)
        if dr_id:
            return dr_id

    # 2) by website domain
    dr_id = find_dr_by_domain(db, website or "")
    if dr_id:
        return dr_id

    # 3) by person name + plz (primary location)
    dr_id = find_dr_by_name_plz(db, first or "", last or "", primary_plz or "")
    if dr_id:
        return dr_id

    # 4) by org/practice + plz (for entries without person name)
    org = norm_ws(org).lower()
    primary_plz = norm_ws(primary_plz)
    if org and primary_plz:
        r = db.q1(
            """
            SELECT d.dr_id
            FROM tbl_drs_02 d
            JOIN tbl_drs_locations_02 l ON l.dr_id=d.dr_id AND l.loc_is_primary=1
            WHERE LOWER(COALESCE(d.dr_org_name,''))=%s
              AND COALESCE(l.loc_plz,'')=%s
            LIMIT 1
            """,
            (org, primary_plz),
        )
        if r:
            return int(r[0])

    return None


def main() -> None:
    if not COVIDHILFE_PATH.exists():
        die(f"Datei fehlt: {COVIDHILFE_PATH}")
    if not MECFSMED_PATH.exists():
        die(f"Datei fehlt: {MECFSMED_PATH}")

    db = DB()
    try:
        sids = ensure_sources(db)

        log(f"DB: {DB_HOST}:{DB_PORT}/{DB_NAME}  |  ENV: {ENV_PATH}")
        log(f"Files: {COVIDHILFE_PATH.name}, {MECFSMED_PATH.name}")

        log("Loading covidhilfe...")
        covid_rows = load_covidhilfe(COVIDHILFE_PATH)
        log(f"covidhilfe rows: {len(covid_rows)}")

        def cov_url(r: Dict[str, Any]) -> Optional[str]:
            slug = r.get("slug")
            return f"https://covidhilfe.com/verzeichnis/aerzte/{slug}" if slug else "https://covidhilfe.com/verzeichnis/aerzte"

        log("Importing covidhilfe...")
        import_rows(db, sids.covidhilfe, covid_rows, map_covidhilfe, cov_url)
        db.commit()

        log("Loading mecfsmed...")
        mec_rows = load_mecfsmed(MECFSMED_PATH)
        log(f"mecfsmed rows: {len(mec_rows)}")

        def mec_url(_: Dict[str, Any]) -> Optional[str]:
            return "https://mecfsmed.de/verzeichnis/"

        log("Importing mecfsmed...")
        import_rows(db, sids.mecfsmed, mec_rows, map_mecfsmed, mec_url)
        db.commit()

        # ---------
        # FasyNation
        # ---------
        log("Loading fasynation...")
        fas_rows = load_fasynation_csv(FASYNATION_PATH)
        log(f"fasynation rows: {len(fas_rows)}")

        def fas_url(r: Dict[str, Any]) -> Optional[str]:
            return r.get("_link") or "https://www.fasynation.de/mecfs-ressourcen/"

        # Wir geben dem Import "id" mit: Hash als external_id
        # -> Dafür musst du in import_rows() ganz oben die ext_id Ermittlung erweitern:
        # ext_id = str(row.get("id")) ...  -> wenn None, für fasynation: make_fasynation_external_id(row)

        log("Importing fasynation...")
        import_rows(
            db,
            sids.fasynation,
            fas_rows,
            map_fasynation,
            fas_url,
            external_id_fn=make_fasynation_external_id,
        )

        db.commit()

        log("DONE ✅")

    except MySQLError as e:
        db.rollback()
        die(f"MySQL error: {e}")

    except Exception:
        db.rollback()
        warn("Unhandled exception (rollback).")
        traceback.print_exc()
        traceback.print_exc()
        sys.exit(2)
    finally:
        db.close()

if __name__ == "__main__":
    main()
