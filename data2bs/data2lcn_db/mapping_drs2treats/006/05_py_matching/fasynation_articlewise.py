#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple

DEFAULT_SOURCE_NAME = "Fasynation"

BATCH_BY_PREFIX = {
    "blog_": ("blog", "006_fasynation_blog_pages_v1"),
    "iep_": ("intern_episodentexte", "006_fasynation_intern_episodentexte_pages_v1"),
    "ifm_": ("intern_fasymail", "006_fasynation_intern_fasymail_pages_v1"),
}

# Nur Provider finden
PROVIDER_PATTERNS = [
    r"\b(?:Prof\.?\s*Dr\.?\s*Dr\.?|Prof\.?\s*Dr\.?|Professor|Dr\.?\s*med\.?|Dr\.?)\s+[A-ZÄÖÜ][a-zäöüß\-]+(?:\s+[A-ZÄÖÜ][a-zäöüß\-]+){0,3}",
    r"\bDoc\s+Jay\b",
    r"\bBirgitt\s+Theuerkauf\b",
    r"\bHopf-?Seidel\b",
    r"\bElmar\s+Wienecke\b",
    r"\bDr\.?\s*Kacik\b",
    r"\bProf\.?\s*Dr\.?\s*Stark\b",
    r"\bGupta\s+Programm\b",
    r"\bSafety\s+Retreat\b",
]

# Nur konkrete Treatment-/Themenkandidaten finden
# KEINE generischen Wörter wie Diagnose / Behandlung
TREATMENT_PATTERNS = [
    r"\bMikronährstoffe?\b",
    r"\bMangelerscheinungen\b",
    r"\bAusgleich(?:en)?\s+von\s+Mängeln\b",
    r"\bakute\s+Borreliose\b",
    r"\bchronische\s+Borreliose\b",
    r"\bBorreliose\b",
    r"\bEntgiftung\b",
    r"\bSchwermetallausleitung\b",
    r"\bEntgiftungsprotokolle\b",
    r"\bTSH(?:-basal)?\b",
    r"\bSchilddrüsenwerte\b",
    r"\bVagusnerv\b",
    r"\bautonom(?:es|en)?\s+Nervensystem\b",
    r"\bPacing\b",
    r"\bReizreduktion\b",
    r"\bNervensystemregulation\b",
    r"\bAtemübungen\b",
    r"\bMeditation\b",
    r"\bJournaling\b",
    r"\bBrain\s*Retraining\b",
    r"\bAchtsamkeit\b",
    r"\bMitochondrientherapie\b",
    r"\bButeyko\s+Atmung\b",
    r"\bBauchatmung\b",
    r"\bStressreduzierung\b",
    r"\bGupta\s+Programm\b",
]

POSITIVE_TRIGGERS = [
    r"\bbehandelt\b",
    r"\bbegleitet\b",
    r"\bbietet\b",
    r"\bempfiehlt\b",
    r"\barbeitet\b.*\bmit\b",
    r"\bnutzt\b",
    r"\bverordnet\b",
    r"\bführt\b.*\bdurch\b",
    r"\btherapiert\b",
    r"\bhilft\b",
    r"\berklärt\b",
    r"\bspricht\b.*\bübe?r\b",
    r"\bgeht\b.*\bein\b",
    r"\bverrät\b",
    r"\bPodcast-Episode\b",
    r"\bInterview\b",
    r"\bMehr\b.*\bfindest\b.*\bin\b",
]

NEGATIVE_TRIGGERS = [
    r"\bDisclaimer\b",
    r"\bkeine medizinische Beratung\b",
]

REVIEW_NOTES = {
    "topic_link": "topic link",
    "neg_context": "neg context",
}

@dataclass
class Mention:
    text: str
    sentence_idx: int
    paragraph_idx: int
    kind: str

@dataclass
class MatchRow:
    id: int
    decision: str
    dr_id: str
    doctor_name: str
    treatment_name_raw: str
    treatment_name_normalized: str
    review_mapping: int
    review_mapping_notes: str
    recommendation_type: str
    evidence_excerpt: str
    evidence_strength: str
    treat_id: str
    treat_match_status: str
    match_notes: str
    review_matching: int
    review_matching_notes: str
    alias_name: str
    alias_type: str
    sort_order: str
    notes: str
    source_batch_id: str
    source_id: str
    source_name: str

def compile_patterns(patterns: Iterable[str]) -> List[re.Pattern]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]

PROVIDER_REGEXES = compile_patterns(PROVIDER_PATTERNS)
TREATMENT_REGEXES = compile_patterns(TREATMENT_PATTERNS)
POSITIVE_REGEXES = compile_patterns(POSITIVE_TRIGGERS)
NEGATIVE_REGEXES = compile_patterns(NEGATIVE_TRIGGERS)

def infer_batch_from_filename(filename: str) -> Tuple[str, str]:
    for prefix, values in BATCH_BY_PREFIX.items():
        if filename.startswith(prefix):
            return values
    return ("unknown_batch", "unknown_source_batch_id")

def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def extract_content(text: str) -> str:
    m = re.search(r"=== CONTENT START ===(.*?)=== CONTENT END ===", text, flags=re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else text

def split_paragraphs(text: str) -> List[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

def split_sentences(paragraph: str) -> List[str]:
    p = paragraph
    replacements = {
        "Prof. Dr. Dr.": "Prof§ Dr§ Dr§",
        "Prof. Dr.": "Prof§ Dr§",
        "Dr. med.": "Dr§ med§",
        "Prof.": "Prof§",
        "Professor.": "Professor§",
        "Dr.": "Dr§",
        "med.": "med§",
    }
    for old, new in replacements.items():
        p = p.replace(old, new)

    parts = re.split(r"(?<=[\.\!\?\:])\s+(?=[A-ZÄÖÜ0-9\"„\-])", p)
    parts = [x.strip() for x in parts if x.strip()]

    out = []
    for part in parts:
        part = part.replace("Prof§", "Prof.")
        part = part.replace("Professor§", "Professor.")
        part = part.replace("Dr§", "Dr.")
        part = part.replace("med§", "med.")
        out.append(part)
    return out

def sentence_has_positive_trigger(sentence: str) -> bool:
    return any(rx.search(sentence) for rx in POSITIVE_REGEXES)

def sentence_has_negative_trigger(sentence: str) -> bool:
    return any(rx.search(sentence) for rx in NEGATIVE_REGEXES)

def provider_core_name(name: str) -> str:
    n = name.strip()
    n = re.sub(r"\bProf\.?\b", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\bProfessor\b", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\bDr\.?\s*med\.?\b", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\bDr\.?\b", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\s+", " ", n).strip(" ,.-")
    return n.lower()

def provider_display_score(name: str) -> tuple:
    n = name.strip()
    has_prof = 1 if re.search(r"\b(?:Prof\.?|Professor)\b", n, flags=re.IGNORECASE) else 0
    has_drmed = 1 if re.search(r"\bDr\.?\s*med\.?\b", n, flags=re.IGNORECASE) else 0
    has_dr = 1 if re.search(r"\bDr\.?\b", n, flags=re.IGNORECASE) else 0
    return (has_prof, has_drmed, has_dr, len(n))

def canonicalize_provider_names(rows: List[MatchRow]) -> List[MatchRow]:
    best_by_core = {}
    for row in rows:
        core = provider_core_name(row.doctor_name)
        current = best_by_core.get(core)
        if current is None or provider_display_score(row.doctor_name) > provider_display_score(current):
            best_by_core[core] = row.doctor_name

    for row in rows:
        core = provider_core_name(row.doctor_name)
        row.doctor_name = best_by_core[core]
    return rows

def find_mentions(paragraphs: List[List[str]]) -> Tuple[List[Mention], List[Mention]]:
    providers, treatments = [], []
    for p_idx, sents in enumerate(paragraphs):
        for s_idx, sent in enumerate(sents):
            for rx in PROVIDER_REGEXES:
                for m in rx.finditer(sent):
                    providers.append(Mention(m.group(0).strip(), s_idx, p_idx, "provider"))
            for rx in TREATMENT_REGEXES:
                for m in rx.finditer(sent):
                    treatments.append(Mention(m.group(0).strip(), s_idx, p_idx, "treatment"))
    return providers, treatments

def build_excerpt(paragraphs: List[List[str]], p_idx: int, s_idx: int) -> str:
    local = paragraphs[p_idx]
    start = max(0, s_idx - 1)
    end = min(len(local), s_idx + 2)
    return " ".join(local[start:end]).strip()

def dedupe_rows(rows: List[MatchRow]) -> List[MatchRow]:
    seen = set()
    out = []
    for r in rows:
        key = (r.source_id, provider_core_name(r.doctor_name), r.treatment_name_raw.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out

def process_file(filepath: Path, start_id: int) -> Tuple[List[MatchRow], int]:
    raw = normalize_text(filepath.read_text(encoding="utf-8", errors="replace"))
    body = extract_content(raw)

    filename = filepath.stem
    batch_name, source_batch_id = infer_batch_from_filename(filename)

    title_match = re.search(r"TITLE_INPUT:\s*(.+)", raw)
    url_match = re.search(r"URL:\s*(.+)", raw)

    title_input = title_match.group(1).strip() if title_match else filename
    url = url_match.group(1).strip() if url_match else ""

    paragraphs_raw = split_paragraphs(body)
    paragraphs = [split_sentences(p) for p in paragraphs_raw]

    providers, treatments = find_mentions(paragraphs)
    providers = sorted(providers, key=lambda m: provider_display_score(m.text), reverse=True)

    rows: List[MatchRow] = []
    next_id = start_id

    for prov in providers:
        for treat in treatments:
            if prov.paragraph_idx != treat.paragraph_idx:
                continue

            sent_dist = abs(prov.sentence_idx - treat.sentence_idx)
            if sent_dist > 3:
                continue

            evidence_sent = paragraphs[treat.paragraph_idx][treat.sentence_idx]
            excerpt = build_excerpt(paragraphs, treat.paragraph_idx, treat.sentence_idx)

            review_mapping = 0
            review_note = ""
            evidence_strength = "medium"

            if sentence_has_negative_trigger(evidence_sent):
                review_mapping = 1
                review_note = REVIEW_NOTES["neg_context"]

            if sentence_has_positive_trigger(excerpt):
                evidence_strength = "high"
            else:
                review_mapping = 1
                review_note = REVIEW_NOTES["topic_link"]

            rows.append(MatchRow(
                id=next_id,
                decision="",
                dr_id="",
                doctor_name=prov.text,
                treatment_name_raw=treat.text,
                treatment_name_normalized=treat.text,
                review_mapping=review_mapping,
                review_mapping_notes=review_note,
                recommendation_type="",
                evidence_excerpt=excerpt,
                evidence_strength=evidence_strength,
                treat_id="",
                treat_match_status="",
                match_notes="",
                review_matching=0,
                review_matching_notes="",
                alias_name="",
                alias_type="",
                sort_order="",
                notes=f"title={title_input} | url={url} | batch={batch_name}",
                source_batch_id=source_batch_id,
                source_id=filename,
                source_name=DEFAULT_SOURCE_NAME,
            ))
            next_id += 1

    rows = canonicalize_provider_names(rows)
    rows = dedupe_rows(rows)
    return rows, next_id

CSV_FIELDS = [
    "id", "decision", "dr_id", "doctor_name", "treatment_name_raw",
    "treatment_name_normalized", "review_mapping", "review_mapping_notes",
    "recommendation_type", "evidence_excerpt", "evidence_strength",
    "treat_id", "treat_match_status", "match_notes",
    "review_matching", "review_matching_notes",
    "alias_name", "alias_type", "sort_order", "notes",
    "source_batch_id", "source_id", "source_name",
]

def write_csv(rows: List[MatchRow], outpath: Path) -> None:
    outpath.parent.mkdir(parents=True, exist_ok=True)
    with outpath.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for r in rows:
            writer.writerow(r.__dict__)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--glob", default="*.txt")
    parser.add_argument("--output-csv", required=True)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    files = sorted(input_dir.glob(args.glob))
    if not files:
        raise SystemExit(f"Keine Dateien gefunden: {input_dir} / {args.glob}")

    all_rows = []
    next_id = 1

    for fp in files:
        rows, next_id = process_file(fp, next_id)
        all_rows.extend(rows)

    write_csv(all_rows, Path(args.output_csv))
    print(f"written_rows={len(all_rows)}")
    print(f"written_file={args.output_csv}")

if __name__ == "__main__":
    main()