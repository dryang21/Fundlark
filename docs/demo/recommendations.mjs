import {normalizeProfile} from './matching.mjs?v=personal-2';
import {evaluateEligibility} from './eligibility.mjs?v=personal-2';
import {fundingWindow, invitedPhase, localDay} from './funding-window.mjs';

const listingOrigins=new Set(['grantsgov_api','grantsgov_bulk','horizon_feed','ukri_listing','institution_listing','global_program_registry']);

export function recommendation(record,profile,today=localDay()){
  const assessment=evaluateEligibility(record,profile,{today});
  const window=fundingWindow(record,today);
  const rules=record.eligibility_rules||{};
  const partner=assessment.route==='partner'||rules.faculty_lead_required===true;
  const knownConflict=assessment.checks.find(check=>check.state==='fail');
  const pending=assessment.checks.find(check=>check.state==='unknown'&&!['source','window'].includes(check.code));
  const kind=knownConflict?'conflict':invitedPhase(record)?'invited':partner?'partner':
    assessment.route==='direct'&&assessment.kind==='likely'?'direct':'check';
  const route=invitedPhase(record)?'Invitation required':partner?'Faculty or institution submits':
    assessment.route==='direct'?'Individual application':record.faculty_sponsor_possible?'Faculty partner may be possible':'Application route unconfirmed';
  const next=knownConflict?'Check the official rule before spending time on this application.':
    window.status==='closed'?'Watch the funder for the next round.':
    kind==='invited'?assessment.next:
    window.status==='forecast'?'Check the expected opening date and set a reminder.':
    window.status==='verify'?'Check the official call for a current application window.':
    partner?(rules.next_step||'Ask your supervisor or grants office who can submit and what role you can hold.'):
    rules.next_step||pending?.text||assessment.next;
  return {assessment,window,kind,route,next};
}

// The dashboard passes its relevance-ranked candidates. A separate gate
// keeps known conflicts, invite-only stages and unreviewed listings out.
export function priorityShortlist(candidates,profile,today=localDay()){
  const {researchRegion}=normalizeProfile(profile);
  const rank={direct:0,partner:1,check:1};
  const date=Date.parse(today+'T00:00:00Z');
  const rows=[];
  for(const record of candidates){
    const reviewed=record.last_verified_at;
    const checked=/^\d{4}-\d{2}-\d{2}$/.test(reviewed||'')?Date.parse(reviewed+'T00:00:00Z'):NaN;
    const age=(date-checked)/86400000;
    const {deadline,status}=fundingWindow(record,today);
    const daysLeft=deadline?(Date.parse(deadline+'T00:00:00Z')-date)/86400000:Infinity;
    if(record.review_needed||listingOrigins.has(record.origin)||record.program_status_scope==='program_family'||
       !['open','rolling'].includes(status)||(status==='open'&&!deadline)||!/^https:\/\//.test(record.url||'')||
       !Number.isFinite(age)||age<0||age>(daysLeft<=14?30:180))continue;
    // An overseas lead may remain useful in the broader results for a
    // collaboration. It should not outrank locally available funding here.
    const regions=record.eligibility_rules?.host_regions;
    if(researchRegion&&researchRegion!=='Other'&&Array.isArray(regions)&&regions.length&&!regions.includes(researchRegion))continue;
    const fit=record.matching;
    const topicMatch=fit?.topicEvidence.some(hit=>!hit.matched.startsWith('field: '));
    const affiliateMatch=fit?.affiliations?.length&&fit?.stageMatch;
    if(fit&&!topicMatch&&!affiliateMatch)continue;
    const info=recommendation(record,profile,today);
    if(info.kind in rank)rows.push({record,...info});
  }
  return rows.sort((a,b)=>rank[a.kind]-rank[b.kind]).slice(0,5);
}
