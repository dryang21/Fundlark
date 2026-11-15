import {fundingWindow,localDay} from './funding-window.mjs';
// Workspace-level helpers; cross-disciplinary catalog, not an eligibility engine.
import {normalizeProfile, researchTerms, match, selectRecords, statusOf, applicationPath} from './matching.mjs?v=personal-2';
import {filterByField, recordFields} from './explorer.mjs';
import {evaluateEligibility} from './eligibility.mjs?v=personal-2';
import {parseQuery,lexicalScore,requiredMatches} from './search-text.mjs';

export const STUDENT_STAGES = new Set(['undergrad','masters','phd']);
export const POST_PHD_STAGES = new Set(['postdoc','resident','staff','faculty']);
export const SOURCE_TYPES = ['Industry','Government','Foundation','Institution','Society'];

export function stageFields(stage){
  const student=STUDENT_STAGES.has(stage), postPhd=POST_PHD_STAGES.has(stage);
  return {
    studyYear:student,
    expectedCompletion:student||stage==='resident'||stage==='postdoc',
    phdCompletion:postPhd,
    appointment:postPhd,
    facultyRank:stage==='faculty',
    researchEffort:postPhd||stage==='phd',
    piPrivileges:postPhd,
  };
}
export function yearsSincePhdForStage(stage,year,todayYear=new Date().getFullYear()){
  if(!POST_PHD_STAGES.has(stage)||year==null||year==='')return null;
  const value=Number(year);
  if(!Number.isInteger(value)||value<1950||value>todayYear)return null;
  return todayYear-value;
}
export function sourceCounts(records){
  const out=Object.fromEntries(SOURCE_TYPES.map(type=>[type,0]));
  for(const record of records)if(Object.hasOwn(out,record.category))out[record.category]++;
  return out;
}
export function filterDashboard(records,rawProfile,filters={}){
  const profile=normalizeProfile(rawProfile);
  const {query='',category='all',availability='active',fundingType='',field='',route='all',eligibility='host-compatible',savedOnly=false,today=localDay()}=filters;
  if(!profile.stage&&!profile.topics.length&&!profile.societies.length&&!profile.institutions.length&&!savedOnly)return [];
  let list=selectRecords(records,profile,{
    matchedOnly:!savedOnly,
    recommendedOnly:!savedOnly,
    availability,category,query,fundingType,today,
  });
  list=filterByField(list,field);
  if(route!=='all')list=list.filter(r=>applicationPath(r,profile,today).kind===route);
  const eligibilityOrder={likely:0,verify:1,ineligible:2};
  const fitOrder=record=>{
    const fit=record.matching;
    return fit.topicEvidence.some(e=>!e.matched.startsWith('field: '))?0:fit.affiliations.length?1:2;
  };
  return list.map(record=>({record,assessment:evaluateEligibility(record,profile,{today})}))
    .filter(({assessment})=>eligibility==='all'||(eligibility==='host-compatible'?
      savedOnly||!assessment.checks.some(check=>check.code==='region'&&check.state==='fail'):
      assessment.kind===eligibility))
    .sort((a,b)=>Number(a.assessment.kind==='ineligible')-Number(b.assessment.kind==='ineligible')||
      fitOrder(a.record)-fitOrder(b.record)||eligibilityOrder[a.assessment.kind]-eligibilityOrder[b.assessment.kind])
    .map(({record})=>record);
}
function statusFits(record,availability,today){
  const status=statusOf(record,today);
  return availability==='all'||
    (availability==='active'&&status!=='closed')||
    (availability==='open'&&['open','rolling'].includes(status))||
    (availability==='verify'&&status==='verify')||
    (availability==='forecast'&&status==='forecast')||
    (availability==='closed'&&status==='closed');
}
/** General exploration is deliberately independent from the saved researcher profile.
 * Searches a natural-language description, explicit keywords, and selected disciplines.
 * This ranks topical overlap; it never asserts applicant eligibility.
 */
export function exploreFunding(records,{description='',keywords='',fields=[],category='all',availability='active',fundingType='',stage='',sort='relevance',corpus=records,today=localDay()}={}){
  const input=[description,keywords].filter(Boolean).join('; ').trim();
  const topics=researchTerms(input); // bounded by researchTerms; no candidate-affiliation shortcuts
  const profile=normalizeProfile({topics});
  const phrases=[description,keywords].map(s=>s.trim().toLowerCase()).filter(s=>s.length>=3);
  // Plain-language fallback: every query word counts, not only dictionary concepts.
  const parsed=parseQuery(input);
  const needed=requiredMatches(parsed.tokens.length);
  const stageHints=stage?[]:parsed.stages;
  const filtered=[];
  for(const record of records){
    if(!statusFits(record,availability,today))continue;
    if(category!=='all'&&record.category!==category)continue;
    if(fundingType&&record.funding_type!==fundingType)continue;
    if(fields.length&&!fields.some(field=>recordFields(record).includes(field)))continue;
    const stages=record.eligible_stages||[];
    const canPartner=record.faculty_sponsor_possible||record.eligibility_rules?.application_route==='partner';
    if(stage&&stages.length&&!stages.includes(stage)&&!canPartner)continue;
    const text=[record.title,record.funder,record.opportunity_number,record.description,...(record.topics||[])].join(' ').toLowerCase();
    // Archive entries contain citation metadata only; avoid running topic
    // expansion thousands of times on that sparse data for each keystroke.
    const history=record.origin==='grantsgov_bulk'&&record.status==='closed';
    const hit=topics.length&&!history?match(record,profile).score:0;
    const exact=phrases.some(phrase=>text.includes(phrase));
    const lexical=lexicalScore(record,parsed,corpus);
    const wordsHit=parsed.tokens.length>0&&lexical.matched>=needed;
    // Long descriptions: reward records that share many of the words, not one rare title word.
    const coverage=parsed.tokens.length>5?Math.min(1.5,0.5+lexical.matched/Math.max(needed,1)*0.5):1.5;
    if(input&&!hit&&!exact&&!wordsHit&&!(stageHints.length&&!parsed.tokens.length&&stageHints.some(s=>stages.includes(s))))continue;
    const status=statusOf(record,today);
    // A stage hint ("postdoc", "PhD") helps only records that already match the topic.
    const topical=hit>0||lexical.matched>=Math.max(2,needed);
    const stageBoost=stageHints.some(s=>stages.includes(s))?(topical?10:2):0;
    const liveBoost=['open','rolling'].includes(status)?2:status==='closed'?-4:0;
    filtered.push({...record,exploreScore:hit*2+lexical.score*coverage+(exact?20:0)+stageBoost+(input?liveBoost:0)});
  }
  filtered.sort((a,b)=>{
    if(sort==='deadline')return (fundingWindow(a,today).deadline||'9999-99-99').localeCompare(fundingWindow(b,today).deadline||'9999-99-99')||b.exploreScore-a.exploreScore;
    if(sort==='verified')return String(b.last_verified_at||'').localeCompare(String(a.last_verified_at||''))||b.exploreScore-a.exploreScore;
    return b.exploreScore-a.exploreScore||Number(statusOf(a,today)==='closed')-Number(statusOf(b,today)==='closed')||String(a.title).localeCompare(String(b.title));
  });
  return filtered;
}
