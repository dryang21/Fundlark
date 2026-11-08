from app import connectors, matching, storage


def test_app_boot_and_catalog(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"]
    catalog = client.get("/api/opportunities").json()
    assert len(catalog) >= 7
    amazon = next(o for o in catalog if o["id"] == "curated:amazon-agentic-2026")
    assert amazon["url"].startswith("https://")
    assert amazon["origin"] == "curated"
    assert amazon["deadline"] == "2026-11-11"


def test_matching_eligibility_and_keyword_score(client):
    payload = {"keywords": ["AI agents", "radiotherapy"], "career_stage": "resident", "query": ""}
    response = client.post("/api/match", json=payload)
    assert response.status_code == 200
    out = response.json()
    assert out[0]["match_score"] is not None
    amazon = next(o for o in out if o["id"] == "curated:amazon-agentic-2026")
    assert amazon["eligibility_assessment"] == "sponsor"
    assert amazon["match_score"] > 10
    openai = next(o for o in out if o["id"] == "curated:openai-researcher-access")
    assert openai["eligibility_assessment"] == "possible"


def test_keyword_extraction_filters_contact_details():
    text = """John Example, john@example.org, (202) 555-0101.
        PhD in medical physics. Radiotherapy treatment planning, reinforcement learning,
        and AI agents for radiation therapy. Research in medical physics and radiotherapy."""
    kws = matching.extract_keywords(text)
    assert "medical physics" in kws
    assert "radiotherapy" in kws
    assert "example.org" not in kws


def test_cv_upload_txt(client):
    response = client.post("/api/profile/extract", files={"file": ("resume.txt", b"I study AI agents in medical physics and radiation therapy.", "text/plain")})
    assert response.status_code == 200
    assert "medical physics" in response.json()["keywords"]
    assert "discarded" in response.json()["privacy"]


def test_cv_bad_extension_and_size(client):
    r = client.post("/api/profile/extract", files={"file": ("resume.exe", b"test", "application/octet-stream")})
    assert r.status_code == 415
    r = client.post("/api/profile/extract", files={"file": ("resume.txt", b"x" * (8 * 1024 * 1024 + 1), "text/plain")})
    assert r.status_code == 413


def test_grants_gov_adapter():
    out = connectors.normalize_grants_gov({"id": "12345", "title": "Medical AI Research",
        "agencyName": "National Institutes of Health", "closeDate": "12/14/2026", "oppStatus": "posted", "number": "R01-123"})
    assert out["deadline"] == "2026-12-14"
    assert out["status"] == "open"
    assert out["id"] == "grantsgov:12345"
    assert out["url"].startswith("https://www.grants.gov/")


def test_source_list_and_csv(client):
    sources = client.get("/api/sources").json()
    assert any(x["id"] == "amazon-science" for x in sources)
    assert any(x["mode"] == "api" for x in sources)
    csv = client.get("/api/export.csv")
    assert csv.status_code == 200
    assert "Amazon Research Awards" in csv.text


def test_federal_sync_with_mock(client, monkeypatch):
    async def mocked(*args, **kwargs):
        return [{"id":"grantsgov:123", "title":"New Medical AI Funding", "funder":"NIH", "category":"Government",
                 "funding_type":"Grant", "status":"open", "description":"AI in medicine", "topics":["AI"],
                 "eligibility":"Check official listing", "eligible_stages":[], "url":"https://www.grants.gov/search-results-detail/123"}]
    monkeypatch.setattr(connectors,"fetch_grants_gov",mocked)
    resp=client.post('/api/sync/federal',json={"queries":["medical AI"]})
    assert resp.status_code==200
    assert resp.json()["imported"] == 1
    assert any(x["id"]=="grantsgov:123" for x in client.get('/api/opportunities').json())


def test_unsupported_profile_size(client):
    assert client.post('/api/match',json={"keywords":["A"]*31}).status_code==422


def test_candidate_link_extraction_only_same_official_domain():
    from bs4 import BeautifulSoup
    html = '''<html><body>
      <a href="/science/grants/new-call">New Research Grant Call</a>
      <a href="https://bad.example.org/steal">Research Funding</a>
      <a href="/policy">Privacy policy</a>
    </body></html>'''
    links = connectors.extract_candidate_links(BeautifulSoup(html, "html.parser"), "https://official.example.org/science/grants")
    assert len(links) == 1
    assert links[0]["url"] == "https://official.example.org/science/grants/new-call"


def test_candidate_links_unreviewed(client):
    storage.upsert_candidate_links("wellcome",[{"title":"New Early-Career Grant Call", "url":"https://wellcome.org/funding/new"}])
    result=client.get('/api/candidates')
    assert result.status_code == 200
    assert result.json()[0]["status"] == "unreviewed"
    assert result.json()[0]["url"].startswith("https://wellcome.org")
