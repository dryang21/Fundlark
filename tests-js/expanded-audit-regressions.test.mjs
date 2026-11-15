import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildResearchKeywords} from '../docs/demo/manual-profile.mjs';
import {normalizeProfile} from '../docs/demo/matching.mjs';
import {filterDashboard} from '../docs/demo/workspace.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../docs/demo/${name}.json`,import.meta.url),'utf8')).opportunities;

test('plain-language robotics description retrieves a Horizon topic already in the catalog',()=>{
  const description='I study human–robot interaction, industrial automation, and safe collaborative robots.';
  const {topics}=buildResearchKeywords({description});
  assert.ok(topics.includes('robotics'));
  const records=read('bulk-calls');
  const results=filterDashboard(records,{stage:'faculty',researchRegion:'Germany',topics});
  assert.ok(results.some(record=>record.id.endsWith('digital-emerging-52-two-stage')));
});
test('country choices and a fixed host rule handle the Kenya crop profile',()=>{
  const p=normalizeProfile({researchRegion:'Kenya',stage:'faculty',topics:['food security','agriculture']});
  assert.equal(p.researchRegion,'Kenya');
  const hsi=read('crossdisciplinary').filter(r=>r.id==='cross:usda-hsi-edu');
  assert.equal(hsi.length,1);
  assert.ok(filterDashboard(hsi,p,{eligibility:'ineligible'}).length);
  assert.deepEqual(filterDashboard(hsi,p),[]);
});
