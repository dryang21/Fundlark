import asyncio

import httpx

from scripts.refresh_public_catalog import collect, merge


def test_refresh_paginates_official_results_and_preserves_editorial_records():
    offsets = []

    def handler(request):
        import json

        start = json.loads(request.content)["startRecordNum"]
        offsets.append(start)
        return httpx.Response(200, json={"data": {"hitCount": 2, "oppHits": [
            {"id": start + 1, "title": f"Grant {start + 1}", "oppStatus": "posted"},
        ]}})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await collect(client, ["robotics"], pages=3, size=1)

    candidates, failures, capped = asyncio.run(run())
    assert offsets == [0, 1]
    assert not failures and not capped

    curated = {"id": "grantsgov:1", "origin": "curated", "title": "Editorial title"}
    existing = {"id": "grantsgov:2", "origin": "grantsgov_api", "title": "Old title",
                "eligibility": "Manually verified applicant rules", "deadline": "2027-02-01"}
    original = {"opportunities": [curated, existing]}
    proposed, counts = merge(original, candidates, "now")
    assert counts == {"protected": 1, "updated": 1}
    assert proposed["opportunities"][0] == curated
    revised = proposed["opportunities"][1]
    assert revised["title"] == "Grant 2"
    assert revised["eligibility"] == existing["eligibility"]
    assert revised["deadline"] == existing["deadline"]
    assert revised["review_needed"] is True
    assert original["opportunities"][1]["title"] == "Old title"
