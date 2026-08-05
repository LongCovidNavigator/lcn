import argparse
import hashlib
import os
import random
from pathlib import Path
from lcn_env import lcn_env_path
from typing import Any, Dict, List, Tuple

import mysql.connector
from dotenv import load_dotenv


# =========================
# SETTINGS
# =========================
# Zweck:
# - Liest alle Behandlungen aus lcn_votes
# - Erstellt/aktualisiert genau eine Dummy-Zeile pro Behandlung in lcn_raw_votes
# - lcn_votes wird NIEMALS verändert
# - Standard ist DRY RUN. Schreiben nur mit --apply.

SOURCE_TABLE = "lcn_votes"
TARGET_TABLE = "lcn_raw_votes"
SOURCE_LABEL = "sync_lcn_votes_to_raw_votes_dummy.py"
ENTITY_TYPE = "dummy_vote"

TREATMENT_COL = "Behandlung"
VOTE_COLS = ["pro", "neutral", "contra"]
RANDOM_MIN = 0
RANDOM_MAX = 100

# Zentrale private LCN-Umgebungsdatei
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = lcn_env_path()


# =========================
# HELPERS
# =========================
def q_ident(name: str) -> str:
    """Quote MySQL identifiers safely with backticks."""
    return f"`{name.replace('`', '``')}`"


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def load_env() -> None:
    loaded = load_dotenv(ENV_PATH)
    if not loaded:
        raise RuntimeError(f"Could not load central LCN env file: {ENV_PATH}")


def db_connect():
    db = os.getenv("LCN_DB_DATABASE")
    if not db:
        raise RuntimeError("LCN_DB_DATABASE fehlt in der .env – Abbruch (niemals BookStack DB).")

    if db.strip().lower() in {"bookstack_db", "bookstack", "bookstackdb"}:
        raise RuntimeError(f"Refusing to write into BookStack DB ({db}). Check LCN_DB_DATABASE!")

    host = os.getenv("LCN_DB_HOST") or os.getenv("DB_HOST") or "localhost"
    port = int(os.getenv("LCN_DB_PORT") or os.getenv("DB_PORT") or "3306")
    user = os.getenv("LCN_DB_USERNAME") or os.getenv("DB_USERNAME") or "root"
    pw = os.getenv("LCN_DB_PASSWORD") or os.getenv("DB_PASSWORD") or ""

    print("Connecting to:", {"host": host, "port": port, "user": user, "database": db})
    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=pw,
        database=db,
        autocommit=False,
    )


def ensure_target_table(cur) -> None:
    """Create lcn_raw_votes if it does not exist, matching your current structure."""
    sql = f"""
    CREATE TABLE IF NOT EXISTS {q_ident(TARGET_TABLE)} (
      {q_ident('__id')} BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      {q_ident('__source')} VARCHAR(255) NOT NULL,
      {q_ident('__entity_type')} VARCHAR(80) NULL,
      {q_ident('__payload_hash')} CHAR(64) NOT NULL,
      {q_ident('__created_at')} TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      {q_ident(TREATMENT_COL)} LONGTEXT NULL,
      {q_ident('contra')} DOUBLE NULL,
      {q_ident('neutral')} DOUBLE NULL,
      {q_ident('pro')} DOUBLE NULL,
      PRIMARY KEY ({q_ident('__id')}),
      UNIQUE KEY uq_source_hash ({q_ident('__source')}, {q_ident('__payload_hash')})
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
    return {row[0] for row in cur.fetchall()}


def ensure_required_columns(cur) -> None:
    """Add missing columns if target table already existed with an incomplete structure."""
    existing = get_existing_columns(cur, TARGET_TABLE)

    required_cols = {
        "__source": "VARCHAR(255) NOT NULL",
        "__entity_type": "VARCHAR(80) NULL",
        "__payload_hash": "CHAR(64) NOT NULL",
        "__created_at": "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
        TREATMENT_COL: "LONGTEXT NULL",
        "contra": "DOUBLE NULL",
        "neutral": "DOUBLE NULL",
        "pro": "DOUBLE NULL",
    }

    for col, col_type in required_cols.items():
        if col not in existing:
            cur.execute(f"ALTER TABLE {q_ident(TARGET_TABLE)} ADD COLUMN {q_ident(col)} {col_type};")


def read_lcn_votes(cur) -> List[str]:
    """Read treatments from lcn_votes. Vote values from lcn_votes are intentionally ignored."""
    cur.execute(f"""
        SELECT DISTINCT {q_ident(TREATMENT_COL)}
        FROM {q_ident(SOURCE_TABLE)}
        WHERE {q_ident(TREATMENT_COL)} IS NOT NULL
          AND TRIM({q_ident(TREATMENT_COL)}) <> ''
        ORDER BY {q_ident(TREATMENT_COL)} ASC
    """)
    return [row[0] for row in cur.fetchall()]


def build_payload_hash(behandlung: str) -> str:
    """
    Stable hash per treatment.
    This makes the script update the same row per treatment instead of creating history rows.
    """
    return sha256_text(f"{SOURCE_LABEL}|{ENTITY_TYPE}|{behandlung}")


def random_vote_values() -> Dict[str, int]:
    return {
        "pro": random.randint(RANDOM_MIN, RANDOM_MAX),
        "neutral": random.randint(RANDOM_MIN, RANDOM_MAX),
        "contra": random.randint(RANDOM_MIN, RANDOM_MAX),
    }


def preview_rows(rows: List[Tuple[str, Dict[str, int]]], limit: int = 10) -> None:
    print("\nPreview:")
    for behandlung, votes in rows[:limit]:
        print(
            f"- {behandlung!r}: pro={votes['pro']}, "
            f"neutral={votes['neutral']}, contra={votes['contra']}"
        )
    if len(rows) > limit:
        print(f"... plus {len(rows) - limit} weitere Zeilen")


def upsert_dummy_votes(cur, rows: List[Tuple[str, Dict[str, int]]]) -> Tuple[int, int]:
    """
    Insert or update one row per treatment.

    The stable payload_hash is the logical key for one dummy row per treatment.
    Existing dummy rows created by this script are overwritten with fresh random values.
    """
    sql = f"""
        INSERT INTO {q_ident(TARGET_TABLE)}
          ({q_ident('__source')}, {q_ident('__entity_type')}, {q_ident('__payload_hash')},
           {q_ident(TREATMENT_COL)}, {q_ident('contra')}, {q_ident('neutral')}, {q_ident('pro')})
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
          {q_ident(TREATMENT_COL)} = VALUES({q_ident(TREATMENT_COL)}),
          {q_ident('contra')} = VALUES({q_ident('contra')}),
          {q_ident('neutral')} = VALUES({q_ident('neutral')}),
          {q_ident('pro')} = VALUES({q_ident('pro')});
    """

    inserted = 0
    updated = 0

    for behandlung, votes in rows:
        payload_hash = build_payload_hash(behandlung)
        values = (
            SOURCE_LABEL,
            ENTITY_TYPE,
            payload_hash,
            behandlung,
            votes["contra"],
            votes["neutral"],
            votes["pro"],
        )
        cur.execute(sql, values)

        # MySQL rowcount with ON DUPLICATE KEY UPDATE:
        # 1 = inserted, 2 = updated, 0 = unchanged
        if cur.rowcount == 1:
            inserted += 1
        else:
            updated += 1

    return inserted, updated


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create/update dummy rows in lcn_raw_votes from treatments in lcn_votes."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to the database. Without this flag, only a dry run is performed.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed for reproducible dummy values.",
    )
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    load_env()
    conn = db_connect()

    try:
        cur = conn.cursor()

        # Ensure target table only when applying.
        # In dry-run we still read source and show preview without changing anything.
        treatments = read_lcn_votes(cur)
        if not treatments:
            raise RuntimeError(f"Keine Behandlungen in {SOURCE_TABLE}.{TREATMENT_COL} gefunden.")

        prepared_rows = [(behandlung, random_vote_values()) for behandlung in treatments]

        print("\nMode:", "APPLY" if args.apply else "DRY RUN")
        print(f"Source table: {SOURCE_TABLE}")
        print(f"Target table: {TARGET_TABLE}")
        print(f"Read treatments from lcn_votes: {len(treatments)}")
        print(f"Prepared dummy rows for lcn_raw_votes: {len(prepared_rows)}")
        print(f"Random range: {RANDOM_MIN}..{RANDOM_MAX} for pro/neutral/contra")
        preview_rows(prepared_rows)

        if not args.apply:
            conn.rollback()
            print("\nDry run only. No database changes were written.")
            print("To write changes, run with: --apply")
            return

        ensure_target_table(cur)
        ensure_required_columns(cur)
        cur.execute(f"TRUNCATE TABLE {q_ident(TARGET_TABLE)};")

        inserted, updated = upsert_dummy_votes(cur, prepared_rows)
        conn.commit()

        print("\nDone.")
        print(f"Inserted new rows: {inserted}")
        print(f"Updated existing rows: {updated}")
        print(f"Unchanged lcn_votes rows: {len(treatments)} (source table was read-only)")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
