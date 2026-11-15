import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {normalizeOpportunity,canonicalUrl} from '../services/community/worker.mjs';

const opportunity={title:'Ecology seed award',funder:'Example Science Society',category:'Society',url:'https://example.org/awards?utm_source=test',round:'2027',status:'verify',deadline:'2027-03-01',description:'Public support for ecological research.',eligibility:'Graduate researchers; check membership rules.',topics:['ecology'],eligible_stages:['phd'],affiliation_tags:{societies:['Example Science Society']},checked_at:'2026-11-08',source_excerpt:'The seed award supports graduate researchers in ecology.'};
test('public schema rejects personal fields, private URLs and impossible dates',()=>{
  assert.throws(()=>normalizeOpportunity({...opportunity,cv:'PRIVATE'}),/public opportunity fields/);
  for(const url of ['http://example.org','https://127.0.0.1/admin','https://[::1]/','https://user:password@example.org','https://host.local/a'])assert.throws(()=>canonicalUrl(url));
  assert.throws(()=>normalizeOpportunity({...opportunity,deadline:'2027-02-30'}),/valid YYYY/);
  assert.throws(()=>normalizeOpportunity({...opportunity,checked_at:'2099-01-01'}),/future/);
  assert.equal(normalizeOpportunity(opportunity).url,'https://example.org/awards');
});

let server,origin,logs='',directory;
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const environment={...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'};
before(async()=>{
  directory=mkdtempSync(join(tmpdir(),'fundlark-worker-'));
  const config=resolve('services/community/wrangler.jsonc');
  const setup=spawnSync(process.execPath,[wrangler,'d1','execute','DB','--local','--config',config,'--persist-to',directory,'--file',resolve('services/community/schema.sql')],{env:environment,encoding:'utf8',timeout:30000});
  assert.equal(setup.status,0,setup.stderr+setup.stdout);
  const port=await new Promise(resolvePort=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolvePort(port));});});
  origin=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,[wrangler,'dev','--config',config,'--persist-to',directory,'--ip','127.0.0.1','--port',String(port),'--var','INGEST_SALT:local-test-salt','--var','ADMIN_TOKEN:local-test-admin','--var','PER_VISITOR_DAILY_LIMIT:30'],{env:environment,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{logs+=data;});server.stderr.on('data',data=>{logs+=data;});
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){try{const response=await fetch(origin+'/api/config');if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  throw new Error('Worker did not start: '+logs);
});
after(async()=>{
  if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);}
  if(directory)rmSync(directory,{recursive:true,force:true});
});
async function api(path,body,admin=false,headers={}){
  const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer local-test-admin'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json()};
}
const submit=(record=opportunity)=>api('/api/contributions',{sharing_consent:true,opportunities:[record]});
test('real Worker/D1 contribution, review, reuse, privacy and limits',async()=>{
  assert.equal((await api('/api/config')).body.contributions_enabled,true);
  const homepage=await fetch(origin+'/');assert.equal(homepage.status,200);assert.match(await homepage.text(),/id="heroSearchForm"/);
  assert.equal((await api('/api/admin/contributions')).status,401);
  assert.equal((await api('/api/contributions',{sharing_consent:false,opportunities:[opportunity]})).status,400);
  assert.equal((await api('/api/contributions',{sharing_consent:true,opportunities:[opportunity],profile:'PRIVATE'})).status,400);
  const inserted=await submit();assert.equal(inserted.status,202);assert.equal(inserted.body.results[0].state,'queued');
  const id=inserted.body.results[0].id;
  assert.equal((await submit()).body.results[0].state,'already_received');
  assert.equal((await api('/api/catalog')).body.opportunities.length,0,'pending records must stay private');
  const pending=await api('/api/admin/contributions',null,true);assert.equal(pending.body.contributions.length,1);assert.equal(pending.body.contributions[0].payload.title,opportunity.title);
  assert.equal((await api('/api/admin/contributions/'+id,{decision:'approved'},true)).status,400);
  assert.equal((await api('/api/admin/contributions/'+id,{decision:'approved',official_source_checked:true},true)).status,200);
  let catalog=(await api('/api/catalog')).body.opportunities;
  assert.equal(catalog.length,1);assert.equal(catalog[0].origin,'community_reviewed');assert.equal(catalog[0].source_excerpt,undefined);assert.equal(catalog[0].url,'https://example.org/awards');
  const revised=await submit({...opportunity,description:'Updated public program rules.'});
  await api('/api/admin/contributions/'+revised.body.results[0].id,{decision:'approved',official_source_checked:true},true);
  catalog=(await api('/api/catalog')).body.opportunities;assert.equal(catalog.length,1);assert.equal(catalog[0].description,'Updated public program rules.');
  const rejected=await submit({...opportunity,round:'2028',deadline:'2028-03-01'});
  await api('/api/admin/contributions/'+rejected.body.results[0].id,{decision:'rejected'},true);
  assert.equal((await api('/api/catalog')).body.opportunities.length,1);
  assert.equal((await api('/api/config',null,false,{Origin:'https://evil.example'})).status,403);
  assert.equal((await api('/api/contributions',{sharing_consent:true,opportunities:Array(11).fill(opportunity)})).status,400);
  const oversized=await fetch(origin+'/api/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:'x'.repeat(50000)})});assert.equal(oversized.status,413);
  const last=await Promise.all(Array.from({length:32},()=>submit()));
  assert.ok(last.some(result=>result.status===429),'atomic quota must stop concurrent submissions');
  assert.equal((await api('/api/catalog')).status,200,'contribution budget does not block browsing');
});
