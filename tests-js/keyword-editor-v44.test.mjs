import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {autoCorrectResearchText,buildResearchKeywords} from '../docs/demo/manual-profile.mjs';
import {normalizeProfile} from '../docs/demo/matching.mjs';
import {filterDashboard,exploreFunding} from '../docs/demo/workspace.mjs';
const html=readFileSync(new URL('../docs/demo/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../docs/demo/demo.js',import.meta.url),'utf8');

test('single research field, visible editable chips, add and reset controls, no CV uploader',()=>{
  for(const id of ['researchDescription','topicSummary','profileAddKeyword','keywordSuggestionList','restoreExtractedKeywords'])assert.ok(html.includes(`id="${id}"`));
  for(const id of ['researchBackground','researchProposal','researchKeywords','cvFile'])assert.ok(!html.includes(`id="${id}"`));
  assert.ok(html.indexOf('id="topicSummary"')<html.indexOf('id="stage"'));
  assert.match(js,/data-remove-topic/);
  assert.match(js,/removeProfileKeyword\(/);
  assert.match(js,/addProfileKeywords\(/);
  assert.match(js,/profile\.excludedTopics/);
});
test('automatic spelling corrections normalize obvious scientific typos',()=>{
  const original='I study reinforcment learing with artifical intellgence for radiotheraphy.';
  const result=autoCorrectResearchText(original);
  assert.match(result.text,/reinforcement learning with artificial intelligence for radiotherapy/);
  assert.ok(result.changes.length>=5);
  const terms=buildResearchKeywords({description:original});
  for(const target of ['reinforcement learning','artificial intelligence','radiotherapy'])assert.ok(terms.topics.includes(target),target);
});
test('technical terms, acronyms and user text are left intact',()=>{
  const original='I work with NeurIPS, GPT-6, PyTorch, CRISPR-Cas9, DICOM and Eclipse.';
  assert.equal(autoCorrectResearchText(original).text,original);
  assert.deepEqual(autoCorrectResearchText(original).changes,[]);
});
test('custom keywords are corrected, removable, restorable and de-duplicated',()=>{
  const first=buildResearchKeywords({description:'My project uses reinforcment learing for radiotherapy',keywords:'reinforcment learning, radiotheraphy, Climate change'});
  assert.ok(first.topics.includes('reinforcement learning'));
  assert.equal(first.topics.filter(x=>x==='radiotherapy').length,1);
  assert.equal(first.entries.find(x=>x.term==='reinforcement learning').kind,'manual');
  const removed=buildResearchKeywords({description:'My project uses reinforcment learing for radiotherapy',keywords:'Climate change',excluded:['reinforcement learning','radiotherapy']});
  assert.ok(!removed.topics.includes('reinforcement learning'));
  assert.ok(!removed.topics.includes('radiotherapy'));
  const restored=buildResearchKeywords({description:'My project uses reinforcment learing for radiotherapy'});
  assert.ok(restored.topics.includes('reinforcement learning'));
});
test('exclusions and corrected topics persist and personalized matching uses edited list',()=>{
  const fields={description:'I study archaeology and climate change',keywords:'archaeology',excluded:['climate change']};
  const topics=buildResearchKeywords(fields).topics;
  const p=normalizeProfile({stage:'phd',researchBackground:fields.description,researchKeywords:fields.keywords,topics,excludedTopics:fields.excluded});
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(p))).excludedTopics,fields.excluded);
  assert.ok(p.topics.includes('archaeology'));
  assert.ok(!p.topics.includes('climate change'));
  const programs=[{id:'a',status:'rolling',title:'Archaeology fieldwork',category:'Foundation',topics:['archaeology'],eligible_stages:['phd']},
    {id:'c',status:'rolling',title:'Climate transition award',category:'Government',topics:['climate change'],eligible_stages:['phd']}];
  assert.equal(filterDashboard(programs,p,{availability:'active'})[0].id,'a');
  assert.equal(exploreFunding(programs,{description:'climate change',availability:'active'})[0].id,'c');
});
