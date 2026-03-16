import re
import csv
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://c19early.org/"
INDEX_URL = urljoin(BASE, "treatments.html")

HEADERS = {"User-Agent": "LCN-Scraper/1.1"}

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def fetch(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def parse_index(html: str):
    """
    Returns list of dicts:
      name, treatment_url, meta_url, category (category is best-effort)
    Strategy:
      1) Grab the 215-treatment list from the main content section.
      2) Derive treatment_url from anchors there.
      3) Derive meta_url by finding the corresponding nav entry where "Meta" follows the treatment link.
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- 1) Find the content section with the 215-treatment list
    # The page contains: "We currently review studies for 215 treatments:"
    marker = soup.find(string=re.compile(r"We currently review studies for 215 treatments", re.I))
    if not marker:
        raise RuntimeError("Could not find the 215-treatments marker text on the page.")

    # The list of links is right after the marker in the DOM
    container = marker.find_parent()
    if not container:
        raise RuntimeError("Could not locate container for the 215-treatments list.")

    # Collect treatment links from the main list:
    # In that section, the anchor text is the lowercase treatment name (e.g. acebilustat),
    # and href is like "/ab" or "/acemeta.html" etc. We only want the non-meta treatment page links.
    main_links = []
    # walk forward a bit in document and gather anchors
    for a in container.find_all_next("a", href=True, limit=600):
        txt = norm(a.get_text())
        href = a["href"].strip()

        # stop when we hit "show all" or "Potential benefits of ..."
        if txt.lower() in {"show all"}:
            break
        if "Potential benefits of" in txt:
            break

        # treatment list shows lowercase (often), but could include capitals/numbers too (AER002)
        # We include all items in that list that link to a short treatment page (usually "/xx")
        if href.startswith("/") and not href.lower().endswith("meta.html"):
            # avoid nav anchors like Home/Adoption etc by requiring the text not be "Home" etc.
            if txt and txt.lower() not in {"home", "adoption", "other treatments", "submit", "updates"}:
                main_links.append((txt, urljoin(BASE, href)))

    # Deduplicate while keeping order
    seen = set()
    treatments = []
    for name, url in main_links:
        k = name.lower()
        if k in seen:
            continue
        seen.add(k)
        treatments.append({"name": name, "treatment_url": url, "meta_url": "", "category": ""})

    # --- 2) Build a mapping from treatment_url -> meta_url from the NAV area.
    # In the NAV, each treatment link is followed by a "Meta" link.
    nav_meta_map = {}  # treatment_href_abs -> meta_href_abs

    # Find all "Meta" anchors and pair them with the immediately previous non-meta anchor.
    for meta_a in soup.find_all("a", href=True):
        if norm(meta_a.get_text()).lower() != "meta":
            continue
        meta_href = urljoin(BASE, meta_a["href"].strip())

        # previous <a> should be the treatment entry
        prev_a = meta_a.find_previous("a", href=True)
        if not prev_a:
            continue
        prev_txt = norm(prev_a.get_text())
        prev_href = prev_a["href"].strip()
        if not prev_href.startswith("/"):
            continue
        if prev_txt.lower() == "meta":
            continue

        treat_href_abs = urljoin(BASE, prev_href)
        nav_meta_map[treat_href_abs] = meta_href

    # Attach meta_url when we can
    for t in treatments:
        t["meta_url"] = nav_meta_map.get(t["treatment_url"], "")

    # --- 3) Best-effort category:
    # For each NAV treatment link, find the nearest previous text ending with "⏵" (category headers in the nav).
    # We'll map by treatment_url.
    nav_cat_map = {}
    arrow_pat = re.compile(r".*⏵\s*$")

    for a in soup.find_all("a", href=True):
        href_abs = urljoin(BASE, a["href"].strip())
        if href_abs not in nav_meta_map:  # only consider nav treatment anchors that have a meta
            continue

        # find previous string that looks like a category header (ends with the arrow)
        cat = ""
        prev_txt_node = a.find_previous(string=arrow_pat)
        if prev_txt_node:
            cat = norm(str(prev_txt_node)).replace("⏵", "").strip()
        nav_cat_map[href_abs] = cat

    for t in treatments:
        t["category"] = nav_cat_map.get(t["treatment_url"], "")

    # Sanity: should be around 215
    return treatments

def parse_treatment_page(html: str):
    """
    Extract:
      studies_count, patients_count, top_line_conclusion (best-effort)
    """
    soup = BeautifulSoup(html, "html.parser")
    text = norm(soup.get_text(" "))

    studies = ""
    patients = ""
    concl = ""

    m = re.search(r"(\d+)\s+stud(?:y|ies)\s+with\s+([\d,]+)\s+patients", text, re.I)
    if m:
        studies = m.group(1)
        patients = m.group(2).replace(",", "")

    # Best-effort: grab a short conclusion-ish sentence
    concl_patterns = [
        r"No significant improvements[^.]*\.",
        r"Significant improvements[^.]*\.",
        r"Significantly (lower|reduced|higher|increased)[^.]*\.",
        r"Increased (risk|mortality)[^.]*\.",
        r"Reduced (risk|mortality)[^.]*\.",
        r"Currently there is very limited data[^.]*\.",
    ]
    for pat in concl_patterns:
        mm = re.search(pat, text)
        if mm:
            concl = mm.group(0)
            break

    return studies, patients, concl

def main():
    index_html = fetch(INDEX_URL)
    items = parse_index(index_html)
    print(f"Found {len(items)} treatments from index parsing.")

    if not items:
        raise RuntimeError("0 treatments found. The page structure may have changed or parsing failed.")

    out_rows = []
    for i, it in enumerate(items, start=1):
        # be polite
        time.sleep(0.15)

        try:
            t_html = fetch(it["treatment_url"])
            studies, patients, concl = parse_treatment_page(t_html)
        except Exception as e:
            studies = patients = concl = ""
            print(f"[WARN] failed to fetch/parse treatment page {it['treatment_url']}: {e}")

        row = {
            "name": it["name"],
            "category": it.get("category", ""),
            "treatment_url": it["treatment_url"],
            "meta_url": it.get("meta_url", ""),
            "studies_count": studies,
            "patients_count": patients,
            "top_line_conclusion": concl,
        }
        out_rows.append(row)

    # final dedupe
    seen = set()
    final_rows = []
    for r in out_rows:
        k = r["name"].strip().lower()
        if k in seen:
            continue
        seen.add(k)
        final_rows.append(r)

    with open("c19early_treatments.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(final_rows[0].keys()))
        w.writeheader()
        w.writerows(final_rows)

    print("Wrote c19early_treatments.csv")
    print(f"Rows: {len(final_rows)}")

if __name__ == "__main__":
    main()
