"""Combine official Stanford and Grants.gov listings for the static catalog."""
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = re.compile(r"\b(research|science|scientific|engineering|innovation|fellowships?|scholarships?|training|early[- ]career|data|technology|mathematics|doctoral|discovery|investigator|SBIR|STTR|R01|R21|R03|RFA)\b", re.I)
SERVICE = re.compile(r"\b(continuation|non[- ]competitive|invited|sole source|warfare|warfighter|combat|chemical threat|biological threat|weapons?|counterterrorism)\b", re.I)
FEDERAL_HOSTS = {"www.grants.gov", "grants.gov"}


def key(url):
    return urlsplit(url).path.rstrip("/") if urlsplit(url).netloc in FEDERAL_HOSTS else url.split("?", 1)[0].rstrip("/")


def build(base, stanford, federal):
    curated_urls = {key(row["url"]) for row in base if row.get("origin") != "grantsgov_api"}
    added = set()
    rows = []
    for row in stanford:
        url = row.get("url", "")
        parts = urlsplit(url)
        route = key(url)
        if (parts.scheme != "https" or parts.netloc != "seedfunding.stanford.edu" or
                not re.fullmatch(r"/opportunities/[a-z0-9-]+/?", parts.path) or route in curated_urls):
            continue
        if route not in added:
            rows.append(row)
            added.add(route)
    for row in federal:
        if row.get("origin") != "grantsgov_api" or row["status"] not in {"open", "forecast"}:
            continue
        url = urlsplit(row["url"])
        route = key(row["url"])
        if (url.scheme != "https" or url.netloc not in FEDERAL_HOSTS or
                not re.fullmatch(r"/search-results-detail/[0-9]+", url.path)):
            continue
        if route in curated_urls or route in added:
            continue
        if not RESEARCH.search(row["title"]) or SERVICE.search(row["title"]):
            continue
        rows.append(dict(row, last_verified_at=None, review_needed=True))
        added.add(route)
    return {"schema_version": 1, "opportunities": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stanford", type=Path)
    parser.add_argument("federal", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "docs/demo/supplemental.json")
    parser.add_argument("--store-local", action="store_true",
                        help="Also add previously unseen listings to the local SQLite catalog")
    args = parser.parse_args()
    load = lambda p: json.loads(p.read_text(encoding="utf-8"))["opportunities"]
    demo = ROOT / "docs/demo"
    seed = load(demo / "data.json") + load(demo / "coverage.json")
    payload = build(seed, load(args.stanford), load(args.federal))
    if not payload["opportunities"]:
        raise SystemExit("No usable listings; preserving the existing snapshot.")
    temp = args.output.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(args.output)
    if args.store_local:
        from app import storage

        storage.init_db()
        with storage.connect() as db:
            for row in payload["opportunities"]:
                storage.insert_opportunity(db, row, origin=row["origin"], if_absent=True)
    print(dict(Counter((r["category"], r["status"]) for r in payload["opportunities"])))


if __name__ == "__main__":
    main()
