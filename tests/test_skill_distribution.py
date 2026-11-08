import importlib.util
import io
import json
import zipfile
from pathlib import Path
from urllib.error import HTTPError, URLError

import pytest

from app import connectors, publish, storage

ROOT = Path(__file__).resolve().parents[1]


def load_script(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


federal = load_script("fundlark_federal_skill", "skills/fundlark/scripts/search_federal.py")
packaging = load_script("fundlark_skill_packaging", "scripts/package_skill.py")


def test_public_export_excludes_private_data_and_preserves_verification_dates(client, monkeypatch):
    records = storage.get_opportunities()
    records[0]["cv_text"] = "PRIVATE_CV_CANARY"
    monkeypatch.setattr(storage, "get_opportunities", lambda: records)
    monkeypatch.setattr(connectors, "SOURCES", [{**connectors.SOURCES[0], "api_key": "PRIVATE_KEY_CANARY"}])
    monkeypatch.setattr(storage, "get_source_checks", lambda: {"grants-gov": {
        "checked_at": "2026-11-08", "status": "ok", "message": "PRIVATE_NOTE_CANARY"}})
    result = publish.public_snapshot()
    serialized = json.dumps(result)
    for canary in ("PRIVATE_CV_CANARY", "PRIVATE_KEY_CANARY", "PRIVATE_NOTE_CANARY"):
        assert canary not in serialized
    assert result["opportunities"][0]["last_verified_at"] == records[0]["last_verified_at"]
    assert result["schema_version"] == 1
    assert "generated_at" in result
    assert "candidates" not in result


def test_public_export_writes_valid_snapshot(client, tmp_path):
    output = tmp_path / "public/data.json"
    assert publish.write_snapshot(output) == len(storage.get_opportunities())
    assert len(json.loads(output.read_text())["opportunities"]) >= 7
    assert not output.with_suffix(".json.tmp").exists()


class Opener:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def open(self, request, timeout):
        self.calls.append(request)
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return io.BytesIO(json.dumps(response).encode())


def test_federal_skill_preserves_api_fields_and_uses_only_public_keywords():
    opener = Opener([{"errorcode": 0, "data": {"oppHits": [
        {"id": "123", "title": "Research", "oppStatus": "forecasted", "closeDate": ""}]}}])
    data = federal.fetch_query("medical physics", opener=opener)
    assert data["oppHits"][0]["oppStatus"] == "forecasted"
    assert data["oppHits"][0]["closeDate"] == ""
    request = opener.calls[0]
    assert request.full_url == federal.ENDPOINT
    assert json.loads(request.data)["keyword"] == "medical physics"
    assert "Authorization" not in dict(request.header_items())


def test_federal_skill_retries_and_rejects_malformed_success():
    failure = HTTPError(federal.ENDPOINT, 503, "Unavailable", {}, None)
    opener = Opener([failure, {"data": {"oppHits": []}}])
    sleeps = []
    assert federal.fetch_query("research", opener=opener, sleep=sleeps.append)["oppHits"] == []
    assert len(sleeps) == 1
    with pytest.raises(ValueError, match="opportunity list"):
        federal.fetch_query("research", opener=Opener([{"message": "Schema changed"}]))
    with pytest.raises(ValueError, match="invalid opportunity"):
        federal.fetch_query("research", opener=Opener([{"data": {"oppHits": [{"id": "../../other", "title": "Invalid"}]}}]))


def test_federal_skill_does_not_retry_long_backoff():
    opener = Opener([HTTPError(federal.ENDPOINT, 429, "Rate limited", {"Retry-After": "120"}, None)])
    with pytest.raises(HTTPError):
        federal.fetch_query("research", opener=opener, sleep=lambda _: pytest.fail("Should not retry"))
    assert len(opener.calls) == 1


def test_federal_skill_reports_partial_results_and_deduplicates():
    def fetch(query, rows):
        if query == "offline":
            raise URLError("Network unavailable")
        return {"oppHits": [{"id": "123", "title": "Research", "oppStatus": "posted"}], "hitCount": 200}
    result = federal.search(["AI", "medicine", "offline"], fetch=fetch)
    assert result["status"] == "partial"
    assert len(result["opportunities"]) == 1
    assert result["opportunities"][0]["matched_queries"] == ["AI", "medicine"]
    assert result["opportunities"][0]["official_url"].endswith("/123")
    assert result["first_page_only"]
    assert result["coverage"][0]["total_hits"] == 200
    assert result["errors"]


def test_federal_skill_rejects_invalid_queries_and_bounds_responses(monkeypatch):
    with pytest.raises(ValueError):
        federal.search([" "], fetch=lambda *_: pytest.fail("Network should not be called"))
    with pytest.raises(ValueError):
        federal.search(["x" * 101])
    monkeypatch.setattr(federal, "MAX_BYTES", 3)
    with pytest.raises(ValueError, match="3 MB limit"):
        federal.fetch_query("research", opener=Opener([{"data": {"oppHits": []}}]))


def test_skill_archive_is_self_contained_and_excludes_application_data(tmp_path):
    output = packaging.package(tmp_path / "Fundlark-skill.zip")
    with zipfile.ZipFile(output) as archive:
        names = archive.namelist()
        assert "fundlark/SKILL.md" in names
        assert "fundlark/scripts/search_federal.py" in names
        assert "fundlark/references/official-sources.json" in names
        assert all(name.startswith("fundlark/") for name in names)
        assert not any("__pycache__" in name or ".sqlite3" in name or ".env" in name for name in names)
