import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {filterSources, relatedSources} from '../docs/demo/coverage.mjs';
import {mergeCatalog, normalizeProfile, selectRecords, statusOf} from '../docs/demo/matching.mjs';
const directory=JSON.parse(readFileSync(new URL('../docs/demo/coverage.json',import.meta.url),'utf8'));

test('coverage spans 50+ fields and 100+ distinct society/conference routes',()=>{
  assert.ok(directory.fields.length>50);
  assert.ok(new Set(directory.sources.map(row=>row.id)).size>100);
  assert.ok(filterSources(directory.sources,{kind:'conference',field:'robotics'}).some(row=>row.alias==='ICRA'));
  assert.ok(filterSources(directory.sources,{query:'icse',kind:'conference'}).some(row=>row.alias==='ICSE'));
  assert.equal(relatedSources(directory.sources,normalizeProfile({societies:['IEEE RAS'],topics:['robotics']}))[0].alias,'IEEE RAS');
});
test('directory entries do not become awards and shared funding pages preserve distinct awards',()=>{
  const {sources,opportunities}=directory;
  assert.ok(sources.some(source=>!source.program_ids));
  assert.equal(mergeCatalog([],opportunities).length,opportunities.length);
  assert.ok(opportunities.filter(row=>row.url.includes('travel-caregiver-grants')).length>=3);
  assert.ok(selectRecords(opportunities,normalizeProfile(),{availability:'all',fundingType:'Conference travel'}).every(row=>row.funding_type==='Conference travel'));
  const past=opportunities.find(row=>row.id.endsWith('neurips-aid-2026'));
  assert.equal(statusOf(past,'2026-11-13'),'closed');
});
