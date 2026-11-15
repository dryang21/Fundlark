/** Cross-discipline, local-first discovery helpers. No claim of verified eligibility. */
export const FIELDS = [
  {id:'computing',label:'Computer science & AI',terms:['artificial intelligence','ai agents','llm','large language model','foundation model','computer science','computing','machine learning','data science','robotics','software engineering','cybersecurity','hci','cloud computing','quantum computing','computer vision','informatics','information science','natural language processing']},
  {id:'medicine',label:'Medicine & public health',terms:['medicine','medical','clinical','health','oncology','cancer','radiation','radiotherapy','epidemiology','public health','diagnosis','pharmaceutical','nursing','patient','disease','mental health','biomedical','neuroscience','global health','healthcare']},
  {id:'life',label:'Life sciences',terms:['biology','biological','biochemistry','genetics','genomics','bioinformatics','biotechnology','microbiology','molecular','cell biology','ecology','physiology','organism','biodiversity','biophysics','life science']},
  {id:'engineering',label:'Engineering & technology',terms:['engineering','manufacturing','mechanical','electrical','aerospace','robotics','civil engineering','chemical engineering','battery','batteries','materials engineering','semiconductor','photonics','infrastructure','transportation','energy technology','industrial engineering']},
  {id:'physical',label:'Physics, chemistry & materials',terms:['physics','chemistry','chemical sciences','materials science','condensed matter','nanoscience','quantum','photonics','astronomy','astrophysics','nuclear','optics','particle physics','space science','geophysics','atomic','plasma']},
  {id:'climate',label:'Climate, earth & environment',terms:['climate','sustainability','environment','earth science','geoscience','geology','oceanography','ecology','conservation','hydrology','ecological','renewable energy','water','forestry','carbon','marine','biodiversity','atmosphere','meteorology']},
  {id:'math',label:'Mathematics & statistics',terms:['mathematics','mathematical','statistics','statistical','probability','applied math','optimization','theoretical computer science','operations research','algebra','number theory','computational mathematics']},
  {id:'social',label:'Social & behavioral sciences',terms:['sociology','psychology','anthropology','political science','economics','behavioral','human behavior','public policy','demography','gender studies','social science','human geography','criminology','international relations']},
  {id:'humanities',label:'Humanities & language',terms:['history','philosophy','literature','linguistics','language studies','humanities','archives','archaeology','religious studies','classics','cultural heritage','ethics','digital humanities','textual']},
  {id:'education',label:'Education & learning',terms:['education','educational','pedagogy','learning sciences','teacher','teaching','curriculum','school','student engagement','higher education','education research','literacy','workforce development']},
  {id:'agriculture',label:'Agriculture & food',terms:['agriculture','agricultural','food','nutrition','crop','plant science','farming','soil','livestock','agroecology','aquaculture','agronomy','food security','horticulture']},
  {id:'arts',label:'Arts, media & design',terms:['arts','artist','design','architecture','music','theater','theatre','film','media studies','creative','museum','performing arts','visual arts','art history','curatorial']},
  {id:'business',label:'Business, law & policy',terms:['business','economics','management','entrepreneurship','innovation','law','legal','commerce','public administration','policy','finance','marketing','governance','supply chain']},
];
const commonWords = new Set(['research','program','project','science','study','award','grant','translational','international','development','clinical trial','career','foundation','university','faculty','student','training','funding','fellowship']);
const patternCache=new Map();
function contains(text,term){
  let re=patternCache.get(term);
  if(!re){const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');re=new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,'iu');patternCache.set(term,re);}
  return re.test(text);
}
const fieldCache=new WeakMap(),statsCache=new WeakMap();
export function recordFields(record){
  if(Array.isArray(record.field_ids)) return record.field_ids.filter(id=>FIELDS.some(field=>field.id===id));
  if(fieldCache.has(record))return fieldCache.get(record);
  const tags=(record.topics||[]).filter(term=>!commonWords.has(String(term).toLowerCase())).join(' ');
  const title=record.title||'';
  const meaningful=`${title} ${tags}`;
  const scored=FIELDS.map(field=>({id:field.id,score:field.terms.reduce((n,term)=>n+(contains(meaningful,term)?term.includes(' ')?3:2:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const fields=scored.slice(0,3).map(x=>x.id);fieldCache.set(record,fields);return fields;
}
export function fieldName(id){return FIELDS.find(f=>f.id===id)?.label||'Cross-disciplinary / not tagged';}
export function fieldStats(records){if(statsCache.has(records))return statsCache.get(records);const tally=FIELDS.map(field=>({...field,records:records.filter(r=>recordFields(r).includes(field.id)).length}));statsCache.set(records,tally);return tally;}
export function filterByField(records,field){return !field?records:records.filter(record=>recordFields(record).includes(field));}
export function filterHubs(hubs,{field='',region='',kind='',query=''}={}){
  const term=query.trim().toLowerCase();
  return hubs.filter(h=>(!field||h.fields.includes(field)||h.fields.includes('all'))&&(!region||h.region===region)&&(!kind||h.kind===kind)&&(!term||[h.name,h.region,h.kind,h.description,...h.fields].join(' ').toLowerCase().includes(term)));
}
export const TRACK_STATES=['Interested','Checking eligibility','Preparing','Submitted','Awarded','Declined'];
export function normalizedTrackerEntry(value){
  const data=value&&typeof value==='object'?value:{};
  return {state:TRACK_STATES.includes(data.state)?data.state:'Interested',note:String(data.note||'').slice(0,400),targetDate:/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate||'')?data.targetDate:'',created:String(data.created||'').slice(0,32)};
}
export function trackerStats(entries){const counts=Object.fromEntries(TRACK_STATES.map(s=>[s,0]));for(const entry of entries)counts[normalizedTrackerEntry(entry).state]++;return counts;}
function csvCell(value){return '"'+String(value??'').replaceAll('"','""')+'"';}
export function trackerCSV(entries){const header=['Title','Funder','Funding source','Deadline','Progress','My target date','My next step','Official link'];const rows=entries.map(({record,state,note,targetDate})=>[record.title,record.funder,record.category,record.deadline||'',normalizedTrackerEntry({state}).state,targetDate||'',note||'',record.url]);return [header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
function icsEscape(value){return String(value??'').replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;');}
export function trackerICS(entries){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fundlark//Application Deadlines//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  entries.filter(({record})=>/^\d{4}-\d{2}-\d{2}$/.test(record.deadline||'')).forEach(({record},i)=>{
    const day=record.deadline.replaceAll('-','');const following=new Date(record.deadline+'T12:00:00Z');following.setUTCDate(following.getUTCDate()+1);
    const next=following.toISOString().slice(0,10).replaceAll('-','');
    lines.push('BEGIN:VEVENT',`UID:fundlark-${record.id||i}-${day}@local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,`DTSTART;VALUE=DATE:${day}`,`DTEND;VALUE=DATE:${next}`,`SUMMARY:${icsEscape('Funding deadline: '+record.title)}`,`DESCRIPTION:${icsEscape('Confirm the deadline and your eligibility on the official sponsor site. '+record.url)}`,`URL:${record.url}`,'END:VEVENT');
  });
  return lines.concat(['END:VCALENDAR','']).join('\r\n');
}
export function dashboardCandidates(records,profile,{max=6}={}){
  // Matching stays a discovery heuristic, NOT an eligibility probability.
  return records.filter(r=>r.matching?.score>0&&r.status!=='closed')
    .filter(r=>!r.matching.stageConcern||r.faculty_sponsor_possible===true||r.eligibility_rules?.application_route==='partner')
    .slice(0,max);
}
