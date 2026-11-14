// Sample sessions never read or write personal browser storage.
export const examples = {
  computing: {researchText:'My lab studies artificial intelligence and machine learning',stage:'faculty',societies:['IEEE'],institutions:[]},
  ecology: {researchText:'I study salt marsh restoration, coastal ecology, and climate adaptation',stage:'phd',societies:['Ecological Society of America'],institutions:['University of Bristol']},
};

export function cvSuggestions(text, sources=[], catalogTopics=[]) {
  const topics=[], societies=[], institutions=[];
  let section='', stage='';
  const recent=[];
  const body=text.slice(0,50000);
  const stagePatterns=[['postdoc',/\bpostdoc(?:toral)?\b/i],['phd',/\b(?:ph\.?d\.?|doctoral) (?:student|candidate)\b/i],['faculty',/\b(?:faculty|professor)\b/i],['resident',/\bresident\b/i],['staff',/\bresearch (?:staff|scientist)\b/i]];
  for(const raw of body.split(/\r?\n/)) {
    const line=raw.trim();
    if(/^(?:(?:professional )?memberships?|education|(?:selected )?publications?|(?:professional |academic )?experience|(?:academic )?employment|positions|(?:current |previous |academic )?appointments?|research interests|skills|awards|teaching):?$/i.test(line)){
      section=line.toLowerCase().replace(/:$/,'');continue;
    }
    const interests=line.match(/^(?:research interests|research topics|research focus|keywords)\s*:\s*(.+)$/i);
    if(interests || section==='research interests') {
      const phrase=interests?.[1]||line;
      if(phrase && !/[@]|https?:|\d{5}/i.test(phrase))topics.push(...phrase.split(/[,;]+/).map(s=>s.trim()));
    }
    if(!section.includes('publication') && !section.startsWith('previous') && (section==='current appointment'||/\b(?:19|20)\d{2}\s*[–—-]\s*(?:present|current)\b/i.test(line)))recent.push(line);
    const appointment=line.match(/^(?:current appointment|current position|current affiliation)\s*:\s*(.+)$/i);
    if(appointment){
      const role=appointment[1];
      stage=stagePatterns.find(([,pattern])=>pattern.test(role))?.[0]||stage;
      const organization=role.match(/(?:,\s*|\s+at\s+)([^,]+(?:University|College|Institute|Laboratory)[^,]*|University of California, [^,]+)$/i)?.[1];
      if(organization)institutions.push(organization.trim());
    }
    if(/former|expired|lapsed|past member|\b\d{4}\s*[-–]\s*\d{4}/i.test(line))continue;
    if(section && !section.includes('membership'))continue;
    const member=line.match(/^(?:(?:current|student|senior|professional|graduate|regular)\s+)?member(?:ship)?\s*(?::\s*|\s+of\s+)(.+)$/i);
    if(member)societies.push(member[1].replace(/[,;]?\s+\d{4}\s*[-–].*$/,'').trim());
  }
  for(const line of recent){
    const role=stagePatterns.find(([,pattern])=>pattern.test(line))?.[0];
    if(!role)continue;
    const organization=line.match(/(?:,\s*|\s+at\s+)([^,(]+\b(?:University|College|Institute|Laboratory)\b[^,(]*)/i)?.[1];
    if(organization){if(!stage)stage=role;institutions.push(organization.trim());break;}
  }
  if(!topics.length){
    // Topic hints can come from publication titles and project descriptions.
    // They are never used as evidence of a current role or society membership.
    const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/[-‐‑–—\s]+/g,' ');
    const corpus=normalize(body.replace(/\S+@\S+|https?:\/\/\S+/gi,' '));
    const current=normalize(recent.join(' '));
    const fields=[...new Set([...sources.flatMap(source=>source.fields||[]),...catalogTopics].map(normalize))]
      .filter(term=>term.length>=4 && term.length<=100);
    const ranked=fields.flatMap(term=>{
      const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re=new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,'gu');
      const hits=[...corpus.matchAll(re)];
      return hits.length?[{term,score:Math.min(hits.length,6)+Number(re.test(current))*3+Number(term.includes(' ')),first:hits[0].index}]:[];
    });
    ranked.sort((a,b)=>b.score-a.score||a.first-b.first);
    topics.push(...ranked.slice(0,10).map(item=>item.term));
  }
  const clean=items=>[...new Set(items.filter(s=>s.trim()&&s.length<=160&&!/[@]|https?:/i.test(s)))].slice(0,12);
  const aliases={'american association of physicists in medicine':'AAPM','american society for radiation oncology':'ASTRO','institute of electrical and electronics engineers':'IEEE','association for computing machinery':'ACM'};
  return {topics:clean(topics),societies:clean(societies.map(s=>Object.hasOwn(aliases,s.toLowerCase())?aliases[s.toLowerCase()]:s)),institutions:clean(institutions),stage};
}

export function upcomingSaved(records, today, days=30) {
  const until=new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  return records.filter(o=>!o.archived && ['open','rolling'].includes(o.status) && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline||'')&&o.deadline>=today&&o.deadline<=until)
    .sort((a,b)=>a.deadline.localeCompare(b.deadline));
}
