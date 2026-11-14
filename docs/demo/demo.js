import {filterSources, relatedSources} from './coverage.mjs';
import {examples, cvSuggestions, upcomingSaved} from './journey.mjs';
import {SOCIETIES, INSTITUTIONS, researchTerms, normalizeProfile, selectRecords, statusOf,
  mergeCatalog, opportunityKey, assistantPrompt, discoveryLinks, shortlistText, publicRecordSnapshot, restoreShortlist, freshness} from './matching.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = raw => {try {const url=new URL(raw);return url.protocol==='https:'?url.href:'#';}catch{return '#';}};
const labels = {open:'Listed open — confirm before applying',rolling:'Listed rolling — confirm availability',closed:'Past round / closed',forecast:'Upcoming call — not open yet',verify:'Current application window unconfirmed'};
const PROFILE_KEY='fundlark.public.profile.v1', SAVED_KEY='fundlark.public.shortlist.v1';
let coverageSources=[], coverageLimit=12, records=[], sources=[], visible=8, profile=normalizeProfile(), storageAvailable=true;
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
  $('#cvHelper').hidden=true;
}
const hasProfile = () => Boolean(profile.topics.length||profile.societies.length||profile.institutions.length);
function saveProfile(){
  if(exampleMode){$('#profileStatus').textContent='Example changes last for this visit.';return;}
  try {localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));storageAvailable=true;}catch {storageAvailable=false;}
  $('#profileStatus').textContent=storageAvailable?'Saved on this browser only.':'Using this profile for this visit; browser storage is unavailable.';
}
let profileTimer, cvReadId=0;
function readProfile({consumeAffiliations=false}={}){
  clearTimeout(profileTimer);
  const text=$('#topics').value.trim();
  profile=normalizeProfile({...profile,researchText:text,topics:researchTerms(text,records.flatMap(o=>o.topics||[])),stage:$('#stage').value,sharePublic:$('#sharePublic').checked});
  for(const [key,input,choices] of [['societies','societyInput',SOCIETIES],['institutions','institutionInput',INSTITUTIONS]]){
    const value=$(`#${input}`).value.trim();
    if(value&&consumeAffiliations){const name=choices.find(n=>n.toLowerCase()===value.toLowerCase())||value;if(!profile[key].some(n=>n.toLowerCase()===name.toLowerCase()))profile[key].push(name);$(`#${input}`).value='';}
  }
  profile=normalizeProfile(profile);renderChips();saveProfile();render();
}
function renderChips(){
  for(const [key,target] of [['societies','societyChips'],['institutions','institutionChips']]){
    $(`#${target}`).innerHTML=profile[key].map((name,index)=>`<button type="button" class="chip" data-kind="${key}" data-index="${index}" aria-label="Remove ${esc(name)}">${esc(name)} <span aria-hidden="true">×</span></button>`).join('');
  }
  $('#topicSummary').innerHTML=profile.topics.length?`<p>Words used for catalog matching <span class="small">· edit your description to refine</span></p><div class="chips">${profile.topics.map(t=>`<span class="topic-chip">${esc(t)}</span>`).join('')}</div>`:'';
}
function resetFilters({allFunding=false}={}){
  $('#query').value='';$('#category').value='all';$('#fundingType').value='';$('#availability').value='active';$('#savedOnly').checked=false;
  $('#matchedOnly').checked=allFunding?false:hasProfile();visible=8;render();
}
function renderCoverage(){
  const filtered=filterSources(coverageSources,{query:$('#coverageQuery').value,field:$('#coverageField').value,kind:$('#coverageKind').value});
  $('#coverageCount').textContent=`${filtered.length} sources${filtered.length?' · showing '+Math.min(filtered.length,coverageLimit):''}`;
  $('#coverageResults').innerHTML=filtered.slice(0,coverageLimit).map(source=>`<li><a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a><span>${esc(source.alias)} · ${esc(source.kind)} · ${esc(source.fields.join(', '))}</span><small>${source.program_ids?.length?'Funding information indexed; see the catalog for round status.':'Directory only; funding not reviewed.'}</small></li>`).join('')||'<li>No sources in this directory match these filters.</li>';
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
function refreshSupportTypes(){
  const control=$('#fundingType'), selection=control.value;
  const types=[...new Set(records.map(record=>record.funding_type).filter(type=>typeof type==='string'&&type))].sort();
  control.innerHTML='<option value="">All support types</option>'+types.map(type=>`<option value="${esc(type)}">${esc(type)}</option>`).join('');
  if(types.includes(selection))control.value=selection;
}
function render(){
  const savedRecords=restoreShortlist(records,saved);
  renderReturn(savedRecords);
  const catalog=$('#savedOnly').checked?savedRecords:records;
  const filtered=selectRecords(catalog,profile,{query:$('#query').value,category:$('#category').value,availability:$('#availability').value,fundingType:$('#fundingType').value,matchedOnly:$('#matchedOnly').checked,savedOnly:false});
  $('#savedCount').textContent=`(${savedRecords.length})`;
  $('#shortlistTools').hidden=!savedRecords.length;
  $('#shortlistStorageLabel').textContent=exampleMode?'Example shortlist · this visit only':'Saved on this browser only. Notes stay here and aren’t included in exports.';
  $('#resultCount').textContent=`${filtered.length} ${filtered.length===1?'program':'programs'}`;
  const summary=[];
  if(profile.topics.length)summary.push(`${profile.topics.length} research ${profile.topics.length===1?'term':'terms'}`);
  if(profile.stage)summary.push($('#stage').selectedOptions[0]?.textContent||profile.stage);
  if(profile.societies.length)summary.push(`${profile.societies.length} ${profile.societies.length===1?'membership':'memberships'}`);
  if(profile.institutions.length)summary.push(`${profile.institutions.length} ${profile.institutions.length===1?'institution':'institutions'}`);
  $('#matchSummary').textContent=summary.length?`Your profile: ${summary.join(' · ')}. Results show keyword and affiliation overlap, not confirmed eligibility.`:'Browse programs, or describe your research above for personalized matches.';
  $('#matchedOnly').disabled=!hasProfile();
  $('#results').innerHTML=filtered.length?filtered.slice(0,visible).map(o=>{
    const status=statusOf(o),key=opportunityKey(o),isSaved=saved.some(entry=>entry.key===key);
    const reasons=[...o.matching.topicEvidence.map(({term,matched,related})=>related?`${term} → related catalog term: ${matched}`:`Catalog mentions: ${term}`),...o.matching.affiliations.map(t=>`Catalog tags your affiliation: ${t}`)];
    const entry=saved.find(item=>item.key===key);
    const checked=o.last_verified_at?.slice(0,10)||'Unknown';
    return `<article class="card"><div class="card-top"><span>${esc(o.funder)}</span><span class="category">${esc(o.category)}</span></div><h3>${esc(o.title)}</h3><p class="description">${esc(o.description)}</p>${o.archived?'<p class="stage-hint stage-concern">Saved snapshot — no longer in the current catalog. Recheck the official page.</p>':o.detailsChanged?'<p class="stage-hint">Catalog details changed since you saved this program.</p>':''}${reasons.length?`<p class="match-reasons">${esc(reasons.join(' · '))}</p>`:''}<div class="meta"><span class="badge ${status==='closed'?'closed':status==='verify'||status==='forecast'?'caution':''}">${esc(labels[status]||labels.verify)}</span></div><p class="funding-facts"><strong>${esc(o.amount||'Amount not provided')}</strong><br>Deadline: ${esc(o.deadline||'Check official call')}</p><p class="stage-hint ${o.matching.stageConcern?'stage-concern':''}">${esc(o.matching.stage)}.</p><p class="record-date">Record checked/imported: ${esc(checked)}${freshness(o)?`<br><span class="freshness-warning">${esc(freshness(o))}</span>`:''}</p><details><summary>How it matches & what to verify</summary><p><strong>Applicant rules:</strong> ${esc(o.eligibility||'Confirm the official applicant rules.')}</p><p>Record checked/imported: ${esc(checked)}.${o.review_needed?' Source changed; this record needs review.':''} A topic or affiliation match does not establish eligibility.</p><p>Next step: read the current call to confirm the application window, applicant rules and required documents.</p></details><div class="card-actions"><a class="source-link" href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">View official call ↗</a><button type="button" class="save-button" data-save="${esc(key)}" aria-pressed="${isSaved}">${isSaved?'Saved ✓':'Save'}</button></div>${isSaved&&$('#savedOnly').checked?`<div class="saved-note"><label>My next step<input type="text" maxlength="200" placeholder="For example: ask about the applicant rules" data-note="${esc(key)}" value="${esc(entry?.note||'')}"></label></div>`:''}</article>`;
  }).join(''):emptyState();
  $('#showMore').hidden=filtered.length<=visible;
  renderRoutes();
}
function emptyState(){
  const title=$('#savedOnly').checked?'No saved programs match these filters.':hasProfile()?'We haven’t indexed matches for these topics and filters yet.':'No programs match these filters.';
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
  const coverageRequest=json('coverage.json').catch(()=>null);
  try{
    const [data, directory]=await Promise.all([json('data.json').catch(()=>null),coverageRequest]);const baseAvailable=data?.schema_version===1&&Array.isArray(data.opportunities);
    records=baseAvailable?data.opportunities:[];sources=baseAvailable?(data.sources||[]):[];
    if(directory?.schema_version===1){
      coverageSources=directory.sources;
      records=mergeCatalog(records,directory.opportunities);
      $('#coverageField').insertAdjacentHTML('beforeend',directory.fields.map(field=>`<option value="${esc(field)}">${esc(field)}</option>`).join(''));
      $('#coverageSummary').textContent=`${directory.fields.length} field and topic labels · ${coverageSources.length} societies and conferences · ${directory.opportunities.length} curated funding records, including past and unconfirmed rounds.`;
      renderCoverage();
    }else $('#coverageSummary').textContent='The source directory could not be loaded.';

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
$('#matchedOnly').checked=hasProfile();$('#affiliationDetails').open=Boolean(profile.societies.length||profile.institutions.length);renderChips();
$('#societyOptions').innerHTML=SOCIETIES.map(name=>`<option value="${esc(name)}">`).join('');
$('#institutionOptions').innerHTML=INSTITUTIONS.map(name=>`<option value="${esc(name)}">`).join('');
for(const [button,input] of [['addSociety','societyInput'],['addInstitution','institutionInput']]){
  $(`#${button}`).addEventListener('click',()=>readProfile({consumeAffiliations:true}));
  $(`#${input}`).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();readProfile({consumeAffiliations:true});}});
}
$('#topics').addEventListener('input',()=>{clearTimeout(profileTimer);$('#profileStatus').textContent='Updating your research profile…';profileTimer=setTimeout(()=>readProfile(),300);});
$('#stage').addEventListener('change',readProfile);
$('#profileForm').addEventListener('click',event=>{const button=event.target.closest('button[data-kind]');if(button){profile[button.dataset.kind].splice(Number(button.dataset.index),1);readProfile();}});
$('#profileForm').addEventListener('submit',event=>{event.preventDefault();readProfile({consumeAffiliations:true});resetFilters();$('#opportunities').scrollIntoView({behavior:'smooth'});});
$('#clearProfile').addEventListener('click',()=>{
  clearTimeout(profileTimer);cvReadId++;$('#cvText').value='';$('#cvFile').value='';$('#cvSuggestions').textContent='';$('#cvStatus').textContent='';profile=normalizeProfile();$('#topics').value='';$('#stage').value='';$('#societyInput').value='';$('#institutionInput').value='';$('#sharePublic').checked=false;$('#matchedOnly').checked=false;$('#briefFallback').value='';$('#briefFallback').hidden=true;$('#copyStatus').textContent='';
  if(!exampleMode)try{localStorage.removeItem(PROFILE_KEY);}catch{}renderChips();render();$('#profileStatus').textContent=exampleMode?'Example profile cleared.':'Research profile cleared. Your saved shortlist is unchanged.';
});
$('#skillMode').addEventListener('change',()=>{updateSharing();$('#copyStatus').textContent='Copy a new request to apply this choice.';});
$('#sharePublic').addEventListener('change',()=>{readProfile();$('#copyStatus').textContent='Copy a new request to apply this sharing preference.';});
$('#searchForm').addEventListener('submit',event=>{event.preventDefault();visible=8;render();});
for(const id of ['query','category','fundingType','availability','matchedOnly'])$(`#${id}`).addEventListener(id==='query'?'input':'change',()=>{visible=8;render();});
function showShortlist(){
  $('#savedOnly').checked=true;
  $('#availability').value='all';$('#matchedOnly').checked=false;$('#query').value='';$('#category').value='all';$('#fundingType').value='';
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
function showCVSuggestions(suggestions){
  const items=[...suggestions.topics.map(value=>['topics',value]),...suggestions.societies.map(value=>['societies',value]),...suggestions.institutions.map(value=>['institutions',value]),...(suggestions.stage?[['stage',suggestions.stage]]:[])];
  const fieldLabels={topics:'Topic',societies:'Membership',institutions:'Current institution',stage:'Career stage'};
  const stageName=$('#stage').querySelector(`option[value="${suggestions.stage}"]`)?.textContent;
  $('#cvStatus').textContent=items.length?'Select only the details you want to add. Nothing has been added yet.':'No labeled details found. Add your interests manually, or paste lines labeled Research interests, Current appointment or Professional memberships.';
  $('#cvSuggestions').innerHTML=items.length?`<fieldset><legend>Suggested details</legend>${items.map(([key,value],index)=>`<label><input type="checkbox" data-suggestion="${index}"> ${fieldLabels[key]}: ${esc(key==='stage'?stageName||value:value)}</label>`).join('')}<button id="applyCV" type="button" class="button secondary">Add selected details</button></fieldset>`:'';
  $('#applyCV')?.addEventListener('click',()=>{
    const selected=[...$('#cvSuggestions').querySelectorAll(':checked')].map(el=>items[Number(el.dataset.suggestion)]);
    if(!selected.length){$('#cvStatus').textContent='Select at least one suggestion to add.';return;}
    clearTimeout(profileTimer);
    const topics=selected.filter(([key])=>key==='topics').map(([,value])=>value);
    if (topics.length) $('#topics').value=[$('#topics').value.trim(),...topics].filter(Boolean).join('; ').slice(0,3200);
    for(const [key,value] of selected){
      if(key==='stage')$('#stage').value=value;
      if(key==='societies'||key==='institutions'){
        if(!profile[key].some(item=>item.toLowerCase()===value.toLowerCase()))profile[key].push(value);
        $('#affiliationDetails').open=true;
      }
    }
    readProfile();
    $('#cvSuggestions').textContent='';
    $('#cvStatus').textContent='Selected details added. Choose Find funding to see matches.';
  });
}
$('#scanCV').addEventListener('click',()=>{
  cvReadId++;
  $('#cvFile').value='';
  const text=$('#cvText').value;
  $('#cvText').value='';
  showCVSuggestions(cvSuggestions(text));
});
$('#cvFile').addEventListener('change',async()=>{
  const readId=++cvReadId;
  const file=$('#cvFile').files[0];
  $('#cvFile').value='';
  if(!file)return;
  $('#cvSuggestions').textContent='';
  if(!/\.txt$/i.test(file.name)||file.size>200000){$('#cvStatus').textContent='Choose a .txt file under 200 KB or paste an excerpt.';return;}
  try{const text=await file.text();if(readId===cvReadId)showCVSuggestions(cvSuggestions(text));}
  catch{if(readId===cvReadId)$('#cvStatus').textContent='Could not read this text file. Try pasting a short excerpt.';}
});
function savedText(){return shortlistText(restoreShortlist(records,saved));}
$('#copyShortlist').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(savedText());$('#shortlistStatus').textContent='Shortlist copied with official links.';}catch{$('#shortlistFallback').value=savedText();$('#shortlistFallback').hidden=false;$('#shortlistFallback').select();$('#shortlistStatus').textContent='Copy your shortlist below.';}});
$('#downloadShortlist').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([savedText()],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Fundlark-shortlist.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
init();
