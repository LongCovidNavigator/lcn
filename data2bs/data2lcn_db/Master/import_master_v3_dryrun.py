#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py" ).is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import pymysql
from dotenv import load_dotenv


# =========================
# KONFIG
# =========================

DEFAULT_MASTER_DIR = Path(r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\Master")
DEFAULT_ENV = lcn_env_path()

TREATMENTS_FILE = "treatments_master_v5.csv"
ALIASES_FILE = "aliases_master_v5.csv"
LINKS_FILE = "treatment_alias_links_v5.csv"

TABLE_TREATMENTS = "tbl_treatments_03"
TABLE_ALIASES = "tbl_aliases_03"
TABLE_LINKS = "tbl_cpl_treatments2aliases_03"

ACTIVE_STATUSES = {"ready", "review_2", "manual_review"}


# =========================
# HELPERS
# =========================

def normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def parse_floatish_int(value: Any) -> Optional[int]:
    v = normalize_text(value)
    if not v:
        return None
    try:
        return int(float(v))
    except Exception:
        return None


def sanitize_filename(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    value = re.sub(r"_+", "_", value).strip("._")
    return value or "preview"


def json_safe(value: Any) -> Any:
    if isinstance(value, (dict, list, str, int, float, bool)) or value is None:
        return value
    return str(value)


def collect_ordered_columns(rows: List[Dict[str, Any]]) -> List[str]:
    cols: List[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                cols.append(key)
    return cols


def add_preview_row(previews: Dict[str, List[Dict[str, Any]]], table_name: str, row: Dict[str, Any]) -> None:
    previews.setdefault(table_name, []).append(row)


def write_preview_files(preview_dir: Path, previews: Dict[str, List[Dict[str, Any]]]) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)

    manifest_lines = [
        f"Preview-Verzeichnis: {preview_dir}",
        f"Erstellt am        : {datetime.now().isoformat(timespec='seconds')}",
        "",
    ]

    for table_name, rows in previews.items():
        if not rows:
            continue

        stem = sanitize_filename(table_name)
        csv_path = preview_dir / f"{stem}__preview.csv"
        json_path = preview_dir / f"{stem}__preview.json"

        columns = collect_ordered_columns(rows)

        with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                writer.writerow({c: json_safe(row.get(c)) for c in columns})

        with json_path.open("w", encoding="utf-8") as f:
            json.dump(
                [{k: json_safe(v) for k, v in row.items()} for row in rows],
                f,
                ensure_ascii=False,
                indent=2,
            )

        manifest_lines.append(f"- {table_name}: {len(rows)} Zeilen")
        manifest_lines.append(f"  CSV : {csv_path}")
        manifest_lines.append(f"  JSON: {json_path}")
        manifest_lines.append("")

    manifest_path = preview_dir / "_preview_manifest.txt"
    manifest_path.write_text("\n".join(manifest_lines), encoding="utf-8")


def print_header(title: str) -> None:
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)


# =========================
# DB
# =========================

def load_env_file(env_path: Path) -> Dict[str, Any]:
    if not env_path.exists():
        raise FileNotFoundError(f".env nicht gefunden: {env_path}")

    load_dotenv(env_path, override=False)

    cfg = {
        "host": os.getenv("LCN_DB_HOST", "localhost"),
        "port": int(os.getenv("LCN_DB_PORT", "3306")),
        "user": os.getenv("LCN_DB_USERNAME"),
        "password": os.getenv("LCN_DB_PASSWORD"),
        "database": os.getenv("LCN_DB_DATABASE"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }

    missing = [k for k in ["user", "password", "database"] if not cfg.get(k)]
    if missing:
        raise RuntimeError(f"Fehlende DB-Werte in .env: {', '.join(missing)}")

    return cfg


def connect_db(cfg: Dict[str, Any]):
    return pymysql.connect(**cfg)


def fetchall(cur, sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    cur.execute(sql, params or [])
    return list(cur.fetchall())


def fetchone(cur, sql: str, params: Sequence[Any] | None = None) -> Optional[Dict[str, Any]]:
    cur.execute(sql, params or [])
    return cur.fetchone()


def get_table_columns(cur, db_name: str, table_name: str) -> List[Dict[str, Any]]:
    sql = """
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
        ORDER BY ORDINAL_POSITION
    """
    return fetchall(cur, sql, [db_name, table_name])


def get_column_names(col_rows: List[Dict[str, Any]]) -> set[str]:
    return {r["COLUMN_NAME"] for r in col_rows}


def get_colinfo_map(col_rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {r["COLUMN_NAME"]: r for r in col_rows}


def truncate(value: Optional[str], max_len: Optional[int]) -> Optional[str]:
    if value is None or max_len is None:
        return value
    if len(value) <= max_len:
        return value
    return value[:max_len]


# =========================
# CSV READERS
# =========================

def read_csv_rows(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"CSV nicht gefunden: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, str]] = []
        for row in reader:
            cleaned = {k: normalize_text(v) or "" for k, v in row.items()}
            rows.append(cleaned)
        return rows


# =========================
# TREATMENTS
# =========================

def build_treatment_payload(row: Dict[str, str], colinfo: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}

    mapping = {
        "behandlung": row.get("treatment_name") or None,
        "slug": row.get("slug_candidate") or None,
        "typ": row.get("typ") or None,
        "weitere_hinweise": row.get("weitere_hinweise") or None,
        "notes_internal": row.get("decision_note") or None,
    }

    for col, value in mapping.items():
        if value is None or col not in colinfo:
            continue
        max_len = colinfo[col].get("CHARACTER_MAXIMUM_LENGTH")
        if isinstance(value, str):
            value = truncate(value, max_len)
        payload[col] = value

    return payload


def find_existing_treatment(cur, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    slug = payload.get("slug")
    behandlung = payload.get("behandlung")

    if slug:
        row = fetchone(
            cur,
            f"SELECT treat_id, behandlung, slug FROM `{TABLE_TREATMENTS}` WHERE slug = %s LIMIT 1",
            [slug],
        )
        if row:
            return row

    if behandlung:
        row = fetchone(
            cur,
            f"SELECT treat_id, behandlung, slug FROM `{TABLE_TREATMENTS}` WHERE behandlung = %s LIMIT 1",
            [behandlung],
        )
        if row:
            return row

    return None


# =========================
# ALIASES
# =========================

def build_alias_payload(row: Dict[str, str], colinfo: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}

    source_examples = row.get("source_examples") or row.get("original_name") or None

    mapping = {
        "alias": row.get("alias") or None,
        "alias_type": row.get("alias_type") or None,
        "source_examples": source_examples,
        "notes_internal": row.get("notes_internal") or None,
    }

    for col, value in mapping.items():
        if value is None or col not in colinfo:
            continue
        max_len = colinfo[col].get("CHARACTER_MAXIMUM_LENGTH")
        if isinstance(value, str):
            value = truncate(value, max_len)
        payload[col] = value

    return payload


def find_existing_alias(cur, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    alias = payload.get("alias")
    alias_type = payload.get("alias_type")

    if alias and alias_type is not None:
        row = fetchone(
            cur,
            f"SELECT alias_id, alias, alias_type FROM `{TABLE_ALIASES}` WHERE alias = %s AND alias_type = %s LIMIT 1",
            [alias, alias_type],
        )
        if row:
            return row

    if alias:
        row = fetchone(
            cur,
            f"SELECT alias_id, alias, alias_type FROM `{TABLE_ALIASES}` WHERE alias = %s LIMIT 1",
            [alias],
        )
        if row:
            return row

    return None


# =========================
# LINKS
# =========================

@dataclass
class LookupCaches:
    treatment_by_name: Dict[str, int]
    alias_by_key: Dict[Tuple[str, str], int]


def build_link_payload(
    row: Dict[str, str],
    treat_id: Optional[int],
    alias_id: Optional[int],
    link_colinfo: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}

    if "treat_id" in link_colinfo:
        payload["treat_id"] = treat_id
    if "alias_id" in link_colinfo:
        payload["alias_id"] = alias_id
    if "sort_order" in link_colinfo:
        payload["sort_order"] = 0
    if "note" in link_colinfo:
        payload["note"] = row.get("link_note") or None

    return payload


def find_existing_link(cur, treat_id: int, alias_id: int) -> Optional[Dict[str, Any]]:
    return fetchone(
        cur,
        f"""
        SELECT *
        FROM `{TABLE_LINKS}`
        WHERE treat_id = %s AND alias_id = %s
        LIMIT 1
        """,
        [treat_id, alias_id],
    )


# =========================
# MAIN
# =========================

def main() -> int:
    parser = argparse.ArgumentParser(description="Dry Run Import für Master v3 CSVs")
    parser.add_argument("--master-dir", default=str(DEFAULT_MASTER_DIR), help="Ordner mit den v3 CSVs")
    parser.add_argument("--env", default=str(DEFAULT_ENV), help="Pfad zur .env")
    parser.add_argument("--preview-dir", default=None, help="Optionaler Preview-Ordner")
    parser.add_argument("--include-status", default="ready,review_2,manual_review", help="Kommagetrennte Statusliste")
    parser.add_argument("--write", action="store_true", help="ECHT schreiben statt Dry Run")
    args = parser.parse_args()

    master_dir = Path(args.master_dir)
    env_path = Path(args.env)
    include_statuses = {s.strip() for s in args.include_status.split(",") if s.strip()}

    treatments_csv = master_dir / TREATMENTS_FILE
    aliases_csv = master_dir / ALIASES_FILE
    links_csv = master_dir / LINKS_FILE

    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    preview_dir = Path(args.preview_dir) if args.preview_dir else (master_dir / f"preview_master_v3_{run_ts}")

    try:
        treatments_rows = read_csv_rows(treatments_csv)
        aliases_rows = read_csv_rows(aliases_csv)
        links_rows = read_csv_rows(links_csv)

        treatments_rows = [r for r in treatments_rows if (r.get("status") or "") in include_statuses]
        aliases_rows = [r for r in aliases_rows if (r.get("status") or "") in include_statuses]
        links_rows = [r for r in links_rows if (r.get("status") or "") in include_statuses]

        cfg = load_env_file(env_path)

        print_header("Konfiguration")
        print(f"Master-Ordner      : {master_dir}")
        print(f"ENV                : {env_path}")
        print(f"DB                 : {cfg['database']} @ {cfg['host']}:{cfg['port']}")
        print(f"Modus              : {'WRITE' if args.write else 'DRY RUN'}")
        print(f"Preview-Ordner     : {preview_dir}")
        print(f"Treatments CSV     : {treatments_csv}")
        print(f"Aliases CSV        : {aliases_csv}")
        print(f"Links CSV          : {links_csv}")
        print(f"Statusfilter       : {', '.join(sorted(include_statuses))}")

        conn = connect_db(cfg)
        try:
            with conn.cursor() as cur:
                treatment_cols = get_table_columns(cur, cfg["database"], TABLE_TREATMENTS)
                alias_cols = get_table_columns(cur, cfg["database"], TABLE_ALIASES)
                link_cols = get_table_columns(cur, cfg["database"], TABLE_LINKS)

                treatment_colinfo = get_colinfo_map(treatment_cols)
                alias_colinfo = get_colinfo_map(alias_cols)
                link_colinfo = get_colinfo_map(link_cols)

                print_header("Tabellen")
                print(f"{TABLE_TREATMENTS}: {', '.join(get_column_names(treatment_cols))}")
                print(f"{TABLE_ALIASES}: {', '.join(get_column_names(alias_cols))}")
                print(f"{TABLE_LINKS}: {', '.join(get_column_names(link_cols))}")

                stats = {
                    "treatments_insert": 0,
                    "treatments_update": 0,
                    "aliases_insert": 0,
                    "aliases_update": 0,
                    "links_insert": 0,
                    "links_exists": 0,
                    "links_skipped": 0,
                }
                previews: Dict[str, List[Dict[str, Any]]] = {}

                # ---------------------------------
                # Treatments
                # ---------------------------------
                treatment_id_cache: Dict[str, int] = {}

                for row in treatments_rows:
                    payload = build_treatment_payload(row, treatment_colinfo)
                    existing = find_existing_treatment(cur, payload)

                    preview = {
                        "_source_row_nr": row.get("source_row_nr"),
                        "_original_name": row.get("original_name"),
                        "_status": row.get("status"),
                        "_preview_action": "update" if existing else "insert",
                        **payload,
                    }

                    if existing:
                        preview["_existing_treat_id"] = existing["treat_id"]
                        stats["treatments_update"] += 1
                        treatment_id_cache[payload["behandlung"]] = int(existing["treat_id"])
                    else:
                        stats["treatments_insert"] += 1
                        treatment_id_cache[payload["behandlung"]] = -stats["treatments_insert"]

                    add_preview_row(previews, TABLE_TREATMENTS, preview)

                    if args.write:
                        if existing:
                            update_cols = [c for c in ["slug", "typ", "weitere_hinweise", "notes_internal"] if c in payload]
                            if update_cols:
                                set_sql = ", ".join([f"`{c}` = %s" for c in update_cols])
                                params = [payload[c] for c in update_cols] + [existing["treat_id"]]
                                cur.execute(
                                    f"UPDATE `{TABLE_TREATMENTS}` SET {set_sql} WHERE treat_id = %s",
                                    params,
                                )
                        else:
                            cols = list(payload.keys())
                            sql = f"""
                                INSERT INTO `{TABLE_TREATMENTS}` ({', '.join(f'`{c}`' for c in cols)})
                                VALUES ({', '.join(['%s'] * len(cols))})
                            """
                            cur.execute(sql, [payload[c] for c in cols])
                            treatment_id_cache[payload["behandlung"]] = int(cur.lastrowid)

                # Refresh cache from DB in write mode
                if args.write:
                    rows = fetchall(cur, f"SELECT treat_id, behandlung FROM `{TABLE_TREATMENTS}`")
                    treatment_id_cache = {r["behandlung"]: int(r["treat_id"]) for r in rows}
                else:
                    # Merge existing DB rows too, so links can resolve
                    rows = fetchall(cur, f"SELECT treat_id, behandlung FROM `{TABLE_TREATMENTS}`")
                    for r in rows:
                        treatment_id_cache.setdefault(r["behandlung"], int(r["treat_id"]))

                # ---------------------------------
                # Aliases
                # ---------------------------------
                alias_id_cache: Dict[Tuple[str, str], int] = {}

                for row in aliases_rows:
                    payload = build_alias_payload(row, alias_colinfo)
                    existing = find_existing_alias(cur, payload)
                    alias_key = (payload.get("alias") or "", payload.get("alias_type") or "")

                    preview = {
                        "_status": row.get("status"),
                        "_preview_action": "update" if existing else "insert",
                        **payload,
                    }

                    if existing:
                        preview["_existing_alias_id"] = existing["alias_id"]
                        stats["aliases_update"] += 1
                        alias_id_cache[alias_key] = int(existing["alias_id"])
                    else:
                        stats["aliases_insert"] += 1
                        alias_id_cache[alias_key] = -stats["aliases_insert"]

                    add_preview_row(previews, TABLE_ALIASES, preview)

                    if args.write:
                        if existing:
                            update_cols = [c for c in ["source_examples", "notes_internal"] if c in payload]
                            if update_cols:
                                set_sql = ", ".join([f"`{c}` = %s" for c in update_cols])
                                params = [payload[c] for c in update_cols] + [existing["alias_id"]]
                                cur.execute(
                                    f"UPDATE `{TABLE_ALIASES}` SET {set_sql} WHERE alias_id = %s",
                                    params,
                                )
                        else:
                            cols = list(payload.keys())
                            sql = f"""
                                INSERT INTO `{TABLE_ALIASES}` ({', '.join(f'`{c}`' for c in cols)})
                                VALUES ({', '.join(['%s'] * len(cols))})
                            """
                            cur.execute(sql, [payload[c] for c in cols])
                            alias_id_cache[alias_key] = int(cur.lastrowid)

                # Refresh alias cache from DB in write mode
                if args.write:
                    rows = fetchall(cur, f"SELECT alias_id, alias, alias_type FROM `{TABLE_ALIASES}`")
                    alias_id_cache = {(r["alias"], r["alias_type"] or ""): int(r["alias_id"]) for r in rows}
                else:
                    rows = fetchall(cur, f"SELECT alias_id, alias, alias_type FROM `{TABLE_ALIASES}`")
                    for r in rows:
                        alias_id_cache.setdefault((r["alias"], r["alias_type"] or ""), int(r["alias_id"]))

                # ---------------------------------
                # Links
                # ---------------------------------
                for row in links_rows:
                    treatment_name = row.get("treatment_name") or ""
                    alias = row.get("alias") or ""
                    alias_type = row.get("alias_type") or ""

                    treat_id = treatment_id_cache.get(treatment_name)

                    # Alias-Auflösung bewusst primär über den Alias-Text.
                    # alias_type bleibt Metadatum und wird NICHT mehr als zwingendes Match-Kriterium verwendet.
                    alias_id = None
                    if alias:
                        matching_alias_ids = [
                            aid for (a, at), aid in alias_id_cache.items()
                            if a == alias
                        ]
                        unique_ids = sorted(set(matching_alias_ids))
                        if len(unique_ids) == 1:
                            alias_id = unique_ids[0]

                    preview = {
                        "_status": row.get("status"),
                        "_preview_action": None,
                        "_resolved_treatment_name": treatment_name,
                        "_resolved_alias": alias,
                        "_resolved_alias_type": alias_type,
                        "_treat_id": treat_id,
                        "_alias_id": alias_id,
                        "note": row.get("link_note") or None,
                    }

                    if treat_id is None:
                        preview["_preview_action"] = "skip"
                        preview["_reason"] = "treatment_not_found"
                        stats["links_skipped"] += 1
                        add_preview_row(previews, TABLE_LINKS, preview)
                        continue

                    if alias_id is None:
                        preview["_preview_action"] = "skip"
                        preview["_reason"] = "alias_not_found"
                        stats["links_skipped"] += 1
                        add_preview_row(previews, TABLE_LINKS, preview)
                        continue

                    # In dry run können negative IDs aus dem Cache kommen -> als "insert" behandeln
                    if treat_id > 0 and alias_id > 0:
                        existing = find_existing_link(cur, treat_id, alias_id)
                    else:
                        existing = None

                    if existing:
                        preview["_preview_action"] = "exists"
                        stats["links_exists"] += 1
                    else:
                        preview["_preview_action"] = "insert"
                        stats["links_insert"] += 1

                    payload = build_link_payload(row, treat_id, alias_id, link_colinfo)
                    preview.update(payload)
                    add_preview_row(previews, TABLE_LINKS, preview)

                    if args.write and not existing:
                        cols = [c for c in payload.keys() if payload[c] is not None]
                        sql = f"""
                            INSERT INTO `{TABLE_LINKS}` ({', '.join(f'`{c}`' for c in cols)})
                            VALUES ({', '.join(['%s'] * len(cols))})
                        """
                        cur.execute(sql, [payload[c] for c in cols])
                # ---------------------------------
                # Finish
                # ---------------------------------
                # Zusätzliche Debug-Datei für fehlende Alias-Matches
                missing_alias_rows = []
                for row in previews.get(TABLE_LINKS, []):
                    if row.get("_preview_action") == "skip" and row.get("_reason") == "alias_not_found":
                        missing_alias_rows.append({
                            "_resolved_treatment_name": row.get("_resolved_treatment_name"),
                            "_resolved_alias": row.get("_resolved_alias"),
                            "_resolved_alias_type": row.get("_resolved_alias_type"),
                            "_status": row.get("_status"),
                        })

                if missing_alias_rows:
                    previews["debug_missing_alias_matches"] = missing_alias_rows

                write_preview_files(preview_dir, previews)
                for key, value in stats.items():
                    print(f"{key:22s}: {value}")

                print_header("Preview-Dateien")
                print(f"Ordner: {preview_dir}")
                for name, rows in previews.items():
                    print(f"- {name}: {len(rows)} Zeilen")

                if args.write:
                    if stats["links_skipped"] > 0:
                        conn.rollback()
                        raise RuntimeError(
                            f"WRITE abgebrochen: Es gibt noch {stats['links_skipped']} übersprungene Links.")
                    conn.commit()
                    print("\nWRITE abgeschlossen und committed.")
                else:
                    conn.rollback()
                    print("\nDRY RUN abgeschlossen. Nichts wurde gespeichert.")

        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    except Exception as exc:
        print("\nFEHLER:")
        print(exc)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())