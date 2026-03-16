#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LCN Cleanup Merge Providers (tbl_drs_02)

- Matches duplicates by:
  1) Website domain (dr_website + loc_website)  [normalized, path ignored]
  2) Email domain
  3) lastname + PLZ (primary location), conservative on firstname conflicts

- Canonical provider priority:
  covidhilfe > mecfsmed > fasynation > else lowest dr_id

- Dry-run by default (no DB writes)
- Apply mode updates:
  tbl_drs_sources_02 (handles duplicate key conflicts)
  tbl_drs_locations_02 (dedupe by signature)
  tbl_cpl_drs2terms_02 (dedupe)
  tbl_drs_votes_02 (sum)
  then deletes merged provider from tbl_drs_02

Produces:
  merge_report.json
  merge_report.csv
  merge_log.json (on apply)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from dotenv import load_dotenv

try:
    import mysql.connector
    from mysql.connector import Error as MySQLError
except Exception:
    print("ERROR: mysql-connector-python fehlt. Installiere in deiner venv:", file=sys.stderr)
    print(r"  C:\xampp\htdocs\lcn\data2bs\.venv\Scripts\python.exe -m pip install mysql-connector-python", file=sys.stderr)
    sys.exit(1)

# -------------------------
# ENV / PATHS
# -------------------------

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
if not ENV_PATH.exists():
    print(f"ERROR: .env nicht gefunden: {ENV_PATH}", file=sys.stderr)
    sys.exit(1)

load_dotenv(ENV_PATH)

def env(name: str, default: Optional[str] = None) -> str:
    v = os.getenv(name)
    if v is None or v.strip() == "":
        return default if default is not None else ""
    return v.strip()

DB_HOST = env("DB_HOST", "127.0.0.1")
DB_PORT = int(env("DB_PORT", "3306"))
DB_USER = env("DB_USER", "root")
DB_PASSWORD = env("DB_PASSWORD", "")
DB_NAME = env("DB_NAME", "lcn_database")

# -------------------------
# NORMALIZATION
# -------------------------

def norm_ws(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def url_to_domain(url: Optional[str]) -> str:
    u = norm_ws(url)
    if not u:
        return ""
    u = u.lstrip("\ufeff").strip()
    u = re.sub(r"^https?://", "", u, flags=re.I)
    # remove auth if any
    u = u.split("@")[-1]
    # keep host only
    host = u.split("/")[0].split("?")[0].split("#")[0].strip().lower()
    host = host.replace("www.", "")
    return host

def email_to_domain(email: Optional[str]) -> str:
    e = norm_ws(email).lower()
    if "@" not in e:
        return ""
    return e.split("@", 1)[1].strip()

BLOCKED_DOMAINS = {
    "covidhilfe.com",
    "mecfsmed.de",
    "fasynation.de",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "t.me",
}

def is_plausible_domain(dom: str) -> bool:
    dom = (dom or "").strip().lower()
    if not dom:
        return False
    if dom in BLOCKED_DOMAINS:
        return False
    # very short/invalid
    if "." not in dom:
        return False
    return True

def norm_name_key(s: Optional[str]) -> str:
    s = norm_ws(s).lower()
    if not s:
        return ""
    repl = {"ä":"a","ö":"o","ü":"u","ß":"ss"}
    for a,b in repl.items():
        s = s.replace(a,b)
    s = re.sub(r"[^a-z0-9 ]+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

# -------------------------
# DB
# -------------------------

class DB:
    def __init__(self) -> None:
        self.conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            autocommit=False,
        )

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    def q(self, sql: str, params: Tuple[Any, ...] = ()) -> List[Tuple[Any, ...]]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.close()
        return rows

    def q1(self, sql: str, params: Tuple[Any, ...] = ()) -> Optional[Tuple[Any, ...]]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        cur.close()
        return row

    def exec(self, sql: str, params: Tuple[Any, ...] = ()) -> int:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        last = cur.lastrowid
        cur.close()
        return last

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()

# -------------------------
# DATA MODEL
# -------------------------

@dataclass
class Provider:
    dr_id: int
    firstname: str
    lastname: str
    email: str
    dr_website: str
    primary_plz: str

@dataclass
class MergeCandidate:
    reason: str
    key: str
    members: List[int]  # dr_ids

# -------------------------
# LOAD CURRENT STATE
# -------------------------

def load_sources_map(db: DB) -> Dict[int, str]:
    rows = db.q("SELECT source_id, source_code FROM tbl_sources")
    return {int(sid): str(code) for sid, code in rows}

def load_provider_sources(db: DB, sources_map: Dict[int, str]) -> Dict[int, Set[str]]:
    rows = db.q("SELECT dr_id, source_id FROM tbl_drs_sources_02")
    out: Dict[int, Set[str]] = {}
    for dr_id, source_id in rows:
        out.setdefault(int(dr_id), set()).add(sources_map.get(int(source_id), f"sid:{source_id}"))
    return out

def load_providers(db: DB) -> Dict[int, Provider]:
    # primary PLZ from primary location
    rows = db.q(
        """
        SELECT d.dr_id,
               COALESCE(d.dr_firstname,''),
               COALESCE(d.dr_lastname,''),
               COALESCE(d.dr_email,''),
               COALESCE(d.dr_website,''),
               COALESCE(l.loc_plz,'')
        FROM tbl_drs_02 d
        LEFT JOIN tbl_drs_locations_02 l
          ON l.dr_id = d.dr_id AND l.loc_is_primary = 1
        """
    )
    out: Dict[int, Provider] = {}
    for dr_id, fn, ln, em, web, plz in rows:
        out[int(dr_id)] = Provider(
            dr_id=int(dr_id),
            firstname=str(fn or ""),
            lastname=str(ln or ""),
            email=str(em or ""),
            dr_website=str(web or ""),
            primary_plz=str(plz or ""),
        )
    return out

def load_location_websites(db: DB) -> Dict[int, Set[str]]:
    rows = db.q(
        """
        SELECT dr_id, COALESCE(loc_website,'')
        FROM tbl_drs_locations_02
        WHERE loc_website IS NOT NULL AND loc_website <> ''
        """
    )
    out: Dict[int, Set[str]] = {}
    for dr_id, w in rows:
        dom = url_to_domain(w)
        if is_plausible_domain(dom):
            out.setdefault(int(dr_id), set()).add(dom)
    return out

# -------------------------
# BUILD MATCH GROUPS
# -------------------------

def build_candidates_by_domain(
    providers: Dict[int, Provider],
    loc_domains: Dict[int, Set[str]],
) -> List[MergeCandidate]:
    bucket: Dict[str, Set[int]] = {}

    for p in providers.values():
        dom = url_to_domain(p.dr_website)
        if is_plausible_domain(dom):
            bucket.setdefault(dom, set()).add(p.dr_id)

    for dr_id, doms in loc_domains.items():
        for dom in doms:
            bucket.setdefault(dom, set()).add(dr_id)

    out: List[MergeCandidate] = []
    for dom, ids in bucket.items():
        if len(ids) >= 2:
            out.append(MergeCandidate(reason="domain", key=dom, members=sorted(ids)))
    return out

def build_candidates_by_email_domain(providers: Dict[int, Provider]) -> List[MergeCandidate]:
    bucket: Dict[str, Set[int]] = {}
    for p in providers.values():
        dom = email_to_domain(p.email)
        if is_plausible_domain(dom):
            bucket.setdefault(dom, set()).add(p.dr_id)

    out: List[MergeCandidate] = []
    for dom, ids in bucket.items():
        if len(ids) >= 2:
            out.append(MergeCandidate(reason="email_domain", key=dom, members=sorted(ids)))
    return out

def build_candidates_by_name_plz(providers: Dict[int, Provider]) -> List[MergeCandidate]:
    bucket: Dict[Tuple[str, str], List[int]] = {}
    for p in providers.values():
        ln = norm_name_key(p.lastname)
        plz = norm_ws(p.primary_plz)
        if ln and plz:
            bucket.setdefault((ln, plz), []).append(p.dr_id)

    out: List[MergeCandidate] = []
    for (ln, plz), ids in bucket.items():
        if len(ids) < 2:
            continue

        # conservative: if multiple distinct firstnames exist and conflict -> skip this group
        firsts = set()
        for dr_id in ids:
            fn = norm_name_key(providers[dr_id].firstname)
            if fn:
                firsts.add(fn)
        if len(firsts) >= 2:
            # too risky: same lastname+plz but different firstname in data
            continue

        out.append(MergeCandidate(reason="name_plz", key=f"{ln}|{plz}", members=sorted(ids)))
    return out

# -------------------------
# UNION-FIND TO MERGE TRANSITIVELY
# -------------------------

class UF:
    def __init__(self, nodes: List[int]) -> None:
        self.p = {n: n for n in nodes}
        self.r = {n: 0 for n in nodes}

    def find(self, a: int) -> int:
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.r[ra] < self.r[rb]:
            self.p[ra] = rb
        elif self.r[ra] > self.r[rb]:
            self.p[rb] = ra
        else:
            self.p[rb] = ra
            self.r[ra] += 1

def build_union_groups(
    providers: Dict[int, Provider],
    candidates: List[MergeCandidate],
) -> Dict[int, List[Tuple[str, str, List[int]]]]:
    """
    Returns root -> list of (reason, key, members_of_candidate)
    """
    uf = UF(list(providers.keys()))

    # Apply in priority order: domain > email_domain > name_plz
    prio = {"domain": 1, "email_domain": 2, "name_plz": 3}
    candidates_sorted = sorted(candidates, key=lambda c: prio.get(c.reason, 99))

    for c in candidates_sorted:
        m = c.members
        for i in range(1, len(m)):
            uf.union(m[0], m[i])

    # collect reason metadata per root
    meta: Dict[int, List[Tuple[str, str, List[int]]]] = {}
    for c in candidates_sorted:
        root = uf.find(c.members[0])
        meta.setdefault(root, []).append((c.reason, c.key, c.members))

    # collect groups
    groups: Dict[int, List[int]] = {}
    for dr_id in providers.keys():
        root = uf.find(dr_id)
        groups.setdefault(root, []).append(dr_id)

    # attach meta only where group size >= 2
    out: Dict[int, List[Tuple[str, str, List[int]]]] = {}
    for root, members in groups.items():
        if len(members) >= 2:
            out[root] = meta.get(root, [])
    return out

# -------------------------
# CANONICAL SELECTION
# -------------------------

def source_rank(sources: Set[str]) -> int:
    # lower is better
    if "covidhilfe" in sources:
        return 1
    if "mecfsmed" in sources:
        return 2
    if "fasynation" in sources:
        return 3
    return 9

def pick_canonical(members: List[int], provider_sources: Dict[int, Set[str]], providers: Dict[int, Provider]) -> int:
    # choose by source priority first, then by "richness", then lowest dr_id
    def richness(dr_id: int) -> int:
        p = providers[dr_id]
        score = 0
        if norm_ws(p.firstname): score += 1
        if norm_ws(p.lastname): score += 1
        if norm_ws(p.email): score += 1
        if is_plausible_domain(url_to_domain(p.dr_website)): score += 1
        if norm_ws(p.primary_plz): score += 1
        return score

    best = None
    best_key = None
    for dr_id in members:
        rank = source_rank(provider_sources.get(dr_id, set()))
        key = (rank, -richness(dr_id), dr_id)
        if best is None or key < best_key:
            best = dr_id
            best_key = key
    return int(best)

# -------------------------
# APPLY MERGE (DB WRITES)
# -------------------------

def move_sources(db: DB, from_id: int, to_id: int) -> int:
    # handle duplicate keys on (source_id, external_id) by deleting conflicts
    rows = db.q(
        "SELECT dr_source_id, source_id, external_id FROM tbl_drs_sources_02 WHERE dr_id=%s",
        (from_id,),
    )
    moved = 0
    for dr_source_id, source_id, external_id in rows:
        # check conflict
        if external_id is not None:
            conflict = db.q1(
                """
                SELECT dr_source_id
                FROM tbl_drs_sources_02
                WHERE dr_id=%s AND source_id=%s AND external_id=%s
                LIMIT 1
                """,
                (to_id, source_id, external_id),
            )
            if conflict:
                # duplicate: delete the from-row
                db.exec("DELETE FROM tbl_drs_sources_02 WHERE dr_source_id=%s", (dr_source_id,))
                continue
        db.exec("UPDATE tbl_drs_sources_02 SET dr_id=%s WHERE dr_source_id=%s", (to_id, dr_source_id))
        moved += 1
    return moved

def move_terms(db: DB, from_id: int, to_id: int) -> int:
    # dedupe by deleting rows that would conflict
    rows = db.q(
        "SELECT cpl_id, term_id, source_id FROM tbl_cpl_drs2terms_02 WHERE dr_id=%s",
        (from_id,),
    )
    moved = 0
    for cpl_id, term_id, source_id in rows:
        conflict = db.q1(
            """
            SELECT cpl_id
            FROM tbl_cpl_drs2terms_02
            WHERE dr_id=%s AND term_id=%s AND source_id=%s
            LIMIT 1
            """,
            (to_id, term_id, source_id),
        )
        if conflict:
            db.exec("DELETE FROM tbl_cpl_drs2terms_02 WHERE cpl_id=%s", (cpl_id,))
            continue
        db.exec("UPDATE tbl_cpl_drs2terms_02 SET dr_id=%s WHERE cpl_id=%s", (to_id, cpl_id))
        moved += 1
    return moved

def location_signature_row(row: Tuple[Any, ...]) -> Tuple[str, str, str, str, str, str]:
    # (country, plz, city, street, housenumber, website_domain)
    _, country, plz, city, street, housenumber, website = row
    dom = url_to_domain(website)
    return (
        norm_ws(country),
        norm_ws(plz),
        norm_ws(city),
        norm_ws(street),
        norm_ws(housenumber),
        dom,
    )

def move_locations(db: DB, from_id: int, to_id: int) -> int:
    # Load target signatures
    target_rows = db.q(
        """
        SELECT loc_id, loc_country, loc_plz, loc_city, loc_street, loc_housenumber, loc_website
        FROM tbl_drs_locations_02
        WHERE dr_id=%s
        """,
        (to_id,),
    )
    target_sigs = {location_signature_row(r) for r in target_rows}

    rows = db.q(
        """
        SELECT loc_id, loc_country, loc_plz, loc_city, loc_street, loc_housenumber, loc_website
        FROM tbl_drs_locations_02
        WHERE dr_id=%s
        """,
        (from_id,),
    )

    moved = 0
    for r in rows:
        loc_id = int(r[0])
        sig = location_signature_row(r)
        if sig in target_sigs:
            db.exec("DELETE FROM tbl_drs_locations_02 WHERE loc_id=%s", (loc_id,))
            continue
        db.exec("UPDATE tbl_drs_locations_02 SET dr_id=%s WHERE loc_id=%s", (to_id, loc_id))
        moved += 1
        target_sigs.add(sig)
    return moved

def merge_votes(db: DB, from_id: int, to_id: int) -> None:
    fr = db.q1(
        "SELECT vote_improved, vote_neutral, vote_worsened FROM tbl_drs_votes_02 WHERE dr_id=%s",
        (from_id,),
    )
    tr = db.q1(
        "SELECT vote_improved, vote_neutral, vote_worsened FROM tbl_drs_votes_02 WHERE dr_id=%s",
        (to_id,),
    )
    if not tr:
        db.exec(
            "INSERT INTO tbl_drs_votes_02 (dr_id, vote_improved, vote_neutral, vote_worsened) VALUES (%s,0,0,0)",
            (to_id,),
        )
        tr = (0, 0, 0)

    if fr:
        ni = int(tr[0]) + int(fr[0])
        nn = int(tr[1]) + int(fr[1])
        nw = int(tr[2]) + int(fr[2])
        db.exec(
            "UPDATE tbl_drs_votes_02 SET vote_improved=%s, vote_neutral=%s, vote_worsened=%s WHERE dr_id=%s",
            (ni, nn, nw, to_id),
        )
        db.exec("DELETE FROM tbl_drs_votes_02 WHERE dr_id=%s", (from_id,))

def delete_provider(db: DB, dr_id: int) -> None:
    db.exec("DELETE FROM tbl_drs_02 WHERE dr_id=%s", (dr_id,))

# -------------------------
# MAIN
# -------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Führt die Merges wirklich aus (Default ist Dry-Run).")
    ap.add_argument("--report", default=str(BASE_DIR / "merge_report.json"), help="Pfad für JSON-Report.")
    args = ap.parse_args()

    report_path = Path(args.report).resolve()
    report_csv_path = report_path.with_suffix(".csv")
    merge_log_path = report_path.with_name("merge_log.json")

    db = DB()
    try:
        sources_map = load_sources_map(db)
        provider_sources = load_provider_sources(db, sources_map)
        providers = load_providers(db)
        loc_domains = load_location_websites(db)

        # Build candidates
        c_domain = build_candidates_by_domain(providers, loc_domains)
        c_email = build_candidates_by_email_domain(providers)
        c_nameplz = build_candidates_by_name_plz(providers)
        candidates = c_domain + c_email + c_nameplz

        groups_meta = build_union_groups(providers, candidates)

        # Build actual merge plan: root group members -> canonical + merge list
        merge_plan: List[Dict[str, Any]] = []
        all_merges: List[Tuple[int, int]] = []  # (from, to)

        for root, metas in groups_meta.items():
            # actual members of this union group:
            members = sorted({m for _, _, mem in metas for m in mem})
            # union-find meta doesn't necessarily include all nodes; include root itself + any linked by candidates
            # To be safe: add any provider whose sources overlap via same keys isn't tracked here, but that's fine.

            # If only 1 member in metas due to metadata, skip
            if len(members) < 2:
                continue

            canonical = pick_canonical(members, provider_sources, providers)
            others = [m for m in members if m != canonical]

            # safety: don't merge if canonical missing (shouldn't happen)
            if not others:
                continue

            merge_plan.append({
                "canonical": canonical,
                "members": members,
                "merge_from": others,
                "reasons": [{"reason": r, "key": k, "members": mem} for (r, k, mem) in metas],
                "canonical_sources": sorted(list(provider_sources.get(canonical, set()))),
            })
            for f in others:
                all_merges.append((f, canonical))

        # Summaries
        summary = {
            "db": f"{DB_HOST}:{DB_PORT}/{DB_NAME}",
            "providers_total": len(providers),
            "candidates_domain": len(c_domain),
            "candidates_email_domain": len(c_email),
            "candidates_name_plz": len(c_nameplz),
            "merge_groups": len(merge_plan),
            "merge_ops": len(all_merges),
            "mode": "APPLY" if args.apply else "DRY_RUN",
        }

        # Write reports (dry run always)
        out = {"summary": summary, "merge_plan": merge_plan}
        report_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

        # CSV report
        with report_csv_path.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["canonical_dr_id", "from_dr_id", "from_sources", "canonical_sources", "reason_keys"])
            for item in merge_plan:
                can = item["canonical"]
                can_src = ",".join(item["canonical_sources"])
                reason_keys = ",".join([f"{r['reason']}:{r['key']}" for r in item["reasons"]])
                for fr in item["merge_from"]:
                    fr_src = ",".join(sorted(list(provider_sources.get(fr, set()))))
                    w.writerow([can, fr, fr_src, can_src, reason_keys])

        print(f"[{summary['mode']}] Report written:")
        print(f"  JSON: {report_path}")
        print(f"  CSV : {report_csv_path}")
        print(f"  Summary: {json.dumps(summary, ensure_ascii=False)}")

        if not args.apply:
            print("\nDry-run: keine DB-Änderungen vorgenommen. Zum Ausführen: --apply")
            return

        # APPLY
        merge_log: List[Dict[str, Any]] = []
        ops = 0

        for item in merge_plan:
            to_id = int(item["canonical"])
            for from_id in item["merge_from"]:
                from_id = int(from_id)

                # Skip if already deleted in previous op (paranoia)
                exists = db.q1("SELECT dr_id FROM tbl_drs_02 WHERE dr_id=%s", (from_id,))
                if not exists:
                    continue

                moved_sources = move_sources(db, from_id, to_id)
                moved_terms = move_terms(db, from_id, to_id)
                moved_locs = move_locations(db, from_id, to_id)
                merge_votes(db, from_id, to_id)

                delete_provider(db, from_id)

                merge_log.append({
                    "from": from_id,
                    "to": to_id,
                    "moved_sources": moved_sources,
                    "moved_terms": moved_terms,
                    "moved_locations": moved_locs,
                    "reasons": item["reasons"],
                })

                ops += 1
                if ops % 25 == 0:
                    db.commit()
                    print(f"...committed after {ops} merges")

        db.commit()
        merge_log_path.write_text(json.dumps(merge_log, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[APPLY] DONE. merge_log written: {merge_log_path}")

    except MySQLError as e:
        db.rollback()
        print(f"ERROR MySQL: {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
