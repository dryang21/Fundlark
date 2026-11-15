const KINDS=new Set(['fundlark-library','fundlark-tracker']);
const STATUSES=new Set(['open','rolling','forecast','verify','closed']);
const CATEGORIES=new Set(['Government','Industry','Institution','Society','Foundation']);
const STATES=new Set(['Interested','Checking eligibility','Preparing','Submitted','Awarded','Declined']);
export const MAX_LIBRARY_BYTES=8_000_000;
const MAX_ENTRIES=2000;
const text=(value,max=400)=>typeof value==='string'?value.trim().slice(0,max):'';
const day=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value?value:'';
};
function sourceUrl(value){
  try{
    const url=new URL(text(value,1800));
    if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))return '';
    url.hash='';
    for(const key of [...url.searchParams.keys()])if(/^utm_|^gclid$|^fbclid$/i.test(key))url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  }catch{return '';}
}
function readRecord(value){
  const r=value&&typeof value==='object'?value:{};
  const url=sourceUrl(r.url),title=text(r.title,255),funder=text(r.funder,200);
  if(!url||!title||!funder)throw new Error('Every lead needs a title, a funder, and an HTTPS source link.');
  const checked=day(r.last_verified_at);
  return {id:text(r.id,150),title,funder,url,
    category:CATEGORIES.has(r.category)?r.category:'Other',
    round:text(r.round,100),opportunity_number:text(r.opportunity_number,160),
    funding_type:text(r.funding_type,100),amount:text(r.amount,200),
    deadline:day(r.deadline)||null,status:STATUSES.has(r.status)&&(checked||r.status==='closed')?r.status:'verify',
    description:text(r.description,1200),eligibility:text(r.eligibility,1200),last_verified_at:checked||null};
}
function identity(record){
  // A reused sponsor page must carry a stable round in the library. For
  // existing browser records the deadline year is the legacy round fallback.
  return JSON.stringify([sourceUrl(record.url).replace(/\/$/,''),(text(record.round,100)||day(record.deadline).slice(0,4)||'recurring').toLowerCase()]);
}
export function readLibrary(value){
  if(!value||value.schema_version!==1||!KINDS.has(value.kind)||!Array.isArray(value.entries)||value.entries.length>MAX_ENTRIES)
    throw new Error('Choose a Fundlark library or tracker backup in JSON format.');
  const privateBackup=value.kind==='fundlark-tracker';
  return value.entries.map(entry=>{
    const record=readRecord(privateBackup?entry?.record:entry);
    const tracker=privateBackup?{
      state:STATES.has(entry.state)?entry.state:'Interested',targetDate:day(entry.targetDate),note:text(entry.note),
    }:{state:'Interested',targetDate:'',note:''};
    return {record,...tracker};
  });
}
export function mergeLibrary(saved,incoming){
  const entries=saved.slice(), index=new Map(), incomingIds=new Set();
  const counts={added:0,updated:0,stale:0,skipped:0};
  entries.forEach((entry,i)=>{
    if(!entry.record?.url)return;
    const k=identity(entry.record);
    index.set(k,index.has(k)?null:i);
  });
  for(const entry of incoming){
    const k=identity(entry.record),i=index.get(k);
    if(i===null||incomingIds.has(k)){counts.skipped++;continue;}
    incomingIds.add(k);
    if(i===undefined){
      if(entries.length>=MAX_ENTRIES){counts.skipped++;continue;}
      index.set(k,entries.length);
      entries.push({...entry,key:'personal:'+k,library:true});
      counts.added++;
      continue;
    }
    const previous=entries[i];
    if(previous.record.last_verified_at&&(entry.record.last_verified_at||'')<previous.record.last_verified_at){
      counts.stale++;continue;
    }
    const priority=['title','funder','deadline','status','description','eligibility','amount','last_verified_at'];
    if(priority.every(field=>(previous.record[field]||'')===(entry.record[field]||'')))continue;
    entries[i]={...previous,record:entry.record,library:true};
    counts.updated++;
  }
  return {entries,counts};
}
export function trackerBackup(entries){
  return {schema_version:1,kind:'fundlark-tracker',entries:entries.filter(e=>e.record?.url).slice(0,MAX_ENTRIES).map(e=>({
    record:readRecord(e.record),state:STATES.has(e.state)?e.state:'Interested',targetDate:day(e.targetDate),note:text(e.note),
  }))};
}
