import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateEligibility} from '../docs/demo/eligibility.mjs';
import {exploreFunding,filterDashboard} from '../docs/demo/workspace.mjs';

const today='2026-11-14';
const base={id:'society-grant',title:'Radiotherapy research for medical physics residents',category:'Society',
  funder:'Example Medical Physics Society',topics:['medical physics'],status:'open',
  eligible_stages:['resident'],last_verified_at:'2026-11-14',review_needed:false,
  eligibility_rules:{application_route:'direct',membership_required:['AAPM'],minimum_research_effort_percent:50}};
const profile={stage:'resident',topics:['medical physics'],societies:['AAPM'],researchEffortPercent:50};
const assess=(r,p)=>evaluateEligibility(r,p,{today});

test('known structured direct-applicant conditions that all match yield a qualified likely label',()=>{
  const result=assess(base,profile);
  assert.equal(result.kind,'likely');
  assert.equal(result.label,'Likely eligible');
  assert.equal(result.unknownCount,0);
  assert.ok(result.checks.some(c=>c.code==='stage'&&c.state==='pass'));
  assert.ok(result.checks.some(c=>c.code==='research-effort'&&c.state==='pass'));
  assert.match(result.note,/not a determination/);
});
test('missing membership and unknown protected time never become ineligible solely from absence',()=>{
  const result=assess(base,{stage:'resident',topics:['medical physics']});
  assert.equal(result.kind,'verify');
  assert.ok(result.checks.some(c=>c.code==='society'&&c.state==='unknown'));
  assert.ok(result.checks.some(c=>c.code==='research-effort'&&c.state==='unknown'));
  assert.equal(result.failCount,0);
});
test('a confirmed protected-time mismatch is a specific failing condition',()=>{
  const result=assess(base,{...profile,researchEffortPercent:20});
  assert.equal(result.kind,'ineligible');
  assert.match(result.checks.find(c=>c.code==='research-effort').text,/20%/);
});
test('PhD and undergraduate applicants are not erroneously asked for years since PhD',()=>{
  const student={...base,eligible_stages:['undergrad','masters','phd'],eligibility_rules:{application_route:'direct',membership_required:['AAPM']}};
  for(const stage of ['undergrad','masters','phd']){
    const result=assess(student,{stage,societies:['AAPM']});
    assert.equal(result.kind,'likely');
    assert.ok(!result.checks.some(c=>c.code==='phd-age'));
  }
});
test('career stage mismatch is a known conflict, except when a partner route is possible',()=>{
  const faculty={...base,eligible_stages:['faculty'],eligibility_rules:{application_route:'direct'}};
  assert.equal(assess(faculty,profile).kind,'ineligible');
  const partner={...faculty,faculty_sponsor_possible:true,eligibility_rules:{application_route:'partner',faculty_lead_required:true}};
  const result=assess(partner,profile);
  assert.equal(result.kind,'verify');
  assert.ok(result.checks.some(c=>c.code==='faculty-lead'));
});
test('partner pathways do not wrongly treat lead-applicant citizenship or host rules as trainee blockers',()=>{
  const call={...base,eligible_stages:['faculty'],faculty_sponsor_possible:true,
    eligibility_rules:{application_route:'partner',faculty_lead_required:true,
      citizenship_required:['us_citizen'],host_regions:['United States'],
      eligible_appointments:['faculty']}};
  const r=assess(call,{stage:'resident',appointment:'clinical_resident',citizenship:'other',researchRegion:'Canada'});
  assert.equal(r.kind,'verify');
  assert.equal(r.failCount,0);
  assert.ok(r.checks.some(c=>c.code==='faculty-lead'&&c.state==='unknown'));
});
test('citizenship and PI privileges require explicit user evidence, not guesses',()=>{
  const call={...base,eligible_stages:['faculty'],eligibility_rules:{application_route:'direct',citizenship_required:['us_citizen','us_permanent_resident'],pi_privileges_required:true}};
  assert.equal(assess(call,{stage:'faculty'}).kind,'verify');
  assert.equal(assess(call,{stage:'faculty',citizenship:'other',piPrivileges:true}).kind,'ineligible');
  assert.equal(assess(call,{stage:'faculty',citizenship:'us_permanent_resident',piPrivileges:true}).kind,'likely');
});
test('a mentor requirement is stage-aware and can be confirmed explicitly',()=>{
  const call={...base,eligibility_rules:{application_route:'direct',mentor_required:true}};
  assert.equal(assess(call,{stage:'resident'}).kind,'verify');
  const ready=assess(call,{stage:'resident',mentorConfirmed:true});
  assert.equal(ready.kind,'likely');
  assert.ok(ready.checks.some(c=>c.code==='mentor'&&c.state==='pass'));
  const notReady=assess(call,{stage:'resident',mentorConfirmed:false});
  assert.equal(notReady.kind,'verify');
  assert.ok(notReady.checks.some(item=>item.code==='mentor'&&item.state==='unknown'));
});
test('host institution and region restrictions do not silently pass on keyword relevance',()=>{
  const record={...base,category:'Institution',eligibility_rules:{application_route:'direct',institution_required:['Stanford University'],host_regions:['United States']}};
  assert.equal(assess(record,{...profile,institutions:['Example University'],researchRegion:'Germany'}).kind,'ineligible');
  assert.equal(assess(record,{...profile,institutions:['Stanford University'],researchRegion:'United States'}).kind,'likely');
});
test('the Adobe India host rule excludes US-based recommendations without removing the public listing',()=>{
  const read=name=>JSON.parse(readFileSync(new URL(`../docs/demo/${name}`,import.meta.url),'utf8')).opportunities;
  const catalog=[...read('data.json'),...read('global-programs.json')];
  const adobe=catalog.filter(record=>/Adobe.*India AI Research Fellowship/i.test(record.title));
  assert.equal(adobe.length,1);
  const id=adobe[0].id;
  const us={stage:'phd',topics:['artificial intelligence'],researchRegion:'United States'};
  assert.ok(assess(adobe[0],us).checks.some(c=>c.code==='region'&&c.state==='fail'));
  assert.deepEqual(filterDashboard(adobe,us),[]);
  assert.equal(filterDashboard(adobe,us,{eligibility:'ineligible'})[0]?.id,id);
  assert.equal(filterDashboard(adobe,{...us,researchRegion:'India'})[0]?.id,id);
  assert.equal(filterDashboard(adobe,{...us,researchRegion:'Other'})[0]?.id,id);
  assert.equal(exploreFunding(adobe,{description:'Adobe India AI Research Fellowship'})[0]?.id,id);
  const international={...adobe[0],country_or_region:'India',eligibility_rules:{application_route:'direct'}};
  assert.equal(filterDashboard([international],us)[0]?.id,id);
});
test('incomplete, closed, old and unreviewed records cannot get a likely label',()=>{
  const tooSparse={...base,eligibility_rules:undefined};
  assert.equal(assess(tooSparse,profile).kind,'verify');
  assert.equal(assess({...base,status:'closed'},profile).kind,'verify');
  assert.equal(assess({...base,last_verified_at:'2025-01-01'},profile).kind,'verify');
  assert.equal(assess({...base,review_needed:true},profile).kind,'verify');
});
test('eligibility filter preserves every match when set to all and narrows to the requested assessment',()=>{
  const records=[
    base,
    {...base,id:'conflict',title:'Second medical physics grant',eligibility_rules:{...base.eligibility_rules,minimum_research_effort_percent:90}},
    {...base,id:'unknown',title:'Third medical physics grant',eligibility_rules:undefined},
  ];
  const all=filterDashboard(records,profile,{availability:'active',eligibility:'all'});
  const likely=filterDashboard(records,profile,{availability:'active',eligibility:'likely'});
  const verify=filterDashboard(records,profile,{availability:'active',eligibility:'verify'});
  const ineligible=filterDashboard(records,profile,{availability:'active',eligibility:'ineligible'});
  assert.equal(all.length,3);
  assert.deepEqual(likely.map(x=>x.id),['society-grant']);
  assert.deepEqual(verify.map(x=>x.id),['unknown']);
  assert.deepEqual(ineligible.map(x=>x.id),['conflict']);
});
