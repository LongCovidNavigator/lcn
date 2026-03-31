#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import sources for treatments into tbl_treatments_sources_03.

Modes:
- default: DRY RUN (no DB writes)
- --write : real import

Design rules:
- Source of Truth = CSV
- No invented data
- No splits
- No reconstruction
- Review fields are ignored for final import
- Dry run shows:
  1) final DB payload preview
  2) skipped/error rows
  3) already existing rows by source_key
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pymysql
from dotenv import load_dotenv


# ============================================================
# CONFIG
# ============================================================

DEFAULT_ENV_PATH = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\.env"
DEFAULT_CSV_PATH = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\Master\sources4treatments_master_02.csv"
TABLE_NAME = "tbl_treatments_sources_03"

# CSV columns required to exist in file
REQUIRED_CSV_COLUMNS = [
    "source_key",
    "source_type",
    "title",
    "display_name",
    "landing_url",
    "source_url",
    "doi",
    "publisher",
    "authors",
    "publication_year",
    "journal_or_org",
    "citation_text",
    "source_detail",
    "note_internal",
]

# Optional CSV columns that may exist but are ignored for final import
OPTIONAL_CSV_COLUMNS = [
    "review_status",
    "review_reason",
]

# Written to DB
DB_COLUMNS = [
    "source_key",
    "source_type",
    "title",
    "display_name",
    "landing_url",
    "source_url",
    "doi",
    "publisher",
    "authors",
    "publication_year",
    "journal_or_org",
    "citation_text",
    "source_detail",
    "note_internal",
]

# DB field limits based on actual DDL
VARCHAR_LIMITS = {
    "source_key": 255,
    "source_type": 50,
    "title": 500,
    "display_name": 255,
    "landing_url": 1000,
    "source_url": 1000,
    "doi": 255,
    "publisher": 255,
    "authors": 1000,
    "journal_or_org": 255,
    "citation_text": 500,
}

SMALLINT_MIN = -32768
SMALLINT_MAX = 32767


# ============================================================
# DATA MODELS
# ============================================================

@dataclass
class RowIssue:
    row_num: int
    source_key: str
    field: str
    message: str


# ============================================================
# HELPERS
# ============================================================

def eprint(*args: Any, **kwargs: Any) -> None:
    print(*args, file=sys.stderr, **kwargs)


def normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text if text != "" else None


def normalize_publication_year(value: Any) -> Tuple[Optional[int], Optional[str]]:
    text = normalize_str(value)
    if text is None:
        return None, None

    try:
        year = int(text)
    except ValueError:
        return None, f"publication_year is not an integer: {text!r}"

    if not (SMALLINT_MIN <= year <= SMALLINT_MAX):
        return None, f"publication_year out of SMALLINT range: {year}"

    return year, None


def load_db_config(env_path: str) -> Dict[str, Any]:
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env not found: {env_path}")

    load_dotenv(env_path)

    host = os.getenv("LCN_DB_HOST")
    port = os.getenv("LCN_DB_PORT")
    user = os.getenv("LCN_DB_USERNAME")
    password = os.getenv("LCN_DB_PASSWORD")
    database = os.getenv("LCN_DB_DATABASE")

    missing = [
        name for name, value in {
            "LCN_DB_HOST": host,
            "LCN_DB_PORT": port,
            "LCN_DB_USERNAME": user,
            "LCN_DB_PASSWORD": password,
            "LCN_DB_DATABASE": database,
        }.items() if not value
    ]
    if missing:
        raise RuntimeError(f"Missing env vars: {', '.join(missing)}")

    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "database": database,
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }


def read_csv(csv_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    return rows, fieldnames


def validate_columns(fieldnames: List[str]) -> Tuple[List[str], List[str]]:
    missing = [col for col in REQUIRED_CSV_COLUMNS if col not in fieldnames]
    unknown = [col for col in fieldnames if col not in REQUIRED_CSV_COLUMNS + OPTIONAL_CSV_COLUMNS]
    return missing, unknown


def transform_row(raw: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    row: Dict[str, Any] = {}

    for col in REQUIRED_CSV_COLUMNS + OPTIONAL_CSV_COLUMNS:
        row[col] = normalize_str(raw.get(col))

    year, year_error = normalize_publication_year(raw.get("publication_year"))
    row["publication_year"] = year

    transform_errors: List[str] = []
    if year_error:
        transform_errors.append(year_error)

    return row, transform_errors


def validate_row_for_db(row_num: int, row: Dict[str, Any], transform_errors: List[str]) -> List[RowIssue]:
    issues: List[RowIssue] = []
    source_key = row.get("source_key") or ""

    # Transform errors first
    for msg in transform_errors:
        issues.append(RowIssue(row_num, source_key, "publication_year", msg))

    # Minimal import requirements
    if not row.get("source_key"):
        issues.append(RowIssue(row_num, source_key, "source_key", "missing source_key"))
    if not row.get("source_type"):
        issues.append(RowIssue(row_num, source_key, "source_type", "missing source_type"))
    if not row.get("title"):
        issues.append(RowIssue(row_num, source_key, "title", "missing title"))
    if not row.get("landing_url") and not row.get("source_url"):
        issues.append(RowIssue(row_num, source_key, "landing_url/source_url", "at least one URL is required"))

    # VARCHAR length checks against DB schema
    for field, max_len in VARCHAR_LIMITS.items():
        value = row.get(field)
        if value is not None and len(value) > max_len:
            issues.append(
                RowIssue(
                    row_num,
                    source_key,
                    field,
                    f"value too long for DB field ({len(value)} > {max_len})"
                )
            )

    return issues


def fetch_existing_source_keys(conn: pymysql.connections.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT source_key FROM {TABLE_NAME}")
        rows = cur.fetchall()
    return {str(r["source_key"]) for r in rows}


def build_db_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    return {col: row.get(col) for col in DB_COLUMNS}


def classify_rows(
    rows_raw: List[Dict[str, Any]],
    existing_keys: set[str],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Returns:
    - final_preview_rows: rows that would be inserted
    - skipped_rows: rows skipped because of DB-fit/import errors
    - already_exists_rows: rows skipped because source_key already exists
    """
    final_preview_rows: List[Dict[str, Any]] = []
    skipped_rows: List[Dict[str, Any]] = []
    already_exists_rows: List[Dict[str, Any]] = []

    seen_source_keys_in_csv: Dict[str, int] = {}

    for idx, raw in enumerate(rows_raw, start=2):  # header = row 1
        row, transform_errors = transform_row(raw)
        issues = validate_row_for_db(idx, row, transform_errors)

        source_key = row.get("source_key")

        # duplicate source_key inside CSV
        if source_key:
            if source_key in seen_source_keys_in_csv:
                issues.append(
                    RowIssue(
                        idx,
                        source_key,
                        "source_key",
                        f"duplicate source_key in CSV (first seen at row {seen_source_keys_in_csv[source_key]})"
                    )
                )
            else:
                seen_source_keys_in_csv[source_key] = idx

        if issues:
            skipped_rows.append({
                "row_num": idx,
                "source_key": source_key,
                "title": row.get("title"),
                "errors": " | ".join(f"{x.field}: {x.message}" for x in issues),
            })
            continue

        payload = build_db_payload(row)

        if source_key in existing_keys:
            already_exists_rows.append({
                "row_num": idx,
                "source_key": source_key,
                "title": row.get("title"),
            })
            continue

        final_preview_rows.append(payload)

    return final_preview_rows, skipped_rows, already_exists_rows


def print_table(title: str, rows: List[Dict[str, Any]], columns: List[str], limit: int) -> None:
    print(f"\n=== {title} ===")
    if not rows:
        print("(none)")
        return

    show = rows[:limit]
    print(f"Showing {len(show)} of {len(rows)} rows")
    print(" | ".join(columns))
    print("-" * 120)

    for row in show:
        values = []
        for col in columns:
            value = row.get(col)
            values.append("" if value is None else str(value))
        print(" | ".join(values))


def write_csv(path: Path, rows: List[Dict[str, Any]], columns: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def export_dry_run_files(
    preview_dir: Path,
    final_preview_rows: List[Dict[str, Any]],
    skipped_rows: List[Dict[str, Any]],
    already_exists_rows: List[Dict[str, Any]],
) -> None:
    write_csv(preview_dir / "01_final_import_preview.csv", final_preview_rows, DB_COLUMNS)
    write_csv(preview_dir / "02_skipped_rows.csv", skipped_rows, ["row_num", "source_key", "title", "errors"])
    write_csv(preview_dir / "03_already_exists.csv", already_exists_rows, ["row_num", "source_key", "title"])


def insert_rows(
    conn: pymysql.connections.Connection,
    final_preview_rows: List[Dict[str, Any]],
) -> int:
    sql = f"""
        INSERT INTO {TABLE_NAME} (
            source_key,
            source_type,
            title,
            display_name,
            landing_url,
            source_url,
            doi,
            publisher,
            authors,
            publication_year,
            journal_or_org,
            citation_text,
            source_detail,
            note_internal
        ) VALUES (
            %(source_key)s,
            %(source_type)s,
            %(title)s,
            %(display_name)s,
            %(landing_url)s,
            %(source_url)s,
            %(doi)s,
            %(publisher)s,
            %(authors)s,
            %(publication_year)s,
            %(journal_or_org)s,
            %(citation_text)s,
            %(source_detail)s,
            %(note_internal)s
        )
    """

    inserted = 0
    with conn.cursor() as cur:
        for row in final_preview_rows:
            cur.execute(sql, row)
            inserted += 1

    conn.commit()
    return inserted


# ============================================================
# MAIN
# ============================================================

def main() -> int:
    parser = argparse.ArgumentParser(description="Import treatment sources into tbl_treatments_sources_03")
    parser.add_argument("--env", default=DEFAULT_ENV_PATH, help="Path to .env file")
    parser.add_argument("--csv", default=DEFAULT_CSV_PATH, help="Path to sources4treatments_master_02.csv")
    parser.add_argument("--preview", type=int, default=10, help="How many rows to print per preview table")
    parser.add_argument("--preview-dir", default=None, help="Folder for dry-run CSV preview files")
    parser.add_argument("--write", action="store_true", help="Actually write to DB")
    args = parser.parse_args()

    mode = "WRITE" if args.write else "DRY RUN"

    print("=== SOURCES FOR TREATMENTS IMPORT _03 ===")
    print(f"MODE               : {mode}")
    print(f"ENV                : {args.env}")
    print(f"CSV                : {args.csv}")
    print(f"TABLE              : {TABLE_NAME}")

    try:
        rows_raw, fieldnames = read_csv(args.csv)
    except Exception as e:
        eprint(f"\nERROR reading CSV: {e}")
        return 1

    print(f"\nLoaded CSV rows    : {len(rows_raw)}")
    print(f"CSV columns        : {fieldnames}")

    missing_cols, unknown_cols = validate_columns(fieldnames)

    if missing_cols:
        eprint("\nERROR: Missing required CSV columns:")
        for col in missing_cols:
            eprint(f"  - {col}")
        return 1

    if unknown_cols:
        print("\nINFO: Unknown CSV columns found (ignored):")
        for col in unknown_cols:
            print(f"  - {col}")

    try:
        db_config = load_db_config(args.env)
        safe_cfg = dict(db_config)
        safe_cfg["password"] = "***"
        print("\nConnecting to DB   :", safe_cfg)
        conn = pymysql.connect(**db_config)
    except Exception as e:
        eprint(f"\nERROR connecting to DB: {e}")
        return 1

    try:
        existing_keys = fetch_existing_source_keys(conn)

        final_preview_rows, skipped_rows, already_exists_rows = classify_rows(rows_raw, existing_keys)

        print("\n=== SUMMARY ===")
        print(f"CSV total rows           : {len(rows_raw)}")
        print(f"Existing source_key in DB: {len(existing_keys)}")
        print(f"Would insert             : {len(final_preview_rows)}")
        print(f"Skipped (errors)         : {len(skipped_rows)}")
        print(f"Already exists           : {len(already_exists_rows)}")

        print_table(
            "FINAL IMPORT PREVIEW",
            final_preview_rows,
            DB_COLUMNS,
            args.preview,
        )

        print_table(
            "SKIPPED / ERROR ROWS",
            skipped_rows,
            ["row_num", "source_key", "title", "errors"],
            args.preview,
        )

        print_table(
            "ALREADY EXISTS",
            already_exists_rows,
            ["row_num", "source_key", "title"],
            args.preview,
        )

        preview_dir = Path(args.preview_dir) if args.preview_dir else Path(args.csv).resolve().parent / "_dry_run_preview"
        export_dry_run_files(preview_dir, final_preview_rows, skipped_rows, already_exists_rows)

        print("\n=== DRY RUN FILES ===")
        print(f"Final import preview : {preview_dir / '01_final_import_preview.csv'}")
        print(f"Skipped rows         : {preview_dir / '02_skipped_rows.csv'}")
        print(f"Already exists       : {preview_dir / '03_already_exists.csv'}")

        if not args.write:
            print("\nDRY RUN ONLY - no rows written.")
            return 0

        if skipped_rows:
            eprint("\nWRITE STOPPED: There are skipped/error rows. Fix them first or clean the CSV.")
            return 1

        inserted = insert_rows(conn, final_preview_rows)

        print("\n=== WRITE SUMMARY ===")
        print(f"Inserted rows         : {inserted}")
        print("Import finished successfully.")
        return 0

    except Exception as e:
        conn.rollback()
        eprint(f"\nERROR during import: {e}")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())