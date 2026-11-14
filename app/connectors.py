"""Federal API adapters and careful official-site change monitoring.

Monitored sites are never auto-converted into new opportunities: a human must
verify eligibility, deadlines and open/closed status before catalog publication.
"""
import asyncio
import json
import os
from datetime import date, datetime
from html import unescape

import httpx

from . import storage
from .monitoring import UA, check_source, extract_candidate_links, request_with_retry, robots_allowed

SOURCES = json.loads((storage.APP_DIR / "sources.json").read_text())


def normalize_grants_gov(hit):
    identifier = str(hit.get("id") or "")
    if not identifier or not hit.get("title"):
        return None
    deadline = None
    raw = hit.get("closeDate") or ""
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        if raw:
            try:
                deadline = datetime.strptime(raw[:10], fmt).date().isoformat()
                break
            except ValueError:
                continue
    rawstatus = (hit.get("oppStatus") or "").lower()
    status = "open" if rawstatus == "posted" else "forecast" if rawstatus == "forecasted" else "closed" if rawstatus in {"closed", "archived"} else "verify"
    number = hit.get("number") or identifier
    return {
        "id": f"grantsgov:{identifier}", "title": unescape(str(hit.get("title"))),
        "funder": hit.get("agencyName") or hit.get("agencyCode") or "U.S. federal agency",
        "category":"Government", "funding_type":"Federal grant", "amount":None,
        "deadline":deadline, "status":status,
        "description":f"Federal opportunity {number}. Open the official listing for the complete synopsis, funding amount, eligibility and application documents.",
        "topics":storage_safe_topics(hit.get("title") or ""),
        "eligibility":"Eligibility not established from search results; confirm in the official synopsis.",
        "eligible_stages":[], "faculty_sponsor_possible":False,
        "url":f"https://www.grants.gov/search-results-detail/{identifier}",
        "source_date":date.today().isoformat(),
    }


def storage_safe_topics(title):
    # Search-index keywords; no invented eligibility or inferred funding amounts.
    import re
    return list(dict.fromkeys(re.findall(r"[A-Za-z][A-Za-z-]{3,}", title.lower())))[:12]


async def fetch_grants_gov_page(client, term, rows=30, start=0):
    payload = {"rows": min(rows, 100), "keyword":term,
               "oppStatuses":"forecasted|posted", "startRecordNum":start}
    r = await request_with_retry(client, "POST", "https://api.grants.gov/v1/api/search2", json=payload)
    r.raise_for_status()
    body = r.json()
    if not isinstance(body, dict):
        raise ValueError("Unexpected Grants.gov response envelope")
    if body.get("errorcode") not in (0, "0", None):
        raise ValueError(f"Grants.gov returned error: {body.get('msg')}")
    data = body.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("oppHits"), list):
        raise ValueError("Grants.gov response omitted the opportunity list")
    records = []
    for hit in data["oppHits"]:
        record = normalize_grants_gov(hit) if isinstance(hit, dict) else None
        if record is None:
            raise ValueError("Grants.gov returned an opportunity without its ID or title")
        records.append(record)
    count = data.get("hitCount")
    return records, count if type(count) is int and count >= 0 else None


async def fetch_grants_gov(client, term, rows=30):
    records, _ = await fetch_grants_gov_page(client, term, rows=rows)
    return records


async def fetch_simpler_grants(client, keyword, api_key, rows=30):
    payload = {"query":keyword, "filters":{"opportunity_status":{"one_of":["posted","forecasted"]}},
               "pagination":{"page_offset":1,"page_size":min(rows,100),
               "sort_order":[{"order_by":"post_date","sort_direction":"descending"}]}}
    resp = await request_with_retry(client, "POST", "https://api.simpler.grants.gov/v1/opportunities/search", json=payload,
                             headers={"X-API-Key":api_key})
    resp.raise_for_status()
    raw = resp.json()
    if not isinstance(raw, dict) or not isinstance(raw.get("data"), list):
        raise ValueError("Simpler.Grants.gov response omitted the opportunity list")
    result = []
    for item in raw["data"]:
        if not isinstance(item, dict):
            raise ValueError("Simpler.Grants.gov returned an invalid opportunity")
        oid = item.get("opportunity_id")
        if not oid or not item.get("opportunity_title"):
            raise ValueError("Simpler.Grants.gov returned an opportunity without its ID or title")
        summary = item.get("summary") or {}
        if not isinstance(summary, dict):
            raise ValueError("Simpler.Grants.gov returned an invalid summary")
        legacy_id = item.get("legacy_opportunity_id")
        deadline = summary.get("close_date")
        if deadline:
            deadline = date.fromisoformat(deadline[:10]).isoformat()
        description = summary.get("summary_description") or item.get("purpose_statement")
        # The search API summary is structured data, not a description string.
        from bs4 import BeautifulSoup
        description = BeautifulSoup(description or "Review the official opportunity page for details.",
                                    "html.parser").get_text(" ", strip=True)
        result.append({
            "id":f"grantsgov:{legacy_id}" if legacy_id else f"simpler:{oid}", "title":item["opportunity_title"],
            "funder":item.get("agency_name") or "U.S. federal agency",
            "category":"Government", "funding_type":"Federal grant", "amount":None,
            "deadline":deadline,
            "status":{"posted":"open", "forecasted":"forecast", "closed":"closed", "archived":"closed"}.get(item.get("opportunity_status"), "verify"),
            "description":description[:1500],
            "topics":storage_safe_topics(item["opportunity_title"]),
            "eligibility":"Verify applicant eligibility in the official listing.",
            "eligible_stages":[], "faculty_sponsor_possible":False,
            "url":f"https://simpler.grants.gov/opportunity/{oid}",
            "source_date":date.today().isoformat(),
        })
    return result


async def sync_federal(queries=None):
    started_at = storage.now_iso()
    terms = list(dict.fromkeys(t.strip() for t in
        (queries or ["artificial intelligence", "medical research", "early career"]) if t.strip()))
    if not terms or len(terms) > 5 or any(len(t) > 100 for t in terms):
        raise ValueError("Use one to five nonempty search terms, each at most 100 characters")
    results = []
    errors = []
    key = os.getenv("SIMPLER_GRANTS_API_KEY", "").strip()
    source = "Simpler.Grants.gov" if key else "Grants.gov"
    async with httpx.AsyncClient(timeout=20, follow_redirects=True,
                                 headers={"User-Agent":UA}) as client:
        tasks = [fetch_simpler_grants(client, t, key) if key else fetch_grants_gov(client,t)
                 for t in terms]
        for term, result in zip(terms, await asyncio.gather(*tasks,return_exceptions=True)):
            if isinstance(result, Exception):
                errors.append(f"{term}: {type(result).__name__}: {str(result)[:150]}")
            else:
                results += result
    unique = {item["id"]:item for item in results}
    if unique:
        with storage.connect() as db:
            for item in unique.values():
                storage.insert_opportunity(db,item,origin="simpler_api" if key else "grantsgov_api")
    storage.record_sync(source,len(unique),errors,started_at=started_at)
    status = "error" if len(errors) == len(terms) else "partial" if errors else "ok"
    message = ("All federal queries failed; existing records were preserved." if status == "error"
               else "Some queries failed; successful results were imported." if status == "partial"
               else "Federal API queried successfully." if unique
               else "Federal API queried successfully; no matching records returned.")
    return {"source":source,"imported":len(unique),"errors":errors,
            "status":status,"message":message}



async def check_industry_sources():
    sem = asyncio.Semaphore(3)
    async with httpx.AsyncClient(timeout=20, follow_redirects=True,headers={"User-Agent":UA}) as client:
        async def guarded(source):
            async with sem:
                return await check_source(client,source)
        return await asyncio.gather(*(guarded(source) for source in SOURCES if source["mode"] == "watch"))
