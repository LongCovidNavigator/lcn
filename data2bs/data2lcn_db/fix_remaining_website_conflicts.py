import os
import re
import sys
import csv
from pathlib import Path
from lcn_env import lcn_env_path
from urllib.parse import urlsplit

import mysql.connector
from dotenv import load_dotenv


# =========================
# CONFIG
# =========================
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = lcn_env_path()

# Default if no CLI arg given
DEFAULT_CSV = r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\dupes_conflict_details_all.csv"

INVALID_DOMAINS = {"lungenmvz-weissensee.de"}  # explicitly invalid per your note

# location heuristics
LOCATION_TABLE_HINTS = ["loc", "location"]
LOCATION_WEBSITE_COL_CANDIDATES = ["loc_website", "location_website", "website", "web", "url"]
LOCATION_FK_COL_CANDIDATES = ["dr_id", "doctor_id"]


# =========================
# ENV + DB
# =========================
def load_env():
    loaded = load_dotenv(ENV_PATH)
    if not loaded:
        raise RuntimeError(f"Could not load central LCN env file: {ENV_PATH}")


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


# =========================
# URL normalization
# =========================
def normalize_url(u: str) -> str:
    """Normalize scheme/http/https/www/trailing slash, keep host+path."""
    if u is None:
        return ""
    u = str(u).strip()
    if not u:
        return ""
    u = u.replace(" ", "")

    if not re.match(r"^https?://", u, flags=re.I):
        u_parse = "https://" + u
    else:
        u_parse = u

    parts = urlsplit(u_parse)
    host = (parts.netloc or "").lower()
    host = re.sub(r"^www\.", "", host)
    path = parts.path or ""
    path = re.sub(r"/+$", "", path)
    return host + path


def url_host(u: str) -> str:
    n = normalize_url(u)
    if not n:
        return ""
    parts = urlsplit("https://" + n)
    return (parts.netloc or "").lower()


def url_path(u: str) -> str:
    n = normalize_url(u)
    if not n:
        return ""
    parts = urlsplit("https://" + n)
    return parts.path or ""


def choose_canonical_url(urls: list[str]) -> str:
    """
    Your rule: prefer URL "closer to domain" => shortest path.
    Ignore scheme/http/https/www differences.
    Output always https://...
    """
    cleaned = []
    for u in urls:
        if u is None:
            continue
        s = str(u).strip()
        if not s:
            continue
        cleaned.append(s)

    # filter invalid domains
    filtered = []
    for u in cleaned:
        h = url_host(u)
        if h and h in INVALID_DOMAINS:
            continue
        filtered.append(u)

    if not filtered:
        return ""

    # group by host
    by_host = {}
    for u in filtered:
        h = url_host(u)
        if not h:
            continue
        by_host.setdefault(h, []).append(u)

    if not by_host:
        return ""

    host_best = []
    for h, us in by_host.items():
        best = None
        best_len = 10**9
        for u in us:
            p = url_path(u).strip("/")
            plen = len(p)  # shortest path wins
            if plen < best_len:
                best = u
                best_len = plen
        host_best.append((h, best, best_len))

    host_best.sort(key=lambda x: (x[2], x[0]))

    h, best_u, _ = host_best[0]
    p = url_path(best_u).strip("/")
    if p:
        return f"https://{h}/{p}"
    return f"https://{h}"


# =========================
# CSV parsing
# =========================
def parse_values_cell(cell: str) -> list[str]:
    """Supports 'a || b || c' OR 'a||b||c'."""
    if cell is None:
        return []
    s = str(cell).strip()
    if not s:
        return []
    parts = [p.strip() for p in s.split("||")]
    return [p for p in parts if p]


def read_csv_rows(path: str) -> tuple[list[str], list[dict]]:
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        cols = [c.strip() for c in (r.fieldnames or [])]
        rows = list(r)
    return cols, rows


# =========================
# Location detection + updates
# =========================
def detect_location_table_and_cols(cnx):
    """
    Find a location-ish table that has (dr_id/doctor_id) + (website/url/web col).
    Returns (table, fk_col, website_col) or (None,None,None).
    """
    cur = cnx.cursor(dictionary=True)
    cur.execute("""
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
    """)
    rows = cur.fetchall()
    cur.close()

    tcols = {}
    for r in rows:
        tcols.setdefault(r["TABLE_NAME"], set()).add(r["COLUMN_NAME"].lower())

    candidates = []
    for t, cols in tcols.items():
        t_low = t.lower()
        if not any(h in t_low for h in LOCATION_TABLE_HINTS):
            continue

        fk = None
        for c in LOCATION_FK_COL_CANDIDATES:
            if c.lower() in cols:
                fk = c
                break

        web = None
        for c in LOCATION_WEBSITE_COL_CANDIDATES:
            if c.lower() in cols:
                web = c
                break

        if fk and web:
            candidates.append((t, fk, web))

    candidates.sort(key=lambda x: (0 if "loc" in x[0].lower() else 1, x[0].lower()))
    if candidates:
        return candidates[0]
    return (None, None, None)


def update_doctor_website(cnx, table_drs: str, dr_ids: list[int], canonical_url: str) -> int:
    if not dr_ids or not canonical_url:
        return 0
    placeholders = ", ".join(["%s"] * len(dr_ids))
    q = f"""
        UPDATE {table_drs}
        SET dr_website = %s
        WHERE dr_id IN ({placeholders})
    """
    cur = cnx.cursor()
    cur.execute(q, (canonical_url, *dr_ids))
    affected = cur.rowcount
    cur.close()
    return affected


def update_location_website_for_doctors(cnx, loc_table: str, fk_col: str, web_col: str, dr_ids: list[int], canonical_url: str) -> int:
    if not loc_table or not fk_col or not web_col:
        return 0
    if not dr_ids or not canonical_url:
        return 0

    placeholders = ", ".join(["%s"] * len(dr_ids))
    q = f"""
        UPDATE {loc_table}
        SET {web_col} = %s
        WHERE {fk_col} IN ({placeholders})
    """
    cur = cnx.cursor()
    cur.execute(q, (canonical_url, *dr_ids))
    affected = cur.rowcount
    cur.close()
    return affected


# =========================
# DB fetch for websites (for dupes_conflicts.csv case)
# =========================
def fetch_distinct_websites_for_ids(cnx, table_drs: str, dr_ids: list[int]) -> list[str]:
    if not dr_ids:
        return []
    placeholders = ", ".join(["%s"] * len(dr_ids))
    q = f"""
        SELECT dr_website
        FROM {table_drs}
        WHERE dr_id IN ({placeholders})
    """
    cur = cnx.cursor()
    cur.execute(q, tuple(dr_ids))
    vals = []
    for (v,) in cur.fetchall():
        if v is None:
            continue
        s = str(v).strip()
        if s:
            vals.append(s)
    cur.close()
    # distinct, stable
    uniq = list(dict.fromkeys(vals))
    return uniq


# =========================
# MAIN
# =========================
def main():
    load_env()
    table_drs = os.getenv("LCN_DRS_TABLE", "tbl_drs_02")

    csv_path = DEFAULT_CSV
    if len(sys.argv) >= 2 and sys.argv[1].strip():
        csv_path = sys.argv[1].strip()

    print(f"Using CSV: {csv_path}")

    cols, rows = read_csv_rows(csv_path)
    cols_set = set([c.lower() for c in cols])

    # Two supported formats:
    # A) conflict details: has "field" + "raw_distinct_non_empty_values"
    is_details = ("field" in cols_set) and ("raw_distinct_non_empty_values" in cols_set)
    # B) conflicts summary: has "conflict_fields"
    is_conflicts = ("conflict_fields" in cols_set)

    if not (is_details or is_conflicts):
        raise RuntimeError(
            "CSV format not recognized. Need either:\n"
            "- dupes_conflict_details*.csv with columns: field, raw_distinct_non_empty_values\n"
            "OR\n"
            "- dupes_conflicts.csv with column: conflict_fields"
        )

    cnx = db_connect()
    try:
        loc_table, loc_fk, loc_web = detect_location_table_and_cols(cnx)
        if loc_table:
            print(f"Detected location table: {loc_table} (fk={loc_fk}, web_col={loc_web})")
        else:
            print("No location table auto-detected. Location update will be skipped.")

        total_doc_updates = 0
        total_loc_updates = 0
        handled_groups = 0

        if is_details:
            # Use details rows directly
            website_rows = [r for r in rows if str(r.get("field", "")).strip().lower() == "dr_website"]
            if not website_rows:
                print("No website conflicts found in DETAILS CSV. Nothing to do.")
                return

            for row in website_rows:
                first = str(row.get("first", "")).strip()
                last  = str(row.get("last", "")).strip()
                ids_str = str(row.get("ids", "")).strip()

                dr_ids = []
                for x in ids_str.split(","):
                    x = x.strip()
                    if x.isdigit():
                        dr_ids.append(int(x))

                raw_values = parse_values_cell(row.get("raw_distinct_non_empty_values", ""))

                # SPECIAL CASE: Stingl (doctor vs practice location)
                if (first.lower(), last.lower()) == ("michael", "stingl"):
                    doc_url = "https://www.neurostingl.at"
                    loc_url = "https://www.cereprax.at"

                    doc_aff = update_doctor_website(cnx, table_drs, dr_ids, doc_url)
                    loc_aff = 0
                    if loc_table:
                        loc_aff = update_location_website_for_doctors(cnx, loc_table, loc_fk, loc_web, dr_ids, loc_url)

                    total_doc_updates += doc_aff
                    total_loc_updates += loc_aff
                    handled_groups += 1
                    print(f"[Stingl] dr_ids={dr_ids} -> dr_website={doc_url} | location.website={loc_url} (doc={doc_aff}, loc={loc_aff})")
                    continue

                canonical = choose_canonical_url(raw_values)
                if not canonical:
                    print(f"[SKIP] {first} {last}: could not pick canonical from values: {raw_values}")
                    continue

                aff = update_doctor_website(cnx, table_drs, dr_ids, canonical)
                total_doc_updates += aff
                handled_groups += 1
                print(f"[{first} {last}] dr_ids={dr_ids} -> dr_website={canonical} (rows={aff})")

        else:
            # is_conflicts: derive website groups, fetch websites from DB, then canonicalize
            website_groups = []
            for row in rows:
                cf = str(row.get("conflict_fields", "")).strip().lower()
                # conflict_fields is e.g. "dr_website;dr_email"
                fields = [f.strip() for f in cf.split(";") if f.strip()]
                if "dr_website" not in fields:
                    continue
                website_groups.append(row)

            if not website_groups:
                print("No website conflicts found in CONFLICTS CSV. Nothing to do.")
                return

            for row in website_groups:
                first = str(row.get("first", "")).strip()
                last  = str(row.get("last", "")).strip()
                ids_str = str(row.get("ids", "")).strip()

                dr_ids = []
                for x in ids_str.split(","):
                    x = x.strip()
                    if x.isdigit():
                        dr_ids.append(int(x))

                # SPECIAL CASE: Stingl
                if (first.lower(), last.lower()) == ("michael", "stingl"):
                    doc_url = "https://www.neurostingl.at"
                    loc_url = "https://www.cereprax.at"

                    doc_aff = update_doctor_website(cnx, table_drs, dr_ids, doc_url)
                    loc_aff = 0
                    if loc_table:
                        loc_aff = update_location_website_for_doctors(cnx, loc_table, loc_fk, loc_web, dr_ids, loc_url)

                    total_doc_updates += doc_aff
                    total_loc_updates += loc_aff
                    handled_groups += 1
                    print(f"[Stingl] dr_ids={dr_ids} -> dr_website={doc_url} | location.website={loc_url} (doc={doc_aff}, loc={loc_aff})")
                    continue

                # Pull actual values from DB
                urls = fetch_distinct_websites_for_ids(cnx, table_drs, dr_ids)
                canonical = choose_canonical_url(urls)
                if not canonical:
                    print(f"[SKIP] {first} {last}: could not pick canonical from DB values: {urls}")
                    continue

                aff = update_doctor_website(cnx, table_drs, dr_ids, canonical)
                total_doc_updates += aff
                handled_groups += 1
                print(f"[{first} {last}] dr_ids={dr_ids} -> dr_website={canonical} (rows={aff})")

        cnx.commit()
        print("\nDone ✅")
        print(f"Groups handled:        {handled_groups}")
        print(f"Doctor rows updated:   {total_doc_updates}")
        print(f"Location rows updated: {total_loc_updates}")

    except Exception:
        cnx.rollback()
        raise
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
