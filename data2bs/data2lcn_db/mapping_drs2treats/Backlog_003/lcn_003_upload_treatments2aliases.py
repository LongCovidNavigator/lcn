#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LCN 003 - Upload Treatment↔Alias coupling into tbl_cpl_treatments2aliases_03

Strict ID sources:
- treat_id ONLY from 003_new_treatments_03.with_ids.csv
- alias_id ONLY from 003_new_aliases_03.with_ids.csv

Special behavior:
- ignores any prefilled IDs in the coupling CSV for ID derivation
- only uses them for preview comparison if present
- default mode is DRY RUN
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from typing import Dict, List, Tuple, Any, Optional

from pathlib import Path

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py" ).is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

try:
    import mysql.connector
except Exception:
    mysql = None

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


COUPLING_FILE = "003_tbl_cpl_treatments2aliases.csv"
TREATMENTS_WITH_IDS = "003_new_treatments_03.with_ids.csv"
ALIASES_WITH_IDS = "003_new_aliases_03.with_ids.csv"
TABLE_NAME = "tbl_cpl_treatments2aliases_03"

PREVIEW_FILE = "003_tbl_cpl_treatments2aliases.preview.csv"
UNRESOLVED_FILE = "003_tbl_cpl_treatments2aliases.unresolved.csv"
DUPLICATES_FILE = "003_tbl_cpl_treatments2aliases.duplicates.csv"
APPLY_LOG_FILE = "003_tbl_cpl_treatments2aliases.apply_log.csv"


def fail(msg: str, code: int = 1) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(code)


def norm_str(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() in {"nan", "none", "null"}:
        return ""
    return s


def norm_int(v: Any, default: int = 0) -> int:
    s = norm_str(v)
    if not s:
        return default
    try:
        return int(float(s))
    except Exception:
        return default


def read_csv_rows(path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(path):
        fail(f"CSV nicht gefunden: {path}")
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


def write_csv(path: str, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def load_env(env_file: str) -> None:
    if load_dotenv is None:
        fail("python-dotenv ist nicht installiert.")
    if not os.path.exists(env_file):
        fail(f".env nicht gefunden: {env_file}")
    load_dotenv(env_file, override=True)


def connect_db():
    if mysql is None:
        fail("mysql-connector-python ist nicht installiert.")
    cfg = {
        "host": os.getenv("LCN_DB_HOST"),
        "port": int(os.getenv("LCN_DB_PORT", "3306")),
        "user": os.getenv("LCN_DB_USERNAME"),
        "password": os.getenv("LCN_DB_PASSWORD"),
        "database": os.getenv("LCN_DB_DATABASE"),
    }
    missing = [k for k, v in cfg.items() if v in (None, "", 0)]
    if missing:
        fail(f"Fehlende DB-Umgebungsvariablen: {', '.join(missing)}")
    return mysql.connector.connect(**cfg)


def get_existing_pairs(conn) -> set[Tuple[int, int]]:
    cur = conn.cursor()
    cur.execute(f"SELECT treat_id, alias_id FROM {TABLE_NAME}")
    rows = cur.fetchall()
    cur.close()
    return {(int(tid), int(aid)) for tid, aid in rows}


def build_treat_map(rows: List[Dict[str, Any]]) -> Dict[str, int]:
    m: Dict[str, int] = {}
    dupes = []
    for r in rows:
        slug = norm_str(r.get("slug"))
        tid = norm_str(r.get("treat_id"))
        if not slug or not tid:
            continue
        tid_i = int(float(tid))
        if slug in m and m[slug] != tid_i:
            dupes.append((slug, m[slug], tid_i))
        else:
            m[slug] = tid_i
    if dupes:
        fail(f"Widersprüchliche treat_id-Zuordnung in Originaldatei für slugs: {dupes[:10]}")
    return m


def build_alias_map(rows: List[Dict[str, Any]]) -> Dict[Tuple[str, str], int]:
    m: Dict[Tuple[str, str], int] = {}
    dupes = []
    for r in rows:
        alias = norm_str(r.get("alias"))
        alias_type = norm_str(r.get("alias_type"))
        aid = norm_str(r.get("alias_id"))
        if not alias or not alias_type or not aid:
            continue
        aid_i = int(float(aid))
        key = (alias, alias_type)
        if key in m and m[key] != aid_i:
            dupes.append((key, m[key], aid_i))
        else:
            m[key] = aid_i
    if dupes:
        fail(f"Widersprüchliche alias_id-Zuordnung in Originaldatei: {dupes[:10]}")
    return m


def enrich_rows(
    coupling_rows: List[Dict[str, Any]],
    treat_map: Dict[str, int],
    alias_map: Dict[Tuple[str, str], int],
    existing_pairs: set[Tuple[int, int]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    preview_rows: List[Dict[str, Any]] = []
    unresolved_rows: List[Dict[str, Any]] = []
    duplicate_rows: List[Dict[str, Any]] = []
    apply_candidates: List[Dict[str, Any]] = []

    seen_pairs: set[Tuple[int, int]] = set()

    for r in coupling_rows:
        base = dict(r)

        slug = norm_str(r.get("slug"))
        alias = norm_str(r.get("alias"))
        alias_type = norm_str(r.get("alias_type"))

        resolved_treat_id: Optional[int] = treat_map.get(slug)
        resolved_alias_id: Optional[int] = alias_map.get((alias, alias_type))

        base["resolved_treat_id"] = "" if resolved_treat_id is None else resolved_treat_id
        base["resolved_alias_id"] = "" if resolved_alias_id is None else resolved_alias_id

        # Write final IDs directly into preview-facing columns
        base["treat_id"] = "" if resolved_treat_id is None else resolved_treat_id
        base["alias_id"] = "" if resolved_alias_id is None else resolved_alias_id

        if resolved_treat_id is None or resolved_alias_id is None:
            base["action"] = "unresolved"
            unresolved_rows.append(base)
            preview_rows.append(base)
            continue

        pair = (resolved_treat_id, resolved_alias_id)

        if pair in seen_pairs:
            base["action"] = "duplicate_in_input"
            duplicate_rows.append(base)
            preview_rows.append(base)
            continue
        seen_pairs.add(pair)

        base["sort_order"] = norm_int(r.get("sort_order"), 0)
        base["note"] = norm_str(r.get("note"))

        if pair in existing_pairs:
            base["action"] = "skip_existing"
            preview_rows.append(base)
            continue

        base["action"] = "insert"
        preview_rows.append(base)
        apply_candidates.append(base)

    return preview_rows, unresolved_rows, duplicate_rows, apply_candidates


def insert_rows(conn, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    sql = f"""
        INSERT INTO {TABLE_NAME}
            (treat_id, alias_id, sort_order, note)
        VALUES
            (%s, %s, %s, %s)
    """
    log_rows: List[Dict[str, Any]] = []
    for r in rows:
        params = (
            int(r["treat_id"]),
            int(r["alias_id"]),
            norm_int(r.get("sort_order"), 0),
            norm_str(r.get("note")) or None,
        )
        cur.execute(sql, params)
        log_rows.append({
            "treat_id": r["treat_id"],
            "alias_id": r["alias_id"],
            "sort_order": norm_int(r.get("sort_order"), 0),
            "note": norm_str(r.get("note")),
            "db_status": "inserted",
        })
    conn.commit()
    cur.close()
    return log_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="LCN 003 - Upload Treatment↔Alias")
    parser.add_argument("--data-dir", required=True, help="Ordner mit den CSV-Dateien")
    parser.add_argument("--env-file", default=str(lcn_env_path()), help="Pfad zur .env")
    parser.add_argument("--apply", action="store_true", help="Echte Inserts ausführen")
    args = parser.parse_args()

    data_dir = args.data_dir
    coupling_path = os.path.join(data_dir, COUPLING_FILE)
    treat_ids_path = os.path.join(data_dir, TREATMENTS_WITH_IDS)
    alias_ids_path = os.path.join(data_dir, ALIASES_WITH_IDS)

    preview_path = os.path.join(data_dir, PREVIEW_FILE)
    unresolved_path = os.path.join(data_dir, UNRESOLVED_FILE)
    duplicates_path = os.path.join(data_dir, DUPLICATES_FILE)
    apply_log_path = os.path.join(data_dir, APPLY_LOG_FILE)

    coupling_rows = read_csv_rows(coupling_path)
    treat_rows = read_csv_rows(treat_ids_path)
    alias_rows = read_csv_rows(alias_ids_path)

    treat_map = build_treat_map(treat_rows)
    alias_map = build_alias_map(alias_rows)

    load_env(args.env_file)
    conn = connect_db()
    try:
        existing_pairs = get_existing_pairs(conn)

        preview_rows, unresolved_rows, duplicate_rows, apply_candidates = enrich_rows(
            coupling_rows, treat_map, alias_map, existing_pairs
        )

        preview_fields = list(coupling_rows[0].keys()) + [
            "resolved_treat_id", "resolved_alias_id", "action"
        ]
        # dedupe fields while preserving order
        preview_fields = list(dict.fromkeys(preview_fields))

        write_csv(preview_path, preview_rows, preview_fields)
        write_csv(unresolved_path, unresolved_rows, preview_fields)
        write_csv(duplicates_path, duplicate_rows, preview_fields)

        apply_log_rows: List[Dict[str, Any]] = []
        if args.apply and apply_candidates:
            apply_log_rows = insert_rows(conn, apply_candidates)
        if args.apply:
            log_fields = ["treat_id", "alias_id", "sort_order", "note", "db_status"]
            write_csv(apply_log_path, apply_log_rows, log_fields)

        print("LCN 003 – Upload Treatment↔Alias")
        print("-" * 72)
        print(f"Input-Zeilen gesamt                : {len(coupling_rows)}")
        print(f"Aufgelöste Kandidaten             : {len(preview_rows) - len(unresolved_rows) - len(duplicate_rows)}")
        print(f"Unresolved                        : {len(unresolved_rows)}")
        print(f"Interne Dubletten                 : {len(duplicate_rows)}")
        print(f"Bereits in DB vorhanden           : {sum(1 for r in preview_rows if r.get('action') == 'skip_existing')}")
        print(f"Neue Inserts möglich              : {len(apply_candidates)}")
        print(f"Preview                           : {preview_path}")
        print(f"Unresolved                        : {unresolved_path}")
        print(f"Duplicates                        : {duplicates_path}")
        print(f"Apply-Log                         : {apply_log_path}")
        if args.apply:
            print("Modus                             : APPLY")
            print(f"Tatsächlich eingefügt             : {len(apply_log_rows)}")
        else:
            print("Modus                             : DRY RUN")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
