#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Match batch CSV rows (doctor -> treatment mapping batch) against LCN DB treatments.

Purpose:
- Read prepared Strasser batch CSV
- Load treatments + aliases from DB
- Match rows conservatively
- Enrich CSV with:
    - treat_id
    - treat_match_status
    - match_notes
- Write a new output CSV
- Do NOT import into coupling table
- Do NOT create new treatments
- Do NOT change source_id/dr_id
- Do NOT match rows with decision = 0
- Preserve existing treat_id values

Requirements:
- python-dotenv
- pymysql

Example:
    python match_drs2treat_batch.py
"""

from __future__ import annotations

import csv
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Optional

from dotenv import load_dotenv
import pymysql


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

INPUT_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\002_mapping_drs2treat_strasser.csv"
OUTPUT_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\002_mapping_drs2treat_strasser_matched.csv"
ENV_PATH = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\.env"

TBL_TREATMENTS = "tbl_treatments_03"
VW_TREATMENT_ALIASES = "vw_treatments2aliases_03"

CSV_ENCODING = "utf-8-sig"
CSV_DELIMITER = ","

TARGET_STATUS_VALUES = {
    "matched_exact",
    "matched_alias",
    "review",
    "missing",
}

SKIP_DECISION_VALUES = {"0"}  # rows with decision=0 are not matched

# Existing statuses treated as "editable placeholders"
OVERWRITABLE_EMPTYISH_STATUSES = {"", "pending"}

# If a row already has a treat_id, it is preserved no matter what.
PRESERVE_EXISTING_TREAT_ID = True


# ---------------------------------------------------------------------------
# DATA STRUCTURES
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TreatmentRecord:
    treat_id: int
    behandlung: str


@dataclass(frozen=True)
class AliasRecord:
    treat_id: int
    alias: str
    behandlung: str


# ---------------------------------------------------------------------------
# NORMALIZATION
# ---------------------------------------------------------------------------

def normalize_for_match(value: Optional[str]) -> str:
    """
    Conservative normalization for exact matching only.
    Internal comparison only; original CSV values remain unchanged.

    Rules:
    - None -> ""
    - strip
    - Unicode normalize
    - lowercase
    - unify common dash variants to "-"
    - collapse whitespace
    """
    if value is None:
        return ""

    s = str(value).strip()
    if not s:
        return ""

    s = unicodedata.normalize("NFKC", s)
    s = s.replace("–", "-").replace("—", "-").replace("-", "-").replace("−", "-")
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def clean_cell(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_blank(value: Optional[str]) -> bool:
    return clean_cell(value) == ""


def safe_int_str(value: Optional[str]) -> str:
    v = clean_cell(value)
    if not v:
        return ""
    try:
        return str(int(float(v)))
    except Exception:
        return v


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------

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


def load_treatments(conn) -> List[TreatmentRecord]:
    sql = f"""
        SELECT
            treat_id,
            behandlung
        FROM {TBL_TREATMENTS}
        WHERE treat_id IS NOT NULL
          AND behandlung IS NOT NULL
          AND TRIM(behandlung) <> ''
        ORDER BY treat_id
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    result: List[TreatmentRecord] = []
    for row in rows:
        result.append(
            TreatmentRecord(
                treat_id=int(row["treat_id"]),
                behandlung=str(row["behandlung"]).strip(),
            )
        )
    return result


def load_aliases(conn) -> List[AliasRecord]:
    sql = f"""
        SELECT
            treat_id,
            alias,
            behandlung
        FROM {VW_TREATMENT_ALIASES}
        WHERE treat_id IS NOT NULL
          AND alias IS NOT NULL
          AND TRIM(alias) <> ''
        ORDER BY treat_id
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    result: List[AliasRecord] = []
    for row in rows:
        result.append(
            AliasRecord(
                treat_id=int(row["treat_id"]),
                alias=str(row["alias"]).strip(),
                behandlung=clean_cell(row.get("behandlung")),
            )
        )
    return result


# ---------------------------------------------------------------------------
# INDEX BUILDING
# ---------------------------------------------------------------------------

def build_main_name_index(
    treatments: List[TreatmentRecord],
) -> Tuple[Dict[str, Set[int]], Dict[int, str]]:
    """
    normalized main-name -> set(treat_id)
    treat_id -> main name
    """
    main_index: Dict[str, Set[int]] = {}
    treat_name_by_id: Dict[int, str] = {}

    for t in treatments:
        treat_name_by_id[t.treat_id] = t.behandlung
        key = normalize_for_match(t.behandlung)
        if not key:
            continue
        main_index.setdefault(key, set()).add(t.treat_id)

    return main_index, treat_name_by_id


def build_alias_index(
    aliases: List[AliasRecord],
) -> Dict[str, Set[int]]:
    """
    normalized alias -> set(treat_id)
    """
    alias_index: Dict[str, Set[int]] = {}

    for a in aliases:
        key = normalize_for_match(a.alias)
        if not key:
            continue
        alias_index.setdefault(key, set()).add(a.treat_id)

    return alias_index


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

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


def ensure_match_notes_column(headers: List[str]) -> List[str]:
    if "match_notes" in headers:
        return headers[:]

    if "treat_match_status" in headers:
        new_headers = []
        for h in headers:
            new_headers.append(h)
            if h == "treat_match_status":
                new_headers.append("match_notes")
        return new_headers

    return headers + ["match_notes"]


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


# ---------------------------------------------------------------------------
# MATCHING
# ---------------------------------------------------------------------------

def choose_input_name(row: Dict[str, str]) -> Tuple[str, str]:
    """
    Returns:
        (selected_original_value, source_field_name)
    Priority:
        1) treatment_name_normalized
        2) treatment_name_raw
    """
    normalized_val = clean_cell(row.get("treatment_name_normalized"))
    raw_val = clean_cell(row.get("treatment_name_raw"))

    if normalized_val:
        return normalized_val, "treatment_name_normalized"
    if raw_val:
        return raw_val, "treatment_name_raw"
    return "", ""


def can_update_status(current_status: str, existing_treat_id: str) -> bool:
    current_status = clean_cell(current_status)
    existing_treat_id = clean_cell(existing_treat_id)

    if existing_treat_id and PRESERVE_EXISTING_TREAT_ID:
        return current_status in OVERWRITABLE_EMPTYISH_STATUSES

    return True


def preserve_existing_mapping(
    row: Dict[str, str],
    counters: Dict[str, int],
) -> Dict[str, str]:
    """
    Existing treat_id wins.
    Do not overwrite it.
    """
    new_row = dict(row)
    existing_treat_id = safe_int_str(new_row.get("treat_id"))
    current_status = clean_cell(new_row.get("treat_match_status"))

    new_row["treat_id"] = existing_treat_id

    if can_update_status(current_status, existing_treat_id):
        new_row["treat_match_status"] = "review"
    else:
        new_row["treat_match_status"] = current_status

    new_row["match_notes"] = (
        f'preserved existing treat_id={existing_treat_id}; row not rematched automatically'
    )

    counters["preserved_existing_treat_id"] += 1
    return new_row


def skip_decision_zero(
    row: Dict[str, str],
    counters: Dict[str, int],
) -> Dict[str, str]:
    """
    Rows with decision=0 are intentionally not matched.
    Existing manual treat_id is still preserved by earlier logic.
    """
    new_row = dict(row)
    new_row["match_notes"] = 'skipped because decision=0'

    current_status = clean_cell(new_row.get("treat_match_status"))
    if current_status in OVERWRITABLE_EMPTYISH_STATUSES:
        new_row["treat_match_status"] = ""

    counters["skipped_decision_0"] += 1
    return new_row


def apply_missing(
    row: Dict[str, str],
    counters: Dict[str, int],
    reason: str,
) -> Dict[str, str]:
    new_row = dict(row)
    new_row["treat_id"] = ""
    new_row["treat_match_status"] = "missing"
    new_row["match_notes"] = reason
    counters["missing"] += 1
    return new_row


def apply_review(
    row: Dict[str, str],
    counters: Dict[str, int],
    candidate_ids: Set[int],
    reason: str,
) -> Dict[str, str]:
    new_row = dict(row)
    new_row["treat_id"] = ""
    new_row["treat_match_status"] = "review"
    new_row["match_notes"] = f"{reason}: {', '.join(str(x) for x in sorted(candidate_ids))}"
    counters["review"] += 1
    return new_row


def apply_match(
    row: Dict[str, str],
    counters: Dict[str, int],
    treat_id: int,
    status: str,
    reason: str,
) -> Dict[str, str]:
    new_row = dict(row)
    new_row["treat_id"] = str(treat_id)
    new_row["treat_match_status"] = status
    new_row["match_notes"] = reason
    counters[status] += 1
    return new_row


def match_row(
    row: Dict[str, str],
    main_index: Dict[str, Set[int]],
    alias_index: Dict[str, Set[int]],
    treat_name_by_id: Dict[int, str],
    counters: Dict[str, int],
) -> Dict[str, str]:
    """
    Matching priority:
    1) preserve existing treat_id
    2) skip decision=0
    3) choose matching input name
    4) exact main-name match
    5) exact alias match
    6) review if multiple candidate treat_ids
    7) missing otherwise
    """
    existing_treat_id = safe_int_str(row.get("treat_id"))
    if existing_treat_id and PRESERVE_EXISTING_TREAT_ID:
        return preserve_existing_mapping(row, counters)

    decision_val = clean_cell(row.get("decision"))
    if decision_val in SKIP_DECISION_VALUES:
        return skip_decision_zero(row, counters)

    selected_value, source_field = choose_input_name(row)
    if not selected_value:
        return apply_missing(
            row,
            counters,
            "no usable matching input in treatment_name_normalized or treatment_name_raw",
        )

    key = normalize_for_match(selected_value)
    if not key:
        return apply_missing(
            row,
            counters,
            f'normalized matching key is empty after cleanup ({source_field})',
        )

    # 1) Main-name match
    main_candidates = main_index.get(key, set())
    if len(main_candidates) == 1:
        treat_id = next(iter(main_candidates))
        main_name = treat_name_by_id.get(treat_id, "")
        return apply_match(
            row,
            counters,
            treat_id=treat_id,
            status="matched_exact",
            reason=f'exact main-name match via {source_field}: "{selected_value}" -> treat_id={treat_id} ({main_name})',
        )
    if len(main_candidates) > 1:
        return apply_review(
            row,
            counters,
            candidate_ids=main_candidates,
            reason=f'multiple main-name candidates via {source_field} for "{selected_value}"',
        )

    # 2) Alias match
    alias_candidates = alias_index.get(key, set())
    if len(alias_candidates) == 1:
        treat_id = next(iter(alias_candidates))
        main_name = treat_name_by_id.get(treat_id, "")
        return apply_match(
            row,
            counters,
            treat_id=treat_id,
            status="matched_alias",
            reason=f'exact alias match via {source_field}: "{selected_value}" -> treat_id={treat_id} ({main_name})',
        )
    if len(alias_candidates) > 1:
        return apply_review(
            row,
            counters,
            candidate_ids=alias_candidates,
            reason=f'multiple alias candidates via {source_field} for "{selected_value}"',
        )

    return apply_missing(
        row,
        counters,
        f'no exact match found via main-name or alias for "{selected_value}" ({source_field})',
    )


# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------

def init_counters() -> Dict[str, int]:
    return {
        "total_rows": 0,
        "matched_exact": 0,
        "matched_alias": 0,
        "review": 0,
        "missing": 0,
        "skipped_decision_0": 0,
        "preserved_existing_treat_id": 0,
    }


def print_summary(
    input_csv: str,
    output_csv: str,
    headers_before: List[str],
    headers_after: List[str],
    rows_before: int,
    rows_after: int,
    treatment_count: int,
    alias_count: int,
    counters: Dict[str, int],
) -> None:
    print("\n=== DRS -> TREAT BATCH MATCH SUMMARY ===")
    print(f"Input CSV               : {input_csv}")
    print(f"Output CSV              : {output_csv}")
    print(f"Headers before          : {len(headers_before)}")
    print(f"Headers after           : {len(headers_after)}")
    print(f"Rows read               : {rows_before}")
    print(f"Rows written            : {rows_after}")
    print(f"Treatments loaded       : {treatment_count}")
    print(f"Aliases loaded          : {alias_count}")
    print("-" * 60)
    print(f"Total processed rows    : {counters['total_rows']}")
    print(f"matched_exact           : {counters['matched_exact']}")
    print(f"matched_alias           : {counters['matched_alias']}")
    print(f"review                  : {counters['review']}")
    print(f"missing                 : {counters['missing']}")
    print(f"skipped_decision_0      : {counters['skipped_decision_0']}")
    print(f"preserved existing id   : {counters['preserved_existing_treat_id']}")
    print("-" * 60)
    print("Status semantics:")
    print("  matched_exact  = exact match against tbl_treatments_03.behandlung")
    print("  matched_alias  = exact match against vw_treatments2aliases_03.alias")
    print("  review         = multiple plausible treat_id candidates OR preserved manual treat_id")
    print("  missing        = no exact main-name / alias match")
    print("=== END ===\n")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main() -> int:
    try:
        print("=== DRS -> TREAT BATCH MATCH ===")
        print(f"ENV      : {ENV_PATH}")
        print(f"INPUT    : {INPUT_CSV}")
        print(f"OUTPUT   : {OUTPUT_CSV}")

        load_env(ENV_PATH)

        headers_before, rows = read_csv_rows(INPUT_CSV)
        headers_after = ensure_match_notes_column(headers_before)

        with get_db_connection() as conn:
            treatments = load_treatments(conn)
            aliases = load_aliases(conn)

        main_index, treat_name_by_id = build_main_name_index(treatments)
        alias_index = build_alias_index(aliases)

        counters = init_counters()
        matched_rows: List[Dict[str, str]] = []

        for row in rows:
            counters["total_rows"] += 1

            working_row = dict(row)

            # Ensure output keys exist
            if "match_notes" not in working_row:
                working_row["match_notes"] = ""
            if "treat_match_status" not in working_row:
                working_row["treat_match_status"] = ""
            if "treat_id" not in working_row:
                working_row["treat_id"] = ""

            result_row = match_row(
                row=working_row,
                main_index=main_index,
                alias_index=alias_index,
                treat_name_by_id=treat_name_by_id,
                counters=counters,
            )
            matched_rows.append(result_row)

        write_csv_rows(OUTPUT_CSV, headers_after, matched_rows)

        print_summary(
            input_csv=INPUT_CSV,
            output_csv=OUTPUT_CSV,
            headers_before=headers_before,
            headers_after=headers_after,
            rows_before=len(rows),
            rows_after=len(matched_rows),
            treatment_count=len(treatments),
            alias_count=len(aliases),
            counters=counters,
        )

        return 0

    except KeyboardInterrupt:
        print("\nAborted by user.")
        return 130

    except Exception as exc:
        print("\nERROR:")
        print(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())