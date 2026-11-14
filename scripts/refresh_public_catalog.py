"""Collect official Grants.gov results and preview a merge into the public snapshot."""
import argparse
import asyncio
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

import httpx

from app.connectors import UA, fetch_grants_gov_page

CATALOG = Path(__file__).resolve().parents[1] / "docs/demo/data.json"
TOPICS = (
    "artificial intelligence", "computer science", "robotics", "engineering",
    "mathematics", "physics", "chemistry", "materials science", "biology",
    "medical research", "public health", "climate", "ecology", "economics",
    "social science", "humanities", "early career",
)
UPDATE_FIELDS = ("title", "funder", "deadline", "status", "url")


async def collect(client, topics, pages, size):
    found, failures, capped = {}, {}, []
    for topic in topics:
        seen = set()
        try:
            for page in range(pages):
                rows, total = await fetch_grants_gov_page(client, topic, rows=size, start=page * size)
                ids = {record["id"] for record in rows}
                if rows and not ids - seen:
                    raise ValueError("Pagination repeated a page")
                seen.update(ids)
                found.update((record["id"], record) for record in rows)
                if len(rows) < size or (total is not None and (page + 1) * size >= total):
                    break
            else:
                capped.append(topic)
        except (httpx.HTTPError, ValueError) as exc:
            failures[topic] = type(exc).__name__
    return found, failures, capped


def merge(snapshot, candidates, now):
    old = {record["id"]: record for record in snapshot["opportunities"]}
    if len(old) != len(snapshot["opportunities"]):
        raise ValueError("Existing snapshot contains duplicate opportunity IDs")
    counts = Counter()
    for key, candidate in sorted(candidates.items()):
        record = old.get(key)
        if record is not None and record.get("origin") != "grantsgov_api":
            counts["protected"] += 1
        elif record is None:
            old[key] = dict(candidate, origin="grantsgov_api", last_checked_at=now,
                            last_verified_at=None, review_needed=True, stale=False)
            counts["added"] += 1
        else:
            changes = {field: candidate[field] for field in UPDATE_FIELDS
                       if candidate[field] is not None and candidate[field] != record.get(field)}
            if changes:
                old[key] = dict(record, **changes, last_checked_at=now, review_needed=True)
                counts["updated"] += 1
            else:
                counts["unchanged"] += 1
    if counts["added"] or counts["updated"]:
        snapshot = dict(snapshot, opportunities=list(old.values()), generated_at=now)
    return snapshot, counts


async def refresh(args):
    original = CATALOG.read_bytes()
    snapshot = json.loads(original)
    if snapshot.get("schema_version") != 1 or not isinstance(snapshot.get("opportunities"), list):
        raise ValueError("Invalid Fundlark catalog")
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": UA}) as client:
        candidates, failures, capped = await collect(client, args.topic or TOPICS, args.pages, args.rows)
    if not candidates:
        raise SystemExit(f"No API results collected; catalog unchanged. Failed searches: {failures}")
    proposed, counts = merge(snapshot, candidates, datetime.now(timezone.utc).isoformat())
    print(json.dumps({"unique_api_results": len(candidates), **counts,
                      "page_limit_reached": capped, "failed_searches": failures}, indent=2))
    if failures:
        raise SystemExit("Refresh incomplete; no files written. Retry or narrow the failing searches.")
    if proposed is snapshot:
        return
    if args.apply and CATALOG.read_bytes() != original:
        raise SystemExit("Catalog changed during the refresh. Rerun from the updated catalog.")
    output = CATALOG if args.apply else args.output
    if output is None:
        return
    if not args.apply and output.resolve() == CATALOG.resolve():
        raise SystemExit("Use --apply to update the tracked catalog.")
    content = json.dumps(proposed, ensure_ascii=False, indent=2) + "\n"
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as file:
        file.write(content)
        temporary = Path(file.name)
    try:
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic", action="append", help="Override default coverage; repeat for multiple searches")
    parser.add_argument("--pages", type=int, choices=range(1, 6), default=2)
    parser.add_argument("--rows", type=int, choices=range(1, 101), default=50, metavar="1–100")
    output = parser.add_mutually_exclusive_group()
    output.add_argument("--output", type=Path, help="Write the proposed snapshot for review")
    output.add_argument("--apply", action="store_true", help="Update the tracked snapshot locally")
    args = parser.parse_args()
    if args.topic and (len(args.topic) > 25 or any(not topic.strip() or len(topic)>100 for topic in args.topic)):
        parser.error("Expected at most 25 nonempty topic queries of 100 characters or fewer")
    asyncio.run(refresh(args))


if __name__ == "__main__":
    main()
