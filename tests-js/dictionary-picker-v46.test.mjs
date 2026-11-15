import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalConcept,searchResearchConcepts} from '../docs/demo/taxonomy.mjs';
import {buildResearchKeywords} from '../docs/demo/manual-profile.mjs';
const read=filename=>readFileSync(new URL(`../docs/demo/${filename}`,import.meta.url),'utf8');

test('search dictionary ranks recognized terms, synonyms and prefixes',()=>{
  assert.equal(searchResearchConcepts('NLP')[0].label,'natural language processing');
  assert.equal(searchResearchConcepts('robotics')[0].label,'robotics');
  assert.equal(searchResearchConcepts('reinforce')[0].label,'reinforcement learning');
  assert.ok(searchResearchConcepts('machin').some(x=>x.label==='machine learning'));
});
test('a research typo suggests its recognized canonical term without auto-selecting it',()=>{
  const suggested=searchResearchConcepts('reinforcment learing');
  assert.equal(suggested[0].label,'reinforcement learning');
  assert.match(suggested[0].reason,/spelling/i);
  assert.equal(canonicalConcept('reinforcment learing'),null);
  assert.deepEqual(searchResearchConcepts('zzzxzyyy'),[]);
});
test('manual keywords are strictly vocabulary-backed, aliases canonicalized',()=>{
  assert.deepEqual(buildResearchKeywords({keywords:'unrecognized specialization, fakeword42'}).topics,[]);
  const result=buildResearchKeywords({description:'unknown unusual technique',keywords:'NLP, AI, robotics'});
  assert.deepEqual(result.topics.slice(0,3),['natural language processing','artificial intelligence','robotics']);
});
test('v5 page has no profile keyword combobox; personalization is delegated to the skill',()=>{
  const html=read('index.html'),js=read('demo.js');
  assert.ok(!html.includes('id="profileAddKeyword"'));
  assert.ok(!js.includes('canonicalConcept('));
  assert.match(html,/id="use-skill"/);
});
test('monochrome UI is loaded after base styles, color limited to status signals',()=>{
  const html=read('index.html'),css=read('mono-theme.css');
  assert.match(html,/mono-theme\.css\?v=[45]\.\d+/);
  assert.ok(html.indexOf('mono-theme.css')>html.indexOf('clean-ui.css'));
  assert.match(css,/--ink:#171717/);
  assert.match(css,/\.eligibility-verify/);
  assert.match(css,/\.eligibility-ineligible/);
  assert.match(css,/\.keyword-suggestion-option\[aria-selected=true\]/);
});
