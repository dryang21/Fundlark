'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = raw => {try{const url=new URL(raw);return url.protocol==='https:'?url.href:'#'}catch{return '#'}};
const labels = {open:'Listed open',rolling:'Listed rolling',closed:'Closed',forecast:'Forecast',verify:'Verify status'};
let records=[],visible=8;
function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function currentStatus(record){return record.deadline && record.deadline<localDay()?'closed':record.status}
function isStale(record){const stamp=Date.parse(record.last_verified_at||'');return !Number.isFinite(stamp)||(Date.now()-stamp)>30*86400000}
function render(){
  const query=$('#query').value.trim().toLowerCase(),terms=query.split(/\s+/).filter(Boolean),category=$('#category').value,onlyOpen=$('#openOnly').checked;
  const filtered=records.filter(o=>(category==='all'||o.category===category)&&(!onlyOpen||['open','rolling'].includes(currentStatus(o)))&&terms.every(term=>[o.title,o.funder,o.description,...(o.topics||[])].join(' ').toLowerCase().includes(term)));
  $('#resultCount').textContent=`${filtered.length} ${filtered.length===1?'record':'records'}`;
  $('#results').innerHTML=filtered.length?filtered.slice(0,visible).map(o=>{
    const status=currentStatus(o),caution=o.review_needed?'Source changed — review needed':isStale(o)?'Dated record — recheck source':o.origin==='curated'?'Curated snapshot':'Official API search import';
    return `<article class="card"><div class="card-top"><span>${esc(o.funder)}</span><span class="category">${esc(o.category)}</span></div><h3>${esc(o.title)}</h3><p class="description">${esc(o.description)}</p><div class="meta"><span class="badge ${status==='closed'?'closed':status==='verify'||status==='forecast'?'caution':''}">${esc(labels[status]||labels.verify)}</span><span class="badge">${esc(o.deadline||'No confirmed fixed deadline')}</span><span class="badge caution">${esc(caution)}</span></div><details><summary>Eligibility & source dates</summary><p>${esc(o.eligibility||'Confirm the official applicant rules.')}</p><p>Record verification date: ${esc(o.last_verified_at?.slice(0,10)||'Unknown')}. A topic match does not establish eligibility.</p></details><a class="source-link" href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">Check official announcement ↗</a></article>`;
  }).join(''):'<div class="empty">No records match this search. Try broader terms or use the skill for a live search beyond this snapshot.</div>';
  $('#showMore').hidden=filtered.length<=visible;
}
async function init(){
  try{const response=await fetch('data.json');if(!response.ok)throw new Error('Public snapshot unavailable');const data=await response.json();if(data.schema_version!==1||!Array.isArray(data.opportunities))throw new Error('Unsupported public snapshot');records=data.opportunities;$('#snapshotStatus').textContent=`${records.length} records · Snapshot exported ${new Date(data.generated_at).toLocaleDateString()} · Individual source dates vary`;render()}
  catch(error){$('#snapshotStatus').textContent='The public snapshot could not be loaded.';$('#results').textContent='You can still download the skill and search official sources with your own assistant.';$('#resultCount').textContent='Snapshot unavailable'}
}
$('#searchForm').addEventListener('submit',event=>{event.preventDefault();visible=8;render()});
$('#query').addEventListener('input',()=>{visible=8;render()});
$('#category').addEventListener('change',()=>{visible=8;render()});
$('#openOnly').addEventListener('change',()=>{visible=8;render()});
$('#showMore').addEventListener('click',()=>{visible+=8;render()});
$('#copyPrompt').addEventListener('click',async()=>{const prompt='Use Fundlark to find funding relevant to the project we have been discussing. Tell me which options I could apply for and which need a faculty collaborator.';try{await navigator.clipboard.writeText(prompt);$('#copyStatus').textContent=' Copied'}catch{$('#copyStatus').textContent=' Select and copy the example prompt above.'}});
init();
