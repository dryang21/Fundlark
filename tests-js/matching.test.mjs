import test from 'node:test';
import assert from 'node:assert/strict';
import {match, normalizeProfile, assistantPrompt, mergeCatalog} from '../docs/demo/matching.mjs';

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
  assert.deepEqual(normalizeProfile({topics:'private CV',institutions:[null,4,'Stanford University'],stage:'CEO',sharePublic:'true'}),{topics:[],institutions:['Stanford University'],societies:[],stage:'',sharePublic:false});
});
test('AI does not match an unrelated word such as aid',()=>{
  const profile=normalizeProfile({topics:['AI']});
  assert.equal(match({title:'Research aid',description:'Student aid',topics:[]},profile).score,0);
  assert.equal(match({title:'Artificial intelligence research',topics:[]},profile).score,10);
});
test('assistant contribution authorization requires both consent and a service',()=>{
  const enabled=normalizeProfile({topics:['chemistry'],sharePublic:true});
  assert.match(assistantPrompt(enabled,'https://fundlark.example'),/I authorize contributing/);
  assert.doesNotMatch(assistantPrompt(enabled),/I authorize contributing/);
  assert.match(assistantPrompt(normalizeProfile(), 'https://fundlark.example'),/Do not submit/);
});
test('reviewed overlay replaces same round but retains different annual rounds',()=>{
  const update={...record,id:'community:1',url:record.url+'?utm_source=test',round:'2027',description:'Updated rules'};
  const later={...record,id:'later',deadline:'2028-03-01'};
  const merged=mergeCatalog([record,later],[update]);
  assert.equal(merged.length,2);assert.equal(merged[0].description,'Updated rules');
  assert.equal(mergeCatalog([record],[{...record,id:'different',title:'Another program on the same directory'}]).length,2);
});
