#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Fasynation HTML -> TXT (v5, quellspezifisch)

Neu in v5:
- nutzt den echten Fasynation-Inhaltscontainer
- nimmt den Abschnitt "Deine nächsten Schritte" mit auf
- sammelt Kommentare separat ein und kennzeichnet sie
- schreibt pro HTML eine TXT-Datei
- aktualisiert blog_pages.csv

Erwartete Struktur unter --base-dir:
  01_batches/
    blog/
      html/
      txt/              (wird angelegt)
      blog_pages.csv
      txt_log.csv       (wird geschrieben)
      txt_error_log.csv (wird geschrieben)
    intern_fasymail/
      ...
    intern_episodentexte/
      ...
"""

from __future__ import annotations

import argparse
import csv
import re
from datetime import datetime
from html import unescape
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup

BATCHES = ["blog", "intern_fasymail", "intern_episodentexte"]

BATCH_TO_SOURCE_BATCH_ID = {
    "blog": "006_fasynation_blog_pages_v1",
    "intern_fasymail": "006_fasynation_intern_fasymail_pages_v1",
    "intern_episodentexte": "006_fasynation_intern_episodentexte_pages_v1",
}


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def safe_get_text(node) -> str:
    return normalize_whitespace(unescape(node.get_text(" ", strip=True)))


def extract_title_html(soup: BeautifulSoup) -> Optional[str]:
    if soup.title and soup.title.string:
        return normalize_whitespace(unescape(soup.title.string))
    return None


def extract_h1_text(soup: BeautifulSoup) -> Optional[str]:
    h1 = soup.find("h1")
    if h1:
        return safe_get_text(h1)
    return None


def find_content_node(soup: BeautifulSoup):
    selectors = [
        ".entry-content.single-content",
        ".entry-content",
        "article .entry-content",
        "article",
        "main.site-main",
        "main",
        "body",
    ]
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            return node
    return soup


def cleanup_content_node(node) -> None:
    selectors_to_remove = [
        "script",
        "style",
        "noscript",
        "svg",
        "canvas",
        "iframe",
        "form",
        "button",
        "input",
        "select",
        "option",
        "textarea",
        ".kt_simple_share_container",
        ".sharedaddy",
        ".jp-relatedposts",
        ".post-navigation",
        ".navigation",
        ".widget-area",
        ".sidebar",
        "aside",
        "footer.entry-footer",
        ".comment-respond",
    ]
    for selector in selectors_to_remove:
        for tag in list(node.select(selector)):
            tag.decompose()


def collect_lines(node) -> list[str]:
    lines: list[str] = []

    elements = node.find_all([
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "li", "blockquote", "pre"
    ])

    for el in elements:
        text = safe_get_text(el)
        if not text:
            continue

        name = el.name.lower()

        if name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            lines.append(text)
            lines.append("")
        elif name == "li":
            lines.append(f"- {text}")
        else:
            lines.append(text)
            lines.append("")

    return lines


def finalize_lines(lines: list[str]) -> str:
    out: list[str] = []
    last_nonempty = False

    for line in lines:
        line = normalize_whitespace(line)
        if not line:
            if last_nonempty:
                out.append("")
            last_nonempty = False
            continue
        out.append(line)
        last_nonempty = True

    content = "\n".join(out).strip()
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content


def extract_comments(soup: BeautifulSoup) -> str:
    comments_root = soup.select_one("#comments")
    if not comments_root:
        return ""

    comment_items = comments_root.select("ol.comment-list > li.comment")
    if not comment_items:
        return ""

    blocks = ["=== COMMENTS START ===", ""]

    for idx, item in enumerate(comment_items, start=1):
        author = ""
        author_node = item.select_one(".comment-author .fn")
        if author_node:
            author = safe_get_text(author_node)

        date_text = ""
        date_node = item.select_one(".comment-metadata time")
        if date_node:
            date_text = safe_get_text(date_node)

        body_node = item.select_one(".comment-content")
        body_text = safe_get_text(body_node) if body_node else ""

        if not body_text:
            body_fallback = item.select_one(".comment-body")
            body_text = safe_get_text(body_fallback) if body_fallback else ""

        blocks.append(f"[COMMENT {idx}]")
        if author:
            blocks.append(f"AUTHOR: {author}")
        if date_text:
            blocks.append(f"DATE: {date_text}")
        if body_text:
            blocks.append("TEXT:")
            blocks.append(body_text)
        blocks.append("")

    blocks.append("=== COMMENTS END ===")
    return "\n".join(blocks).strip()


def extract_text_from_html(html_text: str) -> tuple[str, Optional[str], Optional[str], str]:
    soup = BeautifulSoup(html_text, "html.parser")

    title_html = extract_title_html(soup)
    h1_text = extract_h1_text(soup)

    comments_text = extract_comments(soup)

    content_node = find_content_node(soup)
    cleanup_content_node(content_node)

    lines = collect_lines(content_node)
    content = finalize_lines(lines)

    if len(content) < 400:
        content = normalize_whitespace(unescape(content_node.get_text("\n", strip=True)))

    return content, title_html, h1_text, comments_text


def ensure_columns(rows: list[dict], fieldnames: list[str]) -> list[str]:
    needed = ["txt_relpath", "txt_status", "txt_error_flag", "txt_error_notes", "title_html", "h1_text"]
    out = list(fieldnames)
    for col in needed:
        if col not in out:
            out.append(col)
    for row in rows:
        for col in needed:
            row.setdefault(col, "")
    return out


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def process_batch(base_dir: Path, batch_name: str, overwrite: bool = False) -> tuple[int, int]:
    batch_dir = base_dir / "01_batches" / batch_name
    txt_dir = batch_dir / "txt"
    csv_path = batch_dir / "blog_pages.csv"
    txt_log_path = batch_dir / "txt_log.csv"
    txt_error_log_path = batch_dir / "txt_error_log.csv"

    txt_dir.mkdir(parents=True, exist_ok=True)

    if not csv_path.exists():
        print(f"[{batch_name}] blog_pages.csv fehlt: {csv_path}")
        return 0, 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames or []

    fieldnames = ensure_columns(rows, fieldnames)

    txt_logs = []
    txt_error_logs = []

    processed = 0
    failed = 0

    for row in rows:
        page_id = (row.get("page_id") or "").strip()
        html_relpath = (row.get("html_relpath") or "").strip()
        url = (row.get("url") or "").strip()

        if not page_id or not html_relpath:
            row["txt_status"] = "failed"
            row["txt_error_flag"] = "1"
            row["txt_error_notes"] = "missing page_id or html_relpath"
            failed += 1
            txt_error_logs.append({
                "timestamp": now_iso(),
                "batch_name": batch_name,
                "page_id": page_id,
                "url": url,
                "error_type": "missing_input",
                "error_message": "missing page_id or html_relpath",
            })
            continue

        html_path = batch_dir / html_relpath
        txt_relpath = f"txt\\{page_id}.txt"
        txt_path = batch_dir / "txt" / f"{page_id}.txt"

        row["txt_relpath"] = txt_relpath

        if txt_path.exists() and not overwrite:
            row["txt_status"] = "ok"
            row["txt_error_flag"] = "0"
            row["txt_error_notes"] = ""
            processed += 1
            txt_logs.append({
                "timestamp": now_iso(),
                "batch_name": batch_name,
                "page_id": page_id,
                "url": url,
                "txt_status": "ok",
                "notes": "existing txt kept",
            })
            continue

        try:
            if not html_path.exists():
                raise FileNotFoundError(f"HTML file not found: {html_path}")

            html_text = html_path.read_text(encoding="utf-8", errors="ignore")
            content, title_html, h1_text, comments_text = extract_text_from_html(html_text)

            txt_body = (
                f"SOURCE_NAME: Fasynation\n"
                f"BATCH_NAME: {batch_name}\n"
                f"SOURCE_BATCH_ID: {BATCH_TO_SOURCE_BATCH_ID[batch_name]}\n"
                f"PAGE_ID: {page_id}\n"
                f"TITLE_INPUT: {(row.get('title_input') or '').strip()}\n"
                f"URL: {url}\n\n"
                f"=== CONTENT START ===\n"
                f"{content}\n"
                f"=== CONTENT END ===\n"
            )

            if comments_text:
                txt_body += "\n\n" + comments_text + "\n"

            txt_path.write_text(txt_body, encoding="utf-8")

            row["txt_status"] = "ok"
            row["txt_error_flag"] = "0"
            row["txt_error_notes"] = ""
            row["title_html"] = title_html or ""
            row["h1_text"] = h1_text or ""

            processed += 1
            txt_logs.append({
                "timestamp": now_iso(),
                "batch_name": batch_name,
                "page_id": page_id,
                "url": url,
                "txt_status": "ok",
                "notes": "",
            })

        except Exception as e:
            row["txt_status"] = "failed"
            row["txt_error_flag"] = "1"
            row["txt_error_notes"] = str(e)
            failed += 1
            txt_error_logs.append({
                "timestamp": now_iso(),
                "batch_name": batch_name,
                "page_id": page_id,
                "url": url,
                "error_type": type(e).__name__,
                "error_message": str(e),
            })

    write_csv(csv_path, rows, fieldnames)

    with txt_log_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "batch_name", "page_id", "url", "txt_status", "notes"])
        writer.writeheader()
        writer.writerows(txt_logs)

    with txt_error_log_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "batch_name", "page_id", "url", "error_type", "error_message"])
        writer.writeheader()
        writer.writerows(txt_error_logs)

    print(f"[{batch_name}] fertig: verarbeitet={processed}, fehlgeschlagen={failed}")
    return processed, failed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", required=True, help="Basisordner der Quelle 006")
    parser.add_argument("--overwrite", action="store_true", help="Vorhandene TXT-Dateien überschreiben")
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        raise SystemExit(f"Base dir not found: {base_dir}")

    for batch in BATCHES:
        process_batch(base_dir, batch, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
