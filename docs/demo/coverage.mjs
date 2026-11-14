const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function filterSources(sources, {field='', kind='', query=''}={}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return sources.filter(source => {
    const text = normalize([source.name, source.alias, ...source.fields].join(' '));
    return (!field || source.fields.includes(field)) && (!kind || source.kind === kind)
      && words.every(word => text.includes(word));
  });
}

export function relatedSources(sources, profile) {
  const aliases = new Set(profile.societies.map(normalize));
  const terms = new Set(profile.topics.map(normalize));
  return sources.map(source => ({
    source, weight: (aliases.has(normalize(source.name)) || aliases.has(normalize(source.alias)) ? 10 : 0)
      + source.fields.filter(field => terms.has(normalize(field))).length
  })).filter(item => item.weight).sort((a,b)=>b.weight-a.weight).slice(0,5).map(item=>item.source);
}
