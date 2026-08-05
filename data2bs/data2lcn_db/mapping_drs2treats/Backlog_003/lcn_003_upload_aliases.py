#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LCN 003 - Upload new aliases into tbl_aliases_03

Purpose
-------
Uploads only 003_new_aliases_03.csv into tbl_aliases_03.
- Dry-run by default
- Apply only with --apply
- Duplicate check on (alias, alias_type)
- No silent overwrites
- Pulls back real alias_id after insert
- Writes preview/conflict/with_ids files

Expected input file in --data-dir
---------------------------------
003_new_aliases_03.csv

Expected DB table
-----------------
tbl_aliases_03

Environment (.env)
------------------
LCN_DB_HOST
LCN_DB_PORT
LCN_DB_USERNAME
LCN_DB_PASSWORD
LCN_DB_DATABASE
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import mysql.connector
from dotenv import dotenv_values


INPUT_NAME = "003_new_aliases_03.csv"
TABLE_NAME = "tbl_aliases_03"


from pathlib import Path

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py" ).is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

def fail(msg: str, code: int = 1) -> None:
    print(f"FEHLER: {msg}")
    raise SystemExit(code)


def load_env(env_file: Path) -> dict:
    if not env_file.exists():
        fail(f".env nicht gefunden: {env_file}")
    env = dotenv_values(str(env_file))
    required = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    missing = [k for k in required if not env.get(k)]
    if missing:
        fail(f".env unvollständig. Fehlende Keys: {', '.join(missing)}")
    return env


def connect_db(env: dict):
    try:
        return mysql.connector.connect(
            host=env["LCN_DB_HOST"],
            port=int(env["LCN_DB_PORT"]),
            user=env["LCN_DB_USERNAME"],
            password=env["LCN_DB_PASSWORD"],
            database=env["LCN_DB_DATABASE"],
        )
    except mysql.connector.Error as e:
        fail(f"DB-Verbindung fehlgeschlagen: {e}")


def read_csv(path: Path) -> List[dict]:
    if not path.exists():
        fail(f"CSV nicht gefunden: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        fail(f"CSV ist leer: {path}")
    return rows


def write_csv(path: Path, rows: List[dict], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow(row)


def norm(s: str) -> str:
    return (s or "").strip()


def key_pair(row: dict) -> Tuple[str, str]:
    return (norm(row.get("alias", "")), norm(row.get("alias_type", "")))


def fetch_columns(conn, table_name: str) -> List[str]:
    cur = conn.cursor()
    cur.execute(f"SHOW COLUMNS FROM {table_name}")
    cols = [r[0] for r in cur.fetchall()]
    cur.close()
    return cols


def fetch_existing_pairs(conn) -> Dict[Tuple[str, str], int]:
    cur = conn.cursor()
    cur.execute(f"SELECT alias_id, alias, alias_type FROM {TABLE_NAME}")
    out: Dict[Tuple[str, str], int] = {}
    for alias_id, alias, alias_type in cur.fetchall():
        out[(norm(alias), norm(alias_type))] = int(alias_id)
    cur.close()
    return out


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="LCN 003 upload aliases")
    p.add_argument("--data-dir", required=True, help="Ordner mit 003_new_aliases_03.csv")
    p.add_argument("--env-file", default=str(lcn_env_path()), help="Pfad zur .env")
    p.add_argument("--apply", action="store_true", help="Echten Insert ausführen")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir)
    env_file = Path(args.env_file)

    input_csv = data_dir / INPUT_NAME
    preview_csv = data_dir / "003_new_aliases_03.preview.csv"
    conflicts_csv = data_dir / "003_new_aliases_03.conflicts.csv"
    with_ids_csv = data_dir / "003_new_aliases_03.with_ids.csv"
    apply_log_csv = data_dir / "003_new_aliases_03.apply_log.csv"

    env = load_env(env_file)
    conn = connect_db(env)

    try:
        cols = fetch_columns(conn, TABLE_NAME)
        required_cols = ["alias_id", "alias", "alias_type", "source_examples", "notes_internal"]
        missing_cols = [c for c in required_cols if c not in cols]
        if missing_cols:
            fail(f"Zieltabelle {TABLE_NAME} hat nicht die erwarteten Spalten: {', '.join(missing_cols)}")

        rows = read_csv(input_csv)

        required_input = ["alias", "alias_type"]
        header_missing = [c for c in required_input if c not in rows[0]]
        if header_missing:
            fail(f"Input-CSV fehlt Pflichtspalten: {', '.join(header_missing)}")

        internal_seen: Dict[Tuple[str, str], int] = {}
        internal_dupes: List[dict] = []
        cleaned_rows: List[dict] = []

        for idx, row in enumerate(rows, start=2):
            alias = norm(row.get("alias", ""))
            alias_type = norm(row.get("alias_type", ""))
            if not alias:
                fail(f"Leerer alias in Zeile {idx}")
            if not alias_type:
                fail(f"Leerer alias_type in Zeile {idx}")

            row_out = dict(row)
            row_out["alias"] = alias
            row_out["alias_type"] = alias_type
            kp = (alias, alias_type)

            if kp in internal_seen:
                row_out["issue"] = "duplicate_in_input"
                row_out["first_seen_line"] = internal_seen[kp]
                internal_dupes.append(row_out)
            else:
                internal_seen[kp] = idx
                cleaned_rows.append(row_out)

        if internal_dupes:
            fields = list(dict.fromkeys(list(rows[0].keys()) + ["issue", "first_seen_line"]))
            write_csv(conflicts_csv, internal_dupes, fields)
            fail(
                f"Interne Dubletten in Input gefunden: {len(internal_dupes)}. "
                f"Siehe {conflicts_csv}"
            )

        existing = fetch_existing_pairs(conn)

        preview_rows: List[dict] = []
        conflict_rows: List[dict] = []
        insert_rows: List[dict] = []

        for row in cleaned_rows:
            kp = key_pair(row)
            base = dict(row)
            if kp in existing:
                base["action"] = "skip_existing"
                base["existing_alias_id"] = existing[kp]
                conflict_rows.append(base)
            else:
                base["action"] = "insert"
                base["existing_alias_id"] = ""
                insert_rows.append(base)
            preview_rows.append(base)

        preview_fields = list(dict.fromkeys(list(rows[0].keys()) + ["action", "existing_alias_id"]))
        write_csv(preview_csv, preview_rows, preview_fields)
        write_csv(conflicts_csv, conflict_rows, preview_fields)

        inserted = 0
        apply_log_rows: List[dict] = []

        if args.apply and insert_rows:
            cur = conn.cursor()
            sql = f"""
                INSERT INTO {TABLE_NAME}
                    (alias, alias_type, source_examples, notes_internal)
                VALUES (%s, %s, %s, %s)
            """
            for row in insert_rows:
                vals = (
                    norm(row.get("alias", "")),
                    norm(row.get("alias_type", "")),
                    norm(row.get("source_examples", "")) or None,
                    norm(row.get("notes_internal", "")) or None,
                )
                cur.execute(sql, vals)
                inserted += 1
                log_row = dict(row)
                log_row["inserted"] = 1
                apply_log_rows.append(log_row)
            conn.commit()
            cur.close()
        elif args.apply and not insert_rows:
            apply_log_rows = []

        refreshed = fetch_existing_pairs(conn)

        with_id_rows: List[dict] = []
        for row in cleaned_rows:
            kp = key_pair(row)
            alias_id = refreshed.get(kp)
            out = dict(row)
            out["alias_id"] = "" if alias_id is None else alias_id
            with_id_rows.append(out)

        with_id_fields = list(dict.fromkeys(["alias_id"] + list(rows[0].keys())))
        write_csv(with_ids_csv, with_id_rows, with_id_fields)

        if args.apply:
            apply_fields = list(dict.fromkeys(list(rows[0].keys()) + ["action", "existing_alias_id", "inserted"]))
            write_csv(apply_log_csv, apply_log_rows, apply_fields)

        print("LCN 003 – Upload Aliases")
        print("-" * 72)
        print(f"Input-Zeilen gesamt                : {len(rows)}")
        print(f"Eindeutige (alias, alias_type)    : {len(cleaned_rows)}")
        print(f"Bereits in DB vorhanden           : {len(conflict_rows)}")
        print(f"Neue Inserts möglich              : {len(insert_rows)}")
        if args.apply:
            print(f"Tatsächlich eingefügt             : {inserted}")
        else:
            print("Tatsächlich eingefügt             : Dry-Run (0)")
        print(f"Preview                           : {preview_csv}")
        print(f"Conflicts                         : {conflicts_csv}")
        print(f"With IDs                          : {with_ids_csv}")
        if args.apply:
            print(f"Apply-Log                         : {apply_log_csv}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
