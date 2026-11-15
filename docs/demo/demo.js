import {buildResearchKeywords,autoCorrectResearchText,researchProfileText,PROFILE_TOPIC_SUGGESTIONS} from './manual-profile.mjs?v=personal-2';
import {configureOpenAlexTaxonomy,taxonomyStats,relatedTerms,canonicalLabel,canonicalConcept,vocabularyFields,browseResearchConcepts,searchResearchConcepts} from './taxonomy.mjs?v=personal-2';
import {fundingWindow} from './funding-window.mjs';
import {priorityShortlist, recommendation} from './recommendations.mjs';
import {grantHighlights} from './grant-highlights.mjs';
import {paginateRecords,pageSequence} from './pagination.mjs';
import {appointmentOptionsForStage} from './appointment-options.mjs';
import {filterDashboard,exploreFunding,stageFields,yearsSincePhdForStage,sourceCounts,SOURCE_TYPES} from './workspace.mjs?v=personal-2';
import {HOST_COUNTRIES} from './host-regions.mjs';
import {MAX_LIBRARY_BYTES,readLibrary,mergeLibrary,trackerBackup} from './personal-library.mjs';
import {readBulkArchive} from './bulk-archive.mjs';
import {FIELDS,fieldName,recordFields,filterByField,filterHubs,TRACK_STATES,normalizedTrackerEntry,trackerStats,trackerCSV,trackerICS} from './explorer.mjs';
import {setupOrganizations} from './organization-picker.mjs?v=1';
import {filterSources, relatedSources} from './coverage.mjs';
import {examples, upcomingSaved} from './journey.mjs?v=cv-10';
import {researchTerms, normalizeProfile, selectRecords, statusOf,
  mergeCatalog, opportunityKey, assistantPrompt, discoveryLinks, shortlistText, publicRecordSnapshot, restoreShortlist, freshness, societyKey, linkedPrograms, configureSocietyAliases, fundingBrief, applicationPath} from './matching.mjs?v=personal-2';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = raw => {try {const url=new URL(raw);return url.protocol==='https:'?url.href:'#';}catch{return '#';}};
const labels = {open:'Listed open — confirm before applying',rolling:'Listed rolling — confirm availability',closed:'Past round / closed',forecast:'Upcoming call — not open yet',verify:'Current application window unconfirmed'};
const listingLabels={grantsgov_api:'Grants.gov listing',institution_listing:'Official university listing'};
const PROFILE_KEY='fundlark.public.profile.v1', SAVED_KEY='fundlark.public.shortlist.v1';
let coverageSources=[], coverageLimit=12, records=[], sources=[], explorePage=1, dashboardPage=1, profile=normalizeProfile(), storageAvailable=true;
const selectedExploreFields=new Set();let dashboardView='matches';
let sourceHubs=[],hubLimit=12;
let bulkArchiveCount=0, bulkArchiveRevision='', bulkArchive=null, bulkArchiveRequest=null, bulkArchiveError=false;
let indexedCount=0,pastRoundCount=0;
let apiBase='', communityEnabled=false, saved=[];
const exampleId=new URLSearchParams(location.search).get('example');
const example=Object.hasOwn(examples,exampleId)?examples[exampleId]:null;
const exampleMode=Boolean(example);
if (!exampleMode) {
try {profile=normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}'));}catch {storageAvailable=false;}
try {const value=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');if(Array.isArray(value))saved=value.map(x=>typeof x==='string'?{key:x}:x).filter(x=>x&&typeof x.key==='string'&&(!x.record||(typeof x.record==='object'&&typeof x.record.title==='string'&&typeof x.record.url==='string'))).slice(0,2000);}catch {storageAvailable=false;}
} else {
  profile=normalizeProfile({...example,topics:researchTerms(example.researchText)});
  $('#exampleBanner').hidden=false;
  $('#examplePicker').hidden=true;
  $('#skillMode').disabled=true;
}
const hasProfile = () => Boolean(profile.researchText||profile.stage||profile.topics.length||profile.societies.length||profile.institutions.length);
function saveProfile(){
  if(exampleMode){$('#profileStatus').textContent='Example changes last for this visit.';return;}
  try {localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));storageAvailable=true;}catch {storageAvailable=false;}
  $('#profileStatus').textContent=storageAvailable?'Saved on this browser only.':'Using this profile for this visit; browser storage is unavailable.';
}
let profileTimer;
const organizations=setupOrganizations({$,esc,onAdd(kind, name){
  const key=kind==='societies'?societyKey:value=>value.toLowerCase();
  if(name&&!profile[kind].some(item=>key(item)===key(name)))profile[kind].push(name);
}, onChange:()=>readProfile()});
function keywordAnalysis(){
  return buildResearchKeywords({description:$('#researchDescription').value,
    keywords:profile.researchKeywords,excluded:profile.excludedTopics},records.flatMap(o=>o.topics||[]));
}
function readProfile({consumeAffiliations=false}={}){
  dashboardPage=1;
  clearTimeout(profileTimer);
  const description=$('#researchDescription').value.trim();
  const analysis=keywordAnalysis();
  profile=normalizeProfile({...profile,researchBackground:description,researchProposal:'',
    researchText:researchProfileText({description,keywords:profile.researchKeywords}),topics:analysis.topics,
    stage:$('#stage').value,appointment:$('#appointment').value,facultyRank:$('#facultyRank').value,
    academicYear:$('#academicYear').value,expectedCompletionYear:$('#expectedCompletionYear').value,
    phdCompletionYear:$('#phdCompletionYear').value,researchRegion:$('#researchRegion').value,researchEffortPercent:$('#researchEffort').value,
    piPrivileges:$('#piPrivileges').value===''?null:$('#piPrivileges').value==='true',
    mentorConfirmed:$('#mentorConfirmed').value===''?null:$('#mentorConfirmed').value==='true',
    citizenship:$('#citizenship').value,sharePublic:$('#sharePublic').checked});
  if(consumeAffiliations)organizations.consume();
  profile=normalizeProfile(profile);updateEligibilityControls();renderChips();saveProfile();render();
}
function addProfileKeywords(value){
  // The keyword picker, suggested terms, and discipline browser must all
  // select an indexed canonical concept. Free-form terms are not added.
  const concept=canonicalConcept(String(value||'').trim());
  if(!concept){$('#keywordPickerStatus').textContent='Select a term from the research dictionary.';return false;}
  const current=profile.researchKeywords.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)
    .map(item=>canonicalConcept(item)?.label).filter(Boolean);
  if(!current.some(item=>item.toLocaleLowerCase()===concept.label.toLocaleLowerCase()))current.push(concept.label);
  profile.excludedTopics=profile.excludedTopics.filter(item=>item.toLocaleLowerCase()!==concept.label.toLocaleLowerCase());
  profile.researchKeywords=current.slice(0,20).join(', ');
  $('#profileAddKeyword').value='';
  $('#keywordPickerStatus').textContent=`Added “${concept.label}” to your matching keywords.`;
  closeKeywordSuggestions();
  readProfile();
  return true;
}
function removeProfileKeyword(term){
  const normalized=String(term||'').trim().toLocaleLowerCase();
  if(!normalized)return;
  const known=records.flatMap(o=>o.topics||[]);
  profile.researchKeywords=profile.researchKeywords.split(/[,;\n]/).map(x=>x.trim())
    .filter(item=>item&&autoCorrectResearchText(item,known).text.trim().toLocaleLowerCase()!==normalized).join(', ');
  profile.excludedTopics=[...new Set([...profile.excludedTopics,term])].slice(0,40);
  readProfile();
}
function updateAppointmentOptions(stage){
  const element=$('#appointment');
  const chosen=profile.appointment||'';
  if(element.dataset.forStage!==stage){
    const options=appointmentOptionsForStage(stage);
    element.innerHTML='<option value="">Not specified</option>'+options.map(([code,label])=>`<option value="${esc(code)}">${esc(label)}</option>`).join('');
    element.dataset.forStage=stage;
  }
  element.value=appointmentOptionsForStage(stage).some(([code])=>code===chosen)?chosen:'';
  $('#appointmentLabel').textContent=({resident:'Residency / fellowship type',postdoc:'Postdoctoral appointment type',staff:'Research staff appointment type',faculty:'Faculty appointment type'})[stage]||'Appointment / training type';
}
function updateEligibilityControls(){
  const stage=$('#stage').value;
  updateAppointmentOptions(stage);
  const visible=stageFields(stage);
  const fields={academicYearField:visible.studyYear,expectedCompletionField:visible.expectedCompletion,
    phdCompletionField:visible.phdCompletion,appointmentField:visible.appointment,
    facultyRankField:visible.facultyRank,researchEffortField:visible.researchEffort,mentorConfirmedField:['undergrad','masters','phd','postdoc','resident','staff'].includes(stage),
    piPrivilegesField:visible.piPrivileges};
  for(const [id,show] of Object.entries(fields))$(`#${id}`).hidden=!show;
  const elapsed=yearsSincePhdForStage(stage,$('#phdCompletionYear').value);
  $('#phdElapsed').textContent=elapsed===null?'Enter your PhD completion year only if applicable.':'Calculated: '+elapsed+' year'+(elapsed===1?'':'s')+' since PhD (calendar years).';
}
function renderChips(){
  for(const [key,target] of [['societies','societyChips'],['institutions','institutionChips']]){
    $(`#${target}`).innerHTML=profile[key].map((name,index)=>{
      const label=organizations.display(key,name);
      return `<button type="button" class="chip" data-kind="${key}" data-index="${index}" aria-label="Remove ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`;
    }).join('');
  }
  const analysis=keywordAnalysis();
  const tags=analysis.entries.map(entry=>`<button type="button" class="editable-topic-chip" data-remove-topic="${esc(entry.term)}" aria-label="Remove keyword ${esc(entry.term)}"><span>${esc(entry.term)}</span><span class="keyword-origin">${entry.kind==='manual'?'added':'extracted'}</span><span aria-hidden="true" class="remove-topic">×</span></button>`).join('');
  // Corrections are reflected in canonical keyword chips; do not repeat them as a text block.
  const corrections='';
  const related=[...new Set(analysis.topics.flatMap(topic=>relatedTerms(topic,{limit:3})))].filter(topic=>!analysis.topics.some(t=>t.toLocaleLowerCase()===topic.toLocaleLowerCase())).slice(0,8);
  $('#relatedTopicSuggestions').innerHTML=related.length?`<span class="small">Related topics — add only if relevant:</span> ${related.map(term=>`<button type="button" class="source-pill" data-related-topic="${esc(term)}">+ ${esc(term)}</button>`).join(' ')}`:'';
  $('#vocabularyStatus').textContent=`${taxonomyStats().conceptCount.toLocaleString()} indexed research concepts · curated starter${taxonomyStats().externalCount?' + imported OpenAlex topics':''}. Choose terms from the dictionary; unknown free-text tags are not saved.`;
  renderVocabularyBrowser();
  $('#topicSummary').innerHTML=analysis.entries.length?`<p class="keyword-count">${analysis.entries.length} keyword${analysis.entries.length===1?'':'s'} will be used for your personalized funding matches.</p><div class="chips editable-keyword-list">${tags}</div>${corrections}`:
    ($('#researchDescription').value.trim()?'<p class="keyword-count">No research keywords found. Add a keyword below or <button type="button" class="text-button" data-search-description>search the catalog with your description</button>.</p>':'');
}
let vocabularyFieldOptions='';
function renderVocabularyBrowser(){
  const fieldControl=$('#vocabularyField');
  const fields=vocabularyFields(),signature=fields.join('|');
  if(signature!==vocabularyFieldOptions){
    const selected=fieldControl.value;
    fieldControl.innerHTML='<option value="">All disciplines</option>'+fields.map(field=>`<option value="${esc(field)}">${esc(field)}</option>`).join('');
    if(fields.includes(selected))fieldControl.value=selected;
    vocabularyFieldOptions=signature;
  }
  const choices=browseResearchConcepts({field:fieldControl.value,query:$('#vocabularyQuery').value,limit:16});
  $('#vocabularyCount').textContent=`${choices.total.toLocaleString()} matching concepts · showing up to 16. Select a keyword to add it.`;
  $('#vocabularyResults').innerHTML=choices.items.map(item=>`<button type="button" class="vocabulary-option" data-vocab-term="${esc(item.label)}" title="${esc(item.fields.join(', '))}">+ ${esc(item.label)}</button>`).join('')||'<span class="small">No indexed concepts match this search.</span>';
}
function resetFilters(){
  $('#query').value='';$('#category').value='all';$('#fundingType').value='';
  $('#fieldFilter').value='';$('#applicantRoute').value='all';$('#eligibilityFilter').value='host-compatible';$('#availability').value='active';
  $('#savedOnly').checked=false;dashboardPage=1;render();
}
function setDashboardView(view){
  dashboardView=view==='tracker'?'tracker':'matches';
  $('#dashboardMatchesPanel').hidden=dashboardView!=='matches';
  $('#tracker').hidden=dashboardView!=='tracker';
  $('#dashboardTabMatches').setAttribute('aria-pressed',String(dashboardView==='matches'));
  $('#dashboardTabTracker').setAttribute('aria-pressed',String(dashboardView==='tracker'));
}
function renderCoverage(){
  const filtered=filterSources(coverageSources,{query:$('#coverageQuery').value,field:$('#coverageField').value,kind:$('#coverageKind').value});
  $('#coverageCount').textContent=`${filtered.length} sources${filtered.length?' · showing '+Math.min(filtered.length,coverageLimit):''}`;
  $('#coverageResults').innerHTML=filtered.slice(0,coverageLimit).map(source=>{
    const awards=linkedPrograms(records,source.program_ids||[]);
    const funding=awards.length?
      `<details><summary>Funding records (${awards.length})</summary>${awardLinks(awards)}</details>`:
      '<small>Directory only; funding not reviewed.</small>';
    return `<li><a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a><span>${esc(source.alias)} · ${esc(source.kind)} · ${esc(source.fields.join(', '))}</span>${funding}</li>`;
  }).join('')||'<li>No sources in this directory match these filters.</li>';
  $('#coverageMore').hidden=filtered.length<=coverageLimit;
}
for(const id of ['coverageQuery','coverageField','coverageKind'])$(`#${id}`).addEventListener(id==='coverageQuery'?'input':'change',()=>{coverageLimit=12;renderCoverage();});
$('#coverageMore').addEventListener('click',()=>{coverageLimit+=12;renderCoverage();});
function profileDirectory(){
  const related=relatedSources(coverageSources,profile);
  return related.length?`<div class="route-links">${related.map(source=>`<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.alias)} · organizer site ↗</a>`).join('')}</div>`:'';
}
function renderRoutes(){
  const links=discoveryLinks(profile,sources);
  $('#discoveryRoutes').innerHTML=links.length?`<h3>Prefer to search directly?</h3><p class="small">Open your society or institution's funding page, or a web search. Only the terms in the link are sent when you open it.</p><div class="route-links">${links.map(link=>`<span><a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>${link.note?`<small>${esc(link.note)}</small>`: ''}</span>`).join('')}</div>`:'<p class="small">Add your research interests above to include them in your search request.</p>';
}
function renderReturn(savedRecords){
  const panel=$('#returnPanel');
  panel.hidden=exampleMode||!savedRecords.length;
  if(panel.hidden)return;
  const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const upcoming=upcomingSaved(savedRecords,today);
  const changed=savedRecords.filter(o=>o.detailsChanged).length;
  $('#returnSummary').textContent=`${savedRecords.length} saved ${savedRecords.length===1?'lead':'leads'}${changed?` · ${changed} with changed catalog details`:''}.`;
  $('#returnDeadlines').textContent=upcoming.length?`Earliest listed deadline: ${fundingWindow(upcoming[0]).deadline} · ${upcoming[0].title}. Confirm the official call.`:'No listed open deadlines in the next 30 days among your saved leads.';
}
function awardLinks(awards,{limit=Infinity}={}){
  const row=record=>`<li><a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer">${esc(record.title)} ↗</a><small>${esc([labels[statusOf(record)]||labels.verify,record.amount,fundingWindow(record).deadline?'Deadline: '+fundingWindow(record).deadline:null].filter(Boolean).join(' · '))}</small></li>`;
  const current=awards.filter(record=>statusOf(record)!=='closed'), past=awards.filter(record=>statusOf(record)==='closed');
  const group=items=>`<ul class="award-links">${items.map(row).join('')}</ul>`;
  return (current.length?group(current.slice(0,limit)):'<p>No current leads indexed for this source.</p>')+
    (current.length>limit?`<details><summary>More leads (${current.length-limit})</summary>${group(current.slice(limit))}</details>`:'')+
    (past.length?`<details><summary>Past rounds (${past.length})</summary>${group(past)}</details>`:'');
}
function refreshSupportTypes(){
  const liveTypes=new Set(records.map(record=>record.funding_type).filter(type=>typeof type==='string'&&type));
  for(const id of ['fundingType','exploreFundingType']){
    const types=[...new Set([...liveTypes,...(id==='exploreFundingType'&&bulkArchiveCount?['Federal grant','Cooperative agreement']:[])])].sort();
    const control=$(`#${id}`),selection=control.value;
    control.innerHTML='<option value="">All support types</option>'+types.map(type=>`<option value="${esc(type)}">${esc(type)}</option>`).join('');
    if(types.includes(selection))control.value=selection;
  }
}
function activatePersonalizedMatches(){
  readProfile({consumeAffiliations:true});
  if(!hasProfile()){
    $('#profileStatus').textContent='Add a research background, proposed project, keywords, career stage or an affiliation to see personalized leads. Every field is optional.';
    $('#research-profile').scrollIntoView({behavior:'smooth'});
    return false;
  }
  resetFilters();
  $('#profileStatus').textContent='Your personalized results are ready.';
  return true;
}
function findFunding(){
  if(!activatePersonalizedMatches())return;
  setDashboardView('matches');$('#dashboard').scrollIntoView({behavior:'smooth'});
}
function fundingRow(o,{personalized=false,priority=null}={}){
  const window=priority?.window||fundingWindow(o),{status,deadline,time,timezone}=window,key=o.savedKey||opportunityKey(o),entry=saved.find(e=>e.key===key),isSaved=Boolean(entry);
  const advice=priority||(personalized?recommendation(o,profile):null);
  const assessment=advice?.assessment;
  const snippet=(value,max=185)=>{const t=String(value||'').replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1).replace(/\s+\S*$/,'')+'…':t;};
  const evidence=personalized?[
    ...(o.matching?.topicEvidence||[]).slice(0,3).map(e=>e.related?`${e.term} · related to ${e.matched}`:e.term),
    ...(o.matching?.affiliations||[]).slice(0,1).map(e=>'Affiliation: '+e)]:[];
  const conflict=assessment?.kind==='ineligible';
  const issue=conflict?assessment.checks.find(check=>check.state==='fail'):null;
  const statusText=o.program_status_scope==='program_family'?'Next call unconfirmed':({open:'Listed open',rolling:'Rolling',closed:'Past round',forecast:'Upcoming',verify:'Window unconfirmed'}[status]||'');
  const routeNote=advice||o.application_phase==='invited_stage_two'?
    `<span class="funding-partner-note">${esc(advice?.route||'Invitation required')}</span>`:'';
  const actionLabel=priority?{direct:'Prepare an individual application',partner:'Talk to a faculty or institutional lead',check:'Check eligibility first'}[priority.kind]:'';
  const rulesText=o.eligibility||'See the funder’s official applicant requirements.';
  const eligibility=assessment?`<div class="eligibility-evidence"><strong>Applicant requirements</strong><p>${esc(assessment.summary)}</p><ul>${assessment.checks.map(item=>`<li class="check-${esc(item.state)}"><span aria-hidden="true">${item.state==='pass'?'✓':item.state==='fail'?'×':'?'}</span> ${esc(item.text)}</li>`).join('')}</ul><p><strong>Before applying:</strong> ${esc(advice.next)}</p></div>`:
    `<p><strong>Applicant requirements:</strong> ${esc(rulesText)}</p>`;
  const checked=(o.source_checked_at||o.last_verified_at)?.slice(0,10)||'Not recorded';
  const timingNote=window.evidence?`<a href="${esc(safeUrl(window.evidence.url))}" target="_blank" rel="noopener noreferrer">Sponsor timing evidence ↗</a> · ${esc(window.evidence.detail)} Checked ${esc(window.evidence.checked)}.`:
    window.suspect?'The source supplied an implausible or invalid date. The deadline is unconfirmed.':'';
  const checkLabel=o.origin==='ukri_listing'||o.source_checked_at?'Official listing checked':'Catalog checked';
  return `<article class="funding-row" data-source="${esc(o.category)}">
    <div class="funding-row-body">
      <div class="funding-row-top"><span class="sponsor-name">${esc(o.funder||'Funding organization')} · ${esc(o.category||'Other')}</span>${statusText?`<span class="status-text">${esc(statusText)}</span>`:''}</div>
      ${actionLabel?`<p class="priority-label">${esc(actionLabel)}</p>`:''}
      <h4>${esc(o.title)}</h4>
      <div class="funding-row-facts">${o.amount?`<span>${esc(snippet(o.amount,80))}</span>`:''}${deadline?`<span>${o.application_phase==='invited_stage_two'?'Invited-stage deadline':'Deadline listed'}: ${esc([deadline,time,timezone].filter(Boolean).join(' '))}</span>`:''}${routeNote}</div>
      ${personalized&&evidence.length?`<p class="match-explanation">Why it matches: ${esc(evidence.join(' · '))}</p>`:''}
      <ul class="grant-highlights" aria-label="Funding opportunity summary">${grantHighlights(o).map(item=>`<li><strong>${esc(item.label)}:</strong> ${esc(item.text)}</li>`).join('')}</ul>
      ${conflict?`<p class="funding-conflict"><strong>Potential eligibility conflict:</strong> ${esc(issue?.text||'One indexed mandatory applicant rule does not match your profile.')}</p>`:''}
      ${advice&&!conflict?`<p class="funding-next"><strong>Next step:</strong> ${esc(advice.next)}</p>`:''}
      <details class="funding-row-details"><summary>Eligibility & details</summary>
        ${eligibility}
        <p><strong>Program:</strong> ${esc(o.description||o.funding_type||'See the official call.')}</p>
        ${o.opportunity_number?`<p><strong>Call number:</strong> ${esc(o.opportunity_number)}</p>`:''}
        ${timingNote?`<p class="details-source-note">${timingNote}</p>`:''}
        <p class="details-source-note">${checkLabel}: ${esc(checked)} · Confirm current rules and deadlines with the sponsor.</p>
      </details>
    </div>
    <div class="funding-row-actions"><a href="${esc(safeUrl(o.official_call_url||o.url))}" target="_blank" rel="noopener noreferrer">${o.program_status_scope==='program_family'?'Program details ↗':'Official call ↗'}</a><button type="button" class="save-button" data-save="${esc(key)}" aria-pressed="${isSaved}">${isSaved?'Saved ✓':'Save to tracker'}</button></div>
  </article>`;
}
function dashboardEmpty(){
  return `<div class="dashboard-empty"><strong>${hasProfile()?'No leads with these filters':'Personalized matching starts with your research profile'}</strong><p>${hasProfile()?'Try different keywords or sources. A blank list doesn’t mean there is no suitable funding; this demo searches a starter catalog.':'Return to Step 1 and describe your background, research idea or keywords. You can also explore funding broadly in Step 3 without a profile.'}</p><a href="${hasProfile()?'#use-skill':'#research-profile'}" class="button secondary">${hasProfile()?'Continue with your AI assistant':'Create profile'}</a></div>`;
}
function render(){
  const savedRecords=restoreShortlist(records,saved);
  renderReturn(savedRecords);
  const matches=hasProfile()?filterDashboard(records,profile,{availability:'active'}):[];
  renderDashboard(matches);
  renderPriority(matches);
  renderTracker();
  renderFieldNavigation();
  renderSourceChips(matches);
  const catalog=$('#savedOnly').checked?savedRecords:records;
  const filtered=filterDashboard(catalog,profile,{
    query:$('#query').value,category:$('#category').value,availability:$('#availability').value,
    fundingType:$('#fundingType').value,field:$('#fieldFilter').value,route:$('#applicantRoute').value,eligibility:$('#eligibilityFilter').value,
    savedOnly:$('#savedOnly').checked
  });
  $('#savedCount').textContent=`(${savedRecords.length})`;
  $('#trackerTabCount').textContent=String(saved.length);
  $('#shortlistTools').hidden=!savedRecords.length;
  $('#shortlistStorageLabel').textContent=exampleMode?'Example shortlist · this visit only':'Shortlist saved on this browser only.';
  const dashboardSegment=paginateRecords(filtered,dashboardPage);
  dashboardPage=dashboardSegment.page;
  $('#resultCount').textContent=dashboardSegment.count?
    `${dashboardSegment.first}–${dashboardSegment.last} of ${dashboardSegment.count}`:
    '0 results';
  for(const nav of [$('#dashboardPaginationTop'),$('#dashboardPaginationBottom')]){
    nav.hidden=dashboardSegment.totalPages<=1;
    nav.innerHTML=nav.hidden?'':fundingPageButtons(dashboardSegment,'dashboard');
  }
  $('#archiveHint').hidden=$('#availability').value!=='active'||!hasProfile();
  $('#results').innerHTML=dashboardSegment.count?dashboardSegment.items.map(r=>fundingRow(r,{personalized:true})).join(''):dashboardEmpty();
  renderExplore();
  renderRoutes();
}
function renderPriority(matches){
  const panel=$('#priorityPanel');
  panel.hidden=!hasProfile();
  if(panel.hidden)return;
  const picks=priorityShortlist(matches,profile);
  $('#prioritySummary').textContent=picks.length?
    'Recently checked open or rolling calls. Each lead shows who can submit and what to do next.':
    'No recently checked open or rolling matches yet. Check the leads below or search official sources with your AI assistant.';
  $('#refinePriority').hidden=Boolean(picks.length);
  $('#priorityResults').innerHTML=picks.map(pick=>fundingRow(pick.record,{personalized:true,priority:pick})).join('');
}
function renderSourceChips(matches){
  const counts=sourceCounts(matches),selected=$('#category').value;
  const options=[['all','All sources',matches.length],...SOURCE_TYPES.map(type=>[type,{Society:'Societies',Institution:'Institutions',Government:'Government',Industry:'Industry',Foundation:'Foundations'}[type],counts[type]])];
  $('#dashboardSourceChips').innerHTML=options.map(([key,label,count])=>`<button type="button" class="source-pill" data-dashboard-source="${esc(key)}" aria-pressed="${selected===key}">${esc(label)} <span>${count}</span></button>`).join('');
}
function fundingPageButtons(pageInfo,scope){
  const attribute=scope==='dashboard'?'data-dashboard-page':'data-explore-page';
  const title=scope==='dashboard'?'matched funding':'catalog funding';
  const previous=`<button type="button" class="pager-direction" ${attribute}="${pageInfo.page-1}" aria-label="Previous ${title} page" ${pageInfo.hasPrevious?'':'disabled'}>← Previous</button>`;
  const numbered=pageSequence(pageInfo.page,pageInfo.totalPages).map(number=>number===null?
    '<span class="pagination-ellipsis" aria-hidden="true">…</span>':
    `<button type="button" class="pager-number${number===pageInfo.page?' is-current':''}" ${attribute}="${number}" aria-label="${title} page ${number}" ${number===pageInfo.page?'aria-current="page"':''}>${number}</button>`).join('');
  const next=`<button type="button" class="pager-direction" ${attribute}="${pageInfo.page+1}" aria-label="Next ${title} page" ${pageInfo.hasNext?'':'disabled'}>Next →</button>`;
  return `${previous}<span class="pagination-pages">${numbered}</span>${next}`;
}
function explorePageButtons(pageInfo){return fundingPageButtons(pageInfo,'explore');}
function resetDashboardPage(){dashboardPage=1;render();}
function goToDashboardPage(event){
  const button=event.target.closest('button[data-dashboard-page]');
  if(!button||button.disabled)return;
  const next=Number(button.dataset.dashboardPage);
  if(!Number.isInteger(next)||next===dashboardPage)return;
  dashboardPage=next;
  render();
  $('#dashboardMatchesPanel').querySelector('.workspace-filter-head').scrollIntoView({behavior:'auto',block:'start'});
}
function renderExplore(){
  renderExploreScope();
  const includeArchive=exploreNeedsArchive();
  if(includeArchive&&!bulkArchive){
    $('#exploreResultCount').textContent=bulkArchiveError?'Past rounds could not be loaded':'Loading past rounds…';
    $('#exploreResults').innerHTML=bulkArchiveError?'<button type="button" class="button secondary" data-retry-archive>Retry loading past rounds</button>':'';
    for(const nav of [$('#explorePaginationTop'),$('#explorePaginationBottom')])nav.hidden=true;
    if(!bulkArchiveError)loadBulkArchive();
    return;
  }
  const all=exploreFunding(includeArchive?[...records,...bulkArchive]:records,{
    description:$('#exploreQuery').value,
    fields:[...selectedExploreFields],category:$('#exploreCategory').value,
    availability:$('#exploreAvailability').value,fundingType:$('#exploreFundingType').value,
    stage:$('#exploreStage').value,sort:$('#exploreSort').value,
  });
  const segment=paginateRecords(all,explorePage);
  explorePage=segment.page; // Clamp if the catalog or result count changed.
  $('#exploreResultCount').textContent=segment.count?
    `${segment.first}–${segment.last} of ${segment.count.toLocaleString('en-US')} results · Page ${segment.page} of ${segment.totalPages.toLocaleString('en-US')}`:
    '0 results';
  $('#exploreResults').innerHTML=segment.count?segment.items.map(r=>fundingRow(r)).join(''):
    '<div class="dashboard-empty"><strong>No catalog records found</strong><p>Try fewer keywords, another field, or all funding sources. Unindexed opportunities may exist on official funder sites.</p><a href="#sourceHubs">Browse official funding sources</a></div>';
  for (const nav of [$('#explorePaginationTop'),$('#explorePaginationBottom')]) {
    nav.hidden=segment.totalPages<=1;
    nav.innerHTML=nav.hidden?'':explorePageButtons(segment);
  }
}
function renderExploreScope(){
  if(!indexedCount)return;
  const availability=$('#exploreAvailability').value;
  const past=pastRoundCount.toLocaleString('en-US');
  const total=`${indexedCount.toLocaleString('en-US')} total catalog records`;
  const scope=availability==='all'?`includes ${past} past rounds`:availability==='closed'?'past rounds only':`${past} past rounds hidden`;
  const summary=$('#exploreCatalogScope');
  const text=pastRoundCount?`${total} · ${scope}`:total;
  if(summary.textContent!==text)summary.textContent=text;
  const button=$('#exploreTogglePast');
  button.hidden=!pastRoundCount;
  button.textContent=availability==='all'?'Hide past rounds':availability==='closed'?'Show all records':'Include past rounds';
}
function exploreNeedsArchive(){
  return bulkArchiveCount>0&&['all','closed'].includes($('#exploreAvailability').value)&&
    ['all','Government'].includes($('#exploreCategory').value);
}
function loadBulkArchive(){
  if(bulkArchiveRequest)return;
  bulkArchiveRequest=json(`bulk-archive.json?v=${bulkArchiveRevision}`,30000).then(data=>{
    bulkArchive=readBulkArchive(data,bulkArchiveRevision,bulkArchiveCount);
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

async function copyRequest(){
  readProfile({consumeAffiliations:true});
  const skillMode=!exampleMode&&$('#skillMode').checked;
  const prompt=assistantPrompt(profile,communityEnabled?apiBase:'',{skillMode});
  $('#briefFallback').hidden=false;$('#briefFallback').value=prompt;
  $('#use-skill').scrollIntoView({behavior:'smooth'});
  try {await navigator.clipboard.writeText(prompt);$('#copyStatus').textContent='Copied. Open your AI assistant and paste this request. Review the text below before sending.';}
  catch {$('#briefFallback').select();$('#copyStatus').textContent='Copy the request below, then paste it into your AI assistant.';}
}
function updateSharing(){
  const skillMode=!exampleMode&&$('#skillMode').checked;
  $('#sharePublic').disabled=exampleMode||!communityEnabled||!skillMode;
  $('#communityStatus').textContent=exampleMode?'Example mode cannot authorize contributions.':!communityEnabled?'Automatic contributions are unavailable on this host. Funding matching and copied search requests still work.':skillMode?'Available. With sharing enabled, your installed skill can submit public discoveries for review.':'Automatic contributions are available after you install the optional skill and select the checkbox above.';
}
async function json(url,timeout=6000){const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!response.ok)throw new Error('Unavailable');return response.json();}
function renderCatalogStatus(){
  const counts={open:0,forecast:0,verify:0,closed:0};
  for(const record of records){
    const status=statusOf(record);
    counts[status==='rolling'?'open':Object.hasOwn(counts,status)?status:'verify']++;
  }
  pastRoundCount=counts.closed+bulkArchiveCount;
  indexedCount=counts.open+counts.forecast+counts.verify+pastRoundCount;
  $('#snapshotStatus').textContent=`${counts.open.toLocaleString('en-US')} calls listed open or rolling · Check the official call before applying`;
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
    records=mergeCatalog(records,data.opportunities);refreshSupportTypes();renderCatalogStatus();render();
  }catch { /* Published catalog remains usable when the optional service is offline. */ }
  updateSharing();
}
async function init(){
  const coverageRequest=json('coverage.json?v=multifield-v3').catch(()=>null);
  const taxonomyRequest=json('openalex-topics.json?v=1').catch(()=>null);
  const hubRequest=json('source-hubs.json?v=multifield-v3').catch(()=>null);
  const crossRequest=json('crossdisciplinary.json?v=personal-2').catch(()=>null);
  const supplementalRequest=json('supplemental.json?v=expanded-catalog-1').catch(()=>null);
  // Global scheme families are discovery leads, not verified open competitions.
  const globalProgramsRequest=json('global-programs.json?v=personal-2').catch(()=>null);
  const ukriRequest=json('ukri-calls.json?v=1').catch(()=>null);
  const bulkRequest=json('bulk-calls.json?v=1',12000).catch(()=>null);
  const globalSourcesRequest=json('global-source-hubs.json?v=global-v1').catch(()=>null);
  try{
    const [data, directory, supplemental,hubData,crossData,openalexData,globalPrograms,globalSources,ukri,bulk]=await Promise.all([json('data.json?v=personal-2').catch(()=>null),coverageRequest,supplementalRequest,hubRequest,crossRequest,taxonomyRequest,globalProgramsRequest,globalSourcesRequest,ukriRequest,bulkRequest]);
    if(openalexData)configureOpenAlexTaxonomy(openalexData);
    const hasRows=(payload,key='opportunities')=>payload?.schema_version===1&&Array.isArray(payload[key]);
    const baseAvailable=hasRows(data);
    const directoryAvailable=hasRows(directory)&&Array.isArray(directory.sources)&&Array.isArray(directory.fields);
    const bulkAvailable=hasRows(bulk)&&Number.isSafeInteger(bulk.archive_count)&&bulk.archive_count>=0&&/^[a-f0-9]{16}$/.test(bulk.archive_revision);
    const unavailable=[
      ['core catalog',baseAvailable],['societies and conferences',directoryAvailable],
      ['additional funding listings',hasRows(supplemental)],['cross-discipline examples',hasRows(crossData)],
      ['global program registry',hasRows(globalPrograms)],['UKRI',hasRows(ukri)],
      ['bulk federal and EU calls',bulkAvailable],['funder directories',hasRows(hubData,'sources')&&hasRows(globalSources,'sources')]
    ].filter(([,available])=>!available).map(([name])=>name);
    $('#catalogHealth').hidden=!unavailable.length;
    $('#catalogHealth').textContent=unavailable.length?`Some funding sources could not load: ${unavailable.join(', ')}. Results may be incomplete; reload to try again.`:'';
    if(unavailable.length===8)throw new Error('No public funding bundles loaded');
    records=baseAvailable?data.opportunities:[];sources=baseAvailable?(data.sources||[]):[];
    if(directoryAvailable){
      coverageSources=directory.sources;
      configureSocietyAliases(coverageSources);
      records=mergeCatalog(records,directory.opportunities);
      $('#coverageField').insertAdjacentHTML('beforeend',directory.fields.map(field=>`<option value="${esc(field)}">${esc(field)}</option>`).join(''));
      const withFunding=coverageSources.filter(source=>linkedPrograms(records,source.program_ids||[]).length).length;
      $('#coverageSummary').textContent=`${coverageSources.length} society and conference sources · ${withFunding} linked to indexed funding · ${coverageSources.length-withFunding} directory-only · ${directory.opportunities.length} curated records (including past/unconfirmed rounds).`;
      renderCoverage();
    }else $('#coverageSummary').textContent='The source directory could not be loaded.';

    if(supplemental?.schema_version===1&&Array.isArray(supplemental.opportunities)){
      records=mergeCatalog(records,supplemental.opportunities);
    }
    if(crossData?.schema_version===1&&Array.isArray(crossData.opportunities))records=mergeCatalog(records,crossData.opportunities);
    if(globalPrograms?.schema_version===1&&Array.isArray(globalPrograms.opportunities))records=mergeCatalog(records,globalPrograms.opportunities);
    if(ukri?.schema_version===1&&Array.isArray(ukri.opportunities))records=mergeCatalog(records,ukri.opportunities);
    if(bulkAvailable){
      records=mergeCatalog(records,bulk.opportunities);
      bulkArchiveCount=bulk.archive_count;
      bulkArchiveRevision=bulk.archive_revision;
    }
    if(hubData?.schema_version===1&&Array.isArray(hubData.sources))sourceHubs=hubData.sources;
    if(globalSources?.schema_version===1&&Array.isArray(globalSources.sources)){
      const seen=new Set(sourceHubs.map(h=>String(h.url||'').replace(/\/$/,'').toLowerCase()));
      for(const hub of globalSources.sources){
        const uri=String(hub.url||'').replace(/\/$/,'').toLowerCase();
        if(!seen.has(uri)){sourceHubs.push(hub);seen.add(uri);}
      }
    }
    initializeSourceHubs();
    records=records.map(record=>({...record,field_ids:recordFields(record)}));
    organizations.setDirectory(coverageSources,[...sources.map(source=>source.institution),...records.map(record=>record.affiliation_tags?.institution)]);
    profile=normalizeProfile({...profile,societies:profile.societies.map(name=>organizations.resolve('societies',name)),institutions:profile.institutions.map(name=>organizations.resolve('institutions',name))});
    profile.topics=keywordAnalysis().topics;
    renderChips();
    refreshSupportTypes();
    initializeFields();
    if(exampleMode){
      profile.topics=keywordAnalysis().topics;
      renderChips();
    }
    for(const entry of saved)if(!entry.record){const record=records.find(o=>opportunityKey(o)===entry.key);if(record)entry.record=publicRecordSnapshot(record);}
    renderCatalogStatus();
    render();
  }catch {$('#snapshotStatus').textContent='The catalog could not be loaded.';$('#exploreCatalogScope').textContent='The catalog could not be loaded.';$('#results').innerHTML='<p>Catalog temporarily unavailable. Try again or use the official funder directory.</p>';$('#exploreResults').innerHTML='<p>Catalog temporarily unavailable.</p>';$('#resultCount').textContent='Catalog unavailable';}
  await initCommunity();
}
// Preserve both text fields from earlier saved versions in the single editor.
$('#researchDescription').value=[profile.researchBackground,profile.researchProposal].filter(Boolean).join('\n\n');
$('#stage').value=profile.stage;
$('#sharePublic').checked=profile.sharePublic;
$('#appointment').value=profile.appointment;$('#facultyRank').value=profile.facultyRank;
$('#academicYear').value=profile.academicYear??'';
$('#expectedCompletionYear').value=profile.expectedCompletionYear??'';
$('#phdCompletionYear').value=profile.phdCompletionYear??'';
$('#researchEffort').value=profile.researchEffortPercent??'';
$('#piPrivileges').value=profile.piPrivileges===null?'':String(profile.piPrivileges);
$('#mentorConfirmed').value=profile.mentorConfirmed===null?'':String(profile.mentorConfirmed);
$('#researchRegion').insertAdjacentHTML('beforeend',HOST_COUNTRIES.map(country=>`<option value="${esc(country)}">${esc(country)}</option>`).join(''));
$('#citizenship').value=profile.citizenship;$('#researchRegion').value=profile.researchRegion;updateEligibilityControls();
renderChips();
$('#researchDescription').addEventListener('input',()=>{
  clearTimeout(profileTimer);$('#profileStatus').textContent='Updating your research keywords…';
  profileTimer=setTimeout(()=>readProfile(),300);
});
let keywordOptions=[],keywordActive=-1;
function closeKeywordSuggestions(){
  $('#keywordSuggestionList').hidden=true;
  $('#keywordSuggestionList').innerHTML='';
  $('#profileAddKeyword').setAttribute('aria-expanded','false');
  $('#profileAddKeyword').removeAttribute('aria-activedescendant');
  keywordOptions=[];keywordActive=-1;
}
function selectKeywordSuggestion(index){
  const term=keywordOptions[index]?.label;
  if(term)addProfileKeywords(term);
}
function renderKeywordSuggestions(){
  const input=$('#profileAddKeyword'),list=$('#keywordSuggestionList');
  keywordOptions=searchResearchConcepts(input.value,{limit:8});
  keywordActive=-1;
  if(!input.value.trim()){closeKeywordSuggestions();$('#keywordPickerStatus').textContent='';return;}
  list.hidden=false;
  input.setAttribute('aria-expanded','true');
  list.innerHTML=keywordOptions.length?keywordOptions.map((entry,i)=>
    `<div id="keyword-choice-${i}" role="option" class="keyword-suggestion-option" data-suggest-index="${i}" aria-selected="false"><span class="suggestion-name">${esc(entry.label)}</span><span class="suggestion-meta">${esc(entry.reason)}${entry.fields.length?' · '+esc(entry.fields[0]):''}</span></div>`
  ).join(''):'<p class="keyword-suggestion-empty">No term found in the dictionary. Try a broader research topic.</p>';
  $('#keywordPickerStatus').textContent=keywordOptions.length?'Select an indexed term below.':'No matching dictionary term.';
}
function setKeywordActive(index){
  if(!keywordOptions.length)return;
  keywordActive=Math.max(0,Math.min(keywordOptions.length-1,index));
  for(const item of $('#keywordSuggestionList').querySelectorAll('[role=option]'))item.setAttribute('aria-selected',String(Number(item.dataset.suggestIndex)===keywordActive));
  $('#profileAddKeyword').setAttribute('aria-activedescendant',`keyword-choice-${keywordActive}`);
}
$('#profileAddKeyword').addEventListener('input',renderKeywordSuggestions);
$('#profileAddKeyword').addEventListener('focus',()=>{if($('#profileAddKeyword').value.trim())renderKeywordSuggestions();});
$('#profileAddKeyword').addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){if(!keywordOptions.length)return;event.preventDefault();setKeywordActive(keywordActive+1);}
  else if(event.key==='ArrowUp'){if(!keywordOptions.length)return;event.preventDefault();setKeywordActive(keywordActive<1?keywordOptions.length-1:keywordActive-1);}
  else if(event.key==='Enter'){event.preventDefault();if(keywordOptions.length)selectKeywordSuggestion(keywordActive<0?0:keywordActive);}
  else if(event.key==='Escape'){closeKeywordSuggestions();}
});
$('#keywordSuggestionList').addEventListener('click',event=>{
  const item=event.target.closest('[data-suggest-index]');if(item)selectKeywordSuggestion(Number(item.dataset.suggestIndex));
});
document.addEventListener('click',event=>{if(!event.target.closest('#keywordPicker'))closeKeywordSuggestions();});
$('#topicSummary').addEventListener('click',event=>{
  const button=event.target.closest('button[data-remove-topic]');
  if(button)removeProfileKeyword(button.dataset.removeTopic);
});
$('#restoreExtractedKeywords').addEventListener('click',()=>{profile.excludedTopics=[];readProfile();});
$('#relatedTopicSuggestions').addEventListener('click',event=>{
  const button=event.target.closest('[data-related-topic]');if(button)addProfileKeywords(button.dataset.relatedTopic);
});
for(const id of ['vocabularyField','vocabularyQuery'])$(`#${id}`).addEventListener(id==='vocabularyQuery'?'input':'change',renderVocabularyBrowser);
$('#vocabularyResults').addEventListener('click',event=>{
  const button=event.target.closest('[data-vocab-term]');
  if(button)addProfileKeywords(button.dataset.vocabTerm);
});
$('#profileSuggestedTopics').addEventListener('click',event=>{
  const button=event.target.closest('button[data-profile-topic]');if(!button)return;
  addProfileKeywords(button.dataset.profileTopic);
});
$('#profileSuggestedTopics').innerHTML=PROFILE_TOPIC_SUGGESTIONS.map(topic=>`<button type="button" class="source-pill" data-profile-topic="${esc(topic)}">${esc(topic)}</button>`).join('');
$('#stage').addEventListener('change',readProfile);
for(const id of ['appointment','facultyRank','academicYear','expectedCompletionYear','phdCompletionYear','researchEffort','piPrivileges','mentorConfirmed','citizenship','researchRegion']){
  $(`#${id}`).addEventListener('change',readProfile);
}
$('#profileForm').addEventListener('click',event=>{const button=event.target.closest('button[data-kind]');if(button){profile[button.dataset.kind].splice(Number(button.dataset.index),1);readProfile();}});
$('#profileForm').addEventListener('submit',event=>{event.preventDefault();findFunding();});
$('#clearProfile').addEventListener('click',()=>{
  clearTimeout(profileTimer);organizations.clear();
  dashboardPage=1;profile=normalizeProfile();for(const id of ['researchDescription','profileAddKeyword'])$(`#${id}`).value='';$('#stage').value='';$('#sharePublic').checked=false;$('#briefFallback').value='';$('#briefFallback').hidden=true;$('#copyStatus').textContent='';
  for(const id of ['appointment','facultyRank','academicYear','expectedCompletionYear','phdCompletionYear','researchEffort','piPrivileges','mentorConfirmed'])$(`#${id}`).value='';
  $('#citizenship').value='unknown';$('#researchRegion').value='';updateEligibilityControls();
  if(!exampleMode)try{localStorage.removeItem(PROFILE_KEY);}catch{}
  renderChips();render();$('#profileStatus').textContent=exampleMode?'Example profile cleared.':'Research profile cleared. Your saved applications are unchanged.';
});
$('#skillMode').addEventListener('change',()=>{updateSharing();$('#copyStatus').textContent='Copy a new request to apply this choice.';});
$('#sharePublic').addEventListener('change',()=>{readProfile();$('#copyStatus').textContent='Copy a new request to apply this sharing preference.';});
for(const id of ['dashboardPaginationTop','dashboardPaginationBottom'])$('#'+id).addEventListener('click',goToDashboardPage);
$('#dashboardTabMatches').addEventListener('click',()=>setDashboardView('matches'));
$('#dashboardTabTracker').addEventListener('click',()=>setDashboardView('tracker'));
$('#dashboardSourceChips').addEventListener('click',event=>{const btn=event.target.closest('[data-dashboard-source]');if(!btn)return;$('#category').value=btn.dataset.dashboardSource;resetDashboardPage();});
for(const id of ['query','fundingType','availability','fieldFilter','applicantRoute','eligibilityFilter'])$(`#${id}`).addEventListener(id==='query'?'input':'change',resetDashboardPage);
$('#savedOnly').addEventListener('change',resetDashboardPage);
$('#resetFilters').addEventListener('click',resetFilters);
$('#showPastRounds').addEventListener('click',()=>{$('#availability').value='closed';resetDashboardPage();});
$('#resumeShortlist').addEventListener('click',()=>{setDashboardView('tracker');$('#dashboard').scrollIntoView({behavior:'smooth'});});
$('#resumeMatches').addEventListener('click',()=>{if(activatePersonalizedMatches()){setDashboardView('matches');$('#dashboard').scrollIntoView({behavior:'smooth'});}});
$('#copyPrompt').addEventListener('click',copyRequest);
$('#copySkillInstall').addEventListener('click',async()=>{
  const command=$('#skillInstallCommand'),status=$('#skillInstallStatus');
  try {
    await navigator.clipboard.writeText(command.textContent);
    status.textContent='Copied. Paste the command into your terminal.';
  } catch {
    const range=document.createRange();
    range.selectNodeContents(command);
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent='Copy the highlighted command, then paste it into your terminal.';
  }
});
$('#topicSummary').addEventListener('click',event=>{
  if(!event.target.closest('[data-search-description]'))return;
  $('#exploreQuery').value=$('#researchDescription').value.trim().slice(0,1200);
  resetExplorePage();
  $('#opportunities').scrollIntoView({behavior:'smooth',block:'start'});
});
$('#searchForm').addEventListener('submit',event=>{event.preventDefault();resetExplorePage();$('#exploreResultHeader').scrollIntoView({behavior:'smooth',block:'start'});});
$('#heroSearchForm').addEventListener('submit',event=>{
  event.preventDefault();
  $('#exploreQuery').value=$('#heroSearchInput').value.trim();
  resetExplorePage();
  $('#opportunities').scrollIntoView({behavior:'smooth',block:'start'});
  $('#exploreQuery').focus({preventScroll:true});
});
for(const id of ['exploreQuery','exploreCategory','exploreStage','exploreFundingType','exploreAvailability','exploreSort']){
  $(`#${id}`).addEventListener(id==='exploreQuery'?'input':'change',resetExplorePage);
}
$('#exploreTogglePast').addEventListener('click',()=>{
  const control=$('#exploreAvailability');
  control.value=control.value==='all'?'active':'all';
  resetExplorePage();
});
$('#exploreReset').addEventListener('click',()=>{
  $('#exploreQuery').value='';$('#exploreCategory').value='all';
  $('#exploreStage').value='';$('#exploreFundingType').value='';$('#exploreAvailability').value='active';
  $('#exploreSort').value='relevance';selectedExploreFields.clear();renderFieldNavigation();resetExplorePage();
});
for(const id of ['explorePaginationTop','explorePaginationBottom'])$(`#${id}`).addEventListener('click',goToExplorePage);
$('#refinePriority').addEventListener('click',()=>{$('#profileRefinements').open=true;});
for(const id of ['results','exploreResults','priorityResults'])$(`#${id}`).addEventListener('click',event=>{const btn=event.target.closest('[data-save]');if(btn)toggleSaved(btn.dataset.save);});
$('#exploreResults').addEventListener('click',event=>{
  if(event.target.closest('[data-retry-archive]')){bulkArchiveError=false;renderExplore();}
});
function toggleSaved(key){
  if(saved.some(entry=>entry.key===key))saved=saved.filter(entry=>entry.key!==key);
  else{const record=records.find(o=>opportunityKey(o)===key)||bulkArchive?.find(o=>opportunityKey(o)===key);if(record)saved.push({key,record:publicRecordSnapshot(record),state:'Interested',created:new Date().toISOString().slice(0,10)});}
  persistShortlist();render();
}
function initializeFields(){
  for(const id of ['fieldFilter','hubField']){
    const el=$(`#${id}`);el.querySelectorAll('option:not([value=""])').forEach(option=>option.remove());
    el.insertAdjacentHTML('beforeend',FIELDS.map(field=>`<option value="${field.id}">${esc(field.label)}</option>`).join(''));
  }
}
function renderFieldNavigation(){
  $('#disciplineChips').innerHTML=`<button type="button" class="field-chip" data-explore-field="" aria-pressed="${selectedExploreFields.size===0}">All fields</button>`+
    FIELDS.map(field=>`<button type="button" class="field-chip" data-explore-field="${field.id}" aria-pressed="${selectedExploreFields.has(field.id)}">${esc(field.label)}</button>`).join('');
}
$('#disciplineChips').addEventListener('click',event=>{
  const btn=event.target.closest('[data-explore-field]');if(!btn)return;
  const field=btn.dataset.exploreField;if(!field)selectedExploreFields.clear();
  else if(selectedExploreFields.has(field))selectedExploreFields.delete(field);else selectedExploreFields.add(field);
  renderFieldNavigation();resetExplorePage();
});
function renderDashboard(matches){
  const stat=$('#dashboardStats');
  $('#dashboardIntro').textContent=hasProfile()?'Funding opportunities related to your research and career stage.':'Add your research interests in Step 1, or explore the catalog directly in Step 3.';
  stat.textContent=matches.length?`${matches.length} potential match${matches.length===1?'':'es'} · 10 per page`:'';
}
function savedWithProgress(){
  const lookup=new Map(restoreShortlist(records,saved).map(record=>[record.savedKey||opportunityKey(record),record]));
  return saved.map(entry=>({...normalizedTrackerEntry(entry),key:entry.key,record:lookup.get(entry.key)||entry.record})).filter(e=>e.record?.url&&e.record?.title)
    .sort((a,b)=>(fundingWindow(a.record).deadline||'9999-99-99').localeCompare(fundingWindow(b.record).deadline||'9999-99-99'));
}
function renderTracker(){
  const entries=savedWithProgress();const stats=trackerStats(entries),filter=$('#trackerFilter').value;
  $('#trackerStats').innerHTML=TRACK_STATES.map(s=>`<span class="tracker-state"><strong>${stats[s]}</strong>${esc(s)}</span>`).join('');
  const list=entries.filter(entry=>!filter||entry.state===filter);
  $('#trackerCount').textContent=`${list.length} shown of ${entries.length} saved`;
  $('#trackerList').innerHTML=list.length?list.map(entry=>{
    const k=esc(entry.key),record=entry.record,{deadline}=fundingWindow(record);
    return `<article class="tracker-row"><div class="tracker-record"><span class="dash-lead-sponsor">${esc(record.funder||'Funding sponsor')}</span><h3>${esc(record.title)}</h3><p>${deadline?'Listed deadline '+esc(deadline):'No fixed deadline confirmed'} · <a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer">Official details ↗</a></p></div><div class="tracker-controls"><label>Application stage<select data-tracker-state="${k}">${TRACK_STATES.map(s=>`<option ${s===entry.state?'selected':''}>${esc(s)}</option>`).join('')}</select></label><label>My target date<input type="date" data-tracker-date="${k}" value="${esc(entry.targetDate)}"></label><label class="tracker-note">My next action<input type="text" maxlength="400" placeholder="e.g. request mentor letter" data-tracker-note="${k}" value="${esc(entry.note)}"></label><button type="button" class="text-button tracker-remove" data-tracker-remove="${k}">Remove</button></div></article>`;
  }).join(''):`<div class="tracker-empty">${entries.length?'No applications in this stage.':'No applications saved yet. Save a funding lead to start tracking its requirements, next step and progress.'} <a href="#opportunities">Explore funding →</a></div>`;
}
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
function downloadText(contents,name,type){const url=URL.createObjectURL(new Blob([contents],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
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
function initializeSourceHubs(){
  const regions=[...new Set(sourceHubs.map(h=>h.region))].sort();
  const kinds=[...new Set(sourceHubs.map(h=>h.kind))].sort();
  $('#hubRegion').insertAdjacentHTML('beforeend',regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join(''));
  $('#hubKind').insertAdjacentHTML('beforeend',kinds.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join(''));
  renderSourceHubs();
}
function renderSourceHubs(){
  const filtered=filterHubs(sourceHubs,{field:$('#hubField').value,region:$('#hubRegion').value,kind:$('#hubKind').value,query:$('#hubQuery').value});
  $('#hubCount').textContent=`${filtered.length} source entr${filtered.length===1?'y':'ies'} · ${sourceHubs.length} in this directory. Funding pages and current rounds need verification.`;
  $('#hubResults').innerHTML=filtered.slice(0,hubLimit).map(h=>`<article class="hub-card"><span class="hub-kind">${esc(h.kind)} · ${esc(h.region)}</span><h3>${esc(h.name)}</h3><p>${esc(h.description)}</p><div class="hub-field-tags">${h.fields.slice(0,3).map(f=>`<span>${esc(f==='all'?'All disciplines':fieldName(f))}</span>`).join('')}</div><a href="${esc(safeUrl(h.url))}" target="_blank" rel="noopener noreferrer">Visit funding source ↗</a></article>`).join('')||'<p class="tracker-empty">No funder sources match the selected filters. Try all fields or regions.</p>';
  $('#hubMore').hidden=filtered.length<=hubLimit;
}
for(const id of ['hubField','hubRegion','hubKind','hubQuery'])$(`#${id}`).addEventListener(id==='hubQuery'?'input':'change',()=>{hubLimit=12;renderSourceHubs();});
$('#hubMore').addEventListener('click',()=>{hubLimit+=12;renderSourceHubs();});
function persistShortlist(){
  if(exampleMode){$('#shortlistStatus').textContent='Example shortlist lasts for this visit.';return false;}
  try{localStorage.setItem(SAVED_KEY,JSON.stringify(saved));$('#shortlistStatus').textContent='Shortlist saved on this browser.';return true;}
  catch{$('#shortlistStatus').textContent='Browser storage is full or unavailable. Copy or download funding links to keep them.';return false;}
}

function savedText(){return shortlistText(restoreShortlist(records,saved));}
$('#copyShortlist').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(savedText());$('#shortlistStatus').textContent='Shortlist copied with official links.';}catch{$('#shortlistFallback').value=savedText();$('#shortlistFallback').hidden=false;$('#shortlistFallback').select();$('#shortlistStatus').textContent='Copy your shortlist below.';}});
$('#downloadShortlist').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([savedText()],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Fundlark-shortlist.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
init();
