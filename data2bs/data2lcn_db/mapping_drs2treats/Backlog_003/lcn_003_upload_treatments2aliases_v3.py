
#!/usr/bin/env python3
import argparse, csv, os, sys, re, unicodedata
from typing import Dict, Tuple, Optional, List, Set
import pandas as pd

from pathlib import Path

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py" ).is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

try:
    import mysql.connector
except Exception:
    mysql = None

def eprint(*args): print(*args, file=sys.stderr)

def load_env(env_path: str) -> Dict[str, str]:
    env = {}
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env nicht gefunden: {env_path}")
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line=line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k,v=line.split("=",1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def get_conn(env: Dict[str,str]):
    if mysql is None:
        raise RuntimeError("mysql-connector-python ist nicht installiert.")
    return mysql.connector.connect(
        host=env["LCN_DB_HOST"],
        port=int(env["LCN_DB_PORT"]),
        user=env["LCN_DB_USERNAME"],
        password=env["LCN_DB_PASSWORD"],
        database=env["LCN_DB_DATABASE"],
    )

def norm_text(s: Optional[str]) -> Optional[str]:
    if s is None or (isinstance(s,float) and pd.isna(s)): return None
    s = str(s).strip()
    if not s: return None
    s = s.lower()
    for k,v in {"ä":"ae","ö":"oe","ü":"ue","ß":"ss","+":" plus "}.items():
        s = s.replace(k,v)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None

def slugify(s: Optional[str]) -> Optional[str]:
    n = norm_text(s)
    return None if not n else re.sub(r"\s+", "-", n)

def build_treat_maps(df: pd.DataFrame) -> Dict[Tuple[str,str], Set[int]]:
    mp: Dict[Tuple[str,str], Set[int]] = {}
    cols = [c for c in ["slug","behandlung","treatment_name_normalized"] if c in df.columns]
    for _, r in df.iterrows():
        tid_raw = r.get("treat_id")
        if pd.isna(tid_raw): 
            continue
        tid = int(tid_raw)
        for c in cols:
            val = r.get(c)
            if pd.isna(val): 
                continue
            raw = str(val).strip()
            if not raw: 
                continue
            for key in [("raw", raw), ("norm", norm_text(raw)), ("slug", slugify(raw))]:
                if key[1]:
                    mp.setdefault(key, set()).add(tid)
    return mp

def resolve_treat_id(row: pd.Series, treat_maps: Dict[Tuple[str,str], Set[int]]) -> Tuple[Optional[int], str]:
    # 1) bereits im File
    t = row.get("treat_id")
    if pd.notna(t):
        try:
            return int(t), "from_input_treat_id"
        except Exception:
            pass

    candidates = [
        ("raw", str(row.get("slug")).strip() if pd.notna(row.get("slug")) else None),
        ("slug", str(row.get("slug")).strip() if pd.notna(row.get("slug")) else None),
        ("raw", str(row.get("behandlung")).strip() if pd.notna(row.get("behandlung")) else None),
        ("norm", norm_text(row.get("behandlung"))),
        ("slug", slugify(row.get("behandlung"))),
    ]
    for key in candidates:
        if not key[1]:
            continue
        vals = treat_maps.get(key)
        if vals and len(vals) == 1:
            return next(iter(vals)), f"{key[0]}:{key[1]}"
    return None, "no_treat_match"

def build_alias_map(df: pd.DataFrame) -> Dict[Tuple[str,str], int]:
    mp = {}
    for _, r in df.iterrows():
        aid = r.get("alias_id")
        if pd.isna(aid): 
            continue
        alias = str(r.get("alias")).strip() if pd.notna(r.get("alias")) else ""
        atype = str(r.get("alias_type")).strip() if pd.notna(r.get("alias_type")) else ""
        if alias and atype:
            mp[(alias, atype)] = int(aid)
    return mp

def read_existing_pairs(conn, table_name: str) -> Set[Tuple[int,int]]:
    cur = conn.cursor()
    cur.execute(f"SELECT treat_id, alias_id FROM {table_name}")
    rows = cur.fetchall()
    cur.close()
    return {(int(t), int(a)) for t,a in rows}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--env-file", default=str(lcn_env_path()))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--table-name", default="tbl_cpl_treatments2aliases_03")
    args = ap.parse_args()

    data_dir = args.data_dir
    cpl_path = os.path.join(data_dir, "003_tbl_cpl_treatments2aliases.with_treat_ids.csv")
    if not os.path.exists(cpl_path):
        cpl_path = os.path.join(data_dir, "003_tbl_cpl_treatments2aliases.csv")
    treat_ids_path = os.path.join(data_dir, "003_new_treatments_03.with_ids.csv")
    alias_ids_path = os.path.join(data_dir, "003_new_aliases_03.with_ids.csv")

    for p in [cpl_path, treat_ids_path, alias_ids_path]:
        if not os.path.exists(p):
            raise FileNotFoundError(f"CSV nicht gefunden: {p}")

    cpl = pd.read_csv(cpl_path)
    treat = pd.read_csv(treat_ids_path)
    aliases = pd.read_csv(alias_ids_path)

    treat_maps = build_treat_maps(treat)
    alias_map = build_alias_map(aliases)

    preview_rows, unresolved_rows, duplicate_rows = [], [], []
    seen_pairs: Set[Tuple[int,int]] = set()

    env = load_env(args.env_file)
    conn = get_conn(env)
    existing_pairs = read_existing_pairs(conn, args.table_name)

    for _, row in cpl.iterrows():
        base = row.to_dict()
        treat_id, treat_reason = resolve_treat_id(row, treat_maps)

        alias = str(row.get("alias")).strip() if pd.notna(row.get("alias")) else ""
        alias_type = str(row.get("alias_type")).strip() if pd.notna(row.get("alias_type")) else ""
        alias_id = alias_map.get((alias, alias_type))
        alias_reason = "from_alias_base" if alias_id is not None else "no_alias_match"

        base["resolved_treat_id"] = "" if treat_id is None else int(treat_id)
        base["resolved_alias_id"] = "" if alias_id is None else int(alias_id)
        base["treat_match_reason"] = treat_reason
        base["alias_match_reason"] = alias_reason

        if treat_id is None or alias_id is None:
            base["action"] = "unresolved"
            unresolved_rows.append(base)
            preview_rows.append(base)
            continue

        pair = (int(treat_id), int(alias_id))
        if pair in seen_pairs:
            base["action"] = "duplicate_in_input"
            duplicate_rows.append(base)
            preview_rows.append(base)
            continue
        seen_pairs.add(pair)

        if pair in existing_pairs:
            base["action"] = "skip_existing"
            preview_rows.append(base)
            continue

        base["action"] = "insert"
        preview_rows.append(base)

    preview = pd.DataFrame(preview_rows)
    unresolved = pd.DataFrame(unresolved_rows)
    duplicates = pd.DataFrame(duplicate_rows)

    preview_path = os.path.join(data_dir, "003_tbl_cpl_treatments2aliases.preview.csv")
    unresolved_path = os.path.join(data_dir, "003_tbl_cpl_treatments2aliases.unresolved.csv")
    duplicates_path = os.path.join(data_dir, "003_tbl_cpl_treatments2aliases.duplicates.csv")
    apply_log_path = os.path.join(data_dir, "003_tbl_cpl_treatments2aliases.apply_log.csv")

    preview.to_csv(preview_path, index=False)
    unresolved.to_csv(unresolved_path, index=False)
    duplicates.to_csv(duplicates_path, index=False)

    insert_rows = [r for r in preview_rows if r["action"] == "insert"]

    print("LCN 003 – Upload Treatment↔Alias")
    print("------------------------------------------------------------------------")
    print(f"Input-Zeilen gesamt                : {len(cpl)}")
    print(f"Aufgelöste Kandidaten             : {len(preview_rows) - len(unresolved_rows)}")
    print(f"Unresolved                        : {len(unresolved_rows)}")
    print(f"Interne Dubletten                 : {len(duplicate_rows)}")
    print(f"Bereits in DB vorhanden           : {sum(1 for r in preview_rows if r['action']=='skip_existing')}")
    print(f"Neue Inserts möglich              : {len(insert_rows)}")
    print(f"Preview                           : {preview_path}")
    print(f"Unresolved                        : {unresolved_path}")
    print(f"Duplicates                        : {duplicates_path}")
    print(f"Apply-Log                         : {apply_log_path}")

    if args.apply and insert_rows:
        cur = conn.cursor()
        applied = []
        sql = f"INSERT INTO {args.table_name} (treat_id, alias_id, sort_order, note) VALUES (%s, %s, %s, %s)"
        for r in insert_rows:
            sort_order = 0
            if pd.notna(r.get("sort_order")) and str(r.get("sort_order")).strip() != "":
                try:
                    sort_order = int(float(r["sort_order"]))
                except Exception:
                    sort_order = 0
            note = None
            if pd.notna(r.get("note")) and str(r.get("note")).strip() != "":
                note = str(r["note"])
            vals = (int(r["resolved_treat_id"]), int(r["resolved_alias_id"]), sort_order, note)
            cur.execute(sql, vals)
            applied.append({
                "treat_id": int(r["resolved_treat_id"]),
                "alias_id": int(r["resolved_alias_id"]),
                "sort_order": sort_order,
                "note": note or "",
                "status": "inserted",
            })
        conn.commit()
        cur.close()
        pd.DataFrame(applied).to_csv(apply_log_path, index=False)

    conn.close()

if __name__ == "__main__":
    main()
