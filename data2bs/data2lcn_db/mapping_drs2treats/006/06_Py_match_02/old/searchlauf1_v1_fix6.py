#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Suchlauf 1 – V1

Ziel:
- Einzelne Fasynation-TXT-Datei einlesen
- Hauptcontent + Kommentare durchsuchen
- drei CSVs erzeugen:
  1) Anbieter
  2) Symptome
  3) Behandlungen / Diagnosen

Wichtige Eigenschaften:
- keine Referenzlisten erforderlich
- bewusst review-orientiert
- nur leichte Normalisierung
- Fundstelle = Start/Ende der konkret extrahierten Phrase im gesamten Dateitext

Aufrufbeispiel:
python searchlauf1_v1.py \
  --input "C:\\xampp\\htdocs\\lcn\\data2bs\\data2lcn_db\\mapping_drs2treats\\006\\01_batches\\blog\\txt\\blog_0001.txt" \
  --output-dir "C:\\xampp\\htdocs\\lcn\\data2bs\\data2lcn_db\\mapping_drs2treats\\006\\06_Py_match_02"
"""

from __future__ import annotations

import argparse
import csv
import os
import re
from dataclasses import dataclass, asdict
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


# -----------------------------
# Datenklassen
# -----------------------------

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


# -----------------------------
# Konfiguration V1
# -----------------------------

SECTION_MARKERS = (
    "=== CONTENT START ===",
    "=== CONTENT END ===",
    "=== COMMENTS START ===",
    "=== COMMENTS END ===",
)

PROVIDER_PATTERNS: Sequence[Tuple[str, str]] = (
    # Titel + Namen
    (r"\bProf\.\s*(?:Dr\.\s*){1,3}(?:med\.\s*)?[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "physician"),
    (r"\b(?:Dr\.\s*){1,3}(?:med\.\s*)?[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "physician"),
    (r"\bHeilpraktiker(?:in)?\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "heilpraktiker"),
    (r"\b(?:Ärztin|Arzt|Therapeut(?:in)?|Coach)\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,3}", "unknown"),
    # Organisationen / Programme
    (r"\b[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,4}\s+(?:Praxis|Klinik|Institut|Labor|Zentrum)\b", "organization"),
    (r"\b[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,4}\s+(?:Programm|Retreat)\b", "program"),
)

# V1 bewusst kompakt und review-orientiert
SYMPTOM_PHRASES: Sequence[str] = (
    "Fatigue",
    "chronische Erschöpfung",
    "Erschöpfung",
    "PEM",
    "Post-Exertional Malaise",
    "Brain Fog",
    "Konzentrationsschwierigkeiten",
    "Schlafstörungen",
    "unerholsamer Schlaf",
    "Schmerzen",
    "Gliederschmerzen",
    "Schwindel",
    "Herzrasen",
    "Atemprobleme",
    "Atem- und Kreislaufprobleme",
    "Grippegefühl",
    "Abgeschlagenheit",
    "Müdigkeit",
    "Kälteempfindlichkeit",
    "Verstopfung",
    "Gewichtszunahme",
    "Durchfall",
    "Übelkeit",
    "Bauchkrämpfe",
    "Hautrötungen",
    "Konzentrations- oder Denkprobleme",
    "Benommenheit",
    "Antriebslosigkeit",
    "ME/CFS",
    "CFS",
    "Long Covid",
    "Post Vac",
    "PostVac",
    "POTS",
    "MCAS",
    "Autoimmunerkrankung",
    "Autoimmunerkrankungen",
    "Borreliose",
    "chronische Borreliose",
    "akute Borreliose",
    "Hashimoto",
    "Hashimoto-Thyreoiditis",
    "Anämie",
    "HPU",
    "HIV",
    "Mitochondriopathie",
    "Hypothyreose",
    "Histamin-Intoleranz",
    "Histamin-Unverträglichkeit",
    "Leaky Gut",
    "Leaky Gut Syndrom",
    "Nebenniereninsuffizienz",
    "Diabetes",
    "Hyperkalzämie",
)

# Trigger zur heuristischen Suche von Phrasen in der Nähe
MEDICAL_TRIGGER_PATTERNS: Sequence[Tuple[str, str]] = (
    # Diagnoseverfahren / Tests -> operativ als diagnosis
    # Diagnose-/Mess-/Protokoll-Komposita ohne harte Einzelbegriffe
    (r"\b[A-ZÄÖÜa-zäöüß0-9]+(?:-[A-ZÄÖÜa-zäöüß0-9]+){0,3}-(?:Diagnostik|Messung|Screening|Protokoll)\b", "diagnosis"),
    (r"\b[A-ZÄÖÜa-zäöüß]+(?:diagnostik|messung|screening|protokoll)\b", "diagnosis"),

    # Treatment-Komposita ohne harte Einzelbegriffe
    (r"\b[A-ZÄÖÜa-zäöüß0-9]+(?:-[A-ZÄÖÜa-zäöüß0-9]+){0,3}-(?:Training|Trainingsprogramm|Regel)\b", "treatment"),
    (r"\b[A-ZÄÖÜa-zäöüß]+(?:training|trainingsprogramm)\b", "treatment"),

    # Mehrwort-Phrasen mit generischem Kopfbegriff + Spezifizierung
    (r"\b(?:Behandlung|Therapie|Diagnostik|Untersuchung|Training)\s+(?:von|bei|durch|mit)\s+[A-ZÄÖÜa-zäöüß0-9\-/]+(?:\s+[A-ZÄÖÜa-zäöüß0-9\-/]+){0,4}\b",
     "treatment"),

    # Zahlen-/Rhythmus-/Pausen-Regeln
    (r"\b(?:[0-9]{1,3}(?:[-/][0-9]{1,3})?(?:-Sekunden)?-(?:Regel|Training|Trainingsprogramm)|lohnende(?:\s+Pause|\s+Pausen))\b",
     "treatment"),

    (r"\b[A-ZÄÖÜa-zäöüß0-9\-/]+(?:-Test|test)\b", "diagnosis"),
    (r"\b(?:Blutbild|Bluttest|Urintest|Stuhltest|Ultraschall|Kapillarmikroskopie|Handkraftmessung|Diagnostik|Untersuchung|Messung)\b", "diagnosis"),
    (r"\b(?:TSH(?:-Wert|basal)?|Cortisol-Tagesprofil|Antikörper|TPO-Antikörper|TG-Antikörper|fT3|fT4|freies T3|freies T4)\b", "diagnosis"),
    # Treatments
    (r"\b(?:Pacing|Atemübungen|Meditation|Journaling|Brain Retraining|neuroplastisches Training|Vagusregulation|Stressreduzierung|Entgiftung|Mitochondrientherapie|Apherese|hyperbare Sauerstofftherapie|Bauchatmung|Buteyko Atmung|Supplemente?|Infusion(?:en)?|Antibiotika|Magnesium(?:-[A-Za-zÄÖÜäöüß]+)?|Vitamin D|K2|Q10|Carnitin|Zink|Mangan|L-Arginin|Cortisol)\b", "treatment"),
    (r"\b(?:Therapie|Behandlung|Maßnahme|Programm|Übung|Ernährung|Ausleitung|Meditation|Regulation|Retraining)\b", "treatment"),
)

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


# -----------------------------
# Hilfsfunktionen
# -----------------------------

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
    text = re.sub(r"^[\s\-–—:;,\.]+", "", text)
    text = re.sub(r"[\s\-–—:;,\.]+$", "", text)
    return text.lower()


def clean_raw_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^[\-–—:;,\.\)\]]+", "", text).strip()
    text = re.sub(r"[\-–—:;,\.\(\[]+$", "", text).strip()
    return text


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

    content_match = re.search(r"=== CONTENT START ===\n(.*?)\n=== CONTENT END ===", full_text, flags=re.DOTALL)
    if content_match:
        ranges.append((content_match.start(1), content_match.end(1), "content"))

    comments_match = re.search(r"=== COMMENTS START ===\n(.*?)\n=== COMMENTS END ===", full_text, flags=re.DOTALL)
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




def expand_treatment_phrase(full_text: str, start: int, end: int, raw: str, group: str) -> tuple[int, int, str]:
    """Erweitert nur ausgewählte konkrete Treatment-Muster.
    Beispiel: 'Ausleitung' -> 'Ausleitung von Schwermetallen'
    Nicht erlaubt: 'Behandlung von ...', 'Therapie von ...'
    """
    if group != "treatment":
        return start, end, raw

    raw_l = raw.lower()
    allowed_heads = {"ausleitung", "infusion", "supplement", "supplemente"}
    if raw_l not in allowed_heads:
        return start, end, raw

    tail = full_text[end:end+120]
    m = re.match(r"^\s+(?:von|mit)\s+([A-ZÄÖÜa-zäöüß0-9\-/]+(?:\s+[A-ZÄÖÜa-zäöüß0-9\-/]+){0,2})", tail)

    if not m:
        return start, end, raw

    phrase_part = m.group(0)
    # harte Stoppwörter gegen zu weites Auslaufen
    stop_word_match = re.search(
        r"\b(hörst|liest|findest|kann|können|wird|werden|ist|sind|war|waren|gibt|geben|zeigt|zeigen|hilft|helfen|spricht|sprechen)\b",
        phrase_part,
        flags=re.IGNORECASE
    )

    if stop_word_match:
        phrase_part = phrase_part[:stop_word_match.start()].rstrip()

    new_end = end + len(phrase_part)
    new_raw = clean_raw_text(full_text[start:new_end])
    if phrase_is_noise(new_raw):
        return start, end, raw
    return start, new_end, new_raw

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


def find_symptoms(full_text: str, ranges: Sequence[Tuple[int, int, str]], meta: Dict[str, str]) -> List[SymptomRow]:
    rows: List[SymptomRow] = []
    seen: set[Tuple[int, int, str]] = set()

    for phrase in sorted(SYMPTOM_PHRASES, key=len, reverse=True):
        pattern = re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)", flags=re.IGNORECASE)
        for m in pattern.finditer(full_text):
            start, end = m.start(), m.end()
            where = in_ranges(start, end, ranges)
            if not where:
                continue

            raw = clean_raw_text(full_text[start:end])
            if phrase_is_noise(raw):
                continue

            key = (start, end, raw.lower())
            if key in seen:
                continue
            seen.add(key)

            review_needed, review_reason = symptom_review(raw)
            rows.append(SymptomRow(
                file_name=meta["file_name"],
                article_id=meta["article_id"],
                article_title=meta["article_title"],
                finding_start=start,
                finding_end=end,
                entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw),
                review_needed=review_needed,
                review_reason=review_reason,
            ))

    return rows


def find_providers(full_text: str, ranges: Sequence[Tuple[int, int, str]], meta: Dict[str, str]) -> List[ProviderRow]:
    rows: List[ProviderRow] = []
    seen: set[Tuple[int, int, str]] = set()

    for pattern, fallback_type in PROVIDER_PATTERNS:
        regex = re.compile(pattern)
        for m in regex.finditer(full_text):
            start, end = m.start(), m.end()
            where = in_ranges(start, end, ranges)
            if not where:
                continue

            raw = clean_raw_text(m.group(0))
            if phrase_is_noise(raw):
                continue

            key = (start, end, raw.lower())
            if key in seen:
                continue
            seen.add(key)

            provider_type = derive_provider_type(raw, fallback_type)
            review_needed, review_reason = provider_review(raw)
            rows.append(ProviderRow(
                file_name=meta["file_name"],
                article_id=meta["article_id"],
                article_title=meta["article_title"],
                finding_start=start,
                finding_end=end,
                entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw),
                provider_type=provider_type,
                review_needed=review_needed,
                review_reason=review_reason,
            ))

    return rows


def find_entities(full_text: str, ranges: Sequence[Tuple[int, int, str]], meta: Dict[str, str], symptoms: Sequence[SymptomRow], providers: Sequence[ProviderRow]) -> List[EntityRow]:
    rows: List[EntityRow] = []
    seen: set[Tuple[int, int, str, str]] = set()

    symptom_spans = [(r.finding_start, r.finding_end) for r in symptoms]
    provider_spans = [(r.finding_start, r.finding_end) for r in providers]

    for pattern, group in MEDICAL_TRIGGER_PATTERNS:
        regex = re.compile(pattern, flags=re.IGNORECASE)
        for m in regex.finditer(full_text):
            start, end = m.start(), m.end()
            where = in_ranges(start, end, ranges)
            if not where:
                continue

            if any(overlaps(start, end, s, e) for s, e in symptom_spans):
                continue
            if any(overlaps(start, end, s, e) for s, e in provider_spans):
                continue

            raw = clean_raw_text(m.group(0))
            start, end, raw = expand_treatment_phrase(full_text, start, end, raw, group)
            if phrase_is_noise(raw):
                continue

            raw_l = raw.lower()

            if raw_l in GENERIC_ENTITY_EXCLUDE:
                continue

            if raw_l.startswith(("behandlung von", "therapie von", "diagnose von", "diagnostik von", "untersuchung von",
                                 "maßnahme von")):
                review_needed = 1
                review_reason = "generische phrase mit spezifizierung"
            else:
                review_needed, review_reason = entity_review(raw, group, where == "comments")

            # Einzelne generische Wörter nur mit Kontext zulassen
            if raw in REVIEW_GENERAL_TERMS:
                ctx = sentence_window(full_text, start, end)
                if not re.search(r"(konkret|gezielt|mögliche|erste|wichtige|hilft|unterstützt|empfiehlt|testen|behandeln)", ctx, flags=re.IGNORECASE):
                    continue

            # Zusatzheuristik: sehr generische Diagnoseterminologie rausfiltern, wenn nicht konkret
            if group == "diagnosis" and raw.lower() in {"syndrom", "störung", "erkrankung", "entzündung", "schwäche"}:
                continue

            key = (start, end, raw.lower(), group)
            if key in seen:
                continue
            seen.add(key)

            rows.append(EntityRow(
                file_name=meta["file_name"],
                article_id=meta["article_id"],
                article_title=meta["article_title"],
                finding_start=start,
                finding_end=end,
                entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw),
                entity_group=group,
                review_needed=review_needed,
                review_reason=review_reason,
            ))

    return rows


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


def sort_rows(rows: Sequence) -> List:
    return sorted(rows, key=lambda r: (r.finding_start, r.finding_end, r.entity_text_raw.lower()))


def write_csv(path: str, rows: Sequence) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not rows:
        return
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def build_output_paths(output_dir: str, input_file: str) -> Dict[str, str]:
    base = os.path.splitext(os.path.basename(input_file))[0]
    target_dir = os.path.join(output_dir, "Suchlauf_1")
    return {
        "providers": os.path.join(target_dir, f"{base}__providers.csv"),
        "symptoms": os.path.join(target_dir, f"{base}__symptoms.csv"),
        "treatments": os.path.join(target_dir, f"{base}__treatments.csv"),
    }


# -----------------------------
# Hauptlogik
# -----------------------------

def run(input_path: str, output_dir: str) -> Dict[str, object]:
    full_text = read_text(input_path)
    file_name = os.path.basename(input_path)
    meta = get_metadata(full_text, file_name)
    ranges = section_ranges(full_text)

    if not ranges:
        raise ValueError("CONTENT/COMMENTS-Abschnitte konnten nicht erkannt werden.")

    providers = find_providers(full_text, ranges, meta)
    symptoms = find_symptoms(full_text, ranges, meta)
    entities = find_entities(full_text, ranges, meta, symptoms, providers)

    providers = dedupe_rows(sort_rows(providers), [
        "finding_start", "finding_end", "entity_text_normalized", "provider_type"
    ])
    symptoms = dedupe_rows(sort_rows(symptoms), [
        "finding_start", "finding_end", "entity_text_normalized"
    ])
    entities = dedupe_rows(sort_rows(entities), [
        "finding_start", "finding_end", "entity_text_normalized", "entity_group"
    ])

    output_paths = build_output_paths(output_dir, input_path)
    write_csv(output_paths["providers"], providers)
    write_csv(output_paths["symptoms"], symptoms)
    write_csv(output_paths["treatments"], entities)

    return {
        "input_file": input_path,
        "providers_count": len(providers),
        "symptoms_count": len(symptoms),
        "treatments_count": len(entities),
        "providers_csv": output_paths["providers"],
        "symptoms_csv": output_paths["symptoms"],
        "treatments_csv": output_paths["treatments"],
    }


# -----------------------------
# CLI
# -----------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Suchlauf 1 – V1 für Fasynation-Einzeldateien")
    parser.add_argument("--input", required=True, help="Pfad zur Eingabe-TXT")
    parser.add_argument("--output-dir", required=True, help="Ausgabeordner für CSVs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = run(args.input, args.output_dir)
    print("status=ok")
    for key, value in result.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
