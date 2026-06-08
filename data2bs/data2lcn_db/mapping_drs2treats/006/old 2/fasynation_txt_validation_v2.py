#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fasynation TXT Validation (lean, konservativ)

Ziel:
- vorhandene TXT-Dateien gegen HTML/TXT-Metadaten plausibilisieren
- keine Rekonstruktion, keine Modellierung
- Ausgabe pro Batch: txt_validation.csv

Erwartete Struktur unter --base-dir:
  01_batches/
    blog/
      html/
      txt/
      blog_pages.csv
    intern_fasymail/
      html/
      txt/
      blog_pages.csv
    intern_episodentexte/
      html/
      txt/
      blog_pages.csv

Output pro Batch:
  txt_validation.csv
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Optional
from html import unescape

from bs4 import BeautifulSoup

BATCHES = ["blog", "intern_fasymail", "intern_episodentexte"]

# konservative Schwellen pro Batch
MIN_WORDS_BROKEN = {
    "blog": 120,
    "intern_fasymail": 80,
    "intern_episodentexte": 120,
}
MIN_WORDS_OK = {
    "blog": 250,
    "intern_fasymail": 150,
    "intern_episodentexte": 250,
}

BOILERPLATE_TERMS = [
    "cookie",
    "datenschutz",
    "kommentar absenden",
    "menü",
    "navigation",
    "newsletter",
    "impressum",
    "teilen",
    "share",
]


def normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def read_text_safe(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def extract_txt_content(full_txt: str) -> str:
    m = re.search(
        r"=== CONTENT START ===\s*(.*?)\s*=== CONTENT END ===",
        full_txt,
        flags=re.DOTALL,
    )
    if m:
        return normalize_whitespace(m.group(1))
    return ""


def extract_comments_block(full_txt: str) -> str:
    m = re.search(
        r"=== COMMENTS START ===\s*(.*?)\s*=== COMMENTS END ===",
        full_txt,
        flags=re.DOTALL,
    )
    if m:
        return normalize_whitespace(m.group(1))
    return ""


def count_words(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r"\b\w+\b", text, flags=re.UNICODE))


def count_headings_in_txt(content: str) -> int:
    if not content:
        return 0
    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    # heuristisch: kürzere Zeilen ohne Satzende, keine Listenelemente
    count = 0
    for ln in lines:
        if ln.startswith("- "):
            continue
        if len(ln) > 120:
            continue
        if ln.endswith(".") or ln.endswith(":"):
            continue
        # Zeilen mit vielen Wörtern eher Fließtext
        if count_words(ln) <= 12:
            count += 1
    return count


def count_bullets_in_txt(content: str) -> int:
    if not content:
        return 0
    return sum(1 for ln in content.splitlines() if ln.strip().startswith("- "))


def extract_html_metrics(html_text: str) -> tuple[Optional[str], Optional[str], int]:
    soup = BeautifulSoup(html_text, "html.parser")

    title_html = None
    if soup.title and soup.title.string:
        title_html = normalize_whitespace(unescape(soup.title.string))

    h1_text = None
    h1 = soup.find("h1")
    if h1:
        h1_text = normalize_whitespace(unescape(h1.get_text(" ", strip=True)))

    # grobe Roh-Textmenge nur als Plausibilitätsanker
    html_text_all = normalize_whitespace(unescape(soup.get_text(" ", strip=True)))
    html_word_count = count_words(html_text_all)

    return title_html, h1_text, html_word_count


def almost_same_as_title(content: str, title_html: str | None, h1_text: str | None) -> bool:
    content_norm = normalize_whitespace(content)
    title_norm = normalize_whitespace(title_html or "")
    h1_norm = normalize_whitespace(h1_text or "")

    if not content_norm:
        return False

    if content_norm == title_norm or content_norm == h1_norm:
        return True

    if title_norm and content_norm.startswith(title_norm) and count_words(content_norm) <= count_words(title_norm) + 5:
        return True

    if h1_norm and content_norm.startswith(h1_norm) and count_words(content_norm) <= count_words(h1_norm) + 5:
        return True

    return False


def contains_h1(content: str, h1_text: str | None) -> bool:
    if not content or not h1_text:
        return False
    return normalize_whitespace(h1_text).lower() in content.lower()

def norm_compare_text(text: str | None) -> str:
    text = normalize_whitespace(text or "").lower()
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def title_matches_h1(title_input: str | None, h1_text: str | None) -> bool:
    ti = norm_compare_text(title_input)
    h1 = norm_compare_text(h1_text)
    if not ti or not h1:
        return False
    return ti == h1


def classify_content_style(title_input: str, title_html: str | None, h1_text: str | None, content: str, html_text: str) -> str:
    blob = " ".join([
        title_input or "",
        title_html or "",
        h1_text or "",
        content[:1200] if content else "",
        html_text[:5000] if html_text else "",
    ]).lower()

    poetry_markers = [
        "poetry",
        "poetry-text",
        "poetry text",
        "ein poetry-text",
        "ein poetry text",
        "kreatives",
        "persönliches",
        "persoenliches",
        "tagebuch",
    ]
    if any(marker in blob for marker in poetry_markers):
        return "poetry_like"
    return "standard"



def detect_boilerplate(content: str) -> bool:
    if not content:
        return False
    low = content.lower()
    hits = sum(1 for t in BOILERPLATE_TERMS if t in low)
    return hits >= 3


def has_next_steps(content: str) -> bool:
    if not content:
        return False
    low = content.lower()
    return "deine nächsten schritte" in low or "deine naechsten schritte" in low


def decide_status(
    batch_name: str,
    txt_exists: bool,
    content: str,
    comments_block: str,
    title_input: str,
    title_html: str | None,
    h1_text: str | None,
    html_word_count: int,
    txt_word_count: int,
    heading_count: int,
    bullet_count: int,
    boilerplate_flag: bool,
    content_style: str,
    title_input_matches_h1_flag: bool,
) -> tuple[str, str]:
    notes = []

    if not txt_exists:
        return "broken", "txt missing"

    if not content:
        return "broken", "empty content block"

    if almost_same_as_title(content, title_html, h1_text):
        return "broken", "content is essentially only title"

    if txt_word_count < MIN_WORDS_BROKEN[batch_name]:
        return "broken", f"txt_word_count below broken threshold ({txt_word_count})"

    if html_word_count > 0:
        ratio = txt_word_count / html_word_count
        if ratio < 0.03:
            return "broken", f"txt/html word ratio implausibly low ({ratio:.3f})"
        if ratio < 0.08:
            notes.append(f"low txt/html ratio ({ratio:.3f})")

    if txt_word_count < MIN_WORDS_OK[batch_name]:
        notes.append(f"txt_word_count below ok threshold ({txt_word_count})")

    # Neuer H1-Check: TITLE_INPUT ↔ H1 statt H1 im CONTENT zu erwarten
    if h1_text and title_input and not title_input_matches_h1_flag:
        notes.append("title_input does not match h1_text")

    # Strukturwarnung nur für Standardtexte, nicht für Poetry-/Galerie-artige Texte
    if content_style != "poetry_like":
        if heading_count == 0:
            notes.append("no heading-like lines detected")
        if heading_count == 0 and bullet_count == 0:
            notes.append("little visible structure")

    if boilerplate_flag:
        notes.append("boilerplate terms detected")

    # Kommentare optional; kein Fehler wenn nicht vorhanden
    if comments_block and count_words(comments_block) < 5:
        notes.append("comments block extremely short")

    if notes:
        return "review", "; ".join(notes)

    return "ok", ""


def process_batch(base_dir: Path, batch_name: str) -> tuple[int, int, int]:
    batch_dir = base_dir / "01_batches" / batch_name
    csv_path = batch_dir / "blog_pages.csv"
    out_path = batch_dir / "txt_validation.csv"

    if not csv_path.exists():
        print(f"[{batch_name}] blog_pages.csv fehlt: {csv_path}")
        return 0, 0, 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    out_rows = []
    ok_count = 0
    review_count = 0
    broken_count = 0

    for row in rows:
        page_id = (row.get("page_id") or "").strip()
        url = (row.get("url") or "").strip()
        title_input = (row.get("title_input") or "").strip()
        html_relpath = (row.get("html_relpath") or "").strip()
        txt_relpath = (row.get("txt_relpath") or "").strip()
        txt_status = (row.get("txt_status") or "").strip()
        txt_error_flag = (row.get("txt_error_flag") or "").strip()
        txt_error_notes = (row.get("txt_error_notes") or "").strip()

        html_path = batch_dir / html_relpath if html_relpath else None
        txt_path = batch_dir / Path(txt_relpath.replace("\\", "/")) if txt_relpath else None

        html_exists = bool(html_path and html_path.exists())
        txt_exists = bool(txt_path and txt_path.exists())

        title_html = ""
        h1_text = ""
        html_word_count = 0
        html_text = ""

        if html_exists:
            html_text = read_text_safe(html_path)
            title_html, h1_text, html_word_count = extract_html_metrics(html_text)

        full_txt = read_text_safe(txt_path) if txt_exists else ""
        content = extract_txt_content(full_txt)
        comments_block = extract_comments_block(full_txt)

        txt_char_count = len(content)
        txt_word_count = count_words(content)
        comments_word_count = count_words(comments_block)
        heading_count = count_headings_in_txt(content)
        bullet_count = count_bullets_in_txt(content)
        contains_h1_flag = contains_h1(content, h1_text)
        title_similarity_flag = almost_same_as_title(content, title_html, h1_text)
        boilerplate_flag = detect_boilerplate(content)
        has_comments_block = bool(comments_block)
        has_next_steps_flag = has_next_steps(content)
        title_input_matches_h1_flag = title_matches_h1(title_input, h1_text)
        content_style = classify_content_style(title_input, title_html, h1_text, content, html_text)

        qa_status, qa_notes = decide_status(
            batch_name=batch_name,
            txt_exists=txt_exists,
            content=content,
            comments_block=comments_block,
            title_input=title_input,
            title_html=title_html,
            h1_text=h1_text,
            html_word_count=html_word_count,
            txt_word_count=txt_word_count,
            heading_count=heading_count,
            bullet_count=bullet_count,
            boilerplate_flag=boilerplate_flag,
            content_style=content_style,
            title_input_matches_h1_flag=title_input_matches_h1_flag,
        )

        if txt_status.lower() == "failed" or txt_error_flag == "1":
            qa_status = "broken"
            extra = f"txt_status={txt_status or 'n/a'}"
            if txt_error_notes:
                extra += f"; txt_error_notes={txt_error_notes}"
            qa_notes = (qa_notes + "; " + extra).strip("; ")

        if qa_status == "ok":
            ok_count += 1
        elif qa_status == "review":
            review_count += 1
        else:
            broken_count += 1

        out_rows.append({
            "page_id": page_id,
            "batch_name": batch_name,
            "url": url,
            "title_input": title_input,
            "title_html": title_html or "",
            "h1_text": h1_text or "",
            "html_relpath": html_relpath,
            "txt_relpath": txt_relpath,
            "html_exists": int(html_exists),
            "txt_exists": int(txt_exists),
            "txt_status": txt_status,
            "txt_error_flag": txt_error_flag,
            "txt_error_notes": txt_error_notes,
            "html_word_count": html_word_count,
            "txt_char_count": txt_char_count,
            "txt_word_count": txt_word_count,
            "comments_word_count": comments_word_count,
            "heading_count": heading_count,
            "bullet_count": bullet_count,
            "contains_h1": int(contains_h1_flag),
            "title_input_matches_h1": int(title_input_matches_h1_flag),
            "content_style": content_style,
            "title_similarity_flag": int(title_similarity_flag),
            "boilerplate_flag": int(boilerplate_flag),
            "has_comments_block": int(has_comments_block),
            "has_next_steps_flag": int(has_next_steps_flag),
            "qa_status": qa_status,
            "qa_notes": qa_notes,
        })

    fieldnames = [
        "page_id",
        "batch_name",
        "url",
        "title_input",
        "title_html",
        "h1_text",
        "html_relpath",
        "txt_relpath",
        "html_exists",
        "txt_exists",
        "txt_status",
        "txt_error_flag",
        "txt_error_notes",
        "html_word_count",
        "txt_char_count",
        "txt_word_count",
        "comments_word_count",
        "heading_count",
        "bullet_count",
        "contains_h1",
        "title_input_matches_h1",
        "content_style",
        "title_similarity_flag",
        "boilerplate_flag",
        "has_comments_block",
        "has_next_steps_flag",
        "qa_status",
        "qa_notes",
    ]

    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"[{batch_name}] ok={ok_count}, review={review_count}, broken={broken_count}")
    return ok_count, review_count, broken_count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", required=True, help="Basisordner der Quelle 006")
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        raise SystemExit(f"Base dir not found: {base_dir}")

    total_ok = total_review = total_broken = 0
    for batch in BATCHES:
        ok_count, review_count, broken_count = process_batch(base_dir, batch)
        total_ok += ok_count
        total_review += review_count
        total_broken += broken_count

    print(f"[gesamt] ok={total_ok}, review={total_review}, broken={total_broken}")


if __name__ == "__main__":
    main()
