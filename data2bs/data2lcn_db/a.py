import csv
import re
from pathlib import Path
from urllib.parse import urljoin

BASE = "https://c19early.org/"

HTML_PATH = Path(__file__).with_name("treatments_debug.html")
CSV_PATH  = Path(r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\c19early_treatments.csv")

# Category headers include an arrow symbol (often shown as ⏵ in the site UI)
CAT_PAT = re.compile(r"([A-Za-z0-9][A-Za-z0-9 /&+\-.,]{1,80}?)\s*⏵")

# Matches: <a href="/ab">acebilustat</a> ... <a href="/acemeta.html">Meta</a>
PAIR_HTML = re.compile(
    r'<a[^>]+href="(/[^"]+)"[^>]*>([^<]+)</a>\s*<a[^>]+href="([^"]+)"[^>]*>\s*Meta\s*</a>',
    re.IGNORECASE
)

# Same pattern but inside JS strings with escaped quotes
PAIR_JS = re.compile(
    r'href=\\"(/[^\\"]+)\\"[^>]*>([^<]+)</a>\\s*<a[^>]+href=\\"([^\\"]+)\\"[^>]*>\\s*Meta\\s*</a>',
    re.IGNORECASE
)

def norm_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def unescape_common_js(s: str) -> str:
    """Light unescape for common JS-embedded HTML strings."""
    s = s.replace(r"\/", "/")
    s = s.replace(r"\"", '"')

    # If the arrow symbol is encoded in JS strings, we try a few common replacements:
    s = s.replace(r"\u23f5", "⏵")
    s = s.replace(r"\u25b6", "⏵")
    s = s.replace(r"\u27a4", "⏵")
    s = s.replace(r"\u203a", "⏵")
    return s

def build_category_map_from_file() -> dict:
    raw = HTML_PATH.read_text(encoding="utf-8", errors="replace")

    candidates = [raw, unescape_common_js(raw)]
    best_map = {}

    for text in candidates:
        cats = [(m.start(), m.group(1)) for m in CAT_PAT.finditer(text)]
        if not cats:
            continue

        cats.append((len(text), ""))

        tmp_map = {}
        for i in range(len(cats) - 1):
            start, cat = cats[i]
            end, _ = cats[i + 1]
            block = text[start:end]

            pairs = PAIR_HTML.findall(block)
            if not pairs:
                pairs = PAIR_JS.findall(block)

            for treat_href, treat_name, meta_href in pairs:
                treat_url = urljoin(BASE, treat_href)
                tmp_map[treat_url] = norm_spaces(cat)

        if len(tmp_map) > len(best_map):
            best_map = tmp_map

    return best_map

def fill_category_in_place():
    if not HTML_PATH.exists():
        raise RuntimeError(f"Missing {HTML_PATH}")

    backup = CSV_PATH.with_suffix(CSV_PATH.suffix + ".bak")
    if not backup.exists():
        backup.write_bytes(CSV_PATH.read_bytes())

    cat_map = build_category_map_from_file()
    print("Category map entries:", len(cat_map))

    with CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=",")
        rows = list(reader)
        fieldnames = reader.fieldnames or []

    if "treatment_url" not in fieldnames:
        raise RuntimeError("CSV has no 'treatment_url' column.")

    if "category" not in fieldnames:
        fieldnames.append("category")

    filled = 0
    for r in rows:
        turl = (r.get("treatment_url") or "").strip()
        if not turl:
            continue
        cat = cat_map.get(turl, "")
        if cat and (r.get("category") or "").strip() == "":
            r["category"] = cat
            filled += 1

    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames,
            delimiter=",",
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\r\n",
        )
        writer.writeheader()
        writer.writerows(rows)

    print("Done. category filled:", filled)
    print("Backup:", backup)

if __name__ == "__main__":
    fill_category_in_place()
