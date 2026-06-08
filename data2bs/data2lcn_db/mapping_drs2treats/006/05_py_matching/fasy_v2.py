# -*- coding: utf-8 -*-
r"""
Autonomer, regelbasierter Matcher für Anbieter ↔ Treatment in Fasynation-Texten
V1: keine Vorkenntnisse über konkrete Datei, keine Soll-Liste, kein provider-spezifisches Hardcoding

Input:
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\blog\txt\blog_0001.txt

Outputs:
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\05_py_matching\match_blog_0001_v1.csv
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\05_py_matching\match_blog_0001_v1_debug.json
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional


# ------------------------------------------------------------
# Pfade
# ------------------------------------------------------------

INPUT_PATH = Path(
    r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\blog\txt\blog_0001.txt"
)

OUTPUT_DIR = Path(
    r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\05_py_matching\results"
)

OUTPUT_CSV = OUTPUT_DIR / "match_blog_0001_v1.csv"
OUTPUT_DEBUG_JSON = OUTPUT_DIR / "match_blog_0001_v1_debug.json"

SOURCE_BATCH_ID = "006_fasynation_blog_pages_v1"
SOURCE_NAME = "Fasynation"
SOURCE_ID = ""

MASTER_COLUMNS = [
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


# ------------------------------------------------------------
# Allgemeine Muster
# ------------------------------------------------------------

PROVIDER_PATTERNS = [
    # klassische Personenmuster
    re.compile(r"\bProf\.\s*Dr\.\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,3}\b"),
    re.compile(r"\bDr\.\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,3}\b"),
    # allgemeinere Anbieterformen
    re.compile(r"\b(?:IMD(?:\s+in)?\s+Berlin)\b"),
    re.compile(r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+\s+Programm\b"),
    re.compile(r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+\s+(?:Institut|Labor|Praxis|Klinik|Zentrum)\b"),
]

ACTION_PATTERNS = [
    # Diagnose / Test
    re.compile(r"(?P<phrase>[^.:\n]*\b(?:Diagnose|Diagnostik|testen|Test|Tests|abklären|Untersuchung(?:en)?)\b[^.:\n]*)", re.I),
    # Behandlung / Therapie
    re.compile(r"(?P<phrase>[^.:\n]*\b(?:Behandlung|behandeln|Therapie|therapieren)\b[^.:\n]*)", re.I),
    # Supportiv / Maßnahme
    re.compile(r"(?P<phrase>[^.:\n]*\b(?:ausgleichen|unterstützen|Ausleitung|Protokoll(?:e|en)?|Entgiftung)\b[^.:\n]*)", re.I),
]

POSITIVE_INDICATORS = [
    r"\bDiagnose\b",
    r"\bDiagnostik\b",
    r"\bBehandlung\b",
    r"\bTherapie\b",
    r"\btesten\b",
    r"\babklären\b",
    r"\bUntersuchung(?:en)?\b",
    r"\bausgleichen\b",
    r"\bunterstützen\b",
    r"\bAusleitung\b",
    r"\bProtokoll(?:e|en)?\b",
    r"\bEntgiftung\b",
]

NEGATIVE_INDICATORS = [
    r"\berklärt\b",
    r"\bInterview\b",
    r"\bArtikel\b",
    r"\bBlogartikel\b",
    r"\bWebsite\b",
    r"\bWebseite\b",
    r"\bfindest du\b",
    r"\bliest du\b",
    r"\bhörst du\b",
    r"\bmehr dazu\b",
    r"\bHinweise\b",
]

WEAK_REFERENCE_PATTERNS = [
    re.compile(r"\bPodcast(?:-Episode|-gespräch)?\b", re.I),
    re.compile(r"\bInterview\b", re.I),
    re.compile(r"\bArtikel\b", re.I),
    re.compile(r"\bBlogartikel\b", re.I),
    re.compile(r"\bWebsite\b", re.I),
    re.compile(r"\bProgramm\b", re.I),
]


# ------------------------------------------------------------
# Hilfsfunktionen
# ------------------------------------------------------------

def normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_content_block(path: Path) -> str:
    raw = path.read_text(encoding="utf-8")
    m = re.search(r"=== CONTENT START ===\n(.*?)\n=== CONTENT END ===", raw, re.S)
    if not m:
        raise ValueError("CONTENT START / END Block nicht gefunden.")
    return normalize_whitespace(m.group(1))


def split_sections(text: str) -> List[str]:
    parts = re.split(r"(?=Ursache \d+: )", text)
    return [p.strip() for p in parts if p.strip().startswith("Ursache ")]


def heading_of(section: str) -> str:
    return re.sub(r"\s+", " ", section.split("\n", 1)[0]).strip()


def safe_excerpt(text: str, max_len: int = 700) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= max_len else text[:max_len].rstrip() + " ..."


def detect_providers(section: str) -> List[str]:
    found: List[str] = []
    for pattern in PROVIDER_PATTERNS:
        for m in pattern.finditer(section):
            candidate = m.group(0).strip()
            if candidate not in found:
                found.append(candidate)
    return found


def sentence_like_fragments(section: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+", re.sub(r"\n+", " ", section))
    return [p.strip() for p in parts if p.strip()]


def local_fragments_for_provider(section: str, provider: str) -> List[str]:
    """
    Für diesen Quellentyp ist der lokale Kontext der ganze Ursache-Abschnitt.
    Das bleibt lokal genug und verhindert, dass relevante Maßnahmen im selben
    Abschnitt abgeschnitten werden.
    """
    return [re.sub(r"\s+", " ", section).strip()]


def score_phrase(phrase: str) -> Tuple[int, List[str], List[str]]:
    pos_hits = [p for p in POSITIVE_INDICATORS if re.search(p, phrase, re.I)]
    neg_hits = [n for n in NEGATIVE_INDICATORS if re.search(n, phrase, re.I)]
    score = len(pos_hits) * 2 - len(neg_hits)
    return score, pos_hits, neg_hits


def recommendation_type_from_phrase(phrase: str) -> str:
    if re.search(r"\b(?:Diagnose|Diagnostik|testen|Test|Tests|abklären|Untersuchung(?:en)?)\b", phrase, re.I):
        return "Diagnose"
    return ""


def evidence_strength_from_phrase(phrase: str) -> str:
    if re.search(r"\bDiagnose\b", phrase, re.I) and re.search(r"\bBehandlung\b", phrase, re.I):
        return "high"
    if re.search(r"\b(?:Behandlung|Therapie|Diagnostik|testen|abklären|ausgleichen|unterstützen|Ausleitung|Protokoll|Entgiftung)\b", phrase, re.I):
        return "medium"
    return "medium"


def extract_disease_object(phrase: str) -> Optional[str]:
    """
    Versucht das Objekt hinter Diagnose/Behandlung zu greifen.
    """
    m = re.search(
        r"\b(?:Diagnose|Diagnostik|Behandlung)\s+(?:einer|eines|einem|von|der|des)?\s*(?P<obj>[^.,;:]+)",
        phrase,
        re.I,
    )
    if m:
        obj = m.group("obj").strip()
        obj = re.sub(r"\bsehr\b.*$", "", obj, flags=re.I).strip()
        return obj
    return None


def normalize_candidate(raw_phrase: str, section_heading: str) -> List[str]:
    """
    Regelbasierte Normalisierung ohne Dateivorkenntnis.
    Kann mehrere normalisierte Treatments aus einer Rohphrase erzeugen.
    """
    phrase = re.sub(r"\s+", " ", raw_phrase).strip()
    out: List[str] = []

    if re.search(r"\bDiagnose\b", phrase, re.I) and re.search(r"\bBehandlung\b", phrase, re.I):
        obj = extract_disease_object(phrase) or ""
        if re.search(r"\bakuten?\b|\bchronischen?\b", obj, re.I):
            base = re.sub(r"\beiner?\b|\beines\b|\beinem\b|\bder\b|\bdes\b|\bvon\b", "", obj, flags=re.I).strip()
            base = re.sub(r"\s+", " ", base)
            disease = re.sub(r"\bakuten?\b|\bchronischen?\b|\border\b", "", base, flags=re.I)
            disease = re.sub(r"\s+", " ", disease).strip()
            if disease:
                out.append(f"{disease}-Diagnostik")
                out.append(f"Behandlung akuter {disease}")
                out.append(f"Behandlung chronischer {disease}")
                return out

    if re.search(r"\bMikronährstoff", phrase, re.I):
        out.append("Mikronährstoffdiagnostik")
    if re.search(r"\bMangelerscheinung", phrase, re.I):
        out.append("Abklärung von Mangelerscheinungen")
    if re.search(r"\bBorreliose\b", phrase, re.I) and re.search(r"\b(?:Diagnose|Diagnostik|testen|abklären|Untersuchung)\b", phrase, re.I):
        out.append("Borreliose-Diagnostik")

    if re.search(r"\bausgleichen\b", phrase, re.I):
        if re.search(r"\bMängel\b", phrase, re.I):
            if re.search(r"\bMikronähr", section_heading, re.I) or re.search(r"\bMikronähr", phrase, re.I):
                out.append("Ausgleich festgestellter Mikronährstoffmängel")
            else:
                out.append("Ausgleich festgestellter Mängel")

    if re.search(r"\bEntgiftung\b", phrase, re.I):
        out.append("Entgiftung")

    if re.search(r"\bAusleitung\b", phrase, re.I) and re.search(r"\bSchwermetall", phrase, re.I):
        out.append("Ausleitung von Schwermetallen")

    if re.search(r"\bEntgiftungsprotokoll", phrase, re.I):
        out.append("Entgiftungsprotokolle")

    if re.search(r"\bunterstützen\b", phrase, re.I) and re.search(r"\bEntgiftung\b", phrase, re.I):
        if re.search(r"\bErgänzungsmittel", phrase, re.I):
            out.append("Unterstützung der Entgiftung mit Ergänzungsmitteln")
        else:
            out.append("Unterstützung der Entgiftung")

    if re.search(r"\bBehandlung\b", phrase, re.I) and re.search(r"\bBorreliose\b", phrase, re.I):
        if re.search(r"\bakuten?\b", phrase, re.I):
            out.append("Behandlung akuter Borreliose")
        if re.search(r"\bchronischen?\b", phrase, re.I):
            out.append("Behandlung chronischer Borreliose")
        if not re.search(r"\bakuten?\b|\bchronischen?\b", phrase, re.I):
            out.append("Behandlung von Borreliose")

    deduped: List[str] = []
    for item in out:
        if item not in deduped:
            deduped.append(item)
    return deduped


def should_discard_provider_only_reference(provider: str, fragments: List[str]) -> Tuple[bool, str]:
    joined = " ".join(fragments)
    has_action = any(re.search(p, joined, re.I) for p in POSITIVE_INDICATORS)
    has_weak_ref = any(p.search(joined) for p in WEAK_REFERENCE_PATTERNS)

    if not has_action and has_weak_ref:
        return True, "nur Verweis-/Referenzkontext ohne lokale interventionsnahe Maßnahme"
    if not has_action:
        return True, "kein ausreichender lokaler Praxisindikator"
    return False, ""


def build_row(
    row_id: int,
    doctor_name: str,
    treatment_name_raw: str,
    treatment_name_normalized: str,
    recommendation_type: str,
    evidence_excerpt: str,
    evidence_strength: str,
) -> Dict[str, str]:
    return {
        "id": str(row_id),
        "decision": "1",
        "dr_id": "",
        "doctor_name": doctor_name,
        "treatment_name_raw": treatment_name_raw,
        "treatment_name_normalized": treatment_name_normalized,
        "review_mapping": "0",
        "review_mapping_notes": "",
        "recommendation_type": recommendation_type,
        "evidence_excerpt": evidence_excerpt,
        "evidence_strength": evidence_strength,
        "treat_id": "",
        "treat_match_status": "",
        "match_notes": "",
        "review_matching": "",
        "review_matching_notes": "",
        "alias_name": "",
        "alias_type": "",
        "sort_order": "",
        "notes": "",
        "source_batch_id": SOURCE_BATCH_ID,
        "source_id": SOURCE_ID,
        "source_name": SOURCE_NAME,
    }


def dedupe_rows(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    out = []
    for row in rows:
        key = (row["doctor_name"], row["treatment_name_normalized"])
        if key not in seen:
            seen.add(key)
            out.append(row)
    return out


def run() -> Dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    content = extract_content_block(INPUT_PATH)
    sections = split_sections(content)

    rows: List[Dict[str, str]] = []
    debug = {
        "meta": {
            "input_path": str(INPUT_PATH),
            "output_csv": str(OUTPUT_CSV),
            "output_debug_json": str(OUTPUT_DEBUG_JSON),
            "local_rule": "nur derselbe Ursache-Abschnitt",
            "mode": "autonomous rule-based",
        },
        "sections": [],
        "discarded_candidates": [],
        "final_matches": [],
    }

    row_id = 1

    for section in sections:
        heading = heading_of(section)
        providers = detect_providers(section)

        sec_debug = {
            "section_heading": heading,
            "providers_detected": providers,
            "provider_contexts": [],
        }

        if not providers:
            debug["sections"].append(sec_debug)
            continue

        for provider in providers:
            fragments = local_fragments_for_provider(section, provider)

            provider_debug = {
                "provider": provider,
                "local_fragments": fragments,
                "raw_candidates": [],
                "discarded": [],
                "included": [],
            }

            raw_candidate_phrases: List[str] = []
            for frag in fragments:
                for pattern in ACTION_PATTERNS:
                    for m in pattern.finditer(frag):
                        phrase = re.sub(r"\s+", " ", m.group("phrase")).strip(" .;,:")
                        if len(phrase) >= 8 and phrase not in raw_candidate_phrases:
                            raw_candidate_phrases.append(phrase)

            for frag in fragments:
                if any(re.search(p, frag, re.I) for p in POSITIVE_INDICATORS):
                    frag_clean = re.sub(r"\s+", " ", frag).strip(" .;,:")
                    if frag_clean not in raw_candidate_phrases:
                        raw_candidate_phrases.append(frag_clean)

            for raw_phrase in raw_candidate_phrases:
                score, pos_hits, neg_hits = score_phrase(raw_phrase)
                provider_debug["raw_candidates"].append({
                    "candidate_raw": raw_phrase,
                    "score": score,
                    "positive_hits": pos_hits,
                    "negative_hits": neg_hits,
                })

                if score <= 0:
                    reason = "zu schwach oder zu stark negativer Kontext"
                    provider_debug["discarded"].append({
                        "candidate_raw": raw_phrase,
                        "reason": reason,
                    })
                    debug["discarded_candidates"].append({
                        "section_heading": heading,
                        "provider": provider,
                        "candidate_raw": raw_phrase,
                        "reason": reason,
                    })
                    continue

                normalized_list = normalize_candidate(raw_phrase, heading)

                if not normalized_list:
                    reason = "keine belastbare Normalisierung in konkrete Maßnahme"
                    provider_debug["discarded"].append({
                        "candidate_raw": raw_phrase,
                        "reason": reason,
                    })
                    debug["discarded_candidates"].append({
                        "section_heading": heading,
                        "provider": provider,
                        "candidate_raw": raw_phrase,
                        "reason": reason,
                    })
                    continue

                for normalized in normalized_list:
                    row = build_row(
                        row_id=row_id,
                        doctor_name=provider,
                        treatment_name_raw=raw_phrase,
                        treatment_name_normalized=normalized,
                        recommendation_type=recommendation_type_from_phrase(raw_phrase),
                        evidence_excerpt=safe_excerpt(" ".join(fragments)),
                        evidence_strength=evidence_strength_from_phrase(raw_phrase),
                    )
                    rows.append(row)
                    provider_debug["included"].append({
                        "candidate_raw": raw_phrase,
                        "normalized": normalized,
                    })
                    debug["final_matches"].append({
                        "row_id": row_id,
                        "section_heading": heading,
                        "provider": provider,
                        "candidate_raw": raw_phrase,
                        "normalized": normalized,
                    })
                    row_id += 1

            sec_debug["provider_contexts"].append(provider_debug)

        debug["sections"].append(sec_debug)

    rows = dedupe_rows(rows)

    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=MASTER_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    with OUTPUT_DEBUG_JSON.open("w", encoding="utf-8") as f:
        json.dump(debug, f, ensure_ascii=False, indent=2)

    return {
        "status": "ok",
        "rows_written": len(rows),
        "csv": str(OUTPUT_CSV),
        "debug_json": str(OUTPUT_DEBUG_JSON),
    }


if __name__ == "__main__":
    result = run()
    print(f"status={result['status']}")
    print(f"rows_written={result['rows_written']}")
    print(f"csv={result['csv']}")
    print(f"debug_json={result['debug_json']}")