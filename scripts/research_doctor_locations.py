#!/usr/bin/env python3
"""Research address candidates from provider websites and enrich a CSV in place.

No database access and no geocoding. The input is replaced atomically only after
all rows were processed; an unchanged ``.bak`` copy is retained.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import socket
import ssl
import sys
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.robotparser import RobotFileParser


USER_AGENT = "LongCovidNavigator-AddressResearch/1.0 (manual-review dataset)"
LINK_WORDS = ("kontakt", "contact", "impressum", "anfahrt", "standort", "praxis", "ueber-uns", "über-uns", "team")
PORTALS = {"jameda.de", "aerzte.de", "arzt-auskunft.de", "doctolib.de"}
OUTPUT_FIELDS = [
    "normalized_website", "website_status", "http_status", "final_url",
    "redirect_count", "source_page_url", "found_country", "found_plz",
    "found_city", "found_street", "found_housenumber", "address_full",
    "plz_match", "country_match", "name_match", "multiple_locations",
    "result_status", "confidence", "validation_required", "evidence_note",
    "error_message", "checked_at",
]


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.jsonld: list[str] = []
        self._href = ""
        self._link_text: list[str] = []
        self._in_script = False
        self._script_parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag in {"style", "noscript", "svg"}:
            self._skip += 1
        if tag == "script":
            if (values.get("type") or "").lower() == "application/ld+json":
                self._in_script = True
                self._script_parts = []
            else:
                self._skip += 1
        if tag == "a":
            self._href = values.get("href") or ""
            self._link_text = []
        if tag in {"br", "p", "div", "li", "address", "tr", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._in_script:
            self.jsonld.append("".join(self._script_parts))
            self._in_script = False
        elif tag in {"style", "noscript", "svg", "script"} and self._skip:
            self._skip -= 1
        if tag == "a" and self._href:
            self.links.append((self._href, " ".join(self._link_text)))
            self._href = ""
        if tag in {"p", "div", "li", "address", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_script:
            self._script_parts.append(data)
        elif not self._skip:
            self.parts.append(data)
            if self._href:
                self._link_text.append(data)

    @property
    def text(self) -> str:
        lines = (re.sub(r"\s+", " ", line).strip() for line in "".join(self.parts).splitlines())
        return "\n".join(line for line in lines if line)


@dataclass(frozen=True)
class Address:
    country: str = ""
    plz: str = ""
    city: str = ""
    street: str = ""
    housenumber: str = ""
    full: str = ""
    source: str = ""
    evidence: str = ""


@dataclass
class FetchResult:
    requested_url: str
    final_url: str = ""
    status: int | None = None
    redirects: int = 0
    body: str = ""
    error: str = ""
    error_kind: str = ""


class RedirectCounter(HTTPRedirectHandler):
    def __init__(self) -> None:
        super().__init__()
        self.count = 0

    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> Any:
        self.count += 1
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def website_variants(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw:
        return []
    parsed = urlparse(raw if "://" in raw else "https://" + raw)
    host = (parsed.hostname or "").lower()
    path = parsed.path or "/"
    hosts = [host]
    hosts.append(host[4:] if host.startswith("www.") else "www." + host)
    variants: list[str] = []
    for scheme in ("https", "http"):
        for candidate_host in hosts:
            url = urlunparse((scheme, candidate_host, path, "", parsed.query, ""))
            if url not in variants:
                variants.append(url)
    return variants


def fetch(url: str, timeout: float) -> FetchResult:
    counter = RedirectCounter()
    opener = build_opener(counter)
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    result = FetchResult(requested_url=url)
    try:
        with opener.open(request, timeout=timeout) as response:
            result.status = response.status
            result.final_url = response.geturl()
            result.redirects = counter.count
            content_type = response.headers.get_content_type()
            if content_type not in {"text/html", "application/xhtml+xml"}:
                result.error = f"unsupported content type: {content_type}"
                result.error_kind = "content_type"
                return result
            raw = response.read(2_000_000)
            charset = response.headers.get_content_charset() or "utf-8"
            result.body = raw.decode(charset, errors="replace")
    except HTTPError as exc:
        result.status = exc.code
        result.final_url = exc.geturl()
        result.error = f"HTTP {exc.code}: {exc.reason}"
        result.error_kind = "http"
    except ssl.SSLError as exc:
        result.error, result.error_kind = str(exc), "ssl"
    except socket.timeout as exc:
        result.error, result.error_kind = str(exc) or "timeout", "timeout"
    except URLError as exc:
        reason = exc.reason
        if isinstance(reason, socket.gaierror):
            result.error_kind = "dns"
        elif isinstance(reason, ssl.SSLError):
            result.error_kind = "ssl"
        elif isinstance(reason, (TimeoutError, socket.timeout)):
            result.error_kind = "timeout"
        else:
            result.error_kind = "connection"
        result.error = str(reason)
    except Exception as exc:  # keep one bad site from ending the batch
        result.error, result.error_kind = str(exc), "connection"
    return result


def allowed_by_robots(url: str, timeout: float, cache: dict[str, RobotFileParser]) -> bool:
    parsed = urlparse(url)
    root = f"{parsed.scheme}://{parsed.netloc}"
    if root not in cache:
        rp = RobotFileParser(root + "/robots.txt")
        try:
            req = Request(rp.url, headers={"User-Agent": USER_AGENT})
            with build_opener().open(req, timeout=timeout) as response:
                rp.parse(response.read(512_000).decode("utf-8", errors="replace").splitlines())
        except Exception:
            # An absent/unreachable robots file is not interpreted as a prohibition.
            rp.parse([])
        cache[root] = rp
    return cache[root].can_fetch(USER_AGENT, url)


def json_addresses(value: Any, source: str) -> Iterable[Address]:
    if isinstance(value, list):
        for item in value:
            yield from json_addresses(item, source)
    elif isinstance(value, dict):
        address = value.get("address")
        if isinstance(address, dict):
            street_full = str(address.get("streetAddress") or "").strip()
            street, number = split_street(street_full)
            country_value = address.get("addressCountry") or ""
            if isinstance(country_value, dict):
                country_value = country_value.get("name") or country_value.get("@id") or ""
            plz = str(address.get("postalCode") or "").strip()
            city = str(address.get("addressLocality") or "").strip()
            if plz and (city or street_full):
                full = ", ".join(v for v in (street_full, f"{plz} {city}".strip(), str(country_value)) if v)
                yield Address(country=normalize_country(str(country_value)), plz=plz, city=city,
                              street=street, housenumber=number, full=full, source=source,
                              evidence="JSON-LD address")
        for item in value.values():
            yield from json_addresses(item, source)


def normalize_country(value: str) -> str:
    upper = value.strip().upper()
    mapping = {"DEUTSCHLAND": "DE", "GERMANY": "DE", "ÖSTERREICH": "AT", "AUSTRIA": "AT",
               "SCHWEIZ": "CH", "SWITZERLAND": "CH"}
    return mapping.get(upper, upper if upper in {"DE", "AT", "CH"} else "")


def split_street(value: str) -> tuple[str, str]:
    value = re.sub(r"\s+", " ", value).strip(" ,")
    match = re.match(r"^(.*?\D)\s+(\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?)$", value)
    return (match.group(1).strip(), match.group(2).replace(" ", "")) if match else (value, "")


def text_addresses(text: str, existing_plz: str, country: str, source: str) -> Iterable[Address]:
    plz_pattern = r"\d{5}" if country == "DE" else r"\d{4}"
    lines = text.splitlines()
    for index, line in enumerate(lines):
        for match in re.finditer(rf"\b({plz_pattern})\s+([A-ZÄÖÜ][\wÄÖÜäöüß.'’()/-]*(?:\s+[\wÄÖÜäöüß.'’()/-]+){{0,4}})", line):
            plz, city = match.group(1), match.group(2).strip(" ,;|")
            if existing_plz and plz != existing_plz:
                continue
            before = line[:match.start()].strip(" ,;|-")
            previous = lines[index - 1].strip() if index else ""
            street_line = before or previous
            street, number = split_street(street_line)
            if not number:
                street, number = "", ""
            full = ", ".join(v for v in (street_line if number else "", f"{plz} {city}") if v)
            yield Address(country=country, plz=plz, city=city, street=street,
                          housenumber=number, full=full, source=source,
                          evidence="visible page text near matching postal code")


def parse_page(body: str, url: str, existing_plz: str, country: str) -> tuple[list[Address], list[str], str]:
    parser = PageParser()
    parser.feed(body)
    candidates: list[Address] = []
    for block in parser.jsonld:
        try:
            candidates.extend(json_addresses(json.loads(block), url))
        except (json.JSONDecodeError, TypeError):
            continue
    candidates.extend(text_addresses(parser.text, existing_plz, country, url))
    links: list[str] = []
    base_host = urlparse(url).hostname
    for href, label in parser.links:
        absolute = urljoin(url, href).split("#", 1)[0]
        haystack = (absolute + " " + label).lower()
        if urlparse(absolute).hostname == base_host and any(word in haystack for word in LINK_WORDS):
            if absolute not in links:
                links.append(absolute)
    return candidates, links[:6], parser.text


def name_matches(row: dict[str, str], texts: Iterable[str]) -> bool:
    name = " ".join((row.get("dr_display_name", ""), row.get("dr_org_name", ""))).lower()
    tokens = [t for t in re.findall(r"[a-zäöüß]{4,}", name) if t not in {"praxis", "doktor"}]
    combined = " ".join(texts).lower()
    return bool(tokens) and any(token in combined for token in tokens)


def deduplicate(candidates: Iterable[Address]) -> list[Address]:
    output: list[Address] = []
    seen: set[tuple[str, ...]] = set()
    for item in candidates:
        key = tuple(re.sub(r"\W", "", value.lower()) for value in (item.plz, item.city, item.street, item.housenumber))
        if key not in seen and item.plz:
            seen.add(key)
            output.append(item)
    return output


def research_row(row: dict[str, str], timeout: float, delay: float, max_pages: int,
                 robots_cache: dict[str, RobotFileParser]) -> dict[str, str]:
    result = {field: "" for field in OUTPUT_FIELDS}
    result["checked_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    country, existing_plz = row.get("loc_country", "").strip(), row.get("loc_plz", "").strip()
    variants = website_variants(row.get("website", ""))
    if not variants:
        result.update(website_status="missing", result_status="not_found", confidence="low",
                      validation_required="yes", error_message="empty website")
        return result
    result["normalized_website"] = variants[0]
    first: FetchResult | None = None
    errors: list[str] = []
    for variant in variants:
        attempt = fetch(variant, timeout)
        if attempt.status and 200 <= attempt.status < 400 and attempt.body:
            first = attempt
            break
        errors.append(f"{variant}: {attempt.error_kind or 'error'} {attempt.error}".strip())
    if first is None:
        result.update(website_status="unreachable", result_status="website_unreachable",
                      confidence="low", validation_required="yes", error_message=" | ".join(errors)[:2000])
        return result
    result.update(website_status="reachable", http_status=str(first.status or ""),
                  final_url=first.final_url, redirect_count=str(first.redirects))
    host = (urlparse(first.final_url).hostname or "").removeprefix("www.")
    if host in PORTALS and urlparse(first.final_url).path in {"", "/"}:
        result.update(result_status="manual_research_required", confidence="low",
                      validation_required="yes", evidence_note="generic portal page; concrete profile missing")
        return result

    all_candidates: list[Address] = []
    page_texts: list[str] = []
    queue: list[tuple[str, str]] = [(first.final_url, first.body)]
    visited: set[str] = set()
    while queue and len(visited) < max_pages:
        page_url, body = queue.pop(0)
        if page_url in visited:
            continue
        visited.add(page_url)
        candidates, links, text = parse_page(body, page_url, existing_plz, country)
        all_candidates.extend(candidates)
        page_texts.append(text[:100_000])
        for link in links:
            if link in visited or any(link == queued[0] for queued in queue):
                continue
            if not allowed_by_robots(link, timeout, robots_cache):
                errors.append(f"robots.txt disallows {link}")
                continue
            time.sleep(delay)
            page = fetch(link, timeout)
            if page.status and 200 <= page.status < 400 and page.body:
                queue.append((page.final_url, page.body))
            elif page.error:
                errors.append(f"{link}: {page.error_kind} {page.error}")

    candidates = deduplicate(all_candidates)
    matching = [item for item in candidates if not existing_plz or item.plz == existing_plz]
    pool = matching or candidates
    matched_name = name_matches(row, page_texts)
    result["name_match"] = "yes" if matched_name else "no"
    result["multiple_locations"] = "yes" if len(pool) > 1 else "no"
    if not pool:
        result.update(result_status="not_found", confidence="low", validation_required="yes",
                      evidence_note=f"checked {len(visited)} page(s); no address candidate",
                      error_message=" | ".join(errors)[:2000])
        return result
    best = sorted(pool, key=lambda a: (a.plz == existing_plz, bool(a.street and a.housenumber), a.evidence.startswith("JSON")), reverse=True)[0]
    country_match = not best.country or best.country == country
    plz_match = best.plz == existing_plz
    multiple = len(pool) > 1
    complete = bool(best.city and best.street and best.housenumber)
    if multiple:
        status, confidence = "ambiguous", "low"
    elif plz_match and country_match and matched_name and complete:
        status, confidence = "probable", "high"
    elif plz_match and country_match:
        status, confidence = "probable", "medium"
    else:
        status, confidence = "manual_research_required", "low"
    result.update(
        source_page_url=best.source, found_country=best.country or country,
        found_plz=best.plz, found_city=best.city, found_street=best.street,
        found_housenumber=best.housenumber, address_full=best.full,
        plz_match="yes" if plz_match else "no", country_match="yes" if country_match else "no",
        result_status=status, confidence=confidence, validation_required="yes",
        evidence_note=f"{best.evidence}; checked {len(visited)} page(s)",
        error_message=" | ".join(errors)[:2000],
    )
    return result


def enrich_csv(path: Path, timeout: float, delay: float, max_pages: int, limit: int | None) -> None:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("CSV has no header")
        required = {"dr_id", "dr_display_name", "dr_org_name", "website", "loc_country", "loc_plz"}
        missing = required.difference(reader.fieldnames)
        if missing:
            raise ValueError("missing columns: " + ", ".join(sorted(missing)))
        fieldnames = list(reader.fieldnames)
        rows = list(reader)
    for field_name in OUTPUT_FIELDS:
        if field_name not in fieldnames:
            fieldnames.append(field_name)
    robots_cache: dict[str, RobotFileParser] = {}
    count = len(rows) if limit is None else min(limit, len(rows))
    for index, row in enumerate(rows[:count], 1):
        print(f"[{index}/{count}] {row.get('dr_id')} {row.get('dr_display_name')}", flush=True)
        researched = research_row(row, timeout, delay, max_pages, robots_cache)
        row.update(researched)
        if index < count:
            time.sleep(delay)
    backup = path.with_suffix(path.suffix + ".bak")
    if not backup.exists():
        shutil.copy2(path, backup)
    temp_name = ""
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8-sig", newline="", delete=False,
                                         dir=path.parent, prefix=path.stem + "_", suffix=".tmp") as handle:
            temp_name = handle.name
            writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(rows)
        Path(temp_name).replace(path)
    finally:
        if temp_name and Path(temp_name).exists():
            Path(temp_name).unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=12.0)
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--max-pages", type=int, default=5)
    parser.add_argument("--limit", type=int, help="process only the first N rows (test runs)")
    args = parser.parse_args()
    if args.delay < 0.5:
        parser.error("--delay must be at least 0.5 seconds")
    if args.max_pages < 1 or args.max_pages > 10:
        parser.error("--max-pages must be between 1 and 10")
    try:
        enrich_csv(args.input.resolve(), args.timeout, args.delay, args.max_pages, args.limit)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
