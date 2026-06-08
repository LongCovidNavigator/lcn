# -*- coding: utf-8 -*-
r"""
Autonomer, regelbasierter Matcher für Anbieter ↔ Treatment in Fasynation-Texten
V4: saubere Output-Pfade, kombinierte Rohphrasen werden expandiert

Input:
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\blog\txt\blog_0002.txt

Outputs:
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\05_py_matching\results\match_blog_0002_v4.csv
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\05_py_matching\results\match_blog_0002_v4_debug.json
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple


# ------------------------------------------------------------
# Pfade
# ------------------------------------------------------------

INPUT_PATH = Path(
    r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\01_batches\blog\txt\blog_0001.txt"
)

OUTPUT_DIR = Path(
    r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006\05_py_matching\results"
)


def make_output_paths(input_path: Path) -> tuple[Path, Path]:
    stem = input_path.stem
    return (
        OUTPUT_DIR / f"match_{stem}_v4.csv",
        OUTPUT_DIR / f"match_{stem}_v4_debug.json",
    )


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
    re.compile(r"\bProf\.\s*Dr\.\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,3}\b"),
    re.compile(r"\bDr\.\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,3}\b"),
    re.compile(r"\b(?:IMD(?:\s+in)?\s+Berlin)\b"),
    re.compile(r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+\s+Programm\b"),
    re.compile(r"\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+\s+(?:Institut|Labor|Praxis|Klinik|Zentrum)\b"),
]

ACTION_PATTERNS = [
    # kombinierte Diagnose/Behandlung
    re.compile(
        r"\bDiagnose\s+und\s+Behandlung\b[^.]{0,160}\bakuten?\b[^.]{0,40}\border\b[^.]{0,40}\bchronischen?\b[^.]{0,80}\bBorreliose\b",
        re.I,
    ),
    re.compile(
        r"\bBehandlung\b[^.]{0,160}\bakuten?\b[^.]{0,40}\border\b[^.]{0,40}\bchronischen?\b[^.]{0,80}\bBorreliose\b",
        re.I,
    ),
    # Einzeln
    re.compile(r"\bDiagnose\b[^.]{0,120}\bBorreliose\b", re.I),
    re.compile(r"\bBehandlung\b[^.]{0,120}\bakuten?\b[^.]{0,80}\bBorreliose\b", re.I),
    re.compile(r"\bBehandlung\b[^.]{0,120}\bchronischen?\b[^.]{0,80}\bBorreliose\b", re.I),
    # Mikronährstoffe / Mängel
    re.compile(r"\bMikronährstoff\w*\b[^.]{0,140}\bMangelerscheinung\w*\b", re.I),
    re.compile(r"\bfestgestellte\b[^.]{0,80}\bMängel\b[^.]{0,80}\bausgleichen\b", re.I),
    # Entgiftung
    re.compile(r"\bEntgiftung\b", re.I),
    re.compile(r"\bAusleitung\b[^.]{0,80}\bSchwermetall\w*\b", re.I),
    re.compile(r"\bEntgiftungsprotokoll\w*\b", re.I),
    re.compile(r"\bEntgiftung\b[^.]{0,140}\bErgänzungsmittel\w*\b[^.]{0,80}\bunterstützen\b", re.I),
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
    match = re.search(r"=== CONTENT START ===\n(.*?)\n=== CONTENT END ===", raw, re.S)
    if not match:
        raise ValueError("CONTENT START / END Block nicht gefunden.")
    return normalize_whitespace(match.group(1))


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
        for match in pattern.finditer(section):
            candidate = match.group(0).strip()
            if candidate not in found:
                found.append(candidate)
    return found


def local_fragments_for_provider(section: str, provider: str) -> List[str]:
    return [re.sub(r"\s+", " ", section).strip()]


def score_phrase(phrase: str) -> Tuple[int, List[str], List[str]]:
    pos_hits = [p for p in POSITIVE_INDICATORS if re.search(p, phrase, re.I)]
    neg_hits = [n for n in NEGATIVE_INDICATORS if re.search(n, phrase, re.I)]
    score = len(pos_hits) * 2 - len(neg_hits)
    return score, pos_hits, neg_hits


def recommendation_type_from_normalized(normalized: str) -> str:
    if normalized.startswith("Diagnose ") or normalized.endswith("-Diagnostik"):
        return "Diagnose"
    return ""


def evidence_strength_from_phrase(phrase: str) -> str:
    if re.search(r"\bDiagnose\b", phrase, re.I) and re.search(r"\bBehandlung\b", phrase, re.I):
        return "high"
    return "medium"


def normalize_provider_name(provider: str) -> str:
    provider = provider.strip()
    if provider == "Dr. Theuerkauf":
        return "Dr. Birgitt Theuerkauf"
    return provider


def dedupe_list(items: List[str]) -> List[str]:
    out: List[str] = []
    for item in items:
        if item not in out:
            out.append(item)
    return out


def extract_disease_after_phrase(phrase: str) -> str:
    disease = ""

    if re.search(r"\bBorreliose\b", phrase, re.I):
        disease = "Borreliose"

    if not disease:
        match = re.search(
            r"\b(?:Diagnose|Behandlung)\b.*?\b(?:von|einer|eines|einem|der|des)\b\s+(?P<obj>[^.,;:]+)",
            phrase,
            re.I,
        )
        if match:
            disease = match.group("obj").strip()

    disease = re.sub(r"\bakuten?\b|\bchronischen?\b|\bund\b|\border\b", "", disease, flags=re.I)
    disease = re.sub(r"\beiner\b|\beines\b|\beinem\b|\bder\b|\bdes\b|\bvon\b", "", disease, flags=re.I)
    disease = re.sub(r"\s+", " ", disease).strip(" -,:;")
    return disease


def expand_combined_borreliose_phrase(phrase: str) -> List[str]:
    disease = extract_disease_after_phrase(phrase)
    if not disease:
        return []

    has_diagnose = bool(re.search(r"\bDiagnose\b", phrase, re.I))
    has_behandlung = bool(re.search(r"\bBehandlung\b", phrase, re.I))
    has_acute = bool(re.search(r"\bakuten?\b", phrase, re.I))
    has_chronic = bool(re.search(r"\bchronischen?\b", phrase, re.I))

    out: List[str] = []

    if has_diagnose and has_acute:
        out.append(f"Diagnose akuter {disease}")
    if has_behandlung and has_acute:
        out.append(f"Behandlung akuter {disease}")
    if has_diagnose and has_chronic:
        out.append(f"Diagnose chronischer {disease}")
    if has_behandlung and has_chronic:
        out.append(f"Behandlung chronischer {disease}")

    if has_diagnose and not (has_acute or has_chronic):
        out.append(f"{disease}-Diagnostik")
    if has_behandlung and not (has_acute or has_chronic):
        out.append(f"Behandlung von {disease}")

    return dedupe_list(out)


def normalize_candidate(raw_phrase: str, section_heading: str) -> List[str]:
    phrase = re.sub(r"\s+", " ", raw_phrase).strip()
    out: List[str] = []

    if re.search(r"\bDiagnose\s+und\s+Behandlung\b", phrase, re.I) and re.search(r"\bBorreliose\b", phrase, re.I):
        expanded = expand_combined_borreliose_phrase(phrase)
        if expanded:
            return expanded

    if (
        re.search(r"\bBehandlung\b", phrase, re.I)
        and re.search(r"\bakuten?\b", phrase, re.I)
        and re.search(r"\bchronischen?\b", phrase, re.I)
        and re.search(r"\bBorreliose\b", phrase, re.I)
    ):
        disease = extract_disease_after_phrase(phrase)
        if disease:
            out.append(f"Behandlung akuter {disease}")
            out.append(f"Behandlung chronischer {disease}")
            return dedupe_list(out)

    if re.search(r"\bMikronährstoff", phrase, re.I):
        out.append("Mikronährstoffdiagnostik")
    if re.search(r"\bMangelerscheinung", phrase, re.I):
        out.append("Abklärung von Mangelerscheinungen")

    if re.search(r"\bausgleichen\b", phrase, re.I) and re.search(r"\bMängel\b", phrase, re.I):
        if re.search(r"\bMikronähr", section_heading, re.I) or re.search(r"\bMikronähr", phrase, re.I):
            out.append("Ausgleich festgestellter Mikronährstoffmängel")
        else:
            out.append("Ausgleich festgestellter Mängel")

    if re.fullmatch(r"Entgiftung", phrase, re.I):
        out.append("Entgiftung")
    elif re.search(r"\bEntgiftung\b", phrase, re.I) and not re.search(r"\bunterstützen\b", phrase, re.I):
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

    if re.search(r"\bDiagnose\b", phrase, re.I) and re.search(r"\bBorreliose\b", phrase, re.I):
        if re.search(r"\bakuten?\b", phrase, re.I):
            out.append("Diagnose akuter Borreliose")
        elif re.search(r"\bchronischen?\b", phrase, re.I):
            out.append("Diagnose chronischer Borreliose")
        else:
            out.append("Borreliose-Diagnostik")

    if re.search(r"\bBehandlung\b", phrase, re.I) and re.search(r"\bBorreliose\b", phrase, re.I):
        if re.search(r"\bakuten?\b", phrase, re.I):
            out.append("Behandlung akuter Borreliose")
        if re.search(r"\bchronischen?\b", phrase, re.I):
            out.append("Behandlung chronischer Borreliose")
        if not re.search(r"\bakuten?\b|\bchronischen?\b", phrase, re.I):
            out.append("Behandlung von Borreliose")

    return dedupe_list(out)


def build_row(
    row_id: int,
    doctor_name: str,
    treatment_name_raw: str,
    treatment_name_normalized: str,
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
        "recommendation_type": recommendation_type_from_normalized(treatment_name_normalized),
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


# ------------------------------------------------------------
# Hauptlogik
# ------------------------------------------------------------

def run() -> Dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_csv, output_debug_json = make_output_paths(INPUT_PATH)

    content = extract_content_block(INPUT_PATH)
    sections = split_sections(content)

    rows: List[Dict[str, str]] = []
    debug = {
        "meta": {
            "input_path": str(INPUT_PATH),
            "output_csv": str(output_csv),
            "output_debug_json": str(output_debug_json),
            "local_rule": "nur derselbe Ursache-Abschnitt",
            "mode": "autonomous rule-based v4",
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

        for provider_raw in providers:
            provider = normalize_provider_name(provider_raw)
            fragments = local_fragments_for_provider(section, provider)

            provider_debug = {
                "provider_raw": provider_raw,
                "provider_normalized": provider,
                "local_fragments": fragments,
                "raw_candidates": [],
                "discarded": [],
                "included": [],
            }

            raw_candidate_phrases: List[str] = []

            for frag in fragments:
                for pattern in ACTION_PATTERNS:
                    for match in pattern.finditer(frag):
                        phrase = re.sub(r"\s+", " ", match.group(0)).strip(" .;,:")
                        if len(phrase) >= 5 and phrase not in raw_candidate_phrases:
                            raw_candidate_phrases.append(phrase)

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

    with output_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=MASTER_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    with output_debug_json.open("w", encoding="utf-8") as f:
        json.dump(debug, f, ensure_ascii=False, indent=2)

    return {
        "status": "ok",
        "rows_written": len(rows),
        "csv": str(output_csv),
        "debug_json": str(output_debug_json),
    }


if __name__ == "__main__":
    result = run()
    print(f"status={result['status']}")
    print(f"rows_written={result['rows_written']}")
    print(f"csv={result['csv']}")
    print(f"debug_json={result['debug_json']}")