#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fasynation Batch Merge

Ziel:
- pro Batch alle TXT-Dateien in stabiler Reihenfolge zu einer merged TXT zusammenführen
- vorhandene CSV-Dateien des Batchs in den merge-Ordner kopieren
- keine neuen CSVs erzeugen

Erwartete Struktur unter --base-dir:
  01_batches/
    blog/
      txt/
      blog_pages.csv
      txt_validation.csv
      ...
    intern_fasymail/
      txt/
      blog_pages.csv
      txt_validation.csv
      ...
    intern_episodentexte/
      txt/
      blog_pages.csv
      txt_validation.csv
      ...

Output:
  01_batches/<batch>/merge/
    <batch>_merged.txt
    *.csv   (kopierte vorhandene CSV-Dateien aus dem Batch-Ordner)
"""

from __future__ import annotations

import argparse
import csv
import shutil
from pathlib import Path

BATCHES = ["blog", "intern_fasymail", "intern_episodentexte"]


def load_rows(batch_pages_csv: Path) -> list[dict]:
    with batch_pages_csv.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def sort_key(row: dict) -> tuple:
    page_id = (row.get("page_id") or "").strip()
    input_order = (row.get("input_order") or "").strip()
    try:
        input_order_num = int(input_order)
    except Exception:
        input_order_num = 999999
    return (input_order_num, page_id)


def copy_batch_csvs(batch_dir: Path, merge_dir: Path) -> int:
    copied = 0
    for csv_path in batch_dir.glob("*.csv"):
        target = merge_dir / csv_path.name
        shutil.copy2(csv_path, target)
        copied += 1
    return copied


def process_batch(base_dir: Path, batch_name: str, overwrite: bool = False) -> tuple[int, int]:
    batch_dir = base_dir / "01_batches" / batch_name
    merge_dir = batch_dir / "merge"
    merge_dir.mkdir(parents=True, exist_ok=True)

    batch_pages_csv = batch_dir / "blog_pages.csv"
    if not batch_pages_csv.exists():
        print(f"[{batch_name}] blog_pages.csv fehlt: {batch_pages_csv}")
        return 0, 0

    rows = load_rows(batch_pages_csv)
    rows = sorted(rows, key=sort_key)

    merged_path = merge_dir / f"{batch_name}_merged.txt"
    if merged_path.exists() and not overwrite:
        raise SystemExit(
            f"Merge-Datei existiert bereits: {merged_path}\n"
            f"Nochmal mit --overwrite ausführen."
        )

    merged_parts: list[str] = []
    included = 0
    missing = 0

    for row in rows:
        page_id = (row.get("page_id") or "").strip()
        title_input = (row.get("title_input") or "").strip()
        url = (row.get("url") or "").strip()
        txt_relpath = (row.get("txt_relpath") or "").strip()

        if not txt_relpath:
            missing += 1
            continue

        txt_path = batch_dir / Path(txt_relpath.replace("\\", "/"))
        if not txt_path.exists():
            missing += 1
            continue

        txt_body = txt_path.read_text(encoding="utf-8", errors="ignore").strip()

        block = (
            "==================================================\n"
            f"PAGE_ID: {page_id}\n"
            "SOURCE_NAME: Fasynation\n"
            f"BATCH_NAME: {batch_name}\n"
            f"TITLE_INPUT: {title_input}\n"
            f"URL: {url}\n"
            "==================================================\n\n"
            f"{txt_body}\n"
        )
        merged_parts.append(block)
        included += 1

    final_text = "\n\n".join(merged_parts).strip() + "\n"
    merged_path.write_text(final_text, encoding="utf-8")

    copied_csvs = copy_batch_csvs(batch_dir, merge_dir)

    print(f"[{batch_name}] merged={included}, missing_txt={missing}, copied_csvs={copied_csvs}")
    return included, missing


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", required=True, help="Basisordner der Quelle 006")
    parser.add_argument("--overwrite", action="store_true", help="Vorhandene merged Dateien überschreiben")
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        raise SystemExit(f"Base dir not found: {base_dir}")

    total_included = 0
    total_missing = 0

    for batch in BATCHES:
        included, missing = process_batch(base_dir, batch, overwrite=args.overwrite)
        total_included += included
        total_missing += missing

    print(f"[gesamt] merged={total_included}, missing_txt={total_missing}")


if __name__ == "__main__":
    main()
