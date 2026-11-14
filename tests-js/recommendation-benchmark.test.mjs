import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeCatalog, selectRecords, normalizeProfile, fundingBrief} from '../docs/demo/matching.mjs';

const catalog=['data','coverage','supplemental'].map(name=>
  JSON.parse(readFileSync(new URL(`../docs/demo/${name}.json`,import.meta.url),'utf8')).opportunities
).reduce(mergeCatalog);

test('resident profile surfaces verified benchmark programs with roles and blockers',t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-14T20:00:00Z')});
  const p=normalizeProfile({stage:'resident',topics:['medical physics','radiotherapy','AI agents','machine learning','artificial intelligence'],institutions:['Stanford University'],societies:['AAPM']});
  const brief=fundingBrief(selectRecords(catalog,p,{matchedOnly:true}),p);
  assert.ok(brief.direct.some(({record})=>record.id==='curated:biswas-fast-grants-2026-2'));
  assert.ok(brief.partner.some(({record})=>record.id==='curated:stanford-raise-health-2026'));
  assert.ok(brief.check.some(({record,path})=>record.id==='coverage:rsna-resident-2027'&&path.label.includes('RSNA')));
  assert.ok(brief.check.some(({record,path})=>record.id==='coverage:aapm-astro-2027'&&path.label.includes('50%')));
});

test('engineering student sees society support instead of a faculty-only research award',t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-14T20:00:00Z')});
  const p=normalizeProfile({stage:'undergrad',topics:['chemistry','mechanical engineering'],institutions:['University of British Columbia'],societies:['ASME']});
  const brief=fundingBrief(selectRecords(catalog,p,{matchedOnly:true}),p);
  assert.ok(brief.direct.some(({record})=>record.id==='coverage:asme-undergraduate-2027'));
  const leads=Object.values(brief).flat();
  assert.ok(!leads.some(({record})=>record.id.includes('acs-prf')||record.affiliation_tags?.institution==='Stanford University'));
});
