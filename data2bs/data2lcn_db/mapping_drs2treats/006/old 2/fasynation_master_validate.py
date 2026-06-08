#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fasynation master merge validation

Ziel:
- validieren, ob 04_master korrekt aus master.csv und fasynation_master_merged.txt besteht
- keine Änderungen schreiben, nur prüfen und Berichte erzeugen

Erwartete Struktur unter --base-dir:
  04_master/
    fasynation_master_merged.txt
    master.csv

Output in 04_master:
  master_validation_summary.csv
  master_validation_details.csv
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

MASTER_TXT = "fasynation_master_merged.txt"
MASTER_CSV = "master.csv"

BATCH_HEADERS = {
    "blog": "BATCH_MASTER_START: blog",
    "intern_fasymail": "BATCH_MASTER_START: intern_fasymail",
    "intern_episodentexte": "BATCH_MASTER_START: intern_episodentexte",
}

BLOCK_RE = re.compile(
    r"={50}\n"
    r"PAGE_ID:\s*(?P<page_id>[^\n]+)\n"
    r"SOURCE_NAME:\s*(?P<source_name>[^\n]+)\n"
    r"BATCH_NAME:\s*(?P<batch_name>[^\n]+)\n"
    r"TITLE_INPUT:\s*(?P<title_input>[^\n]*)\n"
    r"URL:\s*(?P<url>[^\n]+)\n"
    r"={50}\n",
    flags=re.MULTILINE,
)

CONTENT_START_RE = re.compile(r"=== CONTENT START ===")
CONTENT_END_RE = re.compile(r"=== CONTENT END ===")


def normalize(s: str) -> str:
    return (s or "").strip()


def read_rows(csv_path: Path) -> list[dict]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def safe_int(value) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return 999999999


def sort_key(row: dict) -> tuple:
    return (
        safe_int(row.get("master_order", "")),
        normalize(row.get("page_id", "")),
    )


def parse_blocks(text: str) -> list[dict]:
    matches = list(BLOCK_RE.finditer(text))
    blocks = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        blocks.append({
            "page_id": normalize(m.group("page_id")),
            "source_name": normalize(m.group("source_name")),
            "batch_name": normalize(m.group("batch_name")),
            "title_input": normalize(m.group("title_input")),
            "url": normalize(m.group("url")),
            "body": body,
        })
    return blocks


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", required=True, help="Basisordner der Quelle 006")
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    master_dir = base_dir / "04_master"

    if not master_dir.exists():
        raise SystemExit(f"04_master nicht gefunden: {master_dir}")

    master_txt_path = master_dir / MASTER_TXT
    master_csv_path = master_dir / MASTER_CSV

    if not master_txt_path.exists():
        raise SystemExit(f"Fehlende Datei: {master_txt_path}")
    if not master_csv_path.exists():
        raise SystemExit(f"Fehlende Datei: {master_csv_path}")

    rows = read_rows(master_csv_path)
    rows = sorted(rows, key=sort_key)

    text = master_txt_path.read_text(encoding="utf-8", errors="ignore")
    blocks = parse_blocks(text)

    details = []
    summary = []

    expected_ids = [normalize(r.get("page_id", "")) for r in rows if normalize(r.get("page_id", ""))]
    actual_ids = [b["page_id"] for b in blocks]

    expected_counter = Counter(expected_ids)
    actual_counter = Counter(actual_ids)

    expected_map = {normalize(r.get("page_id", "")): r for r in rows if normalize(r.get("page_id", ""))}

    # Gesamtchecks
    if len(rows) != len(blocks):
        details.append({
            "scope": "global",
            "page_id": "",
            "severity": "error",
            "issue_type": "block_count_mismatch",
            "issue": f"master.csv rows={len(rows)} master blocks={len(blocks)}",
        })

    dup_csv = sorted([pid for pid, cnt in expected_counter.items() if cnt > 1])
    if dup_csv:
        details.append({
            "scope": "global",
            "page_id": "",
            "severity": "error",
            "issue_type": "duplicate_page_id_in_master_csv",
            "issue": "; ".join(dup_csv),
        })

    dup_txt = sorted([pid for pid, cnt in actual_counter.items() if cnt > 1])
    if dup_txt:
        details.append({
            "scope": "global",
            "page_id": "",
            "severity": "error",
            "issue_type": "duplicate_page_id_in_master_txt",
            "issue": "; ".join(dup_txt),
        })

    missing_in_txt = [pid for pid in expected_ids if actual_counter[pid] == 0]
    if missing_in_txt:
        details.append({
            "scope": "global",
            "page_id": "",
            "severity": "error",
            "issue_type": "missing_page_ids_in_master_txt",
            "issue": "; ".join(missing_in_txt),
        })

    extra_in_txt = [pid for pid in actual_ids if expected_counter[pid] == 0]
    if extra_in_txt:
        details.append({
            "scope": "global",
            "page_id": "",
            "severity": "error",
            "issue_type": "extra_page_ids_in_master_txt",
            "issue": "; ".join(extra_in_txt),
        })

    if expected_ids != actual_ids:
        details.append({
            "scope": "global",
            "page_id": "",
            "severity": "warning",
            "issue_type": "order_mismatch",
            "issue": "master.csv page_id order differs from master txt block order",
        })

    # Batch-Header prüfen
    for batch_name, marker in BATCH_HEADERS.items():
        if marker not in text:
            details.append({
                "scope": "global",
                "page_id": "",
                "severity": "warning",
                "issue_type": "missing_batch_header",
                "issue": marker,
            })

    # Blockweise prüfen
    for idx, block in enumerate(blocks):
        pid = block["page_id"]
        row = expected_map.get(pid, {})
        expected_batch = normalize(row.get("batch_name", ""))
        expected_title = normalize(row.get("title_input", ""))
        expected_url = normalize(row.get("url", ""))
        expected_source_name = normalize(row.get("source_name", "Fasynation")) or "Fasynation"

        body = block["body"]

        if block["source_name"] != "Fasynation":
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "error",
                "issue_type": "source_name_mismatch",
                "issue": f"found {block['source_name']}",
            })

        if expected_batch and block["batch_name"] != expected_batch:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "error",
                "issue_type": "batch_name_mismatch",
                "issue": f"merged={block['batch_name']} csv={expected_batch}",
            })

        if expected_title and block["title_input"] != expected_title:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "error",
                "issue_type": "title_input_mismatch",
                "issue": f"merged='{block['title_input']}' csv='{expected_title}'",
            })

        if expected_url and block["url"] != expected_url:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "error",
                "issue_type": "url_mismatch",
                "issue": f"merged='{block['url']}' csv='{expected_url}'",
            })

        if CONTENT_START_RE.search(body) is None:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "error",
                "issue_type": "missing_content_start_marker",
                "issue": "=== CONTENT START === not found",
            })

        if CONTENT_END_RE.search(body) is None:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "error",
                "issue_type": "missing_content_end_marker",
                "issue": "=== CONTENT END === not found",
            })

        if f"PAGE_ID: {pid}" not in body:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "warning",
                "issue_type": "inner_txt_header_missing_page_id",
                "issue": "inner txt header does not repeat PAGE_ID",
            })

        if expected_title and f"TITLE_INPUT: {expected_title}" not in body:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "warning",
                "issue_type": "inner_txt_header_missing_title",
                "issue": "inner txt header does not repeat TITLE_INPUT",
            })

        if expected_url and f"URL: {expected_url}" not in body:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "warning",
                "issue_type": "inner_txt_header_missing_url",
                "issue": "inner txt header does not repeat URL",
            })

        if len(body) < 200:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "warning",
                "issue_type": "very_short_block",
                "issue": f"block body length only {len(body)} chars",
            })

        if idx < len(expected_ids) and pid != expected_ids[idx]:
            details.append({
                "scope": "block",
                "page_id": pid,
                "severity": "warning",
                "issue_type": "position_mismatch",
                "issue": f"merged_position={idx+1} expected_page_id={expected_ids[idx]}",
            })

    # Summary
    status = "ok"
    if any(d["severity"] == "error" for d in details):
        status = "review"
    total_errors = sum(1 for d in details if d["severity"] == "error")
    total_warnings = sum(1 for d in details if d["severity"] == "warning")

    summary.append({
        "master_txt": MASTER_TXT,
        "master_csv": MASTER_CSV,
        "csv_rows": len(rows),
        "txt_blocks": len(blocks),
        "status": status,
        "error_count": total_errors,
        "warning_count": total_warnings,
    })

    summary_path = master_dir / "master_validation_summary.csv"
    details_path = master_dir / "master_validation_details.csv"

    write_csv(
        summary_path,
        summary,
        ["master_txt", "master_csv", "csv_rows", "txt_blocks", "status", "error_count", "warning_count"],
    )

    write_csv(
        details_path,
        details,
        ["scope", "page_id", "severity", "issue_type", "issue"],
    )

    print(f"status={status} csv_rows={len(rows)} txt_blocks={len(blocks)} errors={total_errors} warnings={total_warnings}")
    print(f"written: {summary_path}")
    print(f"written: {details_path}")


if __name__ == "__main__":
    main()
