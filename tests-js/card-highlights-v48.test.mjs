import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grantHighlights} from '../docs/demo/grant-highlights.mjs';

const html=readFileSync(new URL('../docs/demo/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../docs/demo/demo.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../docs/demo/mono-theme.css',import.meta.url),'utf8');

test('cards include source-grounded highlights for every funding result, personalized and explore',()=>{
  assert.match(js,/grantHighlights\(o\)\.map/);
  assert.match(js,/class="grant-highlights"/);
  assert.match(js,/fundingRow\(r,\{personalized:true\}\)/);
  assert.match(js,/fundingRow\(r\)/);
  assert.match(css,/\.grant-highlights/);
});

test('a society grant summarizes purpose, research areas, and limited applicant information',()=>{
  const sample={title:'Early-career physics award',origin:'curated',description:'Supports early-career medical physics research. Verify the next round with the funder.',topics:['medical physics','radiotherapy','medical imaging'],eligibility:'AAPM membership required. PI eligibility restrictions apply.'};
  const result=grantHighlights(sample);
  assert.equal(result.length,3);
  assert.deepEqual(result.map(item=>item.kind),['summary','topics','audience']);
  assert.match(result[0].text,/early-career/);
  assert.doesNotMatch(result[0].text,/Verify/);
  assert.match(result[1].text,/radiotherapy/);
  assert.match(result[2].text,/AAPM membership required/);
});

test('federal boilerplate is not passed off as an informative program description',()=>{
  const result=grantHighlights({origin:'grantsgov_api',title:'Test program',description:'Federal opportunity PA-27-100. Open the official listing for the complete synopsis, funding amount, eligibility and application documents.',topics:['ruth','research','training','parent'],funding_type:'Research grant',eligibility:'Eligibility not established from search results; confirm in the official synopsis.'});
  assert.deepEqual(result,[{kind:'type',label:'Support type',text:'Research grant'}]);
});

test('source listings show their actual description and do not invent research topics',()=>{
  const result=grantHighlights({origin:'institution_listing',description:'Listing excerpt: “This award supports community-engaged capstone projects and courses…”',topics:[]});
  assert.equal(result.length,1);
  assert.match(result[0].text,/community-engaged capstone/);
});

test('empty catalog descriptions are transparent rather than hallucinating program details',()=>{
  assert.deepEqual(grantHighlights({title:'Unknown award'}),[{kind:'missing',label:'About',text:'Program scope is not summarized in the catalog.'}]);
});

test('removed redundant keyword instructions stay removed while accessible live messages remain',()=>{
  assert.doesNotMatch(html,/Start typing, then select a suggested term/);
  assert.doesNotMatch(html,/Remove unwanted terms using/);
  assert.doesNotMatch(html,/959 indexed research concepts/);
  assert.doesNotMatch(html,/Fundlark extracts research keywords automatically/);
  assert.match(html,/id="keywordPickerStatus" role="status" class="visually-hidden"/);
  assert.match(js,/const corrections='';/);
});
