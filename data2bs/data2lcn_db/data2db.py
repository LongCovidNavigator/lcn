import json
import os
import hashlib
from typing import Any, Dict, List, Tuple, Optional
from pathlib import Path


import mysql.connector


# =========================
# HARD-CODE SETTINGS
# =========================
# JSON_PATH = "C:/xampp/htdocs/lcn/assets/data/long_covid_treatments_corrected.json"          # <-- anpassen falls nötig
# TABLE_NAME = "lcn_raw_wiki"                                       # <-- wie die neue Tabelle heißen soll
# SOURCE_LABEL = "wiki.json"                                        # <-- frei wählbares Label

JSON_PATH = r"C:\xampp\htdocs\lcn\assets\data\votes.json"
TABLE_NAME = "lcn_raw_votes"
SOURCE_LABEL = "votes.json"


# .env liegt im gleichen Ordner wie dieses Script (data2db.py)
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".env"

from dotenv import load_dotenv

loaded = load_dotenv(ENV_PATH)
if not loaded:
    raise RuntimeError(f"Could not load .env next to script: {ENV_PATH}")


# =========================
# INTERNALS
# =========================
TECH_COLS = {"__id", "__source", "__entity_type", "__payload_hash", "__created_at"}

def q_ident(name: str) -> str:
    # Backtick-Quoting, erlaubt auch Leerzeichen/Sonderzeichen in JSON-Keys
    return f"`{name.replace('`', '``')}`"

def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def infer_sql_type(value: Any) -> str:
    # robust & simpel: Zahlen -> DOUBLE, Bool -> TINYINT, Rest -> LONGTEXT
    if value is None:
        return "LONGTEXT"
    if isinstance(value, bool):
        return "TINYINT(1)"
    if isinstance(value, (int, float)):
        return "DOUBLE"
    return "LONGTEXT"

def normalize_value(value: Any) -> Optional[Any]:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    if isinstance(value, bool):
        return 1 if value else 0
    return value

def flatten_input(json_data: Any) -> List[Tuple[Optional[str], Dict[str, Any]]]:
    """
    Unterstützt:
    1) Root ist Liste: [ {...}, {...} ]
    2) Root ist Objekt mit Listen-Collections: { "treatments":[...], "doctors":[...] }
    """
    out: List[Tuple[Optional[str], Dict[str, Any]]] = []

    if isinstance(json_data, list):
        for item in json_data:
            if isinstance(item, dict):
                out.append((None, item))
        return out

    if isinstance(json_data, dict):
        # Falls es ein einzelner Record ist
        if all(not isinstance(v, list) for v in json_data.values()):
            out.append((None, json_data))
            return out

        for k, v in json_data.items():
            if isinstance(v, list):
                for item in v:
                    if isinstance(item, dict):
                        out.append((k, item))
        return out

    raise ValueError("Unsupported JSON root type. Expected list or dict.")

def db_connect():
    db = os.getenv("LCN_DB_DATABASE")
    if not db:
        raise RuntimeError("LCN_DB_DATABASE fehlt in der .env – Abbruch (niemals BookStack DB).")

    host = os.getenv("LCN_DB_HOST") or os.getenv("DB_HOST") or "localhost"
    port = int(os.getenv("LCN_DB_PORT") or os.getenv("DB_PORT") or "3306")
    user = os.getenv("LCN_DB_USERNAME") or os.getenv("DB_USERNAME") or "root"
    pw   = os.getenv("LCN_DB_PASSWORD") or os.getenv("DB_PASSWORD") or ""

    if db.strip().lower() in {"bookstack_db", "bookstack", "bookstackdb"}:
        raise RuntimeError(f"Refusing to write into BookStack DB ({db}). Check LCN_DB_DATABASE!")

    print("Connecting to:", {"host": host, "port": port, "user": user, "database": db})
    return mysql.connector.connect(
        host=host, port=port, user=user, password=pw, database=db, autocommit=False
    )

def ensure_table_exists(cur, table: str):
    sql = f"""
    CREATE TABLE IF NOT EXISTS {q_ident(table)} (
      {q_ident("__id")} BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      {q_ident("__source")} VARCHAR(255) NOT NULL,
      {q_ident("__entity_type")} VARCHAR(80) NULL,
      {q_ident("__payload_hash")} CHAR(64) NOT NULL,
      {q_ident("__created_at")} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ({q_ident("__id")}),
      UNIQUE KEY uq_source_hash ({q_ident("__source")}, {q_ident("__payload_hash")})
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    cur.execute(sql)

def get_existing_columns(cur, table: str) -> set:
    cur.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
        """,
        (table,),
    )
    return {r[0] for r in cur.fetchall()}

def add_missing_columns(cur, table: str, cols_to_add: Dict[str, str]):
    for col, col_type in cols_to_add.items():
        if col in TECH_COLS:
            continue
        cur.execute(f"ALTER TABLE {q_ident(table)} ADD COLUMN {q_ident(col)} {col_type} NULL;")

def main():
    # 1) JSON laden
    if not os.path.exists(JSON_PATH):
        raise FileNotFoundError(f"JSON file not found at: {JSON_PATH}")

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        json_data = json.load(f)

    rows = flatten_input(json_data)
    if not rows:
        print("No rows found in JSON.")
        return

    # 2) DB verbinden
    cnx = db_connect()
    cur = cnx.cursor()

    try:
        # 3) Tabelle sicherstellen
        ensure_table_exists(cur, TABLE_NAME)
        existing_cols = get_existing_columns(cur, TABLE_NAME)

        # 4) Keys union -> Spalten anlegen/erweitern
        all_keys = set()
        sample_value_for_key: Dict[str, Any] = {}
        for entity_type, row in rows:
            for k, v in row.items():
                all_keys.add(k)
                if k not in sample_value_for_key and v is not None:
                    sample_value_for_key[k] = v

        to_add: Dict[str, str] = {}
        for k in sorted(all_keys):
            if k not in existing_cols:
                to_add[k] = infer_sql_type(sample_value_for_key.get(k))

        if to_add:
            add_missing_columns(cur, TABLE_NAME, to_add)
            existing_cols = get_existing_columns(cur, TABLE_NAME)
            print(f"Added columns: {len(to_add)}")

        # 5) Insert dynamisch
        data_cols = [k for k in all_keys if k in existing_cols]
        insert_cols = ["__source", "__entity_type", "__payload_hash"] + data_cols

        col_sql = ", ".join(q_ident(c) for c in insert_cols)
        placeholders = ", ".join(["%s"] * len(insert_cols))

        sql = f"""
        INSERT INTO {q_ident(TABLE_NAME)} ({col_sql})
        VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE {q_ident("__created_at")} = {q_ident("__created_at")};
        """

        inserted = 0
        skipped = 0

        for entity_type, row in rows:
            payload = json.dumps(row, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            payload_hash = sha256_text(payload)

            values = [SOURCE_LABEL, entity_type, payload_hash]
            for k in data_cols:
                values.append(normalize_value(row.get(k)))

            cur.execute(sql, tuple(values))
            if cur.rowcount == 1:
                inserted += 1
            else:
                skipped += 1

        cnx.commit()
        print(f"Done. Inserted: {inserted}, Skipped(Duplicates): {skipped}")
        print(f"Table: {TABLE_NAME}")

    except Exception:
        cnx.rollback()
        raise
    finally:
        cur.close()
        cnx.close()

if __name__ == "__main__":
    main()
