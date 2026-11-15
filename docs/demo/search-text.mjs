/**
 * Plain-language relevance for broad catalog search.
 *
 * The research dictionary recognises curated concepts; this module covers the
 * rest so that any reasonable query ("tumor microenvironment", "Damon Runyon",
 * "housing inequality") still finds records that use those words. Scores are a
 * ranking aid only: they say nothing about eligibility or chances of success.
 */

const STOP = new Set(`a about above across after again against all also am an and any are as at be
because been before being below between both but by can could did do does doing during each for from
further had has have having he her here hers him his how i if in into is it its itself just me more
most my myself no nor not now of off on once only or other our ours out over own same she should so
some such than that the their theirs them then there these they this those through to too under until
up very was we were what when where which while who whom why will with would you your yours
currently interested interest interests work working works worked study studying studies studied
research researcher researchers researching project projects proposal propose proposed aim aims
develop developing development using use used new novel approach approaches based focus focused
including include includes area areas field fields year years student students early career
want wants looking seeking hope plan plans program programme programs programmes funding fund funds
grant grants award awards opportunity opportunities support supports`.split(/\s+/));

/** Words that describe the applicant's stage rather than the research topic. */
const STAGE_WORDS = {
  postdoc:'postdoc', postdoctoral:'postdoc', postdocs:'postdoc',
  phd:'phd', doctoral:'phd', doctorate:'phd', dissertation:'phd', predoctoral:'phd',
  graduate:'phd', grad:'phd',
  undergraduate:'undergrad', undergrad:'undergrad', bachelor:'undergrad',
  masters:'masters', master:'masters', msc:'masters',
  faculty:'faculty', professor:'faculty', investigator:'faculty',
  resident:'resident', residency:'resident', clinician:'resident'
};

/** Light stemmer: enough to join "batteries/battery", "imaging/image", "neural/neurons". */
export function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 6 && /(al|ic)$/.test(w)) w = w.slice(0, -2);
  if (w.length > 5 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

const words = text => String(text || '').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&#?\w+;/g, ' ')
  .match(/[a-z0-9][a-z0-9+-]*[a-z0-9+]|[a-z0-9]/g) || [];

/** Split a query into topical tokens and any career-stage hints it mentions. */
export function parseQuery(text) {
  const tokens = [], stages = new Set(), bigrams = new Set();
  let previous = null;
  for (const raw of words(text)) {
    for (const piece of raw.split('-')) {
      if (!piece) continue;
      if (Object.hasOwn(STAGE_WORDS, piece)) { stages.add(STAGE_WORDS[piece]); previous = null; continue; }
      if (STOP.has(piece) || piece.length < 3 && !/^(ai|ml|hiv|uk|eu|us)$/.test(piece)) { previous = null; continue; }
      const token = stem(piece);
      if (previous && previous !== token) bigrams.add(previous + ' ' + token);
      previous = token;
      if (!tokens.includes(token)) tokens.push(token);
    }
  }
  return {tokens: tokens.slice(0, 30), stages: [...stages], bigrams: [...bigrams].slice(0, 30)};
}

const indexCache = new WeakMap(), tokenCache = new WeakMap();
function recordTokens(record) {
  let entry = tokenCache.get(record);
  if (!entry) {
    const stems = text => words(text).flatMap(w => w.split('-')).filter(Boolean).map(stem);
    const titleStems = stems([record.title, record.funder].join(' '));
    const bodyStems = stems([record.description, record.eligibility, record.funding_type, ...(record.topics || [])].join(' | '));
    const pairs = new Set();
    for (const list of [titleStems, bodyStems])
      for (let i = 1; i < list.length; i++) pairs.add(list[i - 1] + ' ' + list[i]);
    entry = {title: new Set(titleStems), body: new Set(bodyStems), pairs};
    tokenCache.set(record, entry);
  }
  return entry;
}

/** Inverse document frequency over a record array, cached per array. */
function corpus(records) {
  let index = indexCache.get(records);
  if (!index) {
    const df = new Map();
    for (const record of records) {
      const {title, body} = recordTokens(record);
      for (const token of new Set([...title, ...body])) df.set(token, (df.get(token) || 0) + 1);
    }
    index = {df, n: Math.max(records.length, 1)};
    indexCache.set(records, index);
  }
  return index;
}

/**
 * Score one record for parsed query tokens. Title and funder hits count three
 * times as much as description hits; rare words count more than common ones.
 * Returns {score, matched} where matched is the number of distinct tokens hit.
 */
export function lexicalScore(record, parsed, records) {
  if (!parsed.tokens.length) return {score: 0, matched: 0};
  const index = corpus(records);
  const {title, body} = recordTokens(record);
  let score = 0, matched = 0;
  for (const token of parsed.tokens) {
    const inTitle = title.has(token), inBody = body.has(token);
    if (!inTitle && !inBody) continue;
    matched++;
    const idf = Math.log(1 + index.n / (1 + (index.df.get(token) || 0)));
    score += idf * (inTitle ? 2 : 1);
  }
  // Adjacent word pairs ("single cell", "spatial transcriptomics") are far
  // stronger evidence than the same words scattered across a long call text.
  const {pairs} = recordTokens(record);
  for (const pair of parsed.bigrams || []) {
    if (!pairs.has(pair)) continue;
    const [a, b] = pair.split(' ');
    score += 2 * (Math.log(1 + index.n / (1 + (index.df.get(a) || 0))) + Math.log(1 + index.n / (1 + (index.df.get(b) || 0))));
  }
  return {score, matched};
}

/** How many distinct query words a record must contain to count as a text match. */
export function requiredMatches(tokenCount) {
  if (tokenCount <= 2) return tokenCount;
  if (tokenCount <= 5) return 2;
  return Math.min(4, Math.ceil(tokenCount * 0.25));
}
