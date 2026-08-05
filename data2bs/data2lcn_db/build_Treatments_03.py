#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Create treatment tables (_03) for the LCN database.

Usage:
    python create_treatment_tables_03.py
    python create_treatment_tables_03.py --env C:\path\to\.env
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from lcn_env import lcn_env_path


def get_env(*names: str, default=None, required: bool = False):
    for name in names:
        value = os.getenv(name)
        if value not in (None, ""):
            return value
    if required:
        joined = ", ".join(names)
        raise RuntimeError(f"Required environment variable missing. Tried: {joined}")
    return default


def load_env_file(explicit_env_path: str | None) -> str | None:
    candidates = []

    if explicit_env_path:
        candidates.append(Path(explicit_env_path))

    candidates.append(lcn_env_path())

    for path in candidates:
        if path.exists():
            load_dotenv(path, override=False)
            return str(path)

    load_dotenv(override=False)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Create LCN treatment tables (_03).")
    parser.add_argument("--env", help="Optional path to .env file", default=None)
    args = parser.parse_args()

    env_path = load_env_file(args.env)

    db_config = {
        "host": get_env("LCN_DB_HOST", default="localhost"),
        "port": int(get_env("LCN_DB_PORT", default="3306")),
        "user": get_env("LCN_DB_USERNAME", required=True),
        "password": get_env("LCN_DB_PASSWORD", required=True),
        "database": get_env("LCN_DB_DATABASE", default="lcn_database"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.Cursor,
        "autocommit": False,
    }

    sql_statements = [
        """
        CREATE TABLE IF NOT EXISTS tbl_treatments_03 (
            treat_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            slug VARCHAR(255) NULL,
            behandlung VARCHAR(255) NOT NULL,

            aufwand VARCHAR(100) NULL,
            crashrisiko VARCHAR(255) NULL,
            eskalationsstufe VARCHAR(255) NULL,
            kosten VARCHAR(255) NULL,
            nutzen VARCHAR(255) NULL,
            wirkgeschwindigkeit VARCHAR(255) NULL,
            wirkmechanismus MEDIUMTEXT NULL,

            indikationen_anwendungsgebiete MEDIUMTEXT NULL,
            weitere_hinweise MEDIUMTEXT NULL,

            bookstack_page_id INT UNSIGNED NULL,
            wiki_url_path VARCHAR(1024) NULL,

            notes_internal TEXT NULL,

            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (treat_id),
            UNIQUE KEY uq_tbl_treatments_03_behandlung (behandlung),
            UNIQUE KEY uq_tbl_treatments_03_slug (slug),
            KEY idx_tbl_treatments_03_bookstack_page_id (bookstack_page_id)
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_treatment_aliases_03 (
            treatment_alias_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            treat_id INT UNSIGNED NOT NULL,
            alias VARCHAR(255) NOT NULL,
            alias_type VARCHAR(50) NULL COMMENT 'e.g. abbreviation, spelling_variant, trade_name',
            sort_order INT UNSIGNED NOT NULL DEFAULT 0,
            notes_internal TEXT NULL,

            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (treatment_alias_id),
            UNIQUE KEY uq_tbl_treatment_aliases_03_treat_alias (treat_id, alias),
            KEY idx_tbl_treatment_aliases_03_alias (alias),
            KEY idx_tbl_treatment_aliases_03_alias_type (alias_type),

            CONSTRAINT fk_tbl_treatment_aliases_03_treat
                FOREIGN KEY (treat_id)
                REFERENCES tbl_treatments_03 (treat_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_treatments_sources_03 (
            treatment_source_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            treat_id INT UNSIGNED NOT NULL,
            source_id INT UNSIGNED NOT NULL,
            sort_order INT UNSIGNED NOT NULL DEFAULT 0,
            note TEXT NULL,

            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (treatment_source_id),
            UNIQUE KEY uq_tbl_treatments_sources_03_treat_source (treat_id, source_id),
            KEY idx_tbl_treatments_sources_03_source_id (source_id),
            KEY idx_tbl_treatments_sources_03_sort_order (sort_order),

            CONSTRAINT fk_tbl_treatments_sources_03_treat
                FOREIGN KEY (treat_id)
                REFERENCES tbl_treatments_03 (treat_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_cpl_treatments2sym_03 (
            treat_id INT UNSIGNED NOT NULL,
            sym_id INT UNSIGNED NOT NULL,
            sort_order INT UNSIGNED NOT NULL DEFAULT 0,
            note TEXT NULL,

            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (treat_id, sym_id),
            KEY idx_tbl_cpl_treatments2sym_03_sym_id (sym_id),
            KEY idx_tbl_cpl_treatments2sym_03_sort_order (sort_order),

            CONSTRAINT fk_tbl_cpl_treatments2sym_03_treat
                FOREIGN KEY (treat_id)
                REFERENCES tbl_treatments_03 (treat_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
        """,
        """
        CREATE TABLE IF NOT EXISTS tbl_cpl_drs2treatments_03 (
            dr_id INT UNSIGNED NOT NULL,
            treat_id INT UNSIGNED NOT NULL,
            sort_order INT UNSIGNED NOT NULL DEFAULT 0,
            note TEXT NULL,

            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (dr_id, treat_id),
            KEY idx_tbl_cpl_drs2treatments_03_treat_id (treat_id),
            KEY idx_tbl_cpl_drs2treatments_03_sort_order (sort_order),

            CONSTRAINT fk_tbl_cpl_drs2treatments_03_treat
                FOREIGN KEY (treat_id)
                REFERENCES tbl_treatments_03 (treat_id)
                ON DELETE CASCADE
                ON UPDATE CASCADE
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci;
        """,
    ]

    print("=== CREATE TREATMENT TABLES _03 ===")
    print(f"ENV               : {env_path or '(no explicit .env found)'}")
    print(
        "Connecting to     : "
        f"host={db_config['host']} port={db_config['port']} "
        f"db={db_config['database']} user={db_config['user']}"
    )

    conn = None
    try:
        conn = pymysql.connect(**db_config)

        with conn.cursor() as cur:
            cur.execute("SELECT DATABASE()")
            current_db = cur.fetchone()[0]
            print(f"Selected database : {current_db}")

            for i, stmt in enumerate(sql_statements, start=1):
                print(f"Running statement {i}/{len(sql_statements)} ...")
                cur.execute(stmt)

            conn.commit()

            print("\nCreated / verified tables:")
            cur.execute(
                """
                SHOW TABLES
                WHERE Tables_in_lcn_database IN (
                    'tbl_treatments_03',
                    'tbl_treatment_aliases_03',
                    'tbl_treatments_sources_03',
                    'tbl_cpl_treatments2sym_03',
                    'tbl_cpl_drs2treatments_03'
                )
                """
            )
            for row in cur.fetchall():
                print(f"  - {row[0]}")

        print("\nDone.")
        return 0

    except Exception as exc:
        if conn:
            conn.rollback()
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1

    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
