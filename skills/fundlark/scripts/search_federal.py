#!/usr/bin/env python3
"""Keyless Grants.gov discovery using Python's standard library only.

Returns original search fields, official links and observation timestamps.
No CV handling, LLM calls, database, package installation or telemetry.
"""
import argparse
import json
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

ENDPOINT = "https://api.grants.gov/v1/api/search2"
MAX_BYTES = 3 * 1024 * 1024
RETRY_CODES = {429, 500, 502, 503, 504}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_query(query, rows=30, *, opener=None, sleep=time.sleep):
    opener = opener or build_opener(NoRedirect())
    payload = {"keyword": query, "rows": rows, "oppStatuses": "forecasted|posted", "startRecordNum": 0}
    request = Request(ENDPOINT, data=json.dumps(payload).encode(), method="POST",
                      headers={"Content-Type": "application/json", "Accept-Encoding": "identity",
                               "User-Agent": "FundlarkSkill/0.1 (research funding discovery)"})
    for attempt in range(3):
        try:
            with opener.open(request, timeout=20) as response:
                raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("Grants.gov response exceeded the 3 MB limit")
            body = json.loads(raw)
            if not isinstance(body, dict) or body.get("errorcode") not in (0, "0", None):
                raise ValueError("Grants.gov returned an API error or invalid envelope")
            data = body.get("data")
            if not isinstance(data, dict) or not isinstance(data.get("oppHits"), list):
                raise ValueError("Grants.gov response omitted its opportunity list")
            for hit in data["oppHits"]:
                if (not isinstance(hit, dict) or not str(hit.get("id", "")).isdigit()
                        or not isinstance(hit.get("title"), str) or not hit["title"].strip()):
                    raise ValueError("Grants.gov returned an invalid opportunity record")
            return data
        except HTTPError as exc:
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            exc.close()
            if exc.code not in RETRY_CODES or attempt == 2:
                raise
            try:
                delay = float(retry_after) if retry_after else 0.5 * 2 ** attempt
            except ValueError:
                raise exc
            if not 0 <= delay <= 5:
                raise exc
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
            delay = 0.5 * 2 ** attempt
        sleep(delay)


def search(queries, rows=30, *, fetch=fetch_query):
    queries = list(dict.fromkeys(q.strip() for q in queries if q.strip()))
    if not queries or len(queries) > 5 or any(len(q) > 100 for q in queries):
        raise ValueError("Use one to five topic queries, each at most 100 characters")
    if not 1 <= rows <= 100:
        raise ValueError("Rows must be between 1 and 100")
    observed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    records, errors, coverage = {}, [], []
    for query in queries:
        try:
            data = fetch(query, rows)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            errors.append({"query": query, "error": f"{type(exc).__name__}: {str(exc)[:180]}"})
            continue
        coverage.append({"query": query, "returned": len(data["oppHits"]), "total_hits": data.get("hitCount")})
        for hit in data["oppHits"]:
            identifier = str(hit["id"])
            if identifier not in records:
                records[identifier] = {**hit,
                    "official_url": f"https://www.grants.gov/search-results-detail/{identifier}",
                    "retrieved_at": observed_at, "matched_queries": []}
            records[identifier]["matched_queries"].append(query)
    status = "error" if len(errors) == len(queries) else "partial" if errors else "ok"
    return {"status": status, "source": "Grants.gov search2", "retrieved_at": observed_at,
            "first_page_only": True, "rows_per_query": rows, "coverage": coverage,
            "opportunities": list(records.values()), "errors": errors,
            "limitations": "Search hits are discovery candidates; verify current call details and applicant eligibility on official pages."}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", action="append", required=True, help="Public topic keyword; repeat up to five times")
    parser.add_argument("--rows", type=int, default=30, help="First-page results per query (1–100)")
    args = parser.parse_args(argv)
    try:
        result = search(args.query, args.rows)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
