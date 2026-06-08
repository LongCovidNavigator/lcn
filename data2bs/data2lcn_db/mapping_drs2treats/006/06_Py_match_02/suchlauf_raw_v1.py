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
# Raw row models
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

PROVIDER_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"\bProf\.\s*(?:Dr\.\s*){1,3}(?:med\.\s*)?[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "physician"),
    (r"\b(?:Dr\.\s*){1,3}(?:med\.\s*)?[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "physician"),
    (r"\bHeilpraktiker(?:in)?\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "heilpraktiker"),
    (r"\b(?:Ärztin|Arzt|Therapeut(?:in)?|Coach)\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "unknown"),
    (r"\b[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,4}\s+(?:Praxis|Klinik|Institut|Labor|Zentrum)\b", "organization"),
    (r"\b[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,4}\s+(?:Programm|Retreat)\b", "program"),
)

SYMPTOM_PHRASES: Sequence[str] = (
    "Fatigue", "chronische Erschöpfung", "Erschöpfung", "PEM", "Post-Exertional Malaise",
    "Brain Fog", "Konzentrationsschwierigkeiten", "Schlafstörungen", "unerholsamer Schlaf",
    "Schmerzen", "Gliederschmerzen", "Schwindel", "Herzrasen", "Atemprobleme",
    "Atem- und Kreislaufprobleme", "Grippegefühl", "Abgeschlagenheit", "Müdigkeit",
    "Kälteempfindlichkeit", "Verstopfung", "Gewichtszunahme", "Durchfall", "Übelkeit",
    "Bauchkrämpfe", "Hautrötungen", "Konzentrations- oder Denkprobleme", "Benommenheit",
    "Antriebslosigkeit", "ME/CFS", "CFS", "Long Covid", "Post Vac", "PostVac", "POTS",
    "MCAS", "Autoimmunerkrankung", "Autoimmunerkrankungen", "Borreliose",
    "chronische Borreliose", "akute Borreliose", "Hashimoto", "Hashimoto-Thyreoiditis",
    "Anämie", "HPU", "HIV", "Mitochondriopathie", "Hypothyreose", "Histamin-Intoleranz",
    "Histamin-Unverträglichkeit", "Leaky Gut", "Leaky Gut Syndrom", "Nebenniereninsuffizienz",
    "Diabetes", "Hyperkalzämie",
)

MEDICAL_TRIGGER_PATTERNS: Sequence[Tuple[str, str]] = (
    (r"\b[A-ZÄÖÜa-zäöüß0-9]+(?:-[A-ZÄÖÜa-zäöüß0-9]+){0,3}-(?:Diagnostik|Messung|Screening|Protokoll)\b", "diagnosis"),
    (r"\b[A-ZÄÖÜa-zäöüß]+(?:diagnostik|messung|screening|protokoll)\b", "diagnosis"),
    (r"\b[A-ZÄÖÜa-zäöüß0-9]+(?:-[A-ZÄÖÜa-zäöüß0-9]+){0,3}-(?:Training|Trainingsprogramm|Regel)\b", "treatment"),
    (r"\b[A-ZÄÖÜa-zäöüß]+(?:training|trainingsprogramm)\b", "treatment"),
    (r"\b(?:Behandlung|Therapie|Diagnostik|Untersuchung|Training)\s+(?:von|bei|durch|mit)\s+[A-ZÄÖÜa-zäöüß0-9\-/]+(?:\s+[A-ZÄÖÜa-zäöüß0-9\-/]+){0,4}\b", "treatment"),
    (r"\b(?:[0-9]{1,3}(?:[-/][0-9]{1,3})?(?:-Sekunden)?-(?:Regel|Training|Trainingsprogramm)|lohnende(?:\s+Pause|\s+Pausen))\b", "treatment"),
    (r"\b[A-ZÄÖÜa-zäöüß0-9]+(?:-[A-ZÄÖÜa-zäöüß0-9]+){0,2}-Test\b", "diagnosis"),
    (r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9]*test\b", "diagnosis"),
    (r"\b(?:Blutbild|Bluttest|Urintest|Stuhltest|Ultraschall|Kapillarmikroskopie|Handkraftmessung|Diagnostik|Untersuchung|Messung)\b", "diagnosis"),
    (r"\b(?:TSH(?:-Wert|basal)?|Cortisol-Tagesprofil|Antikörper|TPO-Antikörper|TG-Antikörper|fT3|fT4|freies T3|freies T4)\b", "diagnosis"),
    (r"\b(?:Pacing|Atemübungen|Meditation|Journaling|Brain Retraining|neuroplastisches Training|Vagusregulation|Stressreduzierung|Entgiftung|Mitochondrientherapie|Apherese|hyperbare Sauerstofftherapie|Bauchatmung|Buteyko Atmung|Supplemente?|Infusion(?:en)?|Antibiotika|Magnesium(?:-[A-Za-zÄÖÜäöüß]+)?|Vitamin D|K2|Q10|Carnitin|Zink|Mangan|L-Arginin|Cortisol)\b", "treatment"),
    (r"\bketogene Ernährung\b", "treatment"),
    (r"\bErnährungsumstellung\s+(?:nach\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,2}|mit\s+Verzicht\s+auf\s+[A-ZÄÖÜa-zäöüß0-9\-/]+(?:,\s*[A-ZÄÖÜa-zäöüß0-9\-/]+){0,8}(?:\s+und\s+[A-ZÄÖÜa-zäöüß0-9\-/]+)?)\b", "treatment"),
    (r"\bBasisentgiftung\b", "treatment"),
    (r"\bDarmentgiftung\b", "treatment"),
    (r"\bEntgiftungskonzept\b", "treatment"),
    (r"\bemotionale Regulation\b", "treatment"),
    (r"\bRegulation\s+des\s+autonomen\s+Nervensystems\b", "treatment"),
    (r"\b(?:Therapie|Behandlung|Maßnahme|Programm|Übung|Ernährung|Ausleitung|Meditation|Regulation|Retraining)\b", "treatment"),
)


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


def get_metadata(full_text: str, file_name: str) -> Dict[str, str]:
    article_id = ""
    article_title = ""

    m_id = re.search(r"^PAGE_ID:\s*(.+)$", full_text, flags=re.MULTILINE)
    if m_id:
        article_id = m_id.group(1).strip()

    m_title = re.search(r"^TITLE_INPUT:\s*(.+)$", full_text, flags=re.MULTILINE)
    if m_title:
        article_title = m_title.group(1).strip()

    return {
        "file_name": file_name,
        "article_id": article_id,
        "article_title": article_title,
    }


def section_ranges(full_text: str) -> List[Tuple[int, int, str]]:
    ranges: List[Tuple[int, int, str]] = []

    content_match = re.search(
        r"=== CONTENT START ===\n(.*?)\n=== CONTENT END ===",
        full_text,
        flags=re.DOTALL,
    )
    if content_match:
        ranges.append((content_match.start(1), content_match.end(1), "content"))

    comments_match = re.search(
        r"=== COMMENTS START ===\n(.*?)\n=== COMMENTS END ===",
        full_text,
        flags=re.DOTALL,
    )
    if comments_match:
        ranges.append((comments_match.start(1), comments_match.end(1), "comments"))

    return ranges


def in_ranges(start: int, end: int, ranges: Sequence[Tuple[int, int, str]]) -> Optional[str]:
    for r_start, r_end, label in ranges:
        if start >= r_start and end <= r_end:
            return label
    return None


def overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return max(a_start, b_start) < min(a_end, b_end)


def sort_rows(rows: Sequence) -> List:
    return sorted(
        rows,
        key=lambda r: (
            r.file_name.lower(),
            r.finding_start,
            r.finding_end,
            r.raw_match_text.lower(),
        ),
    )


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


def write_csv(path: str, rows: Sequence) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if not rows:
        # bewusst leere Datei mit Header nur dann, wenn Typ bekannt wäre;
        # hier minimalistisch: nichts schreiben
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


def build_output_paths(output_dir: str) -> Dict[str, str]:
    target_dir = os.path.join(output_dir, "Suchlauf_1")
    return {
        "providers_raw": os.path.join(target_dir, "suchlauf1_collect__providers_raw.csv"),
        "symptoms_raw": os.path.join(target_dir, "suchlauf1_collect__symptoms_raw.csv"),
        "treatments_raw": os.path.join(target_dir, "suchlauf1_collect__treatments_raw.csv"),
    }


# =========================
# Raw finders
# =========================

def collect_raw_providers(
    full_text: str,
    ranges: Sequence[Tuple[int, int, str]],
    meta: Dict[str, str],
) -> List[RawProviderRow]:
    rows: List[RawProviderRow] = []
    seen: set[Tuple[int, int, str]] = set()

    for pattern, fallback_type in PROVIDER_PATTERNS:
        regex = re.compile(pattern)

        for m in regex.finditer(full_text):
            start, end = m.start(), m.end()
            section_label = in_ranges(start, end, ranges)
            if not section_label:
                continue

            raw_text = m.group(0)

            key = (start, end, raw_text)
            if key in seen:
                continue
            seen.add(key)

            rows.append(
                RawProviderRow(
                    file_name=meta["file_name"],
                    article_id=meta["article_id"],
                    article_title=meta["article_title"],
                    section_label=section_label,
                    finding_start=start,
                    finding_end=end,
                    raw_match_text=raw_text,
                    pattern_label=fallback_type,
                )
            )

    return rows


def collect_raw_symptoms(
    full_text: str,
    ranges: Sequence[Tuple[int, int, str]],
    meta: Dict[str, str],
) -> List[RawSymptomRow]:
    rows: List[RawSymptomRow] = []
    seen: set[Tuple[int, int, str]] = set()

    for phrase in sorted(SYMPTOM_PHRASES, key=len, reverse=True):
        pattern = re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)", flags=re.IGNORECASE)

        for m in pattern.finditer(full_text):
            start, end = m.start(), m.end()
            section_label = in_ranges(start, end, ranges)
            if not section_label:
                continue

            raw_text = m.group(0)

            key = (start, end, raw_text.lower())
            if key in seen:
                continue
            seen.add(key)

            rows.append(
                RawSymptomRow(
                    file_name=meta["file_name"],
                    article_id=meta["article_id"],
                    article_title=meta["article_title"],
                    section_label=section_label,
                    finding_start=start,
                    finding_end=end,
                    raw_match_text=raw_text,
                    phrase_label=phrase,
                )
            )

    return rows


def clean_raw_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^[\-–—:;,\.\)\]]+", "", text).strip()
    text = re.sub(r"[\-–—:;,\.\(\[]+$", "", text).strip()
    return text


def phrase_is_noise(text: str) -> bool:
    if not text:
        return True
    if len(text) <= 1:
        return True
    if re.fullmatch(r"\d+", text):
        return True
    return False


def expand_treatment_phrase(full_text: str, start: int, end: int, raw: str, group: str) -> tuple[int, int, str]:
    if group != "treatment":
        return start, end, raw

    raw_l = raw.lower()
    allowed_heads = {"ausleitung", "infusion", "supplement", "supplemente"}
    if raw_l not in allowed_heads:
        return start, end, raw

    tail = full_text[end:end + 120]
    m = re.match(r"^\s+(?:von|mit)\s+([A-ZÄÖÜa-zäöüß0-9\-/]+(?:\s+[A-ZÄÖÜa-zäöüß0-9\-/]+){0,2})", tail)
    if not m:
        return start, end, raw

    phrase_part = m.group(0)
    stop_word_match = re.search(
        r"\b(hörst|liest|findest|kann|können|wird|werden|ist|sind|war|waren|gibt|geben|zeigt|zeigen|hilft|helfen|spricht|sprechen)\b",
        phrase_part,
        flags=re.IGNORECASE,
    )
    if stop_word_match:
        phrase_part = phrase_part[:stop_word_match.start()].rstrip()

    new_end = end + len(phrase_part)
    new_raw = clean_raw_text(full_text[start:new_end])

    if phrase_is_noise(new_raw):
        return start, end, raw

    return start, new_end, new_raw

def collect_raw_entities(
    full_text: str,
    ranges: Sequence[Tuple[int, int, str]],
    meta: Dict[str, str],
    raw_symptoms: Sequence[RawSymptomRow],
    raw_providers: Sequence[RawProviderRow],
) -> List[RawEntityRow]:
    rows: List[RawEntityRow] = []
    seen: set[Tuple[int, int, str, str]] = set()

    symptom_spans = [(r.finding_start, r.finding_end) for r in raw_symptoms]
    provider_spans = [(r.finding_start, r.finding_end) for r in raw_providers]

    for pattern, group in MEDICAL_TRIGGER_PATTERNS:
        if pattern == r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9]*test\b":
            regex = re.compile(pattern)
        else:
            regex = re.compile(pattern, flags=re.IGNORECASE)

        for m in regex.finditer(full_text):
            start, end = m.start(), m.end()
            section_label = in_ranges(start, end, ranges)
            if not section_label:
                continue

            # Overlap-Sperre bleibt bewusst in Teil A
            if any(overlaps(start, end, s, e) for s, e in symptom_spans):
                continue
            if any(overlaps(start, end, s, e) for s, e in provider_spans):
                continue

            raw_text = m.group(0)

            # wertsteigernde Erweiterung schon in Teil A
            start, end, raw_text = expand_treatment_phrase(full_text, start, end, raw_text, group)

            if group == "treatment" and raw_text.lower() in {"ernährung", "entgiftung", "regulation"}:
                start, end, raw_text = expand_generic_treatment_phrase(full_text, start, end, raw_text)

            key = (start, end, raw_text.lower(), group)
            if key in seen:
                continue
            seen.add(key)

            rows.append(
                RawEntityRow(
                    file_name=meta["file_name"],
                    article_id=meta["article_id"],
                    article_title=meta["article_title"],
                    section_label=section_label,
                    finding_start=start,
                    finding_end=end,
                    raw_match_text=raw_text,
                    entity_group=group,
                    pattern_label=pattern,
                )
            )

    return rows

def expand_generic_treatment_phrase(full_text: str, start: int, end: int, raw: str) -> tuple[int, int, str]:
    raw_l = raw.lower()

    if raw_l == "ernährung":
        left = full_text[max(0, start - 80):start]
        m = re.search(r"([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]{2,40})\s+$", left)
        if m:
            candidate = clean_raw_text(m.group(1) + " " + raw)
            candidate_l = candidate.lower()
            invalid_left = {
                "die ernährung", "der ernährung", "eine ernährung", "seine ernährung",
                "ihre ernährung", "unsere ernährung", "deine ernährung"
            }
            if candidate_l not in invalid_left:
                new_start = start - len(m.group(1)) - 1
                return new_start, end, candidate

    if raw_l == "entgiftung":
        left = full_text[max(0, start - 40):start]
        m = re.search(r"([A-ZÄÖÜa-zäöüß]+)$", left)
        if m:
            prefix = m.group(1)
            if prefix.lower() in {"basis", "darm"}:
                candidate = clean_raw_text(prefix + raw)
                new_start = start - len(prefix)
                return new_start, end, candidate

    if raw_l == "regulation":
        left = full_text[max(0, start - 80):start]
        m = re.search(r"([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]{2,40})\s+$", left)
        if m:
            prefix = m.group(1)
            if prefix.lower() in {"emotionale", "gesunde", "vegetative"}:
                candidate = clean_raw_text(prefix + " " + raw)
                new_start = start - len(prefix) - 1
                return new_start, end, candidate

        tail = full_text[end:end + 80]
        m = re.match(r"^\s+des\s+autonomen\s+Nervensystems\b", tail, flags=re.IGNORECASE)
        if m:
            phrase_part = m.group(0)
            new_end = end + len(phrase_part)
            candidate = clean_raw_text(full_text[start:new_end])
            return start, new_end, candidate

    return start, end, raw


# =========================
# File processing
# =========================

def process_file(input_path: str) -> Tuple[List[RawProviderRow], List[RawSymptomRow], List[RawEntityRow]]:
    full_text = read_text(input_path)
    file_name = os.path.basename(input_path)
    meta = get_metadata(full_text, file_name)
    ranges = section_ranges(full_text)

    if not ranges:
        return [], [], []

    raw_providers = collect_raw_providers(full_text, ranges, meta)
    raw_symptoms = collect_raw_symptoms(full_text, ranges, meta)
    raw_entities = collect_raw_entities(full_text, ranges, meta, raw_symptoms, raw_providers)

    return raw_providers, raw_symptoms, raw_entities


def run(input_dirs: Sequence[str], output_dir: str) -> Dict[str, object]:
    txt_files = collect_txt_files(input_dirs)
    if not txt_files:
        raise ValueError("Keine TXT-Dateien in den angegebenen Ordnern gefunden.")

    all_raw_providers: List[RawProviderRow] = []
    all_raw_symptoms: List[RawSymptomRow] = []
    all_raw_entities: List[RawEntityRow] = []

    for i, path in enumerate(txt_files, start=1):
        raw_providers, raw_symptoms, raw_entities = process_file(path)

        all_raw_providers.extend(raw_providers)
        all_raw_symptoms.extend(raw_symptoms)
        all_raw_entities.extend(raw_entities)

        if i % 10 == 0:
            print(i, flush=True)

    all_raw_providers = dedupe_rows(
        sort_rows(all_raw_providers),
        ["file_name", "finding_start", "finding_end", "raw_match_text", "pattern_label"],
    )
    all_raw_symptoms = dedupe_rows(
        sort_rows(all_raw_symptoms),
        ["file_name", "finding_start", "finding_end", "raw_match_text", "phrase_label"],
    )
    all_raw_entities = dedupe_rows(
        sort_rows(all_raw_entities),
        ["file_name", "finding_start", "finding_end", "raw_match_text", "entity_group"],
    )

    output_paths = build_output_paths(output_dir)
    write_csv(output_paths["providers_raw"], all_raw_providers)
    write_csv(output_paths["symptoms_raw"], all_raw_symptoms)
    write_csv(output_paths["treatments_raw"], all_raw_entities)

    return {
        "input_dirs": list(input_dirs),
        "files_processed": len(txt_files),
        "providers_raw_count": len(all_raw_providers),
        "symptoms_raw_count": len(all_raw_symptoms),
        "treatments_raw_count": len(all_raw_entities),
        "providers_raw_csv": output_paths["providers_raw"],
        "symptoms_raw_csv": output_paths["symptoms_raw"],
        "treatments_raw_csv": output_paths["treatments_raw"],
    }


# =========================
# CLI
# =========================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Suchlauf 1 – Teil A: rohe Sammelstufe")
    parser.add_argument("--output-dir", required=True, help="Ausgabeordner für CSVs")
    parser.add_argument("--input-dirs", nargs="+", required=False, help="Liste der Eingabeordner mit TXT-Dateien")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_dirs = args.input_dirs or [
        r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\blog\txt",
        r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\intern_episodentexte\txt",
        r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\intern_fasymail\txt",
    ]

    result = run(input_dirs, args.output_dir)

    print("status=ok")
    for key, value in result.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()