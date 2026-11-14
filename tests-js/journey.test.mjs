import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cvSuggestions, examples, upcomingSaved} from '../docs/demo/journey.mjs';
import {normalizeProfile, researchTerms, selectRecords, discoveryLinks} from '../docs/demo/matching.mjs';

const cv=name=>readFileSync(new URL(`../evals/cvs/${name}.txt`,import.meta.url),'utf8');
const catalog=JSON.parse(readFileSync(new URL('../docs/demo/data.json',import.meta.url),'utf8'));
test('fictional CVs recover only explicitly labeled signals',()=>{
  for(const [name,stage,society,institution] of [
    ['computing-faculty','faculty','IEEE','Stanford University'],
    ['coastal-ecology','phd','Ecological Society of America','University of Bristol'],
    ['medical-physics','postdoc','AAPM','Stanford University'],
  ]){
    const result=cvSuggestions(cv(name));
    assert.equal(result.stage,stage);
    assert.deepEqual(result.societies,[society]);
    assert.deepEqual(result.institutions,[institution]);
    assert.ok(result.topics.length>=2);
  }
});
test('publication, education, contact and expired membership lines are not imported',()=>{
  assert.deepEqual(cvSuggestions('Education\nPhD, Stanford University\nPublications\nIEEE conference\nProfessional Memberships\nMember: ACM 2015–2020\nResearch interests\nperson@example.org'),{topics:[],societies:[],institutions:[],stage:''});
});
test('example journeys use the real snapshot and recover from limited coverage',()=>{
  const profile=normalizeProfile({...examples.computing,topics:researchTerms(examples.computing.researchText)});
  assert.ok(selectRecords(catalog.opportunities,profile,{matchedOnly:true}).length>0);
  const ecology=normalizeProfile({...examples.ecology,topics:researchTerms(examples.ecology.researchText)});
  assert.ok(discoveryLinks(ecology,catalog.sources).some(x=>x.url.startsWith('https://esa.org/')));
});
test('return view excludes past, unconfirmed and archived deadlines',()=>{
  const records=[
    {id:'next',status:'open',deadline:'2026-11-18'},
    {id:'later',status:'rolling',deadline:'2026-11-21'},
    {id:'old',status:'open',deadline:'2026-11-12'},
    {id:'uncertain',status:'verify',deadline:'2026-11-16'},
    {id:'archive',status:'open',deadline:'2026-11-16',archived:true},
    {id:'far',status:'open',deadline:'2027-01-01'}];
  assert.deepEqual(upcomingSaved(records,'2026-11-13').map(x=>x.id),['next','later']);
});

test('CVs with common academic layouts recover current appointments without guessing memberships',()=>{
  const sources=[{fields:['robotics']}];
  const dated=cvSuggestions('Education\nPhD, Past University\nAcademic Employment\n2025–present   Associate Professor ,   Example University , Robotics\nSelected Publications\nIEEE Symposium',sources);
  assert.equal(dated.stage,'faculty');assert.deepEqual(dated.topics,['robotics']);
  assert.deepEqual(dated.institutions,['Example University']);assert.deepEqual(dated.societies,[]);
  const heading=cvSuggestions('Current Appointment\nProfessor, Example University (2008-present)\nResearch Interests\nCoastal ecology\nEducation\nPhD, Past University');
  assert.deepEqual(heading.institutions,['Example University']);assert.deepEqual(heading.topics,['Coastal ecology']);
});

test('unlabelled CV suggests known topics without inferring affiliations from publication text',()=>{
  const result=cvSuggestions('Selected Publications\nIEEE conference on machine-\nlearning for robotics\nContact: photonics@example.org',[{fields:['robotics','photonics']}],['machine learning','bio']);
  assert.ok(result.topics.includes('machine learning'));
  assert.ok(result.topics.includes('robotics'));
  assert.ok(!result.topics.includes('photonics'));
  assert.deepEqual(result.societies,[]);
  assert.deepEqual(result.institutions,[]);
  assert.equal(result.stage,'');
});
