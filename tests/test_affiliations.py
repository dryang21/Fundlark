from app import profiles, connectors, storage, publish


def test_membership_is_not_inferred_from_publications():
    result = profiles.extract_affiliations("Publications\nIEEE Transactions on Medical Imaging, 2025\nPresented at ASTRO 2024")
    assert all(x["relationship"] == "mention_only" for x in result["societies"])


def test_explicit_and_former_memberships():
    result = profiles.extract_affiliations("Professional Memberships\nMember, AAPM\nIEEE Senior Member\nFormer member of ASTRO")
    found = {x["name"]: x for x in result["societies"]}
    assert found["AAPM"]["relationship"] == "membership_evidence"
    assert found["IEEE"]["relationship"] == "membership_evidence"
    assert found["ASTRO"]["relationship"] == "former_membership"
    assert all(x["needs_confirmation"] for x in found.values())


def test_membership_extraction_extends_beyond_medical_starter_list():
    result=profiles.extract_affiliations('Professional Memberships\nMember, American Chemical Society, 2022\nSociety for Industrial and Applied Mathematics, member\nPublications\nAmerican Economic Association proceedings')
    names={s['name'] for s in result['societies']}
    assert 'American Chemical Society' in names
    assert 'Society for Industrial and Applied Mathematics' in names
    assert not any('Economic' in name for name in names)


def test_education_and_current_appointments_are_distinct():
    result = profiles.extract_affiliations("Education\nStanford University, PhD 2020\nAppointments\nHarvard University, Postdoctoral Fellow, 2024–present")
    found = {x["name"]: x["relationship"] for x in result["institutions"]}
    assert found["Stanford University"] == "education_history"
    assert found["Harvard University"] == "current_affiliation_evidence"
    assert profiles.extract_affiliations("Current research with Stanford collaborators")["institutions"][0]["relationship"] == "affiliation_mentioned"


def test_affiliation_sources_do_not_assert_eligibility(client):
    data = client.post('/api/profile/sources',json={"keywords":["medical physics"],"societies":["AAPM"],"institutions":["Stanford University"]}).json()
    ids = {x["id"] for x in data["sources"]}
    assert {'aapm-funding','astro-funding','stanford-seed','varian-research','elekta-research'} <= ids
    assert all(s["eligibility"] == "not_established" for s in data["sources"])
    assert "stanford-seed" not in {s["id"] for s in profiles.recommend_sources(connectors.SOURCES,["medical physics"])["sources"]}


def test_unlisted_institution_has_discovery_route():
    data = profiles.recommend_sources(connectors.SOURCES,[],[],["University of Toronto"])
    assert 'University of Toronto' in data['institution_discovery'][0]['query']


def test_societies_outside_registry_have_discovery_routes():
    data = profiles.recommend_sources(connectors.SOURCES, [], ["RSNA"], [])
    assert 'RSNA' in data['society_discovery'][0]['query']


def test_cv_api_returns_reviewable_affiliations_without_publishing(client):
    response = client.post('/api/profile/extract',files={"file":("cv.txt",b"Professional Memberships\nAAPM member\nAppointments\nStanford University, Postdoctoral Fellow, 2024-present PRIVATE_CV_ONLY_48291",'text/plain')})
    assert response.status_code == 200
    assert response.json()['affiliations']['institutions'][0]['needs_confirmation']
    assert 'PRIVATE_CV_ONLY_48291' not in __import__('json').dumps(publish.public_snapshot())
