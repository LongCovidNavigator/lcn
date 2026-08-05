#!/usr/bin/env python3
import argparse
import csv
import os
import sys
from collections import Counter
from typing import Dict, List, Tuple, Optional

from pathlib import Path

_LCN_HELPER_DIR = next(parent for parent in Path(__file__).resolve().parents if (parent / "lcn_env.py" ).is_file())
if str(_LCN_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_LCN_HELPER_DIR))
from lcn_env import lcn_env_path

try:
    import mysql.connector
except Exception:
    mysql = None


def load_env(env_path: str) -> Dict[str, str]:
    env = {}
    with open(env_path, 'r', encoding='utf-8') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def connect_db(env: Dict[str, str]):
    if mysql is None:
        raise RuntimeError('mysql-connector-python ist nicht installiert.')
    return mysql.connector.connect(
        host=env['LCN_DB_HOST'],
        port=int(env.get('LCN_DB_PORT', '3306')),
        user=env['LCN_DB_USERNAME'],
        password=env['LCN_DB_PASSWORD'],
        database=env['LCN_DB_DATABASE'],
        autocommit=False,
    )


def read_csv(path: str) -> List[Dict[str, str]]:
    if not os.path.exists(path):
        raise FileNotFoundError(f'CSV nicht gefunden: {path}')
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def write_csv(path: str, rows: List[Dict[str, object]], fieldnames: List[str]):
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def s(x) -> str:
    return '' if x is None else str(x).strip()


def norm_ci(x: str) -> str:
    return s(x).casefold()


def slugify(x: str) -> str:
    val = s(x).lower()
    repl = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', '+': 'plus'}
    for a, b in repl.items():
        val = val.replace(a, b)
    out = []
    prev_dash = False
    for ch in val:
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out.append('-')
                prev_dash = True
    slug = ''.join(out).strip('-')
    while '--' in slug:
        slug = slug.replace('--', '-')
    return slug


def build_treatment_maps(treat_rows: List[Dict[str, str]]):
    by_slug: Dict[str, Dict[str, str]] = {}
    by_name_ci: Dict[str, Dict[str, str]] = {}
    by_slugified_name: Dict[str, Dict[str, str]] = {}
    for r in treat_rows:
        slug = s(r.get('slug'))
        name = s(r.get('behandlung'))
        if slug:
            by_slug[slug] = r
        if name:
            by_name_ci[norm_ci(name)] = r
            by_slugified_name[slugify(name)] = r
    return by_slug, by_name_ci, by_slugified_name


def build_alias_maps(alias_rows: List[Dict[str, str]]):
    by_pair: Dict[Tuple[str, str], Dict[str, str]] = {}
    for r in alias_rows:
        key = (norm_ci(r.get('alias')), norm_ci(r.get('alias_type')))
        by_pair[key] = r
    return by_pair


def resolve_treat(row: Dict[str, str], by_slug, by_name_ci, by_slugified_name, alias_by_pair) -> Tuple[Optional[str], str]:
    slug = s(row.get('slug'))
    beh = s(row.get('behandlung'))
    alias = s(row.get('alias'))
    alias_type = s(row.get('alias_type'))

    if slug and slug in by_slug:
        return s(by_slug[slug].get('treat_id')), 'slug'
    if beh and norm_ci(beh) in by_name_ci:
        return s(by_name_ci[norm_ci(beh)].get('treat_id')), 'behandlung_ci'
    if beh:
        sg = slugify(beh)
        if sg in by_slug:
            return s(by_slug[sg].get('treat_id')), 'behandlung_slug_to_slug'
        if sg in by_slugified_name:
            return s(by_slugified_name[sg].get('treat_id')), 'behandlung_slugified_name'

    pair = (norm_ci(alias), norm_ci(alias_type))
    alias_row = alias_by_pair.get(pair)
    if alias_row:
        source_examples = s(alias_row.get('source_examples'))
        if source_examples and norm_ci(source_examples) in by_name_ci:
            return s(by_name_ci[norm_ci(source_examples)].get('treat_id')), 'alias_pair_to_source_examples'
        if source_examples:
            sg = slugify(source_examples)
            if sg in by_slug:
                return s(by_slug[sg].get('treat_id')), 'alias_pair_source_examples_to_slug'
            if sg in by_slugified_name:
                return s(by_slugified_name[sg].get('treat_id')), 'alias_pair_source_examples_slugified_name'

    return None, 'unresolved'


def resolve_alias_id(row: Dict[str, str], alias_by_pair) -> Tuple[Optional[str], str]:
    pair = (norm_ci(row.get('alias')), norm_ci(row.get('alias_type')))
    alias_row = alias_by_pair.get(pair)
    if alias_row:
        return s(alias_row.get('alias_id')), 'alias_pair'
    return None, 'unresolved'


def fetch_existing_pairs(conn, table_name: str) -> set:
    cur = conn.cursor()
    cur.execute(f'SELECT treat_id, alias_id FROM {table_name}')
    pairs = {(int(t), int(a)) for (t, a) in cur.fetchall()}
    cur.close()
    return pairs


def main():
    ap = argparse.ArgumentParser(description='LCN 003 – Upload Treatment↔Alias')
    ap.add_argument('--data-dir', required=True)
    ap.add_argument('--env-file', default=str(lcn_env_path()))
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--table-name', default='tbl_cpl_treatments2aliases_03')
    args = ap.parse_args()

    data_dir = args.data_dir
    link_path = os.path.join(data_dir, '003_tbl_cpl_treatments2aliases.csv')
    treat_path = os.path.join(data_dir, '003_new_treatments_03.with_ids.csv')
    alias_path = os.path.join(data_dir, '003_new_aliases_03.with_ids.csv')

    link_rows = read_csv(link_path)
    treat_rows = read_csv(treat_path)
    alias_rows = read_csv(alias_path)

    by_slug, by_name_ci, by_slugified_name = build_treatment_maps(treat_rows)
    alias_by_pair = build_alias_maps(alias_rows)

    preview = []
    unresolved = []
    duplicates = []
    pair_counter = Counter()

    for idx, row in enumerate(link_rows, start=1):
        treat_id, treat_match_method = resolve_treat(row, by_slug, by_name_ci, by_slugified_name, alias_by_pair)
        alias_id, alias_match_method = resolve_alias_id(row, alias_by_pair)

        out = dict(row)
        out['resolved_treat_id'] = '' if not treat_id else treat_id
        out['resolved_alias_id'] = '' if not alias_id else alias_id
        out['treat_id'] = '' if not treat_id else treat_id
        out['alias_id'] = '' if not alias_id else alias_id
        out['treat_match_method'] = treat_match_method
        out['alias_match_method'] = alias_match_method
        out['line_no'] = idx

        if not treat_id or not alias_id:
            out['action'] = 'unresolved'
            unresolved.append(out)
            preview.append(out)
            continue

        key = (int(treat_id), int(alias_id))
        pair_counter[key] += 1
        out['pair_key'] = f'{treat_id}|{alias_id}'
        out['action'] = 'candidate'
        preview.append(out)

    dup_keys = {k for k, c in pair_counter.items() if c > 1}
    if dup_keys:
        for r in preview:
            if r.get('action') == 'candidate':
                key = (int(r['resolved_treat_id']), int(r['resolved_alias_id']))
                if key in dup_keys:
                    r['action'] = 'duplicate_input'
                    duplicates.append(r)

    env = load_env(args.env_file)
    conn = connect_db(env)
    try:
        existing_pairs = fetch_existing_pairs(conn, args.table_name)
        insert_rows = []
        already_rows = []
        for r in preview:
            if r.get('action') != 'candidate':
                continue
            key = (int(r['resolved_treat_id']), int(r['resolved_alias_id']))
            if key in existing_pairs:
                r['action'] = 'skip_existing'
                already_rows.append(r)
            elif key in dup_keys:
                pass
            else:
                r['action'] = 'insert'
                insert_rows.append(r)

        preview_path = os.path.join(data_dir, '003_tbl_cpl_treatments2aliases.preview.csv')
        unresolved_path = os.path.join(data_dir, '003_tbl_cpl_treatments2aliases.unresolved.csv')
        duplicates_path = os.path.join(data_dir, '003_tbl_cpl_treatments2aliases.duplicates.csv')
        apply_log_path = os.path.join(data_dir, '003_tbl_cpl_treatments2aliases.apply_log.csv')

        fieldnames = list(dict.fromkeys(
            list(preview[0].keys()) if preview else [
                'line_no', 'behandlung', 'slug', 'alias', 'alias_type', 'treat_id', 'alias_id',
                'resolved_treat_id', 'resolved_alias_id', 'treat_match_method', 'alias_match_method', 'action'
            ]
        ))
        write_csv(preview_path, preview, fieldnames)
        write_csv(unresolved_path, unresolved, fieldnames)
        write_csv(duplicates_path, duplicates, fieldnames)

        apply_log = []
        if args.apply and insert_rows:
            cur = conn.cursor()
            sql = f'''INSERT INTO {args.table_name} (treat_id, alias_id, created_at, updated_at)
                      VALUES (%s, %s, NOW(), NOW())'''
            for r in insert_rows:
                cur.execute(sql, (int(r['resolved_treat_id']), int(r['resolved_alias_id'])))
                rr = dict(r)
                rr['db_action'] = 'inserted'
                apply_log.append(rr)
            conn.commit()
            cur.close()
        else:
            for r in insert_rows:
                rr = dict(r)
                rr['db_action'] = 'would_insert'
                apply_log.append(rr)
        write_csv(apply_log_path, apply_log, fieldnames + (['db_action'] if 'db_action' not in fieldnames else []))

        print('LCN 003 – Upload Treatment↔Alias')
        print('-' * 72)
        print(f'Input-Zeilen gesamt                : {len(link_rows)}')
        print(f'Aufgelöste Kandidaten             : {len([r for r in preview if r.get("action") in ("candidate", "insert", "skip_existing")])}')
        print(f'Unresolved                        : {len(unresolved)}')
        print(f'Interne Dubletten                 : {len(duplicates)}')
        print(f'Bereits in DB vorhanden           : {len(already_rows)}')
        print(f'Neue Inserts möglich              : {len(insert_rows)}')
        print(f'Preview                           : {preview_path}')
        print(f'Unresolved                        : {unresolved_path}')
        print(f'Duplicates                        : {duplicates_path}')
        print(f'Apply-Log                         : {apply_log_path}')
        if args.apply:
            print('Modus                             : APPLY')
        else:
            print('Modus                             : DRY-RUN')
    finally:
        conn.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'FEHLER: {e}')
        sys.exit(1)
