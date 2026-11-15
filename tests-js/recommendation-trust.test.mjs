import test from 'node:test';
import assert from 'node:assert/strict';
import {fundingWindow} from '../docs/demo/funding-window.mjs';
import {trackerICS} from '../docs/demo/explorer.mjs';
import {evaluateEligibility} from '../docs/demo/eligibility.mjs';
import {priorityShortlist,recommendation} from '../docs/demo/recommendations.mjs';

const DAY='2026-11-15';
const profile={stage:'phd',researchRegion:'United States'};
const curated={status:'open',category:'Society',origin:'curated',deadline:'2026-12-20',
  url:'https://example.org/funding/round',title:'Doctoral research travel grant',
  last_verified_at:'2026-11-14',eligible_stages:['phd'],
  eligibility_rules:{application_route:'direct',host_regions:['United States']}};
const at=(record)=>fundingWindow(record,DAY);

test('suspicious imported federal dates do not become open, rolling, or calendar events',()=>{
  const federal={...curated,origin:'grantsgov_api',url:'https://www.grants.gov/search-results-detail/1',deadline:'2076-11-10'};
  assert.equal(at(federal).status,'verify');
  assert.equal(at(federal).deadline,null);
  assert.equal(at({...federal,status:'closed'}).status,'closed');
  assert.doesNotMatch(trackerICS([{record:federal}]),/BEGIN:VEVENT/);
  assert.equal(at({...federal,deadline:'2026-11-31'}).deadline,null);
  assert.equal(at({...federal,deadline:'2026-11-30'}).deadline,'2026-11-30');
  assert.equal(at({...federal,origin:'grantsgov_bulk',deadline:'2026-11-30'}).status,'verify');
});

test('the NSF robotics record has sponsor-backed rolling timing, without eligibility promotion',()=>{
  const frr={...curated,origin:'grantsgov_api',review_needed:true,
    url:'https://www.grants.gov/search-results-detail/324369',deadline:'2076-11-10'};
  assert.equal(at(frr).status,'rolling');
  assert.equal(at(frr).deadline,null);
  assert.equal(new URL(at(frr).evidence.url).hostname,'www.nsf.gov');
  assert.equal(priorityShortlist([frr],profile,DAY).length,0);
});

test('an invitation is call-specific and an unconfirmed second stage cannot be a priority lead',()=>{
  const invited={...curated,application_phase:'invited_stage_two'};
  const assess=invitationConfirmed=>evaluateEligibility(invited,profile,{today:DAY,invitationConfirmed});
  assert.equal(assess().route,'invitation_only');
  assert.equal(assess().kind,'verify');
  assert.equal(assess(false).kind,'ineligible');
  assert.equal(assess(true).kind,'likely');
  assert.match(recommendation(invited,profile,DAY).next,/invitation/);
  assert.deepEqual(priorityShortlist([invited],profile,DAY),[]);
});

test('first five prioritize compatible current calls and identify the next action by route',()=>{
  const conflict={...curated,id:'wrong-host',eligibility_rules:{...curated.eligibility_rules,host_regions:['India']}};
  const partner={...curated,id:'partner',eligible_stages:['faculty'],eligibility_rules:{application_route:'partner'}};
  const check={...curated,id:'pending',eligibility_rules:{...curated.eligibility_rules,mentor_required:true}};
  const first={...curated,id:'direct'};
  const staleUrgent={...curated,id:'urgent-stale',deadline:'2026-11-20',last_verified_at:'2026-09-01'};
  const incomplete={...curated,id:'incomplete',eligibility_rules:{...curated.eligibility_rules,requirements_complete:false}};
  const listing={...curated,origin:'ukri_listing',id:'listing'};
  const results=priorityShortlist([conflict,partner,check,first,staleUrgent,incomplete,listing,
    {...curated,id:'past',deadline:'2026-11-14'}, {...curated,id:'future',opens_on:'2026-12-01'}],profile,DAY);
  assert.deepEqual(results.map(r=>[r.record.id,r.kind]),[['direct','direct'],['partner','partner'],['pending','check'],['incomplete','check']]);
  assert.match(results[1].next,/supervisor or grants office/);
  assert.match(results[2].next,/mentor/);
  assert.equal(priorityShortlist(Array.from({length:6},(_,i)=>({...curated,id:i})),profile,DAY).length,5);
});

test('a broad field tag and an overseas partner route stay out of the first five',()=>{
  const match={stageMatch:true,affiliations:[],topicEvidence:[{matched:'field: Engineering'}]};
  const fieldOnly={...curated,id:'field-only',matching:match};
  const overseas={...curated,id:'overseas',
    eligibility_rules:{application_route:'partner',host_regions:['United Kingdom']}};
  assert.equal(recommendation(overseas,profile,DAY).kind,'partner');
  assert.deepEqual(priorityShortlist([fieldOnly,overseas],profile,DAY),[]);
});
