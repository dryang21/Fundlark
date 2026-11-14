"""Collect Stanford’s public opportunity listings, keeping archived rounds closed."""
import argparse
import asyncio
import hashlib
import json
import re
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from app.monitoring import UA, request_with_retry

ROOT = "https://seedfunding.stanford.edu"
START = {f"{ROOT}/opportunities": "open", f"{ROOT}/opportunities/coming-soon": "forecast",
         f"{ROOT}/opportunities/closed": "closed"}
STAGES = {"academic council faculty": "faculty", "university center line faculty": "faculty",
          "postdocs": "postdoc", "graduate students": "masters", "undergraduates": "undergrad",
          "staff": "staff", "residents": "resident"}


def call_url(value, base):
    url = urljoin(base, value)
    parts = urlsplit(url)
    if parts.scheme == "https" and parts.netloc == urlsplit(ROOT).netloc and re.fullmatch(
            r"/opportunities/[a-z0-9-]+/?", parts.path) and url.rstrip("/") not in START:
        return ROOT + parts.path.rstrip("/")
    return None


def extract(html, page_url, listing, checked):
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for card in soup.select("main article.node-opportunity"):
        link = card.select_one(".teaser__title a[href]")
        if not link:
            continue
        url = call_url(link["href"], page_url)
        if not url:
            continue
        def values(field):
            return [node.get_text(" ", strip=True) for node in card.select(
                f".field-name-field-{field} .field-items > .field-item")]
        title = link.get_text(" ", strip=True)
        title = re.sub(r"^\[Clone\]\s*", "", title)
        roles = values("who-can-apply")
        stages = {STAGES[role.lower()] for role in roles if role.lower() in STAGES}
        if "masters" in stages:
            stages.add("phd")
        fields = [value for value in values("opportunity-type") if value.lower() not in {"research", "teaching"}]
        deadline = None
        for value in values("application-deadline"):
            try:
                deadline = datetime.strptime(value.strip(), "%B %d, %Y").date().isoformat()
            except ValueError:
                continue
            break
        status = listing if listing == "closed" or deadline else "verify"
        if deadline and deadline < checked:
            status = "closed"
        amount = next(iter(values("funding-desc-short")), None)
        if amount and not re.search(r"\d|reimbursement|voucher", amount, re.I):
            amount = None
        description = next(iter(values("homepage-teaser")), "").strip()
        # Quote only a short listing excerpt when needed, and link readers to the source.
        description = " ".join(description.split()[:18]).rstrip(".,;:")
        funder = "Stanford University"
        rows.append({
            "id": "stanford-seed:" + hashlib.sha256(url.encode()).hexdigest()[:16],
            "title": title, "funder": funder, "category": "Institution", "url": url, "status": status,
            "deadline": deadline, "funding_type": "Institutional funding", "amount": amount and amount[:160],
            "description": f"Listing excerpt: “{description}…”" if description else "See Stanford’s official call for project scope.",
            "eligibility": ("Listing categories: " + "; ".join(roles) + ". Check the official call for restrictions."
                            if roles else "Check Stanford’s official call for applicant requirements."),
            "topics": fields, "eligible_stages": sorted(stages),
            "affiliation_tags": {"institution": "Stanford University"},
            "origin": "institution_listing", "source_date": checked, "last_verified_at": None,
            "review_needed": True,
        })
    next_link = soup.select_one("main .pager-next a[href]")
    next_url = urljoin(page_url, next_link["href"]) if next_link else None
    if next_url and (not next_url.startswith(ROOT + "/opportunities") or
                     urlsplit(next_url).path != urlsplit(page_url).path):
        raise ValueError("Unexpected Stanford pagination URL")
    return rows, next_url


async def collect(output, max_archive_pages, checked):
    records = {}
    async with httpx.AsyncClient(headers={"User-Agent": UA}, timeout=18) as client:
        robots = RobotFileParser()
        response = await request_with_retry(client, "GET", ROOT + "/robots.txt")
        response.raise_for_status()
        robots.parse(response.text.splitlines())
        delay = robots.crawl_delay(UA) or 10
        for start, listing in START.items():
            url = start
            for _ in range(max_archive_pages if listing == "closed" else 3):
                if not url or not robots.can_fetch(UA, url):
                    break
                await asyncio.sleep(delay)
                response = await request_with_retry(client, "GET", url)
                if response.status_code != 200:
                    raise RuntimeError(f"Stanford listing returned {response.status_code}: {url}")
                rows, url = extract(response.text, url, listing, checked)
                if not rows and listing != "forecast":
                    raise ValueError(f"No calls parsed from {start}")
                for row in rows:
                    records.setdefault(row["url"], row)
            if url:
                print(f"Pagination stopped at {url}", flush=True)
            # Save a usable partial snapshot between source sections.
            write_snapshot(output, records, checked)
    return records


def write_snapshot(output, records, checked):
    payload = {"schema_version": 1, "source_date": checked, "opportunities": list(records.values())}
    temp = output.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--archive-pages", type=int, default=25, choices=range(1, 26), metavar="1–25")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    records = asyncio.run(collect(args.output, args.archive_pages, args.as_of.isoformat()))
    print(f"Collected {len(records)} Stanford listings.")


if __name__ == "__main__":
    main()
