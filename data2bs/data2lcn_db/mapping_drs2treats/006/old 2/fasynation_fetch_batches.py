from __future__ import annotations

import argparse
import csv
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.parse import urlparse

import requests

SOURCE_NAME = "Fasynation"
RUN_VERSION = "v1"
TIMEOUT_SECONDS = 30
SLEEP_BETWEEN_REQUESTS = 0.3
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

BATCH_CONFIG = {
    "blog": {
        "prefix": "blog",
        "source_batch_id": "006_fasynation_blog_pages_v1",
    },
    "intern_fasymail": {
        "prefix": "ifm",
        "source_batch_id": "006_fasynation_intern_fasymail_pages_v1",
    },
    "intern_episodentexte": {
        "prefix": "iep",
        "source_batch_id": "006_fasynation_intern_episodentexte_pages_v1",
    },
}

BATCH_PAGE_FIELDS = [
    "source_name",
    "batch_name",
    "source_batch_id",
    "page_id",
    "input_order",
    "input_nr",
    "category",
    "title_input",
    "url",
    "html_relpath",
    "fetch_status",
    "http_status",
    "error_flag",
    "error_notes",
]

FETCH_LOG_FIELDS = [
    "timestamp",
    "batch_name",
    "page_id",
    "url",
    "fetch_status",
    "http_status",
    "notes",
]

ERROR_LOG_FIELDS = [
    "timestamp",
    "batch_name",
    "page_id",
    "url",
    "error_type",
    "error_message",
]


@dataclass
class PageRecord:
    source_name: str
    batch_name: str
    source_batch_id: str
    page_id: str
    input_order: int
    input_nr: str
    category: str
    title_input: str
    url: str
    html_relpath: str
    fetch_status: str = "pending"
    http_status: str = ""
    error_flag: str = "0"
    error_notes: str = ""

    def to_csv_row(self) -> Dict[str, str]:
        return {
            "source_name": self.source_name,
            "batch_name": self.batch_name,
            "source_batch_id": self.source_batch_id,
            "page_id": self.page_id,
            "input_order": str(self.input_order),
            "input_nr": self.input_nr,
            "category": self.category,
            "title_input": self.title_input,
            "url": self.url,
            "html_relpath": self.html_relpath,
            "fetch_status": self.fetch_status,
            "http_status": self.http_status,
            "error_flag": self.error_flag,
            "error_notes": self.error_notes,
        }


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_csv_rows(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def normalize_category(value: str) -> str:
    return (value or "").strip()


def build_blog_records(input_path: Path) -> List[PageRecord]:
    rows = read_csv_rows(input_path)
    batch_name = "blog"
    cfg = BATCH_CONFIG[batch_name]
    records: List[PageRecord] = []
    for idx, row in enumerate(rows, start=1):
        page_id = f"{cfg['prefix']}_{idx:04d}"
        records.append(
            PageRecord(
                source_name=SOURCE_NAME,
                batch_name=batch_name,
                source_batch_id=cfg["source_batch_id"],
                page_id=page_id,
                input_order=idx,
                input_nr="",
                category="Blog",
                title_input=(row.get("title") or "").strip(),
                url=(row.get("url") or "").strip(),
                html_relpath=rf"html\{page_id}.html",
            )
        )
    return records


def build_internal_records(input_path: Path) -> Dict[str, List[PageRecord]]:
    rows = read_csv_rows(input_path)
    buckets = {
        "intern_fasymail": [],
        "intern_episodentexte": [],
    }
    counters = {
        "intern_fasymail": 0,
        "intern_episodentexte": 0,
    }

    for row in rows:
        category = normalize_category(row.get("category", ""))
        if category == "Fasy.Mail":
            batch_name = "intern_fasymail"
        elif category == "Episoden-Texte":
            batch_name = "intern_episodentexte"
        else:
            # Andere Kategorien werden bewusst übersprungen.
            continue

        counters[batch_name] += 1
        cfg = BATCH_CONFIG[batch_name]
        page_id = f"{cfg['prefix']}_{counters[batch_name]:04d}"
        buckets[batch_name].append(
            PageRecord(
                source_name=SOURCE_NAME,
                batch_name=batch_name,
                source_batch_id=cfg["source_batch_id"],
                page_id=page_id,
                input_order=counters[batch_name],
                input_nr=(str(row.get("nr", "")) or "").strip(),
                category=category,
                title_input=(row.get("title") or "").strip(),
                url=(row.get("url") or "").strip(),
                html_relpath=rf"html\{page_id}.html",
            )
        )
    return buckets


def write_csv(path: Path, fieldnames: List[str], rows: Iterable[Dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def fetch_html(session: requests.Session, url: str) -> Tuple[str, str, str]:
    response = session.get(url, timeout=TIMEOUT_SECONDS, allow_redirects=True)
    http_status = str(response.status_code)
    response.raise_for_status()
    response.encoding = response.encoding or response.apparent_encoding or "utf-8"
    return response.text, http_status, ""


def process_batch(base_dir: Path, records: List[PageRecord], overwrite: bool) -> None:
    if not records:
        return

    batch_name = records[0].batch_name
    batch_dir = base_dir / "01_batches" / batch_name
    html_dir = batch_dir / "html"
    ensure_dir(html_dir)

    batch_pages_path = batch_dir / "blog_pages.csv"
    fetch_log_path = batch_dir / "fetch_log.csv"
    error_log_path = batch_dir / "error_log.csv"

    fetch_log_rows: List[Dict[str, str]] = []
    error_log_rows: List[Dict[str, str]] = []

    session = build_session()

    for record in records:
        html_path = batch_dir / Path(record.html_relpath.replace("\\", "/"))
        ensure_dir(html_path.parent)
        timestamp = utc_now_iso()

        if html_path.exists() and not overwrite:
            record.fetch_status = "ok"
            record.http_status = ""
            record.error_flag = "0"
            record.error_notes = "existing_file_kept"
            fetch_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "fetch_status": "ok",
                    "http_status": "",
                    "notes": "existing_file_kept",
                }
            )
            continue

        try:
            html, http_status, _ = fetch_html(session, record.url)
            html_path.write_text(html, encoding="utf-8")
            record.fetch_status = "ok"
            record.http_status = http_status
            record.error_flag = "0"
            record.error_notes = ""
            fetch_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "fetch_status": "ok",
                    "http_status": http_status,
                    "notes": "",
                }
            )
        except requests.HTTPError as e:
            status = ""
            if e.response is not None:
                status = str(e.response.status_code)
            record.fetch_status = "failed"
            record.http_status = status
            record.error_flag = "1"
            record.error_notes = f"HTTPError: {e}"
            fetch_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "fetch_status": "failed",
                    "http_status": status,
                    "notes": f"HTTPError: {e}",
                }
            )
            error_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "error_type": "HTTPError",
                    "error_message": str(e),
                }
            )
        except requests.RequestException as e:
            record.fetch_status = "failed"
            record.http_status = ""
            record.error_flag = "1"
            record.error_notes = f"RequestException: {e}"
            fetch_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "fetch_status": "failed",
                    "http_status": "",
                    "notes": f"RequestException: {e}",
                }
            )
            error_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "error_type": "RequestException",
                    "error_message": str(e),
                }
            )
        except Exception as e:
            record.fetch_status = "failed"
            record.http_status = ""
            record.error_flag = "1"
            record.error_notes = f"UnexpectedError: {e}"
            fetch_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "fetch_status": "failed",
                    "http_status": "",
                    "notes": f"UnexpectedError: {e}",
                }
            )
            error_log_rows.append(
                {
                    "timestamp": timestamp,
                    "batch_name": record.batch_name,
                    "page_id": record.page_id,
                    "url": record.url,
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                }
            )

        time.sleep(SLEEP_BETWEEN_REQUESTS)

    write_csv(batch_pages_path, BATCH_PAGE_FIELDS, [r.to_csv_row() for r in records])
    write_csv(fetch_log_path, FETCH_LOG_FIELDS, fetch_log_rows)
    write_csv(error_log_path, ERROR_LOG_FIELDS, error_log_rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Lädt Fasynation-Seiten batchweise als HTML und schreibt pro Batch eine Übersichts-CSV plus Logs."
    )
    parser.add_argument(
        "--base-dir",
        required=True,
        help=r"Basisordner, z. B. C:\xampp\htdocs\lcn\data2bs\data2lcn_db\mapping_drs2treats\006",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Vorhandene HTML-Dateien überschreiben.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    base_dir = Path(args.base_dir)
    input_dir = base_dir / "00_input"

    blog_input = input_dir / "URL_Blogs.csv"
    intern_input = input_dir / "URL_Intern.csv"

    if not blog_input.exists():
        print(f"Fehlt: {blog_input}", file=sys.stderr)
        return 1
    if not intern_input.exists():
        print(f"Fehlt: {intern_input}", file=sys.stderr)
        return 1

    ensure_dir(base_dir / "01_batches")

    blog_records = build_blog_records(blog_input)
    internal_batches = build_internal_records(intern_input)

    process_batch(base_dir, blog_records, overwrite=args.overwrite)
    process_batch(base_dir, internal_batches["intern_fasymail"], overwrite=args.overwrite)
    process_batch(base_dir, internal_batches["intern_episodentexte"], overwrite=args.overwrite)

    print("Fertig.")
    print(f"Blog: {len(blog_records)} URLs")
    print(f"intern_fasymail: {len(internal_batches['intern_fasymail'])} URLs")
    print(f"intern_episodentexte: {len(internal_batches['intern_episodentexte'])} URLs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
