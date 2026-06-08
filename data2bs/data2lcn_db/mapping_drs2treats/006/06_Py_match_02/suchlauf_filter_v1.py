#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import os
import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Sequence, Tuple


# =========================
# Final output row models
# =========================

@dataclass
class ProviderRow:
    file_name: str
    article_id: str
    article_title: str
    finding_start: int
    finding_end: int
    entity_text_raw: str
    entity_text_normalized: str
    provider_type: str
    review_needed: int
    review_reason: str


@dataclass
class SymptomRow:
    file_name: str
    article_id: str
    article_title: str
    finding_start: int
    finding_end: int
    entity_text_raw: str
    entity_text_normalized: str
    review_needed: int
    review_reason: str


@dataclass
class EntityRow:
    file_name: str
    article_id: str
    article_title: str
    finding_start: int
    finding_end: int
    entity_text_raw: str
    entity_text_normalized: str
    entity_group: str
    review_needed: int
    review_reason: str


# =========================
# Raw input row models
# =========================

@dataclass
class RawProviderRow:
    file_name: str
    article_id: str
    article_title: str
    section_label: str
    finding_start: int
    finding_end: int
    raw_match_text: str
    pattern_label: str


@dataclass
class RawSymptomRow:
    file_name: str
    article_id: str
    article_title: str
    section_label: str
    finding_start: int
    finding_end: int
    raw_match_text: str
    phrase_label: str


@dataclass
class RawEntityRow:
    file_name: str
    article_id: str
    article_title: str
    section_label: str
    finding_start: int
    finding_end: int
    raw_match_text: str
    entity_group: str
    pattern_label: str


# =========================
# Constants from old script
# =========================

REVIEW_GENERAL_TERMS = {
    "Therapie", "Behandlung", "Maßnahme", "Programm", "Übung", "Diagnostik", "Untersuchung",
    "Symptom", "Erkrankung", "Störung", "Entzündung",
}

STOP_PHRASES = {
    "CONTENT START", "CONTENT END", "COMMENTS START", "COMMENTS END",
    "COMMENT", "AUTHOR", "DATE", "TEXT", "URL", "SOURCE_NAME", "BATCH_NAME", "TITLE_INPUT", "PAGE_ID",
}

GENERIC_ENTITY_EXCLUDE = {
    "behandlung", "behandlungen", "therapie", "therapien", "diagnose", "diagnosen",
    "maßnahme", "maßnahmen", "programm", "programme", "übung", "übungen"
}


# =========================
# Basic helpers
# =========================

def read_text(path: str) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, "r", encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"Datei konnte nicht gelesen werden: {path}")


def light_normalize(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^[\s\-–—:;,.]+", "", text)
    text = re.sub(r"[\s\-–—:;,.]+$", "", text)
    return text.lower()


def clean_raw_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^[\-–—:;,\.\)\]]+", "", text).strip()
    text = re.sub(r"[\-–—:;,\.\(\[]+$", "", text).strip()
    return text


def phrase_is_noise(text: str) -> bool:
    if not text:
        return True
    if text in STOP_PHRASES:
        return True
    if len(text) <= 1:
        return True
    if re.fullmatch(r"\d+", text):
        return True
    return False


def derive_provider_type(raw: str, fallback: str) -> str:
    raw_l = raw.lower()
    if "heilpraktiker" in raw_l:
        return "heilpraktiker"
    if any(x in raw_l for x in ("dr.", "prof.")):
        return "physician"
    if "coach" in raw_l:
        return "coach"
    if any(x in raw_l for x in ("praxis", "klinik", "institut", "labor", "zentrum")):
        return "organization"
    if any(x in raw_l for x in ("programm", "retreat")):
        return "program"
    return fallback


def provider_review(raw: str) -> Tuple[int, str]:
    if any(x in raw.lower() for x in ("programm", "retreat", "coach")):
        return 1, "anbieterbegriff erweitert"
    if len(raw.split()) <= 1:
        return 1, "anbieter unklar"
    return 0, ""


def symptom_review(raw: str) -> Tuple[int, str]:
    if len(raw.split()) >= 5:
        return 1, "symptom phrase lang"
    return 0, ""


def entity_review(raw: str, group: str, from_comment: bool) -> Tuple[int, str]:
    if raw in REVIEW_GENERAL_TERMS:
        return 1, "zu allgemein"
    if from_comment:
        return 1, "nur im kommentar"
    if group == "diagnosis" and raw.lower() in {"erkrankung", "störung", "entzündung", "syndrom"}:
        return 1, "zu allgemein"
    return 0, ""


def sentence_window(full_text: str, start: int, end: int, window: int = 120) -> str:
    left = max(0, start - window)
    right = min(len(full_text), end + window)
    return full_text[left:right]


def strip_leading_provider_function_words(raw: str) -> str:
    text = clean_raw_text(raw)
    parts = text.split()

    function_words = {
        "das", "der", "die",
        "ihre", "seine", "ihr", "sein", "seines",
        "ein", "eine", "einer", "einem", "einen",
        "dieses", "dieser", "diese", "diesem", "diesen",
        "im", "in", "am", "an",
        "beim", "vom", "von",
        "zum", "zur",
        "mit"
    }

    while parts and parts[0].lower() in function_words:
        parts.pop(0)

    return " ".join(parts)


def normalize_role_prefixed_provider(raw: str) -> Optional[str]:
    text = clean_raw_text(raw)
    parts = text.split()

    if not parts:
        return None

    role_words = {"arzt", "ärztin", "therapeut", "therapeutin", "coach"}
    first = parts[0].lower()

    if first not in role_words:
        return text

    parts = parts[1:]
    if not parts:
        return None

    invalid_single_tokens = {
        "date", "author", "text", "url", "page", "comment",
        "prof", "med", "me", "ldn"
    }

    invalid_payload_tokens = {
        "obwohl", "abschließend", "gutes", "ausbildung",
        "mirtazapin", "kohlensäurebäder", "manchmal"
    }

    if len(parts) == 1:
        token = parts[0]
        token_l = token.lower()

        if token_l in invalid_single_tokens:
            return None

        return None

    for token in parts:
        token_l = token.lower()

        if token_l in invalid_single_tokens:
            return None
        if token_l in invalid_payload_tokens:
            return None
        if not re.match(r"^[A-ZÄÖÜ][\wÄÖÜäöüß\-]*$", token):
            return None

    return " ".join(parts)


def is_generic_provider_head_only(raw: str) -> bool:
    text = clean_raw_text(raw)
    parts = text.split()

    generic_heads = {
        "programm", "zentrum", "institut", "labor", "praxis", "klinik"
    }

    return len(parts) == 1 and parts[0].lower() in generic_heads


def is_verb_like_test_false_positive(raw: str) -> bool:
    text = clean_raw_text(raw).lower()

    if not text.endswith("test"):
        return False

    if text.endswith("-test"):
        return False

    if text in {
        "möchtest",
        "solltest",
        "arbeitest",
        "startest",
        "könntest",
        "konntest",
        "hattest",
        "beobachtest",
    }:
        return True

    return False


def dedupe_rows(rows: Sequence, key_fields: Sequence[str]) -> List:
    seen = set()
    out = []
    for row in rows:
        key = tuple(getattr(row, f) for f in key_fields)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def sort_final_rows(rows: Sequence) -> List:
    return sorted(rows, key=lambda r: (r.file_name.lower(), r.finding_start, r.finding_end, r.entity_text_raw.lower()))


def write_csv(path: str, rows: Sequence) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not rows:
        return
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def collect_txt_files(input_dirs: Sequence[str]) -> List[str]:
    files: List[str] = []
    for folder in input_dirs:
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            path = os.path.join(folder, name)
            if os.path.isfile(path) and name.lower().endswith(".txt"):
                files.append(path)
    return files


def build_raw_input_paths(raw_dir: str) -> Dict[str, str]:
    target_dir = os.path.join(raw_dir, "Suchlauf_1")
    return {
        "providers_raw": os.path.join(target_dir, "suchlauf1_collect__providers_raw.csv"),
        "symptoms_raw": os.path.join(target_dir, "suchlauf1_collect__symptoms_raw.csv"),
        "treatments_raw": os.path.join(target_dir, "suchlauf1_collect__treatments_raw.csv"),
    }


def build_output_paths(output_dir: str) -> Dict[str, str]:
    target_dir = os.path.join(output_dir, "Suchlauf_1")
    return {
        "providers": os.path.join(target_dir, "alt_suchlauf1_v2__providers.csv"),
        "symptoms": os.path.join(target_dir, "alt_suchlauf1_v2__symptoms.csv"),
        "treatments": os.path.join(target_dir, "alt_suchlauf1_v2__treatments.csv"),
    }


# =========================
# CSV readers
# =========================

def read_raw_providers_csv(path: str) -> List[RawProviderRow]:
    rows: List[RawProviderRow] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                RawProviderRow(
                    file_name=row["file_name"],
                    article_id=row["article_id"],
                    article_title=row["article_title"],
                    section_label=row["section_label"],
                    finding_start=int(row["finding_start"]),
                    finding_end=int(row["finding_end"]),
                    raw_match_text=row["raw_match_text"],
                    pattern_label=row["pattern_label"],
                )
            )
    return rows


def read_raw_symptoms_csv(path: str) -> List[RawSymptomRow]:
    rows: List[RawSymptomRow] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                RawSymptomRow(
                    file_name=row["file_name"],
                    article_id=row["article_id"],
                    article_title=row["article_title"],
                    section_label=row["section_label"],
                    finding_start=int(row["finding_start"]),
                    finding_end=int(row["finding_end"]),
                    raw_match_text=row["raw_match_text"],
                    phrase_label=row["phrase_label"],
                )
            )
    return rows


def read_raw_entities_csv(path: str) -> List[RawEntityRow]:
    rows: List[RawEntityRow] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                RawEntityRow(
                    file_name=row["file_name"],
                    article_id=row["article_id"],
                    article_title=row["article_title"],
                    section_label=row["section_label"],
                    finding_start=int(row["finding_start"]),
                    finding_end=int(row["finding_end"]),
                    raw_match_text=row["raw_match_text"],
                    entity_group=row["entity_group"],
                    pattern_label=row["pattern_label"],
                )
            )
    return rows


# =========================
# TXT lookup for context
# =========================

def build_text_lookup(input_dirs: Sequence[str]) -> Dict[str, str]:
    txt_files = collect_txt_files(input_dirs)
    if not txt_files:
        raise ValueError("Keine TXT-Dateien in den angegebenen Ordnern gefunden.")

    by_name: Dict[str, str] = {}
    duplicates: Dict[str, List[str]] = {}

    for path in txt_files:
        name = os.path.basename(path)
        if name in by_name:
            duplicates.setdefault(name, [by_name[name]]).append(path)
        else:
            by_name[name] = path

    if duplicates:
        lines = []
        for name, paths in sorted(duplicates.items()):
            joined = " | ".join(paths)
            lines.append(f"{name}: {joined}")
        raise ValueError(
            "Doppelte Dateinamen in den Input-Ordnern gefunden. Teil B kann mit file_name allein nicht eindeutig zuordnen:\n"
            + "\n".join(lines)
        )

    full_texts: Dict[str, str] = {}
    for name, path in by_name.items():
        full_texts[name] = read_text(path)

    return full_texts


# =========================
# Cleaning from raw rows
# =========================

def clean_providers(raw_rows: Sequence[RawProviderRow]) -> List[ProviderRow]:
    rows: List[ProviderRow] = []

    for r in raw_rows:
        raw = clean_raw_text(r.raw_match_text)
        raw = strip_leading_provider_function_words(raw)

        if phrase_is_noise(raw):
            continue
        if is_generic_provider_head_only(raw):
            continue

        raw = normalize_role_prefixed_provider(raw)
        if not raw:
            continue

        provider_type = derive_provider_type(raw, r.pattern_label)
        review_needed, review_reason = provider_review(raw)

        rows.append(
            ProviderRow(
                file_name=r.file_name,
                article_id=r.article_id,
                article_title=r.article_title,
                finding_start=r.finding_start,
                finding_end=r.finding_end,
                entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw),
                provider_type=provider_type,
                review_needed=review_needed,
                review_reason=review_reason,
            )
        )

    return rows


def clean_symptoms(raw_rows: Sequence[RawSymptomRow]) -> List[SymptomRow]:
    rows: List[SymptomRow] = []

    for r in raw_rows:
        raw = clean_raw_text(r.raw_match_text)

        if phrase_is_noise(raw):
            continue

        review_needed, review_reason = symptom_review(raw)

        rows.append(
            SymptomRow(
                file_name=r.file_name,
                article_id=r.article_id,
                article_title=r.article_title,
                finding_start=r.finding_start,
                finding_end=r.finding_end,
                entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw),
                review_needed=review_needed,
                review_reason=review_reason,
            )
        )

    return rows


def clean_entities(raw_rows: Sequence[RawEntityRow], full_texts: Dict[str, str]) -> List[EntityRow]:
    rows: List[EntityRow] = []

    generic_prefixes = (
        "behandlung von",
        "therapie von",
        "diagnose von",
        "diagnostik von",
        "untersuchung von",
        "maßnahme von",
    )

    context_keep_regex = re.compile(
        r"(konkret|gezielt|mögliche|erste|wichtige|hilft|unterstützt|empfiehlt|testen|behandeln)",
        flags=re.IGNORECASE,
    )

    for r in raw_rows:
        raw = clean_raw_text(r.raw_match_text)
        raw_l = raw.lower()
        group = r.entity_group

        if group == "diagnosis" and raw_l.endswith("test"):
            if is_verb_like_test_false_positive(raw):
                continue

        if phrase_is_noise(raw):
            continue

        if raw_l in GENERIC_ENTITY_EXCLUDE:
            continue

        if raw_l.startswith(generic_prefixes):
            review_needed = 1
            review_reason = "generische phrase mit spezifizierung"
        else:
            review_needed, review_reason = entity_review(raw, group, r.section_label == "comments")

        if raw in REVIEW_GENERAL_TERMS:
            full_text = full_texts.get(r.file_name, "")
            ctx = sentence_window(full_text, r.finding_start, r.finding_end)
            if not context_keep_regex.search(ctx):
                continue

        if group == "diagnosis" and raw_l in {"syndrom", "störung", "erkrankung", "entzündung", "schwäche"}:
            continue

        rows.append(
            EntityRow(
                file_name=r.file_name,
                article_id=r.article_id,
                article_title=r.article_title,
                finding_start=r.finding_start,
                finding_end=r.finding_end,
                entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw),
                entity_group=group,
                review_needed=review_needed,
                review_reason=review_reason,
            )
        )

    return rows


# =========================
# Run
# =========================

def run(raw_dir: str, input_dirs: Sequence[str], output_dir: str) -> Dict[str, object]:
    raw_paths = build_raw_input_paths(raw_dir)

    raw_providers = read_raw_providers_csv(raw_paths["providers_raw"])
    raw_symptoms = read_raw_symptoms_csv(raw_paths["symptoms_raw"])
    raw_entities = read_raw_entities_csv(raw_paths["treatments_raw"])

    full_texts = build_text_lookup(input_dirs)

    providers = clean_providers(raw_providers)
    symptoms = clean_symptoms(raw_symptoms)
    entities = clean_entities(raw_entities, full_texts)

    providers = dedupe_rows(
        sort_final_rows(providers),
        ["file_name", "finding_start", "finding_end", "entity_text_normalized", "provider_type"],
    )
    symptoms = dedupe_rows(
        sort_final_rows(symptoms),
        ["file_name", "finding_start", "finding_end", "entity_text_normalized"],
    )
    entities = dedupe_rows(
        sort_final_rows(entities),
        ["file_name", "finding_start", "finding_end", "entity_text_normalized", "entity_group"],
    )

    output_paths = build_output_paths(output_dir)
    write_csv(output_paths["providers"], providers)
    write_csv(output_paths["symptoms"], symptoms)
    write_csv(output_paths["treatments"], entities)

    return {
        "raw_dir": raw_dir,
        "input_dirs": list(input_dirs),
        "output_dir": output_dir,
        "providers_count": len(providers),
        "symptoms_count": len(symptoms),
        "treatments_count": len(entities),
        "providers_csv": output_paths["providers"],
        "symptoms_csv": output_paths["symptoms"],
        "treatments_csv": output_paths["treatments"],
    }


# =========================
# CLI
# =========================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Suchlauf 1 – Teil B: Bereinigung auf Basis der Raw-CSVs")
    parser.add_argument("--raw-dir", required=True, help="Ordner, unter dem Suchlauf_1 mit den Raw-CSVs liegt")
    parser.add_argument("--output-dir", required=True, help="Ausgabeordner für die finalen CSVs")
    parser.add_argument("--input-dirs", nargs="+", required=False, help="Liste der Eingabeordner mit TXT-Dateien")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_dirs = args.input_dirs or [
        r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\blog\txt",
        r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\intern_episodentexte\txt",
        r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\intern_fasymail\txt",
    ]

    result = run(args.raw_dir, input_dirs, args.output_dir)

    print("status=ok")
    for key, value in result.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()