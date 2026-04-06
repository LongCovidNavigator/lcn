#!/usr/bin/env python3
import argparse
import csv
import os
import sys
from typing import Dict, List, Tuple

try:
    import mysql.connector
except Exception:
    mysql = None

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


BACKLOG_FILENAME = "003_Backlog.csv"
TREAT_IDS_FILENAME = "003_new_treatments_03.with_ids.csv"
DEFAULT_TABLE = "tbl_cpl_drs2treatments_03"


class UploadError(Exception):
    pass


def read_csv(path: str) -> List[dict]:
    if not os.path.exists(path):
        raise UploadError(f"CSV nicht gefunden: {path}")
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: str, rows: List[dict], fieldnames: List[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def load_env(env_file: str) -> None:
    if not os.path.exists(env_file):
        raise UploadError(f".env nicht gefunden: {env_file}")
    if load_dotenv is None:
        raise UploadError("python-dotenv ist nicht installiert.")
    load_dotenv(env_file, override=True)


def connect_db():
    if mysql is None:
        raise UploadError("mysql-connector-python ist nicht installiert.")
    required = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise UploadError("Fehlende .env-Variablen: " + ", ".join(missing))
    return mysql.connector.connect(
        host=os.getenv("LCN_DB_HOST"),
        port=int(os.getenv("LCN_DB_PORT")),
        user=os.getenv("LCN_DB_USERNAME"),
        password=os.getenv("LCN_DB_PASSWORD"),
        database=os.getenv("LCN_DB_DATABASE"),
    )


def get_table_columns(conn, table: str) -> List[str]:
    cur = conn.cursor()
    cur.execute(f"SHOW COLUMNS FROM `{table}`")
    cols = [row[0] for row in cur.fetchall()]
    cur.close()
    return cols


def fetch_existing_pairs(conn, table: str) -> set[Tuple[int, int]]:
    cur = conn.cursor()
    cur.execute(f"SELECT dr_id, treat_id FROM `{table}`")
    pairs = {(int(dr), int(tr)) for dr, tr in cur.fetchall()}
    cur.close()
    return pairs


def build_treat_map(treat_rows: List[dict]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    duplicate_keys = set()
    for row in treat_rows:
        key = (row.get("treatment_name_normalized") or "").strip()
        tid = (row.get("treat_id") or "").strip()
        if not key or not tid:
            continue
        if key in out and out[key] != int(tid):
            duplicate_keys.add(key)
        out[key] = int(tid)
    if duplicate_keys:
        raise UploadError(
            "Uneindeutige treatment_name_normalized in with_ids-Datei: "
            + ", ".join(sorted(duplicate_keys))
        )
    return out


def clean_int(value: str, default=None):
    if value is None:
        return default
    s = str(value).strip()
    if s == "":
        return default
    try:
        return int(float(s))
    except ValueError:
        return default


def build_note(row: dict) -> str:
    parts = []
    for key in [
        "source_batch_id",
        "source_id",
        "source_name",
        "treatment_name_normalized",
    ]:
        val = (row.get(key) or "").strip()
        if val:
            parts.append(f"{key}={val}")
    return " | ".join(parts)


def prepare_rows(backlog_rows: List[dict], treat_map: Dict[str, int]):
    preview = []
    unresolved = []
    seen_pairs = set()
    duplicate_rows = []

    for idx, row in enumerate(backlog_rows, start=1):
        dr_id = clean_int(row.get("dr_id"))
        normalized = (row.get("treatment_name_normalized") or "").strip()
        direct_treat_id = clean_int(row.get("treat_id"))
        mapped_treat_id = treat_map.get(normalized)
        final_treat_id = direct_treat_id if direct_treat_id is not None else mapped_treat_id

        sort_order = clean_int(row.get("sort_order"), default=0)
        note = build_note(row)

        base = dict(row)
        base["row_no"] = idx
        base["resolved_treat_id"] = "" if final_treat_id is None else final_treat_id
        base["resolved_sort_order"] = sort_order
        base["resolved_note"] = note

        if dr_id is None or final_treat_id is None:
            base["status"] = "unresolved"
            unresolved.append(base)
            preview.append(base)
            continue

        pair = (dr_id, int(final_treat_id))
        if pair in seen_pairs:
            base["status"] = "duplicate_in_input"
            duplicate_rows.append(base)
            preview.append(base)
            continue

        seen_pairs.add(pair)
        base["status"] = "candidate_insert"
        preview.append(base)

    return preview, unresolved, duplicate_rows


def apply_upload(conn, table: str, candidate_rows: List[dict], existing_pairs: set[Tuple[int, int]]):
    cur = conn.cursor()
    inserted = 0
    skipped_existing = 0
    apply_log = []

    sql = (
        f"INSERT INTO `{table}` (dr_id, treat_id, sort_order, note) "
        f"VALUES (%s, %s, %s, %s)"
    )

    for row in candidate_rows:
        dr_id = clean_int(row.get("dr_id"))
        treat_id = clean_int(row.get("resolved_treat_id"))
        pair = (dr_id, treat_id)
        if pair in existing_pairs:
            row2 = dict(row)
            row2["apply_status"] = "skip_existing_db"
            apply_log.append(row2)
            skipped_existing += 1
            continue
        cur.execute(sql, (dr_id, treat_id, clean_int(row.get("resolved_sort_order"), 0), row.get("resolved_note") or None))
        row2 = dict(row)
        row2["apply_status"] = "inserted"
        apply_log.append(row2)
        inserted += 1
        existing_pairs.add(pair)

    conn.commit()
    cur.close()
    return inserted, skipped_existing, apply_log


def main():
    ap = argparse.ArgumentParser(description="LCN 003 Upload Dr↔Treatment-Kopplungen")
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--env-file", required=True)
    ap.add_argument("--table", default=DEFAULT_TABLE)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    backlog_path = os.path.join(args.data_dir, BACKLOG_FILENAME)
    treats_path = os.path.join(args.data_dir, TREAT_IDS_FILENAME)

    preview_path = os.path.join(args.data_dir, "003_Backlog.drs2treat.preview.csv")
    unresolved_path = os.path.join(args.data_dir, "003_Backlog.drs2treat.unresolved.csv")
    duplicates_path = os.path.join(args.data_dir, "003_Backlog.drs2treat.duplicates.csv")
    apply_log_path = os.path.join(args.data_dir, "003_Backlog.drs2treat.apply_log.csv")

    try:
        backlog_rows = read_csv(backlog_path)
        treat_rows = read_csv(treats_path)
        treat_map = build_treat_map(treat_rows)
        preview, unresolved, duplicate_rows = prepare_rows(backlog_rows, treat_map)

        preview_fields = list(preview[0].keys()) if preview else ["row_no", "status"]
        unresolved_fields = list(unresolved[0].keys()) if unresolved else preview_fields
        duplicate_fields = list(duplicate_rows[0].keys()) if duplicate_rows else preview_fields

        write_csv(preview_path, preview, preview_fields)
        write_csv(unresolved_path, unresolved, unresolved_fields)
        write_csv(duplicates_path, duplicate_rows, duplicate_fields)

        print(f"Backlog-Zeilen gesamt        : {len(backlog_rows)}")
        print(f"Kandidaten für Insert       : {sum(1 for r in preview if r['status']=='candidate_insert')}")
        print(f"Unaufgelöste Zeilen         : {len(unresolved)}")
        print(f"Interne Dubletten im Input  : {len(duplicate_rows)}")
        print(f"Preview-Datei               : {preview_path}")
        print(f"Unresolved-Datei            : {unresolved_path}")
        print(f"Duplicates-Datei            : {duplicates_path}")

        if not args.apply:
            print("Modus                      : DRY RUN (kein Insert)")
            return

        load_env(args.env_file)
        conn = connect_db()
        try:
            cols = get_table_columns(conn, args.table)
            required_cols = {"dr_id", "treat_id", "sort_order", "note"}
            missing_cols = sorted(required_cols - set(cols))
            if missing_cols:
                raise UploadError(
                    f"Zieltabelle {args.table} hat nicht die erwarteten Spalten: {', '.join(missing_cols)}"
                )
            existing_pairs = fetch_existing_pairs(conn, args.table)
            candidates = [r for r in preview if r["status"] == "candidate_insert"]
            inserted, skipped_existing, apply_log = apply_upload(conn, args.table, candidates, existing_pairs)
            fields = list(apply_log[0].keys()) if apply_log else preview_fields + ["apply_status"]
            write_csv(apply_log_path, apply_log, fields)
            print(f"Modus                      : APPLY")
            print(f"Bereits in DB vorhanden    : {skipped_existing}")
            print(f"Neu eingefügt              : {inserted}")
            print(f"Apply-Log                  : {apply_log_path}")
        finally:
            conn.close()
    except UploadError as e:
        print(f"FEHLER: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
