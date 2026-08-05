
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LCN 003 - Upload new sources into tbl_treatments_sources_03

Zweck:
- lädt ausschließlich 003_new_sources_03.csv
- prüft interne Dubletten via source_key
- prüft bestehende DB-Einträge via source_key
- erzeugt Dry-Run-Preview
- führt nur mit --apply echte Inserts aus
- zieht danach source_id via source_key zurück
- schreibt 003_new_sources_03.with_ids.csv

Erwartete Input-Datei:
- <data-dir>/003_new_sources_03.csv

Output-Dateien:
- <data-dir>/003_new_sources_03.preview.csv
- <data-dir>/003_new_sources_03.conflicts.csv
- <data-dir>/003_new_sources_03.with_ids.csv
- <data-dir>/003_new_sources_03.apply_log.csv   (nur bei --apply)

DB-Zugriff:
- per .env mit:
  LCN_DB_HOST
  LCN_DB_PORT
  LCN_DB_USERNAME
  LCN_DB_PASSWORD
  LCN_DB_DATABASE
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py").is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

try:
    import pymysql
except ImportError:
    print("FEHLER: pymysql ist nicht installiert. Bitte in der venv installieren: pip install pymysql", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("FEHLER: python-dotenv ist nicht installiert. Bitte in der venv installieren: pip install python-dotenv", file=sys.stderr)
    sys.exit(1)


INPUT_FILENAME = "003_new_sources_03.csv"
TARGET_TABLE = "tbl_treatments_sources_03"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="LCN 003 - Upload new sources")
    p.add_argument("--data-dir", required=True, help="Ordner mit 003_new_sources_03.csv")
    p.add_argument("--env-file", required=False, help="Pfad zur .env")
    p.add_argument("--apply", action="store_true", help="Echten Insert ausführen")
    return p.parse_args()


def fail(msg: str, code: int = 1) -> None:
    print(f"FEHLER: {msg}", file=sys.stderr)
    sys.exit(code)


def load_env(env_file: str | None, data_dir: Path) -> None:
    if env_file:
        env_path = Path(env_file)
    else:
        env_path = lcn_env_path()

    if not env_path.exists():
        fail(f".env nicht gefunden: {env_path}")

    load_dotenv(env_path)

    required = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        fail(f".env unvollständig. Fehlende Keys: {', '.join(missing)}")


def connect_db():
    return pymysql.connect(
        host=os.getenv("LCN_DB_HOST"),
        port=int(os.getenv("LCN_DB_PORT")),
        user=os.getenv("LCN_DB_USERNAME"),
        password=os.getenv("LCN_DB_PASSWORD"),
        database=os.getenv("LCN_DB_DATABASE"),
        charset="utf8mb4",
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )


def read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        fail(f"CSV nicht gefunden: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            norm = { (k or "").strip(): (v or "").strip() for k, v in row.items() }
            rows.append(norm)
        if not reader.fieldnames:
            fail(f"CSV hat keine Header: {path}")
        return rows


def write_csv(path: Path, rows: List[Dict[str, object]], fieldnames: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def get_table_columns(conn, table_name: str) -> List[str]:
    with conn.cursor() as cur:
        cur.execute(f"SHOW COLUMNS FROM `{table_name}`")
        cols = cur.fetchall()
    return [c["Field"] for c in cols]


def fetch_existing_sources_by_key(conn) -> Dict[str, Dict[str, object]]:
    sql = f"""
        SELECT source_id, source_key, source_type, title, display_name, source_url
        FROM `{TARGET_TABLE}`
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    out: Dict[str, Dict[str, object]] = {}
    for r in rows:
        key = (r.get("source_key") or "").strip()
        if key:
            out[key] = r
    return out


def find_internal_duplicates(rows: List[Dict[str, str]], key_field: str) -> List[Dict[str, str]]:
    seen = {}
    dups = []
    for idx, row in enumerate(rows, start=1):
        key = (row.get(key_field) or "").strip()
        if not key:
            continue
        if key in seen:
            out = dict(row)
            out["_csv_rownum"] = idx
            out["_duplicate_of_rownum"] = seen[key]
            dups.append(out)
        else:
            seen[key] = idx
    return dups


def require_fields(rows: List[Dict[str, str]], required_fields: List[str]) -> List[Dict[str, object]]:
    problems = []
    for idx, row in enumerate(rows, start=1):
        for field in required_fields:
            if not (row.get(field) or "").strip():
                problems.append({"csv_rownum": idx, "missing_field": field, **row})
    return problems


def build_preview_rows(
    rows: List[Dict[str, str]],
    existing_by_key: Dict[str, Dict[str, object]],
) -> Tuple[List[Dict[str, object]], List[Dict[str, object]], List[Dict[str, str]]]:
    preview = []
    conflicts = []
    insert_rows = []

    for idx, row in enumerate(rows, start=1):
        source_key = (row.get("source_key") or "").strip()
        base = dict(row)
        base["csv_rownum"] = idx

        existing = existing_by_key.get(source_key)
        if existing:
            out = dict(base)
            out["action"] = "skip_existing"
            out["existing_source_id"] = existing.get("source_id")
            out["existing_source_key"] = existing.get("source_key")
            out["existing_title"] = existing.get("title")
            out["existing_display_name"] = existing.get("display_name")
            out["existing_source_url"] = existing.get("source_url")
            preview.append(out)
            conflicts.append(out)
        else:
            out = dict(base)
            out["action"] = "insert"
            out["existing_source_id"] = ""
            out["existing_source_key"] = ""
            out["existing_title"] = ""
            out["existing_display_name"] = ""
            out["existing_source_url"] = ""
            preview.append(out)
            insert_rows.append(row)

    return preview, conflicts, insert_rows


def insert_new_sources(conn, rows: List[Dict[str, str]], table_columns: List[str]) -> List[Dict[str, object]]:
    insertable_cols = [
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
        "review_status",
        "note_internal",
    ]
    insertable_cols = [c for c in insertable_cols if c in table_columns]

    if "source_key" not in insertable_cols:
        fail(f"Zieltabelle {TARGET_TABLE} enthält keine Spalte source_key.")

    sql = f"""
        INSERT INTO `{TARGET_TABLE}` ({", ".join(f"`{c}`" for c in insertable_cols)})
        VALUES ({", ".join(["%s"] * len(insertable_cols))})
    """

    apply_log: List[Dict[str, object]] = []
    with conn.cursor() as cur:
        for idx, row in enumerate(rows, start=1):
            vals = [None if (row.get(c) or "").strip() == "" else (row.get(c) or "").strip() for c in insertable_cols]
            cur.execute(sql, vals)
            apply_log.append({
                "apply_rownum": idx,
                "source_key": row.get("source_key", ""),
                "title": row.get("title", ""),
                "display_name": row.get("display_name", ""),
                "inserted": 1,
                "lastrowid": cur.lastrowid,
            })
    return apply_log


def fetch_with_ids(conn, original_rows: List[Dict[str, str]]) -> List[Dict[str, object]]:
    keys = [(r.get("source_key") or "").strip() for r in original_rows if (r.get("source_key") or "").strip()]
    uniq_keys = sorted(set(keys))
    if not uniq_keys:
        return [dict(r) for r in original_rows]

    placeholders = ", ".join(["%s"] * len(uniq_keys))
    sql = f"""
        SELECT source_id, source_key
        FROM `{TARGET_TABLE}`
        WHERE source_key IN ({placeholders})
    """
    with conn.cursor() as cur:
        cur.execute(sql, uniq_keys)
        found = cur.fetchall()

    by_key = { (r["source_key"] or "").strip(): r["source_id"] for r in found }

    out_rows: List[Dict[str, object]] = []
    for row in original_rows:
        out = dict(row)
        key = (row.get("source_key") or "").strip()
        out["source_id"] = by_key.get(key, "")
        out_rows.append(out)
    return out_rows


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        fail(f"data-dir existiert nicht: {data_dir}")

    input_csv = data_dir / INPUT_FILENAME
    preview_csv = data_dir / "003_new_sources_03.preview.csv"
    conflicts_csv = data_dir / "003_new_sources_03.conflicts.csv"
    with_ids_csv = data_dir / "003_new_sources_03.with_ids.csv"
    apply_log_csv = data_dir / "003_new_sources_03.apply_log.csv"

    print("LCN 003 - Upload new sources")
    print("-" * 72)
    print(f"DATA_DIR : {data_dir}")
    print(f"INPUT    : {input_csv}")
    print(f"TABLE    : {TARGET_TABLE}")
    print(f"MODE     : {'APPLY' if args.apply else 'DRY-RUN'}")

    load_env(args.env_file, data_dir)
    rows = read_csv(input_csv)
    print(f"CSV-Zeilen gesamt: {len(rows)}")

    required_fields = ["source_key", "source_type", "title", "display_name", "source_url", "review_status"]
    missing_required = require_fields(rows, required_fields)
    if missing_required:
        fail(f"Pflichtfelder fehlen in {len(missing_required)} Zeilen. Erste problematische Zeile: {missing_required[0]}")

    internal_dups = find_internal_duplicates(rows, "source_key")
    if internal_dups:
        dup_path = data_dir / "003_new_sources_03.internal_duplicates.csv"
        fields = list(sorted({k for r in internal_dups for k in r.keys()}))
        write_csv(dup_path, internal_dups, fields)
        fail(f"Interne Dubletten nach source_key gefunden: {len(internal_dups)}. Siehe {dup_path}")

    conn = connect_db()
    try:
        table_columns = get_table_columns(conn, TARGET_TABLE)
        existing_by_key = fetch_existing_sources_by_key(conn)

        preview_rows, conflict_rows, insert_rows = build_preview_rows(rows, existing_by_key)

        preview_fields = list(sorted({k for r in preview_rows for k in r.keys()}))
        conflict_fields = list(sorted({k for r in conflict_rows for k in r.keys()})) if conflict_rows else preview_fields

        write_csv(preview_csv, preview_rows, preview_fields)
        write_csv(conflicts_csv, conflict_rows, conflict_fields if conflict_rows else preview_fields)

        print(f"Bestehende Quellen in DB          : {len(existing_by_key)}")
        print(f"Insert-Kandidaten                 : {len(insert_rows)}")
        print(f"Skip existing                     : {len(conflict_rows)}")
        print(f"Preview geschrieben               : {preview_csv}")
        print(f"Konflikte geschrieben             : {conflicts_csv}")

        if args.apply:
            if insert_rows:
                apply_log = insert_new_sources(conn, insert_rows, table_columns)
                conn.commit()
                write_csv(apply_log_csv, apply_log, list(apply_log[0].keys()) if apply_log else ["apply_rownum", "source_key", "title", "display_name", "inserted", "lastrowid"])
                print(f"Echte Inserts durchgeführt        : {len(apply_log)}")
                print(f"Apply-Log geschrieben             : {apply_log_csv}")
            else:
                print("Keine neuen Quellen einzufügen.")

        with_id_rows = fetch_with_ids(conn, rows)
        with_id_fields = list(rows[0].keys())
        if "source_id" not in with_id_fields:
            with_id_fields = ["source_id"] + with_id_fields
        write_csv(with_ids_csv, with_id_rows, with_id_fields)

        resolved = sum(1 for r in with_id_rows if str(r.get("source_id", "")).strip() != "")
        unresolved = len(with_id_rows) - resolved
        print(f"Mit IDs geschrieben               : {with_ids_csv}")
        print(f"Zeilen mit source_id              : {resolved}")
        print(f"Zeilen ohne source_id             : {unresolved}")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
