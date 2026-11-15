import test from 'node:test';
import assert from 'node:assert/strict';
import {plausibleProfileLead, selectRecords, normalizeProfile, applicationPath} from '../docs/demo/matching.mjs';
import {evaluateEligibility} from '../docs/demo/eligibility.mjs';

const base={status:'rolling',title:'Grant for artificial intelligence',topics:['artificial intelligence']};
const resident=normalizeProfile({topics:['artificial intelligence'],stage:'resident',appointment:'clinical_resident',institutions:['Stanford University'],societies:['AAPM']});

test('profile view removes known ineligible stages, while preserving faculty-collaborative routes',()=>{
  const eligible={...base,id:'resident',title:'Resident grant on artificial intelligence',eligible_stages:['resident']};
  const faculty={...base,id:'faculty-only',eligible_stages:['faculty']};
  const collaborative={...faculty,id:'partner',eligibility_rules:{application_route:'partner',faculty_lead_required:true}};
  assert.deepEqual(selectRecords([faculty,eligible,collaborative],resident,{matchedOnly:true,recommendedOnly:true}).map(x=>x.id).sort(),['partner','resident']);
  assert.equal(applicationPath(faculty,resident).kind,'ineligible');
  assert.equal(applicationPath(collaborative,resident).kind,'partner');
});

test('generic field sharing is browseable, but does not masquerade as a CV match',()=>{
  const profile=normalizeProfile({topics:['artificial intelligence safety'],stage:'resident'});
  const onlyField={id:'generic',status:'rolling',title:'Generic computing grant',field_ids:['computing'],topics:['computer science']};
  const explicitRoute={...onlyField,id:'listed',eligible_stages:['resident']};
  const explicitSponsor={...onlyField,id:'faculty',eligibility_rules:{application_route:'partner'}};
  const results=selectRecords([onlyField,explicitRoute,explicitSponsor],profile,{matchedOnly:true,recommendedOnly:true});
  assert.ok(!results.some(x=>x.id==='generic'));
  assert.ok(results.some(x=>x.id==='listed'));
  assert.ok(results.some(x=>x.id==='faculty'));
  assert.equal(selectRecords([onlyField],profile).length,1);
});

test('known unmet research-time and PI restrictions remain inspectable, but are marked likely ineligible',()=>{
  const p=normalizeProfile({...resident,researchEffortPercent:20,piPrivileges:false});
  const time={...base,id:'time',eligible_stages:['resident'],eligibility_rules:{application_route:'direct',minimum_research_effort_percent:50}};
  const pi={...base,id:'pi',eligible_stages:['resident'],eligibility_rules:{application_route:'direct',pi_privileges_required:true}};
  assert.ok(plausibleProfileLead(time,p));
  assert.ok(plausibleProfileLead(pi,p));
  assert.equal(evaluateEligibility({...time,last_verified_at:'2026-11-14'},p,{today:'2026-11-14'}).kind,'ineligible');
  assert.equal(evaluateEligibility({...pi,last_verified_at:'2026-11-14'},p,{today:'2026-11-14'}).kind,'ineligible');
});

test('cross-disciplinary humanities, education, and engineering still have stage-relevant matches',()=>{
  const cases=[
    ['archaeology and cultural heritage','humanities','postdoc'],
    ['teacher education and curriculum','education','phd'],
    ['battery systems and electrical engineering','engineering','postdoc'],
  ];
  for(const [term,field,stage] of cases){
    const p=normalizeProfile({topics:[term],stage});
    const relevant={title:'Interdisciplinary funding',id:field,status:'rolling',field_ids:[field],eligible_stages:[stage]};
    const unrelated={title:'Another field',id:'other-'+field,status:'rolling',field_ids:['medicine']};
    assert.deepEqual(selectRecords([relevant,unrelated],p,{matchedOnly:true,recommendedOnly:true}).map(x=>x.id),[field]);
  }
});

test('a topic with no career-stage evidence is not a verified direct application',()=>{
  const p=normalizeProfile({topics:['artificial intelligence'],stage:'resident'});
  const record={...base};
  assert.equal(applicationPath(record,p).kind,'check');
  assert.ok(plausibleProfileLead(record,p));
});
