#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
003_match_drs2treat_url_aus_tbl_drs_03.py

Purpose:
- Read the operative batch CSV for source 003
- Load treatments + aliases from LCN DB
- Match rows conservatively in this order:
    1) exact main-name match
    2) exact existing alias match
    3) exact match via manually curated new aliases for this batch
- Enrich CSV with:
    - treat_id
    - treat_match_status
    - match_notes
    - review_matching
    - review_matching_notes
    - alias_name
    - alias_type
- Write a new output CSV

Important for THIS 003 workflow:
- decision is intentionally ignored
- all rows are considered matchable
- existing treat_id values are preserved by default
- no treatments are created
- no DB import is performed
- open cases remain visible

Requirements:
- python-dotenv
- pymysql
"""

from __future__ import annotations

import csv
import os
import re
import sys
from pathlib import Path

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py" ).is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Optional

from dotenv import load_dotenv
import pymysql

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

INPUT_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\003_mapping_drs2treat_url_aus_tbl_drs_03.csv"
OUTPUT_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\003_mapping_drs2treat_url_aus_tbl_drs_03__4_3_matched.csv"
ENV_PATH = lcn_env_path()

TBL_TREATMENTS = "tbl_treatments_03"
VW_TREATMENT_ALIASES = "vw_treatments2aliases_03"

CSV_ENCODING = "utf-8-sig"
CSV_DELIMITER = ","

# For this chat/workflow variant: ignore decision completely.
IGNORE_DECISION_FIELD = True

# If a row already has a treat_id, preserve it by default.
PRESERVE_EXISTING_TREAT_ID = True
OVERWRITABLE_EMPTYISH_STATUSES = {"", "pending"}

STATUS_MATCHED_EXACT = "matched_exact"
STATUS_MATCHED_ALIAS = "matched_alias"
STATUS_MATCHED_NEW_ALIAS = "matched_new_alias"
STATUS_REVIEW = "review"
STATUS_MISSING = "missing"

# Manually curated new aliases for THIS batch.
# Only include mappings that were explicitly reviewed as technically acceptable.
# normalized alias -> metadata
MANUAL_NEW_ALIASES: Dict[str, Dict[str, object]] = {
    "low dose naltrexon": {
        "treat_id": 1,
        "canonical_name": "LDN",
        "alias_name": "Low Dose Naltrexon",
        "alias_type": "long_name",
    },
    "oxalacetat": {
        "treat_id": 60,
        "canonical_name": "Oxaloacetat",
        "alias_name": "Oxalacetat",
        "alias_type": "spelling_variant",
    },
    "low dose nicotine patches": {
        "treat_id": 21,
        "canonical_name": "Nicotin-Pflaster",
        "alias_name": "Low Dose Nicotine Patches",
        "alias_type": "english_variant",
    },
    "nikotin / nikotinpflaster": {
        "treat_id": 21,
        "canonical_name": "Nicotin-Pflaster",
        "alias_name": "Nikotin / Nikotinpflaster",
        "alias_type": "spelling_variant",
    },
    "energiemanagement und aktivitätsdosierung": {
        "treat_id": 2,
        "canonical_name": "Pacing",
        "alias_name": "Energiemanagement und Aktivitätsdosierung",
        "alias_type": "extended_phrase",
    },
}

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
    alias_type: str = ""


# ---------------------------------------------------------------------------
# NORMALIZATION
# ---------------------------------------------------------------------------

def normalize_for_match(value: Optional[str]) -> str:
    if value is None:
        return ""

    s = str(value).strip()
    if not s:
        return ""

    s = unicodedata.normalize("NFKC", s)
    s = s.replace("–", "-").replace("—", "-").replace("−", "-")
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def clean_cell(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip()


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
        SELECT treat_id, behandlung
        FROM {TBL_TREATMENTS}
        WHERE treat_id IS NOT NULL
          AND behandlung IS NOT NULL
          AND TRIM(behandlung) <> ''
        ORDER BY treat_id
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    return [
        TreatmentRecord(
            treat_id=int(row["treat_id"]),
            behandlung=str(row["behandlung"]).strip(),
        )
        for row in rows
    ]


def load_aliases(conn) -> List[AliasRecord]:
    # alias_type is optional depending on view structure
    sql = f"""
        SELECT treat_id, alias, behandlung
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
                alias_type=clean_cell(row.get("alias_type")),
            )
        )
    return result


# ---------------------------------------------------------------------------
# INDEX BUILDING
# ---------------------------------------------------------------------------

def build_main_name_index(
    treatments: List[TreatmentRecord],
) -> Tuple[Dict[str, Set[int]], Dict[int, str]]:
    main_index: Dict[str, Set[int]] = {}
    treat_name_by_id: Dict[int, str] = {}

    for t in treatments:
        treat_name_by_id[t.treat_id] = t.behandlung
        key = normalize_for_match(t.behandlung)
        if key:
            main_index.setdefault(key, set()).add(t.treat_id)

    return main_index, treat_name_by_id


def build_alias_index(
    aliases: List[AliasRecord],
) -> Tuple[Dict[str, Set[int]], Dict[Tuple[str, int], AliasRecord]]:
    alias_index: Dict[str, Set[int]] = {}
    alias_meta: Dict[Tuple[str, int], AliasRecord] = {}

    for a in aliases:
        key = normalize_for_match(a.alias)
        if not key:
            continue
        alias_index.setdefault(key, set()).add(a.treat_id)
        alias_meta[(key, a.treat_id)] = a

    return alias_index, alias_meta


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

def read_csv_rows(path: str) -> Tuple[List[str], List[Dict[str, str]]]:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Input CSV not found: {path}")

    with open(path, "r", encoding=CSV_ENCODING, newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_DELIMITER)
        headers = list(reader.fieldnames or [])
        rows = [{k: (v if v is not None else "") for k, v in row.items()} for row in reader]

    if not headers:
        raise RuntimeError("CSV appears to have no header row.")

    return headers, rows


def ensure_output_headers(headers: List[str]) -> List[str]:
    needed = [
        "treat_id",
        "treat_match_status",
        "match_notes",
        "review_matching",
        "review_matching_notes",
        "alias_name",
        "alias_type",
    ]
    out = headers[:]
    for col in needed:
        if col not in out:
            out.append(col)
    return out


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
            writer.writerow({h: row.get(h, "") for h in headers})


# ---------------------------------------------------------------------------
# MATCH HELPERS
# ---------------------------------------------------------------------------

def choose_input_name(row: Dict[str, str]) -> Tuple[str, str]:
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


def apply_preserved_existing(row: Dict[str, str], counters: Dict[str, int]) -> Dict[str, str]:
    new_row = dict(row)
    existing_treat_id = safe_int_str(new_row.get("treat_id"))
    current_status = clean_cell(new_row.get("treat_match_status"))

    new_row["treat_id"] = existing_treat_id
    if can_update_status(current_status, existing_treat_id):
        new_row["treat_match_status"] = STATUS_REVIEW
    else:
        new_row["treat_match_status"] = current_status

    new_row["match_notes"] = f"preserved existing treat_id={existing_treat_id}; row not rematched automatically"
    new_row["review_matching"] = "1"
    new_row["review_matching_notes"] = "existing treat_id preserved automatically"

    counters["preserved_existing_treat_id"] += 1
    return new_row


def apply_missing(row: Dict[str, str], counters: Dict[str, int], reason: str) -> Dict[str, str]:
    new_row = dict(row)
    new_row["treat_id"] = ""
    new_row["treat_match_status"] = STATUS_MISSING
    new_row["match_notes"] = reason
    new_row["review_matching"] = "1"
    new_row["review_matching_notes"] = reason
    new_row["alias_name"] = clean_cell(new_row.get("alias_name"))
    new_row["alias_type"] = clean_cell(new_row.get("alias_type"))
    counters["missing"] += 1
    return new_row


def apply_review(row: Dict[str, str], counters: Dict[str, int], candidate_ids: Set[int], reason: str) -> Dict[str, str]:
    new_row = dict(row)
    text = f"{reason}: {', '.join(str(x) for x in sorted(candidate_ids))}"
    new_row["treat_id"] = ""
    new_row["treat_match_status"] = STATUS_REVIEW
    new_row["match_notes"] = text
    new_row["review_matching"] = "1"
    new_row["review_matching_notes"] = text
    counters["review"] += 1
    return new_row


def apply_match(
    row: Dict[str, str],
    counters: Dict[str, int],
    treat_id: int,
    status: str,
    reason: str,
    alias_name: str = "",
    alias_type: str = "",
) -> Dict[str, str]:
    new_row = dict(row)
    new_row["treat_id"] = str(treat_id)
    new_row["treat_match_status"] = status
    new_row["match_notes"] = reason
    new_row["review_matching"] = "0"
    new_row["review_matching_notes"] = ""
    new_row["alias_name"] = alias_name
    new_row["alias_type"] = alias_type
    counters[status] += 1
    return new_row


# ---------------------------------------------------------------------------
# MATCHING
# ---------------------------------------------------------------------------

def match_row(
    row: Dict[str, str],
    main_index: Dict[str, Set[int]],
    alias_index: Dict[str, Set[int]],
    alias_meta: Dict[Tuple[str, int], AliasRecord],
    treat_name_by_id: Dict[int, str],
    counters: Dict[str, int],
) -> Dict[str, str]:
    existing_treat_id = safe_int_str(row.get("treat_id"))
    if existing_treat_id and PRESERVE_EXISTING_TREAT_ID:
        return apply_preserved_existing(row, counters)

    selected_value, source_field = choose_input_name(row)
    if not selected_value:
        return apply_missing(row, counters, "no usable matching input in treatment_name_normalized or treatment_name_raw")

    key = normalize_for_match(selected_value)
    if not key:
        return apply_missing(row, counters, f"normalized matching key is empty after cleanup ({source_field})")

    # 1) exact main-name match
    main_candidates = main_index.get(key, set())
    if len(main_candidates) == 1:
        treat_id = next(iter(main_candidates))
        main_name = treat_name_by_id.get(treat_id, "")
        return apply_match(
            row,
            counters,
            treat_id=treat_id,
            status=STATUS_MATCHED_EXACT,
            reason=f'exact main-name match via {source_field}: "{selected_value}" -> treat_id={treat_id} ({main_name})',
        )
    if len(main_candidates) > 1:
        return apply_review(row, counters, main_candidates, f'multiple main-name candidates via {source_field} for "{selected_value}"')

    # 2) exact existing alias match
    alias_candidates = alias_index.get(key, set())
    if len(alias_candidates) == 1:
        treat_id = next(iter(alias_candidates))
        main_name = treat_name_by_id.get(treat_id, "")
        meta = alias_meta.get((key, treat_id))
        return apply_match(
            row,
            counters,
            treat_id=treat_id,
            status=STATUS_MATCHED_ALIAS,
            reason=f'exact alias match via {source_field}: "{selected_value}" -> treat_id={treat_id} ({main_name})',
            alias_name=(meta.alias if meta else selected_value),
            alias_type=(meta.alias_type if meta else "existing_alias"),
        )
    if len(alias_candidates) > 1:
        return apply_review(row, counters, alias_candidates, f'multiple alias candidates via {source_field} for "{selected_value}"')

    # 3) manually curated new aliases for this batch
    manual = MANUAL_NEW_ALIASES.get(key)
    if manual:
        treat_id = int(manual["treat_id"])
        canonical_name = str(manual["canonical_name"])
        return apply_match(
            row,
            counters,
            treat_id=treat_id,
            status=STATUS_MATCHED_NEW_ALIAS,
            reason=f'manual new-alias match via {source_field}: "{selected_value}" -> treat_id={treat_id} ({canonical_name})',
            alias_name=str(manual["alias_name"]),
            alias_type=str(manual["alias_type"]),
        )

    return apply_missing(
        row,
        counters,
        f'no exact match found via main-name, existing alias, or manual new alias for "{selected_value}" ({source_field})',
    )


# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------

def init_counters() -> Dict[str, int]:
    return {
        "total_rows": 0,
        STATUS_MATCHED_EXACT: 0,
        STATUS_MATCHED_ALIAS: 0,
        STATUS_MATCHED_NEW_ALIAS: 0,
        "review": 0,
        "missing": 0,
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
    print("\n=== DRS -> TREAT BATCH MATCH SUMMARY (003) ===")
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
    print(f"matched_exact           : {counters[STATUS_MATCHED_EXACT]}")
    print(f"matched_alias           : {counters[STATUS_MATCHED_ALIAS]}")
    print(f"matched_new_alias       : {counters[STATUS_MATCHED_NEW_ALIAS]}")
    print(f"review                  : {counters['review']}")
    print(f"missing                 : {counters['missing']}")
    print(f"preserved existing id   : {counters['preserved_existing_treat_id']}")
    print("-" * 60)
    print("Status semantics:")
    print("  matched_exact      = exact match against tbl_treatments_03.behandlung")
    print("  matched_alias      = exact match against vw_treatments2aliases_03.alias")
    print("  matched_new_alias  = exact match against manually curated new aliases for batch 003")
    print("  review             = multiple plausible candidates OR preserved manual treat_id")
    print("  missing            = no exact match on any allowed layer")
    print("=== END ===\n")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main() -> int:
    try:
        print("=== DRS -> TREAT BATCH MATCH (003) ===")
        print(f"ENV      : {ENV_PATH}")
        print(f"INPUT    : {INPUT_CSV}")
        print(f"OUTPUT   : {OUTPUT_CSV}")
        print(f"IGNORE_DECISION_FIELD: {IGNORE_DECISION_FIELD}")

        load_env(ENV_PATH)
        headers_before, rows = read_csv_rows(INPUT_CSV)
        headers_after = ensure_output_headers(headers_before)

        with get_db_connection() as conn:
            treatments = load_treatments(conn)
            aliases = load_aliases(conn)

        main_index, treat_name_by_id = build_main_name_index(treatments)
        alias_index, alias_meta = build_alias_index(aliases)

        counters = init_counters()
        matched_rows: List[Dict[str, str]] = []

        for row in rows:
            counters["total_rows"] += 1
            working_row = dict(row)
            for key in [
                "match_notes",
                "treat_match_status",
                "treat_id",
                "review_matching",
                "review_matching_notes",
                "alias_name",
                "alias_type",
            ]:
                working_row.setdefault(key, "")

            result_row = match_row(
                row=working_row,
                main_index=main_index,
                alias_index=alias_index,
                alias_meta=alias_meta,
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
