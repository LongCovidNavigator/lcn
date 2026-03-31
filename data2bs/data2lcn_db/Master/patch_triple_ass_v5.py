#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
from pathlib import Path
import pandas as pd


def norm(x):
    if pd.isna(x):
        return ""
    return str(x).strip()


def ensure_col(df: pd.DataFrame, col: str, default=""):
    if col not in df.columns:
        df[col] = default


def first_row_dict(df: pd.DataFrame) -> dict:
    if df.empty:
        return {}
    return df.iloc[0].to_dict()


def upsert_treatment(df: pd.DataFrame, treatment_name: str, defaults: dict):
    mask = df["treatment_name"].fillna("").eq(treatment_name)
    if mask.any():
        idx = df.index[mask][0]
        for k, v in defaults.items():
            if k in df.columns and (pd.isna(df.at[idx, k]) or str(df.at[idx, k]).strip() == ""):
                df.at[idx, k] = v
        df.at[idx, "status"] = "review_2"
    else:
        row = {c: "" for c in df.columns}
        row.update(defaults)
        row["treatment_name"] = treatment_name
        row["status"] = "review_2"
        df.loc[len(df)] = row


def upsert_alias(df: pd.DataFrame, alias: str, alias_type: str, source_examples: str, notes_internal: str = "", status="review_2"):
    mask = (
        df["alias"].fillna("").eq(alias)
        & df["alias_type"].fillna("").eq(alias_type)
    )
    if mask.any():
        idx = df.index[mask][0]
        df.at[idx, "source_examples"] = source_examples
        if "notes_internal" in df.columns and notes_internal:
            df.at[idx, "notes_internal"] = notes_internal
        df.at[idx, "status"] = status
    else:
        row = {c: "" for c in df.columns}
        row["alias"] = alias
        row["alias_type"] = alias_type
        if "source_examples" in df.columns:
            row["source_examples"] = source_examples
        if "notes_internal" in df.columns:
            row["notes_internal"] = notes_internal
        if "status" in df.columns:
            row["status"] = status
        df.loc[len(df)] = row


def remove_links(df: pd.DataFrame, treatment_name: str, alias_values: list[str]):
    mask = (
        df["treatment_name"].fillna("").eq(treatment_name)
        & df["alias"].fillna("").isin(alias_values)
    )
    return df.loc[~mask].copy()


def ensure_link(df: pd.DataFrame, treatment_name: str, alias: str, alias_type: str, link_note: str = "", status="review_2"):
    mask = (
        df["treatment_name"].fillna("").eq(treatment_name)
        & df["alias"].fillna("").eq(alias)
    )
    if mask.any():
        idx = df.index[mask][0]
        if "alias_type" in df.columns:
            df.at[idx, "alias_type"] = alias_type
        if "link_note" in df.columns:
            df.at[idx, "link_note"] = link_note
        if "status" in df.columns:
            df.at[idx, "status"] = status
    else:
        row = {c: "" for c in df.columns}
        row["treatment_name"] = treatment_name
        row["alias"] = alias
        if "alias_type" in df.columns:
            row["alias_type"] = alias_type
        if "link_note" in df.columns:
            row["link_note"] = link_note
        if "status" in df.columns:
            row["status"] = status
        df.loc[len(df)] = row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dir",
        default=r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\Master",
        help="Ordner mit den Master-CSVs",
    )
    args = parser.parse_args()

    base = Path(args.dir)

    treatments_path = base / "treatments_master_v3.csv"
    aliases_path = base / "aliases_master_v4.csv"
    links_path = base / "treatment_alias_links_v3.csv"
    research_path = base / "research_terms_v3.csv"

    treatments_out = base / "treatments_master_v5.csv"
    aliases_out = base / "aliases_master_v5.csv"
    links_out = base / "treatment_alias_links_v5.csv"
    research_out = base / "research_terms_v5.csv"

    treatments = pd.read_csv(treatments_path, dtype=str).fillna("")
    aliases = pd.read_csv(aliases_path, dtype=str).fillna("")
    links = pd.read_csv(links_path, dtype=str).fillna("")
    research = pd.read_csv(research_path, dtype=str).fillna("")

    for col in ["status", "source_row_nr", "original_name", "treatment_name", "slug_candidate", "typ", "weitere_hinweise", "decision_note"]:
        ensure_col(treatments, col, "")
    for col in ["status", "alias", "alias_type", "source_examples", "notes_internal"]:
        ensure_col(aliases, col, "")
    for col in ["status", "treatment_name", "alias", "alias_type", "link_note"]:
        ensure_col(links, col, "")

    combo_name = "Acetylsalicylsäure + Clopidogrel + Apixaban"
    combo_original = "Acetylsalicylsäure + Clopidogrel + Apixaban (Triple therapy)"

    combo_row = treatments.loc[treatments["treatment_name"].eq(combo_name)]
    combo_defaults = first_row_dict(combo_row)

    base_defaults = {
        "source_row_nr": combo_defaults.get("source_row_nr", ""),
        "original_name": combo_original,
        "typ": combo_defaults.get("typ", ""),
        "weitere_hinweise": combo_defaults.get("weitere_hinweise", ""),
        "decision_note": "review_2: Triple-Therapy-Block auf Einzeltherapien + Kombitherapie geschärft",
        "status": "review_2",
    }

    # 1) Acetylsalicylsäure als eigener Treatment-Eintrag ergänzen
    ass_defaults = base_defaults | {
        "treatment_name": "Acetylsalicylsäure",
        "slug_candidate": "acetylsalicylsaeure",
    }
    upsert_treatment(treatments, "Acetylsalicylsäure", ass_defaults)

    # 2) Relevante Alias-Einträge sicherstellen
    upsert_alias(
        aliases,
        alias="Acetylsalicylsäure",
        alias_type="primary_name",
        source_examples=combo_original,
        notes_internal="review_2: eigener Treatment-Eintrag ergänzt",
    )
    upsert_alias(
        aliases,
        alias="Aspirin",
        alias_type="trade_name",
        source_examples=combo_original,
        notes_internal="review_2: Alias wiederhergestellt",
    )
    upsert_alias(
        aliases,
        alias=combo_name,
        alias_type="umbrella_term",
        source_examples=combo_original,
        notes_internal="review_2: Kombitherapie-Alias",
    )
    upsert_alias(
        aliases,
        alias="Triple therapy",
        alias_type="alternate_name",
        source_examples=combo_original,
        notes_internal="review_2: englische Kombi-Bezeichnung",
    )
    upsert_alias(
        aliases,
        alias="Triple Therapie",
        alias_type="spelling_variant",
        source_examples=combo_original,
        notes_internal="review_2: deutsche Kombi-Bezeichnung",
    )

    # 3) Alte falsche Links für ASS bereinigen
    links = remove_links(
        links,
        treatment_name="Acetylsalicylsäure",
        alias_values=[
            "Acetylsalicylsäure",
            "Aspirin",
            combo_name,
            "Triple therapy",
            "Triple Therapie",
        ],
    )

    # 4) Gewünschte Links für Einzeltherapie Acetylsalicylsäure
    ensure_link(links, "Acetylsalicylsäure", "Acetylsalicylsäure", "primary_name", "")
    ensure_link(links, "Acetylsalicylsäure", "Aspirin", "trade_name", "")
    ensure_link(
        links,
        "Acetylsalicylsäure",
        combo_name,
        "umbrella_term",
        "Kombitherapie-Alias verweist auch auf Einzeltherapie",
    )
    ensure_link(
        links,
        "Acetylsalicylsäure",
        "Triple therapy",
        "umbrella_term",
        "Kombitherapie-Alias verweist auch auf Einzeltherapie",
    )
    ensure_link(
        links,
        "Acetylsalicylsäure",
        "Triple Therapie",
        "umbrella_term",
        "Kombitherapie-Alias verweist auch auf Einzeltherapie",
    )

    # 5) Kombi-Treatment soll auch über Einzelbegriffe auffindbar sein
    #    (wie bei deinen Zweier-Kombis)
    ensure_link(links, combo_name, "Acetylsalicylsäure", "alternate_name", "Einzelbegriff soll Kombitherapie auffindbar machen")
    ensure_link(links, combo_name, "Clopidogrel", "alternate_name", "Einzelbegriff soll Kombitherapie auffindbar machen")
    ensure_link(links, combo_name, "Apixaban", "alternate_name", "Einzelbegriff soll Kombitherapie auffindbar machen")
    ensure_link(links, combo_name, combo_name, "primary_name", "")
    ensure_link(links, combo_name, "Triple therapy", "alternate_name", "")
    ensure_link(links, combo_name, "Triple Therapie", "spelling_variant", "")

    # 6) Optional: auch die beiden anderen Einzeltherapien über Kombi-Aliase absichern
    for single_name in ["Clopidogrel", "Apixaban"]:
        ensure_link(
            links,
            single_name,
            combo_name,
            "umbrella_term",
            "Kombitherapie-Alias verweist auch auf Einzeltherapie",
        )
        ensure_link(
            links,
            single_name,
            "Triple therapy",
            "umbrella_term",
            "Kombitherapie-Alias verweist auch auf Einzeltherapie",
        )
        ensure_link(
            links,
            single_name,
            "Triple Therapie",
            "umbrella_term",
            "Kombitherapie-Alias verweist auch auf Einzeltherapie",
        )

    # 7) Status geänderter Bestandszeilen markieren
    treatments.loc[treatments["treatment_name"].eq(combo_name), "status"] = "review_2"
    aliases.loc[aliases["alias"].isin(["Acetylsalicylsäure", "Aspirin", combo_name, "Triple therapy", "Triple Therapie"]), "status"] = "review_2"
    links.loc[
        links["treatment_name"].isin(["Acetylsalicylsäure", combo_name, "Clopidogrel", "Apixaban"])
        & links["alias"].isin(["Acetylsalicylsäure", "Aspirin", combo_name, "Triple therapy", "Triple Therapie", "Clopidogrel", "Apixaban"]),
        "status"
    ] = "review_2"

    # Schreiben
    treatments.to_csv(treatments_out, index=False, encoding="utf-8-sig")
    aliases.to_csv(aliases_out, index=False, encoding="utf-8-sig")
    links.to_csv(links_out, index=False, encoding="utf-8-sig")
    research.to_csv(research_out, index=False, encoding="utf-8-sig")

    print("Erstellt:")
    print(f"  {treatments_out}")
    print(f"  {aliases_out}")
    print(f"  {links_out}")
    print(f"  {research_out}")
    print()
    print("Kurzcheck:")
    print("  - Treatment ergänzt: Acetylsalicylsäure")
    print("  - Alias wieder drin: Aspirin")
    print("  - Triple-Links in beide Richtungen ergänzt")


if __name__ == "__main__":
    main()