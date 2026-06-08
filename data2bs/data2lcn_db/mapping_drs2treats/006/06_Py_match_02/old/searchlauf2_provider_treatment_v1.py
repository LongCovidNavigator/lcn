#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import os
import re
from typing import Dict, List, Tuple, Optional


MAPPING_FIELDS = [
    "id",
    "decision",
    "dr_id",
    "doctor_name",
    "treatment_name_raw",
    "treatment_name_normalized",
    "review_mapping",
    "review_mapping_notes",
    "recommendation_type",
    "evidence_excerpt",
    "evidence_strength",
    "treat_id",
    "treat_match_status",
    "match_notes",
    "review_matching",
    "review_matching_notes",
    "alias_name",
    "alias_type",
    "sort_order",
    "notes",
    "source_batch_id",
    "source_id",
    "source_name",
]

DEBUG_FIELDS = [
    "provider_name",
    "provider_start",
    "provider_end",
    "provider_type",
    "treatment_name_raw",
    "treatment_name_normalized",
    "treatment_group",
    "treatment_start",
    "treatment_end",
    "same_section",
    "same_paragraph",
    "char_gap",
    "window_start",
    "window_end",
    "status",
    "review_reason",
    "evidence_strength",
    "rule_hits",
    "window_excerpt",
]


# -----------------------------
# IO
# -----------------------------

def read_text(path: str) -> str:
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Datei konnte nicht gelesen werden: {path}")


def read_csv_rows(path: str) -> List[Dict[str, str]]:
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            with open(path, "r", encoding=enc, newline="") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise ValueError(f"CSV konnte nicht gelesen werden: {path}")


def write_csv(path: str, fieldnames: List[str], rows: List[Dict[str, str]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow(row)


# -----------------------------
# Basis-Parsing
# -----------------------------

def get_metadata(full_text: str, fallback_file_name: str) -> Dict[str, str]:
    def m(pattern: str) -> str:
        hit = re.search(pattern, full_text, flags=re.MULTILINE)
        return hit.group(1).strip() if hit else ""

    return {
        "file_name": fallback_file_name,
        "article_id": m(r"^PAGE_ID:\s*(.+)$"),
        "article_title": m(r"^TITLE_INPUT:\s*(.+)$"),
        "source_name": m(r"^SOURCE_NAME:\s*(.+)$"),
        "source_batch_id": m(r"^SOURCE_BATCH_ID:\s*(.+)$"),
    }


def section_ranges(full_text: str) -> Dict[str, Tuple[int, int]]:
    out: Dict[str, Tuple[int, int]] = {}
    m_content = re.search(r"=== CONTENT START ===\n(.*?)\n=== CONTENT END ===", full_text, flags=re.DOTALL)
    m_comments = re.search(r"=== COMMENTS START ===\n(.*?)\n=== COMMENTS END ===", full_text, flags=re.DOTALL)
    if m_content:
        out["content"] = (m_content.start(1), m_content.end(1))
    if m_comments:
        out["comments"] = (m_comments.start(1), m_comments.end(1))
    return out


def detect_section(start: int, end: int, ranges: Dict[str, Tuple[int, int]]) -> str:
    for name, (a, b) in ranges.items():
        if start >= a and end <= b:
            return name
    return ""


def to_int(value: str) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return 0


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


# -----------------------------
# Textgrenzen / Kontext
# -----------------------------

def paragraph_bounds(text: str, start: int, end: int) -> Tuple[int, int]:
    left = text.rfind("\n\n", 0, start)
    right = text.find("\n\n", end)

    if left == -1:
        left = 0
    else:
        left += 2

    if right == -1:
        right = len(text)

    return left, right


def sentence_bounds(text: str, start: int, end: int) -> Tuple[int, int]:
    sentence_breaks = ".!?\n"
    left = start
    while left > 0 and text[left - 1] not in sentence_breaks:
        left -= 1

    right = end
    while right < len(text) and text[right] not in sentence_breaks:
        right += 1
    if right < len(text):
        right += 1

    return left, right


def build_window(text: str, a_start: int, a_end: int, b_start: int, b_end: int) -> Tuple[int, int, str]:
    raw_start = min(a_start, b_start)
    raw_end = max(a_end, b_end)

    p_start, p_end = paragraph_bounds(text, raw_start, raw_end)
    if (p_end - p_start) <= 1200:
        return p_start, p_end, normalize_space(text[p_start:p_end])

    s_start, s_end = sentence_bounds(text, raw_start, raw_end)
    margin = 180
    w_start = max(0, s_start - margin)
    w_end = min(len(text), s_end + margin)
    return w_start, w_end, normalize_space(text[w_start:w_end])


def char_gap(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    if a_end < b_start:
        return b_start - a_end
    if b_end < a_start:
        return a_start - b_end
    return 0


# -----------------------------
# Records
# -----------------------------

def load_providers(path: str, text: str, ranges: Dict[str, Tuple[int, int]]) -> List[Dict[str, object]]:
    rows = read_csv_rows(path)
    out: List[Dict[str, object]] = []
    for r in rows:
        start = to_int(r.get("finding_start", "0"))
        end = to_int(r.get("finding_end", "0"))
        out.append({
            "file_name": r.get("file_name", ""),
            "article_id": r.get("article_id", ""),
            "article_title": r.get("article_title", ""),
            "start": start,
            "end": end,
            "text_raw": normalize_space(r.get("entity_text_raw", "")),
            "text_normalized": normalize_space(r.get("entity_text_normalized", "")),
            "provider_type": normalize_space(r.get("provider_type", "")),
            "review_needed": to_int(r.get("review_needed", "0")),
            "review_reason": normalize_space(r.get("review_reason", "")),
            "section": detect_section(start, end, ranges),
        })
    return sorted(out, key=lambda x: (x["start"], x["end"], x["text_raw"].lower()))


def load_treatments(path: str, text: str, ranges: Dict[str, Tuple[int, int]]) -> List[Dict[str, object]]:
    rows = read_csv_rows(path)
    out: List[Dict[str, object]] = []
    for r in rows:
        start = to_int(r.get("finding_start", "0"))
        end = to_int(r.get("finding_end", "0"))
        out.append({
            "file_name": r.get("file_name", ""),
            "article_id": r.get("article_id", ""),
            "article_title": r.get("article_title", ""),
            "start": start,
            "end": end,
            "text_raw": normalize_space(r.get("entity_text_raw", "")),
            "text_normalized": normalize_space(r.get("entity_text_normalized", "")),
            "entity_group": normalize_space(r.get("entity_group", "")),
            "review_needed": to_int(r.get("review_needed", "0")),
            "review_reason": normalize_space(r.get("review_reason", "")),
            "section": detect_section(start, end, ranges),
        })
    return sorted(out, key=lambda x: (x["start"], x["end"], x["text_raw"].lower(), x["entity_group"]))


# -----------------------------
# Matching-Regeln
# -----------------------------

POSITIVE_PATTERNS_DIRECT = [
    r"\bbehandelt\b",
    r"\bbietet\b",
    r"\bsetzt\b.*\bein\b",
    r"\bempfiehlt\b",
    r"\bnutzt\b",
    r"\bverordnet\b",
    r"\bverschreibt\b",
    r"\bführt\b.*\bdurch\b",
    r"\barbeitet\b.*\bmit\b",
    r"\bhilft\b.*\bmit\b",
    r"\bunterstützt\b.*\bmit\b",
    r"\bProgramm\b",
    r"\bPraxis\b",
    r"\bSprechstunde\b",
]

POSITIVE_PATTERNS_REVIEW = [
    r"\bgeht\b.*\bein\b",
    r"\berklärt\b",
    r"\bspricht\b.*\büber\b",
    r"\bmehr\b.*\bdazu\b",
    r"\bHinweise\b",
    r"\bThema\b",
]

NEGATIVE_PATTERNS = [
    r"\bnicht\b.*\bmein Weg\b",
    r"\bnur\b.*\bInformation\b",
    r"\bdient\b.*\bInformation\b",
    r"\ballgemein\b",
    r"\btheoretisch\b",
    r"\bUrsache\b\s*\d+",
    r"\bmögliche Ursachen\b",
    r"\bListe\b",
]

COMMENT_PROVIDER_DOWNGRADE = True


def recommendation_type_from_group(group: str) -> str:
    g = (group or "").lower()
    if g == "diagnosis":
        return "Diagnose"
    if g == "test":
        return "Diagnose"
    return "Behandlung"


def is_same_paragraph(text: str, a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    p1 = paragraph_bounds(text, a_start, a_end)
    p2 = paragraph_bounds(text, b_start, b_end)
    return p1 == p2


def contains_any(patterns: List[str], text: str) -> List[str]:
    hits = []
    for p in patterns:
        if re.search(p, text, flags=re.IGNORECASE | re.DOTALL):
            hits.append(p)
    return hits


def pair_score(
    full_text: str,
    provider: Dict[str, object],
    treatment: Dict[str, object],
) -> Dict[str, object]:
    same_section = provider["section"] == treatment["section"] and provider["section"] != ""
    same_paragraph = is_same_paragraph(full_text, provider["start"], provider["end"], treatment["start"], treatment["end"])
    gap = char_gap(provider["start"], provider["end"], treatment["start"], treatment["end"])
    w_start, w_end, excerpt = build_window(full_text, provider["start"], provider["end"], treatment["start"], treatment["end"])

    excerpt_l = excerpt.lower()
    provider_text = str(provider["text_raw"])
    treatment_text = str(treatment["text_raw"])

    pos_direct = contains_any(POSITIVE_PATTERNS_DIRECT, excerpt)
    pos_review = contains_any(POSITIVE_PATTERNS_REVIEW, excerpt)
    neg_hits = contains_any(NEGATIVE_PATTERNS, excerpt)

    score = 0
    reasons: List[str] = []

    if not same_section:
        return {
            "status": "reject",
            "review_reason": "nicht im selben abschnitt",
            "evidence_strength": "",
            "rule_hits": "cross_section",
            "same_section": 0,
            "same_paragraph": 0,
            "char_gap": gap,
            "window_start": w_start,
            "window_end": w_end,
            "window_excerpt": excerpt,
        }

    if same_paragraph:
        score += 2
        reasons.append("same_paragraph")

    if gap <= 80:
        score += 2
        reasons.append("gap_le_80")
    elif gap <= 220:
        score += 1
        reasons.append("gap_le_220")
    elif gap > 800:
        score -= 3
        reasons.append("gap_gt_800")

    if pos_direct:
        score += 3
        reasons.append("direct_context")

    if pos_review:
        score += 1
        reasons.append("weak_context")

    if provider["review_needed"]:
        score -= 1
        reasons.append("provider_review_input")

    if treatment["review_needed"]:
        score -= 1
        reasons.append("treatment_review_input")

    if provider["section"] == "comments" and COMMENT_PROVIDER_DOWNGRADE:
        score -= 2
        reasons.append("comment_context")

    if neg_hits:
        score -= 3
        reasons.append("negative_context")

    provider_raw_l = provider_text.lower()
    treatment_raw_l = treatment_text.lower()

    if "episode" in excerpt_l and "praxis" not in excerpt_l and "programm" not in excerpt_l and "behandelt" not in excerpt_l:
        score -= 2
        reasons.append("episode_interview_context")

    if any(x in treatment_raw_l for x in ["therapie", "behandlung", "maßnahme", "programm"]) and len(treatment_text.split()) == 1:
        score -= 2
        reasons.append("generic_treatment_term")

    if any(x in provider_raw_l for x in ["programm", "retreat", "coach"]):
        reasons.append("extended_provider_type")

    # Direktmatch nur mit starkem Kontext
    if score >= 5 and pos_direct:
        status = "direct"
        review_reason = ""
        evidence_strength = "high"
    elif score >= 3:
        status = "review"
        review_reason = "; ".join(reasons) if reasons else "lokaler kontext indirekt"
        evidence_strength = "medium"
    else:
        status = "reject"
        review_reason = "; ".join(reasons) if reasons else "kein belastbarer praxisbezug"
        evidence_strength = ""

    return {
        "status": status,
        "review_reason": review_reason,
        "evidence_strength": evidence_strength,
        "rule_hits": "; ".join(reasons),
        "same_section": 1 if same_section else 0,
        "same_paragraph": 1 if same_paragraph else 0,
        "char_gap": gap,
        "window_start": w_start,
        "window_end": w_end,
        "window_excerpt": excerpt,
    }


# -----------------------------
# Dedupe / Output
# -----------------------------

def mapping_row(
    idx: int,
    meta: Dict[str, str],
    provider: Dict[str, object],
    treatment: Dict[str, object],
    verdict: Dict[str, object],
) -> Dict[str, str]:
    review_mapping = "1" if verdict["status"] == "review" else "0"
    review_mapping_notes = verdict["review_reason"] if verdict["status"] == "review" else ""
    recommendation_type = recommendation_type_from_group(str(treatment["entity_group"]))

    notes_parts = [
        f"searchlauf2_status={verdict['status']}",
        f"provider_type={provider['provider_type']}",
        f"treatment_group={treatment['entity_group']}",
        f"char_gap={verdict['char_gap']}",
        f"window=({verdict['window_start']},{verdict['window_end']})",
    ]
    if verdict["rule_hits"]:
        notes_parts.append(f"rule_hits={verdict['rule_hits']}")

    return {
        "id": str(idx),
        "decision": "",
        "dr_id": "",
        "doctor_name": str(provider["text_raw"]),
        "treatment_name_raw": str(treatment["text_raw"]),
        "treatment_name_normalized": str(treatment["text_normalized"]),
        "review_mapping": review_mapping,
        "review_mapping_notes": review_mapping_notes,
        "recommendation_type": recommendation_type,
        "evidence_excerpt": verdict["window_excerpt"][:1000],
        "evidence_strength": verdict["evidence_strength"],
        "treat_id": "",
        "treat_match_status": "",
        "match_notes": verdict["status"],
        "review_matching": "0",
        "review_matching_notes": "",
        "alias_name": "",
        "alias_type": "",
        "sort_order": "",
        "notes": " | ".join(notes_parts),
        "source_batch_id": meta.get("source_batch_id", ""),
        "source_id": meta.get("article_id", ""),
        "source_name": meta.get("source_name", ""),
    }


def debug_row(provider: Dict[str, object], treatment: Dict[str, object], verdict: Dict[str, object]) -> Dict[str, str]:
    return {
        "provider_name": str(provider["text_raw"]),
        "provider_start": str(provider["start"]),
        "provider_end": str(provider["end"]),
        "provider_type": str(provider["provider_type"]),
        "treatment_name_raw": str(treatment["text_raw"]),
        "treatment_name_normalized": str(treatment["text_normalized"]),
        "treatment_group": str(treatment["entity_group"]),
        "treatment_start": str(treatment["start"]),
        "treatment_end": str(treatment["end"]),
        "same_section": str(verdict["same_section"]),
        "same_paragraph": str(verdict["same_paragraph"]),
        "char_gap": str(verdict["char_gap"]),
        "window_start": str(verdict["window_start"]),
        "window_end": str(verdict["window_end"]),
        "status": str(verdict["status"]),
        "review_reason": str(verdict["review_reason"]),
        "evidence_strength": str(verdict["evidence_strength"]),
        "rule_hits": str(verdict["rule_hits"]),
        "window_excerpt": str(verdict["window_excerpt"])[:1000],
    }


def dedupe_mapping_rows(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    out = []
    for row in rows:
        key = (
            row["doctor_name"].strip().lower(),
            row["treatment_name_normalized"].strip().lower(),
            row["source_id"].strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


# -----------------------------
# Hauptlauf
# -----------------------------

def run(input_text: str, providers_csv: str, treatments_csv: str, output_csv: str, debug_csv: Optional[str]) -> Dict[str, object]:
    full_text = read_text(input_text)
    meta = get_metadata(full_text, os.path.basename(input_text))
    ranges = section_ranges(full_text)

    if not ranges:
        raise ValueError("CONTENT/COMMENTS-Abschnitte konnten nicht erkannt werden.")

    providers = load_providers(providers_csv, full_text, ranges)
    treatments = load_treatments(treatments_csv, full_text, ranges)

    mapping_rows: List[Dict[str, str]] = []
    debug_rows: List[Dict[str, str]] = []

    idx = 1
    for provider in providers:
        for treatment in treatments:
            verdict = pair_score(full_text, provider, treatment)
            debug_rows.append(debug_row(provider, treatment, verdict))

            if verdict["status"] not in ("direct", "review"):
                continue

            mapping_rows.append(mapping_row(idx, meta, provider, treatment, verdict))
            idx += 1

    mapping_rows = dedupe_mapping_rows(mapping_rows)

    # IDs nach Dedupe neu zählen
    for i, row in enumerate(mapping_rows, start=1):
        row["id"] = str(i)

    write_csv(output_csv, MAPPING_FIELDS, mapping_rows)

    if debug_csv:
        write_csv(debug_csv, DEBUG_FIELDS, debug_rows)

    return {
        "providers_in": len(providers),
        "treatments_in": len(treatments),
        "mapping_rows_out": len(mapping_rows),
        "debug_rows_out": len(debug_rows),
        "output_csv": output_csv,
        "debug_csv": debug_csv or "",
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Suchlauf 2 V1 – Provider↔Treatment in Mapping-Format")
    p.add_argument("--input-text", required=True, help="Pfad zur Artikel-TXT")
    p.add_argument("--providers-csv", required=True, help="Pfad zu __providers.csv")
    p.add_argument("--treatments-csv", required=True, help="Pfad zu __treatments.csv")
    p.add_argument("--output-csv", required=True, help="Pfad zur Mapping-CSV")
    p.add_argument("--debug-csv", default="", help="Optionaler Pfad zur Debug-CSV")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    result = run(
        input_text=args.input_text,
        providers_csv=args.providers_csv,
        treatments_csv=args.treatments_csv,
        output_csv=args.output_csv,
        debug_csv=args.debug_csv or None,
    )
    print("status=ok")
    for k, v in result.items():
        print(f"{k}={v}")


if __name__ == "__main__":
    main()