#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import matched doctor-treatment batch rows into tbl_cpl_drs2treatments_03.

Default mode:
- DRY RUN
- No DB writes
- Writes a local preview CSV of the intended coupling-table rows

Apply mode:
- Use --apply to actually insert into DB

Behavior:
- Read matched CSV
- Import only rows that are clearly matched
- Idempotent: skip existing (dr_id, treat_id)
- Minimalistic target mapping based on existing table design
"""

from __future__ import annotations

import csv
import os
import sys
import argparse
from typing import Dict, List, Tuple, Set, Optional

from dotenv import load_dotenv
import pymysql


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

INPUT_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\003_mapping_drs2treat_url_aus_tbl_drs_03.csv"
PREVIEW_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\003_mapping_drs2treat_url_aus_tbl_drs_03_import_preview.csv"
ENV_PATH = r"/data2lcn_db/.env"

TARGET_TABLE = "tbl_cpl_drs2treatments_03"
TBL_DRS = "tbl_drs_03"
TBL_TREATMENTS = "tbl_treatments_03"

CSV_ENCODING = "utf-8-sig"
CSV_DELIMITER = ","

ALLOWED_MATCH_STATUSES = {"matched_exact", "matched_alias", "matched_new_alias"}
SKIP_DECISION_VALUES = {"0"}


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def clean_cell(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip()


def safe_int(value: Optional[str]) -> Optional[int]:
    v = clean_cell(value)
    if not v:
        return None
    try:
        return int(float(v))
    except Exception:
        return None


def is_truthy_nonzero_decision(value: Optional[str]) -> bool:
    # Batch 003 override: decision is intentionally ignored for import gating.
    return True


def load_env(env_path: str) -> None:
    if not os.path.isfile(env_path):
        raise FileNotFoundError(f".env file not found: {env_path}")
    load_dotenv(env_path, override=True)


def get_db_connection():
    host = os.getenv("LCN_DB_HOST")
    port = os.getenv("LCN_DB_PORT", "3306")
    user = os.getenv("LCN_DB_USERNAME")
    password = os.getenv("LCN_DB_PASSWORD")
    database = os.getenv("LCN_DB_DATABASE")

    missing = []
    if not host:
        missing.append("LCN_DB_HOST")
    if not user:
        missing.append("LCN_DB_USERNAME")
    if not password:
        missing.append("LCN_DB_PASSWORD")
    if not database:
        missing.append("LCN_DB_DATABASE")

    if missing:
        raise RuntimeError(
            f"Missing required DB env vars in {ENV_PATH}: {', '.join(missing)}"
        )

    return pymysql.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def read_csv_rows(path: str) -> Tuple[List[str], List[Dict[str, str]]]:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Input CSV not found: {path}")

    with open(path, "r", encoding=CSV_ENCODING, newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_DELIMITER)
        headers = list(reader.fieldnames or [])
        rows = []
        for row in reader:
            normalized_row = {k: (v if v is not None else "") for k, v in row.items()}
            rows.append(normalized_row)

    if not headers:
        raise RuntimeError("CSV appears to have no header row.")

    return headers, rows


def write_csv_rows(path: str, headers: List[str], rows: List[Dict[str, str]]) -> None:
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(path, "w", encoding=CSV_ENCODING, newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=headers,
            delimiter=CSV_DELIMITER,
            extrasaction="ignore",
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        for row in rows:
            safe_row = {h: row.get(h, "") for h in headers}
            writer.writerow(safe_row)


def build_note(row: Dict[str, str]) -> str:
    parts: List[str] = []

    source_batch_id = clean_cell(row.get("source_batch_id"))
    source_id = clean_cell(row.get("source_id"))
    treat_match_status = clean_cell(row.get("treat_match_status"))
    recommendation_type = clean_cell(row.get("recommendation_type"))
    evidence_strength = clean_cell(row.get("evidence_strength"))
    notes = clean_cell(row.get("notes"))
    match_notes = clean_cell(row.get("match_notes"))

    if source_batch_id:
        parts.append(f"source_batch_id={source_batch_id}")
    if source_id:
        parts.append(f"source_id={source_id}")
    if treat_match_status:
        parts.append(f"match_status={treat_match_status}")
    if recommendation_type:
        parts.append(f"recommendation_type={recommendation_type}")
    if evidence_strength:
        parts.append(f"evidence_strength={evidence_strength}")
    if notes:
        parts.append(f"csv_notes={notes}")
    if match_notes:
        parts.append(f"match_notes={match_notes}")

    return " | ".join(parts)


# ---------------------------------------------------------------------------
# DB LOOKUPS
# ---------------------------------------------------------------------------

def load_existing_pairs(conn) -> Set[Tuple[int, int]]:
    sql = f"""
        SELECT dr_id, treat_id
        FROM {TARGET_TABLE}
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    existing: Set[Tuple[int, int]] = set()
    for row in rows:
        existing.add((int(row["dr_id"]), int(row["treat_id"])))
    return existing


def load_treatment_names(conn) -> Dict[int, str]:
    sql = f"""
        SELECT treat_id, behandlung
        FROM {TBL_TREATMENTS}
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    result: Dict[int, str] = {}
    for row in rows:
        treat_id = row.get("treat_id")
        name = clean_cell(row.get("behandlung"))
        if treat_id is not None:
            result[int(treat_id)] = name
    return result


def insert_pair(
    conn,
    dr_id: int,
    treat_id: int,
    sort_order: int,
    note: str,
) -> None:
    sql = f"""
        INSERT INTO {TARGET_TABLE}
            (dr_id, treat_id, sort_order, note)
        VALUES
            (%s, %s, %s, %s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (dr_id, treat_id, sort_order, note))


# ---------------------------------------------------------------------------
# IMPORT LOGIC
# ---------------------------------------------------------------------------

def should_import_row(row: Dict[str, str]) -> Tuple[bool, str]:
    treat_match_status = clean_cell(row.get("treat_match_status"))
    decision = clean_cell(row.get("decision"))
    dr_id = safe_int(row.get("dr_id"))
    treat_id = safe_int(row.get("treat_id"))

    if treat_match_status not in ALLOWED_MATCH_STATUSES:
        return False, f"skip_status_not_importable:{treat_match_status or '<empty>'}"

    if not is_truthy_nonzero_decision(decision):
        return False, "skip_decision_0"

    if dr_id is None:
        return False, "skip_invalid_dr_id"

    if treat_id is None:
        return False, "skip_invalid_treat_id"

    return True, "would_insert"


def init_counters() -> Dict[str, int]:
    return {
        "rows_read": 0,
        "eligible_rows": 0,
        "would_insert": 0,
        "inserted": 0,
        "skip_existing_db": 0,
        "skip_duplicate_in_batch": 0,
        "skip_status_not_importable": 0,
        "skip_decision_0": 0,
        "skip_invalid_dr_id": 0,
        "skip_invalid_treat_id": 0,
        "preview_rows_written": 0,
    }


def increment_action_counter(action: str, counters: Dict[str, int]) -> None:
    if action in counters:
        counters[action] += 1


def build_preview_row(
    row: Dict[str, str],
    action: str,
    treatment_names: Dict[int, str],
) -> Dict[str, str]:
    dr_id = safe_int(row.get("dr_id"))
    treat_id = safe_int(row.get("treat_id"))
    sort_order = safe_int(row.get("sort_order")) or 0
    note = build_note(row)

    doctor_name = clean_cell(row.get("doctor_name"))

    return {
        "dr_id": str(dr_id) if dr_id is not None else "",
        "doctor_name": doctor_name,
        "treat_id": str(treat_id) if treat_id is not None else "",
        "treatment_name": treatment_names.get(treat_id, "") if treat_id is not None else "",
        "sort_order": str(sort_order),
        "note": note,
        "import_action": action,
    }


def run_import(apply_mode: bool) -> int:
    mode_label = "APPLY" if apply_mode else "DRY RUN"
    print("=== DRS -> TREAT IMPORT ===")
    print(f"MODE     : {mode_label}")
    print(f"ENV      : {ENV_PATH}")
    print(f"INPUT    : {INPUT_CSV}")
    print(f"PREVIEW  : {PREVIEW_CSV}")
    print(f"TABLE    : {TARGET_TABLE}")

    load_env(ENV_PATH)
    headers, rows = read_csv_rows(INPUT_CSV)

    counters = init_counters()
    counters["rows_read"] = len(rows)

    preview_rows: List[Dict[str, str]] = []

    with get_db_connection() as conn:
        existing_db_pairs = load_existing_pairs(conn)
        treatment_names = load_treatment_names(conn)

        seen_batch_pairs: Set[Tuple[int, int]] = set()

        try:
            for row in rows:
                should_import, action = should_import_row(row)

                dr_id = safe_int(row.get("dr_id"))
                treat_id = safe_int(row.get("treat_id"))

                if not should_import:
                    increment_action_counter(action, counters)
                    preview_rows.append(
                        build_preview_row(
                            row=row,
                            action=action,
                            treatment_names=treatment_names,
                        )
                    )
                    continue

                counters["eligible_rows"] += 1

                assert dr_id is not None
                assert treat_id is not None

                pair = (dr_id, treat_id)

                if pair in seen_batch_pairs:
                    action = "skip_duplicate_in_batch"
                    counters[action] += 1
                    preview_rows.append(
                        build_preview_row(
                            row=row,
                            action=action,
                            treatment_names=treatment_names,
                        )
                    )
                    continue

                if pair in existing_db_pairs:
                    action = "skip_existing_db"
                    counters[action] += 1
                    seen_batch_pairs.add(pair)
                    preview_rows.append(
                        build_preview_row(
                            row=row,
                            action=action,
                            treatment_names=treatment_names,
                        )
                    )
                    continue

                action = "would_insert"
                counters[action] += 1

                preview_rows.append(
                    build_preview_row(
                        row=row,
                        action=action,
                        treatment_names=treatment_names,
                    )
                )

                if apply_mode:
                    sort_order = safe_int(row.get("sort_order")) or 0
                    note = build_note(row)

                    insert_pair(
                        conn=conn,
                        dr_id=dr_id,
                        treat_id=treat_id,
                        sort_order=sort_order,
                        note=note,
                    )
                    counters["inserted"] += 1
                    existing_db_pairs.add(pair)

                seen_batch_pairs.add(pair)

            if apply_mode:
                conn.commit()
            else:
                conn.rollback()

        except Exception:
            conn.rollback()
            raise

    preview_headers = [
        "dr_id",
        "doctor_name",
        "treat_id",
        "treatment_name",
        "sort_order",
        "note",
        "import_action",
    ]
    write_csv_rows(PREVIEW_CSV, preview_headers, preview_rows)
    counters["preview_rows_written"] = len(preview_rows)

    print_summary(headers, counters, apply_mode)
    return 0


# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------

def print_summary(headers: List[str], counters: Dict[str, int], apply_mode: bool) -> None:
    print("\n=== IMPORT SUMMARY ===")
    print(f"Mode                         : {'APPLY' if apply_mode else 'DRY RUN'}")
    print(f"Input headers                : {len(headers)}")
    print(f"Rows read                    : {counters['rows_read']}")
    print(f"Eligible rows                : {counters['eligible_rows']}")
    print("-" * 60)
    print(f"Would insert                 : {counters['would_insert']}")
    print(f"Inserted                     : {counters['inserted']}")
    print(f"Skipped existing in DB       : {counters['skip_existing_db']}")
    print(f"Skipped duplicate in batch   : {counters['skip_duplicate_in_batch']}")
    print("-" * 60)
    print(f"Skipped non-importable status: {counters['skip_status_not_importable']}")
    print(f"Skipped decision=0           : {counters['skip_decision_0']}")
    print(f"Skipped invalid dr_id        : {counters['skip_invalid_dr_id']}")
    print(f"Skipped invalid treat_id     : {counters['skip_invalid_treat_id']}")
    print("-" * 60)
    print(f"Preview rows written         : {counters['preview_rows_written']}")
    print(f"Preview CSV                  : {PREVIEW_CSV}")
    print("Imported statuses            : matched_exact, matched_alias")
    print("DB uniqueness logic          : (dr_id, treat_id)")
    print("Table written                : tbl_cpl_drs2treatments_03")
    print("=== END ===\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import matched drs->treatment rows into tbl_cpl_drs2treatments_03"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually insert into DB. Default is dry run.",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main() -> int:
    try:
        args = parse_args()
        return run_import(apply_mode=args.apply)
    except KeyboardInterrupt:
        print("\nAborted by user.")
        return 130
    except Exception as exc:
        print("\nERROR:")
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
