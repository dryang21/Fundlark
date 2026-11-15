/**
 * Explainable, conservative applicant-eligibility screening.
 * This module never treats topic relevance as an applicant-eligibility rule.
 * The three labels are triage suggestions, not sponsor decisions.
 * Only explicit structured catalog rules are treated as mandatory; anything
 * absent or ambiguous becomes a verification question, never a negative fact.
 */
import {normalizeProfile, societyKey, statusOf} from './matching.mjs?v=personal-2';
import {organizationKey} from './organizations.mjs';

export const ELIGIBILITY_STATUSES = Object.freeze({
  likely: 'Likely eligible',
  verify: 'Needs verification',
  ineligible: 'Likely ineligible',
});
const stageName={undergrad:'Undergraduate',masters:"Master’s student",phd:'PhD student',postdoc:'Postdoctoral researcher',resident:'Resident',faculty:'Faculty',staff:'Research staff'};
const stageText=x=>stageName[x]||String(x||'applicant');
const requiredNames=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim()):typeof value==='string'&&value.trim()?[value]:[];
const matchInstitution=(a,b)=>organizationKey(a)===organizationKey(b);
const isReviewedRecently=(record,today)=>{
  if(record.review_needed||!/^\d{4}-\d{2}-\d{2}$/.test(record.last_verified_at||''))return false;
  const elapsed=(Date.parse(`${today}T12:00:00Z`)-Date.parse(`${record.last_verified_at}T12:00:00Z`))/86400000;
  return elapsed>=0&&elapsed<=180;
};
const uniqueConditions=conditions=>conditions.filter((item,index)=>conditions.findIndex(c=>c.code===item.code)===index);

/**
 * @param {object} record An indexed opportunity; no external lookups occur.
 * @param {object} rawProfile Locally held research profile.
 * @param {object} options today is injectable to keep automated tests stable.
 * @returns {{kind:'likely'|'verify'|'ineligible',label:string,summary:string,checks:Array<{code:string,state:string,text:string}>,next:string,route:string}}
 */
export function evaluateEligibility(record,rawProfile,{today=new Date().toISOString().slice(0,10)}={}){
  const profile=normalizeProfile(rawProfile);
  const rules=record.eligibility_rules||{};
  const conditions=[];
  const add=(state,code,text)=>conditions.push({state,code,text});
  const stages=Array.isArray(record.eligible_stages)?record.eligible_stages:[];
  const route=rules.application_route||'unknown';
  const partner=route==='partner'||rules.faculty_lead_required===true||record.faculty_sponsor_possible===true;
  const noStage=profile.stage==='';
  const sponsorStatus=statusOf(record,today);
  const current=isReviewedRecently(record,today);

  if(noStage)add('unknown','stage','Add your current career stage to check applicant requirements.');
  else if(stages.length){
    if(stages.includes(profile.stage))add('pass','stage',`Career stage: ${stageText(profile.stage)} is listed.`);
    else if(partner)add('unknown','stage',`Career stage: ${stageText(profile.stage)} is not listed for direct applicants; a faculty or institutional partner may be possible.`);
    else add('fail','stage',`Career stage: ${stageText(profile.stage)} is not among the listed applicant stages (${stages.map(stageText).join(', ')}).`);
  }else add('unknown','stage','Eligible applicant career stages have not been structured for this program.');

  if(route==='partner'||rules.faculty_lead_required===true){
    add('unknown','faculty-lead','Faculty/institutional submission route: confirm an eligible lead investigator and your permitted role.');
  }else if(route==='direct')add('pass','route','An individual application route is listed (not proof of eligibility).');
  else add('unknown','route','The official individual-applicant versus institutional submission route has not been confirmed.');

  const memberships=requiredNames(rules.membership_required);
  if(memberships.length){
    const missing=memberships.filter(m=>!profile.societies.some(s=>societyKey(s)===societyKey(m)));
    if(missing.length)add('unknown','society',`Society membership not confirmed: ${missing.join(', ')}. Check whether membership can be obtained before applying.`);
    else add('pass','society',`Required society membership listed in profile: ${memberships.join(', ')}.`);
  }

  if(rules.institution_required){
    const required=requiredNames(rules.institution_required);
    if(required.length){
      if(required.some(name=>profile.institutions.some(inst=>matchInstitution(name,inst))))add('pass','institution',`Host institution matches ${required.join(' / ')}.`);
      else if(!profile.institutions.length)add('unknown','institution',`Confirm a qualifying host institution: ${required.join(' / ')}.`);
      else if(partner)add('unknown','institution',`Institution mismatch for direct application; confirm collaboration/host arrangements with ${required.join(' / ')}.`);
      else add('fail','institution',`The named host institution is restricted to ${required.join(' / ')}, not the listed affiliation.`);
    }else{
      const tag=record.affiliation_tags?.institution;
      if(!profile.institutions.length)add('unknown','institution','A host institution is required; your current institution is not recorded.');
      else if(tag&&profile.institutions.some(inst=>matchInstitution(inst,tag)))add('pass','institution',`Your institution matches the program's host listing (${tag}).`);
      else add('unknown','institution',`Confirm whether ${profile.institutions.join(', ')} is an accepted host institution${tag?` (program lists ${tag})`:''}.`);
    }
  }else if(record.category==='Institution'&&record.affiliation_tags?.institution){
    const tag=record.affiliation_tags.institution;
    if(profile.institutions.some(inst=>matchInstitution(inst,tag)))add('pass','institution',`Your affiliation matches the program's listed institution (${tag}); other institutional rules may apply.`);
    else add('unknown','institution',`The program is associated with ${tag}; confirm whether external applicants or partners can apply.`);
  }
  if(rules.campus)add('unknown','campus',`Confirm the campus-specific restriction: ${rules.campus}.`);

  if(rules.minimum_research_effort_percent!=null){
    const min=Number(rules.minimum_research_effort_percent);
    if(Number.isFinite(min)&&min>=0&&min<=100){
      if(profile.researchEffortPercent==null)add('unknown','research-effort',`Confirm at least ${min}% protected research time.`);
      else if(profile.researchEffortPercent<min)add('fail','research-effort',`Requires at least ${min}% protected research time; your profile lists ${profile.researchEffortPercent}%.`);
      else add('pass','research-effort',`Protected research time: ${profile.researchEffortPercent}% meets the ${min}% minimum (subject to institutional confirmation).`);
    }
  }
  if(rules.pi_privileges_required||rules.role==='principal_investigator'){
    if(profile.piPrivileges===null)add('unknown','pi','Confirm formal principal-investigator privileges at your institution.');
    else if(profile.piPrivileges===false&&partner)add('unknown','pi','You do not have PI privileges; confirm whether an eligible collaborator may serve as PI.');
    else if(profile.piPrivileges===false)add('fail','pi','Formal PI privileges are required, but your profile says you do not have them.');
    else add('pass','pi','Your profile reports PI privileges; confirm approval with your institution.');
  }
  if(rules.citizenship_required){
    const eligible=requiredNames(rules.citizenship_required);
    if(profile.citizenship==='unknown')add('unknown','citizenship','Confirm sponsor citizenship or immigration-status rules (not provided in profile).');
    else if(!eligible.includes(profile.citizenship)&&partner)add('unknown','citizenship','Citizenship/immigration category is not listed for a direct applicant; confirm whether an eligible institutional lead can submit.');
    else if(!eligible.includes(profile.citizenship))add('fail','citizenship','The citizenship/immigration eligibility options do not match the status in your profile.');
    else add('pass','citizenship','Your recorded citizenship/immigration category matches the indexed rule.');
  }
  const fixedHost=requiredNames(rules.current_host_regions);
  const hostRegions=fixedHost.length?fixedHost:requiredNames(rules.host_regions);
  if(hostRegions.length){
    if(!profile.researchRegion||profile.researchRegion==='Other')add('unknown','region',`Confirm that your research host is in ${hostRegions.join(' / ')}.`);
    else if(!hostRegions.includes(profile.researchRegion)&&partner&&!fixedHost.length)add('unknown','region',`Your host region (${profile.researchRegion}) is not on the list; confirm whether an eligible institutional collaborator can host the project.`);
    else if(!hostRegions.includes(profile.researchRegion))add('fail','region',`This program requires a research host in ${hostRegions.join(' / ')}. Your profile lists ${profile.researchRegion}.`);
    else add('pass','region',`Research host region (${profile.researchRegion}) is listed.`);
  }
  if(rules.minimum_years_since_phd!=null||rules.max_years_since_phd!=null){
    if(profile.yearsSincePhd==null){
      if(['undergrad','masters','phd'].includes(profile.stage))add('fail','phd-age','The call requires a completed PhD and a PhD-career eligibility window.');
      else add('unknown','phd-age','Confirm the number of years since PhD completion.');
    }else{
      const min=rules.minimum_years_since_phd,max=rules.max_years_since_phd;
      if(min!=null&&profile.yearsSincePhd<Number(min))add('fail','phd-age',`Requires at least ${min} years since PhD; profile has ${profile.yearsSincePhd}.`);
      else if(max!=null&&profile.yearsSincePhd>Number(max))add('fail','phd-age',`PhD career window is at most ${max} years; profile has ${profile.yearsSincePhd}.`);
      else add('pass','phd-age',`Years since PhD (${profile.yearsSincePhd}) are inside the indexed career window.`);
    }
  }
  if(rules.eligible_faculty_ranks?.length){
    if(profile.stage!=='faculty')add('unknown','faculty-rank','Faculty-rank restriction applies to the lead applicant; confirm your role.');
    else if(!profile.facultyRank)add('unknown','faculty-rank','Confirm faculty rank.');
    else if(!rules.eligible_faculty_ranks.includes(profile.facultyRank)&&partner)add('unknown','faculty-rank','Confirm whether a qualifying faculty lead can submit in place of the listed applicant.');
    else if(!rules.eligible_faculty_ranks.includes(profile.facultyRank))add('fail','faculty-rank',`Faculty rank ${profile.facultyRank} is not listed among eligible ranks.`);
    else add('pass','faculty-rank',`Faculty rank ${profile.facultyRank} matches the indexed requirement.`);
  }
  if(rules.eligible_appointments?.length){
    if(!profile.appointment)add('unknown','appointment','Confirm your formal appointment classification.');
    else if(!rules.eligible_appointments.includes(profile.appointment)&&partner)add('unknown','appointment','Your appointment is not listed for direct applicants; confirm permitted team and sponsor roles.');
    else if(!rules.eligible_appointments.includes(profile.appointment))add('fail','appointment',`Your appointment (${profile.appointment}) does not match the listed types.`);
    else add('pass','appointment',`Appointment ${profile.appointment} matches.`);
  }
  if(rules.mentor_required){
    if(profile.mentorConfirmed===true)add('pass','mentor','Your profile confirms required research mentor / sponsor support.');
    else if(profile.mentorConfirmed===false)add('unknown','mentor','The grant requires a mentor / sponsor; you have not confirmed one yet.');
    else add('unknown','mentor','Confirm required mentor / institutional sponsor support.');
  }
  if(rules.minimum_applicants!=null)add('unknown','team',`Confirm team of at least ${rules.minimum_applicants} applicants.`);
  if(rules.minimum_departments!=null)add('unknown','departments',`Confirm collaboration from at least ${rules.minimum_departments} departments.`);
  if(rules.required_prior_step)add('unknown','prior-step',String(rules.required_prior_step));
  if(rules.exclusion_group)add('unknown','exclusivity','Check whether applying to this program prohibits concurrent applications to related calls.');

  if(sponsorStatus==='closed')add('unknown','window','This round is closed; confirm eligibility again when a new call is published.');
  else if(sponsorStatus==='verify')add('unknown','window','The current application window has not been verified.');
  else if(sponsorStatus==='forecast')add('unknown','window','The application window is upcoming; recheck the official call when it opens.');
  if(!current)add('unknown','source','The funding record is unreviewed, flagged for review, or older than 180 days. Recheck the official source.');

  const checks=uniqueConditions(conditions);
  const failures=checks.filter(x=>x.state==='fail');
  const unresolved=checks.filter(x=>x.state==='unknown');
  // Sparse records must not become "likely eligible" from topic overlap,
  // stage alone, or a guessed direct-application path.
  const structuredEvidence=stages.length>0&&route==='direct'&&Object.keys(rules).some(k=>[
    'membership_required','institution_required','minimum_research_effort_percent','pi_privileges_required',
    'citizenship_required','host_regions','current_host_regions','minimum_years_since_phd','max_years_since_phd',
    'eligible_faculty_ranks','eligible_appointments','mentor_required','requirements_complete'
  ].includes(k));
  const kind=failures.length?'ineligible':unresolved.length||!structuredEvidence?'verify':'likely';
  if(kind==='verify'&&!unresolved.length)add('unknown','completeness','Structured applicant criteria are too sparse to establish a likely eligibility match.');
  const finalChecks=uniqueConditions(conditions);
  const summary=kind==='ineligible'?
    `${failures.length} known applicant requirement${failures.length===1?' conflicts':'s conflict'} with your current profile.`:
    kind==='likely'?'All indexed, structured applicant requirements currently match your profile. Other sponsor conditions may still apply.':
    `${finalChecks.filter(c=>c.state==='unknown').length} eligibility or source check${finalChecks.filter(c=>c.state==='unknown').length===1?' remains':'s remain'} unresolved.`;
  return {kind,label:ELIGIBILITY_STATUSES[kind],summary,checks:finalChecks,route,
    next:rules.next_step||'Review the current official call and check the remaining applicant requirements.',
    passCount:finalChecks.filter(c=>c.state==='pass').length,
    unknownCount:finalChecks.filter(c=>c.state==='unknown').length,
    failCount:failures.length,
    note:'Automated triage from catalog fields and your local profile—not a determination from the funder.'};
}
