import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {taxonomyStats, canonicalLabel, extractTaxonomyTerms, relatedTerms,configureOpenAlexTaxonomy,vocabularyFields,browseResearchConcepts} from '../docs/demo/taxonomy.mjs';
import {buildResearchKeywords,autoCorrectResearchText} from '../docs/demo/manual-profile.mjs';

const demoRoot = new URL('../docs/demo/',import.meta.url);
test('offline taxonomy covers hundreds of concepts without network dependencies',()=>{
  const stats=taxonomyStats();
  assert.ok(stats.seedCount>=900);
  assert.ok(stats.distinctVariants>=stats.seedCount);
  assert.equal(stats.externalCount,0);
  const json=JSON.parse(readFileSync(new URL('./research-vocabulary.json',demoRoot),'utf8'));
  assert.equal(json.concepts.length,stats.seedCount);
  assert.ok(json.fields.length>=15);
});
test('extracts canonical scientific phrases in clinical AI and humanities',()=>{
  const medicine=buildResearchKeywords({description:'Foundation model agents and reinforcement learning for radiotherapy treatment planning'}).topics;
  assert.ok(medicine.includes('reinforcement learning'));
  assert.ok(medicine.includes('radiotherapy'));
  assert.ok(medicine.includes('treatment planning'));
  const humanities=buildResearchKeywords({description:'I work on archaeology and cultural heritage conservation.'}).topics;
  assert.ok(humanities.includes('archaeology'));
  assert.ok(humanities.includes('cultural heritage'));
});
test('supports aliases and does not add all related subjects automatically',()=>{
  assert.equal(canonicalLabel('NLP').toLowerCase(),'natural language processing');
  const result=buildResearchKeywords({description:'I use NLP for education.'});
  assert.ok(result.topics.some(t=>t.toLowerCase()==='natural language processing'));
  assert.equal(result.topics.includes('quantum computing'),false);
});
test('autocorrect changes matching terms, not original typed research text',()=>{
  const description='I study bioinformtics and reinforcment learning for public health.';
  const result=buildResearchKeywords({description});
  assert.ok(result.topics.includes('bioinformatics'));
  assert.ok(result.topics.includes('reinforcement learning'));
  assert.ok(result.corrections.some(x=>x.from==='bioinformtics'));
  assert.equal(description.includes('bioinformtics'),true);
});
test('respects explicitly removed topics and keeps within 20 editable keywords',()=>{
  const result=buildResearchKeywords({description:'My research includes robotics and natural language processing.',excluded:['robotics']});
  assert.ok(!result.topics.includes('robotics'));
  const many=buildResearchKeywords({description:'',keywords:Array.from({length:35},(_,i)=>`specialization ${i}`).join(',')});
  assert.equal(many.topics.length,0); // Unknown free-form keywords are no longer accepted in the dictionary picker.
});
test('optional OpenAlex snapshots validate schema and merge exact canonical terms',()=>{
  assert.equal(configureOpenAlexTaxonomy({schema_version:2,concepts:[]}),false);
  assert.equal(configureOpenAlexTaxonomy({schema_version:1,concepts:[{id:'T1234',label:'Computational Astrobiology',fields:['Physics'],aliases:['astrobiology computation']}]}),true);
  assert.equal(canonicalLabel('astrobiology computation'),'Computational Astrobiology');
  assert.equal(taxonomyStats().externalCount,1);
  assert.ok(extractTaxonomyTerms('Research in computational astrobiology').some(x=>x.term==='Computational Astrobiology'));
});
test('new homepage has a functional search form and accessible explicit steps',()=>{
  const html=readFileSync(new URL('./index.html',demoRoot),'utf8');
  const js=readFileSync(new URL('./demo.js',demoRoot),'utf8');
  assert.match(html, /id="heroSearchForm"/);
  assert.match(html, /id="heroSearchInput"/);
  assert.match(html, /clean-ui\.css\?v=4\.\d+/);
  assert.match(html, /href="#research-profile"/);
  assert.match(html, /href="#dashboard"/);
  assert.match(html, /href="#opportunities"/);
  assert.match(js,/\$\('#heroSearchForm'\)\.addEventListener\('submit'/);
  assert.match(js,/\$\('#exploreQuery'\)\.value=\$\('#heroSearchInput'\)\.value\.trim\(\)/);
});

test('discipline browsing shows relevant concepts and supports local keyword search',()=>{
  const fields=vocabularyFields();
  assert.ok(fields.length>=15);
  assert.ok(fields.includes('Computer science'));
  const list=browseResearchConcepts({field:'Computer science',query:'reinforcement',limit:10});
  assert.ok(list.total>=1);
  assert.ok(list.items.some(x=>x.label==='reinforcement learning'));
  assert.ok(list.items.every(x=>x.fields.includes('Computer science')));
  assert.equal(browseResearchConcepts({query:'keyword_that_will_not_exist_2394'}).total,0);
  const html=readFileSync(new URL('./index.html',demoRoot),'utf8');
  assert.match(html,/id="vocabularyBrowser"/);
  assert.match(html,/id="vocabularyField"/);
  assert.match(html,/id="vocabularyResults"/);
});
