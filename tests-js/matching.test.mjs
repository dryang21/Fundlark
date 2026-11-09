import test from 'node:test';
import assert from 'node:assert/strict';
import {match, normalizeProfile, assistantPrompt, mergeCatalog, researchTerms, selectRecords, discoveryLinks, shortlistText, opportunityKey, publicRecordSnapshot, restoreShortlist, freshness} from '../docs/demo/matching.mjs';

const record = {id:'rsc',title:'Chemistry seed grant',description:'Molecular chemistry research',topics:['chemistry'],url:'https://example.org/award',deadline:'2027-03-01',affiliation_tags:{societies:['Royal Society of Chemistry']},eligible_stages:['phd']};
test('non-medical profiles and custom societies rank with distinct stage guidance',()=>{
  const profile=normalizeProfile({topics:['chemistry'],societies:['Royal Society of Chemistry'],stage:'postdoc'});
  const result=match(record,profile);
  assert.deepEqual(result.hits,['chemistry']);assert.deepEqual(result.affiliations,['Royal Society of Chemistry']);
  assert.equal(result.score,25);assert.match(result.stage,/may not qualify/);
  assert.equal(match(record,normalizeProfile()).score,0);
});
test('browser profile handles corrupt storage shapes and bounds fields',()=>{
  assert.equal(normalizeProfile(null).sharePublic,false);
  assert.deepEqual(normalizeProfile({topics:'private CV',institutions:[null,4,'Stanford University'],stage:'CEO',sharePublic:'true'}),{topics:[],institutions:['Stanford University'],societies:[],researchText:'',stage:'',sharePublic:false});
});
test('AI does not match an unrelated word such as aid',()=>{
  const profile=normalizeProfile({topics:['AI']});
  assert.equal(match({title:'Research aid',description:'Student aid',topics:[]},profile).score,0);
  assert.equal(match({title:'Artificial intelligence research',topics:[]},profile).score,10);
});
test('assistant contribution authorization requires both consent and a service',()=>{
  const enabled=normalizeProfile({topics:['chemistry'],sharePublic:true});
  assert.match(assistantPrompt(enabled,'https://fundlark.example',{skillMode:true}),/I authorize contributing/);
  assert.doesNotMatch(assistantPrompt(enabled,'https://fundlark.example'),/I authorize contributing/);
  assert.match(assistantPrompt(enabled),/no Fundlark skill installation is required/);
  assert.doesNotMatch(assistantPrompt(enabled,'https://fundlark.example'),/\/api\/contributions/);
  assert.doesNotMatch(assistantPrompt(enabled),/I authorize contributing/);
  assert.match(assistantPrompt(normalizeProfile(), 'https://fundlark.example'),/Do not submit/);
});
test('ordinary sentences and commas produce usable research terms',()=>{
  assert.deepEqual(researchTerms('My lab studies artificial intelligence'),['artificial intelligence']);
  assert.deepEqual(researchTerms('medical physics, radiotherapy'),['medical physics','radiotherapy']);
  const terms=researchTerms('I study climate adaptation in coastal communities');
  assert.ok(terms.includes('climate'));assert.ok(terms.includes('coastal'));assert.ok(!terms.includes('study'));
  assert.equal(match({title:'Artificial intelligence research',topics:[]},normalizeProfile({topics:researchTerms('My lab studies artificial intelligence')})).score,10);
});
test('past rounds are opt-in and remain behind current calls in all-programs view',()=>{
  const profile=normalizeProfile({topics:['chemistry']});
  const closed={...record,id:'past',deadline:'2020-01-01',status:'open'};
  const current={...record,id:'current',deadline:null,status:'verify'};
  assert.deepEqual(selectRecords([closed,current],profile).map(x=>x.id),['current']);
  assert.deepEqual(selectRecords([closed,current],profile,{availability:'all'}).map(x=>x.id),['current','past']);
  assert.equal(selectRecords([current],profile,{availability:'open'}).length,0);
  const open={...current,id:'open',status:'open'};
  assert.deepEqual(selectRecords([current,open],profile).map(x=>x.id),['open','current']);
});
test('custom affiliations receive honest search routes without pretending to be official links',()=>{
  const profile=normalizeProfile({topics:['ecology'],societies:['Ecological Society of America'],institutions:['University of Bristol']});
  const routes=discoveryLinks(profile);
  assert.equal(routes.length,3);assert.match(routes[0].label,/Search/);
  assert.match(decodeURIComponent(routes[0].url),/Ecological Society of America/);
  const official=discoveryLinks(profile,[{society:'Ecological Society of America',url:'https://example.org/funding'}]);
  assert.equal(official[0].url,'https://example.org/funding');
});
test('exported shortlist contains public application facts and official links',()=>{
  const text=shortlistText([{...record,amount:'$10,000',status:'verify',deadline:null}]);
  assert.match(text,/\$10,000/);assert.match(text,/Application window unconfirmed/);assert.match(text,/https:\/\/example.org\/award/);
});
test('saved snapshots survive catalog removal and make updates explicit',()=>{
  const snapshot=publicRecordSnapshot({...record,cv:'PRIVATE_CV',matching:{hits:['private profile']}});
  assert.equal(snapshot.cv,undefined);assert.equal(snapshot.matching,undefined);
  const entries=[{key:opportunityKey(record),record:snapshot}];
  const missing=restoreShortlist([],entries);
  assert.equal(missing.length,1);assert.equal(missing[0].archived,true);
  assert.match(shortlistText(missing),/no longer in the current catalog/);
  const changed=restoreShortlist([{...record,eligibility:'Updated public rules'}],entries);
  assert.equal(changed[0].archived,false);assert.equal(changed[0].detailsChanged,true);
});
test('record age and source changes remain visible without claiming an open call',()=>{
  assert.match(freshness({review_needed:true}),/Source changed/);
  assert.match(freshness({last_verified_at:'2020-01-01'},Date.parse('2026-11-08')),/Over 30 days/);
  assert.match(freshness({}),/unknown/);
  assert.equal(freshness({last_verified_at:'2026-11-08'},Date.parse('2026-11-08')), '');
});
test('reviewed overlay replaces same round but retains different annual rounds',()=>{
  const update={...record,id:'community:1',url:record.url+'?utm_source=test',round:'2027',description:'Updated rules'};
  const later={...record,id:'later',deadline:'2028-03-01'};
  const merged=mergeCatalog([record,later],[update]);
  assert.equal(merged.length,2);assert.equal(merged[0].description,'Updated rules');
  assert.equal(mergeCatalog([record],[{...record,id:'different',title:'Another program on the same directory'}]).length,2);
});
