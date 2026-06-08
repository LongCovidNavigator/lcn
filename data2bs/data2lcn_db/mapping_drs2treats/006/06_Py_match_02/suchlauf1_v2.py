#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import csv
import os
import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Sequence, Tuple


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
    (r"\bErnährungsumstellung\s+(?:nach\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß\-]+){0,2}|mit\s+Verzicht\s+auf\s+[A-ZÄÖÜa-zäöüß0-9\-/]+(?:,\s*[A-ZÄÖÜa-zäöüß0-9\-/]+){0,8}(?:\s+und\s+[A-ZÄÖÜa-zäöüß0-9\-/]+)?)\b",
     "treatment"),
    (r"\bBasisentgiftung\b", "treatment"),
    (r"\bDarmentgiftung\b", "treatment"),
    (r"\bEntgiftungskonzept\b", "treatment"),
    (r"\bemotionale Regulation\b", "treatment"),
    (r"\bRegulation\s+des\s+autonomen\s+Nervensystems\b", "treatment"),
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


def get_metadata(full_text: str, file_name: str) -> Dict[str, str]:
    article_id = ""
    article_title = ""
    m_id = re.search(r"^PAGE_ID:\s*(.+)$", full_text, flags=re.MULTILINE)
    if m_id:
        article_id = m_id.group(1).strip()
    m_title = re.search(r"^TITLE_INPUT:\s*(.+)$", full_text, flags=re.MULTILINE)
    if m_title:
        article_title = m_title.group(1).strip()
    return {"file_name": file_name, "article_id": article_id, "article_title": article_title}


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
                file_name=meta["file_name"], article_id=meta["article_id"], article_title=meta["article_title"],
                finding_start=start, finding_end=end, entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw), review_needed=review_needed,
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
            raw = strip_leading_provider_function_words(raw)

            if phrase_is_noise(raw):
                continue
            if is_generic_provider_head_only(raw):
                continue

            raw = normalize_role_prefixed_provider(raw)
            if not raw:
                continue

            key = (start, end, raw.lower())
            if key in seen:
                continue
            seen.add(key)
            provider_type = derive_provider_type(raw, fallback_type)
            review_needed, review_reason = provider_review(raw)
            rows.append(ProviderRow(
                file_name=meta["file_name"], article_id=meta["article_id"], article_title=meta["article_title"],
                finding_start=start, finding_end=end, entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw), provider_type=provider_type,
                review_needed=review_needed, review_reason=review_reason,
            ))
    return rows

def expand_generic_treatment_phrase(full_text: str, start: int, end: int, raw: str) -> tuple[int, int, str]:
    raw_l = raw.lower()

    # Ernährung: ein sinnvolles Wort links mitnehmen, z.B. "ketogene Ernährung"
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

    # Entgiftung: linker Kompositumstamm wie Basis-/Darm- direkt mitnehmen
    if raw_l == "entgiftung":
        left = full_text[max(0, start - 40):start]
        m = re.search(r"([A-ZÄÖÜa-zäöüß]+)$", left)
        if m:
            prefix = m.group(1)
            if prefix.lower() in {"basis", "darm"}:
                candidate = clean_raw_text(prefix + raw)
                new_start = start - len(prefix)
                return new_start, end, candidate

    # Regulation: links einfache Spezifizierung mitnehmen
    if raw_l == "regulation":
        left = full_text[max(0, start - 80):start]
        m = re.search(r"([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]{2,40})\s+$", left)
        if m:
            prefix = m.group(1)
            if prefix.lower() in {"emotionale", "gesunde", "vegetative"}:
                candidate = clean_raw_text(prefix + " " + raw)
                new_start = start - len(prefix) - 1
                return new_start, end, candidate

        # rechts "des autonomen Nervensystems" mitnehmen
        tail = full_text[end:end + 80]
        m = re.match(r"^\s+des\s+autonomen\s+Nervensystems\b", tail, flags=re.IGNORECASE)
        if m:
            phrase_part = m.group(0)
            new_end = end + len(phrase_part)
            candidate = clean_raw_text(full_text[start:new_end])
            return start, new_end, candidate

    return start, end, raw

def find_entities(full_text: str, ranges: Sequence[Tuple[int, int, str]], meta: Dict[str, str],
                  symptoms: Sequence[SymptomRow], providers: Sequence[ProviderRow]) -> List[EntityRow]:
    rows: List[EntityRow] = []
    seen: set[Tuple[int, int, str, str]] = set()
    symptom_spans = [(r.finding_start, r.finding_end) for r in symptoms]
    provider_spans = [(r.finding_start, r.finding_end) for r in providers]

    for pattern, group in MEDICAL_TRIGGER_PATTERNS:
        if pattern == r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9]*test\b":
            regex = re.compile(pattern)
        else:
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

            if group == "diagnosis" and raw.lower().endswith("test"):
                if is_verb_like_test_false_positive(raw):
                    continue

            start, end, raw = expand_treatment_phrase(full_text, start, end, raw, group)

            if group == "treatment" and raw.lower() in {"ernährung", "entgiftung", "regulation"}:
                start, end, raw = expand_generic_treatment_phrase(full_text, start, end, raw)


            if phrase_is_noise(raw):
                continue
            raw_l = raw.lower()
            if raw_l in GENERIC_ENTITY_EXCLUDE:
                continue
            if raw_l.startswith(("behandlung von", "therapie von", "diagnose von", "diagnostik von", "untersuchung von", "maßnahme von")):
                review_needed = 1
                review_reason = "generische phrase mit spezifizierung"
            else:
                review_needed, review_reason = entity_review(raw, group, where == "comments")
            if raw in REVIEW_GENERAL_TERMS:
                ctx = sentence_window(full_text, start, end)
                if not re.search(r"(konkret|gezielt|mögliche|erste|wichtige|hilft|unterstützt|empfiehlt|testen|behandeln)", ctx, flags=re.IGNORECASE):
                    continue
            if group == "diagnosis" and raw.lower() in {"syndrom", "störung", "erkrankung", "entzündung", "schwäche"}:
                continue
            key = (start, end, raw.lower(), group)
            if key in seen:
                continue
            seen.add(key)
            rows.append(EntityRow(
                file_name=meta["file_name"], article_id=meta["article_id"], article_title=meta["article_title"],
                finding_start=start, finding_end=end, entity_text_raw=raw,
                entity_text_normalized=light_normalize(raw), entity_group=group,
                review_needed=review_needed, review_reason=review_reason,
            ))
    return rows

def strip_leading_provider_function_words(raw: str) -> str:
    text = clean_raw_text(raw)
    parts = text.split()

    function_words = {
        "das", "der", "die",
        "ihre", "seine","ihr", "sein", "seines",
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

    # Rollenwort abschneiden
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

    # Ein einzelnes Restwort nach Rollenwort ist zu schwach
    if len(parts) == 1:
        token = parts[0]
        token_l = token.lower()

        if token_l in invalid_single_tokens:
            return None

        # Ein einzelner Vorname/Nachname reicht hier nicht als belastbarer Provider
        return None

    # Mindestens zwei Tokens für einen plausiblen Namen verlangen
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

    # echte Bindestrich-Testformen nicht blocken
    if text.endswith("-test"):
        return False

    # bekannte klare Fehlformen
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


def sort_rows(rows: Sequence) -> List:
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


def build_output_paths(output_dir: str) -> Dict[str, str]:
    target_dir = os.path.join(output_dir, "Suchlauf_1")
    return {
        "providers": os.path.join(target_dir, "alt_suchlauf1_v2__providers.csv"),
        "symptoms": os.path.join(target_dir, "alt_suchlauf1_v2__symptoms.csv"),
        "treatments": os.path.join(target_dir, "alt_suchlauf1_v2__treatments.csv"),
    }


def process_file(input_path: str) -> Tuple[List[ProviderRow], List[SymptomRow], List[EntityRow]]:
    full_text = read_text(input_path)
    file_name = os.path.basename(input_path)
    meta = get_metadata(full_text, file_name)
    ranges = section_ranges(full_text)
    if not ranges:
        return [], [], []
    providers = find_providers(full_text, ranges, meta)
    symptoms = find_symptoms(full_text, ranges, meta)
    entities = find_entities(full_text, ranges, meta, symptoms, providers)
    return providers, symptoms, entities


def run(input_dirs: Sequence[str], output_dir: str) -> Dict[str, object]:
    txt_files = collect_txt_files(input_dirs)
    if not txt_files:
        raise ValueError("Keine TXT-Dateien in den angegebenen Ordnern gefunden.")
    all_providers: List[ProviderRow] = []
    all_symptoms: List[SymptomRow] = []
    all_entities: List[EntityRow] = []

    for i, path in enumerate(txt_files, start=1):
        providers, symptoms, entities = process_file(path)
        all_providers.extend(providers)
        all_symptoms.extend(symptoms)
        all_entities.extend(entities)

        if i % 10 == 0:
            print(i, flush=True)

    all_providers = dedupe_rows(sort_rows(all_providers), ["file_name", "finding_start", "finding_end", "entity_text_normalized", "provider_type"])
    all_symptoms = dedupe_rows(sort_rows(all_symptoms), ["file_name", "finding_start", "finding_end", "entity_text_normalized"])
    all_entities = dedupe_rows(sort_rows(all_entities), ["file_name", "finding_start", "finding_end", "entity_text_normalized", "entity_group"])
    output_paths = build_output_paths(output_dir)
    write_csv(output_paths["providers"], all_providers)
    write_csv(output_paths["symptoms"], all_symptoms)
    write_csv(output_paths["treatments"], all_entities)
    return {
        "input_dirs": list(input_dirs),
        "files_processed": len(txt_files),
        "providers_count": len(all_providers),
        "symptoms_count": len(all_symptoms),
        "treatments_count": len(all_entities),
        "providers_csv": output_paths["providers"],
        "symptoms_csv": output_paths["symptoms"],
        "treatments_csv": output_paths["treatments"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Suchlauf 1 – V2 für mehrere Fasynation-Ordner")
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
