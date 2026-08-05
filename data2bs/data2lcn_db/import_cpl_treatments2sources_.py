#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Import links into tbl_cpl_treatments2sources_03 from a CSV created from the LCN
master mapping workflow.

Default behavior:
- DRY RUN only
- validates CSV structure and values
- validates FK existence against tbl_treatments_03 and tbl_treatments_sources_03
- skips links that already exist in DB
- writes preview/report CSVs
- can optionally compare the effective DB state against the master CSV

Apply mode:
- use --apply to insert new links inside one DB transaction

Expected import CSV columns:
    treat_id,source_id,sort_order,relation_type,note

Optional master CSV columns for comparison:
    treat_id,...,matched_source_id,...
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from lcn_env import lcn_env_path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import pymysql


# ---------- Configuration ----------
SCRIPT_PATH = Path(__file__).resolve()
BASE_DIR = SCRIPT_PATH.parent
DEFAULT_ENV_PATH = lcn_env_path()
DEFAULT_IMPORT_CSV = BASE_DIR / "Master" / "tbl_cpl_treatments2sources_03_from_master_01.csv"
DEFAULT_MASTER_CSV = BASE_DIR / "Master" / "treatment_source_mapping_master_01.csv"
DEFAULT_OUTPUT_DIR = BASE_DIR / "Prev_02" / "out_treatments2sources_03"

TARGET_TABLE = "tbl_cpl_treatments2sources_03"
TREAT_TABLE = "tbl_treatments_03"
SOURCE_TABLE = "tbl_treatments_sources_03"

REQUIRED_IMPORT_COLUMNS = ["treat_id", "source_id", "sort_order", "relation_type", "note"]
REQUIRED_MASTER_COLUMNS_FOR_COMPARE = ["treat_id", "matched_source_id"]


# ---------- Helpers ----------
@dataclass
class ImportRow:
    row_nr: int
    treat_id: Optional[int]
    source_id: Optional[int]
    sort_order: Optional[int]
    relation_type: Optional[str]
    note: Optional[str]
    raw: Dict[str, str]


@dataclass
class ValidationIssue:
    row_nr: int
    severity: str
    message: str
    treat_id: Optional[int]
    source_id: Optional[int]


@dataclass
class LinkView:
    treat_id: int
    source_id: int
    sort_order: int
    relation_type: Optional[str]
    note: Optional[str]
    behandlung: Optional[str]
    slug: Optional[str]
    typ: Optional[str]
    source_title: Optional[str]
    source_display_name: Optional[str]
    source_type: Optional[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import tbl_cpl_treatments2sources_03 from CSV.")
    parser.add_argument("--csv-path", default=str(DEFAULT_IMPORT_CSV), help="Path to import CSV")
    parser.add_argument("--master-csv", default=str(DEFAULT_MASTER_CSV), help="Path to master CSV for comparison")
    parser.add_argument("--env-path", default=str(DEFAULT_ENV_PATH), help="Path to .env file")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for preview/report CSVs")
    parser.add_argument("--apply", action="store_true", help="Actually insert rows into DB")
    return parser.parse_args()


def parse_simple_env(env_path: Path) -> Dict[str, str]:
    if not env_path.exists():
        raise FileNotFoundError(f".env not found: {env_path}")

    values: Dict[str, str] = {}
    with env_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            values[key] = value
    return values


def db_config_from_env(values: Dict[str, str]) -> Dict[str, object]:
    required = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise KeyError(f"Missing DB env keys: {', '.join(missing)}")

    return {
        "host": values["LCN_DB_HOST"],
        "port": int(values["LCN_DB_PORT"]),
        "user": values["LCN_DB_USERNAME"],
        "password": values["LCN_DB_PASSWORD"],
        "database": values["LCN_DB_DATABASE"],
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }


def detect_delimiter(csv_path: Path) -> str:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
    if ";" in sample and "," not in sample:
        return ";"
    return ","


def empty_to_none(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    return text


def parse_int_field(value: object, field_name: str, row_nr: int, issues: List[ValidationIssue]) -> Optional[int]:
    text = empty_to_none(value)
    if text is None:
        issues.append(ValidationIssue(row_nr, "error", f"{field_name} is empty", None, None))
        return None
    try:
        return int(text)
    except ValueError:
        issues.append(ValidationIssue(row_nr, "error", f"{field_name} is not an integer: {text}", None, None))
        return None


def read_import_csv(csv_path: Path) -> Tuple[List[ImportRow], List[ValidationIssue]]:
    if not csv_path.exists():
        raise FileNotFoundError(f"Import CSV not found: {csv_path}")

    delimiter = detect_delimiter(csv_path)
    issues: List[ValidationIssue] = []
    rows: List[ImportRow] = []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        if reader.fieldnames is None:
            raise ValueError("Import CSV has no header row")
        missing = [c for c in REQUIRED_IMPORT_COLUMNS if c not in reader.fieldnames]
        if missing:
            raise ValueError(f"Import CSV missing required columns: {', '.join(missing)}")

        for row_nr, raw in enumerate(reader, start=2):
            treat_id = parse_int_field(raw.get("treat_id"), "treat_id", row_nr, issues)
            source_id = parse_int_field(raw.get("source_id"), "source_id", row_nr, issues)
            sort_order = parse_int_field(raw.get("sort_order"), "sort_order", row_nr, issues)
            relation_type = empty_to_none(raw.get("relation_type"))
            note = empty_to_none(raw.get("note"))

            rows.append(
                ImportRow(
                    row_nr=row_nr,
                    treat_id=treat_id,
                    source_id=source_id,
                    sort_order=sort_order,
                    relation_type=relation_type,
                    note=note,
                    raw=raw,
                )
            )

    return rows, issues


def read_master_csv(master_csv_path: Path) -> List[Dict[str, str]]:
    if not master_csv_path.exists():
        return []

    delimiter = detect_delimiter(master_csv_path)
    with master_csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        if reader.fieldnames is None:
            return []
        missing = [c for c in REQUIRED_MASTER_COLUMNS_FOR_COMPARE if c not in reader.fieldnames]
        if missing:
            raise ValueError(f"Master CSV missing required compare columns: {', '.join(missing)}")
        return list(reader)


def write_csv(path: Path, rows: Sequence[Dict[str, object]], fieldnames: Sequence[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})


def fetch_table_as_map(conn, query: str, key_field: str) -> Dict[int, Dict[str, object]]:
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {int(row[key_field]): row for row in rows}


def fetch_existing_links(conn) -> Dict[Tuple[int, int], Dict[str, object]]:
    query = f"""
        SELECT treat_id, source_id, sort_order, relation_type, note
        FROM {TARGET_TABLE}
    """
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {(int(r["treat_id"]), int(r["source_id"])): r for r in rows}


def build_link_view(row: ImportRow, treat_map: Dict[int, Dict[str, object]], source_map: Dict[int, Dict[str, object]]) -> Dict[str, object]:
    t = treat_map.get(row.treat_id or -1, {})
    s = source_map.get(row.source_id or -1, {})
    return {
        "row_nr": row.row_nr,
        "treat_id": row.treat_id,
        "behandlung": t.get("behandlung"),
        "slug": t.get("slug"),
        "typ": t.get("typ"),
        "source_id": row.source_id,
        "source_title": s.get("title"),
        "source_display_name": s.get("display_name"),
        "source_type": s.get("source_type"),
        "sort_order": row.sort_order,
        "relation_type": row.relation_type,
        "note": row.note,
    }


def validate_rows(
    rows: Sequence[ImportRow],
    treat_map: Dict[int, Dict[str, object]],
    source_map: Dict[int, Dict[str, object]],
    existing_links: Dict[Tuple[int, int], Dict[str, object]],
) -> Tuple[List[ImportRow], List[Dict[str, object]], List[Dict[str, object]], List[Dict[str, object]]]:
    seen_in_csv: Dict[Tuple[int, int], int] = {}
    valid_new_rows: List[ImportRow] = []
    ok_rows: List[Dict[str, object]] = []
    skipped_rows: List[Dict[str, object]] = []
    error_rows: List[Dict[str, object]] = []

    for row in rows:
        row_view = build_link_view(row, treat_map, source_map)

        if row.treat_id is None or row.source_id is None or row.sort_order is None:
            row_view.update({"status": "error", "message": "Missing required integer field"})
            error_rows.append(row_view)
            continue
        if row.sort_order < 1:
            row_view.update({"status": "error", "message": "sort_order must be >= 1"})
            error_rows.append(row_view)
            continue
        if row.treat_id not in treat_map:
            row_view.update({"status": "error", "message": f"treat_id not found in {TREAT_TABLE}"})
            error_rows.append(row_view)
            continue
        if row.source_id not in source_map:
            row_view.update({"status": "error", "message": f"source_id not found in {SOURCE_TABLE}"})
            error_rows.append(row_view)
            continue

        key = (row.treat_id, row.source_id)
        if key in seen_in_csv:
            row_view.update({
                "status": "error",
                "message": f"duplicate pair in CSV, first seen on row {seen_in_csv[key]}",
            })
            error_rows.append(row_view)
            continue
        seen_in_csv[key] = row.row_nr

        if key in existing_links:
            existing = existing_links[key]
            row_view.update({
                "status": "skipped_existing",
                "message": "link already exists in DB",
                "db_sort_order": existing.get("sort_order"),
                "db_relation_type": existing.get("relation_type"),
                "db_note": existing.get("note"),
            })
            skipped_rows.append(row_view)
            continue

        row_view.update({"status": "ok", "message": "valid new link"})
        ok_rows.append(row_view)
        valid_new_rows.append(row)

    return valid_new_rows, ok_rows, skipped_rows, error_rows


def insert_rows(conn, rows: Sequence[ImportRow]) -> int:
    if not rows:
        return 0

    sql = f"""
        INSERT INTO {TARGET_TABLE}
            (treat_id, source_id, sort_order, relation_type, note)
        VALUES
            (%s, %s, %s, %s, %s)
    """
    payload = [
        (row.treat_id, row.source_id, row.sort_order, row.relation_type, row.note)
        for row in rows
    ]
    with conn.cursor() as cur:
        cur.executemany(sql, payload)
    return len(payload)


def fetch_db_current_view(conn) -> List[Dict[str, object]]:
    sql = f"""
        SELECT
            l.treatment_source_link_id,
            l.treat_id,
            t.behandlung,
            t.slug,
            t.typ,
            l.source_id,
            s.title AS source_title,
            s.display_name AS source_display_name,
            s.source_type,
            l.sort_order,
            l.relation_type,
            l.note,
            l.created_at,
            l.updated_at
        FROM {TARGET_TABLE} l
        INNER JOIN {TREAT_TABLE} t ON t.treat_id = l.treat_id
        INNER JOIN {SOURCE_TABLE} s ON s.source_id = l.source_id
        ORDER BY l.treat_id, l.sort_order, l.source_id
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def build_effective_preview(
    existing_links: Dict[Tuple[int, int], Dict[str, object]],
    new_rows: Sequence[ImportRow],
    treat_map: Dict[int, Dict[str, object]],
    source_map: Dict[int, Dict[str, object]],
) -> List[Dict[str, object]]:
    effective: List[Dict[str, object]] = []

    for (treat_id, source_id), db_row in existing_links.items():
        row = ImportRow(
            row_nr=0,
            treat_id=treat_id,
            source_id=source_id,
            sort_order=int(db_row.get("sort_order") or 1),
            relation_type=empty_to_none(db_row.get("relation_type")),
            note=empty_to_none(db_row.get("note")),
            raw={},
        )
        view = build_link_view(row, treat_map, source_map)
        view["status"] = "already_in_db"
        effective.append(view)

    for row in new_rows:
        view = build_link_view(row, treat_map, source_map)
        view["status"] = "would_insert"
        effective.append(view)

    effective.sort(key=lambda x: (x.get("treat_id") or 0, x.get("sort_order") or 0, x.get("source_id") or 0))
    return effective


def build_master_compare(master_rows: Sequence[Dict[str, str]], effective_rows: Sequence[Dict[str, object]]) -> List[Dict[str, object]]:
    effective_by_treat: Dict[int, List[Dict[str, object]]] = {}
    for row in effective_rows:
        treat_id = int(row["treat_id"])
        effective_by_treat.setdefault(treat_id, []).append(row)

    compare_rows: List[Dict[str, object]] = []
    for raw in master_rows:
        treat_id_text = raw.get("treat_id", "").strip()
        if not treat_id_text:
            continue
        treat_id = int(treat_id_text)
        expected_source_text = raw.get("matched_source_id", "").strip()
        expected_source_id = int(expected_source_text) if expected_source_text else None
        linked_rows = effective_by_treat.get(treat_id, [])
        actual_source_ids = ",".join(str(r["source_id"]) for r in linked_rows)
        actual_source_titles = " | ".join(str(r.get("source_title") or "") for r in linked_rows)
        is_match = expected_source_id is not None and len(linked_rows) == 1 and linked_rows[0]["source_id"] == expected_source_id

        compare_rows.append({
            "treat_id": treat_id,
            "behandlung": raw.get("behandlung"),
            "matched_source_id_master": expected_source_id,
            "matched_source_title_master": raw.get("matched_source_title"),
            "db_or_preview_source_ids": actual_source_ids,
            "db_or_preview_source_titles": actual_source_titles,
            "compare_status": "match" if is_match else "check",
        })

    compare_rows.sort(key=lambda x: x["treat_id"])
    return compare_rows


def mask_db_config(cfg: Dict[str, object]) -> Dict[str, object]:
    masked = dict(cfg)
    if "password" in masked:
        masked["password"] = "***"
    return masked


def main() -> int:
    args = parse_args()

    csv_path = Path(args.csv_path).resolve()
    master_csv_path = Path(args.master_csv).resolve()
    env_path = Path(args.env_path).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"=== TREATMENT ↔ SOURCE LINK IMPORT ({TARGET_TABLE}) ===")
    print(f"ENV               : {env_path}")
    print(f"IMPORT CSV        : {csv_path}")
    print(f"MASTER CSV        : {master_csv_path}")
    print(f"OUTPUT DIR        : {output_dir}")
    print(f"MODE              : {mode}")

    env_values = parse_simple_env(env_path)
    cfg = db_config_from_env(env_values)
    print(f"Connecting to     : {mask_db_config(cfg)}")

    import_rows, parse_issues = read_import_csv(csv_path)
    print(f"Loaded import rows: {len(import_rows)}")

    parse_issue_rows = [
        {
            "row_nr": issue.row_nr,
            "status": issue.severity,
            "message": issue.message,
            "treat_id": issue.treat_id,
            "source_id": issue.source_id,
        }
        for issue in parse_issues
    ]

    master_rows: List[Dict[str, str]] = []
    if master_csv_path.exists():
        master_rows = read_master_csv(master_csv_path)
        print(f"Loaded master rows: {len(master_rows)}")
    else:
        print("Loaded master rows: 0 (master CSV not found, compare step skipped)")

    conn = pymysql.connect(**cfg)
    try:
        treat_map = fetch_table_as_map(
            conn,
            f"SELECT treat_id, behandlung, slug, typ FROM {TREAT_TABLE}",
            "treat_id",
        )
        source_map = fetch_table_as_map(
            conn,
            f"SELECT source_id, title, display_name, source_type FROM {SOURCE_TABLE}",
            "source_id",
        )
        existing_links = fetch_existing_links(conn)

        print(f"DB treatments     : {len(treat_map)}")
        print(f"DB sources        : {len(source_map)}")
        print(f"Existing links    : {len(existing_links)}")

        valid_new_rows, ok_rows, skipped_rows, validation_error_rows = validate_rows(
            import_rows, treat_map, source_map, existing_links
        )

        all_error_rows = parse_issue_rows + validation_error_rows

        ok_fieldnames = [
            "row_nr", "status", "message", "treat_id", "behandlung", "slug", "typ",
            "source_id", "source_title", "source_display_name", "source_type",
            "sort_order", "relation_type", "note",
        ]
        skipped_fieldnames = ok_fieldnames + ["db_sort_order", "db_relation_type", "db_note"]
        error_fieldnames = [
            "row_nr", "status", "message", "treat_id", "source_id",
            "behandlung", "slug", "typ", "source_title", "source_display_name", "source_type",
            "sort_order", "relation_type", "note",
        ]

        write_csv(output_dir / "upload_preview_ok.csv", ok_rows, ok_fieldnames)
        write_csv(output_dir / "upload_preview_skipped.csv", skipped_rows, skipped_fieldnames)
        write_csv(output_dir / "upload_preview_errors.csv", all_error_rows, error_fieldnames)

        inserted_count = 0
        if args.apply:
            if all_error_rows:
                print("Apply aborted: validation errors present. See upload_preview_errors.csv")
                conn.rollback()
                return 1
            inserted_count = insert_rows(conn, valid_new_rows)
            conn.commit()
            print(f"Inserted rows     : {inserted_count}")
        else:
            conn.rollback()
            print(f"Would insert rows : {len(valid_new_rows)}")

        db_current_view = fetch_db_current_view(conn)
        if not args.apply:
            effective_preview = build_effective_preview(existing_links, valid_new_rows, treat_map, source_map)
            write_csv(
                output_dir / "db_effective_preview.csv",
                effective_preview,
                [
                    "status", "row_nr", "treat_id", "behandlung", "slug", "typ",
                    "source_id", "source_title", "source_display_name", "source_type",
                    "sort_order", "relation_type", "note",
                ],
            )
        write_csv(
            output_dir / "db_current_view.csv",
            db_current_view,
            [
                "treatment_source_link_id", "treat_id", "behandlung", "slug", "typ",
                "source_id", "source_title", "source_display_name", "source_type",
                "sort_order", "relation_type", "note", "created_at", "updated_at",
            ],
        )

        compare_base = db_current_view if args.apply else build_effective_preview(existing_links, valid_new_rows, treat_map, source_map)
        if master_rows:
            compare_rows = build_master_compare(master_rows, compare_base)
            write_csv(
                output_dir / "db_vs_master_compare.csv",
                compare_rows,
                [
                    "treat_id", "behandlung", "matched_source_id_master", "matched_source_title_master",
                    "db_or_preview_source_ids", "db_or_preview_source_titles", "compare_status",
                ],
            )
            compare_match = sum(1 for row in compare_rows if row["compare_status"] == "match")
            compare_check = len(compare_rows) - compare_match
        else:
            compare_match = 0
            compare_check = 0

        print("--- Summary ---")
        print(f"Total CSV rows    : {len(import_rows)}")
        print(f"Valid new rows    : {len(valid_new_rows)}")
        print(f"Skipped existing  : {len(skipped_rows)}")
        print(f"Invalid rows      : {len(all_error_rows)}")
        print(f"DB current links  : {len(db_current_view)}")
        if master_rows:
            print(f"Master compare ok : {compare_match}")
            print(f"Master compare chk: {compare_check}")
        print(f"Reports written to: {output_dir}")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Aborted by user.")
        raise SystemExit(130)
