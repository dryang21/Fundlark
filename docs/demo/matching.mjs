import {isAppointmentAllowed} from './appointment-options.mjs';
// Browser-only matching. These scores explain overlap, never applicant eligibility.
import {organizationKey, localInstitutions, resolveOrganization} from './organizations.mjs?v=1';
import {recordFields,FIELDS} from './explorer.mjs';
import {canonicalLabel,equivalentTerms,relatedTerms} from './taxonomy.mjs?v=personal-2';
import {normalizeHostRegion} from './host-regions.mjs';
export const SOCIETIES = ['IEEE', 'AAPM', 'ASTRO', 'ACR', 'Sigma Xi', 'ACM', 'ASCO', 'RSNA', 'American Chemical Society', 'American Physical Society', 'American Geophysical Union', 'American Economic Association', 'Modern Language Association'];
const synonyms = {
  'ai': ['artificial intelligence'],
  'ai agents': ['agentic ai', 'autonomous agents'],
  'foundation model agents': ['ai agents','agentic ai','artificial intelligence','large language models','foundation models'],
  'large language model': ['large language models','llm','generative ai','foundation models','artificial intelligence'],
  'reinforcement learning': ['machine learning','artificial intelligence'],
  'model predictive control': ['machine learning','artificial intelligence','optimization'],
  'machine learning': ['deep learning', 'artificial intelligence'],
  'medical physics': ['radiotherapy', 'radiation therapy', 'medical imaging'],
  'radiotherapy': ['radiation therapy', 'oncology'],
  'radiation oncology': ['radiotherapy','radiation therapy','medical physics','oncology'],
  'radiation therapy treatment planning': ['radiotherapy','radiation therapy','medical physics','oncology'],
  'large language models': ['generative ai', 'foundation models', 'llm'],
};
const norm = value => String(value || '').trim().toLocaleLowerCase();
const topicText = value => norm(value).replace(/[-\s]+/g, ' ');

const broadFields = new Set(['robotics','machine learning','artificial intelligence','computer vision',
  'computer science','software engineering','statistics','mathematics','ecology','conservation biology',
  'climate science','public health','epidemiology','medical physics','radiotherapy','oncology',
  'neuroscience','photonics','materials science','economics','linguistics','sociology']);
const includesTopic = (content, term) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${topicText(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^\\p{L}\\p{N}])`, 'u').test(content);
export function list(value) {
  return [...new Set(String(value || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean))].slice(0, 20);
}
const filler = new Set('i my our we me am is are a an the and or of for to in on at with by from as how what why which who this that these those study studies studying research researching researcher researchers work working works lab laboratory focus focuses focused interested interests interest investigate investigating investigates understand understanding develop developing development impact effects effect use using applications application project projects explore exploring analysis based professor student currently phd postdoc postdoctoral undergraduate masters faculty university institution college department'.split(' '));
export function researchTerms(value, knownTopics = []) {
  const segments = list(value), output = [];
  const phrases = [...new Set([...Object.keys(synonyms), ...Object.values(synonyms).flat(), ...knownTopics])].filter(t => typeof t === 'string' && t.trim().split(/\s+/).length > 1 && t.length < 100);
  for (const segment of segments) {
    const tokens = topicText(segment).match(/[\p{L}][\p{L}\p{N}+#]*/gu) || [];
    if (tokens.length <= 5 && !tokens.some(t => filler.has(t))) { output.push(segment); continue; }
    const meaningful = tokens.filter(t => !filler.has(t) && (t.length > 2 || t === 'ai'));
    const found = phrases.filter(p => includesTopic(topicText(segment), p)).sort((a,b)=>b.length-a.length);
    const selected = found.filter((p,index) => !found.slice(0,index).some(longer => includesTopic(topicText(longer), p)));
    output.push(...selected, ...meaningful.filter(t=>!selected.some(p=>includesTopic(topicText(p),t))));
  }
  return [...new Map(output.map(term => [norm(term), term.trim().slice(0,160)])).values()].slice(0,20);
}
export function normalizeProfile(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const strings = key => Array.isArray(value[key]) ? value[key].filter(x => typeof x === 'string').map(x => x.trim().slice(0, 160)).filter(Boolean).slice(0, 20) : [];
  // The extra details are optional. Unknown is not equivalent to 'no': for
  // eligibility decisions we must never infer citizenship, PI rights or time.
  const booleanOrUnknown = x => typeof x === 'boolean' ? x : null;
  const limitedNumber = (x, max) => x === '' || x === null || x === undefined || !Number.isFinite(Number(x)) || Number(x)<0 || Number(x)>max ? null : Number(x);
  const textField = key => typeof value[key] === 'string' ? value[key].slice(0,3200) : '';
  const background=Object.hasOwn(value,'researchBackground')?textField('researchBackground'):textField('researchText');
  const proposal=textField('researchProposal'),keywords=textField('researchKeywords').slice(0,1200);
  return {topics: strings('topics'), excludedTopics: strings('excludedTopics'), societies: [...new Map(strings('societies').map(name=>[societyKey(name),name])).values()], institutions: strings('institutions'),
    researchBackground:background,researchProposal:proposal,researchKeywords:keywords,
    researchText:[background,proposal,keywords].filter(Boolean).join('; ').slice(0,3200),
    stage: ['undergrad','masters','phd','postdoc','resident','faculty','staff'].includes(value.stage) ? value.stage : '',
    appointment: isAppointmentAllowed(value.stage,value.appointment) ? value.appointment : '',
    facultyRank: value.stage==='faculty' && ['assistant','associate','full','other'].includes(value.facultyRank) ? value.facultyRank : '',
    researchRegion: normalizeHostRegion(value.researchRegion),
    academicYear: ['undergrad','masters','phd'].includes(value.stage)?limitedNumber(value.academicYear,15):null,
    expectedCompletionYear: ['undergrad','masters','phd','resident','postdoc'].includes(value.stage)?limitedNumber(value.expectedCompletionYear,2100):null,
    phdCompletionYear: ['postdoc','resident','faculty','staff'].includes(value.stage)?limitedNumber(value.phdCompletionYear,2100):null,
    yearsSincePhd: ['postdoc','resident','faculty','staff'].includes(value.stage)
      ? (limitedNumber(value.phdCompletionYear,2100)!=null
          ? (Number(value.phdCompletionYear)<=new Date().getFullYear()&&Number(value.phdCompletionYear)>=1950?new Date().getFullYear()-Number(value.phdCompletionYear):null)
          : limitedNumber(value.yearsSincePhd,80))
      : null,
    researchEffortPercent: ['phd','postdoc','resident','faculty','staff'].includes(value.stage)?limitedNumber(value.researchEffortPercent,100):null,
    piPrivileges: ['postdoc','resident','faculty','staff'].includes(value.stage)?booleanOrUnknown(value.piPrivileges):null,
    mentorConfirmed: ['undergrad','masters','phd','postdoc','resident','staff'].includes(value.stage)?booleanOrUnknown(value.mentorConfirmed):null,
    citizenship: ['us_citizen','us_permanent_resident','other','unknown'].includes(value.citizenship) ? value.citizenship : 'unknown',
    sharePublic: value.sharePublic === true};
}
const societyAliases={
    instituteofelectricalandelectronicsengineers:'ieee', associationforcomputingmachinery:'acm',
    sigmaxithescientificresearchhonorsociety:'sigmaxi', sigmaxiscientificresearchhonorsociety:'sigmaxi',
    americanphysicalsociety:'aps', americanassociationofphysicistsinmedicine:'aapm',
    americansocietyforradiationoncology:'astro', americansocietyofclinicaloncology:'asco',
    radiologicalsocietyofnorthamerica:'rsna', americangeophysicalunion:'agu',
    europeangeosciencesunion:'egu', britishecologicalsociety:'bes',
    americansocietyofmechanicalengineers:'asme', societyforindustrialandappliedmathematics:'siam',
    ieeeroboticsandautomationsociety:'ieeeras', roboticsandautomationsociety:'ieeeras',
    ieeecomputersociety:'ieeecs', acmsigsoft:'sigsoft', acmsigchi:'sigchi',
    acmsigplan:'sigplan', acmsigir:'sigir', sigircommunity:'sigir',
    instituteofphysics:'iop', ecologicalsocietyofamerica:'esa',
    royalsocietyofchemistry:'rsc', associationforpsychologicalscience:'apspsychology',
    americanchemicalsociety:'acs', americancollegeofradiology:'acr'
  };
const extraSocietyAliases=new Map();
export function configureSocietyAliases(entries){
  extraSocietyAliases.clear();
  for(const {kind,name,alias} of entries){
    if(kind==='society'&&alias)extraSocietyAliases.set(organizationKey(name),organizationKey(alias));
  }
}
export function societyKey(value) {
  const key=organizationKey(value);
  return Object.hasOwn(societyAliases,key)?societyAliases[key]:extraSocietyAliases.get(key)||key;
}
const institutionKey=value=>organizationKey(resolveOrganization(value,localInstitutions));
export function membershipMatches(record, societies) {
  const confirmed = new Set(societies.map(societyKey).filter(Boolean));
  return (record.affiliation_tags?.societies||[]).filter(name=>confirmed.has(societyKey(name)));
}
export function institutionMatches(record, institutions) {
  const institution=record.affiliation_tags?.institution;
  return Boolean(institution&&institutions.some(name=>institutionKey(institution)===institutionKey(name)));
}
export function linkedPrograms(records, ids) {
  const wanted=new Set(ids);
  return records.filter(record=>wanted.has(record.id))
    .sort((a,b)=>Number(statusOf(a)==='closed')-Number(statusOf(b)==='closed'));
}
export function match(record, profile) {
  const content = topicText([record.title, record.funder, record.description, ...(record.topics || [])].join(' '));
  const topicEvidence = profile.topics.flatMap(term => {
    if (includesTopic(content, term)) return [{term, matched:term, related:false}];
    const aliases=[...equivalentTerms(term),...(Object.hasOwn(synonyms,norm(term))?synonyms[norm(term)]:[])];
    const same=aliases.find(word=>includesTopic(content,word));
    if(same)return [{term, matched:same, related:true}];
    // Related subjects aid interdisciplinary recall but carry less weight
    // than exact terms or true synonyms. Do not expand every broad field.
    const linked=relatedTerms(term,{limit:3}).find(word=>includesTopic(content,word));
    if(linked)return [{term,matched:linked,related:true}];
    const broader=(record.topics||[]).map(topicText).filter(field=>broadFields.has(field))
      .sort((a,b)=>b.length-a.length).find(field=>includesTopic(topicText(term),field));
    if(broader)return [{term,matched:broader,related:true}];
    // Interdisciplinary recall: specific concepts such as archaeology or crop
    // genetics can match a program classified under humanities or agriculture.
    // This is a weak topic lead, not an eligibility conclusion.
    const termFields=recordFields({title:term});
    // Prefer curator-supplied subject tags over incidental words in the title.
    // An unrelated program merely mentioning 'robotics' should not become
    // a robotics funding lead when its actual topics are linguistics.
    const programFields=recordFields(record.field_ids?.length ? {field_ids:record.field_ids} : (record.topics?.length ? {topics:record.topics} : record));
    const shared=termFields.find(field=>programFields.includes(field));
    return shared?[{term,matched:'field: '+(FIELDS.find(field=>field.id===shared)?.label||shared),related:true}]:[];
  });
  const hits = topicEvidence.map(item=>item.term);
  const tags = record.affiliation_tags || {};
  const affiliations = membershipMatches(record, profile.societies);
  const institutionMatch=institutionMatches(record,profile.institutions);
  if(institutionMatch)affiliations.push(tags.institution);
  const requestedAffiliation=Boolean(tags.institution||tags.societies?.length);
  const stages = record.eligible_stages || [];
  let stage = 'Check applicant rules';
  if (profile.stage && stages.length) stage = stages.includes(profile.stage) ? 'Career stage listed; other rules apply' : record.faculty_sponsor_possible ? 'May need a faculty collaborator' : 'Career stage may not qualify';
  const stageConcern=Boolean(profile.stage && stages.length && !stages.includes(profile.stage));
  const affiliationConcern=requestedAffiliation&&!affiliations.length;
  const scores=new Map();
  for(const {term,matched,related} of topicEvidence){
    const score=related&&relatedTerms(term,{limit:3}).some(r=>norm(r)===norm(matched))?3:related&&norm(term)!=='ai'?5:10;
    const key=topicText(matched);
    scores.set(key,Math.max(scores.get(key)||0,score));
  }
  return {hits, topicEvidence, affiliations, stage, stageConcern, affiliationConcern,
    stageMatch:Boolean(profile.stage&&stages.includes(profile.stage)),
    score: [...scores.values()].reduce((n,score)=>n+score,0)+affiliations.length*15};
}
export function statusOf(record, today = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)) {
  if(record.status==='closed'||record.deadline&&record.deadline<today)return 'closed';
  if(record.opens_on&&today<record.opens_on)return 'forecast';
  // A scheduled opening date is not proof that the portal opened.
  if(record.status==='forecast'&&record.opens_on)return 'verify';
  return record.status;
}
/**
 * Conservative guidance, NOT an eligibility verdict. A topic/career-stage hit
 * can never by itself become a "direct application". Every reason is shown.
 * Only explicit structured rules are assessed; unstructured conditions must
 * be checked on the official sponsor page.
 */
export function applicationPath(record, rawProfile) {
  const profile=normalizeProfile(rawProfile), fit=record.matching||match(record,profile);
  const rules=record.eligibility_rules||{}, blockers=[], checks=[];
  const next=rules.next_step||'Read the current official call and confirm every applicant requirement.';
  if(statusOf(record)==='closed')return {kind:'watch',label:'Past round / closed',next:'Watch the official sponsor for a new round.',blockers:[],checks:[]};
  const member=Array.isArray(rules.membership_required)?rules.membership_required:[];
  const missingMembership=member.filter(name=>!profile.societies.some(value=>societyKey(value)===societyKey(name)));
  if(missingMembership.length)checks.push(`Confirm required membership: ${missingMembership.join(', ')}`);
  if(fit.affiliationConcern && record.category==='Institution') checks.push('Confirm this institution accepts external applicants');
  if(rules.institution_required){
    const required=Array.isArray(rules.institution_required)?rules.institution_required:
      typeof rules.institution_required==='string'?[rules.institution_required]:[];
    if(required.length&&!required.some(name=>profile.institutions.some(value=>institutionKey(name)===institutionKey(value))))
      checks.push(`Confirm eligible host institution: ${required.join(', ')}`);
    else if(!required.length&&!profile.institutions.length)checks.push('Confirm host institution requirement');
  }
  if(rules.minimum_research_effort_percent!=null){
    const min=Number(rules.minimum_research_effort_percent);
    if(profile.researchEffortPercent==null) checks.push(`Confirm at least ${min}% protected research effort`);
    else if(profile.researchEffortPercent<min) blockers.push(`${min}% research effort required; you entered ${profile.researchEffortPercent}%`);
  }
  if(rules.pi_privileges_required){
    if(profile.piPrivileges===null)checks.push('Confirm institutional PI privileges');
    if(profile.piPrivileges===false)blockers.push('Institutional PI privileges required');
  }
  if(rules.mentor_required)checks.push('Confirm mentor/sponsor support');
  if(rules.faculty_lead_required)checks.push('A faculty lead must be confirmed');
  if(rules.citizenship_required){
    const eligible=Array.isArray(rules.citizenship_required)?rules.citizenship_required:[rules.citizenship_required];
    if(profile.citizenship==='unknown')checks.push('Check citizenship or permanent-residence requirement');
    else if(!eligible.includes(profile.citizenship))blockers.push('Citizenship/residency rule conflicts with your profile');
  }
  if(rules.minimum_years_since_phd!=null){
    if(profile.yearsSincePhd==null)checks.push('Confirm minimum years since PhD');
    else if(profile.yearsSincePhd<Number(rules.minimum_years_since_phd))blockers.push('Below stated years-since-PhD minimum');
  }
  if(rules.host_regions?.length){
    if(!profile.researchRegion||profile.researchRegion==='Other')checks.push('Confirm eligible research host country or region');
    else if(!rules.host_regions.includes(profile.researchRegion))checks.push('Your current host region is not on the program list; confirm relocation or collaboration options');
  }
  if(rules.max_years_since_phd!=null){
    if(profile.yearsSincePhd==null)checks.push('Confirm years since PhD');
    else if(profile.yearsSincePhd>Number(rules.max_years_since_phd))blockers.push('Outside stated years-since-PhD limit');
  }
  if(rules.eligible_faculty_ranks?.length&&profile.stage==='faculty'){
    if(!profile.facultyRank)checks.push('Confirm faculty rank');
    else if(!rules.eligible_faculty_ranks.includes(profile.facultyRank))blockers.push('Faculty rank does not match this call');
  }
  if(rules.eligible_appointments?.length){
    if(!profile.appointment)checks.push('Confirm appointment subtype');
    else if(!rules.eligible_appointments.includes(profile.appointment))blockers.push('Appointment subtype does not match this call');
  }
  const stageKnown=Boolean(profile.stage&&(record.eligible_stages||[]).length);
  const mismatched=stageKnown&&fit.stageConcern;
  if(mismatched)blockers.unshift(`Listed stages do not include ${profile.stage}`);
  const partner=rules.application_route==='partner'||rules.faculty_lead_required===true||
    (mismatched&&record.faculty_sponsor_possible===true);
  if(partner)return {kind:'partner',label:'Faculty / institutional application route',next,blockers,checks};
  if(blockers.length&&mismatched)return {kind:'ineligible',label:'Stage not listed — check exceptions',next,blockers,checks};
  if(blockers.length||checks.length)return {kind:'check',label:missingMembership.length?`Confirm ${missingMembership.join(' / ')} membership`:
    rules.minimum_research_effort_percent!=null&&profile.researchEffortPercent==null?`Confirm ${rules.minimum_research_effort_percent}% research effort`:
    rules.pi_privileges_required&&profile.piPrivileges===null?'Confirm PI privileges':'Eligibility requirements unresolved',next,blockers,checks};
  // Explicit editorial route = an individual can start the submission, NOT a
  // declaration that this specific profile meets every official condition.
  if(rules.application_route==='direct'&&!mismatched)
    return {kind:'direct',label:'Direct route indicated — verify official rules',next,blockers,checks};
  // A sparse catalog record, even with an apparent resident-stage match,
  // does not establish who may legally apply.
  return {kind:'check',label:'Applicant route not verified',next,blockers,checks:['Verify appointment, institution, nationality, PI and other applicant rules']};
}
export function fundingBrief(records,profile) {
  const groups={direct:[],partner:[],check:[]};
  const candidates=[];
  for(const record of records){
    if(!record.last_verified_at||record.review_needed||statusOf(record)==='closed')continue;
    const path=applicationPath(record,profile);
    const rules=record.eligibility_rules||{};
    const stageFit=(record.eligible_stages||[]).includes(profile.stage);
    const explicit=rules.next_step&&rules.application_route;
    if(path.kind==='ineligible'||path.kind==='watch')continue;
    if((record.matching||match(record,profile)).stageConcern&&path.kind!=='partner'&&!explicit)continue;
    // Prioritize research-specific, documented eligibility conditions over
    // generic school-only associations; this is an action list, not a win probability.
    const actionable=Boolean(rules.membership_required?.length||rules.minimum_research_effort_percent!=null||rules.citizenship_required||rules.pi_privileges_required);
    const weight=(stageFit?3:0)+(explicit?3:0)+(actionable?4:0)+(path.kind==='direct'?4:0)+
      (statusOf(record)==='open'?2:statusOf(record)==='rolling'?1:0)+
      Math.min((record.matching||match(record,profile)).affiliations.length,2)*3+
      (record.matching||match(record,profile)).score/100;
    candidates.push({record,path,weight});
  }
  candidates.sort((a,b)=>b.weight-a.weight);
  for(const {record,path} of candidates){
    if(groups[path.kind]&&groups[path.kind].length<3)groups[path.kind].push({record,path});
  }
  return groups;
}
/** Higher = better lead to investigate, not greater probability of an award. */
export function fundingPriority(record,profile){
  const fit=record.matching||match(record,profile);
  const route=applicationPath(record,profile),status=statusOf(record);
  const stageFit=fit.stageMatch?18:0;
  const routeWeight={direct:8,partner:4,check:0,ineligible:-100,watch:-100}[route.kind]??0;
  const statusWeight={open:5,rolling:5,forecast:2,verify:0,closed:-100}[status]??0;
  const sourceWeight=record.last_verified_at&&!record.review_needed?4:-3;
  const explicitRoute=record.eligibility_rules?.application_route?7:0;
  const catalogPenalty=['grantsgov_api','institution_listing'].includes(record.origin)?-8:0;
  return Math.min(fit.score,75)*0.4+stageFit+routeWeight+statusWeight+sourceWeight+explicitRoute+catalogPenalty+
    Math.min(fit.affiliations.length,2)*3-(fit.affiliationConcern?8:0)-(fit.stageConcern?3:0);
}
/**
 * Whether a record deserves a place in the personalized *actionable leads*
 * view. This is a relevance-and-known-blockers filter, never a determination
 * that the applicant is officially eligible. A broad shared discipline alone
 * is insufficient unless the sponsor explicitly includes this career stage
 * or documents an individual/faculty application route.
 *
 * Important: the full catalog remains independently accessible in Browse.
 */
export function plausibleProfileLead(record, rawProfile) {
  const profile=normalizeProfile(rawProfile);
  const fit=record.matching||match(record,profile);
  const path=applicationPath({...record,matching:fit},profile);
  if(['watch','ineligible'].includes(path.kind))return false;
  // Keep topically relevant records with known non-stage blockers in the
  // dashboard so 'Likely ineligible' can explain why; do not silently
  // discard them before the user can inspect the requirements.
  if(fit.stageConcern&&path.kind!=='partner')return false;
  if(record.category==='Institution'&&record.affiliation_tags?.institution&&!institutionMatches(record,profile.institutions))return false;
  const rules=record.eligibility_rules||{};
  const exactOrSynonym=fit.topicEvidence.some(e=>!e.related || !e.matched.startsWith('field:'));
  if(record.scope_requires_topic_match&&!exactOrSynonym)return false;
  const fieldOnly=fit.topicEvidence.some(e=>e.matched.startsWith('field:'));
  const affiliated=fit.affiliations.length>0;
  const explicitRoute=['direct','partner'].includes(rules.application_route);
  if(profile.topics.length) return Boolean(exactOrSynonym || (affiliated&&(fit.topicEvidence.length||fit.stageMatch)) || (fieldOnly&&(fit.stageMatch||explicitRoute)));
  // A career-stage-only profile should not match hundreds of generic calls.
  return Boolean(affiliated || fit.stageMatch);
}
export function selectRecords(records, profile, {query='',category='all',availability='active',fundingType='',matchedOnly=false,recommendedOnly=false,savedOnly=false,saved=[]} = {}) {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const stageOnly=profile.stage&&!profile.topics.length&&!profile.societies.length&&!profile.institutions.length;
  return records.map(o=>({...o,matching:match(o,profile)})).filter(o=>{
    const internal=o.category==='Institution'&&o.affiliation_tags?.institution;
    if(matchedOnly&&internal&&!institutionMatches(o,profile.institutions))return false;
    if(matchedOnly&&recommendedOnly&&!plausibleProfileLead(o,profile))return false;
    const status=statusOf(o);
    const available=availability==='all'||(availability==='active'?status!=='closed':availability==='open'?['open','rolling'].includes(status):status===availability);
    return (category==='all'||o.category===category)&&available&&(!fundingType||o.funding_type===fundingType)&&(!matchedOnly||o.matching.score>0||stageOnly&&o.matching.stageMatch)&&(!savedOnly||saved.includes(opportunityKey(o)))&&terms.every(term=>[o.title,o.funder,o.description,...(o.topics||[]),...(o.affiliation_tags?.societies||[]),...(o.affiliation_tags?.conferences||[])].join(' ').toLowerCase().includes(term));
  }).sort((a,b)=>Number(statusOf(a)==='closed')-Number(statusOf(b)==='closed')||
    (matchedOnly?fundingPriority(b,profile)-fundingPriority(a,profile):0)||
    ({open:0,rolling:0,forecast:1,verify:2}[statusOf(a)]??3)-({open:0,rolling:0,forecast:1,verify:2}[statusOf(b)]??3)||
    b.matching.score-a.matching.score);
}
export function discoveryLinks(profile, sources=[]) {
  const links=[];
  for(const [kind,names] of [['society',profile.societies],['institution',profile.institutions]]) for(const name of names){
    const key=kind==='society'?societyKey:institutionKey;
    const official=sources.find(s=>s[kind]&&key(s[kind])===key(name));
    links.push(official ? {label:`${name}: ${official.mode==='directory'?'official directory':'funding page'}`,url:official.url,note:official.mode==='directory'?official.description:''} : {label:`Search ${name} funding`,url:`https://www.google.com/search?q=${encodeURIComponent(`"${name}" official research grants fellowships funding`)}`});
  }
  if(profile.topics.length) links.push({label:'Search the web for related funding',url:`https://www.google.com/search?q=${encodeURIComponent(profile.topics.slice(0,4).join(' ')+' research grants fellowships official funding')}`});
  return links.slice(0,8);
}
export function opportunityKey(record) {
  try {
    const url = new URL(record.url);
    url.hash = ''; url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return `${url.href.replace(/\/$/, '')}|${record.round || (record.deadline || '').slice(0,4) || 'recurring'}|${norm(record.title).replace(/\s+/g, ' ')}`;
  } catch { return record.id; }
}
export function mergeCatalog(base, community) {
  // Imported editions may label the same official URL differently from an editorial record.
  const officialRoute = record => {
    try {
      const url=new URL(record.url);
      const host=url.hostname.replace(/^www\./,'');
      return (host==='grants.gov'||host==='seedfunding.stanford.edu'||host==='ukri.org'&&/^\/opportunity\/[a-z0-9-]+\/?$/i.test(url.pathname))?host+url.pathname.replace(/\/$/,''):'';
    } catch { return ''; }
  };
  const imported = record => ['grantsgov_api','institution_listing','ukri_listing'].includes(record.origin);
  const routes=new Map();
  const merged = new Map(base.map(record => [opportunityKey(record), record]));
  for(const [key,record] of merged){
    const route=officialRoute(record);
    if(route)routes.set(route,key);
  }
  for (const record of community){
    const route=officialRoute(record);
    const previousKey=route&&routes.get(route);
    const previous=previousKey&&merged.get(previousKey);
    if(previous&&!imported(previous)&&imported(record))continue;
    if(previous&&imported(previous)&&previousKey!==opportunityKey(record))merged.delete(previousKey);
    const key=opportunityKey(record);
    merged.set(key,record);
    if(route)routes.set(route,key);
  }
  return [...merged.values()];
}
export function assistantPrompt(profile, apiBase = '', {skillMode=false} = {}) {
  const lines = ['Find research funding relevant to my profile. Use the shared catalog as a starting point when accessible, then search official sources and verify current calls.',
    `Research description: ${[profile.researchBackground,profile.researchProposal].filter(Boolean).join('; ') || 'Not specified'}`,
    `Research keywords: ${profile.researchKeywords || profile.topics.join('; ') || 'Not specified'}`,
    `Career stage: ${profile.stage || 'Not specified'}`,
    `Confirmed memberships: ${profile.societies.join('; ') || 'Not specified'}`,
    `Current institutions: ${profile.institutions.join('; ') || 'Not specified'}`,
    'Search official government, industry, foundation, society and institutional funding sources relevant to my field and geography. Ask about location or applicant type only if it changes eligibility.',
    'Explain research relevance separately from eligibility. Include official URLs, source check dates, deadlines and uncertainties. Do not assume a medical field.',
    'Start with three to five priorities and an upcoming deadline calendar. Group leads into direct applications, institution or faculty-led applications, requirements to confirm, and future rounds. Include precise blockers such as protected research effort, PI privileges and mutually exclusive submissions when the official call states them. Never count credits as cash.',
    'For each opportunity, link the title to its official call and give exactly three concise bullets: What it funds (scope and amount), Who can apply (key applicant rules and how my profile fits), and When to act (current status, deadline or next step). If you cannot browse current official pages, say so.',
    'Shared funding catalog: https://raw.githubusercontent.com/dryang21/Fundlark/main/docs/demo/data.json and https://raw.githubusercontent.com/dryang21/Fundlark/main/docs/demo/supplemental.json (starting indexes; check official calls).'];
  if(!skillMode) lines.push('This request works as an ordinary research prompt; no Fundlark skill installation is required.');
  if (apiBase && skillMode) {
    lines.push(`Fundlark public service: ${apiBase}/api/catalog (reviewed community records); ${apiBase}/api/contributions (public opportunity contribution endpoint).`);
    if (profile.sharePublic && skillMode) lines.push('I authorize contributing newly discovered public funding facts to that Fundlark service in the background. Follow the installed Fundlark skill contribution reference and its strict schema. Share no personal research profile, conversation or private institutional information. Contribution failure must not block my results.');
  }
  if (!apiBase || !profile.sharePublic || !skillMode) lines.push('Do not submit contributions in this session; this brief does not enable automatic sharing.');
  return lines.join('\n');
}
export function shortlistText(records) {
  const labels={verify:'Application window unconfirmed',forecast:'Upcoming call',open:'Listed open; confirm official call',rolling:'Listed rolling; confirm availability',closed:'Past round / closed'};
  return records.map(o=>`${o.title}\n${o.funder} · ${o.amount || 'Amount not provided'}\nDeadline: ${o.deadline || 'Check official call'} · Status: ${labels[statusOf(o)]||labels.verify}\n${o.eligibility || 'Check applicant rules.'}\n${o.archived?'Saved snapshot; no longer in the current catalog. Recheck the official page.\n':''}${o.url}`).join('\n\n');
}
export function publicRecordSnapshot(record) {
  const fields=['id','title','funder','category','url','round','amount','deadline','status','description','eligibility','topics','eligible_stages','faculty_sponsor_possible','affiliation_tags','last_verified_at','origin','review_needed','amount_min','amount_max','currency','award_period_months','opens_on','deadline_time','deadline_timezone','eligibility_rules'];
  return Object.fromEntries(fields.filter(key=>record[key]!==undefined).map(key=>[key,record[key]]));
}
export function restoreShortlist(records, entries) {
  const current=new Map(records.map(record=>[opportunityKey(record),record]));
  return entries.flatMap(entry=>{
    const latest=current.get(entry.key),record=entry.library?entry.record:latest||entry.record;
    if(!record)return [];
    const changed=latest&&entry.record&&['description','deadline','amount','eligibility','status'].some(key=>JSON.stringify(latest[key])!==JSON.stringify(entry.record[key]));
    return [{...record,savedKey:entry.key,archived:!latest&&!entry.library,detailsChanged:!entry.library&&Boolean(changed)}];
  });
}
export function freshness(record, now=Date.now()) {
  if(record.review_needed)return 'Source changed — review required';
  const stamp=Date.parse(record.last_verified_at||'');
  if(!Number.isFinite(stamp))return 'Check date unknown — recheck source';
  if(now-stamp>30*86400000)return 'Over 30 days old — recheck source';
  return '';
}
