import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

import mysql.connector
from dotenv import load_dotenv


# =========================
# CONFIG
# =========================
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".env"

TABLE = os.getenv("LCN_DRS_TABLE", "tbl_drs_02")
PK = "dr_id"

COL_FN = os.getenv("LCN_DRS_FIRSTNAME", "dr_firstname")
COL_LN = os.getenv("LCN_DRS_LASTNAME", "dr_lastname")

COL_TITLE = "dr_title_raw"
COL_DISPLAY = "dr_display_name"
COL_ORG = "dr_org_name"
COL_WEBSITE = "dr_website"
COL_TYPE = "dr_type"

# We explicitly skip flags & org conflicts for now (per your instruction)
SKIP_COLS = {"dr_accepts_gkv", "dr_accepts_pkv", "dr_org_name"}

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
    return mysql.connector.connect(host=host, port=port, user=user, password=pw, database=db, autocommit=False)


def is_empty(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


# --- Title normalization: Dr. med. -> Dr. | Prof. med. -> Prof. ---
def canonical_title(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None

    low = s.lower()

    # If contains "prof" => Prof. (covers Prof. Dr. med. etc.)
    if re.search(r"\bprof\b", low):
        return "Prof."

    # If contains "dr" => Dr. (covers Dr., Dr med, Dr. med., Dr. rer. nat. etc.)
    if re.search(r"\bdr\b", low):
        return "Dr."

    # otherwise keep NULL (no title shown)
    return None


def normalize_url(u: str | None) -> str:
    """Return canonical https://host/path without www and without trailing slash."""
    if u is None:
        return ""
    s = str(u).strip()
    if not s:
        return ""

    # add scheme for parsing
    if not re.match(r"^https?://", s, flags=re.I):
        s_parse = "https://" + s
    else:
        s_parse = s

    parts = urlsplit(s_parse)
    host = (parts.netloc or "").lower()
    host = re.sub(r"^www\.", "", host)

    path = parts.path or ""
    path = re.sub(r"/+$", "", path)

    if not host:
        return ""

    if path:
        return f"https://{host}{path}"
    return f"https://{host}"


def host_and_path(u_norm: str) -> tuple[str, str]:
    if not u_norm:
        return ("", "")
    parts = urlsplit(u_norm)  # already has scheme
    host = (parts.netloc or "").lower()
    path = parts.path or ""
    return host, path


def choose_nearer_root(urls: list[str]) -> str:
    """
    Pick variant closer to root among given canonicalized URLs.
    Rule: choose shortest path length. (Domain stays same if possible.)
    """
    urls = [u for u in urls if u]
    if not urls:
        return ""

    # group by host
    by_host = {}
    for u in urls:
        h, p = host_and_path(u)
        if not h:
            continue
        by_host.setdefault(h, []).append(u)

    if not by_host:
        return ""

    # If there are multiple hosts, that's usually a hard conflict.
    # But we still pick best by (shortest path, host name) deterministically.
    best_candidates = []
    for h, us in by_host.items():
        best_u = None
        best_len = 10**9
        for u in us:
            _, p = host_and_path(u)
            plen = len(p.strip("/"))
            if plen < best_len:
                best_len = plen
                best_u = u
        best_candidates.append((best_len, h, best_u))

    best_candidates.sort(key=lambda x: (x[0], x[1]))
    return best_candidates[0][2] or ""


def split_types(s: str) -> list[str]:
    if is_empty(s):
        return []
    raw = str(s)
    parts = re.split(r"[;,/|]+", raw)
    out = []
    seen = set()
    for p in parts:
        p = p.strip()
        if not p:
            continue
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def merge_types(values: list[str]) -> str | None:
    all_parts = []
    seen = set()
    for v in values:
        for p in split_types(v):
            key = p.lower()
            if key in seen:
                continue
            seen.add(key)
            all_parts.append(p)
    if not all_parts:
        return None
    return "; ".join(all_parts)


def build_display_name(title: str | None, first: str | None, last: str | None, org: str | None, fallback: str | None) -> str | None:
    f = (first or "").strip()
    l = (last or "").strip()
    o = (org or "").strip()

    if f or l:
        base = (f + " " + l).strip()
        if title:
            return f"{title} {base}".strip()
        return base or None

    if o:
        return o

    # fallback: keep whatever existed (avoid nuking unknown cases)
    fb = (fallback or "").strip()
    return fb if fb else None


def fetch_duplicate_groups(cnx):
    """
    Return list of groups: each group dict has {first,last,ids}
    Groups are based on EXACT first/last equality (like your script did).
    """
    cur = cnx.cursor(dictionary=True)
    cur.execute(f"""
        SELECT {COL_FN} AS first, {COL_LN} AS last, COUNT(*) AS n
        FROM {TABLE}
        GROUP BY {COL_FN}, {COL_LN}
        HAVING COUNT(*) > 1
        ORDER BY n DESC
    """)
    groups = cur.fetchall()
    cur.close()

    out = []
    cur = cnx.cursor(dictionary=True)
    for g in groups:
        cur.execute(f"""
            SELECT {PK} AS id
            FROM {TABLE}
            WHERE {COL_FN} = %s AND {COL_LN} = %s
            ORDER BY {PK}
        """, (g["first"], g["last"]))
        ids = [r["id"] for r in cur.fetchall()]
        out.append({"first": g["first"], "last": g["last"], "ids": ids})
    cur.close()
    return out


def fetch_rows_by_ids(cnx, ids: list[int]):
    placeholders = ", ".join(["%s"] * len(ids))
    cur = cnx.cursor(dictionary=True)
    cur.execute(f"""
        SELECT {PK}, {COL_FN}, {COL_LN}, {COL_TITLE}, {COL_DISPLAY}, {COL_ORG}, {COL_WEBSITE}, {COL_TYPE}
        FROM {TABLE}
        WHERE {PK} IN ({placeholders})
    """, tuple(ids))
    rows = cur.fetchall()
    cur.close()
    return rows


def update_rows(cnx, ids: list[int], new_title: str | None, new_display: str | None, new_website: str | None, new_type: str | None, dry_run: bool):
    sets = []
    params = []

    if new_title is not None:
        sets.append(f"{COL_TITLE} = %s")
        params.append(new_title)
    else:
        # explicit NULL (only when we actively set it)
        sets.append(f"{COL_TITLE} = NULL")

    if new_display is not None:
        sets.append(f"{COL_DISPLAY} = %s")
        params.append(new_display)
    else:
        sets.append(f"{COL_DISPLAY} = NULL")

    if new_website is not None:
        sets.append(f"{COL_WEBSITE} = %s")
        params.append(new_website)
    else:
        sets.append(f"{COL_WEBSITE} = NULL")

    if new_type is not None:
        sets.append(f"{COL_TYPE} = %s")
        params.append(new_type)
    else:
        sets.append(f"{COL_TYPE} = NULL")

    placeholders = ", ".join(["%s"] * len(ids))
    params.extend(ids)

    sql = f"UPDATE {TABLE} SET " + ", ".join(sets) + f" WHERE {PK} IN ({placeholders})"

    if dry_run:
        return 0, sql, params

    cur = cnx.cursor()
    cur.execute(sql, tuple(params))
    affected = cur.rowcount
    cur.close()
    return affected, sql, params


def main():
    load_env()

    dry_run = True
    csv_arg = None

    args = sys.argv[1:]
    if "--apply" in args:
        dry_run = False
        args.remove("--apply")
    if args:
        # optional: accept CSV path but we don't need it (we group from DB)
        csv_arg = args[0]

    print("DRY_RUN =", dry_run)
    if csv_arg:
        print("Note: CSV arg provided but grouping is done from DB:", csv_arg)

    cnx = db_connect()
    try:
        groups = fetch_duplicate_groups(cnx)
        print(f"Duplicate groups found: {len(groups)}")

        total_updated = 0
        touched_groups = 0

        for g in groups:
            ids = g["ids"]
            rows = fetch_rows_by_ids(cnx, ids)

            # --- 1) Title canonicalization per group ---
            # If any row has Dr/Prof variants, we canonicalize title for all rows *that currently have some title*.
            # If ALL rows have empty title, we keep it empty (no title shown).
            titles_raw = [r.get(COL_TITLE) for r in rows]
            titles_can = [canonical_title(t) for t in titles_raw if not is_empty(t)]

            # decide group canonical title:
            # prefer Prof if any Prof exists; else Dr if any Dr exists; else None
            group_title = None
            if any(t == "Prof." for t in titles_can):
                group_title = "Prof."
            elif any(t == "Dr." for t in titles_can):
                group_title = "Dr."
            else:
                group_title = None  # no title

            # --- 2) Website choose nearer-root among existing variants ---
            websites = []
            for r in rows:
                w = normalize_url(r.get(COL_WEBSITE))
                if w:
                    websites.append(w)
            group_website = choose_nearer_root(list(dict.fromkeys(websites))) if websites else None

            # --- 3) dr_type merge ---
            types = [r.get(COL_TYPE) for r in rows if not is_empty(r.get(COL_TYPE))]
            group_type = merge_types(types) if types else None

            # --- 4) Display name rebuild ---
            # We build a consistent display name for the group
            # (use first/last from the DB rows; they should be identical in the group).
            first = rows[0].get(COL_FN)
            last  = rows[0].get(COL_LN)
            # if org exists and names empty, we’ll use it.
            org = rows[0].get(COL_ORG)

            # keep old display as fallback if neither person nor org exists
            fallback = rows[0].get(COL_DISPLAY)
            group_display = build_display_name(group_title, first, last, org, fallback)

            # Determine if any changes are needed (simple check)
            need = False
            for r in rows:
                # title compare: canonical vs current-canonical
                cur_title = canonical_title(r.get(COL_TITLE)) if not is_empty(r.get(COL_TITLE)) else None
                if cur_title != group_title:
                    need = True
                    break
                # display compare:
                if (r.get(COL_DISPLAY) or None) != group_display:
                    need = True
                    break
                # website compare (canonicalized)
                cur_web = normalize_url(r.get(COL_WEBSITE)) if not is_empty(r.get(COL_WEBSITE)) else None
                if (cur_web or None) != (group_website or None):
                    need = True
                    break
                # type compare (normalized join)
                if (r.get(COL_TYPE) or None) != (group_type or None):
                    need = True
                    break

            if not need:
                continue

            touched_groups += 1
            affected, sql, params = update_rows(
                cnx, ids,
                new_title=group_title,
                new_display=group_display,
                new_website=group_website,
                new_type=group_type,
                dry_run=dry_run
            )

            if dry_run:
                print(f"[DRY] {g['first']} {g['last']} ids={ids} -> title={group_title!r}, website={group_website!r}, type={group_type!r}, display={group_display!r}")
            else:
                total_updated += affected
                print(f"[OK ] {g['first']} {g['last']} ids={ids} updated_rows={affected}")

        if dry_run:
            cnx.rollback()
            print("\nDRY_RUN rollback ✅")
            print(f"Groups that would be updated: {touched_groups}")
        else:
            cnx.commit()
            print("\nCommitted ✅")
            print(f"Groups updated: {touched_groups}")
            print(f"Rows updated:   {total_updated}")

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
