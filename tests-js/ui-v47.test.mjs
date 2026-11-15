import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appointmentOptionsForStage} from '../docs/demo/appointment-options.mjs';
import {normalizeProfile} from '../docs/demo/matching.mjs';
import {paginateRecords,pageSequence} from '../docs/demo/pagination.mjs';
import {evaluateEligibility} from '../docs/demo/eligibility.mjs';

const html=readFileSync(new URL('../docs/demo/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../docs/demo/demo.js',import.meta.url),'utf8');

test('appointment subtype dropdown is generic and stage-aware',()=>{
  assert.ok(appointmentOptionsForStage('resident').some(([id,label])=>id==='clinical_resident'&&label==='Clinical resident (any specialty)'));
  assert.ok(appointmentOptionsForStage('postdoc').some(([id])=>id==='research_postdoc'));
  assert.ok(appointmentOptionsForStage('staff').some(([id])=>id==='research_engineer'));
  assert.deepEqual(appointmentOptionsForStage('phd'),[]);
  assert.equal(normalizeProfile({stage:'resident',appointment:'clinical_resident'}).appointment,'clinical_resident');
  assert.equal(normalizeProfile({stage:'phd',appointment:'clinical_resident'}).appointment,'');
  assert.doesNotMatch(html,/Clinical\/medical physics resident/);
});

test('search uses ten records per page, two sets of controls and page reset on filters',()=>{
  const rows=Array.from({length:34},(_,i)=>({id:i}));
  assert.deepEqual([paginateRecords(rows,1).items.length,paginateRecords(rows,2).items.length,paginateRecords(rows,4).items.length],[10,10,4]);
  assert.deepEqual(pageSequence(1,4),[1,2,3,4]);
  assert.match(html,/id="explorePaginationTop"/);
  assert.match(html,/id="explorePaginationBottom"/);
  assert.match(js,/segment=paginateRecords\(all,explorePage\)/);
  assert.match(js,/resetExplorePage\(\)/);
  assert.match(js,/data-explore-page/);
});

test('search cards make no personalized eligibility claims; details stay one click away',()=>{
  assert.doesNotMatch(js,/class="funding-conflict"/);
  assert.doesNotMatch(js,/priority-tag/);
  assert.doesNotMatch(js,/class="eligibility-badge"/);
  assert.doesNotMatch(html,/id="matchSummary"/);
  assert.match(js,/details class="funding-row-details"/);
  // v5.2: the skill panel explains what personalization adds, without caveat copy on every result.
  assert.match(html,/check the details on each call/);
});

test('mentor not yet confirmed is not a definitive ineligibility rule, but confirmed conflict is',()=>{
  const base={id:'resident-grant',title:'Research resident grant',status:'rolling',category:'Society',eligible_stages:['resident'],last_verified_at:'2026-11-14',eligibility_rules:{application_route:'direct',mentor_required:true,minimum_research_effort_percent:50}};
  const unknown=evaluateEligibility(base,{stage:'resident',mentorConfirmed:false,researchEffortPercent:70},{today:'2026-11-14'});
  assert.equal(unknown.kind,'verify');
  const conflict=evaluateEligibility(base,{stage:'resident',mentorConfirmed:true,researchEffortPercent:20},{today:'2026-11-14'});
  assert.equal(conflict.kind,'ineligible');
  assert.ok(conflict.checks.some(check=>check.state==='fail'&&check.code==='research-effort'));
});
