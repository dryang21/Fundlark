import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manualResearchTopics,researchProfileText} from '../docs/demo/manual-profile.mjs';
import {normalizeProfile,assistantPrompt,match} from '../docs/demo/matching.mjs';
import {filterDashboard,exploreFunding} from '../docs/demo/workspace.mjs';

const html=readFileSync(new URL('../docs/demo/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../docs/demo/demo.js',import.meta.url),'utf8');

test('CV uploader and extraction workflow are absent from the visible site and runtime',()=>{
  for(const marker of ['id="cvFile"','id="scanCV"','id="cvText"','id="cvHelper"'])assert.ok(!html.includes(marker),marker);
  assert.ok(!app.includes("import {readCV}"));
  assert.ok(!app.includes("cvReview("));
  assert.ok(!app.includes("#cvHelper"));
});
test('one research description and editable keywords replace three separate text fields',()=>{
  for(const id of ['researchDescription','profileAddKeyword','keywordSuggestionList','topicSummary','stage','profileSuggestedTopics'])assert.ok(html.includes(`id="${id}"`));
  for(const id of ['researchBackground','researchProposal','researchKeywords'])assert.ok(!html.includes(`id="${id}"`));
  assert.ok(html.includes('Every field is optional'));
  assert.ok(html.includes('id="profileForm"'));
  assert.ok(html.includes('id="eligibilityDetails"')&&html.includes('id="affiliationDetails"'));
  assert.match(html,/<details id="profileRefinements"[^>]*>[\s\S]*id="eligibilityDetails"[\s\S]*id="affiliationDetails"[\s\S]*<\/details>/);
});
test('project and explicit keywords rank ahead of background while retaining cross-disciplinary coverage',()=>{
  const fields={background:'My research background is physics and chemistry.',proposal:'I propose to improve sustainable battery recycling with robotics.',keywords:'battery recycling, robotics'};
  const terms=manualResearchTopics(fields);
  assert.equal(terms[0],'battery recycling');
  assert.equal(terms[1],'robotics');
  assert.ok(terms.some(x=>x.toLowerCase().includes('battery')));
  assert.ok(terms.some(x=>x.toLowerCase().includes('physics')));
  assert.ok(!terms.includes('using'));
  assert.equal(manualResearchTopics({}).length,0);
});
test('manual fields survive profile storage and legacy researchText migrates into background',()=>{
  const raw={researchBackground:'My work is materials research',researchProposal:'Explore solid-state electrolytes',researchKeywords:'battery materials',stage:'phd',institutions:['Stanford University']};
  const normalized=normalizeProfile({...raw,topics:manualResearchTopics({background:raw.researchBackground,proposal:raw.researchProposal,keywords:raw.researchKeywords})});
  assert.equal(normalized.researchBackground,raw.researchBackground);
  assert.equal(normalized.researchProposal,raw.researchProposal);
  assert.equal(normalized.researchKeywords,raw.researchKeywords);
  assert.equal(normalizeProfile(JSON.parse(JSON.stringify(normalized))).researchProposal,raw.researchProposal);
  assert.equal(normalizeProfile({researchText:'Climate adaptation',stage:'masters'}).researchBackground,'Climate adaptation');
  assert.equal(researchProfileText({background:' A ',proposal:' B ',keywords:' C '}),'A; B; C');
  assert.match(assistantPrompt(normalized),/Research description: My work is materials research; Explore solid-state electrolytes/);
});
test('manually entered research topics drive personalized matching while Explore Funding remains independent',()=>{
  const record={id:'battery',status:'rolling',title:'Sustainable battery recycling fellowship',funder:'Materials Society',category:'Society',topics:['battery recycling'],eligible_stages:['phd']};
  const unrelated={id:'history',status:'rolling',title:'History archive grant',category:'Foundation',topics:['history'],eligible_stages:['phd']};
  const p=normalizeProfile({topics:manualResearchTopics({background:'Materials science PhD student',proposal:'I develop battery recycling technologies',keywords:'battery recycling'}),stage:'phd'});
  assert.equal(filterDashboard([record,unrelated],p,{availability:'active'})[0].id,'battery');
  assert.deepEqual(exploreFunding([record,unrelated],{description:'history',availability:'active'}).map(x=>x.id),['history']);
});
