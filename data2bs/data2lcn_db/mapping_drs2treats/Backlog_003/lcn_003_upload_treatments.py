
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LCN 003 - Treatments Upload (focused step)
-----------------------------------------
Zweck:
- nur den Schritt "neue Treatments hochladen" abarbeiten
- Dry-Run als Standard
- vorhandene Datensätze nicht überschreiben
- ID-Rückführung über slug
- klare Preview-/Log-Dateien schreiben

Erwartete Dateien im --data-dir:
- 003_new_treatments_03.csv
- tbl_treatments_03.csv   (lokale Referenz optional, aber empfohlen)

.env:
- LCN_DB_HOST
- LCN_DB_PORT
- LCN_DB_USERNAME
- LCN_DB_PASSWORD
- LCN_DB_DATABASE
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

try:
    from dotenv import load_dotenv
except ImportError:
    print("FEHLER: python-dotenv ist nicht installiert. Bitte: pip install python-dotenv")
    sys.exit(2)

try:
    import mysql.connector
except ImportError:
    print("FEHLER: mysql-connector-python ist nicht installiert. Bitte: pip install mysql-connector-python")
    sys.exit(2)


EXPECTED_INPUT = "003_new_treatments_03.csv"
LOCAL_REF = "tbl_treatments_03.csv"
PREVIEW_FILE = "003_new_treatments_03.preview.csv"
WITH_IDS_FILE = "003_new_treatments_03.with_ids.csv"
CONFLICTS_FILE = "003_new_treatments_03.conflicts.csv"


REQUIRED_COLUMNS = [
    "behandlung",
    "slug",
    "typ",
    "weitere_hinweise",
    "notes_internal",
]


@dataclass
class RowDecision:
    rownum: int
    bezeichnung: str
    slug: str
    typ: str
    action: str
    reason: str
    existing_treat_id: str = ""


def fail(msg: str, code: int = 1) -> None:
    print(f"FEHLER: {msg}")
    sys.exit(code)


def info(msg: str) -> None:
    print(msg)


def load_env(env_path: Path) -> Dict[str, str]:
    if not env_path.exists():
        fail(f".env nicht gefunden: {env_path}")
    load_dotenv(env_path)
    keys = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    values = {}
    missing = []
    for k in keys:
        v = os.getenv(k)
        if not v:
            missing.append(k)
        else:
            values[k] = v
    if missing:
        fail(".env unvollständig. Fehlende Keys: " + ", ".join(missing))
    return values


def db_connect(cfg: Dict[str, str]):
    return mysql.connector.connect(
        host=cfg["LCN_DB_HOST"],
        port=int(cfg["LCN_DB_PORT"]),
        user=cfg["LCN_DB_USERNAME"],
        password=cfg["LCN_DB_PASSWORD"],
        database=cfg["LCN_DB_DATABASE"],
        autocommit=False,
    )


def read_csv_rows(path: Path) -> List[dict]:
    if not path.exists():
        fail(f"CSV nicht gefunden: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            fail(f"CSV ohne Header: {path}")
        rows = list(reader)
        return rows


def write_csv(path: Path, fieldnames: List[str], rows: List[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def norm(s: str) -> str:
    return (s or "").strip()


def validate_input_columns(rows: List[dict]) -> None:
    if not rows:
        fail("Input-CSV ist leer.")
    missing = [c for c in REQUIRED_COLUMNS if c not in rows[0].keys()]
    if missing:
        fail("Input-CSV hat fehlende Pflichtspalten: " + ", ".join(missing))


def check_local_duplicates(rows: List[dict]) -> Tuple[List[str], List[str]]:
    seen_slug = {}
    seen_name = {}
    dup_slug = []
    dup_name = []

    for i, row in enumerate(rows, start=2):
        slug = norm(row.get("slug", ""))
        name = norm(row.get("behandlung", ""))

        if not slug:
            fail(f"Leerer slug in Zeile {i}.")
        if not name:
            fail(f"Leere bezeichnung in Zeile {i}.")

        if slug in seen_slug:
            dup_slug.append(f"{slug} (Zeilen {seen_slug[slug]} und {i})")
        else:
            seen_slug[slug] = i

        if name in seen_name:
            dup_name.append(f"{name} (Zeilen {seen_name[name]} und {i})")
        else:
            seen_name[name] = i

    return dup_slug, dup_name


def fetch_existing_treatments(conn, table_name: str) -> Tuple[Dict[str, dict], Dict[str, dict], List[str]]:
    cur = conn.cursor(dictionary=True)
    cur.execute(f"SHOW COLUMNS FROM `{table_name}`")
    columns = [r["Field"] for r in cur.fetchall()]
    required = ["treat_id", "behandlung", "slug", "typ"]
    missing = [c for c in required if c not in columns]
    if missing:
        fail(f"Zieltabelle {table_name} hat nicht die erwarteten Spalten: " + ", ".join(missing))

    select_cols = ["treat_id", "behandlung", "slug", "typ"]
    if "weitere_hinweise" in columns:
        select_cols.append("weitere_hinweise")
    if "notes_internal" in columns:
        select_cols.append("notes_internal")

    cur.execute(f"SELECT {', '.join(select_cols)} FROM `{table_name}`")
    rows = cur.fetchall()
    by_slug = {}
    by_name = {}
    for r in rows:
        slug = norm(r.get("slug", ""))
        name = norm(r.get("behandlung", ""))
        if slug:
            by_slug[slug] = r
        if name:
            by_name[name] = r
    cur.close()
    return by_slug, by_name, columns


def build_preview(input_rows: List[dict], existing_by_slug: Dict[str, dict], existing_by_name: Dict[str, dict]) -> List[RowDecision]:
    decisions: List[RowDecision] = []

    for idx, row in enumerate(input_rows, start=2):
        name = norm(row.get("behandlung", ""))
        slug = norm(row.get("slug", ""))
        typ = norm(row.get("typ", ""))

        if slug in existing_by_slug:
            existing = existing_by_slug[slug]
            reason = f"slug bereits vorhanden in DB ({existing.get('behandlung')})"
            decisions.append(RowDecision(idx, name, slug, typ, "skip_existing", reason, str(existing.get("treat_id", ""))))
            continue

        if name in existing_by_name:
            existing = existing_by_name[name]
            reason = f"behandlung bereits vorhanden in DB (slug={existing.get('slug')})"
            decisions.append(RowDecision(idx, name, slug, typ, "skip_existing", reason, str(existing.get("treat_id", ""))))
            continue

        decisions.append(RowDecision(idx, name, slug, typ, "insert", "neu", ""))

    return decisions


def insert_treatments(conn, table_name: str, input_rows: List[dict], decisions: List[RowDecision], table_columns: List[str]) -> int:
    insertable = [d for d in decisions if d.action == "insert"]
    if not insertable:
        return 0

    input_by_slug = {norm(r["slug"]): r for r in input_rows}
    allowed_cols = [c for c in ["behandlung", "slug", "typ", "weitere_hinweise", "notes_internal"] if c in table_columns]

    placeholders = ", ".join(["%s"] * len(allowed_cols))
    col_sql = ", ".join(f"`{c}`" for c in allowed_cols)
    sql = f"INSERT INTO `{table_name}` ({col_sql}) VALUES ({placeholders})"

    cur = conn.cursor()
    count = 0
    for d in insertable:
        row = input_by_slug[d.slug]
        values = [norm(row.get(c, "")) or None for c in allowed_cols]
        cur.execute(sql, values)
        count += 1
    cur.close()
    return count


def fetch_ids_for_input(conn, table_name: str, input_rows: List[dict]) -> Dict[str, str]:
    slugs = [norm(r["slug"]) for r in input_rows if norm(r.get("slug", ""))]
    if not slugs:
        return {}
    # chunking safe enough for current size, but still do in smaller blocks
    cur = conn.cursor(dictionary=True)
    found = {}
    chunk_size = 100
    for i in range(0, len(slugs), chunk_size):
        chunk = slugs[i:i + chunk_size]
        placeholders = ", ".join(["%s"] * len(chunk))
        sql = f"SELECT treat_id, slug FROM `{table_name}` WHERE slug IN ({placeholders})"
        cur.execute(sql, chunk)
        for r in cur.fetchall():
            found[norm(r["slug"])] = str(r["treat_id"])
    cur.close()
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description="LCN 003 Treatments Upload")
    parser.add_argument("--data-dir", required=True, help="Verzeichnis mit CSV-Dateien")
    parser.add_argument("--env-file", default=None, help="Pfad zur .env")
    parser.add_argument("--table", default="tbl_treatments_03", help="Zieltabelle")
    parser.add_argument("--apply", action="store_true", help="Echten Insert ausführen")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        fail(f"data-dir existiert nicht: {data_dir}")

    env_file = Path(args.env_file) if args.env_file else data_dir / ".env"
    cfg = load_env(env_file)

    input_path = data_dir / EXPECTED_INPUT
    input_rows = read_csv_rows(input_path)
    validate_input_columns(input_rows)

    dup_slug, dup_name = check_local_duplicates(input_rows)
    if dup_slug or dup_name:
        if dup_slug:
            info("Lokale Duplikate nach slug gefunden:")
            for x in dup_slug:
                info("  - " + x)
        if dup_name:
            info("Lokale Duplikate nach bezeichnung gefunden:")
            for x in dup_name:
                info("  - " + x)
        fail("Input-Datei enthält lokale Duplikate. Upload gestoppt.")

    conn = db_connect(cfg)
    try:
        existing_by_slug, existing_by_name, table_columns = fetch_existing_treatments(conn, args.table)
        decisions = build_preview(input_rows, existing_by_slug, existing_by_name)

        preview_rows = []
        conflict_rows = []
        insert_count = 0
        skip_count = 0

        for d in decisions:
            out = {
                "csv_rownum": d.rownum,
                "behandlung": d.bezeichnung,
                "slug": d.slug,
                "typ": d.typ,
                "action": d.action,
                "reason": d.reason,
                "existing_treat_id": d.existing_treat_id,
            }
            preview_rows.append(out)
            if d.action == "insert":
                insert_count += 1
            else:
                skip_count += 1
                conflict_rows.append(out)

        write_csv(data_dir / PREVIEW_FILE, list(preview_rows[0].keys()) if preview_rows else ["csv_rownum"], preview_rows)
        write_csv(data_dir / CONFLICTS_FILE, list(conflict_rows[0].keys()) if conflict_rows else ["csv_rownum"], conflict_rows)

        info("=== PRECHECK / PREVIEW ===")
        info(f"Input-Zeilen                 : {len(input_rows)}")
        info(f"Neu einfügbar               : {insert_count}")
        info(f"Bestehend / zu überspringen : {skip_count}")
        info(f"Preview-Datei               : {data_dir / PREVIEW_FILE}")
        info(f"Conflict-Datei              : {data_dir / CONFLICTS_FILE}")

        if not args.apply:
            info("Dry-Run aktiv. Kein DB-Write ausgeführt.")
        else:
            inserted = insert_treatments(conn, args.table, input_rows, decisions, table_columns)
            conn.commit()
            info(f"Echte Inserts ausgeführt    : {inserted}")

        id_map = fetch_ids_for_input(conn, args.table, input_rows)
        with_ids_rows = []
        for row in input_rows:
            out = dict(row)
            out["treat_id"] = id_map.get(norm(row.get("slug", "")), "")
            with_ids_rows.append(out)

        fieldnames = list(with_ids_rows[0].keys()) if with_ids_rows else list(input_rows[0].keys()) + ["treat_id"]
        write_csv(data_dir / WITH_IDS_FILE, fieldnames, with_ids_rows)

        assigned = sum(1 for r in with_ids_rows if norm(r.get("treat_id", "")))
        missing = len(with_ids_rows) - assigned

        info("=== ID-RÜCKFÜHRUNG ===")
        info(f"Zeilen mit treat_id         : {assigned}")
        info(f"Zeilen ohne treat_id        : {missing}")
        info(f"Output-Datei                : {data_dir / WITH_IDS_FILE}")

        # harte Nachprüfung
        if assigned < len(input_rows):
            info("WARNUNG: Nicht alle Input-Zeilen haben nach der Rückführung eine treat_id.")
            info("Bitte Konfliktdatei prüfen. Typischer Grund: bestehender Konflikt oder fehlgeschlagener Insert.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
