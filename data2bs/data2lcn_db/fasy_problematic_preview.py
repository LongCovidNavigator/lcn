#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Deterministic preview mapping for problematic Fasynation rows.

Input:
- fasynation_match_problematic.csv

Output:
- fasynation_problematic_mapped_preview.csv

This script uses a fully hard-coded mapping for the known problematic cases.
No heuristics, no guessing, no derived title logic.
If a raw name is missing in the mapping table, the script aborts.
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path
from typing import Any, Dict, List


# -------------------------
# Paths
# -------------------------
BASE_DIR = Path(__file__).resolve().parent

INPUT_CANDIDATES = [
    BASE_DIR / "fasynation_match_problematic.csv",
    Path("/mnt/data/fasynation_match_problematic.csv"),
]
INPUT_PATH = next((p for p in INPUT_CANDIDATES if p.exists()), INPUT_CANDIDATES[0])

OUTPUT_PATH = BASE_DIR / "fasynation_problematic_mapped_preview.csv"


# -------------------------
# Helpers
# -------------------------
def norm_ws(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def safe_str(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() == "nan":
        return ""
    return norm_ws(s)


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


# -------------------------
# Exact deterministic mapping
# -------------------------
# Each entry defines the final target fields exactly as desired.
# No automatic title derivation. No heuristics.

DETERMINISTIC_MAPPING: Dict[str, Dict[str, Any]] = {
    # lastname only persons
    "Wunder": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": None,
        "dr_lastname": "Wunder",
        "dr_org_name": None,
        "dr_display_name": "Dr. Wunder",
        "mapping_note": "hardcoded_lastname_only",
    },
    "Stark": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": None,
        "dr_lastname": "Stark",
        "dr_org_name": None,
        "dr_display_name": "Dr. Stark",
        "mapping_note": "hardcoded_lastname_only",
    },
    "Bückendorf": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": None,
        "dr_lastname": "Bückendorf",
        "dr_org_name": None,
        "dr_display_name": "Dr. Bückendorf",
        "mapping_note": "hardcoded_lastname_only",
    },
    "Schrieck": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": None,
        "dr_lastname": "Schrieck",
        "dr_org_name": None,
        "dr_display_name": "Dr. Schrieck",
        "mapping_note": "hardcoded_lastname_only",
    },
    "Couckuyt": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": None,
        "dr_lastname": "Couckuyt",
        "dr_org_name": None,
        "dr_display_name": "Dr. Couckuyt",
        "mapping_note": "hardcoded_lastname_only",
    },

    # full persons
    "Wolfgang Ries": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": "Wolfgang",
        "dr_lastname": "Ries",
        "dr_org_name": None,
        "dr_display_name": "Dr. Wolfgang Ries",
        "mapping_note": "hardcoded_person",
    },
    "M. Hechler": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": "M.",
        "dr_lastname": "Hechler",
        "dr_org_name": None,
        "dr_display_name": "Dr. M. Hechler",
        "mapping_note": "hardcoded_person",
    },
    "B. Luchting (Leitung)": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": "B.",
        "dr_lastname": "Luchting",
        "dr_org_name": None,
        "dr_display_name": "Dr. B. Luchting",
        "mapping_note": "hardcoded_person",
    },
    "Klaus Schmidt-Thomé": {
        "mode": "person",
        "dr_type": None,
        "dr_is_dr": 1,
        "dr_title_raw": "Dr.",
        "dr_firstname": "Klaus",
        "dr_lastname": "Schmidt-Thomé",
        "dr_org_name": None,
        "dr_display_name": "Dr. Klaus Schmidt-Thomé",
        "mapping_note": "hardcoded_person",
    },

    # orgs
    "Schmerzzentrum Berlin": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Schmerzzentrum Berlin",
        "dr_display_name": "Schmerzzentrum Berlin",
        "mapping_note": "hardcoded_org",
    },
    "Gemeinschaftspraxis Sterup": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Gemeinschaftspraxis Sterup",
        "dr_display_name": "Gemeinschaftspraxis Sterup",
        "mapping_note": "hardcoded_org",
    },
    "Hausarztpraxis Dufayet": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Hausarztpraxis Dufayet",
        "dr_display_name": "Hausarztpraxis Dufayet",
        "mapping_note": "hardcoded_org",
    },
    "Medissimo Arztpraxis": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Medissimo Arztpraxis",
        "dr_display_name": "Medissimo Arztpraxis",
        "mapping_note": "hardcoded_org",
    },
    "Habichtswaldklinik": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Habichtswaldklinik",
        "dr_display_name": "Habichtswaldklinik",
        "mapping_note": "hardcoded_org",
    },
    "Naturheilzentrum Breidenbach": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Naturheilzentrum Breidenbach",
        "dr_display_name": "Naturheilzentrum Breidenbach",
        "mapping_note": "hardcoded_org",
    },
    "Uniklinik Mainz": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Uniklinik Mainz",
        "dr_display_name": "Uniklinik Mainz",
        "mapping_note": "hardcoded_org",
    },
    "Gesundheitszentrum Striller": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Gesundheitszentrum Striller",
        "dr_display_name": "Gesundheitszentrum Striller",
        "mapping_note": "hardcoded_org",
    },
    "Rehaklinik Glotterbad": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Rehaklinik Glotterbad",
        "dr_display_name": "Rehaklinik Glotterbad",
        "mapping_note": "hardcoded_org",
    },
    "Spezialklinik Neukirchen": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Spezialklinik Neukirchen",
        "dr_display_name": "Spezialklinik Neukirchen",
        "mapping_note": "hardcoded_org",
    },
    "Schnakenberg / IPGD": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Schnakenberg / IPGD",
        "dr_display_name": "Schnakenberg / IPGD",
        "mapping_note": "hardcoded_org",
    },
    "Zillgens / Praganzmed-Praxis": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Zillgens / Praganzmed-Praxis",
        "dr_display_name": "Zillgens / Praganzmed-Praxis",
        "mapping_note": "hardcoded_org",
    },
    "Hellstern bei Medivitum": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Hellstern bei Medivitum",
        "dr_display_name": "Hellstern bei Medivitum",
        "mapping_note": "hardcoded_org",
    },
    "Lembens & Lembens": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Lembens & Lembens",
        "dr_display_name": "Lembens & Lembens",
        "mapping_note": "hardcoded_org",
    },
    "Blehe und Team": {
        "mode": "org",
        "dr_type": None,
        "dr_is_dr": 0,
        "dr_title_raw": None,
        "dr_firstname": None,
        "dr_lastname": None,
        "dr_org_name": "Blehe und Team",
        "dr_display_name": "Blehe und Team",
        "mapping_note": "hardcoded_org",
    },
}


# -------------------------
# CSV loading
# -------------------------
def load_problematic_csv(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Problematic CSV not found: {path}")

    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            rows.append(dict(row))
    return rows


# -------------------------
# Main transform
# -------------------------
def build_preview_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    unresolved: List[str] = []

    for row in rows:
        raw_vorname = safe_str(row.get("Vorname"))
        raw_nachname = safe_str(row.get("Nachname"))
        raw_name = raw_nachname if raw_nachname else raw_vorname

        mapped = DETERMINISTIC_MAPPING.get(raw_name)
        if not mapped:
            unresolved.append(raw_name)
            continue

        out.append({
            "line_no": safe_str(row.get("line_no") or row.get("\ufeffline_no")),
            "Nr": safe_str(row.get("Nr")),
            "source_reason": safe_str(row.get("reason")),
            "raw_vorname": raw_vorname,
            "raw_nachname": raw_nachname,
            "raw_name_used": raw_name,
            "Dr": safe_str(row.get("Dr")),
            "PLZ": safe_str(row.get("PLZ")),
            "Land": safe_str(row.get("Land")),
            "Link": safe_str(row.get("Link")),
            "Fernberatung": safe_str(row.get("Fernberatung")),
            "Fachrichtung": safe_str(row.get("Fachrichtung")),

            "mode": mapped["mode"],
            "mapping_note": mapped["mapping_note"],
            "dr_type": mapped["dr_type"],
            "dr_is_dr": mapped["dr_is_dr"],
            "dr_title_raw": mapped["dr_title_raw"],
            "dr_firstname": mapped["dr_firstname"],
            "dr_lastname": mapped["dr_lastname"],
            "dr_org_name": mapped["dr_org_name"],
            "dr_display_name": mapped["dr_display_name"],

            "dr_website": safe_str(row.get("Link")) or None,
            "dr_email": None,
            "dr_accepts_gkv": "unknown",
            "dr_accepts_pkv": "unknown",
            "dr_notes": None,
        })

    if unresolved:
        print("UNMAPPED NAMES FOUND:", file=sys.stderr)
        for name in sorted(set(unresolved)):
            print(f"  - {name}", file=sys.stderr)
        raise RuntimeError("Deterministic mapping incomplete. Add missing names to DETERMINISTIC_MAPPING.")

    return out


def main() -> None:
    print("=== FASYNATION PROBLEMATIC DETERMINISTIC PREVIEW ===")
    print(f"INPUT : {INPUT_PATH}")
    print(f"OUTPUT: {OUTPUT_PATH}")
    print()

    rows = load_problematic_csv(INPUT_PATH)
    print(f"Problematic rows loaded: {len(rows)}")

    preview_rows = build_preview_rows(rows)

    fieldnames = [
        "line_no",
        "Nr",
        "source_reason",
        "raw_vorname",
        "raw_nachname",
        "raw_name_used",
        "Dr",
        "PLZ",
        "Land",
        "Link",
        "Fernberatung",
        "Fachrichtung",
        "mode",
        "mapping_note",
        "dr_type",
        "dr_is_dr",
        "dr_title_raw",
        "dr_firstname",
        "dr_lastname",
        "dr_org_name",
        "dr_display_name",
        "dr_website",
        "dr_email",
        "dr_accepts_gkv",
        "dr_accepts_pkv",
        "dr_notes",
    ]

    write_csv(OUTPUT_PATH, preview_rows, fieldnames)

    person_count = sum(1 for r in preview_rows if r.get("mode") == "person")
    org_count = sum(1 for r in preview_rows if r.get("mode") == "org")

    print("---- Summary ----")
    print(f"total  : {len(preview_rows)}")
    print(f"person : {person_count}")
    print(f"org    : {org_count}")
    print()
    print(f"Wrote preview: {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}", file=sys.stderr)
        sys.exit(1)