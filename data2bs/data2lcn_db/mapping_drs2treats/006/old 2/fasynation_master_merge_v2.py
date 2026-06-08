#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fasynation master merge v2

Ziel:
- aus 02_merge die drei Batch-Merges zu einem Master-Merge zusammenführen
- zusätzlich eine master.csv erzeugen
- Output in 04_master

Erwartete Struktur unter --base-dir:
  02_merge/
    blog_merged.txt
    intern_fasymail_merged.txt
    intern_episodentexte_merged.txt
    blog_pages.csv
    ifm_pages.csv
    ies_pages.csv

Output:
  04_master/
    fasynation_master_merged.txt
    master.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

ORDER = [
    {
        "key": "blog",
        "merged_file": "blog_merged.txt",
        "csv_file": "blog_pages.csv",
        "batch_name": "blog",
    },
    {
        "key": "ifm",
        "merged_file": "intern_fasymail_merged.txt",
        "csv_file": "ifm_pages.csv",
        "batch_name": "intern_fasymail",
    },
    {
        "key": "ies",
        "merged_file": "intern_episodentexte_merged.txt",
        "csv_file": "ies_pages.csv",
        "batch_name": "intern_episodentexte",
    },
]


def read_rows(csv_path: Path) -> list[dict]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def safe_int(value) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return 999999


def sort_key(row: dict) -> tuple:
    return (
        safe_int(row.get("input_order", "")),
        str(row.get("page_id", "")).strip(),
    )


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def require_file(path: Path, label: str) -> None:
    if not path.exists():
        raise SystemExit(f"Fehlende Datei ({label}): {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", required=True, help="Basisordner der Quelle 006")
    parser.add_argument("--overwrite", action="store_true", help="Vorhandene Dateien in 04_master überschreiben")
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        raise SystemExit(f"Base dir not found: {base_dir}")

    merge_dir = base_dir / "02_merge"
    master_dir = base_dir / "04_master"

    if not merge_dir.exists():
        raise SystemExit(f"02_merge nicht gefunden: {merge_dir}")

    master_dir.mkdir(parents=True, exist_ok=True)

    master_txt_path = master_dir / "fasynation_master_merged.txt"
    master_csv_path = master_dir / "master.csv"

    if (master_txt_path.exists() or master_csv_path.exists()) and not args.overwrite:
        raise SystemExit(
            "04_master enthält bereits Zieldateien.\n"
            "Bitte erneut mit --overwrite ausführen."
        )

    merged_parts: list[str] = []
    master_rows: list[dict] = []
    master_order = 1

    for cfg in ORDER:
        merged_path = merge_dir / cfg["merged_file"]
        csv_path = merge_dir / cfg["csv_file"]

        require_file(merged_path, "merged")
        require_file(csv_path, "csv")

        merged_text = merged_path.read_text(encoding="utf-8", errors="ignore").strip()
        if merged_text:
            batch_header = (
                "\n\n"
                + "#" * 80 + "\n"
                + f"BATCH_MASTER_START: {cfg['batch_name']}\n"
                + f"SOURCE_MERGED_FILE: {cfg['merged_file']}\n"
                + "#" * 80 + "\n\n"
            )
            merged_parts.append(batch_header + merged_text)

        rows = read_rows(csv_path)
        rows = sorted(rows, key=sort_key)

        for row in rows:
            page_id = str(row.get("page_id", "")).strip()
            title_input = str(row.get("title_input", "")).strip()
            url = str(row.get("url", "")).strip()
            input_order = str(row.get("input_order", "")).strip()

            master_rows.append({
                "master_order": master_order,
                "batch_key": cfg["key"],
                "batch_name": cfg["batch_name"],
                "input_order": input_order,
                "page_id": page_id,
                "title_input": title_input,
                "url": url,
                "source_name": "Fasynation",
                "source_csv": cfg["csv_file"],
                "source_merged_file": cfg["merged_file"],
            })
            master_order += 1

    master_text = "\n".join(merged_parts).strip() + "\n"
    master_txt_path.write_text(master_text, encoding="utf-8")

    fieldnames = [
        "master_order",
        "batch_key",
        "batch_name",
        "input_order",
        "page_id",
        "title_input",
        "url",
        "source_name",
        "source_csv",
        "source_merged_file",
    ]
    write_csv(master_csv_path, master_rows, fieldnames)

    print(f"written: {master_txt_path}")
    print(f"written: {master_csv_path}")
    print(f"master_rows: {len(master_rows)}")


if __name__ == "__main__":
    main()
