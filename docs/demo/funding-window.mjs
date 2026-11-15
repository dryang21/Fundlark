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
  const closed=record.status==='closed'||Boolean(deadline&&deadline<today);
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
