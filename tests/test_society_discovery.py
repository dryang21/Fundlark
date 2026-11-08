from app import storage


def test_saved_membership_has_discoverable_programs_and_affiliation_rank(client):
    result = client.post('/api/match',json={'keywords':[],'societies':['AAPM'],'career_stage':'postdoc'}).json()
    society = [r for r in result if r['category']=='Society']
    assert len(society) >= 4
    seed = next(r for r in society if r['id']=='curated:aapm-seed-2027')
    assert seed['affiliation_matches'] == ['AAPM']
    assert seed['ranking_score'] > 0
    assert seed['match_score'] is None  # Affiliation is not a research-match probability.
    assert seed['status'] == 'verify'
    assert seed['deadline'] == '2027-03-22'  # Mandatory LOI, not the later full proposal.
    assert seed['eligibility_assessment'] == 'check'
    no_membership = client.post('/api/match',json={'keywords':[]}).json()
    unpersonalized = next(r for r in no_membership if r['id']==seed['id'])
    assert unpersonalized['affiliation_matches'] == []
    assert seed['ranking_score'] > unpersonalized['ranking_score']


def test_closed_astro_call_is_not_promoted_by_membership(client):
    result = client.post('/api/match',json={'societies':['ASTRO'],'career_stage':'resident'}).json()
    joint = next(r for r in result if r['id']=='curated:astro-aapm-seed')
    assert joint['status'] == 'closed'
    assert joint['affiliation_matches'] == ['ASTRO']
    assert 'closed' in joint['eligibility_reason']


def test_institution_program_and_affiliation_metadata_persist(client):
    result = client.post('/api/match',json={'institutions':['Stanford University']}).json()
    record = next(r for r in result if r['id']=='curated:stanford-biox-seed')
    assert record['category'] == 'Institution'
    assert record['affiliation_matches'] == ['Stanford University']
    stored = next(r for r in storage.get_opportunities() if r['id']==record['id'])
    assert stored['affiliation_tags']['institution']=='Stanford University'


def test_sigma_xi_profile_does_not_establish_student_eligibility(client):
    result=client.post('/api/match',json={'societies':['Sigma Xi'],'career_stage':'postdoc'}).json()
    giar=next(r for r in result if r['id']=='curated:sigma-xi-giar')
    assert giar['affiliation_matches']==['Sigma Xi']
    assert giar['eligibility_assessment']=='unlikely'
    assert 'Membership is not required' in giar['eligibility']
