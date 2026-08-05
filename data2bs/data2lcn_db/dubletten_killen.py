# dubletten_killen.py  (Step 1+2: Dubletten finden + Konflikte/mergeable analysieren + Ausnahmen filtern)

import os
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path
from lcn_env import lcn_env_path
from urllib.parse import urlsplit

import mysql.connector
from dotenv import load_dotenv


# =========================
# .env (same folder as script)
# =========================
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = lcn_env_path()

loaded = load_dotenv(ENV_PATH)
if not loaded:
    raise RuntimeError(f"Could not load central LCN env file: {ENV_PATH}")


# =========================
# SETTINGS (table/cols only)
# =========================
TABLE = os.getenv("LCN_DRS_TABLE", "tbl_drs_02")

DEFAULT_ID_CANDIDATES = ["dr_id", "id"]
COL_FN = os.getenv("LCN_DRS_FIRSTNAME", "dr_firstname")
COL_LN = os.getenv("LCN_DRS_LASTNAME", "dr_lastname")

OUT_EXACT = os.getenv("LCN_DRS_DUPES_EXACT", "dupes_exact_first_last.csv")
OUT_NORM  = os.getenv("LCN_DRS_DUPES_NORM",  "dupes_norm_first_last.csv")


# =========================
# Helpers
# =========================
def norm(s: str) -> str:
    """Trim/lower, remove dots, collapse whitespace."""
    if s is None:
        s = ""
    s = str(s).strip().lower()
    s = s.replace(".", "")
    s = re.sub(r"\s+", " ", s)
    return s


def db_connect():
    db = os.getenv("LCN_DB_DATABASE")
    if not db:
        raise RuntimeError("LCN_DB_DATABASE fehlt in der .env – Abbruch (niemals BookStack DB).")

    host = os.getenv("LCN_DB_HOST") or os.getenv("DB_HOST") or "localhost"
    port = int(os.getenv("LCN_DB_PORT") or os.getenv("DB_PORT") or "3306")
    user = os.getenv("LCN_DB_USERNAME") or os.getenv("DB_USERNAME") or "root"
    pw   = os.getenv("LCN_DB_PASSWORD") or os.getenv("DB_PASSWORD") or ""

    if db.strip().lower() in {"bookstack_db", "bookstack", "bookstackdb"}:
        raise RuntimeError(f"Refusing to touch BookStack DB ({db}). Check LCN_DB_DATABASE!")

    print("Connecting to:", {"host": host, "port": port, "user": user, "database": db})
    return mysql.connector.connect(
        host=host, port=port, user=user, password=pw, database=db, autocommit=False
    )


def detect_pk_column(cnx) -> str:
    cur = cnx.cursor()
    cur.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_KEY = 'PRI'
        """,
        (TABLE,),
    )
    row = cur.fetchone()
    cur.close()

    if row and row[0]:
        return row[0]

    cur = cnx.cursor()
    cur.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
        """,
        (TABLE,),
    )
    cols = {r[0] for r in cur.fetchall()}
    cur.close()

    for c in DEFAULT_ID_CANDIDATES:
        if c in cols:
            return c

    raise RuntimeError(f"Could not detect PK for table {TABLE}. Columns: {sorted(cols)}")


def fetch_rows(cnx, col_id: str):
    cur = cnx.cursor(dictionary=True)
    q = f"""
        SELECT
            {col_id} AS _id,
            {COL_FN} AS first,
            {COL_LN} AS last
        FROM {TABLE}
    """
    cur.execute(q)
    rows = cur.fetchall()
    cur.close()
    return rows


def group_duplicates(rows, key_fn):
    groups = defaultdict(list)
    for r in rows:
        k = key_fn(r)
        groups[k].append(r)
    return {k: v for k, v in groups.items() if len(v) > 1}


def export_csv(dupes, out_csv):
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["group_key", "group_size", "dr_id", "dr_firstname", "dr_lastname"])
        for k, recs in sorted(dupes.items(), key=lambda kv: (-len(kv[1]), str(kv[0]))):
            for r in sorted(recs, key=lambda x: x["_id"]):
                w.writerow([k, len(recs), r["_id"], r["first"], r["last"]])


def print_preview(dupes, title, max_groups=25, max_rows_per_group=8):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)
    items = sorted(dupes.items(), key=lambda kv: (-len(kv[1]), str(kv[0])))
    print(f"Duplicate groups: {len(items)}")
    print(f"Showing up to {max_groups} groups:\n")

    for i, (k, recs) in enumerate(items[:max_groups], start=1):
        recs_sorted = sorted(recs, key=lambda x: x["_id"])
        ids = [r["_id"] for r in recs_sorted]
        print(f"{i:02d}) {k!r}  (n={len(recs)})  ids={ids}")
        for r in recs_sorted[:max_rows_per_group]:
            print(f"    - dr_id={r['_id']}  first={r['first']!r}  last={r['last']!r}")
        if len(recs_sorted) > max_rows_per_group:
            print(f"    ... +{len(recs_sorted) - max_rows_per_group} more")
        print("")


# ---- conflict/mergeability helpers ----
def is_empty(v):
    if v is None:
        return True
    if isinstance(v, str):
        return len(v.strip()) == 0
    return False


def normalize_titleish(s: str) -> str:
    """
    Normalisiert "Dr.", "Dr. med.", Prof, PD etc. weg.
    Nutzt du für dr_title_raw UND dr_display_name (damit Dr vs Dr.med kein Konflikt ist).
    """
    if s is None:
        return ""
    s = str(s).strip().lower()
    s = re.sub(r"\bdr\.?\s*med\.?\b", "", s)
    s = re.sub(r"\bdr\.?\b", "", s)
    s = re.sub(r"\bprof\.?\b", "", s)
    s = re.sub(r"\bpriv\.?-?doz\.?\b", "", s)
    s = re.sub(r"[.,;:]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_url(u: str) -> str:
    """
    Akzeptiert Unterschiede wie:
    habets-aachen.com
    https://habets-aachen.com/
    http://www.habets-aachen.com
    => wird alles zu: habets-aachen.com
    (scheme/www/trailing slash raus)
    """
    if u is None:
        return ""
    u = str(u).strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    u = u.rstrip("/")
    u = re.sub(r"\s+", "", u)
    return u


def normalize_email(e: str) -> str:
    if e is None:
        return ""
    return str(e).strip().lower()


def normalize_value_for_compare(v, col_name: str = ""):
    """
    Ab jetzt: KEINE weichen Ausnahmen mehr.
    Wir vergleichen inhaltlich 1:1 (nur Whitespace kollabieren),
    damit Dr vs Dr.med, http vs https, www vs non-www etc. als Konflikt auftauchen.
    """
    if v is None:
        return None

    # Nicht-Strings (int/bool/etc.) unverändert vergleichen
    if not isinstance(v, str):
        return v

    s = v.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def get_all_columns(cnx):
    cur = cnx.cursor()
    cur.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
        ORDER BY ORDINAL_POSITION
        """,
        (TABLE,),
    )
    cols = [r[0] for r in cur.fetchall()]
    cur.close()
    return cols


def fetch_rows_by_ids(cnx, pk, ids, cols):
    placeholders = ", ".join(["%s"] * len(ids))
    col_sql = ", ".join(cols)
    q = f"SELECT {col_sql} FROM {TABLE} WHERE {pk} IN ({placeholders})"
    cur = cnx.cursor(dictionary=True)
    cur.execute(q, tuple(ids))
    rows = cur.fetchall()
    cur.close()
    return rows


# =========================
# MAIN
# =========================
def main():
    cnx = db_connect()
    try:
        pk = detect_pk_column(cnx)
        print(f"Detected PK column for {TABLE}: {pk}")

        rows = fetch_rows(cnx, pk)
        print(f"Fetched {len(rows)} rows from {TABLE}")

        # 1) EXACT dupes by (first,last)
        dupes_exact = group_duplicates(rows, key_fn=lambda r: (r["first"], r["last"]))
        export_csv(dupes_exact, OUT_EXACT)
        print_preview(dupes_exact, "EXACT duplicates by (dr_firstname, dr_lastname)")
        print(f"Wrote: {Path(OUT_EXACT).resolve()}")

        # 2) NORMALIZED dupes by (first,last)
        dupes_norm = group_duplicates(rows, key_fn=lambda r: (norm(r["first"]), norm(r["last"])))
        export_csv(dupes_norm, OUT_NORM)
        print_preview(dupes_norm, "NORMALIZED duplicates by (first,last) [trim/lower/remove dots/collapse spaces]")
        print(f"Wrote: {Path(OUT_NORM).resolve()}")

        total_exact = sum(len(v) for v in dupes_exact.values())
        total_norm  = sum(len(v) for v in dupes_norm.values())

        print("\nSummary:")
        print(f"  exact groups: {len(dupes_exact)}  rows-in-groups: {total_exact}")
        print(f"  norm  groups: {len(dupes_norm)}   rows-in-groups: {total_norm}")

        cols = get_all_columns(cnx)

        # Compare all except PK + names + timestamps
        exclude_cols = {""}

        # Notes grundsätzlich ignorieren (Konflikte + Fill egal)
        IGNORE_COLS = {"dr_id", "created_at", "updated_at"}
        compare_cols = [c for c in cols if c not in exclude_cols and c not in IGNORE_COLS]

        # =========================
        # OUTPUTS
        # =========================
        OUT_CONFLICTS_ALL = "dupes_conflicts.csv"  # kompatibel zu deinem bisherigen Output
        OUT_CONFLICTS_UNRESOLVED = "dupes_conflicts_unresolved.csv"  # NEW: nur echte Konflikte
        OUT_MERGEABLE = "dupes_mergeable_fill.csv"

        OUT_CONFLICT_STATS = "dupes_conflict_field_stats.csv"
        OUT_DETAILS_ALL = "dupes_conflict_details_all.csv"
        OUT_DETAILS_UNRESOLVED = "dupes_conflict_details_unresolved.csv"

        conflict_groups_all = 0
        conflict_groups_unresolved = 0
        mergeable_groups = 0

        field_conflict_count_unresolved = {c: 0 for c in compare_cols}
        detail_rows_all = 0
        detail_rows_unresolved = 0

        def clip_list(vals, maxlen=180):
            out = []
            for v in vals:
                s = str(v)
                if len(s) > maxlen:
                    s = s[: maxlen - 3] + "..."
                out.append(s)
            return " || ".join(out)

        # "Ausnahmen" die NICHT als echte Konflikte zählen sollen:
        # - dr_display_name: Dr vs Dr. med etc. (durch normalize_titleish sowieso meist weg)
        # - dr_title_raw: dito
        # - dr_website: https/http/www/slash Unterschiede (durch normalize_url weg)
        #
        # Trotzdem loggen wir sie in DETAILS_ALL, aber sie zählen nicht als "unresolved conflict"
        ACCEPTABLE_CONFLICT_COLS = set()  # none, because we're focusing only on "real" fields now

        with open(OUT_CONFLICTS_ALL, "w", newline="", encoding="utf-8") as f_conf_all, \
             open(OUT_CONFLICTS_UNRESOLVED, "w", newline="", encoding="utf-8") as f_conf_un, \
             open(OUT_MERGEABLE, "w", newline="", encoding="utf-8") as f_merg, \
             open(OUT_CONFLICT_STATS, "w", newline="", encoding="utf-8") as f_stats, \
             open(OUT_DETAILS_ALL, "w", newline="", encoding="utf-8") as f_det_all, \
             open(OUT_DETAILS_UNRESOLVED, "w", newline="", encoding="utf-8") as f_det_un:

            w_conf_all = csv.writer(f_conf_all)
            w_conf_un  = csv.writer(f_conf_un)
            w_merg     = csv.writer(f_merg)
            w_stats    = csv.writer(f_stats)
            w_det_all  = csv.writer(f_det_all)
            w_det_un   = csv.writer(f_det_un)

            w_conf_all.writerow(["first","last","group_size","ids","conflict_fields_count","conflict_fields"])
            w_conf_un.writerow(["first","last","group_size","ids","unresolved_fields_count","unresolved_fields"])
            w_merg.writerow(["first","last","group_size","ids","fillable_fields_count","fillable_fields"])

            w_stats.writerow(["field","unresolved_conflict_groups_count"])

            w_det_all.writerow([
                "first","last","group_size","ids","field",
                "raw_distinct_non_empty_values",
                "normalized_distinct_non_empty_values",
                "acceptable_conflict"
            ])
            w_det_un.writerow([
                "first","last","group_size","ids","field",
                "raw_distinct_non_empty_values",
                "normalized_distinct_non_empty_values"
            ])

            for (first, last), recs in sorted(dupes_exact.items(), key=lambda kv: (-len(kv[1]), str(kv[0]))):
                ids = [r["_id"] for r in recs]
                rows_full = fetch_rows_by_ids(cnx, pk, ids, cols)
                ids_str = ",".join(str(int(i)) for i in sorted(ids))

                conflict_fields_all = []
                unresolved_fields = []
                fillable_fields = []

                for c in compare_cols:
                    raw_vals = []
                    norm_vals = []
                    empties = 0

                    for r in rows_full:
                        raw = r.get(c)
                        raw_s = raw if raw is None else str(raw).strip()
                        if is_empty(raw_s):
                            empties += 1
                            continue

                        raw_s = re.sub(r"\s+", " ", raw_s)
                        raw_vals.append(raw_s)

                        nv = normalize_value_for_compare(raw_s, c)
                        if not is_empty(nv):
                            norm_vals.append(nv)

                    raw_uniq = list(dict.fromkeys(raw_vals))
                    norm_uniq = list(dict.fromkeys(norm_vals))

                    # Konflikt-Entscheidung basiert auf NORMALIZED
                    if len(norm_uniq) >= 2:
                        conflict_fields_all.append(c)

                        acceptable = (c in ACCEPTABLE_CONFLICT_COLS)

                        # DETAILS_ALL immer schreiben
                        w_det_all.writerow([
                            first, last, len(ids), ids_str, c,
                            clip_list(raw_uniq),
                            clip_list(norm_uniq),
                            1 if acceptable else 0
                        ])
                        detail_rows_all += 1

                        # Nur wenn NICHT akzeptabel => unresolved
                        if not acceptable:
                            unresolved_fields.append(c)
                            w_det_un.writerow([
                                first, last, len(ids), ids_str, c,
                                clip_list(raw_uniq),
                                clip_list(norm_uniq),
                            ])
                            detail_rows_unresolved += 1

                    # mergeable fill: 1 Wert vorhanden + irgendwo leer
                    elif len(norm_uniq) == 1 and empties > 0:
                        fillable_fields.append(c)

                # groups outputs
                if conflict_fields_all:
                    conflict_groups_all += 1
                    w_conf_all.writerow([
                        first, last, len(ids), ids_str,
                        len(conflict_fields_all),
                        ";".join(conflict_fields_all)
                    ])

                if unresolved_fields:
                    conflict_groups_unresolved += 1
                    w_conf_un.writerow([
                        first, last, len(ids), ids_str,
                        len(unresolved_fields),
                        ";".join(unresolved_fields)
                    ])
                    for c in set(unresolved_fields):
                        if c in field_conflict_count_unresolved:
                            field_conflict_count_unresolved[c] += 1

                # clean mergeable groups (nur wenn KEINE unresolved conflicts)
                if fillable_fields and not unresolved_fields:
                    mergeable_groups += 1
                    w_merg.writerow([
                        first, last, len(ids), ids_str,
                        len(fillable_fields),
                        ";".join(fillable_fields)
                    ])

            # stats (nur unresolved)
            for c, cnt in sorted(field_conflict_count_unresolved.items(), key=lambda kv: (-kv[1], kv[0])):
                if cnt > 0:
                    w_stats.writerow([c, cnt])

        print("\nConflict/Mergeability analysis:")
        print(f"  fields compared (count={len(compare_cols)}): {compare_cols}")
        print(f"  conflicting groups (ALL): {conflict_groups_all} -> {Path(OUT_CONFLICTS_ALL).resolve()}")
        print(f"  conflicting groups (UNRESOLVED): {conflict_groups_unresolved} -> {Path(OUT_CONFLICTS_UNRESOLVED).resolve()}")
        print(f"  clean-mergeable groups (no unresolved conflicts): {mergeable_groups} -> {Path(OUT_MERGEABLE).resolve()}")

        print("\nConflict details outputs:")
        print(f"  wrote: {Path(OUT_DETAILS_ALL).resolve()} (rows={detail_rows_all})")
        print(f"  wrote: {Path(OUT_DETAILS_UNRESOLVED).resolve()} (rows={detail_rows_unresolved})")
        print(f"  wrote: {Path(OUT_CONFLICT_STATS).resolve()}")

    finally:
        cnx.close()


if __name__ == "__main__":
    try:
        main()
    except mysql.connector.Error as e:
        print("MySQL error:", e)
        sys.exit(1)
    except Exception as e:
        print("Error:", e)
        sys.exit(1)
