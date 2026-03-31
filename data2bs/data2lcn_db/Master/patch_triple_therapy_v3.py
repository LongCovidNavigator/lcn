#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Patch the Triple-Therapy alias mapping in the LCN master CSV files.

Input files expected in the target folder:
- treatments_master_v2.csv
- aliases_master_v2.csv
- treatment_alias_links_v2.csv
- research_terms_v2.csv

Output:
- *_v3.csv files in the same folder

Default folder:
    C:\xampp\htdocs\lcn\data2bs\data2lcn_db\Master
"""

from __future__ import annotations

import argparse
from pathlib import Path
import numpy as np
import pandas as pd

DEFAULT_DIR = Path(r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\Master")

def upsert_alias(df, alias, alias_type, source_examples=None, status='review_2', notes_internal=None):
    mask = df['alias'].eq(alias)
    if mask.any():
        idx = df.index[mask][0]
        df.at[idx, 'alias_type'] = alias_type
        if notes_internal is not None:
            df.at[idx, 'notes_internal'] = notes_internal
        existing = '' if pd.isna(df.at[idx, 'source_examples']) else str(df.at[idx, 'source_examples'])
        parts = [p.strip() for p in existing.split('|') if p and str(p).strip()]
        for p in (source_examples or []):
            if p not in parts:
                parts.append(p)
        df.at[idx, 'source_examples'] = ' | '.join(parts) if parts else np.nan
        df.at[idx, 'status'] = status
    else:
        df.loc[len(df)] = {
            'alias': alias,
            'alias_type': alias_type,
            'notes_internal': notes_internal,
            'status': status,
            'source_examples': ' | '.join(source_examples) if source_examples else np.nan,
        }

def add_link(df, treatment_name, alias, alias_type, status='review_2', link_note=None):
    mask = df['treatment_name'].eq(treatment_name) & df['alias'].eq(alias)
    if mask.any():
        idx = df.index[mask][0]
        df.at[idx, 'alias_type'] = alias_type
        df.at[idx, 'status'] = status
        if link_note is not None:
            df.at[idx, 'link_note'] = link_note
    else:
        df.loc[len(df)] = {
            'treatment_name': treatment_name,
            'alias': alias,
            'alias_type': alias_type,
            'status': status,
            'link_note': link_note if link_note is not None else alias_type,
        }

def remove_link(df, treatment_name, alias):
    return df.loc[~(df['treatment_name'].eq(treatment_name) & df['alias'].eq(alias))].copy()

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default=str(DEFAULT_DIR), help="Folder containing the v2 CSV files")
    args = parser.parse_args()

    folder = Path(args.dir)

    treatments = pd.read_csv(folder / "treatments_master_v2.csv")
    aliases = pd.read_csv(folder / "aliases_master_v2.csv")
    links = pd.read_csv(folder / "treatment_alias_links_v2.csv")
    research = pd.read_csv(folder / "research_terms_v2.csv")

    combo = 'Acetylsalicylsäure + Clopidogrel + Apixaban'
    single_a = 'Aspirin'
    single_c = 'Clopidogrel'
    single_p = 'Apixaban'

    # Remove wrong single-treatment mapping
    links = remove_link(links, single_a, 'Acetylsalicylsäure')

    # Ensure aliases exist
    upsert_alias(aliases, 'Triple therapy', 'alternate_name', [combo, single_a, single_c, single_p], status='review_2')
    upsert_alias(aliases, 'Triple Therapie', 'alternate_name', [combo, single_a, single_c, single_p], status='review_2')
    upsert_alias(aliases, combo, 'primary_name', [combo, single_a, single_c, single_p], status='review_2')
    upsert_alias(aliases, 'Aspirin', 'primary_name', [single_a, combo], status='review_2')
    upsert_alias(aliases, 'Acetylsalicylsäure', 'generic_name', [combo], status='review_2')
    upsert_alias(aliases, 'Clopidogrel', 'primary_name', [single_c, combo], status='review_2')
    upsert_alias(aliases, 'Apixaban', 'primary_name', [single_p, combo], status='review_2')

    # Combo treatment should be findable through both combo labels and single-med terms
    combo_links = [
        (combo, 'primary_name', 'primary_name'),
        ('Triple therapy', 'alternate_name', 'alternate_name'),
        ('Triple Therapie', 'alternate_name', 'alternate_name_de'),
        ('Aspirin', 'trade_name', 'single_component_for_combo_search'),
        ('Acetylsalicylsäure', 'generic_name', 'single_component_for_combo_search'),
        ('Clopidogrel', 'alternate_name', 'single_component_for_combo_search'),
        ('Apixaban', 'alternate_name', 'single_component_for_combo_search'),
    ]
    for alias, atype, note in combo_links:
        add_link(links, combo, alias, atype, status='review_2', link_note=note)

    # Single meds should also surface combo results in search
    single_links = {
        single_a: [
            ('Aspirin', 'primary_name', 'primary_name'),
            (combo, 'umbrella_term', 'combo_alias_for_single_search'),
            ('Triple therapy', 'umbrella_term', 'combo_alias_for_single_search'),
            ('Triple Therapie', 'umbrella_term', 'combo_alias_for_single_search_de'),
        ],
        single_c: [
            ('Clopidogrel', 'primary_name', 'primary_name'),
            (combo, 'umbrella_term', 'combo_alias_for_single_search'),
            ('Triple therapy', 'umbrella_term', 'combo_alias_for_single_search'),
            ('Triple Therapie', 'umbrella_term', 'combo_alias_for_single_search_de'),
        ],
        single_p: [
            ('Apixaban', 'primary_name', 'primary_name'),
            (combo, 'umbrella_term', 'combo_alias_for_single_search'),
            ('Triple therapy', 'umbrella_term', 'combo_alias_for_single_search'),
            ('Triple Therapie', 'umbrella_term', 'combo_alias_for_single_search_de'),
        ],
    }
    for treat_name, rows in single_links.items():
        for alias, atype, note in rows:
            add_link(links, treat_name, alias, atype, status='review_2', link_note=note)

    aliases = aliases.drop_duplicates(subset=['alias'], keep='last').sort_values(['alias']).reset_index(drop=True)
    links = links.drop_duplicates(subset=['treatment_name', 'alias'], keep='last').sort_values(['treatment_name', 'alias']).reset_index(drop=True)

    treatments.to_csv(folder / "treatments_master_v3.csv", index=False)
    aliases.to_csv(folder / "aliases_master_v3.csv", index=False)
    links.to_csv(folder / "treatment_alias_links_v3.csv", index=False)
    research.to_csv(folder / "research_terms_v3.csv", index=False)

    print("Created:")
    print(folder / "treatments_master_v3.csv")
    print(folder / "aliases_master_v3.csv")
    print(folder / "treatment_alias_links_v3.csv")
    print(folder / "research_terms_v3.csv")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
