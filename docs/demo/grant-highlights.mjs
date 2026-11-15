/** Compact, source-grounded, non-eligibility-program summaries for funding cards. */
const normalize = value => String(value ?? '').replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
const LIMIT = 196;
function shorten(raw, max=LIMIT) {
  const value=normalize(raw).replace(/^Listing excerpt:\s*["“]?/i,'').replace(/["”]+$/,'').trim();
  if(value.length<=max)return value;
  let partial=value.slice(0,max-1).replace(/\s+\S*$/,'').replace(/[;,:.\s]+$/,'');
  return `${partial||value.slice(0,max-1)}…`;
}
function isBoilerplate(sentence) {
  const s=normalize(sentence);
  return !s || /^(?:confirm|check|verify|visit|see|open) (?:the |current |all )/i.test(s)
    || /(?:eligibility not established|submission availability|consult the official|current application windows|full synopsis|current application window|the sponsor.{0,30}website)/i.test(s)
    || /^Federal opportunity\s+[A-Z][A-Z0-9-]+\.?$/i.test(s);
}
function purpose(record) {
  const raw=normalize(record.description);
  if(!raw)return '';
  // Source snippets often contain practical descriptions followed by verification boilerplate.
  const simplified=raw.replace(/^Listing excerpt:\s*["“]?/i,'').replace(/["”]+$/,'').trim();
  if(/^(?:Federal opportunity|Official listing for (?:federal )?opportunity)\b/i.test(simplified) && /(?:Open the official|complete synopsis)/i.test(simplified))return '';
  const sentences=simplified.split(/(?<=[.!?])\s+(?=[A-Z“"(])/).filter(s=>!isBoilerplate(s));
  const candidate=sentences.find(s=>s.length>=25) || sentences[0] || '';
  return shorten(candidate.replace(/["“]+/g,'').trim());
}
function areas(record) {
  // Grants.gov import sometimes tokenizes an award title into pseudo-topics.
  if(record.origin==='grantsgov_api')return '';
  const phrases=[...new Set((Array.isArray(record.topics)?record.topics:[])
    .map(t=>normalize(t)).filter(t=>t.length>=3&&t.length<=55)
    .filter(t=>!/(?:^grant$|^parent$|^research$|^funding$|^award$|^program$|^training$)/i.test(t)))];
  return phrases.slice(0,4).join(' · ');
}
function audience(record) {
  const raw=normalize(record.eligibility);
  if(!raw || /^(?:Eligibility not established|Program source identified|Confirm eligibility|Please verify|See official|Not established)/i.test(raw))return '';
  const sentence=raw.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || '';
  if(isBoilerplate(sentence)||sentence.length<20)return '';
  return shorten(sentence,145);
}
/** Returns up to 3 factual bullets; no claims that a researcher is formally eligible. */
export function grantHighlights(record) {
  if(!record||typeof record!=='object')return [];
  const bullets=[];
  const summary=purpose(record);
  if(summary)bullets.push({kind:'summary',label:'About',text:summary});
  const researchAreas=areas(record);
  if(researchAreas)bullets.push({kind:'topics',label:'Research areas',text:researchAreas});
  const applicant=audience(record);
  if(applicant && bullets.length<3)bullets.push({kind:'audience',label:'Applicant notes',text:applicant});
  if(!bullets.length && normalize(record.funding_type))bullets.push({kind:'type',label:'Support type',text:shorten(record.funding_type,115)});
  if(!bullets.length)bullets.push({kind:'missing',label:'About',text:'Program scope is not summarized in the catalog.'});
  return bullets.slice(0,3);
}
