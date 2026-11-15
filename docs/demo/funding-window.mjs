// Sponsor confirmation is claim-specific: timing evidence does not verify eligibility.
const reviewedTiming = {
  'https://www.grants.gov/search-results-detail/324369': {
    type:'rolling',
    url:'https://www.nsf.gov/funding/opportunities/frr-foundational-research-robotics',
    checked:'2026-11-15',
    detail:'NSF says full proposals to this program are accepted anytime.'
  }
};

export const localDay=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const validDay=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const instant=new Date(value+'T00:00:00Z');
  return !Number.isNaN(instant.valueOf())&&instant.toISOString().slice(0,10)===value;
};

/** True when every year in a title ("2022", "2023-24", "FY2023") is at least two years before today. */
export function staleTitleYear(title,today=localDay()){
  const current=Number(String(today).slice(0,4));
  const years=[];
  for(const m of String(title||'').matchAll(/(?<!\d)(?:FY\s?)?((?:19|20)\d{2})(?:\s?[-–\/]\s?(\d{2,4}))?(?!\d)/gi)){
    years.push(Number(m[1]));
    if(m[2])years.push(m[2].length===2?Math.floor(Number(m[1])/100)*100+Number(m[2]):Number(m[2]));
  }
  return years.length>0&&Math.max(...years)<=current-2;
}

export function fundingWindow(record,today=localDay()){
  const evidence=Object.hasOwn(reviewedTiming,record.url)?reviewedTiming[record.url]:record.timing_evidence||null;
  const raw=record.deadline;
  // Use the source snapshot date when present so suspect dates stay flagged.
  const anchor=validDay(record.source_checked_at)?record.source_checked_at:today;
  const federal=['grantsgov_api','grantsgov_bulk'].includes(record.origin)||/^https:\/\/(?:www\.)?grants\.gov\//i.test(record.url||'');
  const suspect=record.deadline_review==='distant_imported_date'||Boolean(raw&&
    (!validDay(raw)||federal&&Number(raw.slice(0,4))-Number(anchor.slice(0,4))>=10));
  const rolling=evidence?.type==='rolling'||(record.status==='rolling'&&!suspect&&!raw);
  const deadline=rolling||suspect?null:raw||null;
  const opens=validDay(record.opens_on)?record.opens_on:null;
  // A round named for a year at least two years back ("2022 Alumni Fund") with no
  // current deadline or opening date is a past round, whatever its stored label says.
  const staleRound=!deadline&&!rolling&&!(opens&&opens>=today)&&staleTitleYear(record.title,today);
  const closed=record.status==='closed'||Boolean(deadline&&deadline<today)||staleRound;
  const status=closed?'closed':opens&&today<opens?'forecast':
    rolling?'rolling':suspect?'verify':
    record.status==='forecast'&&opens?'verify':
    // Bulk federal XML has no explicit open status; published dates alone are discovery evidence.
    record.origin==='grantsgov_bulk'&&record.status==='open'?'verify':
    ['open','rolling','forecast','verify'].includes(record.status)?record.status:'verify';
  return {status,deadline,opens,suspect,evidence,
    type:rolling?'rolling':deadline?'fixed':record.program_status_scope==='program_family'?'recurring':'unknown',
    time:deadline&&/^([01]\d|2[0-3]):[0-5]\d$/.test(record.deadline_time||'')?record.deadline_time:'',
    timezone:deadline&&typeof record.deadline_timezone==='string'?record.deadline_timezone:''};
}

export const invitedPhase=record=>record.application_phase==='invited_stage_two'||
  record.eligibility_rules?.application_route==='invitation_only';
