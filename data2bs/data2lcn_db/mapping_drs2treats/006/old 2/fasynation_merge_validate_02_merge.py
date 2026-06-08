#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fasynation merge validation for 02_merge

Ziel:
- validieren, ob die drei merged TXT-Dateien korrekt aus den jeweiligen *_pages.csv
  zusammengesetzt wurden
- keine neuen Inhalte erzeugen
- keine Korrekturen schreiben
- nur prüfen und Berichte erzeugen

Erwartete Struktur unter --merge-dir:
  02_merge/
    blog_merged.txt
    intern_fasymail_merged.txt
    intern_episodentexte_merged.txt
    blog_pages.csv
    ifm_pages.csv
    ies_pages.csv

Output in demselben Ordner:
  merge_validation_summary.csv
  merge_validation_details.csv
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

EXPECTED = {
    "blog": {
        "merged": "blog_merged.txt",
        "csv": "blog_pages.csv",
        "prefix": "blog_",
        "batch_name": "blog",
    },
    "ifm": {
        "merged": "intern_fasymail_merged.txt",
        "csv": "ifm_pages.csv",
        "prefix": "ifm_",
        "batch_name": "intern_fasymail",
    },
    "ies": {
        "merged": "intern_episodentexte_merged.txt",
        "csv": "ies_pages.csv",
        "prefix": "iep_",
        "batch_name": "intern_episodentexte",
    },
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
COMMENTS_START_RE = re.compile(r"=== COMMENTS START ===")
COMMENTS_END_RE = re.compile(r"=== COMMENTS END ===")


def read_rows(csv_path: Path) -> list[dict]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def normalize(s: str) -> str:
    return (s or "").strip()


def get_sort_key(row: dict) -> tuple:
    page_id = normalize(row.get("page_id", ""))
    input_order = normalize(row.get("input_order", ""))
    try:
        input_order_num = int(input_order)
    except Exception:
        input_order_num = 999999
    return (input_order_num, page_id)


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


def validate_pair(key: str, merge_dir: Path) -> tuple[list[dict], dict]:
    cfg = EXPECTED[key]
    merged_path = merge_dir / cfg["merged"]
    csv_path = merge_dir / cfg["csv"]

    details = []
    summary = {
        "file_key": key,
        "merged_file": cfg["merged"],
        "csv_file": cfg["csv"],
        "csv_rows": 0,
        "merged_blocks": 0,
        "status": "ok",
        "notes": "",
    }

    if not merged_path.exists():
        summary["status"] = "broken"
        summary["notes"] = f"missing merged file: {merged_path.name}"
        return details, summary

    if not csv_path.exists():
        summary["status"] = "broken"
        summary["notes"] = f"missing csv file: {csv_path.name}"
        return details, summary

    rows = read_rows(csv_path)
    rows_sorted = sorted(rows, key=get_sort_key)
    expected_ids = [normalize(r.get("page_id", "")) for r in rows_sorted if normalize(r.get("page_id", ""))]
    expected_map = {normalize(r.get("page_id", "")): r for r in rows_sorted if normalize(r.get("page_id", ""))}

    merged_text = merged_path.read_text(encoding="utf-8", errors="ignore")
    blocks = parse_blocks(merged_text)

    summary["csv_rows"] = len(expected_ids)
    summary["merged_blocks"] = len(blocks)

    actual_ids = [b["page_id"] for b in blocks]

    expected_counter = Counter(expected_ids)
    actual_counter = Counter(actual_ids)

    csv_id_duplicates = sorted([pid for pid, cnt in expected_counter.items() if cnt > 1])
    merged_id_duplicates = sorted([pid for pid, cnt in actual_counter.items() if cnt > 1])

    missing_from_merge = [pid for pid in expected_ids if actual_counter[pid] == 0]
    extra_in_merge = [pid for pid in actual_ids if expected_counter[pid] == 0]

    order_matches = expected_ids == actual_ids

    issues_found = False

    # Datei-Ebene
    if len(expected_ids) != len(actual_ids):
        issues_found = True
        details.append({
            "file_key": key,
            "page_id": "",
            "severity": "error",
            "issue_type": "block_count_mismatch",
            "issue": f"csv_rows={len(expected_ids)} merged_blocks={len(actual_ids)}",
        })

    if csv_id_duplicates:
        issues_found = True
        details.append({
            "file_key": key,
            "page_id": "",
            "severity": "error",
            "issue_type": "duplicate_page_id_in_csv",
            "issue": "; ".join(csv_id_duplicates),
        })

    if merged_id_duplicates:
        issues_found = True
        details.append({
            "file_key": key,
            "page_id": "",
            "severity": "error",
            "issue_type": "duplicate_page_id_in_merged",
            "issue": "; ".join(merged_id_duplicates),
        })

    if missing_from_merge:
        issues_found = True
        details.append({
            "file_key": key,
            "page_id": "",
            "severity": "error",
            "issue_type": "missing_page_ids_in_merged",
            "issue": "; ".join(missing_from_merge),
        })

    if extra_in_merge:
        issues_found = True
        details.append({
            "file_key": key,
            "page_id": "",
            "severity": "error",
            "issue_type": "extra_page_ids_in_merged",
            "issue": "; ".join(extra_in_merge),
        })

    if not order_matches:
        issues_found = True
        details.append({
            "file_key": key,
            "page_id": "",
            "severity": "warning",
            "issue_type": "order_mismatch",
            "issue": "page_id order in merged file differs from csv order",
        })

    # Block-Ebene
    for idx, block in enumerate(blocks):
        pid = block["page_id"]
        body = block["body"]
        row = expected_map.get(pid, {})

        expected_title = normalize(row.get("title_input", ""))
        expected_url = normalize(row.get("url", ""))

        if not pid.startswith(cfg["prefix"]):
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "unexpected_page_id_prefix",
                "issue": f"expected prefix {cfg['prefix']}",
            })

        if block["batch_name"] != cfg["batch_name"]:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "batch_name_mismatch",
                "issue": f"found {block['batch_name']} expected {cfg['batch_name']}",
            })

        if block["source_name"] != "Fasynation":
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "source_name_mismatch",
                "issue": f"found {block['source_name']} expected Fasynation",
            })

        if expected_title and block["title_input"] != expected_title:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "title_input_mismatch",
                "issue": f"merged='{block['title_input']}' csv='{expected_title}'",
            })

        if expected_url and block["url"] != expected_url:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "url_mismatch",
                "issue": f"merged='{block['url']}' csv='{expected_url}'",
            })

        # Erwartete innere TXT-Marker vorhanden?
        if CONTENT_START_RE.search(body) is None:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "missing_content_start_marker",
                "issue": "=== CONTENT START === not found in block body",
            })

        if CONTENT_END_RE.search(body) is None:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "missing_content_end_marker",
                "issue": "=== CONTENT END === not found in block body",
            })

        # Kommentare nur symmetrisch prüfen
        has_comments_start = COMMENTS_START_RE.search(body) is not None
        has_comments_end = COMMENTS_END_RE.search(body) is not None
        if has_comments_start != has_comments_end:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "error",
                "issue_type": "comments_marker_asymmetry",
                "issue": "comments start/end markers not balanced",
            })

        # interner TXT-Header sollte denselben PAGE_ID/URL/TITLE enthalten
        if f"PAGE_ID: {pid}" not in body:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "warning",
                "issue_type": "inner_txt_header_missing_page_id",
                "issue": "inner txt header does not repeat PAGE_ID",
            })

        if expected_url and f"URL: {expected_url}" not in body:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "warning",
                "issue_type": "inner_txt_header_missing_url",
                "issue": "inner txt header does not repeat expected URL",
            })

        if expected_title and f"TITLE_INPUT: {expected_title}" not in body:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "warning",
                "issue_type": "inner_txt_header_missing_title",
                "issue": "inner txt header does not repeat expected TITLE_INPUT",
            })

        # Minimaler Block-Inhalt
        if len(body) < 200:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "warning",
                "issue_type": "very_short_block",
                "issue": f"block body length only {len(body)} chars",
            })

        # Reihenfolge pro Block konkret markieren
        if idx < len(expected_ids) and pid != expected_ids[idx]:
            issues_found = True
            details.append({
                "file_key": key,
                "page_id": pid,
                "severity": "warning",
                "issue_type": "position_mismatch",
                "issue": f"merged_position={idx+1} expected_page_id={expected_ids[idx]}",
            })

    if issues_found:
        summary["status"] = "review"
        counts = Counter(d["issue_type"] for d in details if d["file_key"] == key)
        summary["notes"] = "; ".join(f"{k}={v}" for k, v in sorted(counts.items()))
    else:
        summary["status"] = "ok"
        summary["notes"] = "merged file matches csv structure and block set"

    return details, summary


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--merge-dir", required=True, help="Pfad zu 02_merge")
    args = parser.parse_args()

    merge_dir = Path(args.merge_dir)
    if not merge_dir.exists():
        raise SystemExit(f"merge dir not found: {merge_dir}")

    all_details = []
    all_summary = []

    for key in ["blog", "ifm", "ies"]:
        details, summary = validate_pair(key, merge_dir)
        all_details.extend(details)
        all_summary.append(summary)
        print(f"[{key}] status={summary['status']} csv_rows={summary['csv_rows']} merged_blocks={summary['merged_blocks']}")

    summary_path = merge_dir / "merge_validation_summary.csv"
    details_path = merge_dir / "merge_validation_details.csv"

    write_csv(
        summary_path,
        all_summary,
        ["file_key", "merged_file", "csv_file", "csv_rows", "merged_blocks", "status", "notes"],
    )

    write_csv(
        details_path,
        all_details,
        ["file_key", "page_id", "severity", "issue_type", "issue"],
    )

    print(f"written: {summary_path.name}")
    print(f"written: {details_path.name}")


if __name__ == "__main__":
    main()
