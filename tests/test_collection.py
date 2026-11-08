import asyncio
import hashlib
import sqlite3
from types import SimpleNamespace

import httpx
import pytest

from app import connectors, jobs, monitoring, storage

SOURCE = {"id": "amazon-science", "mode": "watch",
          "url": "https://www.amazon.science/research-awards/call-for-proposals"}


def page(text="Applications open until December 14.", href="/awards/round-one"):
    return f"<main><h1>Research awards for early-career researchers</h1><p>{text}</p>" \
           f'<a href="{href}">Research funding call</a></main>'


def check_with(handler):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await monitoring.check_source(client, SOURCE)
    return asyncio.run(run())


def test_monitor_persists_changes_and_does_not_verify_grants(client):
    html = page()

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /")
        return httpx.Response(200, text=html, headers={"Content-Type": "text/html", "ETag": '"v1"'})

    before = client.get("/api/opportunities").json()
    assert check_with(handler)["status"] == "ok"
    assert storage.get_source_checks()[SOURCE["id"]]["review_needed"] == 0
    # A different destination with identical visible text must count as a change.
    html = page(href="/awards/round-two")
    assert check_with(handler)["status"] == "changed"
    saved = storage.get_source_checks()[SOURCE["id"]]
    assert saved["status"] == "changed"
    assert saved["review_needed"] == 1
    assert check_with(handler)["status"] == "ok"
    saved = storage.get_source_checks()[SOURCE["id"]]
    assert saved["review_needed"] == 1
    diff = client.get(f"/api/sources/{SOURCE['id']}/changes").json()
    assert "/awards/round-one" in diff["diff"]
    assert "/awards/round-two" in diff["diff"]
    after = client.get("/api/opportunities").json()
    assert {x["id"]: x["last_verified_at"] for x in after} == {x["id"]: x["last_verified_at"] for x in before}
    assert next(x for x in after if x["id"] == "curated:amazon-agentic-2026")["review_needed"]

    response = client.post(f"/api/sources/{SOURCE['id']}/review", json={
        "content_hash": "0" * 64, "note": "Reviewed the previous call."})
    assert response.status_code == 409
    response = client.post(f"/api/sources/{SOURCE['id']}/review", json={
        "content_hash": saved["content_hash"], "note": "New round link needs catalog verification."})
    assert response.status_code == 200
    assert storage.get_source_checks()[SOURCE["id"]]["review_needed"] == 0
    assert client.get(f"/api/sources/{SOURCE['id']}/changes").json()["reviews"][0]["note"]
    # Acknowledging a page does not clear opportunity-level uncertainty.
    assert next(x for x in storage.get_opportunities() if x["id"] == "curated:amazon-agentic-2026")["review_needed"]


def test_robots_block_and_redirect_targets_are_respected(client):
    seen = []

    def handler(request):
        seen.append(request.url.path)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private")
        return httpx.Response(302, headers={"Location": "/private/calls"})

    assert check_with(handler)["status"] == "skipped"
    assert "/private/calls" not in seen
    assert seen.count("/robots.txt") == 2


def test_official_monitor_never_follows_unregistered_host(client):
    hosts = []

    def handler(request):
        hosts.append(request.url.host)
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(302, headers={"Location": "https://other.example/calls"})

    assert check_with(handler)["status"] == "error"
    assert set(hosts) == {"www.amazon.science"}


def test_conditional_checks_keep_review_flags_and_last_good_snapshot(client):
    digest = hashlib.sha256(b"baseline").hexdigest()
    storage.record_source_check(SOURCE["id"], "ok", "baseline", digest,
                                content="baseline", url=SOURCE["url"], etag='"old"')
    new_digest = hashlib.sha256(b"changed").hexdigest()
    storage.record_source_check(SOURCE["id"], "ok", "new", new_digest,
                                content="changed", url=SOURCE["url"], etag='"new"')

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        assert request.headers["If-None-Match"] == '"new"'
        return httpx.Response(304)

    assert check_with(handler)["status"] == "ok"
    saved = storage.get_source_checks()[SOURCE["id"]]
    assert saved["review_needed"] == 1
    assert saved["content_hash"] == new_digest
    storage.record_source_check(SOURCE["id"], "error", "temporary outage")
    assert storage.get_source_checks()[SOURCE["id"]]["content_hash"] == new_digest
    assert len(storage.source_changes(SOURCE["id"])["snapshots"]) == 2


def test_snapshot_retention(client):
    for n in range(25):
        storage.record_source_check(SOURCE["id"], "ok", "checked", hashlib.sha256(str(n).encode()).hexdigest(),
                                    content=str(n), url=SOURCE["url"])
    with storage.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM source_snapshots").fetchone()[0] == 20


def test_retry_transient_failure_and_respect_long_backoff(monkeypatch):
    attempts = []
    async def no_sleep(_):
        pass
    monkeypatch.setattr(monitoring.asyncio, "sleep", no_sleep)

    def handler(request):
        attempts.append(request)
        return httpx.Response(503 if len(attempts) < 3 else 200, text="response")

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            assert (await monitoring.request_with_retry(client, "GET", "https://official.example/")).status_code == 200
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda _: httpx.Response(429, headers={"Retry-After": "120"}))) as client:
            assert (await monitoring.request_with_retry(client, "GET", "https://official.example/")).status_code == 429
    asyncio.run(run())
    assert len(attempts) == 3


def test_response_size_is_bounded(monkeypatch):
    monkeypatch.setattr(monitoring, "MAX_RESPONSE_BYTES", 100)
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda _: httpx.Response(200, content=b"x" * 101))) as client:
            with pytest.raises(ValueError, match="collection limit"):
                await monitoring.request_with_retry(client, "GET", "https://official.example/")
    asyncio.run(run())


def test_simpler_nested_summary_and_common_grants_id():
    def handler(request):
        assert request.headers["X-API-Key"] == "test-key"
        return httpx.Response(200, json={"data": [{
            "opportunity_id": "example-uuid", "legacy_opportunity_id": 12345,
            "opportunity_title": "Medical research", "opportunity_status": "posted",
            "summary": {"close_date": "2027-01-14", "summary_description": "<p>Research in medicine.</p>"}}]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await connectors.fetch_simpler_grants(client, "medicine", "test-key")
    result = asyncio.run(run())[0]
    assert result["id"] == "grantsgov:12345"
    assert result["deadline"] == "2027-01-14"
    assert result["description"] == "Research in medicine."
    assert result["status"] == "open"


def test_malformed_api_response_is_not_empty_success():
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"message": "Schema changed"}))) as client:
            with pytest.raises(ValueError, match="opportunity list"):
                await connectors.fetch_grants_gov(client, "medicine")
    asyncio.run(run())


def test_sync_distinguishes_empty_partial_and_failure(client, monkeypatch):
    monkeypatch.delenv("SIMPLER_GRANTS_API_KEY", raising=False)
    async def fetch(_, term):
        if term == "fail":
            raise ValueError("unavailable")
        return []
    monkeypatch.setattr(connectors, "fetch_grants_gov", fetch)
    before = len(storage.get_opportunities())
    for queries, expected in [(["empty"], "ok"), (["empty", "fail"], "partial"), (["fail"], "error")]:
        response = client.post("/api/sync/federal", json={"queries": queries}).json()
        assert response["status"] == expected
        assert response["imported"] == 0
    assert len(storage.get_opportunities()) == before
    assert client.post("/api/sync/federal", json={"queries": ["   "]}).status_code == 422
    assert client.post("/api/sync/federal", json={"queries": ["x" * 101]}).status_code == 422


def test_candidate_triage_is_persistent_and_never_publishes(client):
    candidate = {"title": "Possible research grant", "url": "https://www.amazon.science/new-call"}
    storage.upsert_candidate_links(SOURCE["id"], [candidate])
    candidate_id = client.get("/api/candidates").json()[0]["id"]
    before = len(storage.get_opportunities())
    assert client.patch(f"/api/candidates/{candidate_id}", json={"status": "verified"}).status_code == 422
    assert client.patch(f"/api/candidates/{candidate_id}", json={"status": "shortlisted"}).status_code == 200
    storage.upsert_candidate_links(SOURCE["id"], [candidate])
    assert client.get("/api/candidates").json() == []
    result = client.get("/api/candidates?status=shortlisted").json()
    assert result[0]["reviewed_at"]
    assert result[0]["status"] == "shortlisted"
    assert len(storage.get_opportunities()) == before
    with storage.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM candidate_reviews").fetchone()[0] == 1


def test_jobs_report_collection_errors(client, monkeypatch, capsys):
    async def sync(_):
        return {"errors": ["Network unavailable"]}
    async def monitor():
        return [{"status": "skipped"}]
    monkeypatch.setattr(connectors, "sync_federal", sync)
    monkeypatch.setattr(connectors, "check_industry_sources", monitor)
    args = SimpleNamespace(federal=True, monitor=True, queries="AI")
    assert asyncio.run(jobs.run(args)) == 1


def test_existing_database_migrates_without_losing_checks(tmp_path, monkeypatch):
    path = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE source_checks (source_id TEXT PRIMARY KEY, checked_at TEXT, status TEXT, "
                   "content_hash TEXT, message TEXT, last_changed_at TEXT)")
        db.execute("INSERT INTO source_checks(source_id,status,content_hash) VALUES('old','ok','previous-hash')")
    monkeypatch.setattr(storage, "DB_PATH", path)
    storage.init_db()
    storage.init_db()
    row = storage.get_source_checks()["old"]
    assert row["content_hash"] == "previous-hash"
    assert row["review_needed"] == 0


def test_csv_does_not_execute_imported_formulas(client):
    record = {**storage.get_opportunities()[0], "id": "test:formula", "title": '=HYPERLINK("https://example.org")'}
    with storage.connect() as db:
        storage.insert_opportunity(db, record)
    assert "'=HYPERLINK" in client.get("/api/export.csv").text


def test_overview_handles_open_api_opportunity_without_deadline(client):
    record = {**storage.get_opportunities()[0], "id": "test:no-deadline", "status": "open", "deadline": None}
    with storage.connect() as db:
        storage.insert_opportunity(db, record)
    response = client.get("/api/overview")
    assert response.status_code == 200
    assert isinstance(response.json()["closing_soon"], int)
