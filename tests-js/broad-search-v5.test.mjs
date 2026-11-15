import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseQuery,lexicalScore,requiredMatches,stem,describeQuery} from '../docs/demo/search-text.mjs';
import {exploreFunding} from '../docs/demo/workspace.mjs';
import {fundingWindow,staleTitleYear} from '../docs/demo/funding-window.mjs';
import {assistantPrompt,normalizeProfile,mergeCatalog} from '../docs/demo/matching.mjs';

const demo=name=>JSON.parse(readFileSync(new URL(`../docs/demo/${name}.json`,import.meta.url),'utf8'));
const html=readFileSync(new URL('../docs/demo/index.html',import.meta.url),'utf8');
const TODAY='2026-11-15';

test('queries drop filler words, keep topical words and record stage hints',()=>{
  const parsed=parseQuery('I am a postdoc using single-cell RNA sequencing to study tumor microenvironment');
  assert.ok(parsed.stages.includes('postdoc'));
  for(const word of ['single','cell','rna','tumor','microenvironment'])assert.ok(parsed.tokens.includes(stem(word)),word);
  for(const word of ['using','study','postdoc'])assert.ok(!parsed.tokens.includes(word),word);
  assert.ok(parsed.bigrams.includes(`${stem('single')} ${stem('cell')}`));
  assert.equal(stem('batteries'),stem('battery'));
  assert.deepEqual([1,2,3,5,12].map(requiredMatches),[1,2,2,2,3]);
});

test('title words and adjacent phrases outrank scattered description words',()=>{
  const records=[
    {title:'Single-cell genomics fellowship',description:'Postdoctoral support.'},
    {title:'Regional development fund',description:'Projects that are single in focus and use cell towers.'},
    {title:'Unrelated archive grant',description:'Humanities collections.'}];
  const parsed=parseQuery('single cell genomics');
  const [a,b,c]=records.map(r=>lexicalScore(r,parsed,records));
  assert.ok(a.score>b.score&&b.score>c.score);
  assert.equal(c.matched,0);
});

test('plain-language search finds names and topics the research dictionary does not know',()=>{
  const records=[
    {id:'a',title:'Damon Runyon Fellowship Award',funder:'Damon Runyon Cancer Research Foundation',status:'verify',eligible_stages:['postdoc'],description:'Fellowship for early postdocs in cancer research.'},
    {id:'b',title:'Housing inequality and neighbourhood change grants',funder:'Example Foundation',status:'open',description:'Research on gentrification and housing.'},
    {id:'c',title:'Battery manufacturing call',funder:'Innovate UK',status:'open',description:'Industrial battery scale-up.'}];
  assert.deepEqual(exploreFunding(records,{description:'Damon Runyon',today:TODAY}).map(r=>r.id),['a']);
  assert.equal(exploreFunding(records,{description:'I study gentrification and housing inequality in immigrant neighborhoods',today:TODAY})[0].id,'b');
  assert.equal(exploreFunding(records,{description:'zzqx nonexistent',today:TODAY}).length,0);
});

test('a career-stage word boosts matching fellowships only when the topic also matches',()=>{
  const records=[
    {id:'topic',title:'Cancer immunology project grant',status:'open',description:'Immunotherapy research.',eligible_stages:[]},
    {id:'stage-topic',title:'Cancer immunology postdoctoral fellowship',status:'verify',description:'Immunotherapy training.',eligible_stages:['postdoc']},
    {id:'stage-only',title:'Physics travel award',status:'open',description:'Conference travel.',eligible_stages:['postdoc']}];
  const ranked=exploreFunding(records,{description:'postdoc fellowship cancer immunology',today:TODAY}).map(r=>r.id);
  assert.equal(ranked[0],'stage-topic');
  assert.ok(!ranked.includes('stage-only'));
});

test('rounds named for an old year without a current deadline are treated as past',()=>{
  assert.equal(staleTitleYear('2022 Alumni Engagement Innovation Fund-Italy',TODAY),true);
  assert.equal(staleTitleYear('FY2023 Program',TODAY),true);
  assert.equal(staleTitleYear('2024-25 call',TODAY),false);
  assert.equal(staleTitleYear('2026-27 King Center awards',TODAY),false);
  assert.equal(staleTitleYear('Sloan Research Fellowships',TODAY),false);
  assert.equal(fundingWindow({title:'2022 Alumni Fund',status:'forecast'},TODAY).status,'closed');
  assert.equal(fundingWindow({title:'2022 Alumni Fund',status:'open',deadline:'2027-01-10'},TODAY).status,'open');
  assert.equal(fundingWindow({title:'Program 2027',status:'open'},TODAY).status,'open');
});

test('curated fellowship records are well-formed, official and honest about timing',()=>{
  const bundle=demo('fellowships');
  assert.equal(bundle.schema_version,1);
  assert.ok(bundle.opportunities.length>=15);
  const stages=new Set(['undergrad','masters','phd','postdoc','resident','faculty','staff']);
  const ids=new Set();
  for(const r of bundle.opportunities){
    assert.ok(!ids.has(r.id),r.id);ids.add(r.id);
    assert.match(r.url,/^https:\/\//,r.id);
    assert.ok(['open','rolling','forecast','verify','closed'].includes(r.status),r.id);
    assert.ok(r.eligible_stages.every(s=>stages.has(s)),r.id);
    assert.match(r.last_verified_at,/^\d{4}-\d{2}-\d{2}$/);
    if(r.deadline){
      assert.match(r.deadline,/^\d{4}-\d{2}-\d{2}$/,r.id);
      assert.ok(r.timing_evidence?.detail,`${r.id} needs timing evidence for its date`);
    }
    if(r.status==='verify')assert.equal(r.program_status_scope,'program_family',r.id);
    if(r.status==='open'&&!r.deadline)assert.ok(r.opens_on||/open/i.test(r.eligibility),r.id);
  }
  // A postdoc searching for cancer fellowships should now see named fellowships.
  const merged=mergeCatalog(demo('data').opportunities,bundle.opportunities);
  const top=exploreFunding(merged,{description:'postdoctoral fellowship cancer',today:TODAY}).slice(0,5).map(r=>r.id);
  assert.ok(top.filter(id=>id.startsWith('fellowship:')).length>=3,top.join(', '));
});

test('assistant request carries location and readable stage, and names the skill when installed',()=>{
  const profile=normalizeProfile({researchBackground:'Housing inequality',stage:'phd',researchRegion:'Canada',institutions:['University of Toronto']});
  const plain=assistantPrompt(profile);
  assert.match(plain,/Career stage: PhD student/);
  assert.match(plain,/Where I do research: Canada/);
  assert.match(plain,/Institutions and memberships: University of Toronto/);
  assert.match(plain,/fellowships\.json/);
  assert.doesNotMatch(plain,/Use the Fundlark skill/);
  assert.match(assistantPrompt(profile,'',{skillMode:true}),/^Use the Fundlark skill/);
});

test('page leads with broad search and explains what the skill adds',()=>{
  assert.ok(html.indexOf('id="opportunities"')<html.indexOf('id="dashboard"'));
  assert.ok(html.indexOf('id="dashboard"')<html.indexOf('id="use-skill"'));
  assert.match(html,/id="heroSuggestions"/);
  assert.match(html,/class="mode-compare"/);
  for(const gone of ['research-profile','profileForm','dashboardMatchesPanel','examplePicker'])assert.ok(!html.includes(`id="${gone}"`),gone);
});

test('one search box, with a plain explanation of what the query matched',()=>{
  const searchInputs=[...html.matchAll(/<input[^>]*type="search"[^>]*>/g)].map(m=>m[0]).filter(tag=>/id="exploreQuery"/.test(tag));
  assert.equal(searchInputs.length,1);
  assert.match(html,/id="searchInterpretation"/);
  const explained=describeQuery('postdoc fellowship on tumor microenvironment and gentrification',['tumor microenvironment']);
  assert.deepEqual(explained.topics,['tumor microenvironment']);
  assert.ok(explained.words.includes('gentrification'));
  assert.ok(!explained.words.includes('tumor')&&!explained.words.includes('microenvironment'));
  assert.deepEqual(explained.stages,['postdoc']);
});
