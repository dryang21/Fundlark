import {readCV} from './cv-reader.mjs';
import {setupOrganizations} from './organization-picker.mjs?v=1';
import {filterSources, relatedSources} from './coverage.mjs';
import {examples, cvReview, upcomingSaved} from './journey.mjs?v=cv-6';
import {researchTerms, normalizeProfile, selectRecords, statusOf,
  mergeCatalog, opportunityKey, assistantPrompt, discoveryLinks, shortlistText, publicRecordSnapshot, restoreShortlist, freshness, membershipMatches, societyKey, linkedPrograms, configureSocietyAliases} from './matching.mjs?v=membership-6';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = raw => {try {const url=new URL(raw);return url.protocol==='https:'?url.href:'#';}catch{return '#';}};
const labels = {open:'Listed open — confirm before applying',rolling:'Listed rolling — confirm availability',closed:'Past round / closed',forecast:'Upcoming call — not open yet',verify:'Current application window unconfirmed'};
const PROFILE_KEY='fundlark.public.profile.v1', SAVED_KEY='fundlark.public.shortlist.v1';
let coverageSources=[], coverageLimit=12, records=[], sources=[], visible=8, profile=normalizeProfile(), storageAvailable=true;
let apiBase='', communityEnabled=false, saved=[], matchedOnly=false;
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
  $('#cvHelper').hidden=true;
}
const hasProfile = () => Boolean(profile.stage||profile.topics.length||profile.societies.length||profile.institutions.length);
function saveProfile(){
  if(exampleMode){$('#profileStatus').textContent='Example changes last for this visit.';return;}
  try {localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));storageAvailable=true;}catch {storageAvailable=false;}
  $('#profileStatus').textContent=storageAvailable?'Saved on this browser only.':'Using this profile for this visit; browser storage is unavailable.';
}
let profileTimer, cvReadId=0;
const organizations=setupOrganizations({$,esc,onAdd(kind, name){
  const key=kind==='societies'?societyKey:value=>value.toLowerCase();
  if(name&&!profile[kind].some(item=>key(item)===key(name)))profile[kind].push(name);
}, onChange:()=>readProfile()});
function readProfile({consumeAffiliations=false}={}){
  clearTimeout(profileTimer);
  const text=$('#topics').value.trim();
  profile=normalizeProfile({...profile,researchText:text,topics:researchTerms(text,records.flatMap(o=>o.topics||[])),stage:$('#stage').value,sharePublic:$('#sharePublic').checked});
  if(consumeAffiliations)organizations.consume();
  profile=normalizeProfile(profile);renderChips();saveProfile();render();
}
function renderChips(){
  for(const [key,target] of [['societies','societyChips'],['institutions','institutionChips']]){
    $(`#${target}`).innerHTML=profile[key].map((name,index)=>{
      const label=organizations.display(key,name);
      return `<button type="button" class="chip" data-kind="${key}" data-index="${index}" aria-label="Remove ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`;
    }).join('');
  }
  $('#topicSummary').innerHTML=profile.topics.length?`<p>Words used for catalog matching <span class="small">· edit your description to refine</span></p><div class="chips">${profile.topics.map(t=>`<span class="topic-chip">${esc(t)}</span>`).join('')}</div>`:'';
}
function resetFilters({allFunding=false}={}){
  $('#query').value='';$('#category').value='all';$('#fundingType').value='';$('#availability').value='active';$('#savedOnly').checked=false;
  matchedOnly=!allFunding&&hasProfile();visible=8;render();
}
function renderCoverage(){
  const filtered=filterSources(coverageSources,{query:$('#coverageQuery').value,field:$('#coverageField').value,kind:$('#coverageKind').value});
  $('#coverageCount').textContent=`${filtered.length} sources${filtered.length?' · showing '+Math.min(filtered.length,coverageLimit):''}`;
  $('#coverageResults').innerHTML=filtered.slice(0,coverageLimit).map(source=>`<li><a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a><span>${esc(source.alias)} · ${esc(source.kind)} · ${esc(source.fields.join(', '))}</span><small>${source.program_ids?.length?'Funding records below, including any past rounds.':'Directory only; funding not reviewed.'}</small>${source.program_ids?.length?awardLinks(linkedPrograms(records,source.program_ids)):''}</li>`).join('')||'<li>No sources in this directory match these filters.</li>';
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
  $('#returnDeadlines').textContent=upcoming.length?`Earliest listed deadline: ${upcoming[0].deadline} · ${upcoming[0].title}. Confirm the official call.`:'No listed open deadlines in the next 30 days among your saved leads.';
}
function awardLinks(awards){
  const row=record=>`<li><a href="${esc(safeUrl(record.url))}" target="_blank" rel="noopener noreferrer">${esc(record.title)} ↗</a><small>${esc([labels[statusOf(record)]||labels.verify,record.amount,record.deadline?'Deadline: '+record.deadline:null].filter(Boolean).join(' · '))}</small></li>`;
  const current=awards.filter(record=>statusOf(record)!=='closed'), past=awards.filter(record=>statusOf(record)==='closed');
  return (current.length?`<ul class="award-links">${current.map(row).join('')}</ul>`:'<p>No current leads indexed for this source.</p>')+
    (past.length?`<details><summary>Past rounds (${past.length})</summary><ul class="award-links">${past.map(row).join('')}</ul></details>`:'');
}
function renderMemberships(){
  $('#membershipFunding').hidden=!profile.societies.length;
  if(!profile.societies.length)return;
  $('#membershipResults').innerHTML=profile.societies.map(name=>{
    const awards=records.filter(record=>membershipMatches(record,[name]).length);
    const source=coverageSources.find(source=>source.kind==='society'&&[source.alias,source.name].some(value=>societyKey(value)===societyKey(name)));
    return `<section><h3>${esc(organizations.display('societies',name))}</h3>${awardLinks(awards)}${source?`<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">Visit the society ↗</a>`:''}</section>`;
  }).join('');
}
function refreshSupportTypes(){
  const control=$('#fundingType'), selection=control.value;
  const types=[...new Set(records.map(record=>record.funding_type).filter(type=>typeof type==='string'&&type))].sort();
  control.innerHTML='<option value="">All support types</option>'+types.map(type=>`<option value="${esc(type)}">${esc(type)}</option>`).join('');
  if(types.includes(selection))control.value=selection;
}
function findFunding(){
  readProfile({consumeAffiliations:true});
  resetFilters();
  $('#opportunities').scrollIntoView({behavior:'smooth'});
}
function render(){
  const savedRecords=restoreShortlist(records,saved);
  renderReturn(savedRecords);
  renderMemberships();
  const catalog=$('#savedOnly').checked?savedRecords:records;
  const availability=$('#availability').value, shortlist=$('#savedOnly').checked;
  const filtered=selectRecords(catalog,profile,{query:$('#query').value,category:$('#category').value,availability,fundingType:$('#fundingType').value,matchedOnly});
  $('#matchedOnly').setAttribute('aria-pressed',String(matchedOnly&&!shortlist));
  $('#browseFunding').setAttribute('aria-pressed',String(!matchedOnly&&!shortlist));
  $('#savedCount').textContent=`(${savedRecords.length})`;
  $('#shortlistTools').hidden=!savedRecords.length;
  $('#shortlistStorageLabel').textContent=exampleMode?'Example shortlist · this visit only':'Saved on this browser only. Notes stay here and aren’t included in exports.';
  const hiddenPast=records.filter(record=>statusOf(record)==='closed').length;
  $('#resultCount').textContent=shortlist?`${filtered.length} of ${catalog.length} saved`:`${filtered.length} ${matchedOnly?'matching ':''}program${filtered.length===1?'':'s'} · ${records.length} indexed${availability==='active'&&hiddenPast?` · ${hiddenPast} past rounds hidden`:''}`;
  const summary=[];
  if(profile.topics.length)summary.push(`${profile.topics.length} research ${profile.topics.length===1?'term':'terms'}`);
  if(profile.stage)summary.push($('#stage').selectedOptions[0]?.textContent||profile.stage);
  if(profile.societies.length)summary.push(`${profile.societies.length} ${profile.societies.length===1?'membership':'memberships'}`);
  if(profile.institutions.length)summary.push(`${profile.institutions.length} ${profile.institutions.length===1?'institution':'institutions'}`);
  $('#matchSummary').textContent=summary.length?`Your profile: ${summary.join(' · ')}. ${matchedOnly?'Showing leads based on your profile. Check the official applicant rules.':'Browsing the catalog. Choose Match my profile for personalized leads.'}`:'Browse programs, or add a research interest, career stage, or affiliation for personalized leads.';
  $('#results').innerHTML=filtered.length?filtered.slice(0,visible).map(o=>{
    const status=statusOf(o),key=opportunityKey(o),isSaved=saved.some(entry=>entry.key===key);
    const reasons=[...o.matching.topicEvidence.map(({term,matched,related})=>related?`${term} → related catalog term: ${matched}`:`Catalog mentions: ${term}`),...o.matching.affiliations.map(t=>`Catalog tags your affiliation: ${t}`)];
    const entry=saved.find(item=>item.key===key);
    const checked=o.last_verified_at?.slice(0,10)||'Unknown';
    const concise=(value,fallback)=>{const text=(value||fallback).replace(/\s+/g,' ').trim();return text.length<=180?text:text.slice(0,177).replace(/\s+\S*$/,'')+'…';};
    const rules=concise(o.eligibility,'Check the official applicant rules.');
    const scope=concise(o.description,o.funding_type||'See the official call for award details.');
    const timing=[labels[status]||labels.verify,o.deadline?'Deadline '+o.deadline:'Check the official date'].join(' · ');
    const fitNotes=[o.matching.stageConcern?o.matching.stage:'',o.matching.affiliationConcern?'No matching affiliation in your profile':''].filter(Boolean);
    return `<article class="card"><div class="card-top"><span>${esc(o.funder)}</span><span class="category">${esc(o.category)}</span></div>
      <h3>${esc(o.title)}</h3>
      <ul class="funding-bullets">
        <li><strong>What it funds</strong> ${esc(o.amount?o.amount+' · ':'')}${esc(scope)}</li>
        <li><strong>Who can apply</strong> ${esc(rules)}</li>
        <li><strong>When to act</strong> ${esc(timing)}</li>
      </ul>
      ${o.archived?'<p class="stage-hint stage-concern">Saved snapshot — recheck the official call.</p>':o.detailsChanged?'<p class="stage-hint">Catalog details changed since you saved this program.</p>':''}
      ${fitNotes.length&&hasProfile()?`<p class="stage-hint stage-concern">${esc(fitNotes.join(' · '))}</p>`:''}
      <details><summary>Match details and source check</summary>
        ${reasons.length?`<p>${esc(reasons.join(' · '))}</p>`:''}
        <p><strong>Applicant rules:</strong> ${esc(o.eligibility||'Confirm the official applicant rules.')}</p>
        ${o.description&&scope!==o.description?`<p><strong>Program details:</strong> ${esc(o.description)}</p>`:''}
        <p>Record checked/imported: ${esc(checked)}.${freshness(o)?' '+esc(freshness(o)):''} A topic or affiliation match does not establish eligibility.</p>
      </details>
      <div class="card-actions"><a class="source-link" href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">View official call ↗</a><button type="button" class="save-button" data-save="${esc(key)}" aria-pressed="${isSaved}">${isSaved?'Saved ✓':'Save'}</button></div>
      ${isSaved&&$('#savedOnly').checked?`<div class="saved-note"><label>My next step<input type="text" maxlength="200" placeholder="For example: ask about the applicant rules" data-note="${esc(key)}" value="${esc(entry?.note||'')}"></label></div>`:''}</article>`;
  }).join(''):emptyState();
  $('#showMore').hidden=filtered.length<=visible;
  renderRoutes();
}
function emptyState(){
  const title=$('#savedOnly').checked?'No saved programs match these filters.':matchedOnly?'We haven’t indexed matches for this profile and these filters yet.':'No programs match these filters.';
  const routes=discoveryLinks(profile,sources);
  return `<div class="empty"><h3>${title}</h3><p>This is a limited catalog, not a search of all available funding. You can explore more sources without changing your research interests.</p><div class="empty-actions"><button type="button" class="button" data-action="assistant">Copy a search request for my assistant</button><button type="button" class="button secondary" data-action="browse">Browse current funding</button><button type="button" class="text-button" data-action="reset">Clear search filters</button></div>${profileDirectory()}${routes.length?`<div class="route-links">${routes.map(link=>`<span><a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>${link.note?`<small>${esc(link.note)}</small>`: ''}</span>`).join('')}</div>`:''}<p class="small">Explore the <a href="#coverage">society and conference directory</a> for more starting points. An assistant with browsing can search beyond this catalog. No Fundlark skill is required for the copied request.</p></div>`;
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
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('Unavailable');return response.json();}
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
    records=mergeCatalog(records,data.opportunities);refreshSupportTypes();render();
  }catch { /* Published catalog remains usable when the optional service is offline. */ }
  updateSharing();
}
async function init(){
  const coverageRequest=json('coverage.json?v=profile-directory-1').catch(()=>null);
  try{
    const [data, directory]=await Promise.all([json('data.json?v=profile-directory-1').catch(()=>null),coverageRequest]);const baseAvailable=data?.schema_version===1&&Array.isArray(data.opportunities);
    records=baseAvailable?data.opportunities:[];sources=baseAvailable?(data.sources||[]):[];
    if(directory?.schema_version===1){
      coverageSources=directory.sources;
      configureSocietyAliases(coverageSources);
      records=mergeCatalog(records,directory.opportunities);
      $('#coverageField').insertAdjacentHTML('beforeend',directory.fields.map(field=>`<option value="${esc(field)}">${esc(field)}</option>`).join(''));
      $('#coverageSummary').textContent=`${directory.fields.length} field and topic labels · ${coverageSources.length} societies and conferences · ${directory.opportunities.length} curated funding records, including past and unconfirmed rounds.`;
      renderCoverage();
    }else $('#coverageSummary').textContent='The source directory could not be loaded.';

    organizations.setDirectory(coverageSources,[...sources.map(source=>source.institution),...records.map(record=>record.affiliation_tags?.institution)]);
    profile=normalizeProfile({...profile,societies:profile.societies.map(name=>organizations.resolve('societies',name)),institutions:profile.institutions.map(name=>organizations.resolve('institutions',name))});
    renderChips();
    refreshSupportTypes();
    if(exampleMode){
      profile.topics=researchTerms(profile.researchText,records.flatMap(o=>o.topics||[]));
      renderChips();
    }
    for(const entry of saved)if(!entry.record){const record=records.find(o=>opportunityKey(o)===entry.key);if(record)entry.record=publicRecordSnapshot(record);}
    $('#snapshotStatus').textContent=`${records.length} catalog programs · ${baseAvailable?'Base snapshot '+new Date(data.generated_at).toLocaleDateString():'Base snapshot unavailable'} · Coverage and source dates vary`;
    render();
  }catch {$('#snapshotStatus').textContent='The catalog could not be loaded.';$('#results').innerHTML='<div class="empty"><h3>Funding catalog temporarily unavailable</h3><p>Your profile is still here. Try reloading or continue with a search request for your assistant below.</p><a class="button" href="#use-skill">Continue with my assistant</a></div>';$('#resultCount').textContent='Catalog unavailable';}
  await initCommunity();
}
$('#topics').value=profile.researchText||profile.topics.join('; ');$('#stage').value=profile.stage;$('#sharePublic').checked=profile.sharePublic;
matchedOnly=hasProfile();$('#affiliationDetails').open=Boolean(profile.societies.length||profile.institutions.length);renderChips();
$('#topics').addEventListener('input',()=>{clearTimeout(profileTimer);$('#profileStatus').textContent='Updating your research profile…';profileTimer=setTimeout(()=>readProfile(),300);});
$('#stage').addEventListener('change',readProfile);
$('#profileForm').addEventListener('click',event=>{const button=event.target.closest('button[data-kind]');if(button){profile[button.dataset.kind].splice(Number(button.dataset.index),1);readProfile();}});
$('#profileForm').addEventListener('submit',event=>{event.preventDefault();findFunding();});
$('#clearProfile').addEventListener('click',()=>{
  clearTimeout(profileTimer);cvReadId++;clearCVPreview();organizations.clear();$('#cvText').value='';$('#cvFile').value='';$('#cvSuggestions').textContent='';$('#cvStatus').textContent='';profile=normalizeProfile();$('#topics').value='';$('#stage').value='';$('#sharePublic').checked=false;matchedOnly=false;$('#briefFallback').value='';$('#briefFallback').hidden=true;$('#copyStatus').textContent='';
  if(!exampleMode)try{localStorage.removeItem(PROFILE_KEY);}catch{}renderChips();render();$('#profileStatus').textContent=exampleMode?'Example profile cleared.':'Research profile cleared. Your saved shortlist is unchanged.';
});
$('#skillMode').addEventListener('change',()=>{updateSharing();$('#copyStatus').textContent='Copy a new request to apply this choice.';});
$('#sharePublic').addEventListener('change',()=>{readProfile();$('#copyStatus').textContent='Copy a new request to apply this sharing preference.';});
$('#searchForm').addEventListener('submit',event=>{event.preventDefault();visible=8;render();});
for(const id of ['query','category','fundingType','availability'])$(`#${id}`).addEventListener(id==='query'?'input':'change',()=>{visible=8;render();});
$('#browseFunding').addEventListener('click',()=>resetFilters({allFunding:true}));
$('#matchedOnly').addEventListener('click',()=>{
  readProfile({consumeAffiliations:true});
  if(!hasProfile()){
    $('#profileStatus').textContent='Add a research topic, career stage, membership, or current institution to find matches.';
    $('#topics').focus();
    return;
  }
  resetFilters();
});
function showShortlist(){
  $('#savedOnly').checked=true;
  $('#availability').value='all';matchedOnly=false;$('#query').value='';$('#category').value='all';$('#fundingType').value='';
  visible=8;render();
}
$('#savedOnly').addEventListener('change',()=>{if($('#savedOnly').checked)showShortlist();else resetFilters();});
$('#resumeShortlist').addEventListener('click',()=>{showShortlist();$('#opportunities').scrollIntoView();});
$('#resumeMatches').addEventListener('click',()=>{resetFilters();$('#opportunities').scrollIntoView();});
$('#resetFilters').addEventListener('click',()=>resetFilters({allFunding:true}));
$('#showMore').addEventListener('click',()=>{visible+=8;render();});
$('#copyPrompt').addEventListener('click',copyRequest);
$('#results').addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='assistant')copyRequest();if(action==='browse')resetFilters({allFunding:true});if(action==='reset')resetFilters({allFunding:true});
  const button=event.target.closest('[data-save]');if(!button)return;
  const key=button.dataset.save;
  if(saved.some(entry=>entry.key===key))saved=saved.filter(entry=>entry.key!==key);
  else{const record=records.find(o=>opportunityKey(o)===key);if(record)saved.push({key,record:publicRecordSnapshot(record)});}
  persistShortlist();
  render();
});
function persistShortlist(){
  if(exampleMode){$('#shortlistStatus').textContent='Example shortlist lasts for this visit.';return;}
  try{localStorage.setItem(SAVED_KEY,JSON.stringify(saved));$('#shortlistStatus').textContent='Shortlist saved on this browser.';}
  catch{$('#shortlistStatus').textContent='Browser storage is full or unavailable. Copy or download funding links to keep them.';}
}
$('#results').addEventListener('input',event=>{
  if(!event.target.matches('[data-note]'))return;
  const entry=saved.find(item=>item.key===event.target.dataset.note);
  if(entry){entry.note=event.target.value.slice(0,200);persistShortlist();}
});
function clearCVPreview(){
  $('#cvExtracted').value='';
  $('#cvPreview').open=false;
  $('#cvPreview').hidden=true;
  $('#cvPreviewStatus').textContent='';
}
function appendCVTopics(topics){
  const existing=$('#topics').value.trim();
  const keys=new Set(existing.toLowerCase().split(/[,;\n]/).map(value=>value.trim()));
  $('#topics').value=[existing,...topics.filter(topic=>!keys.has(topic.toLowerCase()))].filter(Boolean).join('; ').slice(0,3200);
}
function reviewCV(text){
  clearCVPreview();
  $('#cvExtracted').value=text;
  $('#cvPreview').hidden=!text.trim();
  const review=cvReview(text,coverageSources,records.flatMap(record=>record.topics||[]));
  if(!showCVSuggestions(review)&&text.trim())$('#cvPreview').open=true;
}
$('#discardCV').addEventListener('click',()=>{
  clearCVPreview();
  $('#cvSuggestions').textContent='';
  $('#cvStatus').textContent='Extracted text and unconfirmed suggestions discarded.';
});
$('#useCVSelection').addEventListener('click',()=>{
  const field=$('#cvExtracted');
  const selected=field.value.slice(field.selectionStart,field.selectionEnd).trim();
  if(!selected||selected.length>300||/[@]|https?:|\b\d{5}/i.test(selected)){
    $('#cvPreviewStatus').textContent='Highlight a short research phrase without contact details, then try again.';
    return;
  }
  appendCVTopics([selected]);
  readProfile();
  $('#cvPreviewStatus').textContent='Added to your research interests.';
});
function showCVSuggestions({result,evidence,stages}){
  const stageSelect=$('#stage');
  const groups=[
    ['topics','Research keywords',[...evidence.topics.values()]],
    ['stage','Career stage',stages],
    ['societies','Professional memberships',[...evidence.societies.values()]],
    ['institutions','Current institutions',[...evidence.institutions.values()]],
  ];
  const items=groups.flatMap(([key,,matches])=>matches.map(match=>({key,...match})));
  const container=$('#cvSuggestions');
  if(!items.length){
    container.textContent='';
    $('#cvStatus').textContent=$('#cvExtracted').value.trim()?'The CV text was read, but no clear profile details were found. Review the extracted text or fill in your profile below.':'No text to review. Choose a CV or paste an excerpt.';
    return false;
  }
  const conflicts=stages.length>1;
  const hasCurrentStage=Boolean(stageSelect.value);
  const matchStatus=`Found ${items.length} suggestion${items.length===1?'':'s'}. Review the details, then add the ones that fit.`;
  $('#cvStatus').textContent=matchStatus;
  let index=0;
  container.innerHTML=groups.map(([key,heading,matches])=>{
    const multipleStages=key==='stage'&&conflicts;
    const note=multipleStages?'Several current roles were found. Pick the stage to use for funding.':!matches.length?'No clear suggestion. You can fill this in below.':'';
    return `<fieldset class="cv-group"><legend>${heading}</legend>${note?`<p class="note">${note}</p>`:''}${matches.map(({value,excerpt})=>{
      const label=key==='stage'?stageSelect.querySelector(`option[value="${value}"]`)?.textContent||value:organizations.display(key,value);
      const checked=key==='topics'||key==='stage'&&result.stage===value&&(!hasCurrentStage||stageSelect.value===value);
      const optional=key==='stage'&&hasCurrentStage&&stageSelect.value!==value;
      return `<label><input type="${multipleStages?'radio':'checkbox'}" name="${multipleStages?'cvStage':'cvChoice'}" data-suggestion="${index++}" ${checked?'checked':''}> <span>${esc(label)}${optional?' (replace saved stage)':''}${excerpt&&excerpt.toLowerCase()!==label.toLowerCase()?`<small class="cv-evidence">${esc(excerpt)}</small>`:''}</span></label>`;
    }).join('')}</fieldset>`;
  }).join('')+'<button id="applyCV" type="button" class="button secondary">Find funding with selected details</button>';
  $('#applyCV').addEventListener('click',()=>{
    const selected=[...container.querySelectorAll(':checked')].map(el=>items[Number(el.dataset.suggestion)]);
    if(!selected.length){$('#cvStatus').textContent='Select at least one suggestion to add.';return;}
    appendCVTopics(selected.filter(({key})=>key==='topics').map(({value})=>value));
    for(const {key,value} of selected){
      if(key==='stage')stageSelect.value=value;
      if(key==='societies'||key==='institutions'){
        const keyOf=key==='societies'?societyKey:name=>name.toLowerCase();
        const name=organizations.resolve(key,value);
        if(!profile[key].some(item=>keyOf(item)===keyOf(name)))profile[key].push(name);
        $('#affiliationDetails').open=true;
      }
    }
    container.textContent='';
    clearCVPreview();
    $('#cvStatus').textContent='Selected details added to your research profile.';
    findFunding();
  });
  return true;
}
$('#scanCV').addEventListener('click',()=>{
  cvReadId++;
  $('#cvFile').value='';
  const text=$('#cvText').value;
  $('#cvText').value='';
  reviewCV(text);
});
$('#cvFile').addEventListener('change',async()=>{
  const file=$('#cvFile').files[0];
  $('#cvFile').value='';
  if(!file)return;
  await inspectCV(()=>file);
});
$('#trySampleCV').addEventListener('click',()=>inspectCV(async()=>{
  const response=await fetch('sample-cv.txt',{signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('The sample CV could not load. Try downloading it or choose a file from your device.');
  return new File([await response.blob()],'sample-cv.txt',{type:'text/plain'});
},'The sample CV could not load. Try downloading it or choose a file from your device.'));
async function inspectCV(loadFile,fallback='Could not read this file. Use an unlocked, text-based PDF or DOCX, or paste an excerpt.'){
  const readId=++cvReadId;
  clearCVPreview();
  $('#cvSuggestions').textContent='';
  $('#cvStatus').textContent='Reading your CV in this browser…';
  try{const text=await readCV(await loadFile());if(readId===cvReadId)reviewCV(text);}
  catch(error){if(readId===cvReadId)$('#cvStatus').textContent=/^Choose |^No readable/.test(error.message)?error.message:fallback;}
}
function savedText(){return shortlistText(restoreShortlist(records,saved));}
$('#copyShortlist').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(savedText());$('#shortlistStatus').textContent='Shortlist copied with official links.';}catch{$('#shortlistFallback').value=savedText();$('#shortlistFallback').hidden=false;$('#shortlistFallback').select();$('#shortlistStatus').textContent='Copy your shortlist below.';}});
$('#downloadShortlist').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([savedText()],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Fundlark-shortlist.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
init();
