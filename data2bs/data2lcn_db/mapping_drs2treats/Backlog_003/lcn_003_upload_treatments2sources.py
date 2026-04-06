#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import math
import os
import sys
from dataclasses import dataclass
from typing import Dict, List, Tuple

import mysql.connector
import pandas as pd
from dotenv import dotenv_values

EXISTING_SOURCE_IDS = {
    "strasser": 23,
    "stingl_therapie_lc": 24,
}

INPUT_T2S = "003_treatments2sources.csv"
INPUT_TREATS = "003_new_treatments_03.with_ids.csv"
INPUT_SOURCES = "003_new_sources_03.with_ids.csv"
TABLE_NAME = "tbl_cpl_treatments2sources_03"


def is_blank(value) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip() == ""


def norm_text(value) -> str:
    if is_blank(value):
        return ""
    return str(value).strip().lower()


def to_int_or_none(value):
    if is_blank(value):
        return None
    return int(float(value))


def load_env(env_file: str) -> dict:
    env = dotenv_values(env_file)
    required = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    missing = [k for k in required if not env.get(k)]
    if missing:
        raise RuntimeError(f"Fehlende .env-Werte: {', '.join(missing)}")
    return env


def connect_db(env: dict):
    return mysql.connector.connect(
        host=env["LCN_DB_HOST"],
        port=int(env["LCN_DB_PORT"]),
        user=env["LCN_DB_USERNAME"],
        password=env["LCN_DB_PASSWORD"],
        database=env["LCN_DB_DATABASE"],
    )


def ensure_file(path: str):
    if not os.path.exists(path):
        raise FileNotFoundError(f"CSV nicht gefunden: {path}")


def read_csv(path: str) -> pd.DataFrame:
    return pd.read_csv(path, keep_default_na=True)


def write_csv(path: str, rows: List[dict], fieldnames: List[str]):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def fetch_existing_pairs(conn) -> set[Tuple[int, int]]:
    cur = conn.cursor()
    cur.execute(f"SELECT dr_id, treat_id FROM {TABLE_NAME}")
    return {(int(dr), int(tr)) for dr, tr in cur.fetchall()}


def fetch_columns(conn, table_name: str) -> List[str]:
    cur = conn.cursor()
    cur.execute(f"SHOW COLUMNS FROM {table_name}")
    return [r[0] for r in cur.fetchall()]


def insert_rows(conn, rows: List[dict]):
    if not rows:
        return 0
    cols = ["treat_id", "source_id", "sort_order", "relation_type", "note"]
    sql = f"INSERT INTO {TABLE_NAME} ({', '.join(cols)}) VALUES (%s, %s, %s, %s, %s)"
    data = [tuple(row.get(c) for c in cols) for row in rows]
    cur = conn.cursor()
    cur.executemany(sql, data)
    conn.commit()
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description="Upload für 003_treatments2sources.csv")
    ap.add_argument("--data-dir", required=True, help="Ordner mit Input-CSV-Dateien")
    ap.add_argument("--env-file", required=True, help="Pfad zur .env")
    ap.add_argument("--apply", action="store_true", help="Echten Insert ausführen")
    args = ap.parse_args()

    data_dir = args.data_dir
    env_file = args.env_file

    t2s_path = os.path.join(data_dir, INPUT_T2S)
    treats_path = os.path.join(data_dir, INPUT_TREATS)
    sources_path = os.path.join(data_dir, INPUT_SOURCES)

    for p in [t2s_path, treats_path, sources_path, env_file]:
        ensure_file(p)

    env = load_env(env_file)

    df_t2s = read_csv(t2s_path)
    df_treats = read_csv(treats_path)
    df_sources = read_csv(sources_path)

    if "slug" not in df_t2s.columns:
        raise RuntimeError("In 003_treatments2sources.csv fehlt die Spalte 'slug'.")
    if "source_key" not in df_t2s.columns:
        raise RuntimeError("In 003_treatments2sources.csv fehlt die Spalte 'source_key'.")
    if "slug" not in df_treats.columns or "treat_id" not in df_treats.columns:
        raise RuntimeError("In 003_new_treatments_03.with_ids.csv fehlen 'slug' oder 'treat_id'.")
    if "source_key" not in df_sources.columns or "source_id" not in df_sources.columns:
        raise RuntimeError("In 003_new_sources_03.with_ids.csv fehlen 'source_key' oder 'source_id'.")

    # Original-ID-Quellen strikt verwenden
    treat_map: Dict[str, int] = {}
    for _, r in df_treats.iterrows():
        key = norm_text(r.get("slug"))
        if not key:
            continue
        tid = to_int_or_none(r.get("treat_id"))
        if tid is None:
            continue
        if key in treat_map and treat_map[key] != tid:
            raise RuntimeError(f"Mehrdeutige treat_id für slug '{key}'.")
        treat_map[key] = tid

    source_map: Dict[str, int] = dict(EXISTING_SOURCE_IDS)
    for _, r in df_sources.iterrows():
        key = norm_text(r.get("source_key"))
        if not key:
            continue
        sid = to_int_or_none(r.get("source_id"))
        if sid is None:
            continue
        if key in source_map and source_map[key] != sid:
            raise RuntimeError(f"Mehrdeutige source_id für source_key '{key}'.")
        source_map[key] = sid

    preview_rows: List[dict] = []
    unresolved_rows: List[dict] = []
    duplicate_rows: List[dict] = []
    insert_rows_list: List[dict] = []

    seen_pairs = set()

    for _, r in df_t2s.iterrows():
        slug = norm_text(r.get("slug"))
        source_key = norm_text(r.get("source_key"))

        resolved_treat_id = treat_map.get(slug)
        resolved_source_id = source_map.get(source_key)

        sort_order = to_int_or_none(r.get("sort_order"))
        if sort_order is None:
            sort_order = 1

        relation_type = None if is_blank(r.get("relation_type")) else str(r.get("relation_type")).strip()
        note = None if is_blank(r.get("note")) else str(r.get("note")).strip()

        base = {k: ("" if is_blank(v) else v) for k, v in r.to_dict().items()}
        base["treat_id"] = "" if resolved_treat_id is None else resolved_treat_id
        base["source_id"] = "" if resolved_source_id is None else resolved_source_id
        base["resolved_via"] = "original_with_ids"
        if source_key in EXISTING_SOURCE_IDS:
            base["resolved_via"] = "existing_base_source_id"

        if resolved_treat_id is None or resolved_source_id is None:
            base["status"] = "unresolved"
            reasons = []
            if resolved_treat_id is None:
                reasons.append("treat_id fehlt aus 003_new_treatments_03.with_ids.csv")
            if resolved_source_id is None:
                reasons.append("source_id fehlt aus 003_new_sources_03.with_ids.csv / bestehender Source-Basis")
            base["reason"] = " | ".join(reasons)
            unresolved_rows.append(base)
            preview_rows.append(base)
            continue

        pair = (int(resolved_treat_id), int(resolved_source_id))
        if pair in seen_pairs:
            base["status"] = "duplicate_in_input"
            base["reason"] = "Doppelte Kombination (treat_id, source_id) im Input"
            duplicate_rows.append(base)
            preview_rows.append(base)
            continue

        seen_pairs.add(pair)
        base["status"] = "candidate_insert"
        base["reason"] = ""
        preview_rows.append(base)
        insert_rows_list.append(
            {
                "treat_id": int(resolved_treat_id),
                "source_id": int(resolved_source_id),
                "sort_order": int(sort_order),
                "relation_type": relation_type,
                "note": note,
                "slug": slug,
                "source_key": source_key,
                "behandlung": "" if is_blank(r.get("behandlung")) else str(r.get("behandlung")).strip(),
                "title": "" if is_blank(r.get("title")) else str(r.get("title")).strip(),
            }
        )

    preview_path = os.path.join(data_dir, "003_treatments2sources.preview.csv")
    unresolved_path = os.path.join(data_dir, "003_treatments2sources.unresolved.csv")
    duplicates_path = os.path.join(data_dir, "003_treatments2sources.duplicates.csv")
    apply_log_path = os.path.join(data_dir, "003_treatments2sources.apply_log.csv")

    preview_fields = list(preview_rows[0].keys()) if preview_rows else list(df_t2s.columns) + ["status", "reason", "resolved_via"]
    write_csv(preview_path, preview_rows, preview_fields)
    write_csv(unresolved_path, unresolved_rows, preview_fields)
    write_csv(duplicates_path, duplicate_rows, preview_fields)

    conn = connect_db(env)
    try:
        cols = fetch_columns(conn, TABLE_NAME)
        required_cols = ["treat_id", "source_id", "sort_order", "relation_type", "note"]
        missing_cols = [c for c in required_cols if c not in cols]
        if missing_cols:
            raise RuntimeError(f"In {TABLE_NAME} fehlen erwartete Spalten: {', '.join(missing_cols)}")

        existing_pairs = fetch_existing_pairs(conn)

        apply_candidates = []
        apply_log_rows = []
        for row in insert_rows_list:
            pair = (row["treat_id"], row["source_id"])
            log_row = dict(row)
            if pair in existing_pairs:
                log_row["apply_status"] = "skip_existing"
            else:
                log_row["apply_status"] = "insert"
                apply_candidates.append({
                    "treat_id": row["treat_id"],
                    "source_id": row["source_id"],
                    "sort_order": row["sort_order"],
                    "relation_type": row["relation_type"],
                    "note": row["note"],
                })
            apply_log_rows.append(log_row)

        apply_fields = list(apply_log_rows[0].keys()) if apply_log_rows else [
            "treat_id", "source_id", "sort_order", "relation_type", "note", "slug", "source_key", "behandlung", "title", "apply_status"
        ]
        write_csv(apply_log_path, apply_log_rows, apply_fields)

        print("LCN 003 – Upload Treatment↔Source")
        print("-" * 72)
        print(f"Input-Zeilen gesamt                : {len(df_t2s)}")
        print(f"Aufgelöste Kandidaten             : {len(insert_rows_list)}")
        print(f"Unresolved                        : {len(unresolved_rows)}")
        print(f"Interne Dubletten                 : {len(duplicate_rows)}")
        print(f"Bereits in DB vorhanden           : {sum(1 for r in apply_log_rows if r['apply_status'] == 'skip_existing')}")
        print(f"Neue Inserts möglich              : {sum(1 for r in apply_log_rows if r['apply_status'] == 'insert')}")
        print(f"Preview                           : {preview_path}")
        print(f"Unresolved                        : {unresolved_path}")
        print(f"Duplicates                        : {duplicates_path}")
        print(f"Apply-Log                         : {apply_log_path}")

        if unresolved_rows or duplicate_rows:
            print("\nFEHLER: Input ist noch nicht sauber insertfähig.")
            return 2

        if not args.apply:
            print("\nDry-Run beendet. Kein Insert ausgeführt.")
            return 0

        inserted = insert_rows(conn, apply_candidates)
        print(f"\nApply ausgeführt. Eingefügte Zeilen: {inserted}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FEHLER: {exc}")
        raise SystemExit(1)
