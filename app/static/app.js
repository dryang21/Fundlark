/* Fundlark v0.1 — no client-side build tools or external AI API needed. */
'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, cls='') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const state = {
  view:'discover', category:'All', onlyOpen:false, sort:'match', query:'',
  results:[], visible:8, sources:[], cvSuggestions:[],
  profile:load('fundlark.profile', load('opengrant.profile', {keywords:['AI agents','biomedical research'], career_stage:'unspecified', example:true})),
  saved:new Set(load('fundlark.saved', load('opengrant.saved', [])))
};
function load(key, fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}}
function save(key, value){try{localStorage.setItem(key,JSON.stringify(value))}catch{notify('Browser storage is unavailable. Your change may not persist.',true)}}
function safeUrl(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
function fmtDate(raw){if(!raw)return 'No fixed deadline';const d=new Date(`${raw}T12:00:00`);return isNaN(d)?'Check deadline':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}
function daysUntil(raw){if(!raw)return null;const d=new Date(`${raw}T12:00:00`);if(isNaN(d))return null;const today=new Date();today.setHours(12,0,0,0);return Math.round((d-today)/86400000)}
function statusLabel(status){return ({open:'Open',closed:'Closed',rolling:'Rolling',forecast:'Forecast',verify:'Verify status'})[status] || 'Verify status'}
function labelCategory(cat){return cat==='Foundation'?'FOUNDATION':cat==='Industry'?'INDUSTRY':'GOVERNMENT'}
function stageName(stage){return ({phd:'PhD student',postdoc:'Postdoctoral researcher',resident:'Research / medical resident',faculty:'Faculty / PI',staff:'Research staff',unspecified:'Not specified'})[stage]||'Not specified'}
function notify(message,error=false){const node=$('#toast');node.textContent=message;node.className=`toast show ${error?'error':''}`;clearTimeout(notify.timer);notify.timer=setTimeout(()=>{node.className='toast'},4500)}
async function api(path,options={}){
  const response=await fetch(path, options);
  let body;try{body=await response.json()}catch{body={detail:`HTTP ${response.status}`}}
  if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:`Request failed: ${response.status}`);
  return body;
}
function setBusy(button,yes,label){if(!button)return;if(yes){button.dataset.old=button.innerHTML;button.disabled=true;button.textContent=label||'Working...'}else{button.disabled=false;button.innerHTML=button.dataset.old||button.innerHTML}}
function setView(view){
  if(!['discover','saved','sources','profile'].includes(view))return;
  state.view=view;
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  $('#breadcrumbCurrent').textContent=({discover:'Discover',saved:'Saved opportunities',sources:'Source monitor',profile:'My research profile'})[view];
  $('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'instant'});
  if(view==='saved')renderSaved();if(view==='sources')loadSources();if(view==='profile')renderProfileForm();
}
function updateMiniProfile(){
  const words=state.profile.keywords||[];
  $('#miniChips').innerHTML=words.length ? words.slice(0,7).map(w=>`<span class="profile-chip">${esc(w)}</span>`).join('') : '<span class="profile-chip">Add your interests</span>';
  $('#miniStage').textContent=`Career stage: ${stageName(state.profile.career_stage)}${state.profile.example?' · example keywords':''}`;
  $('#savedCount').textContent=state.saved.size;
}
async function refreshOverview(){
  try{const data=await api('/api/overview');
    $('#statTotal').textContent=data.total;
    $('#statIndustry').textContent=data.industry;
    $('#statSoon').textContent=data.closing_soon;
    $('#statSources').textContent=data.source_count;
    $('#dataDisclaimer').textContent=`${data.live_api_results} imported API records · snapshots require source verification`;
  }catch(e){notify(`Could not load metrics: ${e.message}`,true)}
}
async function fetchMatches(){
  try{
    state.results=await api('/api/match',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({keywords:state.profile.keywords||[],career_stage:state.profile.career_stage||'unspecified',query:state.query})});
    renderResults();if(state.view==='saved')renderSaved();
  }catch(e){$('#resultsList').innerHTML=`<div class="empty-state">Could not load opportunities: ${esc(e.message)}</div>`;notify(e.message,true)}
}
function filtered(items){
  let list=items.filter(o=>state.category==='All'||o.category===state.category);
  if(state.onlyOpen)list=list.filter(o=>['open','rolling'].includes(o.status));
  if(state.query.trim()){
    const q=state.query.toLowerCase().trim(), toks=q.split(/[,;\s]+/).filter(s=>s.length>2);
    list=list.filter(o=>{const text=[o.title,o.funder,o.description,...o.topics].join(' ').toLowerCase();return text.includes(q)||toks.some(t=>text.includes(t))});
  }
  if(state.sort==='deadline')list.sort((a,b)=>((a.deadline||'9999')>(b.deadline||'9999')?1:-1));
  else if(state.sort==='new')list.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  else list.sort((a,b)=>(b.match_score||0)-(a.match_score||0));
  return list;
}
function renderResults(){
  const items=filtered([...state.results]);const container=$('#resultsList');
  $('#resultsCount').textContent=`Showing ${Math.min(items.length,state.visible)} of ${items.length} opportunities`;
  container.innerHTML=items.length?items.slice(0,state.visible).map(renderCard).join(''):`<div class="empty-state"><strong>No opportunities found</strong>Try broader keywords, another source category, or disable the open-only filter.</div>`;
  $('#showMoreBtn').hidden=items.length<=state.visible;
}
function eligibilityText(value){return ({possible:'Career stage looks compatible',sponsor:'Faculty PI may be required',unlikely:'Review career-stage restrictions',check:'Check applicant eligibility'})[value]||'Check eligibility'}
function renderCard(o){
  const saved=state.saved.has(o.id);
  const upcoming=daysUntil(o.deadline);
  const isClosed=o.status==='closed';
  const statusClass=o.status==='open'?'green':o.status==='rolling'?'green':o.status==='closed'?'gray':'amber';
  const score=o.match_score;
  const scoreText=score==null?'—':`${score}%`;
  const scoreDesc=score==null?'Add interests to see matches':'Keyword relevance · indicative';
  const eligibility=o.eligibility_assessment;
  let due=o.deadline?fmtDate(o.deadline):'No fixed deadline';
  if(o.deadline && upcoming!==null && upcoming>=0 && upcoming<=14)due=`${due} · ${upcoming}d left`;
  const origin=o.origin==='curated'?'Curated snapshot':'Federal API import';
  const fidelity=o.review_needed?'Page changed — review needed':o.stale?'Record may be stale':origin;
  const matchTags=(o.matched_keywords||[]).map(term=>`<span class="match-tag">${esc(term)}</span>`).join('');
  const escapedId=esc(o.id);
  return `<article class="opportunity-card" data-id="${escapedId}">
    <div class="opp-topline"><div class="opp-funder"><span class="funder-avatar ${o.category==='Industry'?'industry':o.category==='Foundation'?'foundation':''}">${esc((o.funder||'F').slice(0,1))}</span>${esc(o.funder)}</div>
    <div class="opp-top-right"><span class="opp-type">${esc(labelCategory(o.category))}</span><button class="opp-save ${saved?'active':''}" data-action="save" data-id="${escapedId}" title="${saved?'Remove saved opportunity':'Save opportunity'}" aria-label="${saved?'Unsave':'Save'} ${esc(o.title)}">${icon('bookmark')}</button></div></div>
    <h3 class="opp-title">${esc(o.title)}</h3><p class="opp-desc">${esc(o.description)}</p>
    <div class="opp-meta"><span class="meta-tag ${statusClass}">${o.status==='open'?'● ':''}${esc(statusLabel(o.status))}</span><span class="meta-tag">${icon('clock')} ${esc(due)}</span><span class="meta-tag ${eligibility==='possible'?'green':eligibility==='sponsor'?'amber':''}">${esc(eligibilityText(eligibility))}</span></div>
    ${matchTags?`<div class="opp-matches">${matchTags}</div>`:''}
    <div class="opp-bottom"><div class="opp-bottom-left"><div class="match-circle ${score==null?'no-match':''}">${esc(scoreText)}</div><div class="match-label"><strong>${score==null?'Research match':'Research match'}</strong><span>${esc(scoreDesc)}</span></div></div><div class="card-actions"><button class="card-detail-btn" data-action="details" data-id="${escapedId}">Details</button><a class="source-link" href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">Official source ${icon('external')}</a></div></div>
    <div class="opp-details" hidden><div class="detail-grid"><div><h4>About the opportunity</h4><p>${esc(o.description)}</p><h4>Type of support</h4><p>${esc(o.amount||o.funding_type||'See official source')}</p></div><div><h4>Eligibility · preliminary</h4><p>${esc(o.eligibility_reason||'Review official criteria')} ${esc(o.eligibility||'')}</p><h4>Topics</h4><p>${esc((o.topics||[]).join(' · '))}</p></div></div><div class="detail-foot">${esc(fidelity)} · Last verified: ${esc(o.last_verified_at?o.last_verified_at.slice(0,10):'unknown')} · Always confirm on the funder's website before applying.</div></div>
  </article>`;
}
function renderSaved(){
  const items=state.results.filter(o=>state.saved.has(o.id));
  $('#savedList').innerHTML=items.length?items.map(renderCard).join(''):'<div class="empty-state"><strong>Your shortlist is empty.</strong>Save promising opportunities in Discover using the bookmark icon.</div>';
}
function toggleSaved(id){
  if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);
  save('fundlark.saved',[...state.saved]);updateMiniProfile();renderResults();renderSaved();
  notify(state.saved.has(id)?'Opportunity saved to this browser.':'Opportunity removed from saved items.');
}
function handleCardsClick(e){
  const target=e.target.closest('[data-action]');if(!target)return;
  const id=target.dataset.id,action=target.dataset.action;
  if(action==='save'){toggleSaved(id);return}
  if(action==='details'){
    const card=target.closest('.opportunity-card'),details=$('.opp-details',card),expanded=details.hidden;
    details.hidden=!expanded;card.classList.toggle('expanded',expanded);target.textContent=expanded?'Less detail':'Details';
  }
}
function renderProfileForm(){
  $('#careerStage').value=state.profile.career_stage||'unspecified';
  $('#keywordsInput').value=(state.profile.keywords||[]).join(', ');
}
function handleProfileSave(e){
  e.preventDefault();
  let keywords=$('#keywordsInput').value.split(/[,\n;]+/).map(s=>s.trim()).filter(Boolean);
  keywords=[...new Set(keywords.map(k=>k.toLowerCase()))].slice(0,25);
  state.profile={career_stage:$('#careerStage').value,keywords,example:false};
  save('fundlark.profile',state.profile);updateMiniProfile();fetchMatches();notify('Research profile saved in this browser.');setView('discover');
}
async function extractCV(file){
  if(!file)return;if(file.size>8*1024*1024){notify('CV must be under 8 MB.',true);return}
  $('#cvFeedback').textContent=`Reading ${file.name}...`;
  const form=new FormData();form.append('file',file);
  try{
    const data=await api('/api/profile/extract',{method:'POST',body:form});
    state.cvSuggestions=data.keywords||[];
    $('#cvFeedback').textContent=`Parsed ${data.characters_processed.toLocaleString()} characters. Review the suggestions below.`;
    $('#suggestionsContainer').hidden=false;
    $('#suggestionChips').innerHTML=state.cvSuggestions.map(w=>`<span>${esc(w)}</span>`).join('')||'<em>No distinctive keywords found; enter interests manually.</em>';
  }catch(e){$('#cvFeedback').textContent=e.message;notify(e.message,true)}
}
function applyCVSuggestions(){
  const original=$('#keywordsInput').value.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
  const combined=[...new Set([...original,...state.cvSuggestions])].slice(0,25);
  $('#keywordsInput').value=combined.join(', ');
  notify('Suggested terms added. Review and click Save profile.');
}
async function loadSources(){
  $('#sourcesList').innerHTML='<div class="loading-card">Loading sources...</div>';
  try{
    state.sources=await api('/api/sources');
    $('#sourceTotal').textContent=`${state.sources.length} official sources`;
    $('#sourcesList').innerHTML=state.sources.map(sourceRow).join('');
    await loadCandidates();
    const history=await api('/api/sync/history');
    $('#syncHistory').innerHTML=history.length?`<strong>Last API sync:</strong> ${esc(new Date(history[0].finished_at).toLocaleString())} · ${esc(history[0].source)} · ${history[0].imported} opportunities imported${JSON.parse(history[0].errors||'[]').length?' · Some queries failed':''}`:'No API synchronization has run yet. The starter catalog is a curated snapshot.';
  }catch(e){$('#sourcesList').innerHTML=`<div class="empty-state">${esc(e.message)}</div>`}
}
function sourceRow(o){
  const checked=o.check?.checked_at ? new Date(o.check.checked_at).toLocaleDateString() : 'Not checked yet';
  const status=o.mode==='api'?'API available':o.mode==='optional_api'?'API · key required':o.check?.status==='changed'?'Content changed':o.check?.status==='ok'?'Page checked':o.check?.status==='error'?'Check failed':o.check?.status==='skipped'?'Skipped (robots)':'Not checked';
  const group=o.category==='Industry'?'industry':o.category==='Foundation'?'foundation':'';
  return `<div class="source-item" data-source-id="${esc(o.id)}"><div class="source-row"><span class="source-row-icon ${group}">${esc(o.name.slice(0,2).toUpperCase())}</span><div class="source-row-info"><strong>${esc(o.name)}</strong>${o.check?.review_needed?'<span class="review-badge">Review pending</span>':''}<p>${esc(o.description)}</p>${o.check?`<p>${esc(o.check.message)}</p>`:''}</div><div class="source-row-stats"><strong>${esc(status)}</strong><span>${esc(checked)}</span></div>${o.mode==='watch'?'<button class="card-detail-btn" data-source-action="changes" aria-expanded="false">Review changes</button>':''}<a href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer" title="Open official site" aria-label="Visit ${esc(o.name)}">${icon('external')}</a></div><div class="source-review" hidden></div></div>`;
}
async function loadCandidates(){
  const candidates=await api(`/api/candidates?status=${encodeURIComponent($('#candidateFilter').value)}`);
  $('#candidateList').innerHTML=candidates.length?candidates.map(c=>`<div class="candidate-row"><span class="candidate-bullet">✧</span><div><strong>${esc(c.title)}</strong><small>${esc(c.source_id)} · First observed ${esc(c.first_seen.slice(0,10))}</small></div><a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">Official page ${icon('external')}</a><select data-candidate-id="${esc(c.id)}" aria-label="Review status for ${esc(c.title)}">${['unreviewed','shortlisted','dismissed'].map(s=>`<option value="${s}" ${c.status===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select></div>`).join(''):'<div class="candidate-empty">No links with this review status. Check monitored pages to collect possible funding links.</div>';
}
async function handleSourceReview(e){
  const button=e.target.closest('[data-source-action]');if(!button)return;
  const row=button.closest('.source-item'),sourceId=row.dataset.sourceId,panel=$('.source-review',row);
  if(button.dataset.sourceAction==='changes'){
    if(!panel.hidden){panel.hidden=true;button.setAttribute('aria-expanded','false');return}
    setBusy(button,true,'Loading...');
    try{
      const data=await api(`/api/sources/${encodeURIComponent(sourceId)}/changes`),latest=data.snapshots[0];
      panel.dataset.contentHash=latest?.content_hash||'';
      panel.innerHTML=latest?`<p>Latest snapshot: ${esc(new Date(latest.observed_at).toLocaleString())}. Reviewing a page does not verify grant deadlines, eligibility, or availability.</p><pre class="source-diff">${esc(data.diff||'Only a baseline snapshot is available; no content changes to compare.')}</pre>${data.truncated?'<p>Diff shortened for display.</p>':''}${data.reviews[0]?`<p>Last review: ${esc(data.reviews[0].note)}</p>`:''}<label>Review note<textarea class="review-note" rows="2" maxlength="1000" placeholder="What did you check on the official page?"></textarea></label><button class="outline-btn" data-source-action="acknowledge">Record page review</button>`:'<p>No readable snapshot is available yet. Check the monitored page first.</p>';
      panel.hidden=false;button.setAttribute('aria-expanded','true');
    }catch(err){notify(err.message,true)}finally{setBusy(button,false)}
  }else{
    const note=$('.review-note',panel).value.trim();
    if(note.length<3){notify('Add a review note before recording your review.',true);return}
    setBusy(button,true,'Saving...');
    try{
      await api(`/api/sources/${encodeURIComponent(sourceId)}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content_hash:panel.dataset.contentHash,note})});
      await loadSources();notify('Page review recorded. Funding claims still require verification.');
    }catch(err){notify(err.message,true)}finally{setBusy(button,false)}
  }
}
async function runFederalSync(){
  const btn=$('#federalSyncBtn'),words=$('#syncKeywords').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,5);
  if(!words.length){notify('Enter at least one federal grant search term.',true);return}
  setBusy(btn,true,'Querying API...');
  try{
    const result=await api('/api/sync/federal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:words})});
    if(result.errors?.length)notify(`${result.imported} records imported. ${result.errors.length} query error(s); see terminal or try again.`,true);
    else notify(`Imported ${result.imported} federal opportunities from ${result.source}.`);
    await Promise.all([loadSources(),refreshOverview(),fetchMatches()]);
  }catch(e){notify(`Federal sync failed: ${e.message}`,true)}finally{setBusy(btn,false)}
}
async function runSourceMonitor(){
  const btn=$('#monitorBtn');setBusy(btn,true,'Checking sites...');
  try{
    const result=await api('/api/sync/monitor',{method:'POST'});
    notify(`${result.checked} sources: ${result.changed} changed, ${result.failed} failed, ${result.skipped} skipped. Review source details.`,Boolean(result.failed||result.skipped));
    await Promise.all([loadSources(),fetchMatches()]);
  }catch(e){notify(`Monitoring failed: ${e.message}`,true)}finally{setBusy(btn,false)}
}
function bind(){
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#topProfileBtn').addEventListener('click',()=>setView('profile'));
  $('#editMiniProfile').addEventListener('click',()=>setView('profile'));
  $('#sourceMiniBtn').addEventListener('click',()=>setView('sources'));
  $('#searchForm').addEventListener('submit',e=>{e.preventDefault();state.query=$('#searchInput').value.trim();state.visible=8;fetchMatches()});
  $('#searchInput').addEventListener('search',()=>{state.query=$('#searchInput').value.trim();state.visible=8;fetchMatches()});
  $('#categoryTabs').addEventListener('click',e=>{
    const btn=e.target.closest('[data-category]');if(!btn)return;
    state.category=btn.dataset.category;$$('.filter-tab').forEach(el=>el.classList.toggle('selected',el===btn));state.visible=8;renderResults();
  });
  $('#openOnly').addEventListener('change',e=>{state.onlyOpen=e.target.checked;state.visible=8;renderResults()});
  $('#sortSelect').addEventListener('change',e=>{state.sort=e.target.value;renderResults()});
  $('#showMoreBtn').addEventListener('click',()=>{state.visible+=8;renderResults()});
  $('#resultsList').addEventListener('click',handleCardsClick);
  $('#savedList').addEventListener('click',handleCardsClick);
  $('#profileForm').addEventListener('submit',handleProfileSave);
  $('#cvInput').addEventListener('change',e=>extractCV(e.target.files[0]));
  $('#useKeywordsBtn').addEventListener('click',applyCVSuggestions);
  const drop=$('#dropzone');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');extractCV(e.dataTransfer.files[0])});
  $('#federalSyncBtn').addEventListener('click',runFederalSync);
  $('#monitorBtn').addEventListener('click',runSourceMonitor);
  $('#sourcesList').addEventListener('click',handleSourceReview);
  $('#candidateFilter').addEventListener('change',()=>loadCandidates().catch(e=>notify(e.message,true)));
  $('#candidateList').addEventListener('change',async e=>{
    const select=e.target.closest('[data-candidate-id]');if(!select)return;
    select.disabled=true;
    try{
      await api(`/api/candidates/${encodeURIComponent(select.dataset.candidateId)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});
      await loadCandidates();notify('Link review saved. No opportunity was published.');
    }catch(err){notify(err.message,true);await loadCandidates().catch(()=>{})}finally{select.disabled=false}
  });
  $('#exportBtn').addEventListener('click',()=>{location.href='/api/export.csv'});
}
function init(){bind();updateMiniProfile();renderProfileForm();refreshOverview();fetchMatches()}
document.addEventListener('DOMContentLoaded',init);
