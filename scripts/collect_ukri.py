"""Refresh factual call metadata from UKRI's public Funding Finder."""
import argparse
from collections import Counter
from datetime import datetime
import json
from pathlib import Path
import re
import time
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup

ROOT = "https://www.ukri.org"
START = f"{ROOT}/opportunity/"
SOURCE = Path(__file__).resolve().parents[1] / "docs/demo/ukri-calls.json"
UK = ZoneInfo("Europe/London")
UA = "FundlarkCatalog/1.0 (public research funding metadata)"
STATUSES = {"open": "open", "upcoming": "forecast", "closed": "closed"}


def owned_url(value, pattern):
    absolute = urljoin(START, value)
    url = urlsplit(absolute)
    if url.scheme != "https" or url.netloc != "www.ukri.org" or not re.fullmatch(pattern, url.path):
        raise ValueError(f"Unexpected UKRI URL: {absolute}")
    return ROOT + url.path.rstrip("/") + "/"


def parse_page(html, checked):
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for card in soup.select("div.type-opportunity"):
        link = card.select_one(".ukri-funding-opp__link[href]")
        post = re.fullmatch(r"post-(\d+)", card.get("id", ""))
        if not link or not post:
            raise ValueError("UKRI card missing its title link or stable post ID")
        values = {}
        for term in card.select(".opportunity__summary dt"):
            value = term.find_next_sibling("dd")
            if value:
                values[term.get_text(" ", strip=True).rstrip(":").lower()] = value

        def label(*names):
            for name in names:
                if name in values:
                    return values[name].get_text(" ", strip=True)
            return None

        def timestamp(name):
            tag = values[name].select_one("time[datetime]") if name in values else None
            if not tag:
                return None
            return datetime.fromisoformat(tag["datetime"]).replace(tzinfo=UK)

        open_at, close_at = timestamp("opening date"), timestamp("closing date")
        status = STATUSES.get((label("opportunity status") or "").lower())
        if not status:
            raise ValueError(f"Unknown UKRI status: {label('opportunity status')!r}")
        if close_at and close_at <= checked:
            status = "closed"
        elif open_at and open_at > checked and status != "closed":
            status = "forecast"
        title = link.get_text(" ", strip=True)
        if status == "open" and re.match(r"pre[- ]announcement\b", title, re.I):
            status = "forecast"
        amount = label("award range", "maximum award", "minimum award")
        amount_min = amount_max = None
        if amount:
            gbp = re.findall(r"£([\d,]+)(?![\d.,])", amount)
            nums = [int(value.replace(",", "")) for value in gbp]
            if len(nums) == 2 and "award range" in values:
                amount_min, amount_max = sorted(nums)
            elif len(nums) == 1 and "maximum award" in values:
                amount_max = nums[0]
            elif len(nums) == 1 and "minimum award" in values:
                amount_min = nums[0]
        rows.append({
            "id": f"ukri-listing-{post[1]}",
            "title": title,
            "funder": label("funders", "funder") or "UK Research and Innovation",
            "funding_type": label("funding type") or "Research funding",
            "category": "Government",
            "country_or_region": "United Kingdom",
            "url": owned_url(link["href"], r"/opportunity/[a-z0-9-]+/?"),
            "status": status,
            "opens_on": open_at.date().isoformat() if open_at else None,
            "deadline": close_at.date().isoformat() if close_at else None,
            "deadline_time": close_at.strftime("%H:%M") if close_at else None,
            "deadline_timezone": "Europe/London" if close_at else None,
            "amount": amount,
            "amount_min": amount_min,
            "amount_max": amount_max,
            "currency": "GBP" if amount and "£" in amount else None,
            "eligibility": "Read the official call for applicant and host organization rules.",
            "topics": [],
            "eligible_stages": [],
            "affiliation_tags": [],
            "program_status_scope": "specific_call",
            "origin": "ukri_listing",
            "last_verified_at": checked.date().isoformat(),
            "review_needed": True,
        })
    found = soup.select_one(".opportunities-results")
    count = re.match(r"([\d,]+) opportunit", found.get_text(" ", strip=True)) if found else None
    next_page = soup.select_one("a.next.page-numbers[href]")
    return rows, int(count[1].replace(",", "")) if count else None, (
        owned_url(next_page["href"], r"/opportunity/page/[1-9]\d*/?") if next_page else None)


def collect(client, checked):
    rules = RobotFileParser()
    rules.parse(client.get(f"{ROOT}/robots.txt").raise_for_status().text.splitlines())
    delay = max(1, rules.crawl_delay(UA) or 0)
    expected = None
    seen, rows = set(), []
    url = START
    while url:
        if url in seen or len(seen) >= 40 or not rules.can_fetch(UA, url):
            raise ValueError(f"Unexpected, repeated, or disallowed funding finder page: {url}")
        seen.add(url)
        time.sleep(delay)
        response = client.get(url).raise_for_status()
        page, count, url = parse_page(response.text, checked)
        if expected is None:
            expected = count
        if not page or not expected or count != expected:
            raise ValueError("UKRI listing changed mid-scan or expected HTML was not returned")
        rows.extend(page)
    if len(rows) != expected or len({r["id"] for r in rows}) != expected or len({r["url"] for r in rows}) != expected:
        raise ValueError(f"UKRI pagination returned an incomplete or duplicate snapshot ({len(rows)}/{expected})")
    return sorted((r for r in rows if r["status"] != "closed" and r["funding_type"].lower() != "loan"),
                  key=lambda row: row["id"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=SOURCE)
    args = parser.parse_args()
    checked = datetime.now(UK)
    with httpx.Client(timeout=20, headers={"User-Agent": UA}) as client:
        rows = collect(client, checked)
    if not rows:
        raise SystemExit("No active or upcoming listings; existing snapshot preserved.")
    out = args.output
    temp = out.with_suffix(".tmp")
    temp.write_text(json.dumps({"schema_version": 1, "source": START, "checked_at": checked.date().isoformat(),
                                "opportunities": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(out)
    print(f"UKRI listing snapshot: {dict(Counter(r['status'] for r in rows))}")


if __name__ == "__main__":
    main()
