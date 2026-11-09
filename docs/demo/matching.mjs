// Browser-only matching. These scores explain overlap, never applicant eligibility.
export const SOCIETIES = ['IEEE', 'AAPM', 'ASTRO', 'Sigma Xi', 'ACM', 'ASCO', 'RSNA', 'American Chemical Society', 'American Physical Society', 'American Geophysical Union', 'American Economic Association', 'Modern Language Association'];
export const INSTITUTIONS = ['Stanford University', 'Harvard University', 'Massachusetts Institute of Technology', 'University of California, San Francisco', 'University of Toronto'];
const synonyms = {
  'ai': ['artificial intelligence'],
  'ai agents': ['agentic ai', 'autonomous agents'],
  'machine learning': ['deep learning', 'artificial intelligence'],
  'medical physics': ['radiotherapy', 'radiation therapy', 'medical imaging'],
  'radiotherapy': ['radiation therapy', 'oncology'],
  'large language models': ['generative ai', 'foundation models', 'llm'],
};
const norm = value => String(value || '').trim().toLocaleLowerCase();
const topicText = value => norm(value).replace(/[-\s]+/g, ' ');
const includesTopic = (content, term) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${topicText(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^\\p{L}\\p{N}])`, 'u').test(content);
export function list(value) {
  return [...new Set(String(value || '').split(/[;\n]/).map(s => s.trim()).filter(Boolean))].slice(0, 20);
}
export function normalizeProfile(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const strings = key => Array.isArray(value[key]) ? value[key].filter(x => typeof x === 'string').map(x => x.trim().slice(0, 160)).filter(Boolean).slice(0, 20) : [];
  return {topics: strings('topics'), societies: strings('societies'), institutions: strings('institutions'),
    stage: ['undergrad','masters','phd','postdoc','resident','faculty','staff'].includes(value.stage) ? value.stage : '',
    sharePublic: value.sharePublic === true};
}
export function match(record, profile) {
  const content = topicText([record.title, record.funder, record.description, ...(record.topics || [])].join(' '));
  const hits = profile.topics.filter(term => includesTopic(content, term) || (synonyms[norm(term)] || []).some(s => includesTopic(content, s)));
  const tags = record.affiliation_tags || {};
  const societies = profile.societies.map(norm), institutions = profile.institutions.map(norm);
  const affiliations = (tags.societies || []).filter(name => societies.includes(norm(name)));
  if (tags.institution && institutions.includes(norm(tags.institution))) affiliations.push(tags.institution);
  const stages = record.eligible_stages || [];
  let stage = 'Check applicant rules';
  if (profile.stage && stages.length) stage = stages.includes(profile.stage) ? 'Career stage listed; other rules apply' : record.faculty_sponsor_possible ? 'May need a faculty collaborator' : 'Career stage may not qualify';
  return {hits, affiliations, stage, score: hits.length * 10 + affiliations.length * 15};
}
export function opportunityKey(record) {
  try {
    const url = new URL(record.url);
    url.hash = ''; url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return `${url.href.replace(/\/$/, '')}|${record.round || (record.deadline || '').slice(0,4) || 'recurring'}|${norm(record.title).replace(/\s+/g, ' ')}`;
  } catch { return record.id; }
}
export function mergeCatalog(base, community) {
  const merged = new Map(base.map(record => [opportunityKey(record), record]));
  for (const record of community) merged.set(opportunityKey(record), record);
  return [...merged.values()];
}
export function assistantPrompt(profile, apiBase = '') {
  const lines = ['Use Fundlark to find research funding. Search the shared catalog first, then discover missing opportunities and verify current official calls.',
    `Research topics: ${profile.topics.join('; ') || 'Use the research context I provide in this chat.'}`,
    `Career stage: ${profile.stage || 'Not specified'}`,
    `Confirmed memberships: ${profile.societies.join('; ') || 'Not specified'}`,
    `Current institutions: ${profile.institutions.join('; ') || 'Not specified'}`,
    'Explain research relevance separately from eligibility. Include official URLs, source check dates, deadlines and uncertainties. Do not assume a medical field.'];
  if (apiBase) {
    lines.push(`Fundlark public service: ${apiBase}/api/catalog (reviewed community records); ${apiBase}/api/contributions (public opportunity contribution endpoint).`);
    if (profile.sharePublic) lines.push('I authorize contributing newly discovered public funding facts to that Fundlark service in the background. Follow the Fundlark contribution reference and its strict schema. Share no CV, personal profile, conversation or private institutional information. Contribution failure must not block my results.');
  }
  if (!apiBase || !profile.sharePublic) lines.push('Do not submit contributions in this session; sharing has not been enabled for a connected Fundlark service.');
  return lines.join('\n');
}
