import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeCatalog, statusOf} from '../docs/demo/matching.mjs';
import {filterHubs} from '../docs/demo/explorer.mjs';
import {exploreFunding} from '../docs/demo/workspace.mjs';

const get = name => JSON.parse(readFileSync(new URL(`../docs/demo/${name}`, import.meta.url),'utf8'));

test('global data is merged into personalized and open explorer catalog without inflating source hubs',()=>{
 let all=[];
 for (const name of ['data.json','coverage.json','supplemental.json','crossdisciplinary.json','global-programs.json'])
   all=mergeCatalog(all,get(name).opportunities);
 const originalCount=all.length;
 const UKRI=get('ukri-calls.json').opportunities;
 all=mergeCatalog(all,UKRI);
 assert.ok(all.length>originalCount);
 assert.equal(new Set(all.map(record=>record.id)).size,all.length);
 assert.ok(all.some(x=>x.country_or_region==='Hong Kong'));
 assert.ok(all.some(x=>x.country_or_region==='Singapore'));
 assert.ok(all.some(x=>x.category==='Industry'));
 assert.ok(all.some(x=>x.category==='Foundation'));
 assert.ok(all.some(x=>x.program_status_scope==='program_family'));
 for(const x of all.filter(x=>x.program_status_scope==='program_family')){
   assert.equal(statusOf(x),'verify');
   assert.equal(x.deadline,null);
   assert.equal(x.review_needed,true);
 }
});

test('UKRI listings are searchable, stay unreviewed for eligibility, and preserve curated records at the same official URL',()=>{
 const {opportunities}=get('ukri-calls.json');
 const listing=opportunities.find(row=>row.status==='open');
 assert.ok(listing);
 assert.equal(listing.review_needed,true);
 assert.equal(listing.eligibility_rules,undefined);
 assert.match(listing.url,/^https:\/\/www\.ukri\.org\/opportunity\/[a-z0-9-]+\/$/);
 assert.ok(exploreFunding(opportunities,{description:listing.title,category:'Government',availability:'all'}).some(row=>row.id===listing.id));
 const editorial={...listing,id:'editorial',title:'Reviewed call',origin:'curated',url:listing.url.replace('www.','').slice(0,-1)};
 assert.deepEqual(mergeCatalog([editorial],[listing]),[editorial]);
});

test('published global hubs are source entry points and maintain discipline/type filtering',()=>{
 const hubdata=get('global-source-hubs.json');
 assert.ok(hubdata.sources.length>100);
 const industry=filterHubs(hubdata.sources,{kind:'Industry'});
 const government=filterHubs(hubdata.sources,{kind:'Government'});
 assert.ok(industry.length>10);
 assert.ok(government.length>30);
 const sg=filterHubs(hubdata.sources,{region:'Singapore'});
 assert.ok(sg.some(h=>h.kind==='Institution'));
});

test('global funding bundles are explicitly loaded in the browser application',()=>{
 const app=readFileSync(new URL('../docs/demo/demo.js',import.meta.url),'utf8');
 for(const name of ['global-programs','global-source-hubs','fellowships'])assert.match(app,new RegExp(`bundle\\('${name}'`));
 assert.match(app,/for\(const extra of \[supplemental,crossData,globalPrograms,ukri,fellowships\]\)/);
 assert.match(app,/hasRows\(globalSources,'sources'\)/);
});
