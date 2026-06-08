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
    "file_name",
    "article_id",
    "article_title",
    "provider_name",
    "provider_start",
    "provider_end",
    "provider_type",
    "provider_context_mode",
    "treatment_name_raw",
    "treatment_name_normalized",
    "treatment_canonical",
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

RUNLOG_FIELDS = [
    "file_name",
    "article_id",
    "article_title",
    "txt_path",
    "status",
    "providers_found",
    "treatments_found",
    "speaker_title_hits",
    "speaker_text_hits",
    "speaker_windows_built",
    "provider_candidates_total",
    "mapping_rows_added",
    "debug_rows_added",
    "message",
]

GENERIC_TREATMENT_TERMS = {
    "therapie",
    "behandlung",
    "maßnahme",
    "maßnahmen",
    "programm",
    "programme",
    "diagnostik",
    "untersuchung",
    "test",
    "tests",
}

TITLE_CONNECTOR_PATTERNS = [
    r"\büber\b",
    r"\binterview mit\b",
    r"\bratschläge von\b",
    r"\bgrundlagenwissen\b",
    r"\btherapien\b",
]

SPEAKER_TEXT_PATTERNS = [
    r"\bzu wort kommen\b",
    r"\balle folgenden aussagen\b",
    r"\bdie meinung von\b",
    r"\berklärt\b",
    r"\bspricht\b",
    r"\bhier nochmal die ratschläge von\b",
]

CTA_PATTERNS = [
    r"\bkennst du schon\b",
    r"\bfasy\.mail\b",
    r"\bklick(en)?\b",
    r"\beintragen\b",
]

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
    r"\bprogramm\b",
    r"\bpraxis\b",
    r"\bsprechstunde\b",
]

POSITIVE_PATTERNS_REVIEW = [
    r"\bgeht\b.*\bein\b",
    r"\berklärt\b",
    r"\bspricht\b.*\büber\b",
    r"\bmehr\b.*\bdazu\b",
    r"\bhinweise\b",
    r"\bthema\b",
]

NEGATIVE_PATTERNS = [
    r"\bnicht\b.*\bmein weg\b",
    r"\bnur\b.*\binformation\b",
    r"\bdient\b.*\binformation\b",
    r"\ballgemein\b",
    r"\btheoretisch\b",
    r"\bursache\b\s*\d+",
    r"\bmögliche ursachen\b",
    r"\bliste\b",
]

COMMENT_PROVIDER_DOWNGRADE = True


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


def collect_txt_files(input_dirs: List[str]) -> List[str]:
    files = []
    for input_dir in input_dirs:
        if not os.path.isdir(input_dir):
            continue
        for name in sorted(os.listdir(input_dir)):
            if name.lower().endswith(".txt"):
                files.append(os.path.join(input_dir, name))
    return sorted(files)


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


def lower_clean(text: str) -> str:
    return normalize_space(text).lower()


def canonicalize_treatment(text: str) -> str:
    text = normalize_space(text).lower()
    text = text.replace("–", "-").replace("—", "-")
    text = text.replace("/", " ")
    text = re.sub(r"[.,:;()\[\]{}]+", " ", text)
    text = re.sub(r"\s*-\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


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


def is_same_paragraph(text: str, a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    p1 = paragraph_bounds(text, a_start, a_end)
    p2 = paragraph_bounds(text, b_start, b_end)
    return p1 == p2


def split_paragraphs_with_positions(text: str, start: int, end: int) -> List[Dict[str, object]]:
    block = text[start:end]
    out = []
    for m in re.finditer(r"(.*?)(\n\n|$)", block, flags=re.DOTALL):
        para = m.group(1)
        para_start = start + m.start(1)
        para_end = start + m.end(1)
        if normalize_space(para):
            out.append({
                "start": para_start,
                "end": para_end,
                "text": para,
            })
    return out


def split_sentences_with_positions(text: str, start: int, end: int) -> List[Dict[str, object]]:
    block = text[start:end]
    out = []
    for m in re.finditer(r"[^.!?\n]+[.!?\n]?", block, flags=re.DOTALL):
        sent = m.group(0)
        if normalize_space(sent):
            out.append({
                "start": start + m.start(),
                "end": start + m.end(),
                "text": sent,
            })
    return out


# -----------------------------
# Sammeldateien laden / filtern
# -----------------------------

def build_row_indexes(rows: List[Dict[str, str]]) -> Tuple[Dict[str, List[Dict[str, str]]], Dict[str, List[Dict[str, str]]]]:
    by_file_name: Dict[str, List[Dict[str, str]]] = {}
    by_article_id: Dict[str, List[Dict[str, str]]] = {}

    for row in rows:
        file_name = normalize_space(row.get("file_name", ""))
        article_id = normalize_space(row.get("article_id", ""))

        if file_name:
            by_file_name.setdefault(file_name, []).append(row)
        if article_id:
            by_article_id.setdefault(article_id, []).append(row)

    return by_file_name, by_article_id


def select_rows_for_article(
    by_file_name: Dict[str, List[Dict[str, str]]],
    by_article_id: Dict[str, List[Dict[str, str]]],
    file_name: str,
    article_id: str,
) -> List[Dict[str, str]]:
    selected: List[Dict[str, str]] = []
    seen = set()

    for row in by_file_name.get(file_name, []):
        key = id(row)
        if key not in seen:
            seen.add(key)
            selected.append(row)

    for row in by_article_id.get(article_id, []):
        key = id(row)
        if key not in seen:
            seen.add(key)
            selected.append(row)

    return selected


# -----------------------------
# Records
# -----------------------------

def load_providers_for_article(rows: List[Dict[str, str]], text: str, ranges: Dict[str, Tuple[int, int]]) -> List[Dict[str, object]]:
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
    return sorted(out, key=lambda x: (x["start"], x["end"], str(x["text_raw"]).lower()))


def load_treatments_for_article(rows: List[Dict[str, str]], text: str, ranges: Dict[str, Tuple[int, int]]) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    for r in rows:
        start = to_int(r.get("finding_start", "0"))
        end = to_int(r.get("finding_end", "0"))
        raw = normalize_space(r.get("entity_text_raw", ""))
        normalized = normalize_space(r.get("entity_text_normalized", ""))
        canonical = canonicalize_treatment(normalized or raw)

        out.append({
            "file_name": r.get("file_name", ""),
            "article_id": r.get("article_id", ""),
            "article_title": r.get("article_title", ""),
            "start": start,
            "end": end,
            "text_raw": raw,
            "text_normalized": normalized,
            "canonical_name": canonical,
            "alias_name": "",
            "alias_type": "",
            "entity_group": normalize_space(r.get("entity_group", "")),
            "review_needed": to_int(r.get("review_needed", "0")),
            "review_reason": normalize_space(r.get("review_reason", "")),
            "section": detect_section(start, end, ranges),
        })
    return sorted(out, key=lambda x: (x["start"], x["end"], str(x["canonical_name"]).lower(), str(x["entity_group"])))


# -----------------------------
# Speaker Window Helpers
# -----------------------------

def extract_name_tokens(provider_name: str) -> List[str]:
    text = lower_clean(provider_name)
    text = text.replace(".", " ")
    tokens = re.findall(r"[a-zäöüß]{3,}", text)
    stop = {
        "dr", "prof", "med", "arzt", "ärztin", "therapeut", "therapeutin",
        "heilpraktiker", "heilpraktikerin"
    }
    tokens = [t for t in tokens if t not in stop]
    return tokens


def best_name_token(provider_name: str) -> str:
    tokens = extract_name_tokens(provider_name)
    if not tokens:
        return lower_clean(provider_name)
    return max(tokens, key=len)


def title_supports_provider(article_title: str, provider_name: str) -> bool:
    title_l = lower_clean(article_title)
    token = best_name_token(provider_name)

    if token not in title_l:
        return False

    return any(re.search(p, title_l) for p in TITLE_CONNECTOR_PATTERNS)


def sentence_has_speaker_marker(sent_text: str) -> bool:
    sent_l = lower_clean(sent_text)
    return any(re.search(p, sent_l) for p in SPEAKER_TEXT_PATTERNS)


def sentence_has_provider(sent_text: str, provider_name: str) -> bool:
    sent_l = lower_clean(sent_text)
    token = best_name_token(provider_name)
    return token in sent_l


def find_speaker_anchor(text: str, content_start: int, content_end: int, provider_name: str) -> Optional[Tuple[int, int]]:
    sentences = split_sentences_with_positions(text, content_start, content_end)

    for i, sent in enumerate(sentences):
        if sentence_has_provider(str(sent["text"]), provider_name) and sentence_has_speaker_marker(str(sent["text"])):
            return (int(sent["start"]), int(sent["end"]))

        if i + 1 < len(sentences):
            next_sent = sentences[i + 1]
            if sentence_has_speaker_marker(str(sent["text"])) and sentence_has_provider(str(next_sent["text"]), provider_name):
                return (int(sent["start"]), int(next_sent["end"]))

        if i + 1 < len(sentences):
            next_sent = sentences[i + 1]
            if sentence_has_provider(str(sent["text"]), provider_name) and sentence_has_speaker_marker(str(next_sent["text"])):
                return (int(sent["start"]), int(next_sent["end"]))

    return None


def paragraph_has_stop(para_text: str, other_provider_names: List[str]) -> bool:
    para_l = lower_clean(para_text)

    if any(re.search(p, para_l) for p in CTA_PATTERNS):
        return True

    for other in other_provider_names:
        token = best_name_token(other)
        if token and token in para_l:
            return True

    return False


def build_speaker_windows(
    full_text: str,
    article_title: str,
    providers: List[Dict[str, object]],
    ranges: Dict[str, Tuple[int, int]],
    max_paragraphs: int = 6,
) -> Tuple[List[Dict[str, object]], int, int]:
    windows: List[Dict[str, object]] = []
    title_hits = 0
    text_hits = 0

    if "content" not in ranges:
        return windows, title_hits, text_hits

    content_start, content_end = ranges["content"]
    paragraphs = split_paragraphs_with_positions(full_text, content_start, content_end)

    unique_providers = []
    seen = set()
    for p in providers:
        key = (str(p["text_raw"]).strip().lower(), str(p["provider_type"]).strip().lower())
        if key in seen:
            continue
        seen.add(key)
        unique_providers.append(p)

    for provider in unique_providers:
        provider_name = str(provider["text_raw"])

        if not title_supports_provider(article_title, provider_name):
            continue
        title_hits += 1

        anchor = find_speaker_anchor(full_text, content_start, content_end, provider_name)
        if not anchor:
            continue
        text_hits += 1

        anchor_start, anchor_end = anchor

        anchor_para_idx = None
        for i, para in enumerate(paragraphs):
            if anchor_start >= para["start"] and anchor_end <= para["end"]:
                anchor_para_idx = i
                break

        if anchor_para_idx is None:
            continue

        other_names = [
            str(x["text_raw"]) for x in unique_providers
            if str(x["text_raw"]).strip().lower() != provider_name.strip().lower()
        ]

        end_idx = anchor_para_idx
        counted = 0

        for i in range(anchor_para_idx, len(paragraphs)):
            para = paragraphs[i]
            if counted > 0 and paragraph_has_stop(str(para["text"]), other_names):
                break
            end_idx = i
            counted += 1
            if counted >= max_paragraphs:
                break

        windows.append({
            "provider_name": provider_name,
            "provider_type": str(provider["provider_type"]),
            "start": int(paragraphs[anchor_para_idx]["start"]),
            "end": int(paragraphs[end_idx]["end"]),
            "section": "content",
            "context_mode": "speaker_window",
        })

    return windows, title_hits, text_hits


# -----------------------------
# Matching-Regeln
# -----------------------------

def recommendation_type_from_group(group: str) -> str:
    g = (group or "").lower()
    if g == "diagnosis":
        return "Diagnose"
    if g == "test":
        return "Diagnose"
    return "Behandlung"


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

    if treatment_raw_l in GENERIC_TREATMENT_TERMS:
        score -= 2
        reasons.append("generic_treatment_term")

    if any(x in provider_raw_l for x in ["programm", "retreat", "coach"]):
        reasons.append("extended_provider_type")

    if str(provider.get("context_mode", "")) == "speaker_window":
        score += 2
        reasons.append("speaker_window_context")

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


def should_write_debug(verdict: Dict[str, object]) -> bool:
    status = str(verdict["status"])
    same_paragraph = int(verdict["same_paragraph"])
    gap = int(verdict["char_gap"])

    if status in ("direct", "review"):
        return True

    if status == "reject" and (same_paragraph == 1 or gap <= 220):
        return True

    return False


# -----------------------------
# Dedupe / Ranking
# -----------------------------

def evidence_rank(value: str) -> int:
    if value == "high":
        return 2
    if value == "medium":
        return 1
    return 0


def context_mode_rank(value: str) -> int:
    if value == "explicit":
        return 2
    if value == "speaker_window":
        return 1
    return 0


def row_quality_score(row: Dict[str, str]) -> Tuple[int, int, int, int]:
    review_rank = 1 if row.get("review_mapping", "") == "0" else 0
    ev_rank = evidence_rank(row.get("evidence_strength", ""))
    context_rank = context_mode_rank(row.get("match_notes", "").replace("context=", ""))
    excerpt_len = len(row.get("evidence_excerpt", "") or "")
    return (review_rank, ev_rank, context_rank, excerpt_len)


def dedupe_mapping_rows_global(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    grouped: Dict[Tuple[str, str], List[Dict[str, str]]] = {}

    for row in rows:
        key = (
            row["doctor_name"].strip().lower(),
            row["treatment_name_normalized"].strip().lower(),
        )
        grouped.setdefault(key, []).append(row)

    out: List[Dict[str, str]] = []
    for _, items in grouped.items():
        items_sorted = sorted(items, key=row_quality_score, reverse=True)
        winner = items_sorted[0]

        if len(items_sorted) > 1:
            dropped = [x["id"] for x in items_sorted[1:]]
            winner["notes"] = (winner["notes"] + f" | global_dedupe_dropped_ids={','.join(dropped)}").strip()

        out.append(winner)

    out.sort(key=lambda x: (
        x["doctor_name"].lower(),
        x["treatment_name_normalized"].lower(),
        x["source_id"].lower(),
    ))
    return out


# -----------------------------
# Output
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
        f"provider_context_mode={provider.get('context_mode', 'explicit')}",
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
        "treatment_name_normalized": str(treatment["canonical_name"]),
        "review_mapping": review_mapping,
        "review_mapping_notes": review_mapping_notes,
        "recommendation_type": recommendation_type,
        "evidence_excerpt": verdict["window_excerpt"][:1000],
        "evidence_strength": verdict["evidence_strength"],
        "treat_id": "",
        "treat_match_status": "",
        "match_notes": f"context={provider.get('context_mode', 'explicit')}",
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


def debug_row(meta: Dict[str, str], provider: Dict[str, object], treatment: Dict[str, object], verdict: Dict[str, object]) -> Dict[str, str]:
    return {
        "file_name": meta.get("file_name", ""),
        "article_id": meta.get("article_id", ""),
        "article_title": meta.get("article_title", ""),
        "provider_name": str(provider["text_raw"]),
        "provider_start": str(provider["start"]),
        "provider_end": str(provider["end"]),
        "provider_type": str(provider["provider_type"]),
        "provider_context_mode": str(provider.get("context_mode", "explicit")),
        "treatment_name_raw": str(treatment["text_raw"]),
        "treatment_name_normalized": str(treatment["text_normalized"]),
        "treatment_canonical": str(treatment["canonical_name"]),
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


# -----------------------------
# Candidate construction
# -----------------------------

def explicit_provider_candidates(providers: List[Dict[str, object]]) -> List[Dict[str, object]]:
    out = []
    for p in providers:
        x = dict(p)
        x["context_mode"] = "explicit"
        out.append(x)
    return out


def speaker_window_candidates(
    full_text: str,
    meta: Dict[str, str],
    providers: List[Dict[str, object]],
    ranges: Dict[str, Tuple[int, int]],
) -> Tuple[List[Dict[str, object]], int, int]:
    windows, title_hits, text_hits = build_speaker_windows(
        full_text=full_text,
        article_title=meta.get("article_title", ""),
        providers=providers,
        ranges=ranges,
        max_paragraphs=6,
    )
    out = []
    for w in windows:
        out.append({
            "file_name": meta.get("file_name", ""),
            "article_id": meta.get("article_id", ""),
            "article_title": meta.get("article_title", ""),
            "start": int(w["start"]),
            "end": int(w["end"]),
            "text_raw": str(w["provider_name"]),
            "text_normalized": lower_clean(str(w["provider_name"])),
            "provider_type": str(w["provider_type"]),
            "review_needed": 0,
            "review_reason": "",
            "section": str(w["section"]),
            "context_mode": str(w["context_mode"]),
        })
    return out, title_hits, text_hits


# -----------------------------
# Hauptlauf
# -----------------------------

def process_one_article(
    txt_path: str,
    provider_rows: List[Dict[str, str]],
    treatment_rows: List[Dict[str, str]],
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]], Dict[str, str]]:
    full_text = read_text(txt_path)
    meta = get_metadata(full_text, os.path.basename(txt_path))
    ranges = section_ranges(full_text)

    if not ranges:
        return [], [], {
            "file_name": meta.get("file_name", os.path.basename(txt_path)),
            "article_id": meta.get("article_id", ""),
            "article_title": meta.get("article_title", ""),
            "txt_path": txt_path,
            "status": "skipped",
            "providers_found": "0",
            "treatments_found": "0",
            "speaker_title_hits": "0",
            "speaker_text_hits": "0",
            "speaker_windows_built": "0",
            "provider_candidates_total": "0",
            "mapping_rows_added": "0",
            "debug_rows_added": "0",
            "message": "CONTENT/COMMENTS-Abschnitte nicht erkannt",
        }

    providers = load_providers_for_article(provider_rows, full_text, ranges)
    treatments = load_treatments_for_article(treatment_rows, full_text, ranges)

    if not providers and not treatments:
        return [], [], {
            "file_name": meta.get("file_name", os.path.basename(txt_path)),
            "article_id": meta.get("article_id", ""),
            "article_title": meta.get("article_title", ""),
            "txt_path": txt_path,
            "status": "skipped",
            "providers_found": "0",
            "treatments_found": "0",
            "speaker_title_hits": "0",
            "speaker_text_hits": "0",
            "speaker_windows_built": "0",
            "provider_candidates_total": "0",
            "mapping_rows_added": "0",
            "debug_rows_added": "0",
            "message": "keine passenden Provider- und Treatment-Zeilen",
        }

    provider_candidates = explicit_provider_candidates(providers)
    speaker_candidates, speaker_title_hits, speaker_text_hits = speaker_window_candidates(
        full_text=full_text,
        meta=meta,
        providers=providers,
        ranges=ranges,
    )
    provider_candidates.extend(speaker_candidates)

    mapping_rows: List[Dict[str, str]] = []
    debug_rows: List[Dict[str, str]] = []

    idx = 1
    for provider in provider_candidates:
        for treatment in treatments:
            verdict = pair_score(full_text, provider, treatment)

            if should_write_debug(verdict):
                debug_rows.append(debug_row(meta, provider, treatment, verdict))

            if verdict["status"] not in ("direct", "review"):
                continue

            mapping_rows.append(mapping_row(idx, meta, provider, treatment, verdict))
            idx += 1

    log_row = {
        "file_name": meta.get("file_name", os.path.basename(txt_path)),
        "article_id": meta.get("article_id", ""),
        "article_title": meta.get("article_title", ""),
        "txt_path": txt_path,
        "status": "processed",
        "providers_found": str(len(providers)),
        "treatments_found": str(len(treatments)),
        "speaker_title_hits": str(speaker_title_hits),
        "speaker_text_hits": str(speaker_text_hits),
        "speaker_windows_built": str(len(speaker_candidates)),
        "provider_candidates_total": str(len(provider_candidates)),
        "mapping_rows_added": str(len(mapping_rows)),
        "debug_rows_added": str(len(debug_rows)),
        "message": "",
    }

    return mapping_rows, debug_rows, log_row


def renumber_rows(rows: List[Dict[str, str]]) -> None:
    for i, row in enumerate(rows, start=1):
        row["id"] = str(i)


def run(
    input_dirs: List[str],
    suchlauf1_dir: str,
    output_mapping_csv: str,
    output_debug_csv: str,
    output_runlog_csv: str,
) -> Dict[str, object]:
    providers_csv = os.path.join(suchlauf1_dir, "alt_suchlauf1_v2__providers.csv")
    treatments_csv = os.path.join(suchlauf1_dir, "alt_suchlauf1_v2__treatments.csv")
    symptoms_csv = os.path.join(suchlauf1_dir, "alt_suchlauf1_v2__symptoms.csv")  # aktuell nur mitgeführt

    all_provider_rows = read_csv_rows(providers_csv)
    all_treatment_rows = read_csv_rows(treatments_csv)
    _all_symptom_rows = read_csv_rows(symptoms_csv)

    providers_by_file_name, providers_by_article_id = build_row_indexes(all_provider_rows)
    treatments_by_file_name, treatments_by_article_id = build_row_indexes(all_treatment_rows)

    txt_files = collect_txt_files(input_dirs)

    all_mapping_rows: List[Dict[str, str]] = []
    all_debug_rows: List[Dict[str, str]] = []
    runlog_rows: List[Dict[str, str]] = []

    processed_count = 0
    skipped_count = 0
    error_count = 0

    for i, txt_path in enumerate(txt_files, start=1):
        file_name = os.path.basename(txt_path)
        try:
            full_text = read_text(txt_path)
            meta = get_metadata(full_text, file_name)
            article_id = meta.get("article_id", "")

            provider_rows = select_rows_for_article(
                providers_by_file_name, providers_by_article_id, file_name, article_id
            )
            treatment_rows = select_rows_for_article(
                treatments_by_file_name, treatments_by_article_id, file_name, article_id
            )

            mapping_rows, debug_rows, log_row = process_one_article(
                txt_path=txt_path,
                provider_rows=provider_rows,
                treatment_rows=treatment_rows,
            )

            all_mapping_rows.extend(mapping_rows)
            all_debug_rows.extend(debug_rows)
            runlog_rows.append(log_row)

            if log_row["status"] == "processed":
                processed_count += 1
            else:
                skipped_count += 1

        except Exception as e:
            error_count += 1
            runlog_rows.append({
                "file_name": file_name,
                "article_id": "",
                "article_title": "",
                "txt_path": txt_path,
                "status": "error",
                "providers_found": "0",
                "treatments_found": "0",
                "speaker_title_hits": "0",
                "speaker_text_hits": "0",
                "speaker_windows_built": "0",
                "provider_candidates_total": "0",
                "mapping_rows_added": "0",
                "debug_rows_added": "0",
                "message": str(e),
            })

        if i % 10 == 0:
            print(i, flush=True)

    all_mapping_rows = dedupe_mapping_rows_global(all_mapping_rows)
    renumber_rows(all_mapping_rows)

    write_csv(output_mapping_csv, MAPPING_FIELDS, all_mapping_rows)
    write_csv(output_debug_csv, DEBUG_FIELDS, all_debug_rows)
    write_csv(output_runlog_csv, RUNLOG_FIELDS, runlog_rows)

    return {
        "txt_files_found": len(txt_files),
        "processed_files": processed_count,
        "skipped_files": skipped_count,
        "error_files": error_count,
        "mapping_rows_out": len(all_mapping_rows),
        "debug_rows_out": len(all_debug_rows),
        "runlog_rows_out": len(runlog_rows),
        "providers_csv": providers_csv,
        "treatments_csv": treatments_csv,
        "symptoms_csv": symptoms_csv,
        "output_mapping_csv": output_mapping_csv,
        "output_debug_csv": output_debug_csv,
        "output_runlog_csv": output_runlog_csv,
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Suchlauf 2 V2 – Gesamtlauf über mehrere TXT-Ordner mit Sammeldateien aus Suchlauf 1")
    p.add_argument("--input-dirs", nargs="+", required=True, help="Mehrere TXT-Ordner")
    p.add_argument("--suchlauf1-dir", required=True, help="Ordner mit alt_suchlauf1_v2__providers.csv / symptoms / treatments")
    p.add_argument("--output-mapping-csv", required=True, help="Fortlaufende Hauptdatei")
    p.add_argument("--output-debug-csv", required=True, help="Fortlaufende Debug-Datei")
    p.add_argument("--output-runlog-csv", required=True, help="Protokolldatei")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    result = run(
        input_dirs=args.input_dirs,
        suchlauf1_dir=args.suchlauf1_dir,
        output_mapping_csv=args.output_mapping_csv,
        output_debug_csv=args.output_debug_csv,
        output_runlog_csv=args.output_runlog_csv,
    )
    print("status=ok")
    for k, v in result.items():
        print(f"{k}={v}")


if __name__ == "__main__":
    main()