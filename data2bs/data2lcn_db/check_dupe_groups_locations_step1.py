import os
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


# =========================
# CONFIG
# =========================
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".env"

TABLE_DRS = os.getenv("LCN_DRS_TABLE", "tbl_drs_02")
COL_FN = os.getenv("LCN_DRS_FIRSTNAME", "dr_firstname")
COL_LN = os.getenv("LCN_DRS_LASTNAME", "dr_lastname")
COL_DRS_ID = "dr_id"

TABLE_LOC = "tbl_drs_locations_02"

OUT_GROUPS_STEP1 = SCRIPT_DIR / "dupes_groups_location_counts.csv"
OUT_GROUPS_SUMMARY = SCRIPT_DIR / "dupes_location_group_summary.csv"
OUT_GROUPS_DETAILS = SCRIPT_DIR / "dupes_location_group_details.csv"
OUT_SOFT_DIFFS = SCRIPT_DIR / "dupes_location_soft_diffs.csv"
OUT_HARD_DIFFS = SCRIPT_DIR / "dupes_location_hard_diffs.csv"
OUT_FIELD_STATS = SCRIPT_DIR / "dupes_location_field_diff_stats.csv"


# =========================
# Helpers
# =========================
def load_env():
    loaded = load_dotenv(ENV_PATH)
    if not loaded:
        raise RuntimeError(f"Could not load .env next to script: {ENV_PATH}")

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

def is_empty(v):
    if v is None:
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    return False

def clean(v):
    """Hard normalize for key building: trim + collapse whitespace (NO tolerance beyond that)."""
    if v is None:
        return ""
    s = str(v).strip()
    s = re.sub(r"\s+", " ", s)
    return s
def address_key_raw(loc: dict) -> str:
    parts = [
        clean(loc.get("loc_country")),
        clean(loc.get("loc_plz")),
        clean(loc.get("loc_city")),
        clean(loc.get("loc_street")),
        clean(loc.get("loc_housenumber")),
    ]
    return "|".join(parts)

def full_key_raw(loc: dict) -> str:
    parts = [
        clean(loc.get("loc_label")),
        clean(loc.get("loc_is_primary")),
        clean(loc.get("loc_country")),
        clean(loc.get("loc_plz")),
        clean(loc.get("loc_city")),
        clean(loc.get("loc_street")),
        clean(loc.get("loc_housenumber")),
        clean(loc.get("loc_phone")),
        clean(loc.get("loc_email")),
        clean(loc.get("loc_website")),
        clean(loc.get("loc_lat")),
        clean(loc.get("loc_lng")),
    ]
    return "|".join(parts)

def address_key_norm(loc: dict) -> str:
    parts = [
        clean_soft("loc_country", loc.get("loc_country")),
        clean_soft("loc_plz", loc.get("loc_plz")),
        clean_soft("loc_city", loc.get("loc_city")),
        clean_soft("loc_street", loc.get("loc_street")),
        clean_soft("loc_housenumber", loc.get("loc_housenumber")),
    ]
    return "|".join(parts)

def full_key_norm(loc: dict) -> str:
    parts = [
        clean_soft("loc_label", loc.get("loc_label")),
        clean_soft("loc_is_primary", loc.get("loc_is_primary")),
        clean_soft("loc_country", loc.get("loc_country")),
        clean_soft("loc_plz", loc.get("loc_plz")),
        clean_soft("loc_city", loc.get("loc_city")),
        clean_soft("loc_street", loc.get("loc_street")),
        clean_soft("loc_housenumber", loc.get("loc_housenumber")),
        clean_soft("loc_phone", loc.get("loc_phone")),
        clean_soft("loc_email", loc.get("loc_email")),
        clean_soft("loc_website", loc.get("loc_website")),
        clean_soft("loc_lat", loc.get("loc_lat")),
        clean_soft("loc_lng", loc.get("loc_lng")),
    ]
    return "|".join(parts)

def fetch_dupe_groups_exact(cnx):
    """
    EXACT duplicates by (dr_firstname, dr_lastname).
    Returns dict: (first,last) -> list[dr_id]
    """
    cur = cnx.cursor(dictionary=True)
    cur.execute(f"""
        SELECT {COL_DRS_ID} AS dr_id, {COL_FN} AS first, {COL_LN} AS last
        FROM {TABLE_DRS}
        ORDER BY {COL_DRS_ID} ASC
    """)
    rows = cur.fetchall()
    cur.close()

    groups = defaultdict(list)
    for r in rows:
        first = r.get("first")
        last = r.get("last")
        groups[(first, last)].append(int(r["dr_id"]))

    # only duplicates
    return {k: v for k, v in groups.items() if len(v) > 1}

def fetch_locations_for_dr_ids(cnx, dr_ids):
    """
    Returns: dict dr_id -> list[loc_row_dict]
    """
    if not dr_ids:
        return {}

    placeholders = ", ".join(["%s"] * len(dr_ids))
    q = f"""
        SELECT
            loc_id,
            dr_id,
            loc_label,
            loc_is_primary,
            loc_country,
            loc_plz,
            loc_city,
            loc_street,
            loc_housenumber,
            loc_phone,
            loc_email,
            loc_website,
            loc_lat,
            loc_lng,
            created_at
        FROM {TABLE_LOC}
        WHERE dr_id IN ({placeholders})
        ORDER BY dr_id ASC, loc_id ASC
    """
    cur = cnx.cursor(dictionary=True)
    cur.execute(q, tuple(dr_ids))
    rows = cur.fetchall()
    cur.close()

    out = defaultdict(list)
    for r in rows:
        out[int(r["dr_id"])].append(r)
    return dict(out)

NULL_LIKE = {"", " ", "null", "NULL", "-", "—"}

def to_null(v):
    if v is None:
        return None
    s = str(v).strip()
    if s in NULL_LIKE:
        return None
    s = re.sub(r"\s+", " ", s)
    return s

def norm_email(v):
    s = to_null(v)
    return s.lower() if s else None

def norm_phone(v):
    s = to_null(v)
    if not s:
        return None
    # nur Trenner entfernen, keine Deutung
    s = s.replace(" ", "").replace("-", "").replace("/", "").replace("(", "").replace(")", "")
    s = re.sub(r"[^\d+]", "", s)
    return s or None

def norm_website(v):
    s = to_null(v)
    if not s:
        return None
    s = s.replace(" ", "")
    # scheme ergänzen, falls fehlt
    if not re.match(r"^https?://", s, flags=re.I):
        s = "https://" + s
    # trailing slash weg (aber Pfad behalten!)
    s = re.sub(r"/+$", "", s)
    return s

def norm_street(v):
    s = to_null(v)
    if not s:
        return None
    s = re.sub(r"[.,]+$", "", s)    # trailing punctuation
    s = re.sub(r"\s+", " ", s).strip()

    low = s.lower()

    # nur sichere Tokens ersetzen: "str." / "str" / "strasse" -> "straße"
    # (nicht aggressiv "Musterstr." anfassen)
    low = re.sub(r"\bstr\.?\b", "straße", low)
    low = re.sub(r"\bstrasse\b", "straße", low)

    return low

def norm_generic(v):
    return to_null(v)

def norm_value(field, v):
    f = field.lower()
    if "email" in f:
        return norm_email(v)
    if "phone" in f:
        return norm_phone(v)
    if "website" in f or "url" in f:
        return norm_website(v)
    if "street" in f:
        return norm_street(v)
    # alles andere nur NULL/Whitespace normalisieren
    return norm_generic(v)

def clean_soft(field, v):
    """Für Key-Building: None -> '' und strings normalisiert."""
    nv = norm_value(field, v)
    if nv is None:
        return ""
    s = str(nv).strip()
    s = re.sub(r"\s+", " ", s)
    return s

def main():
    load_env()
    cnx = db_connect()
    try:
        dupes = fetch_dupe_groups_exact(cnx)
        print(f"Duplicate groups found (EXACT first+last): {len(dupes)}")

        # Step 1: count total location rows per group (over all dr_ids)
        groups_with_multi_loc = []  # list of tuples: (first,last,ids,total_loc_rows)
        for (first, last), ids in dupes.items():
            loc_map = fetch_locations_for_dr_ids(cnx, ids)
            total = sum(len(v) for v in loc_map.values())
            if total > 1:
                groups_with_multi_loc.append((first, last, ids, total))

        groups_with_multi_loc.sort(key=lambda x: (-x[3], str(x[0]), str(x[1])))

        # Write Step1 output (compatible with your earlier info)
        with open(OUT_GROUPS_STEP1, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["first","last","group_size","ids","total_location_rows"])
            for first, last, ids, total in groups_with_multi_loc:
                w.writerow([first, last, len(ids), ",".join(map(str, ids)), total])

        print(f"\nDone Step1 ✅")
        print(f"Groups with >1 location row in total: {len(groups_with_multi_loc)}")
        print(f"Wrote: {OUT_GROUPS_STEP1}")

        # Step 2: analyze uniqueness of locations for these groups
        field_soft_hits = defaultdict(int)
        field_hard_hits = defaultdict(int)

        with open(OUT_GROUPS_SUMMARY, "w", newline="", encoding="utf-8") as f_sum, \
                open(OUT_GROUPS_DETAILS, "w", newline="", encoding="utf-8") as f_det, \
                open(OUT_SOFT_DIFFS, "w", newline="", encoding="utf-8") as f_soft, \
                open(OUT_HARD_DIFFS, "w", newline="", encoding="utf-8") as f_hard:

            w_sum = csv.writer(f_sum)
            w_det = csv.writer(f_det)
            w_soft = csv.writer(f_soft)
            w_hard = csv.writer(f_hard)

            w_sum.writerow([
                "first", "last", "group_size", "ids",
                "total_location_rows",
                "distinct_full_raw",
                "distinct_full_norm",
                "distinct_address_raw",
                "distinct_address_norm",
                "classification"  # SOFT_ONLY / HARD_DIFF / ALREADY_IDENTICAL
            ])

            w_det.writerow([
                "first", "last", "group_size", "ids",
                "dr_id", "loc_id",
                "address_key_raw", "address_key_norm",
                "full_key_raw", "full_key_norm",
                "loc_label", "loc_is_primary", "loc_country", "loc_plz", "loc_city", "loc_street", "loc_housenumber",
                "loc_phone", "loc_email", "loc_website", "loc_lat", "loc_lng", "created_at"
            ])

            w_soft.writerow([
                "first", "last", "group_size", "ids",
                "total_location_rows",
                "distinct_full_raw", "distinct_full_norm",
                "example_loc_ids_raw",
                "soft_fields_detected"
            ])

            w_hard.writerow([
                "first", "last", "group_size", "ids",
                "total_location_rows",
                "distinct_full_norm",
                "example_loc_ids_norm",
                "hard_fields_detected"
            ])

            # helper: detect which fields differ within a group (raw vs norm)
            FIELDS = [
                "loc_label", "loc_is_primary", "loc_country", "loc_plz", "loc_city", "loc_street", "loc_housenumber",
                "loc_phone", "loc_email", "loc_website", "loc_lat", "loc_lng"
            ]

            for first, last, ids, total in groups_with_multi_loc:
                loc_map = fetch_locations_for_dr_ids(cnx, ids)

                full_raw = set()
                full_norm = set()
                addr_raw = set()
                addr_norm = set()

                # for field diff detection
                raw_values = {f: set() for f in FIELDS}
                norm_values = {f: set() for f in FIELDS}

                # collect loc_ids per key for examples
                loc_ids_by_full_raw = defaultdict(list)
                loc_ids_by_full_norm = defaultdict(list)

                for dr_id in ids:
                    for loc in loc_map.get(dr_id, []):
                        akr = address_key_raw(loc)
                        akn = address_key_norm(loc)
                        fkr = full_key_raw(loc)
                        fkn = full_key_norm(loc)

                        addr_raw.add(akr)
                        addr_norm.add(akn)
                        full_raw.add(fkr)
                        full_norm.add(fkn)

                        loc_ids_by_full_raw[fkr].append(int(loc["loc_id"]))
                        loc_ids_by_full_norm[fkn].append(int(loc["loc_id"]))

                        for f in FIELDS:
                            rv = to_null(loc.get(f))
                            nv = norm_value(f, loc.get(f))
                            if rv is not None:
                                raw_values[f].add(str(rv))
                            if nv is not None:
                                norm_values[f].add(str(nv))

                        w_det.writerow([
                            first, last, len(ids), ",".join(map(str, ids)),
                            dr_id, loc.get("loc_id"),
                            akr, akn,
                            fkr, fkn,
                            loc.get("loc_label"),
                            loc.get("loc_is_primary"),
                            loc.get("loc_country"),
                            loc.get("loc_plz"),
                            loc.get("loc_city"),
                            loc.get("loc_street"),
                            loc.get("loc_housenumber"),
                            loc.get("loc_phone"),
                            loc.get("loc_email"),
                            loc.get("loc_website"),
                            loc.get("loc_lat"),
                            loc.get("loc_lng"),
                            loc.get("created_at"),
                        ])

                distinct_full_raw = len(full_raw)
                distinct_full_norm = len(full_norm)
                distinct_addr_raw = len(addr_raw)
                distinct_addr_norm = len(addr_norm)

                # classify
                if distinct_full_raw == 1:
                    classification = "ALREADY_IDENTICAL"
                elif distinct_full_norm == 1:
                    classification = "SOFT_ONLY"
                else:
                    classification = "HARD_DIFF"

                w_sum.writerow([
                    first, last, len(ids), ",".join(map(str, ids)),
                    total,
                    distinct_full_raw,
                    distinct_full_norm,
                    distinct_addr_raw,
                    distinct_addr_norm,
                    classification
                ])

                # detect which fields differ (raw/norm)
                soft_fields = []
                hard_fields = []
                for f in FIELDS:
                    rset = raw_values[f]
                    nset = norm_values[f]
                    if len(rset) >= 2 and len(nset) == 1:
                        soft_fields.append(f)
                        field_soft_hits[f] += 1
                    elif len(nset) >= 2:
                        hard_fields.append(f)
                        field_hard_hits[f] += 1

                if classification == "SOFT_ONLY":
                    # pick a few example loc_ids (raw keys) to inspect
                    ex = []
                    for k, ids_list in list(loc_ids_by_full_raw.items())[:3]:
                        ex.append(",".join(map(str, sorted(set(ids_list))[:5])))
                    w_soft.writerow([
                        first, last, len(ids), ",".join(map(str, ids)),
                        total,
                        distinct_full_raw, distinct_full_norm,
                        " | ".join(ex),
                        ";".join(soft_fields)
                    ])

                if classification == "HARD_DIFF":
                    ex = []
                    for k, ids_list in list(loc_ids_by_full_norm.items())[:3]:
                        ex.append(",".join(map(str, sorted(set(ids_list))[:5])))
                    w_hard.writerow([
                        first, last, len(ids), ",".join(map(str, ids)),
                        total,
                        distinct_full_norm,
                        " | ".join(ex),
                        ";".join(hard_fields)
                    ])

        # field stats output
        with open(OUT_FIELD_STATS, "w", newline="", encoding="utf-8") as f_stats:
            w = csv.writer(f_stats)
            w.writerow(["field", "soft_groups_count", "hard_groups_count"])
            fields_all = sorted(set(list(field_soft_hits.keys()) + list(field_hard_hits.keys())))
            for f in fields_all:
                w.writerow([f, field_soft_hits.get(f, 0), field_hard_hits.get(f, 0)])

        print(f"\nDone Step2 ✅")
        print(f"Wrote: {OUT_GROUPS_SUMMARY}")
        print(f"Wrote: {OUT_GROUPS_DETAILS}")
        print(f"Wrote: {OUT_SOFT_DIFFS}")
        print(f"Wrote: {OUT_HARD_DIFFS}")
        print(f"Wrote: {OUT_FIELD_STATS}")

        cnx.rollback()  # read-only
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
