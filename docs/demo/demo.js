import {SOCIETIES, INSTITUTIONS, list, normalizeProfile, match, mergeCatalog, assistantPrompt} from './matching.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = raw => {try{const url=new URL(raw);return url.protocol==='https:'?url.href:'#'}catch{return '#'}};
const labels = {open:'Listed open',rolling:'Listed rolling',closed:'Closed',forecast:'Forecast',verify:'Verify status'};
const PROFILE_KEY = 'fundlark.public.profile.v1';
let records=[],visible=8,profile=normalizeProfile(),storageAvailable=true,apiBase='',communityEnabled=false;
try { profile=normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')); } catch { storageAvailable=false; }
function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function currentStatus(record){return record.deadline && record.deadline<localDay()?'closed':record.status}
function isStale(record){const stamp=Date.parse(record.last_verified_at||'');return !Number.isFinite(stamp)||(Date.now()-stamp)>30*86400000}
function saveProfile(){
  try { localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));storageAvailable=true; } catch { storageAvailable=false; }
  $('#profileStatus').textContent=storageAvailable?'Saved on this browser only.':'Using this profile for this visit; browser storage is unavailable.';
}
function readProfile(){
  profile=normalizeProfile({...profile,topics:list($('#topics').value),stage:$('#stage').value,sharePublic:$('#sharePublic').checked});
  // Include a typed affiliation even when the user presses Find without pressing Add.
  for(const [key,input,choices] of [['societies','societyInput',SOCIETIES],['institutions','institutionInput',INSTITUTIONS]]){
    const value=$(`#${input}`).value.trim();
    if(value){const name=choices.find(n=>n.toLowerCase()===value.toLowerCase())||value;if(!profile[key].some(n=>n.toLowerCase()===name.toLowerCase()))profile[key].push(name);$(`#${input}`).value='';}
  }
  profile=normalizeProfile(profile);renderChips();saveProfile();
}
function renderChips(){
  for(const [key,target] of [['societies','societyChips'],['institutions','institutionChips']]){
    $(`#${target}`).innerHTML=profile[key].map((name,index)=>`<button type="button" class="chip" data-kind="${key}" data-index="${index}" aria-label="Remove ${esc(name)}">${esc(name)} <span aria-hidden="true">×</span></button>`).join('');
  }
}
function render(){
  const terms=$('#query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),category=$('#category').value,onlyOpen=$('#openOnly').checked,matchedOnly=$('#matchedOnly').checked;
  const hasProfile=profile.topics.length||profile.societies.length||profile.institutions.length;
  const filtered=records.map(o=>({...o,matching:match(o,profile)})).filter(o=>(category==='all'||o.category===category)&&(!onlyOpen||['open','rolling'].includes(currentStatus(o)))&&(!matchedOnly||o.matching.score>0)&&terms.every(term=>[o.title,o.funder,o.description,...(o.topics||[])].join(' ').toLowerCase().includes(term))).sort((a,b)=>b.matching.score-a.matching.score);
  $('#resultCount').textContent=`${filtered.length} ${filtered.length===1?'record':'records'}${hasProfile?' · sorted by research and affiliations':''}`;
  $('#results').innerHTML=filtered.length?filtered.slice(0,visible).map(o=>{
    const status=currentStatus(o),caution=o.review_needed?'Source changed — review needed':isStale(o)?'Dated record — recheck source':o.origin==='community_reviewed'?'Community contribution · reviewed':o.origin==='curated'?'Curated snapshot':'Official API search import';
    const reasons=[...o.matching.hits.map(t=>`Topic: ${t}`),...o.matching.affiliations.map(t=>`Affiliation: ${t}`)];
    return `<article class="card"><div class="card-top"><span>${esc(o.funder)}</span><span class="category">${esc(o.category)}</span></div><h3>${esc(o.title)}</h3><p class="description">${esc(o.description)}</p>${reasons.length?`<p class="match-reasons">${esc(reasons.join(' · '))}</p>`:''}<div class="meta"><span class="badge ${status==='closed'?'closed':status==='verify'||status==='forecast'?'caution':''}">${esc(labels[status]||labels.verify)}</span><span class="badge">${esc(o.deadline||'No confirmed fixed deadline')}</span><span class="badge caution">${esc(caution)}</span></div><details><summary>Eligibility & source dates</summary><p>${esc(o.eligibility||'Confirm the official applicant rules.')}</p><p>${esc(o.matching.stage)}. A topic or affiliation match does not establish eligibility.</p><p>Record verification date: ${esc(o.last_verified_at?.slice(0,10)||'Unknown')}.</p></details><a class="source-link" href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">Check official announcement ↗</a></article>`;
  }).join(''):'<div class="empty">No indexed records match these filters. This does not mean no funding exists. Broaden your filters or continue with your assistant to search official sources beyond this catalog.</div>';
  $('#showMore').hidden=filtered.length<=visible;
}
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('Unavailable');return response.json()}
async function initCommunity(){
  try{
    const configured=window.FUNDLARK_CONFIG?.apiBase;
    const url=new URL(configured||location.origin);
    if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Use HTTPS');
    apiBase=url.origin;
    const config=await json(`${apiBase}/api/config`);
    if(config.contributions_enabled!==true)throw new Error('Not configured');
    communityEnabled=true;$('#sharePublic').disabled=false;
    const data=await json(`${apiBase}/api/catalog`);
    if(data.schema_version!==1||!Array.isArray(data.opportunities))throw new Error('Invalid community data');
    records=mergeCatalog(records,data.opportunities);render();
    $('#communityStatus').textContent='Connected. With sharing enabled, your assistant can contribute public discoveries automatically for review.';
  }catch{
    $('#communityStatus').textContent=communityEnabled?'Contribution service connected; reviewed additions could not be loaded. The published catalog is still available.':'Community sharing is not connected on this host. You can still match funding and search with your assistant.';
  }
}
async function init(){
  try{const data=await json('data.json');if(data.schema_version!==1||!Array.isArray(data.opportunities))throw new Error('Unsupported public snapshot');records=data.opportunities;$('#snapshotStatus').textContent=`${records.length} published records · Snapshot exported ${new Date(data.generated_at).toLocaleDateString()} · Individual source dates vary`;render()}
  catch{$('#snapshotStatus').textContent='The public snapshot could not be loaded.';$('#results').textContent='Use your assistant to search official sources, or try reloading.';$('#resultCount').textContent='Snapshot unavailable'}
  await initCommunity();
}
$('#topics').value=profile.topics.join('; ');$('#stage').value=profile.stage;$('#sharePublic').checked=profile.sharePublic;renderChips();
$('#societyOptions').innerHTML=SOCIETIES.map(name=>`<option value="${esc(name)}">`).join('');
$('#institutionOptions').innerHTML=INSTITUTIONS.map(name=>`<option value="${esc(name)}">`).join('');
for(const [button,input] of [['addSociety','societyInput'],['addInstitution','institutionInput']]){
  $(`#${button}`).addEventListener('click',readProfile);
  $(`#${input}`).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();readProfile();}});
}
$('#profileForm').addEventListener('click',event=>{const button=event.target.closest('button[data-kind]');if(button){profile[button.dataset.kind].splice(Number(button.dataset.index),1);renderChips();saveProfile();render();}});
$('#profileForm').addEventListener('submit',event=>{event.preventDefault();readProfile();visible=8;$('#matchedOnly').checked=Boolean(profile.topics.length||profile.societies.length||profile.institutions.length);render();$('#opportunities').scrollIntoView({behavior:'smooth'});});
$('#clearProfile').addEventListener('click',()=>{profile=normalizeProfile();$('#topics').value='';$('#stage').value='';$('#societyInput').value='';$('#institutionInput').value='';$('#sharePublic').checked=false;$('#matchedOnly').checked=false;$('#briefFallback').value='';$('#briefFallback').hidden=true;$('#copyStatus').textContent='';try{localStorage.removeItem(PROFILE_KEY)}catch{}renderChips();render();$('#profileStatus').textContent='Profile cleared from this page and browser storage.';});
$('#sharePublic').addEventListener('change',()=>{readProfile();$('#copyStatus').textContent='Copy a new brief to apply this preference to your next assistant search.';});
$('#searchForm').addEventListener('submit',event=>{event.preventDefault();visible=8;render()});
for(const id of ['query','category','openOnly','matchedOnly'])$(`#${id}`).addEventListener(id==='query'?'input':'change',()=>{visible=8;render()});
$('#showMore').addEventListener('click',()=>{visible+=8;render()});
$('#copyPrompt').addEventListener('click',async()=>{
  readProfile();const prompt=assistantPrompt(profile,communityEnabled?apiBase:'');
  $('#briefFallback').hidden=false;$('#briefFallback').value=prompt;
  try{await navigator.clipboard.writeText(prompt);$('#copyStatus').textContent=' Copied. Paste into your assistant with the Fundlark skill installed. You can review the brief below.';}
  catch{$('#briefFallback').hidden=false;$('#briefFallback').value=prompt;$('#briefFallback').select();$('#copyStatus').textContent=' Select and copy your brief below.';}
});
init();
