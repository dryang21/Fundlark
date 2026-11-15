// Manual research keywords, spelling normalization and explainable editing.
// Spellcheck is conservative: correct clear research vocabulary typos, never
// silently alter the user's original description or unfamiliar acronyms.
import {researchTerms} from './matching.mjs';
import {FIELDS} from './explorer.mjs';
import {extractTaxonomyTerms,canonicalLabel,canonicalConcept,termVocabularyWords} from './taxonomy.mjs?v=personal-2';

export const PROFILE_TOPIC_SUGGESTIONS = [
  'Artificial intelligence', 'Climate change', 'Cancer research', 'Education',
  'Robotics', 'Public policy', 'Archaeology', 'Materials science'
];
const CANONICAL_PHRASES = [
  ...PROFILE_TOPIC_SUGGESTIONS, ...FIELDS.flatMap(field=>field.terms),
  'reinforcement learning','machine learning','deep learning','large language models',
  'foundation models','foundation model agents','model predictive control',
  'natural language processing','radiotherapy','radiation oncology',
  'medical physics','treatment planning','bioinformatics','neuroscience',
  'environmental science','sustainable materials','electrochemistry',
  'clinical trials','quantum computing','cultural heritage','robotics',
  'artificial intelligence','computational biology','public health',
  'genomics','epidemiology','nanotechnology','semiconductors','sustainability'
];
const FIXED_TYPOS = new Map(Object.entries({
  'artifical':'artificial','artificaly':'artificially','intellgence':'intelligence',
  'inteligence':'intelligence','machien':'machine','maching':'machine',
  'learing':'learning','lernning':'learning','reinforcment':'reinforcement',
  'reinfocement':'reinforcement','radiotheraphy':'radiotherapy',
  'radioterapy':'radiotherapy','oncologoy':'oncology',
  'neurosciense':'neuroscience','bioinformtics':'bioinformatics',
  'enviromental':'environmental','sustainablity':'sustainability',
  'sustianable':'sustainable','archaeolgy':'archaeology',
  'epidemeology':'epidemiology','matierals':'materials',
  'educaton':'education','statitics':'statistics',
  'optimizaton':'optimization','computatonal':'computational',
}));
// Avoid converting ordinary English or investigator names into specialized terms.
const WEAK_AUTO_WORDS = new Set('context across uses comprehensive improve improving making generic general current previous methods project projects research ideas idea example examples institutions institution approach approaches better want wants interested related various multiple different challenges problem problems model models data'.split(' '));
const COMMON_ENGLISH = new Set(('there these those other another through their about because before after within without ' +
  'which where while working focused general strong method research scientist science problem ' +
  'project proposed experience previous interested developing include includes have using ' +
  'studying study design testing improve understand better analysis theory current ' +
  'collaborate collaborate patients physician physicians clinical data models').split(/\s+/));
const wordKey = term => String(term||'').trim().toLocaleLowerCase();
const lexicalWords = text => (String(text||'').toLocaleLowerCase().match(/[a-z]{7,}/g)||[]);
function dictionary(topics=[]){
  const terms=[...CANONICAL_PHRASES,...termVocabularyWords(),...topics];
  return new Set(terms.flatMap(lexicalWords));
}
function withinEdits(a,b,max){
  if(Math.abs(a.length-b.length)>max)return max+1;
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const current=[i];let smallest=current[0];
    for(let j=1;j<=b.length;j++){
      current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
      smallest=Math.min(smallest,current[j]);
    }
    if(smallest>max)return max+1;
    previous=current;
  }
  return previous[b.length];
}
export function autoCorrectResearchText(raw,knownTopics=[]){
  const lexicon=dictionary(knownTopics);
  const changes=[];
  const text=String(raw||'').replace(/[\p{L}]+/gu,word=>{
    const lower=wordKey(word);
    // Preserve abbreviations and mixed-capitalization model/product names.
    if(word.length<7||/^[A-Z]{2,}$/.test(word)||/[A-Z].+[A-Z]/.test(word)||COMMON_ENGLISH.has(lower))return word;
    let correction=FIXED_TYPOS.get(lower)||null;
    if(!correction&&!lexicon.has(lower)&&/^[a-z]+$/i.test(word)){
      const max=lower.length>=11?2:1;
      let smallest=max+1, best=null, tied=false;
      for(const candidate of lexicon){
        if(Math.abs(candidate.length-lower.length)>max||candidate[0]!==lower[0])continue;
        const distance=withinEdits(lower,candidate,max);
        if(distance<smallest){smallest=distance;best=candidate;tied=false;}
        else if(distance===smallest){tied=true;}
      }
      if(smallest<=max&&!tied)correction=best;
    }
    if(!correction||correction===lower)return word;
    changes.push({from:word,to:correction});
    return /^[A-Z]/.test(word)?correction[0].toUpperCase()+correction.slice(1):correction;
  });
  return {text,changes};
}
export function buildResearchKeywords({description='',keywords='',excluded=[]}={},knownTopics=[]){
  const manualInput=String(keywords||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean).slice(0,30);
  knownTopics=[...knownTopics,...PROFILE_TOPIC_SUGGESTIONS,...CANONICAL_PHRASES];
  const correctedDescription=autoCorrectResearchText(description,knownTopics);
  const manual=manualInput.map(term=>canonicalConcept(autoCorrectResearchText(term,knownTopics).text.trim())?.label).filter(Boolean);
  // Recognize long, discipline-specific phrases first. The old extractor is
  // retained only as a limited fallback for emerging/unindexed terminology.
  // Preserve exact terms from the user's prose even if a later fuzzy spelling
  // correction changes part of a valid phrase.
  const recognized=[...new Set([description,correctedDescription.text]
    .flatMap(text=>extractTaxonomyTerms(text,{limit:20}).map(entry=>entry.term)))].slice(0,20);
  const recognizedSet=new Set(recognized.map(wordKey));
  const coveredWords=new Set(recognized.flatMap(term=>(term.toLowerCase().match(/[a-z]+/g)||[])));
  const vague=new Set('through explores explore includes include background building relates these there about studies studying complex research projects current interests interested using methods method experience expertise systems system different previous approach approaches analysis development improving innovative emerging models model data results novel various collaboration design education science'.split(' '));
  const fallback=researchTerms(correctedDescription.text,knownTopics)
    .filter(term=>!WEAK_AUTO_WORDS.has(wordKey(term))&&!recognizedSet.has(wordKey(canonicalLabel(term))))
    .filter(term=>{
      const words=term.toLowerCase().match(/[a-z]+/g)||[];
      return words.some(w=>w.length>=9&&!coveredWords.has(w)&&!vague.has(w)&&!COMMON_ENGLISH.has(w));
    }).slice(0,4);
  const automatic=[...recognized,...fallback.map(term=>canonicalConcept(term)?.label).filter(Boolean)];
  const denied=new Set(excluded.map(wordKey));
  const all=new Map();
  for(const [kind,values] of [['manual',manual],['auto',automatic]]){
    for(const value of values){
      const term=String(value).trim().slice(0,160),key=wordKey(term);
      if(!key||denied.has(key)||all.has(key))continue;
      all.set(key,{term,kind});
      if(all.size===20)break;
    }
    if(all.size===20)break;
  }
  return {
    topics:[...all.values()].map(x=>x.term), entries:[...all.values()],
    corrections:[...correctedDescription.changes,...manualInput.flatMap(term=>autoCorrectResearchText(term,knownTopics).changes)]
      .filter((x,i,arr)=>arr.findIndex(y=>wordKey(y.from)===wordKey(x.from))===i)
  };
}
// Compatibility with existing profile-based matching tests and old snapshots.
export function manualResearchTopics({background='',proposal='',keywords='',description='',excluded=[]}={},knownTopics=[]){
  return buildResearchKeywords({description:description||[proposal,background].filter(Boolean).join('; '),keywords,excluded},knownTopics).topics;
}
export function researchProfileText({background='',proposal='',description='',keywords=''}={}){
  return [description||[background,proposal].map(x=>x.trim()).filter(Boolean).join('; '),keywords].map(x=>x.trim()).filter(Boolean).join('; ').slice(0,3200);
}
