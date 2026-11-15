// Fundlark web demo: broad catalog search + browser-only application tracker.
// Personalized matching lives in the Fundlark skill; this page builds the
// request users paste into their own AI assistant.
import {configureOpenAlexTaxonomy} from './taxonomy.mjs?v=personal-2';
import {fundingWindow} from './funding-window.mjs?v=5.0';
import {grantHighlights} from './grant-highlights.mjs';
import {paginateRecords,pageSequence} from './pagination.mjs';
import {exploreFunding} from './workspace.mjs?v=5.0';
import {describeQuery} from './search-text.mjs';
import {HOST_COUNTRIES} from './host-regions.mjs';
import {MAX_LIBRARY_BYTES,readLibrary,mergeLibrary,trackerBackup} from './personal-library.mjs';
import {readBulkArchive} from './bulk-archive.mjs';
import {FIELDS,fieldName,recordFields,filterHubs,TRACK_STATES,normalizedTrackerEntry,trackerStats,trackerCSV,trackerICS} from './explorer.mjs';
import {filterSources} from './coverage.mjs';
import {setupOrganizations} from './organization-picker.mjs?v=1';
import {researchTerms, normalizeProfile, statusOf, mergeCatalog, opportunityKey, assistantPrompt, discoveryLinks,
  shortlistText, publicRecordSnapshot, restoreShortlist, linkedPrograms, configureSocietyAliases, societyKey} from './matching.mjs?v=personal-2';

const $ = selector => document.querySelector(selector);
// After a release, a browser may pair a cached older page with this newer script.
// Reload once to fetch the matching page instead of failing on missing elements.
const PAGE_MARKERS=['#exploreQuery','#searchInterpretation','#exploreResults','#requestForm'];
if(PAGE_MARKERS.some(selector=>!document.querySelector(selector))){
  let retried=false;
  try{retried=sessionStorage.getItem('fundlark.page-reload')==='1';sessionStorage.setItem('fundlark.page-reload','1');}catch{retried=true;}
  if(!retried){location.reload();throw new Error('Reloading to match the current page version');}
}
try{sessionStorage.removeItem('fundlark.page-reload');}catch{}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = raw => {try {const url=new URL(raw);return url.protocol==='https:'?url.href:'#';}catch{return '#';}};
const labels = {open:'Listed open — confirm before applying',rolling:'Listed rolling — confirm availability',closed:'Past round / closed',forecast:'Upcoming call — not open yet',verify:'Current application window unconfirmed'};
const PROFILE_KEY='fundlark.public.profile.v1', SAVED_KEY='fundlark.public.shortlist.v1';
// Example searches shown under the hero box: broad, cross-disciplinary starting points.
const HERO_SUGGESTIONS=['postdoctoral fellowship','graduate fellowship','cancer research','climate adaptation','artificial intelligence','humanities','early career','travel grant'];

let coverageSources=[], coverageLimit=12, records=[], sources=[], explorePage=1, storageAvailable=true;
const selectedExploreFields=new Set();
let sourceHubs=[],hubLimit=12;
let bulkArchiveCount=0, bulkArchiveRevision='', bulkArchive=null, bulkArchiveRequest=null, bulkArchiveError=false, combinedCatalog=null;
let indexedCount=0,pastRoundCount=0;
let apiBase='', communityEnabled=false, saved=[];
let request=normalizeProfile();

try {request=normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}'));}catch {storageAvailable=false;}
try {const value=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');if(Array.isArray(value))saved=value.map(x=>typeof x==='string'?{key:x}:x).filter(x=>x&&typeof x.key==='string'&&(!x.record||(typeof x.record==='object'&&typeof x.record.title==='string'&&typeof x.record.url==='string'))).slice(0,2000);}catch {storageAvailable=false;}

/* ---------- Request for the AI assistant (the only "profile" on this page) ---------- */
function readRequest(){
  const description=$('#requestDescription').value.trim();
  request=normalizeProfile({...request,researchBackground:description,researchProposal:'',
    topics:researchTerms(description),stage:$('#requestStage').value,researchRegion:$('#requestRegion').value,
    sharePublic:$('#sharePublic').checked});
  try {localStorage.setItem(PROFILE_KEY,JSON.stringify(request));storageAvailable=true;}catch {storageAvailable=false;}
  renderRoutes();
  return request;
}
function renderRoutes(){
  const links=discoveryLinks(request,sources);
  $('#discoveryRoutes').innerHTML=links.length?`<h3>Prefer to search directly?</h3><p class="small">Open your society or institution's funding page, or a web search. Only the terms in the link are sent when you open it.</p><div class="route-links">${links.map(link=>`<span><a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>${link.note?`<small>${esc(link.note)}</small>`: ''}</span>`).join('')}</div>`:'';
}
async function copyRequest(){
  organizations.consume();
  readRequest();
  const skillMode=$('#skillMode').checked;
  const prompt=assistantPrompt(request,communityEnabled?apiBase:'',{skillMode});
  $('#briefFallback').hidden=false;$('#briefFallback').value=prompt;
  try {await navigator.clipboard.writeText(prompt);$('#copyStatus').textContent='Copied — paste it into your AI assistant.';}
  catch {$('#briefFallback').select();$('#copyStatus').textContent='Copy the request below, then paste it into your AI assistant.';}
}
function updateSharing(){
  const skillMode=$('#skillMode').checked;
  $('#sharePublic').disabled=!communityEnabled||!skillMode;
  $('#communityStatus').textContent=!communityEnabled?'Contributions are not available on this site.':'';
}

// Institutions and memberships: search a list or add any name; each is a removable tag.
const organizations=setupOrganizations({$,esc,onAdd(kind,name){
  const key=kind==='societies'?societyKey:value=>value.toLowerCase();
  if(name&&!request[kind].some(item=>key(item)===key(name)))request[kind].push(name);
},onChange(){renderAffiliationChips();readRequest();}});
function renderAffiliationChips(){
  for(const [kind,target] of [['societies','#societyChips'],['institutions','#institutionChips']]){
    $(target).innerHTML=request[kind].map((name,index)=>{
      const label=organizations.display(kind,name);
      return `<span class="kw-chip" data-kind="added">${esc(label)}<button type="button" data-remove-org="${kind}" data-index="${index}" aria-label="Remove ${esc(label)}">×</button></span>`;
    }).join('');
  }
}
$('#requestForm').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-org]');
  if(!button)return;
  request[button.dataset.removeOrg].splice(Number(button.dataset.index),1);
  renderAffiliationChips();readRequest();
});

/* ---------- Funding cards ---------- */
function fundingRow(o){
  const window=fundingWindow(o),{status,deadline,time,timezone}=window,key=o.savedKey||opportunityKey(o),isSaved=saved.some(e=>e.key===key);
  const statusText=o.program_status_scope==='program_family'?'Date not confirmed':({open:'Open',rolling:'Rolling',closed:'Past round',forecast:'Upcoming',verify:'Date not confirmed'}[status]||'');
  const routeNote=o.application_phase==='invited_stage_two'?'<span class="funding-partner-note">Invitation required</span>':'';
  const checked=(o.source_checked_at||o.last_verified_at)?.slice(0,10)||'—';
  const timingNote=window.evidence?`${esc(window.evidence.detail)} <a href="${esc(safeUrl(window.evidence.url))}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:
    window.suspect?'Listed date looks wrong; check the official call.':'';
  return `<article class="funding-row" data-source="${esc(o.category)}">
    <div class="funding-row-body">
      <div class="funding-row-top"><span class="sponsor-name">${esc(o.funder||'Funding organization')} · ${esc(o.category||'Other')}</span>${statusText?`<span class="status-text" data-status="${o.program_status_scope==='program_family'?'verify':esc(status)}">${esc(statusText)}</span>`:''}</div>
      <h4>${esc(o.title)}</h4>
      <div class="funding-row-facts">${o.amount?`<span>${esc(String(o.amount).slice(0,80))}</span>`:''}${deadline?`<span>${o.application_phase==='invited_stage_two'?'Invited stage':'Deadline'} ${esc([deadline,time,timezone].filter(Boolean).join(' '))}</span>`:''}${routeNote}</div>
      <ul class="grant-highlights" aria-label="Funding opportunity summary">${grantHighlights(o).map(item=>`<li><strong>${esc(item.label)}:</strong> ${esc(item.text)}</li>`).join('')}</ul>
      <details class="funding-row-details"><summary>Details</summary>
        <p><strong>Who can apply:</strong> ${esc(o.eligibility||'See the official call.')}</p>
        <p><strong>Program:</strong> ${esc(o.description||o.funding_type||'See the official call.')}</p>
        ${o.opportunity_number?`<p><strong>Call number:</strong> ${esc(o.opportunity_number)}</p>`:''}
        ${timingNote?`<p class="details-source-note">${timingNote}</p>`:''}
        <p class="details-source-note">Checked ${esc(checked)}</p>
      </details>
    </div>
    <div class="funding-row-actions"><a href="${esc(safeUrl(o.official_call_url||o.url))}" target="_blank" rel="noopener noreferrer">Official page ↗</a><button type="button" class="save-button" data-save="${esc(key)}" aria-pressed="${isSaved}">${isSaved?'Saved ✓':'Save'}</button></div>
  </article>`;
}
function fundingPageButtons(pageInfo){
  const title='catalog funding';
  const previous=`<button type="button" class="pager-direction" data-explore-page="${pageInfo.page-1}" aria-label="Previous ${title} page" ${pageInfo.hasPrevious?'':'disabled'}>← Previous</button>`;
  const numbered=pageSequence(pageInfo.page,pageInfo.totalPages).map(number=>number===null?
    '<span class="pagination-ellipsis" aria-hidden="true">…</span>':
    `<button type="button" class="pager-number${number===pageInfo.page?' is-current':''}" data-explore-page="${number}" aria-label="${title} page ${number}" ${number===pageInfo.page?'aria-current="page"':''}>${number}</button>`).join('');
  const next=`<button type="button" class="pager-direction" data-explore-page="${pageInfo.page+1}" aria-label="Next ${title} page" ${pageInfo.hasNext?'':'disabled'}>Next →</button>`;
  return `${previous}<span class="pagination-pages">${numbered}</span>${next}`;
}

/* ---------- Broad search ---------- */
function render(){
  const savedRecords=restoreShortlist(records,saved);
  renderTracker();
  renderFieldNavigation();
  $('#trackerTabCount').textContent=String(saved.length);
  renderExplore();
}
function renderExplore(){
  renderExploreScope();
  renderInterpretation();
  const includeArchive=exploreNeedsArchive();
  if(includeArchive&&!bulkArchive){
    $('#exploreResultCount').textContent=bulkArchiveError?'Past rounds could not be loaded':'Loading past rounds…';
    $('#exploreResults').innerHTML=bulkArchiveError?'<button type="button" class="button secondary" data-retry-archive>Retry loading past rounds</button>':'';
    for(const nav of [$('#explorePaginationTop'),$('#explorePaginationBottom')])nav.hidden=true;
    if(!bulkArchiveError)loadBulkArchive();
    return;
  }
  // Keep one array per catalog so word statistics are computed once, not per keystroke.
  const catalog=includeArchive?(combinedCatalog||=[...records,...bulkArchive]):records;
  const all=exploreFunding(catalog,{
    description:effectiveQuery(),
    fields:[...selectedExploreFields],category:$('#exploreCategory').value,
    availability:$('#exploreAvailability').value,fundingType:$('#exploreFundingType').value,
    stage:$('#exploreStage').value,sort:$('#exploreSort').value,corpus:catalog,
  });
  const segment=paginateRecords(all,explorePage);
  explorePage=segment.page; // Clamp if the catalog or result count changed.
  $('#exploreResultCount').textContent=segment.count?
    `${segment.count.toLocaleString('en-US')} results`:
    '0 results';
  $('#exploreResults').innerHTML=segment.count?segment.items.map(r=>fundingRow(r)).join(''):
    `<div class="dashboard-empty"><strong>No matches</strong><p>Try broader words or another field, or search live funder sites with the AI skill.</p><a href="#use-skill" class="button secondary">Use the AI skill</a></div>`;
  for (const nav of [$('#explorePaginationTop'),$('#explorePaginationBottom')]) {
    nav.hidden=segment.totalPages<=1;
    nav.innerHTML=nav.hidden?'':fundingPageButtons(segment);
  }
}
function renderExploreScope(){
  if(!indexedCount)return;
  const availability=$('#exploreAvailability').value;
  const past=pastRoundCount.toLocaleString('en-US');
  const current=(indexedCount-pastRoundCount).toLocaleString('en-US');
  const text=availability==='all'?`${indexedCount.toLocaleString('en-US')} calls, including ${past} past rounds`:availability==='closed'?`${past} past rounds`:`${current} current calls`;
  const summary=$('#exploreCatalogScope');
  if(summary.textContent!==text)summary.textContent=text;
  const button=$('#exploreTogglePast');
  button.hidden=!pastRoundCount;
  button.textContent=availability==='all'?'Hide past rounds':availability==='closed'?'Show current':'Show past rounds';
}
function exploreNeedsArchive(){
  return bulkArchiveCount>0&&['all','closed'].includes($('#exploreAvailability').value)&&
    ['all','Government'].includes($('#exploreCategory').value);
}
function loadBulkArchive(){
  if(bulkArchiveRequest)return;
  bulkArchiveRequest=json(`bulk-archive.json?v=${bulkArchiveRevision}`,30000).then(data=>{
    bulkArchive=readBulkArchive(data,bulkArchiveRevision,bulkArchiveCount);combinedCatalog=null;
  }).catch(()=>{bulkArchiveError=true;}).finally(()=>{
    bulkArchiveRequest=null;
    if(exploreNeedsArchive())renderExplore();
  });
}
function resetExplorePage(){explorePage=1;renderExplore();}
function goToExplorePage(event){
  const button=event.target.closest('button[data-explore-page]');
  if(!button||button.disabled)return;
  const page=Number(button.dataset.explorePage);
  if(!Number.isInteger(page)||page===explorePage)return;
  explorePage=page;
  renderExplore();
  $('#exploreResultHeader').scrollIntoView({behavior:'auto',block:'start'});
}
const FUNDING_WORDS=/^(fellowships?|grants?|awards?|scholarships?|stipends?|prizes?|travel|funding|fund|bursar(y|ies)|seed|credits?)$/i;
const STAGE_NAMES={undergrad:'undergraduate',masters:"master's",phd:'PhD / graduate',postdoc:'postdoc',faculty:'faculty',resident:'resident'};
// Editable keywords: terms read from the search text, minus any the user
// removed, plus any they added. Edits persist until "Clear all".
let excludedTerms=new Set(), addedTerms=[];
const termKey=term=>String(term).trim().toLowerCase();
function queryKeywords(text){
  const kinds=researchTerms(text).filter(term=>FUNDING_WORDS.test(term));
  const {topics,words,stages}=describeQuery(text,researchTerms(text).filter(term=>!FUNDING_WORDS.test(term)));
  const chips=[
    ...topics.map(term=>({term,kind:'topic'})),
    ...words.filter(word=>!FUNDING_WORDS.test(word)).map(term=>({term,kind:'word'})),
    ...[...kinds,...words.filter(word=>FUNDING_WORDS.test(word))].map(term=>({term:term.toLowerCase(),kind:'type'})),
    ...stages.map(stage=>({term:stage,label:STAGE_NAMES[stage]||stage,kind:'stage'})),
    ...addedTerms.map(item=>({...item}))];
  // Keep hyphenated terms such as "single-cell" or "two-photon" as one tag.
  for(const compound of new Set((text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)+/g)||[]))){
    const parts=compound.split('-');
    const idx=parts.map(part=>chips.findIndex(chip=>chip.kind!=='added'&&termKey(chip.term)===part));
    if(idx.every(i=>i>=0)){
      const first=Math.min(...idx);const kind=chips[first].kind;
      for(const i of [...idx].sort((x,y)=>y-x))chips.splice(i,1);
      chips.splice(Math.min(first,chips.length),0,{term:compound,kind});
    }
  }
  const seen=new Set();
  return chips.filter(chip=>{const key=termKey(chip.term);if(seen.has(key)||excludedTerms.has(key))return false;seen.add(key);return true;});
}
/** The text actually searched: the raw query until the user edits keywords. */
function effectiveQuery(){
  const text=$('#exploreQuery').value.trim();
  if(!excludedTerms.size&&!addedTerms.length)return text;
  return queryKeywords(text).map(chip=>chip.term).join('; ');
}
function renderInterpretation(){
  const target=$('#searchInterpretation');
  if(!target)return;
  const text=$('#exploreQuery').value.trim();
  const chips=queryKeywords(text);
  const kindLabel={topic:'topic',word:'word',type:'support type',stage:'career stage',added:'added'};
  const list=chips.map(chip=>`<span class="kw-chip" data-kind="${chip.kind}" title="${esc(kindLabel[chip.kind])}">${esc(chip.label||chip.term)}<button type="button" data-remove-term="${esc(chip.term)}" aria-label="Remove keyword ${esc(chip.label||chip.term)}">×</button></span>`).join('');
  const lead=chips.length?'<span class="kw-lead">Keywords</span>':(text?'<span class="kw-lead">No keywords — add one</span>':'<span class="kw-lead">All current calls</span>');
  const restore=excludedTerms.size?'<button type="button" class="kw-restore" data-restore-terms>Restore removed</button>':'';
  target.innerHTML=`${lead}${list}<form class="kw-add" data-add-term><label class="sr-only" for="addKeyword">Add a keyword</label><input id="addKeyword" type="text" maxlength="60" placeholder="+ Add keyword" autocomplete="off"></form>${restore}`;
}
function runSearch(text){
  $('#exploreQuery').value=text.trim().slice(0,1200);
  lastQueryText=$('#exploreQuery').value.trim();
  resetExplorePage();
  $('#exploreResultHeader').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderFieldNavigation(){
  $('#disciplineChips').innerHTML=`<button type="button" class="field-chip" data-explore-field="" aria-pressed="${selectedExploreFields.size===0}">All fields</button>`+
    FIELDS.map(field=>`<button type="button" class="field-chip" data-explore-field="${field.id}" aria-pressed="${selectedExploreFields.has(field.id)}">${esc(field.label)}</button>`).join('');
}
function refreshSupportTypes(){
  const liveTypes=new Set(records.map(record=>record.funding_type).filter(type=>typeof type==='string'&&type));
  const types=[...new Set([...liveTypes,...(bulkArchiveCount?['Federal grant','Cooperative agreement']:[])])].sort();
  const control=$('#exploreFundingType'),selection=control.value;
  control.innerHTML='<option value="">All support types</option>'+types.map(type=>`<option value="${esc(type)}">${esc(type)}</option>`).join('');
  if(types.includes(selection))control.value=selection;
}

/* ---------- Tracker ---------- */
function toggleSaved(key){
  if(saved.some(entry=>entry.key===key))saved=saved.filter(entry=>entry.key!==key);
  else{const record=records.find(o=>opportunityKey(o)===key)||bulkArchive?.find(o=>opportunityKey(o)===key);if(record)saved.push({key,record:publicRecordSnapshot(record),state:'Interested',created:new Date().toISOString().slice(0,10)});}
  persistShortlist();render();
}
function savedWithProgress(){
  const lookup=new Map(restoreShortlist(records,saved).map(record=>[record.savedKey||opportunityKey(record),record]));
  return saved.map(entry=>({...normalizedTrackerEntry(entry),key:entry.key,record:lookup.get(entry.key)||entry.record})).filter(e=>e.record?.url&&e.record?.title)
    .sort((a,b)=>(fundingWindow(a.record).deadline||'9999-99-99').localeCompare(fundingWindow(b.record).deadline||'9999-99-99'));
}
function renderTracker(){
  const entries=savedWithProgress();const stats=trackerStats(entries),filter=$('#trackerFilter').value;
  $('#trackerStats').innerHTML=entries.length?TRACK_STATES.map(s=>`<span class="tracker-state"><strong>${stats[s]}</strong>${esc(s)}</span>`).join(''):'';
  $('#trackerStats').hidden=!entries.length;
  $('#trackerToolbar').hidden=!entries.length;
  const list=entries.filter(entry=>!filter||entry.state===filter);
  $('#trackerCount').textContent=filter?`${list.length} of ${entries.length}`:'';
  $('#trackerList').innerHTML=list.length?list.map(entry=>{
    const k=esc(entry.key),record=entry.record,{deadline}=fundingWindow(record);
    return `<article class="tracker-row"><div class="tracker-record"><span class="dash-lead-sponsor">${esc(record.funder||'Funding sponsor')}</span><h3>${esc(record.title)}</h3><p>${deadline?'Deadline '+esc(deadline):'No deadline listed'} · <a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer">Official page ↗</a></p></div><div class="tracker-controls"><label>Application stage<select data-tracker-state="${k}">${TRACK_STATES.map(s=>`<option ${s===entry.state?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label>My target date<input type="date" data-tracker-date="${k}" value="${esc(entry.targetDate)}"></label><label class="tracker-note">My next action<input type="text" maxlength="400" placeholder="e.g. request mentor letter" data-tracker-note="${k}" value="${esc(entry.note)}"></label><button type="button" class="text-button tracker-remove" data-tracker-remove="${k}">Remove</button></div></article>`;
  }).join(''):`<div class="tracker-empty">${entries.length?'Nothing at this stage.':'Nothing saved yet. Use “Save” on a search result.'}</div>`;
}
function persistShortlist(){
  try{localStorage.setItem(SAVED_KEY,JSON.stringify(saved));$('#shortlistStatus').textContent='';return true;}
  catch{$('#shortlistStatus').textContent='Browser storage is full or unavailable. Copy or download funding links to keep them.';return false;}
}
function downloadText(contents,name,type){const url=URL.createObjectURL(new Blob([contents],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function savedText(){return shortlistText(restoreShortlist(records,saved));}

/* ---------- Directories ---------- */
function renderCoverage(){
  const filtered=filterSources(coverageSources,{query:$('#coverageQuery').value,field:$('#coverageField').value,kind:$('#coverageKind').value});
  $('#coverageCount').textContent=filtered.length===coverageSources.length?'':`${filtered.length} of ${coverageSources.length} sources`;
  $('#coverageResults').innerHTML=filtered.slice(0,coverageLimit).map(source=>{
    const awards=linkedPrograms(records,source.program_ids||[]);
    const funding=awards.length?
      `<details><summary>Funding records (${awards.length})</summary>${awardLinks(awards)}</details>`:
      '';
    return `<li><a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a><span>${esc(source.alias)} · ${esc(source.kind)} · ${esc(source.fields.join(', '))}</span>${funding}</li>`;
  }).join('')||'<li>No sources in this directory match these filters.</li>';
  $('#coverageMore').hidden=filtered.length<=coverageLimit;
}
function awardLinks(awards,{limit=Infinity}={}){
  const row=record=>`<li><a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer">${esc(record.title)} ↗</a><small>${esc([labels[statusOf(record)]||labels.verify,record.amount,fundingWindow(record).deadline?'Deadline: '+fundingWindow(record).deadline:null].filter(Boolean).join(' · '))}</small></li>`;
  const current=awards.filter(record=>statusOf(record)!=='closed'), past=awards.filter(record=>statusOf(record)==='closed');
  const group=items=>`<ul class="award-links">${items.map(row).join('')}</ul>`;
  return (current.length?group(current.slice(0,limit)):'<p>No current leads indexed for this source.</p>')+
    (current.length>limit?`<details><summary>More leads (${current.length-limit})</summary>${group(current.slice(limit))}</details>`:'')+
    (past.length?`<details><summary>Past rounds (${past.length})</summary>${group(past)}</details>`:'');
}
function initializeSourceHubs(){
  const regions=[...new Set(sourceHubs.map(h=>h.region))].sort();
  const kinds=[...new Set(sourceHubs.map(h=>h.kind))].sort();
  $('#hubRegion').insertAdjacentHTML('beforeend',regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join(''));
  $('#hubKind').insertAdjacentHTML('beforeend',kinds.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join(''));
  $('#hubField').insertAdjacentHTML('beforeend',FIELDS.map(field=>`<option value="${field.id}">${esc(field.label)}</option>`).join(''));
  renderSourceHubs();
}
function renderSourceHubs(){
  const filtered=filterHubs(sourceHubs,{field:$('#hubField').value,region:$('#hubRegion').value,kind:$('#hubKind').value,query:$('#hubQuery').value});
  $('#hubCount').textContent=`${filtered.length} funder${filtered.length===1?'':'s'}`;
  $('#hubResults').innerHTML=filtered.slice(0,hubLimit).map(h=>`<article class="hub-card"><span class="hub-kind">${esc(h.kind)} · ${esc(h.region)}</span><h3>${esc(h.name)}</h3><p>${esc(h.description)}</p><div class="hub-field-tags">${h.fields.slice(0,3).map(f=>`<span>${esc(f==='all'?'All disciplines':fieldName(f))}</span>`).join('')}</div><a href="${esc(safeUrl(h.url))}" target="_blank" rel="noopener noreferrer">Visit ↗</a></article>`).join('')||'<p class="tracker-empty">No funder sources match the selected filters. Try all fields or regions.</p>';
  $('#hubMore').hidden=filtered.length<=hubLimit;
}

/* ---------- Data loading ---------- */
async function json(url,timeout=6000){const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!response.ok)throw new Error('Unavailable');return response.json();}
function renderCatalogStatus(){
  const counts={open:0,forecast:0,verify:0,closed:0};
  for(const record of records){
    const status=statusOf(record);
    counts[status==='rolling'?'open':Object.hasOwn(counts,status)?status:'verify']++;
  }
  pastRoundCount=counts.closed+bulkArchiveCount;
  indexedCount=counts.open+counts.forecast+counts.verify+pastRoundCount;
  $('#snapshotStatus').textContent=`${(counts.open+counts.forecast+counts.verify).toLocaleString('en-US')} current calls · ${counts.open.toLocaleString('en-US')} open now`;
}
async function initCommunity(){
  try{
    const url=new URL(window.FUNDLARK_CONFIG?.apiBase||location.origin);
    if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Use HTTPS');
    apiBase=url.origin;
    const config=await json(`${apiBase}/api/config`);
    if(config.contributions_enabled!==true)throw new Error('Not configured');
    communityEnabled=true;
    const data=await json(`${apiBase}/api/catalog`);
    if(data.schema_version!==1||!Array.isArray(data.opportunities))throw new Error('Invalid community data');
    records=mergeCatalog(records,data.opportunities).map(record=>({...record,field_ids:recordFields(record)}));combinedCatalog=null;
    refreshSupportTypes();renderCatalogStatus();render();
  }catch { /* Published catalog remains usable when the optional service is offline. */ }
  updateSharing();
}
async function init(){
  const bundle=(name,version,timeout)=>json(`${name}.json?v=${version}`,timeout).catch(()=>null);
  try{
    const [data,directory,supplemental,hubData,crossData,openalexData,globalPrograms,globalSources,ukri,bulk,fellowships]=await Promise.all([
      bundle('data','personal-2'),bundle('coverage','multifield-v3'),bundle('supplemental','expanded-catalog-1'),
      bundle('source-hubs','multifield-v3'),bundle('crossdisciplinary','personal-2'),bundle('openalex-topics','1'),
      // Global scheme families are discovery leads, not verified open competitions.
      bundle('global-programs','personal-2'),bundle('global-source-hubs','global-v1'),bundle('ukri-calls','1'),
      bundle('bulk-calls','1',12000),bundle('fellowships','5.0')]);
    if(openalexData)configureOpenAlexTaxonomy(openalexData);
    const hasRows=(payload,key='opportunities')=>payload?.schema_version===1&&Array.isArray(payload[key]);
    const baseAvailable=hasRows(data);
    const directoryAvailable=hasRows(directory)&&Array.isArray(directory.sources)&&Array.isArray(directory.fields);
    const bulkAvailable=hasRows(bulk)&&Number.isSafeInteger(bulk.archive_count)&&bulk.archive_count>=0&&/^[a-f0-9]{16}$/.test(bulk.archive_revision);
    const unavailable=[
      ['core catalog',baseAvailable],['societies and conferences',directoryAvailable],
      ['additional funding listings',hasRows(supplemental)],['cross-discipline examples',hasRows(crossData)],
      ['global program registry',hasRows(globalPrograms)],['UKRI',hasRows(ukri)],
      ['bulk federal and EU calls',bulkAvailable],['early-career fellowships',hasRows(fellowships)],
      ['funder directories',hasRows(hubData,'sources')&&hasRows(globalSources,'sources')]
    ].filter(([,available])=>!available).map(([name])=>name);
    $('#catalogHealth').hidden=!unavailable.length;
    $('#catalogHealth').textContent=unavailable.length?`Some funding sources could not load: ${unavailable.join(', ')}. Results may be incomplete; reload to try again.`:'';
    if(unavailable.length===9)throw new Error('No public funding bundles loaded');
    records=baseAvailable?data.opportunities:[];sources=baseAvailable?(data.sources||[]):[];
    if(directoryAvailable){
      coverageSources=directory.sources;
      configureSocietyAliases(coverageSources);
      records=mergeCatalog(records,directory.opportunities);
      $('#coverageField').insertAdjacentHTML('beforeend',directory.fields.map(field=>`<option value="${esc(field)}">${esc(field)}</option>`).join(''));
      const withFunding=coverageSources.filter(source=>linkedPrograms(records,source.program_ids||[]).length).length;
      $('#coverageSummary').textContent=`${coverageSources.length} sources · ${withFunding} with funding in the catalog`;
      renderCoverage();
    }else $('#coverageSummary').textContent='The source directory could not be loaded.';
    for(const extra of [supplemental,crossData,globalPrograms,ukri,fellowships])
      if(hasRows(extra))records=mergeCatalog(records,extra.opportunities);
    if(bulkAvailable){
      records=mergeCatalog(records,bulk.opportunities);
      bulkArchiveCount=bulk.archive_count;
      bulkArchiveRevision=bulk.archive_revision;
    }
    if(hasRows(hubData,'sources'))sourceHubs=hubData.sources;
    if(hasRows(globalSources,'sources')){
      const seen=new Set(sourceHubs.map(h=>String(h.url||'').replace(/\/$/,'').toLowerCase()));
      for(const hub of globalSources.sources){
        const uri=String(hub.url||'').replace(/\/$/,'').toLowerCase();
        if(!seen.has(uri)){sourceHubs.push(hub);seen.add(uri);}
      }
    }
    initializeSourceHubs();
    organizations.setDirectory(coverageSources,[...sources.map(source=>source.institution),...records.map(record=>record.affiliation_tags?.institution)]);
    request=normalizeProfile({...request,societies:request.societies.map(name=>organizations.resolve('societies',name)),institutions:request.institutions.map(name=>organizations.resolve('institutions',name))});
    renderAffiliationChips();
    records=records.map(record=>({...record,field_ids:recordFields(record)}));
    refreshSupportTypes();
    for(const entry of saved)if(!entry.record){const record=records.find(o=>opportunityKey(o)===entry.key);if(record)entry.record=publicRecordSnapshot(record);}
    renderCatalogStatus();
  }catch {$('#snapshotStatus').textContent='The catalog could not be loaded.';$('#exploreCatalogScope').textContent='The catalog could not be loaded.';$('#exploreResults').innerHTML='<p>Catalog temporarily unavailable. Try again or use the official funder directory.</p>';updateSharing();return;}
  // A shared link such as ?q=graduate+fellowship opens with that search.
  const query=new URLSearchParams(location.search).get('q');
  if(query){$('#exploreQuery').value=query.slice(0,1200);lastQueryText=$('#exploreQuery').value.trim();}
  // Display problems are reported as such, not as a catalog outage.
  try{render();renderRoutes();}
  catch(error){console.error(error);$('#exploreResults').innerHTML='<p>Results could not be displayed. Reload the page (Cmd/Ctrl+Shift+R) to get the latest version.</p>';}
  await initCommunity();
}

/* ---------- Wiring ---------- */
$('#requestDescription').value=[request.researchBackground,request.researchProposal].filter(Boolean).join('\n\n');
$('#requestRegion').insertAdjacentHTML('beforeend',HOST_COUNTRIES.map(country=>`<option value="${esc(country)}">${esc(country)}</option>`).join(''));
$('#requestStage').value=request.stage;$('#requestRegion').value=request.researchRegion;
$('#sharePublic').checked=request.sharePublic;
$('#requestDescription').addEventListener('change',readRequest);
for(const id of ['requestStage','requestRegion'])$(`#${id}`).addEventListener('change',readRequest);
$('#requestForm').addEventListener('submit',event=>{event.preventDefault();copyRequest();});
$('#copyPrompt').addEventListener('click',copyRequest);
$('#skillMode').addEventListener('change',()=>{updateSharing();$('#copyStatus').textContent='Copy a new request to apply this choice.';});
$('#sharePublic').addEventListener('change',()=>{readRequest();$('#copyStatus').textContent='Copy a new request to apply this sharing preference.';});
$('#copySkillInstall').addEventListener('click',async()=>{
  const command=$('#skillInstallCommand'),status=$('#skillInstallStatus');
  try {
    await navigator.clipboard.writeText(command.textContent);
    status.textContent='Copied.';
  } catch {
    const range=document.createRange();
    range.selectNodeContents(command);
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent='Copy the highlighted command, then paste it into your terminal.';
  }
});

$('#heroSuggestions').innerHTML=HERO_SUGGESTIONS.map(term=>`<button type="button" class="source-pill" data-hero-search="${esc(term)}">${esc(term)}</button>`).join('');
$('#heroSuggestions').addEventListener('click',event=>{const button=event.target.closest('[data-hero-search]');if(button)runSearch(button.dataset.heroSearch);});
// One search box: results update as you type; Enter or the button jumps to them.
$('#heroSearchForm').addEventListener('submit',event=>{
  event.preventDefault();
  runSearch($('#exploreQuery').value);
});
let searchTimer;
let lastQueryText='';
function pinKeywordsIfCleared(){
  const text=$('#exploreQuery').value.trim();
  if(!text&&lastQueryText){
    // The box was emptied (× button or deleting the text): keep its keywords as tags.
    addedTerms=queryKeywords(lastQueryText);excludedTerms=new Set();
    lastQueryText='';
    return;
  }
  // While text is being deleted, remember the fuller query rather than the remnant.
  if(!lastQueryText.toLowerCase().startsWith(text.toLowerCase()))lastQueryText=text;
}
$('#exploreQuery').addEventListener('input',()=>{pinKeywordsIfCleared();clearTimeout(searchTimer);searchTimer=setTimeout(resetExplorePage,200);});
$('#exploreQuery').addEventListener('search',()=>{pinKeywordsIfCleared();resetExplorePage();});
for(const id of ['exploreCategory','exploreStage','exploreFundingType','exploreAvailability','exploreSort'])
  $(`#${id}`).addEventListener('change',resetExplorePage);
$('#exploreTogglePast').addEventListener('click',()=>{
  const control=$('#exploreAvailability');
  control.value=control.value==='all'?'active':'all';
  resetExplorePage();
});
$('#exploreReset').addEventListener('click',()=>{
  excludedTerms=new Set();addedTerms=[];lastQueryText='';
  $('#exploreQuery').value='';$('#exploreCategory').value='all';
  $('#exploreStage').value='';$('#exploreFundingType').value='';$('#exploreAvailability').value='active';
  $('#exploreSort').value='relevance';selectedExploreFields.clear();renderFieldNavigation();resetExplorePage();
  $('#exploreQuery').focus({preventScroll:true});
});
for(const id of ['explorePaginationTop','explorePaginationBottom'])$(`#${id}`).addEventListener('click',goToExplorePage);
$('#searchInterpretation').addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove-term]');
  if(remove){
    const key=termKey(remove.dataset.removeTerm);
    const before=addedTerms.length;
    addedTerms=addedTerms.filter(item=>termKey(item.term)!==key);
    if(addedTerms.length===before)excludedTerms.add(key);
    resetExplorePage();
    $('#addKeyword')?.focus({preventScroll:true});
    return;
  }
  if(event.target.closest('[data-restore-terms]')){excludedTerms=new Set();resetExplorePage();}
});
$('#searchInterpretation').addEventListener('submit',event=>{
  if(!event.target.closest('[data-add-term]'))return;
  event.preventDefault();
  const value=$('#addKeyword').value.trim().replace(/\s+/g,' ').slice(0,60);
  if(value){
    excludedTerms.delete(termKey(value));
    if(!addedTerms.some(item=>termKey(item.term)===termKey(value)))addedTerms.push({term:value,kind:'added'});
    resetExplorePage();
  }
  $('#addKeyword')?.focus({preventScroll:true});
});

$('#exploreResults').addEventListener('click',event=>{
  const btn=event.target.closest('[data-save]');if(btn)toggleSaved(btn.dataset.save);
  if(event.target.closest('[data-retry-archive]')){bulkArchiveError=false;renderExplore();}
});
$('#disciplineChips').addEventListener('click',event=>{
  const btn=event.target.closest('[data-explore-field]');if(!btn)return;
  const field=btn.dataset.exploreField;if(!field)selectedExploreFields.clear();
  else if(selectedExploreFields.has(field))selectedExploreFields.delete(field);else selectedExploreFields.add(field);
  renderFieldNavigation();resetExplorePage();
});

$('#trackerFilter').addEventListener('change',renderTracker);
$('#trackerList').addEventListener('change',event=>{
  const target=event.target;const key=target.dataset.trackerState||target.dataset.trackerDate||target.dataset.trackerNote;
  if(!key)return;const item=saved.find(s=>s.key===key);if(!item)return;
  if(target.dataset.trackerState)item.state=target.value;
  if(target.dataset.trackerDate)item.targetDate=target.value;
  if(target.dataset.trackerNote)item.note=target.value.slice(0,400);
  persistShortlist();renderTracker();
});
$('#trackerList').addEventListener('click',event=>{const key=event.target.closest('[data-tracker-remove]')?.dataset.trackerRemove;if(key)toggleSaved(key);});
$('#importLibrary').addEventListener('click',()=>$('#libraryFile').click());
$('#libraryFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  const status=$('#libraryStatus');
  try{
    if(file.size>MAX_LIBRARY_BYTES)throw new Error('This library file is larger than 8 MB. Import a smaller file.');
    const incoming=readLibrary(JSON.parse(await file.text()));
    const {entries,counts}=mergeLibrary(saved,incoming);
    saved=entries;
    const persisted=persistShortlist();
    render();
    const skipped=counts.stale+counts.skipped;
    status.textContent=`Added ${counts.added} · Updated ${counts.updated}${skipped?` · Skipped ${skipped} older, duplicate, or unmatched entries`:''}. Existing notes and application progress were kept.${persisted?'':' Download a backup to keep these changes.'}`;
  }catch(error){
    status.textContent=error instanceof SyntaxError?'Could not read this JSON file. Choose a Fundlark library or backup.':error.message;
  }
});
$('#backupTracker').addEventListener('click',()=>{
  try{downloadText(JSON.stringify(trackerBackup(savedWithProgress()),null,2),'Fundlark-tracker-backup.json','application/json');}
  catch(error){$('#libraryStatus').textContent=error.message;}
});
$('#exportTracker').addEventListener('click',()=>downloadText(trackerCSV(savedWithProgress()),'Fundlark-application-tracker.csv','text/csv;charset=utf-8'));
$('#exportCalendar').addEventListener('click',()=>downloadText(trackerICS(savedWithProgress()),'Fundlark-funding-deadlines.ics','text/calendar;charset=utf-8'));
$('#copyShortlist').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(savedText());$('#shortlistStatus').textContent='Copied.';}catch{$('#shortlistFallback').value=savedText();$('#shortlistFallback').hidden=false;$('#shortlistFallback').select();$('#shortlistStatus').textContent='Copy your shortlist below.';}});

for(const id of ['coverageQuery','coverageField','coverageKind'])$(`#${id}`).addEventListener(id==='coverageQuery'?'input':'change',()=>{coverageLimit=12;renderCoverage();});
$('#coverageMore').addEventListener('click',()=>{coverageLimit+=12;renderCoverage();});
for(const id of ['hubField','hubRegion','hubKind','hubQuery'])$(`#${id}`).addEventListener(id==='hubQuery'?'input':'change',()=>{hubLimit=12;renderSourceHubs();});
$('#hubMore').addEventListener('click',()=>{hubLimit+=12;renderSourceHubs();});
init();
