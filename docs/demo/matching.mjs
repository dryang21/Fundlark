// Browser-only matching. These scores explain overlap, never applicant eligibility.
export const SOCIETIES = ['IEEE', 'AAPM', 'ASTRO', 'Sigma Xi', 'ACM', 'ASCO', 'RSNA', 'American Chemical Society', 'American Physical Society', 'American Geophysical Union', 'American Economic Association', 'Modern Language Association'];
export const INSTITUTIONS = ['Stanford University', 'Harvard University', 'Massachusetts Institute of Technology', 'University of California, San Francisco', 'University of Toronto'];
const synonyms = {
  'ai': ['artificial intelligence'],
  'ai agents': ['agentic ai', 'autonomous agents'],
  'machine learning': ['deep learning', 'artificial intelligence'],
  'medical physics': ['radiotherapy', 'radiation therapy', 'medical imaging'],
  'radiotherapy': ['radiation therapy', 'oncology'],
  'large language models': ['generative ai', 'foundation models', 'llm'],
};
const norm = value => String(value || '').trim().toLocaleLowerCase();
const topicText = value => norm(value).replace(/[-\s]+/g, ' ');
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
  return {topics: strings('topics'), societies: strings('societies'), institutions: strings('institutions'), researchText: typeof value.researchText === 'string' ? value.researchText.slice(0,3200) : '',
    stage: ['undergrad','masters','phd','postdoc','resident','faculty','staff'].includes(value.stage) ? value.stage : '',
    sharePublic: value.sharePublic === true};
}
export function match(record, profile) {
  const content = topicText([record.title, record.funder, record.description, ...(record.topics || [])].join(' '));
  const topicEvidence = profile.topics.flatMap(term => {
    if (includesTopic(content, term)) return [{term, matched:term, related:false}];
    const related = Object.hasOwn(synonyms,norm(term)) ? synonyms[norm(term)].find(word=>includesTopic(content,word)) : undefined;
    return related ? [{term, matched:related, related:true}] : [];
  });
  const hits = topicEvidence.map(item=>item.term);
  const tags = record.affiliation_tags || {};
  const societies = profile.societies.map(norm), institutions = profile.institutions.map(norm);
  const affiliations = (tags.societies || []).filter(name => societies.includes(norm(name)));
  if (tags.institution && institutions.includes(norm(tags.institution))) affiliations.push(tags.institution);
  const stages = record.eligible_stages || [];
  let stage = 'Check applicant rules';
  if (profile.stage && stages.length) stage = stages.includes(profile.stage) ? 'Career stage listed; other rules apply' : record.faculty_sponsor_possible ? 'May need a faculty collaborator' : 'Career stage may not qualify';
  return {hits, topicEvidence, affiliations, stage, stageConcern: Boolean(profile.stage && stages.length && !stages.includes(profile.stage)), score: hits.length * 10 + affiliations.length * 15};
}
export function statusOf(record, today = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)) { return record.deadline && record.deadline < today ? 'closed' : record.status; }
export function selectRecords(records, profile, {query='',category='all',availability='active',fundingType='',matchedOnly=false,savedOnly=false,saved=[]} = {}) {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.map(o=>({...o,matching:match(o,profile)})).filter(o=>{
    const status=statusOf(o);
    const available=availability==='all'||(availability==='active'?status!=='closed':availability==='open'?['open','rolling'].includes(status):status===availability);
    return (category==='all'||o.category===category)&&available&&(!fundingType||o.funding_type===fundingType)&&(!matchedOnly||o.matching.score>0)&&(!savedOnly||saved.includes(opportunityKey(o)))&&terms.every(term=>[o.title,o.funder,o.description,...(o.topics||[])].join(' ').toLowerCase().includes(term));
  }).sort((a,b)=>Number(statusOf(a)==='closed')-Number(statusOf(b)==='closed')||b.matching.score-a.matching.score||Number(a.matching.stageConcern)-Number(b.matching.stageConcern)||({open:0,rolling:0,forecast:1,verify:2}[statusOf(a)]??3)-({open:0,rolling:0,forecast:1,verify:2}[statusOf(b)]??3));
}
export function discoveryLinks(profile, sources=[]) {
  const links=[];
  for(const [kind,names] of [['society',profile.societies],['institution',profile.institutions]]) for(const name of names){
    const official=sources.find(s=>norm(s[kind])===norm(name));
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
  const merged = new Map(base.map(record => [opportunityKey(record), record]));
  for (const record of community) merged.set(opportunityKey(record), record);
  return [...merged.values()];
}
export function assistantPrompt(profile, apiBase = '', {skillMode=false} = {}) {
  const lines = ['Find research funding relevant to my profile. Use the shared catalog as a starting point when accessible, then search official sources and verify current calls.',
    `Research topics: ${profile.researchText || profile.topics.join('; ') || 'Use the research context I provide in this chat.'}`,
    `Career stage: ${profile.stage || 'Not specified'}`,
    `Confirmed memberships: ${profile.societies.join('; ') || 'Not specified'}`,
    `Current institutions: ${profile.institutions.join('; ') || 'Not specified'}`,
    'Search official government, industry, foundation, society and institutional funding sources relevant to my field and geography. Ask about location or applicant type only if it changes eligibility.',
    'Explain research relevance separately from eligibility. Include official URLs, source check dates, deadlines and uncertainties. Do not assume a medical field.',
    'Return a short table with funding amount when known, current application status, eligibility concerns and my next step. If you cannot browse current official pages, say so rather than claiming live verification.',
    'Shared funding catalog: https://raw.githubusercontent.com/dryang21/Fundlark/main/docs/demo/data.json (a starting index; it is not exhaustive or necessarily current).'];
  if(!skillMode) lines.push('This request works as an ordinary research prompt; no Fundlark skill installation is required.');
  if (apiBase && skillMode) {
    lines.push(`Fundlark public service: ${apiBase}/api/catalog (reviewed community records); ${apiBase}/api/contributions (public opportunity contribution endpoint).`);
    if (profile.sharePublic && skillMode) lines.push('I authorize contributing newly discovered public funding facts to that Fundlark service in the background. Follow the installed Fundlark skill contribution reference and its strict schema. Share no CV, personal profile, conversation or private institutional information. Contribution failure must not block my results.');
  }
  if (!apiBase || !profile.sharePublic || !skillMode) lines.push('Do not submit contributions in this session; this brief does not enable automatic sharing.');
  return lines.join('\n');
}
export function shortlistText(records) {
  const labels={verify:'Application window unconfirmed',forecast:'Upcoming call',open:'Listed open; confirm official call',rolling:'Listed rolling; confirm availability',closed:'Past round / closed'};
  return records.map(o=>`${o.title}\n${o.funder} · ${o.amount || 'Amount not provided'}\nDeadline: ${o.deadline || 'Check official call'} · Status: ${labels[statusOf(o)]||labels.verify}\n${o.eligibility || 'Check applicant rules.'}\n${o.archived?'Saved snapshot; no longer in the current catalog. Recheck the official page.\n':''}${o.url}`).join('\n\n');
}
export function publicRecordSnapshot(record) {
  const fields=['id','title','funder','category','url','round','amount','deadline','status','description','eligibility','topics','eligible_stages','faculty_sponsor_possible','affiliation_tags','last_verified_at','origin','review_needed'];
  return Object.fromEntries(fields.filter(key=>record[key]!==undefined).map(key=>[key,record[key]]));
}
export function restoreShortlist(records, entries) {
  const current=new Map(records.map(record=>[opportunityKey(record),record]));
  return entries.flatMap(entry=>{
    const latest=current.get(entry.key),record=latest||entry.record;
    if(!record)return [];
    const changed=latest&&entry.record&&['description','deadline','amount','eligibility','status'].some(key=>JSON.stringify(latest[key])!==JSON.stringify(entry.record[key]));
    return [{...record,savedKey:entry.key,archived:!latest,detailsChanged:Boolean(changed)}];
  });
}
export function freshness(record, now=Date.now()) {
  if(record.review_needed)return 'Source changed — review required';
  const stamp=Date.parse(record.last_verified_at||'');
  if(!Number.isFinite(stamp))return 'Check date unknown — recheck source';
  if(now-stamp>30*86400000)return 'Over 30 days old — recheck source';
  return '';
}
