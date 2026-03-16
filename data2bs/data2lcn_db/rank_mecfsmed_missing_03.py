#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
INPUT_CSV = BASE_DIR / "mecfsmed_missing_03.csv"
OUTPUT_CSV = BASE_DIR / "mecfsmed_missing_03_ranked.csv"


def norm(s):
    return str(s or "").strip()


def has_value(row, key):
    return norm(row.get(key)) != ""


def score_row(row):
    score = 0.0

    # Kernidentität
    if has_value(row, "first_name"):
        score += 2
    if has_value(row, "last_name"):
        score += 2
    if has_value(row, "title"):
        score += 1
    if has_value(row, "slug"):
        score += 1
    if has_value(row, "external_id"):
        score += 1

    # Kontakt / Web
    if has_value(row, "website"):
        score += 3
    if has_value(row, "email"):
        score += 3
    if has_value(row, "phone"):
        score += 2

    # Adresse
    if has_value(row, "street"):
        score += 2
    if has_value(row, "zipcode"):
        score += 1.5
    if has_value(row, "city"):
        score += 1.5

    # Bonus für vollständige Anschrift
    if has_value(row, "street") and has_value(row, "zipcode") and has_value(row, "city"):
        score += 2

    return score


def main():
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Fehlt: {INPUT_CSV}")

    with INPUT_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = list(reader)

    for row in rows:
        row["_score"] = score_row(row)

    rows.sort(
        key=lambda r: (
            -r["_score"],
            norm(r.get("last_name")).lower(),
            norm(r.get("first_name")).lower(),
        )
    )

    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        fieldnames = list(rows[0].keys()) if rows else []
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)

    print("Top-Kandidaten:")
    for i, row in enumerate(rows[:9], start=1):
        print(
            f"{i:>2}. score={row['_score']:>4} | "
            f"{norm(row.get('title'))} {norm(row.get('first_name'))} {norm(row.get('last_name'))}".strip()
            + f" | city={norm(row.get('city'))}"
            + f" | website={'Y' if has_value(row, 'website') else '-'}"
            + f" | email={'Y' if has_value(row, 'email') else '-'}"
            + f" | phone={'Y' if has_value(row, 'phone') else '-'}"
            + f" | address={'Y' if has_value(row, 'street') and has_value(row, 'zipcode') and has_value(row, 'city') else '-'}"
        )

    print(f"\nWrote: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()