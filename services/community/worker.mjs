// Public facts only; submissions remain private until reviewed. No user-URL fetching.
const CATEGORIES = new Set(['Industry','Government','Foundation','Institution','Society']);
const STAGES = new Set(['undergrad','masters','phd','postdoc','resident','faculty','staff']);
const STATUSES = new Set(['open','rolling','closed','forecast','verify']);
const MAX_BODY = 48 * 1024;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function strictKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new HttpError(400, 'Use only the documented public opportunity fields.');
}
function string(value, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, 'Invalid or missing public field.');
  return value.trim();
}
function strings(value, max = 20) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new HttpError(400, 'Invalid public tag list.');
  return [...new Set(value.map(v => string(v, 160, true)))];
}
function date(value, required = false) {
  const text = string(value, 10, required);
  if (text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0,10) !== text)) throw new HttpError(400, 'Use a valid YYYY-MM-DD date.');
  return text;
}
export function canonicalUrl(value) {
  let url;
  try { url = new URL(string(value, 2048, true)); } catch { throw new HttpError(400, 'Use a public official HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /(^[\d.]+$|:|(^|\.)(localhost|local|internal|test|invalid)$)/i.test(url.hostname)) throw new HttpError(400, 'Use a public official HTTPS URL.');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href.replace(/\/$/, '');
}
export function normalizeOpportunity(input, today = new Date().toISOString().slice(0,10)) {
  strictKeys(input, ['title','funder','category','url','round','deadline','status','amount','description','eligibility','topics','eligible_stages','faculty_sponsor_possible','affiliation_tags','checked_at','source_excerpt']);
  const title = string(input.title, 240, true), funder = string(input.funder, 160, true);
  if (!CATEGORIES.has(input.category) || !STATUSES.has(input.status || 'verify')) throw new HttpError(400, 'Invalid category or status.');
  const checked = date(input.checked_at, true);
  if (checked > today) throw new HttpError(400, 'A source check cannot be in the future.');
  const deadline = date(input.deadline), round = string(input.round, 80, true);
  const stages = strings(input.eligible_stages);
  if (stages.some(stage => !STAGES.has(stage))) throw new HttpError(400, 'Invalid career stage.');
  if (input.faculty_sponsor_possible !== undefined && typeof input.faculty_sponsor_possible !== 'boolean') throw new HttpError(400, 'Faculty sponsor flag must be boolean.');
  strictKeys(input.affiliation_tags || {}, ['societies','institution']);
  return {title, funder, category: input.category, url: canonicalUrl(input.url), round,
    deadline: deadline || null, status: deadline && deadline < today ? 'closed' : input.status || 'verify',
    amount: string(input.amount, 160), description: string(input.description, 1600, true),
    eligibility: string(input.eligibility, 1200, true), topics: strings(input.topics), eligible_stages: stages,
    faculty_sponsor_possible: input.faculty_sponsor_possible === true,
    affiliation_tags: {societies: strings(input.affiliation_tags?.societies), institution: string(input.affiliation_tags?.institution, 160)},
    checked_at: checked, source_excerpt: string(input.source_excerpt, 1200, true)};
}
async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function limitedJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new HttpError(413, 'Contribution batch is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing JSON body.');
  const chunks = []; let length = 0;
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY) { await reader.cancel(); throw new HttpError(413, 'Contribution batch is too large.'); }
    chunks.push(value);
  }
  const body = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}
function enabled(env) { return Boolean(env.DB && env.INGEST_SALT && env.ADMIN_TOKEN); }
async function budget(request, env) {
  const day = new Date().toISOString().slice(0,10);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = await hash(`${env.INGEST_SALT}:${day}:${ip}`);
  const limits = [[`global:${day}`, Number(env.DAILY_REQUEST_LIMIT || 1000)], [bucket, Number(env.PER_VISITOR_DAILY_LIMIT || 30)]];
  // One conditional UPSERT per bucket prevents concurrent requests bypassing limits.
  const results = await env.DB.batch(limits.map(([key, limit]) => env.DB.prepare(
    'INSERT INTO ingestion_limits(bucket,day,count) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count'
  ).bind(key, day, limit)));
  if (results.some(result => !result.results?.length)) throw new HttpError(429, 'Contribution budget reached. Your funding search can continue; try contributing tomorrow.');
  await env.DB.prepare('DELETE FROM ingestion_limits WHERE day < ?').bind(day).run();
}
function authorize(request, env) {
  if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) throw new HttpError(401, 'Administrator credentials required.');
}
async function route(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/config') return {contributions_enabled: enabled(env), schema_version: 1};
  if (!enabled(env)) throw new HttpError(503, 'Community service is not configured. Catalog browsing still works.');
  if (request.method === 'GET' && url.pathname === '/api/catalog') {
    const rows = await env.DB.prepare("SELECT id,payload,reviewed_at FROM contributions WHERE status='approved' ORDER BY reviewed_at,id LIMIT 5000").all();
    return {schema_version: 1, opportunities: rows.results.map(row => {
      const {source_excerpt, checked_at, ...record} = JSON.parse(row.payload);
      return {...record, id: `community:${row.id}`, origin: 'community_reviewed', last_verified_at: checked_at, reviewed_at: row.reviewed_at};
    })};
  }
  if (request.method === 'POST' && url.pathname === '/api/contributions') {
    await budget(request, env);
    const body = await limitedJson(request);
    strictKeys(body, ['sharing_consent','opportunities']);
    if (body.sharing_consent !== true) throw new HttpError(400, 'Public-facts sharing must be authorized.');
    if (!Array.isArray(body.opportunities) || !body.opportunities.length || body.opportunities.length > 10) throw new HttpError(400, 'Send between 1 and 10 public opportunities.');
    const normalized = body.opportunities.map(record => normalizeOpportunity(record));
    const results = [];
    for (const record of normalized) {
      const payload = JSON.stringify(record), key = `${record.url}|${record.round}|${record.title.toLowerCase().replace(/\s+/g, ' ')}`;
      const id = await hash(payload);
      const inserted = await env.DB.prepare("INSERT OR IGNORE INTO contributions(id,opportunity_key,payload,status,submitted_at) VALUES(?,?,?,'pending',?)").bind(id, key, payload, new Date().toISOString()).run();
      results.push({id, state: inserted.meta.changes ? 'queued' : 'already_received'});
    }
    return {results, publication: 'Pending maintainer review; no personal profile was requested.'};
  }
  if (url.pathname.startsWith('/api/admin/')) {
    authorize(request, env);
    if (request.method === 'GET' && url.pathname === '/api/admin/contributions') {
      const rows = await env.DB.prepare("SELECT * FROM contributions WHERE status='pending' ORDER BY submitted_at LIMIT 50").all();
      return {contributions: rows.results.map(row => ({...row, payload: JSON.parse(row.payload)}))};
    }
    const decision = url.pathname.match(/^\/api\/admin\/contributions\/([a-f0-9]{64})$/);
    if (request.method === 'POST' && decision) {
      const body = await limitedJson(request); strictKeys(body, ['decision','official_source_checked']);
      if (!['approved','rejected'].includes(body.decision)) throw new HttpError(400, 'Choose approved or rejected.');
      if (body.decision === 'approved' && body.official_source_checked !== true) throw new HttpError(400, 'Check the official source before publication.');
      const row = await env.DB.prepare("SELECT * FROM contributions WHERE id=? AND status='pending'").bind(decision[1]).first();
      if (!row) throw new HttpError(404, 'Pending contribution not found.');
      const now = new Date().toISOString();
      if (body.decision === 'approved') {
        await env.DB.batch([
          env.DB.prepare("UPDATE contributions SET status='rejected',reviewed_at=? WHERE opportunity_key=? AND status='approved' AND id<>? AND EXISTS(SELECT 1 FROM contributions WHERE id=? AND status='pending')").bind(now,row.opportunity_key,row.id,row.id),
          env.DB.prepare("UPDATE contributions SET status='approved',reviewed_at=? WHERE id=? AND status='pending'").bind(now,row.id),
        ]);
      } else await env.DB.prepare("UPDATE contributions SET status='rejected',reviewed_at=? WHERE id=? AND status='pending'").bind(now,row.id).run();
      return {id: row.id, state: body.decision};
    }
  }
  throw new HttpError(404, 'Endpoint not found.');
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    const allowed = new Set([url.origin, ...(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if (origin && !allowed.has(origin)) return Response.json({error:'Origin is not allowed.'},{status:403,headers});
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
    try {
      const body = await route(request,env,url);
      if (request.method === 'GET' && url.pathname === '/api/catalog') headers['Cache-Control'] = 'public, max-age=60';
      return Response.json(body,{status:request.method === 'POST' && url.pathname === '/api/contributions' ? 202 : 200,headers});
    } catch (error) {
      return Response.json({error:error instanceof HttpError ? error.message : 'Community service unavailable; your search can continue.'},{status:error instanceof HttpError ? error.status : 503,headers});
    }
  }
};
