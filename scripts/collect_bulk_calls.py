"""Build compact discovery snapshots from dated Grants.gov extracts and Horizon Europe."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
import zipfile

import httpx

DEMO = Path(__file__).resolve().parents[1] / "docs/demo"
EU_API = "https://api.tech.ec.europa.eu/search-api/prod/rest/search"
EU_CALL = "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/"
FED_CALL = "https://www.grants.gov/search-results-detail/"
BASE = ("data.json", "coverage.json", "supplemental.json", "crossdisciplinary.json", "global-programs.json", "ukri-calls.json", "fellowships.json")
EXCLUDE = re.compile(r"\b(continuation|non[- ]competitive|sole source|invited applicants? only|weapons?|warfare|warfighter|combat|counterterrorism)\b", re.I)
RESEARCH_TITLE = re.compile(r"\b(research|scientific|fellowships?|doctoral|SBIR|STTR)\b", re.I)
CIVILIAN_RESEARCH = {"HHS", "NSF", "NIH", "DOE", "PAMS", "NASA", "DOC", "USDA", "EPA", "NEH", "NEA", "ED", "DOI", "IMLS"}
SYNOPSIS = "OpportunitySynopsisDetail_1_0"
FORECAST = "OpportunityForecastDetail_1_0"


def route(url):
    parsed = urlsplit(url)
    return (parsed.hostname or "").removeprefix("www."), parsed.path.rstrip("/").lower()


def short_text(text):
    return " ".join((text or "").split())


def federal_date(value):
    if not re.fullmatch(r"\d{8}", value or ""):
        return None
    try:
        return datetime.strptime(value, "%m%d%Y").date()
    except ValueError:
        return None


def public_amount(value):
    return int(value) if re.fullmatch(r"[0-9]{1,15}", value or "") and int(value) > 0 else None


def federal_record(fields, forecast, as_of):
    def one(key):
        return next(iter(fields.get(key, ())), "")
    title = short_text(one("OpportunityTitle"))
    sponsor = short_text(one("AgencyName"))
    key = one("OpportunityID")
    instruments = set(fields.get("FundingInstrumentType", ()))
    agency = one("AgencyCode").split("-")[0]
    if (not re.fullmatch(r"[0-9]{1,20}", key) or not title or not sponsor
            or agency not in CIVILIAN_RESEARCH
            or one("OpportunityCategory") != "D" or not instruments & {"G", "CA"}
            or EXCLUDE.search(title)
            or not ("ST" in fields.get("CategoryOfFundingActivity", ()) or RESEARCH_TITLE.search(title))):
        return None
    published = federal_date(one("PostDate"))
    closes = federal_date(one("EstimatedSynopsisCloseDate" if forecast else "CloseDate"))
    # Flag legacy distant feed dates for sponsor review; never infer rolling.
    suspect = bool(closes and closes.year - as_of.year >= 10)
    if suspect:
        closes = None
    opens = federal_date(one("EstimatedSynopsisPostDate")) if forecast else published
    archived = federal_date(one("ArchiveDate"))
    updated = federal_date(one("LastUpdatedDate")) or published
    if (closes and closes < as_of) or (archived and archived < as_of):
        status = "closed"
    elif suspect:
        status = "verify"
    elif forecast:
        if not any(d and d >= as_of for d in (closes, opens)) and (not updated or updated < as_of - timedelta(days=180)):
            return None
        status = "forecast" if not opens or opens > as_of else "verify"
    elif closes and opens and opens <= as_of <= closes:
        status = "verify"
    elif opens and opens > as_of:
        status = "forecast"
    elif updated and updated >= as_of - timedelta(days=180):
        status = "verify"
    else:
        return None
    # Forecast dates are estimates and must be checked for an actual published notice.
    row = dict(id=f"grantsgov-bulk-{key}", title=title, funder=sponsor, funder_code=one("AgencyCode"),
               opportunity_number=one("OpportunityNumber"), url=FED_CALL + key,
               category="Government", country_or_region="United States", origin="grantsgov_bulk",
               program_status_scope="specific_call", review_needed=True, status=status,
               funding_type="Federal grant" if "G" in instruments else "Cooperative agreement")
    if suspect:
        row["deadline_review"] = "distant_imported_date"
    if closes:
        row["deadline"] = closes.isoformat()
    if opens and status != "closed":
        row["opens_on"] = opens.isoformat()
    floor, ceiling = public_amount(one("AwardFloor")), public_amount(one("AwardCeiling"))
    if floor and ceiling and floor > ceiling:
        floor = ceiling = None
    if floor:
        row["amount_min"] = floor
    if ceiling:
        row["amount_max"] = ceiling
    if status != "closed":
        if floor or ceiling:
            row["currency"] = "USD"
        if floor and ceiling and floor != ceiling:
            row["amount"] = f"${floor:,}–${ceiling:,}"
        elif ceiling:
            row["amount"] = f"Up to ${ceiling:,}"
        elif floor:
            row["amount"] = f"From ${floor:,}"
    return row


def federal_extract(path, as_of):
    with zipfile.ZipFile(path) as zip_:
        entries = [x for x in zip_.infolist() if re.fullmatch(r"GrantsDBExtract\d{8}v2\.xml", x.filename)]
        if len(entries) != 1 or entries[0].file_size > 750_000_000:
            raise ValueError("Expected one official Grants.gov v2 XML member")
        observed = datetime.strptime(entries[0].filename[15:23], "%Y%m%d").date()
        if observed > as_of or as_of - observed > timedelta(days=7):
            raise ValueError(f"Extract date {observed} is not recent relative to {as_of}")
        rows = {}
        total = 0
        with zip_.open(entries[0]) as xml:
            stream = ET.iterparse(xml, events=("start", "end"))
            _, root = next(stream)
            if root.tag.split("}")[-1] != "Grants":
                raise ValueError(f"Unexpected extract root: {root.tag}")
            for event, element in stream:
                tag = element.tag.split("}")[-1]
                if event != "end" or tag not in (SYNOPSIS, FORECAST):
                    continue
                total += 1
                fields = {}
                for child in element:
                    fields.setdefault(child.tag.split("}")[-1], []).append(child.text or "")
                record = federal_record(fields, tag == FORECAST, observed)
                if record:
                    # Prefer a published synopsis for an ID seen in both XML sections.
                    key = record["id"]
                    if key not in rows or tag == SYNOPSIS:
                        record["source_checked_at"] = observed.isoformat()
                        rows[key] = record
                root.clear()
        if total < 10_000 or not rows:
            raise ValueError(f"Unusually small federal extract ({total} upstream records)")
    return list(rows.values()), {"raw": total, "checked_at": observed.isoformat(), "retained": len(rows)}


def european_day(value):
    try:
        return date.fromisoformat(value[:10])
    except (TypeError, ValueError):
        return None


def horizon_record(result, as_of):
    m = result.get("metadata") or {}
    def one(key):
        return next(iter(m.get(key) or ()), "")
    identifier = one("identifier")
    title = short_text(one("title"))
    if (one("type") != "1" or one("frameworkProgramme") != "43108390" or one("language") != "en"
            or not re.fullmatch(r"[A-Z0-9][A-Z0-9-]{2,100}", identifier, re.I) or not title or EXCLUDE.search(title)):
        return None
    opens = european_day(one("startDate"))
    deadlines = sorted({d for raw in m.get("deadlineDate", ()) if (d := european_day(raw))})
    if not deadlines or deadlines[-1] < as_of:
        return None
    deadline = next(d for d in deadlines if d >= as_of)
    state = one("status")
    if state not in {"31094501", "31094502"}:
        return None
    if opens and opens > as_of:
        status = "forecast"
    elif state == "31094502" and deadlines[0] == deadline:
        status = "open"
    else:
        status = "verify"
    record = dict(id=f"horizon-{identifier.lower()}", title=title, funder="European Commission · Horizon Europe",
                opportunity_number=identifier, category="Government", origin="horizon_feed",
                country_or_region="European Union", url=EU_CALL + identifier,
                program_status_scope="specific_call", review_needed=True, status=status,
                funding_type="Research grant", deadline=deadline.isoformat(),
                opens_on=opens.isoformat() if opens else None, source_checked_at=as_of.isoformat())
    # Two dates alone do not establish a two-stage process. Horizon identifies
    # these calls in its topic IDs. The first deadline is the initial route.
    if identifier.lower().endswith("-two-stage") and len(deadlines) == 2:
        record["initial_deadline"] = deadlines[0].isoformat()
        record["application_phase"] = "initial" if deadline == deadlines[0] else "invited_stage_two"
    return record


def horizon_feed(as_of):
    query = {"bool": {"must": [{"terms": {"type": ["1"]}}, {"terms": {"status": ["31094501", "31094502"]}},
                              {"term": {"frameworkProgramme": "43108390"}}, {"term": {"language": "en"}}]}}
    with httpx.Client(timeout=40) as client:
        rows = {}
        seen = set()
        slots = 0
        expected = None
        for page in range(1, 41):
            data = client.post(EU_API, params={"apiKey": "SEDIA", "text": "***", "pageSize": 100, "pageNumber": page},
                               files={"query": (None, json.dumps(query), "application/json"),
                                      "sort": (None, '{"field":"startDate","order":"DESC"}', "application/json")}).raise_for_status().json()
            total, raw = int(data["totalResults"]), data["results"]
            if expected is None:
                expected = total
            if total != expected or len(raw) != min(100, expected - (page - 1) * 100):
                raise ValueError("Horizon feed changed mid-scan or pagination was incomplete")
            slots += len(raw)
            for item in raw:
                reference = item.get("reference")
                if not reference:
                    raise ValueError("Missing Horizon source reference")
                if reference in seen:
                    continue
                seen.add(reference)
                row = horizon_record(item, as_of)
                if row:
                    old = rows.get(row["id"])
                    # Several actions can share one official topic URL.
                    if not old or (row["opens_on"] or "", row["deadline"]) > (old["opens_on"] or "", old["deadline"]):
                        rows[row["id"]] = row
            if slots == expected:
                break
            time.sleep(0.35)
        if slots != expected or len(seen) < expected * 0.95 or not rows:
            raise ValueError(f"Incomplete Horizon snapshot: {slots}/{expected} results, {len(seen)} unique references")
    return list(rows.values()), {"raw": expected, "duplicate_references": slots - len(seen),
                                 "checked_at": as_of.isoformat(), "retained": len(rows)}


def bundle(rows, sources, baseline):
    # Bulk listings do not displace existing editorial or topical records. A
    # later refresh can replace this snapshot without changing the baseline.
    existing = {route(r["url"]) for r in baseline}
    unique = {}
    for row in rows:
        key = route(row["url"])
        if key not in existing:
            unique[key] = row
    active, archive = [], []
    for row in sorted(unique.values(), key=lambda r: r["id"]):
        (archive if row["status"] == "closed" else active).append(row)
    # Archived rows are all federal, so store common fields once.
    checked = sources["Grants.gov"]["checked_at"]
    compact = [[r["id"].removeprefix("grantsgov-bulk-"), r["title"], r["funder"], r.get("deadline"),
                r["funding_type"] == "Cooperative agreement", r["opportunity_number"], r.get("amount_min"),
                r.get("amount_max")] for r in archive]
    digest = hashlib.sha256(json.dumps([checked, compact], sort_keys=True).encode()).hexdigest()[:16]
    return (dict(schema_version=1, sources=sources, archive_count=len(archive), archive_revision=digest,
                 opportunities=active),
            dict(schema_version=1, archive_revision=digest, checked_at=checked, rows=compact))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("federal_zip", type=Path)
    p.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    p.add_argument("--output-dir", type=Path, required=True)
    p.add_argument("--federal-only", action="store_true")
    args = p.parse_args()
    federal, sources = federal_extract(args.federal_zip, args.as_of)
    audit = {"Grants.gov": sources}
    horizon = []
    if not args.federal_only:
        horizon, audit["Horizon Europe"] = horizon_feed(args.as_of)
    baseline = [r for name in BASE for r in json.loads((DEMO / name).read_text())["opportunities"]]
    live, archive = bundle(federal + horizon, audit, baseline)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, data in (("bulk-archive.json", archive), ("bulk-calls.json", live)):
        dest = args.output_dir / name
        temp = dest.with_suffix(".tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        temp.replace(dest)
    print(json.dumps({"sources": audit, "new_counts": Counter(r["status"] for r in live["opportunities"]),
                      "archive_count": live["archive_count"]}, indent=2))


if __name__ == "__main__":
    main()
