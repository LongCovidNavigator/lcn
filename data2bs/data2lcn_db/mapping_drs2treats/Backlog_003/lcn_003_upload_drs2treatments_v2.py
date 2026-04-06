#!/usr/bin/env python3
import argparse
import csv
import os
import re
import sys
import unicodedata
from typing import Dict, List, Optional, Tuple

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


def norm_text(value: str) -> str:
    s = (value or "").strip()
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s+", " ", s)
    return s.casefold().strip()


def slugify(value: str) -> str:
    s = (value or "").strip()
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.replace("ß", "ss")
    s = s.casefold()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def add_unique(mapping: Dict[str, int], duplicate_keys: set, key: str, tid: int) -> None:
    if not key:
        return
    if key in mapping and mapping[key] != tid:
        duplicate_keys.add(key)
        return
    mapping[key] = tid


class TreatResolver:
    def __init__(self, treat_rows: List[dict]):
        self.by_normalized_exact: Dict[str, int] = {}
        self.by_normalized_fold: Dict[str, int] = {}
        self.by_behandlung_fold: Dict[str, int] = {}
        self.by_slug: Dict[str, int] = {}
        duplicate_exact = set()
        duplicate_fold = set()
        duplicate_beh = set()
        duplicate_slug = set()

        for row in treat_rows:
            tid = clean_int(row.get("treat_id"))
            if tid is None:
                continue
            normalized_raw = (row.get("treatment_name_normalized") or "").strip()
            behandlung_raw = (row.get("behandlung") or "").strip()
            slug_raw = (row.get("slug") or "").strip()

            add_unique(self.by_normalized_exact, duplicate_exact, normalized_raw, tid)
            add_unique(self.by_normalized_fold, duplicate_fold, norm_text(normalized_raw), tid)
            add_unique(self.by_behandlung_fold, duplicate_beh, norm_text(behandlung_raw), tid)
            add_unique(self.by_slug, duplicate_slug, slug_raw, tid)
            add_unique(self.by_slug, duplicate_slug, slugify(normalized_raw), tid)
            add_unique(self.by_slug, duplicate_slug, slugify(behandlung_raw), tid)

        problems = []
        if duplicate_exact:
            problems.append("duplicate exact normalized: " + ", ".join(sorted(duplicate_exact)[:20]))
        if duplicate_fold:
            problems.append("duplicate folded normalized: " + ", ".join(sorted(duplicate_fold)[:20]))
        if duplicate_beh:
            problems.append("duplicate folded behandlung: " + ", ".join(sorted(duplicate_beh)[:20]))
        if duplicate_slug:
            problems.append("duplicate slug: " + ", ".join(sorted(duplicate_slug)[:20]))
        if problems:
            raise UploadError("Uneindeutige Treatment-Schlüssel in with_ids-Datei: " + " | ".join(problems))

    def resolve(self, row: dict) -> Tuple[Optional[int], str]:
        direct_treat_id = clean_int(row.get("treat_id"))
        if direct_treat_id is not None:
            return direct_treat_id, "backlog_treat_id"

        normalized_raw = (row.get("treatment_name_normalized") or "").strip()
        raw_name = (row.get("treatment_name_raw") or "").strip()

        if normalized_raw in self.by_normalized_exact:
            return self.by_normalized_exact[normalized_raw], "normalized_exact"

        key_fold = norm_text(normalized_raw)
        if key_fold and key_fold in self.by_normalized_fold:
            return self.by_normalized_fold[key_fold], "normalized_casefold"

        raw_fold = norm_text(raw_name)
        if raw_fold and raw_fold in self.by_behandlung_fold:
            return self.by_behandlung_fold[raw_fold], "raw_to_behandlung_casefold"

        if key_fold and key_fold in self.by_behandlung_fold:
            return self.by_behandlung_fold[key_fold], "normalized_to_behandlung_casefold"

        slug_candidates = []
        for candidate in [normalized_raw, raw_name]:
            s = slugify(candidate)
            if s and s not in slug_candidates:
                slug_candidates.append(s)

        for slug in slug_candidates:
            if slug in self.by_slug:
                return self.by_slug[slug], f"slug:{slug}"

        return None, "no_match"


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


def prepare_rows(backlog_rows: List[dict], resolver: TreatResolver):
    preview = []
    unresolved = []
    seen_pairs = set()
    duplicate_rows = []

    for idx, row in enumerate(backlog_rows, start=1):
        dr_id = clean_int(row.get("dr_id"))
        final_treat_id, match_method = resolver.resolve(row)
        sort_order = clean_int(row.get("sort_order"), default=0)
        note = build_note(row)

        base = dict(row)
        base["row_no"] = idx
        base["resolved_treat_id"] = "" if final_treat_id is None else final_treat_id
        base["treat_match_method"] = match_method
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
        resolver = TreatResolver(treat_rows)
        preview, unresolved, duplicate_rows = prepare_rows(backlog_rows, resolver)

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
