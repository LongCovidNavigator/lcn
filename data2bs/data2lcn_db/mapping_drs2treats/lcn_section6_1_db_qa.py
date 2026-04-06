import os
from collections import Counter
from pathlib import Path

try:
    import mysql.connector
except ImportError:
    raise SystemExit(
        "Fehlendes Paket: mysql-connector-python\n"
        "Installiere es in deiner venv mit:\n"
        r"C:\xampp\htdocs\lcn\data2bs\.venv\Scripts\python.exe -m pip install mysql-connector-python"
    )


# =========================
# KONFIGURATION
# =========================
ENV_FILE = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\.env"
BATCH_ID = "003_mapping_drs2treat_url_aus_tbl_drs_03"

TABLE_CPL = "tbl_cpl_drs2treatments_03"
TABLE_DRS = "tbl_drs_03"
TABLE_TREATS = "tbl_treatments_03"


# =========================
# .env lesen
# =========================
def load_env_file(path: str) -> dict:
    env = {}
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f".env nicht gefunden: {path}")

    for raw_line in p.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def db_config_from_env(env: dict) -> dict:
    required = [
        "LCN_DB_HOST",
        "LCN_DB_PORT",
        "LCN_DB_USERNAME",
        "LCN_DB_PASSWORD",
        "LCN_DB_DATABASE",
    ]
    missing = [k for k in required if not env.get(k)]
    if missing:
        raise ValueError(f"Fehlende ENV-Keys: {', '.join(missing)}")

    return {
        "host": env["LCN_DB_HOST"],
        "port": int(env["LCN_DB_PORT"]),
        "user": env["LCN_DB_USERNAME"],
        "password": env["LCN_DB_PASSWORD"],
        "database": env["LCN_DB_DATABASE"],
    }


# =========================
# DB Helfer
# =========================
def fetch_all(cur, sql: str, params=None):
    cur.execute(sql, params or ())
    return cur.fetchall()


def fetch_one(cur, sql: str, params=None):
    cur.execute(sql, params or ())
    return cur.fetchone()


def table_exists(cur, table_name: str) -> bool:
    row = fetch_one(cur, "SHOW TABLES LIKE %s", (table_name,))
    return row is not None


def get_columns(cur, table_name: str) -> list[str]:
    rows = fetch_all(cur, f"DESCRIBE {table_name}")
    columns = []
    for r in rows:
        if isinstance(r, dict):
            columns.append(r["Field"])
        else:
            columns.append(r[0])
    return columns


# =========================
# Statistik-Helfer
# =========================
def print_counter_distribution(title: str, counter: Counter):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)
    print(f"{'Anzahl Matches':>15} | {'Anzahl Entitäten':>18}")
    print("-" * 80)
    for match_count in sorted(counter.keys()):
        print(f"{match_count:>15} | {counter[match_count]:>18}")


def rows_to_counter(rows, key_name="match_count") -> Counter:
    c = Counter()
    for row in rows:
        c[int(row[key_name])] += 1
    return c


def fmt_pct(numerator: int, denominator: int) -> str:
    if denominator == 0:
        return f"n/a ({numerator}/{denominator})"
    pct = (numerator / denominator) * 100
    return f"{pct:.2f}% ({numerator}/{denominator})"


# =========================
# Hauptlogik Section 6.1
# =========================
def main():
    print("\nLCN Section 6.1 – Coverage / Validierung")
    print("-" * 80)
    print(f"ENV_FILE: {ENV_FILE}")
    print(f"BATCH_ID : {BATCH_ID}")

    env = load_env_file(ENV_FILE)
    cfg = db_config_from_env(env)

    conn = mysql.connector.connect(**cfg)
    cur = conn.cursor(dictionary=True)

    try:
        # 1) Start- und Inputprüfung
        print("\n[1] Start- und Inputprüfung")
        required_tables = [TABLE_CPL, TABLE_DRS, TABLE_TREATS]
        missing_tables = [t for t in required_tables if not table_exists(cur, t)]

        if missing_tables:
            print("Section 6 kann noch nicht gestartet werden, weil Tabellen fehlen:")
            for t in missing_tables:
                print(f"  - {t}")
            return

        cpl_cols = get_columns(cur, TABLE_CPL)
        drs_cols = get_columns(cur, TABLE_DRS)
        treat_cols = get_columns(cur, TABLE_TREATS)

        required_cpl_cols = {"dr_id", "treat_id", "note"}
        required_drs_cols = {"dr_id"}
        required_treat_cols = {"treat_id"}

        missing_cpl_cols = required_cpl_cols - set(cpl_cols)
        missing_drs_cols = required_drs_cols - set(drs_cols)
        missing_treat_cols = required_treat_cols - set(treat_cols)

        blocker = False
        if missing_cpl_cols:
            blocker = True
            print(f"Fehlende Spalten in {TABLE_CPL}: {sorted(missing_cpl_cols)}")
        if missing_drs_cols:
            blocker = True
            print(f"Fehlende Spalten in {TABLE_DRS}: {sorted(missing_drs_cols)}")
        if missing_treat_cols:
            blocker = True
            print(f"Fehlende Spalten in {TABLE_TREATS}: {sorted(missing_treat_cols)}")

        if blocker:
            print("Section 6 kann noch nicht gestartet werden, weil Pflichtspalten fehlen.")
            return

        print("Section 6 kann gestartet werden.")

        # 2) Grundzählungen
        total_doctors = fetch_one(cur, f"SELECT COUNT(*) AS c FROM {TABLE_DRS}")["c"]
        total_treatments = fetch_one(cur, f"SELECT COUNT(*) AS c FROM {TABLE_TREATS}")["c"]
        total_links = fetch_one(cur, f"SELECT COUNT(*) AS c FROM {TABLE_CPL}")["c"]

        # 3) Ärzte mit / ohne Match
        doctors_with_match = fetch_one(
            cur,
            f"""
            SELECT COUNT(DISTINCT d.dr_id) AS c
            FROM {TABLE_DRS} d
            INNER JOIN {TABLE_CPL} cpl
                ON cpl.dr_id = d.dr_id
            """
        )["c"]

        doctors_without_match = fetch_one(
            cur,
            f"""
            SELECT COUNT(*) AS c
            FROM {TABLE_DRS} d
            LEFT JOIN {TABLE_CPL} cpl
                ON cpl.dr_id = d.dr_id
            WHERE cpl.dr_id IS NULL
            """
        )["c"]

        # 4) Treatments mit / ohne Match
        treatments_with_match = fetch_one(
            cur,
            f"""
            SELECT COUNT(DISTINCT t.treat_id) AS c
            FROM {TABLE_TREATS} t
            INNER JOIN {TABLE_CPL} cpl
                ON cpl.treat_id = t.treat_id
            """
        )["c"]

        treatments_without_match = fetch_one(
            cur,
            f"""
            SELECT COUNT(*) AS c
            FROM {TABLE_TREATS} t
            LEFT JOIN {TABLE_CPL} cpl
                ON cpl.treat_id = t.treat_id
            WHERE cpl.treat_id IS NULL
            """
        )["c"]

        # 5) Batch-Sichtbarkeit als QA-Zusatzcheck
        batch_rows = fetch_one(
            cur,
            f"""
            SELECT COUNT(*) AS c
            FROM {TABLE_CPL}
            WHERE note LIKE %s
            """,
            (f"%source_batch_id={BATCH_ID}%",)
        )["c"]

        batch_doctors = fetch_one(
            cur,
            f"""
            SELECT COUNT(DISTINCT dr_id) AS c
            FROM {TABLE_CPL}
            WHERE note LIKE %s
            """,
            (f"%source_batch_id={BATCH_ID}%",)
        )["c"]

        batch_treatments = fetch_one(
            cur,
            f"""
            SELECT COUNT(DISTINCT treat_id) AS c
            FROM {TABLE_CPL}
            WHERE note LIKE %s
            """,
            (f"%source_batch_id={BATCH_ID}%",)
        )["c"]

        # 6) QA-Auffälligkeiten
        note_null = fetch_one(
            cur,
            f"SELECT COUNT(*) AS c FROM {TABLE_CPL} WHERE note IS NULL"
        )["c"]

        note_empty = fetch_one(
            cur,
            f"SELECT COUNT(*) AS c FROM {TABLE_CPL} WHERE note IS NOT NULL AND TRIM(note) = ''"
        )["c"]

        invalid_dr_refs = fetch_one(
            cur,
            f"""
            SELECT COUNT(*) AS c
            FROM {TABLE_CPL} cpl
            LEFT JOIN {TABLE_DRS} d
                ON d.dr_id = cpl.dr_id
            WHERE d.dr_id IS NULL
            """
        )["c"]

        invalid_treat_refs = fetch_one(
            cur,
            f"""
            SELECT COUNT(*) AS c
            FROM {TABLE_CPL} cpl
            LEFT JOIN {TABLE_TREATS} t
                ON t.treat_id = cpl.treat_id
            WHERE t.treat_id IS NULL
            """
        )["c"]

        duplicate_pairs = fetch_all(
            cur,
            f"""
            SELECT dr_id, treat_id, COUNT(*) AS dup_count
            FROM {TABLE_CPL}
            GROUP BY dr_id, treat_id
            HAVING COUNT(*) > 1
            """
        )
        duplicate_pair_count = len(duplicate_pairs)

        duplicate_pairs_in_batch = fetch_all(
            cur,
            f"""
            SELECT dr_id, treat_id, COUNT(*) AS dup_count
            FROM {TABLE_CPL}
            WHERE note LIKE %s
            GROUP BY dr_id, treat_id
            HAVING COUNT(*) > 1
            """,
            (f"%source_batch_id={BATCH_ID}%",)
        )
        duplicate_pair_count_in_batch = len(duplicate_pairs_in_batch)

        qa_findings_count = (
            (1 if note_null > 0 else 0)
            + (1 if note_empty > 0 else 0)
            + (1 if invalid_dr_refs > 0 else 0)
            + (1 if invalid_treat_refs > 0 else 0)
            + (1 if duplicate_pair_count > 0 else 0)
            + (1 if duplicate_pair_count_in_batch > 0 else 0)
        )

        blocker_count = (
            (1 if invalid_dr_refs > 0 else 0)
            + (1 if invalid_treat_refs > 0 else 0)
        )

        # 7) Verteilungsstatistik Ärzte
        doctor_distribution_rows = fetch_all(
            cur,
            f"""
            SELECT
                d.dr_id,
                COUNT(cpl.treat_id) AS match_count
            FROM {TABLE_DRS} d
            LEFT JOIN {TABLE_CPL} cpl
                ON cpl.dr_id = d.dr_id
            GROUP BY d.dr_id
            ORDER BY match_count, d.dr_id
            """
        )
        doctor_distribution = rows_to_counter(doctor_distribution_rows)

        # 8) Verteilungsstatistik Treatments
        treatment_distribution_rows = fetch_all(
            cur,
            f"""
            SELECT
                t.treat_id,
                COUNT(cpl.dr_id) AS match_count
            FROM {TABLE_TREATS} t
            LEFT JOIN {TABLE_CPL} cpl
                ON cpl.treat_id = t.treat_id
            GROUP BY t.treat_id
            ORDER BY match_count, t.treat_id
            """
        )
        treatment_distribution = rows_to_counter(treatment_distribution_rows)

        # 9) Ausgabe
        print("\n[2] Coverage-/Validierungsstand")
        print("-" * 80)
        print(f"Ärzte gesamt                              : {total_doctors}")
        print(f"Treatments gesamt                         : {total_treatments}")
        print(f"Zeilen in Koppeltabelle gesamt            : {total_links}")
        print(f"Ärzte mit mindestens 1 Match              : {fmt_pct(doctors_with_match, total_doctors)}")
        print(f"Treatments mit mindestens 1 Match         : {fmt_pct(treatments_with_match, total_treatments)}")
        print(f"Ärzte ohne Match                          : {fmt_pct(doctors_without_match, total_doctors)}")
        print(f"Treatments ohne Match                     : {fmt_pct(treatments_without_match, total_treatments)}")
        print(f"Batch-Zeilen sichtbar über source_batch_id: {batch_rows}")
        print(f"Batch-Ärzte sichtbar                      : {fmt_pct(batch_doctors, total_doctors)}")
        print(f"Batch-Treatments sichtbar                 : {fmt_pct(batch_treatments, total_treatments)}")
        print(f"QA-Auffälligkeiten                        : {qa_findings_count}")
        print(f"Technische/fachliche Blocker              : {blocker_count}")

        print("\n[3] QA-Auffälligkeiten im Detail")
        print("-" * 80)
        print(f"note IS NULL                              : {note_null}")
        print(f"note leer                                 : {note_empty}")
        print(f"ungültige dr_id-Referenzen                : {invalid_dr_refs}")
        print(f"ungültige treat_id-Referenzen             : {invalid_treat_refs}")
        print(f"Dubletten (dr_id, treat_id) gesamt        : {duplicate_pair_count}")
        print(f"Dubletten (dr_id, treat_id) im Batch      : {duplicate_pair_count_in_batch}")

        print_counter_distribution(
            "Verteilungsstatistik Ärzte: Wie viele Ärzte haben wie viele Matches?",
            doctor_distribution
        )

        print_counter_distribution(
            "Verteilungsstatistik Treatments: Wie viele Treatments haben wie viele Matches?",
            treatment_distribution
        )

        print("\nFertig.")

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()