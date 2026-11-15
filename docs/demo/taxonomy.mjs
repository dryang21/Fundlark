/**
 * Local-first research term ontology. The bundled seed is explicitly NOT
 * described as the full OpenAlex taxonomy. A reproducible optional importer
 * adds official OpenAlex fields/subfields/topics when a maintainer runs it.
 *
 * No network requests or profile text leave the browser from this module.
 */
import {RESEARCH_SEED} from './research-seed.mjs?v=personal-2';
const norm = text => String(text||'').normalize('NFKC').toLocaleLowerCase()
  .replace(/[\u2010-\u2015/_-]+/g,' ').replace(/[^\p{L}\p{N}+#\s]/gu,' ').replace(/\s+/g,' ').trim();
const wordTokens = text => norm(text).match(/[\p{L}\p{N}+#]+/gu)||[];
const LIMIT_EXTERNAL = 7000;
const BASIC_WEAK = new Set('research science studies study investigation application applications novel methods methodology approach approaches analysis developing development data results students student new advances trends impact clinical academic interdisciplinary using'.split(' '));
let externalConcepts=[], allConcepts=[], variantMap=new Map(), wordIndex=new Map(), nameMap=new Map(), vocabularyWords=[], suggestionIndex=[];
let meta={seedCount:0,externalCount:0,externalSource:'none'};
function rebuild(){
  allConcepts=[];variantMap=new Map();wordIndex=new Map();nameMap=new Map();
  for(const item of [...RESEARCH_SEED,...externalConcepts]){
    const label=String(item.label||item.display_name||'').trim();
    if(label.length<3||label.length>120)continue;
    const normalized=norm(label);
    if(!normalized||BASIC_WEAK.has(normalized))continue;
    let concept=nameMap.get(normalized);
    if(!concept){
      concept={id:item.id||label,label,fields:[...(item.fields||[])],subfields:[...(item.subfields||[])],aliases:[],related:[],sources:[item.source||'OpenAlex']};
      nameMap.set(normalized,concept);allConcepts.push(concept);
    } else {
      for(const f of item.fields||[])if(!concept.fields.includes(f))concept.fields.push(f);
      for(const sf of item.subfields||[])if(!concept.subfields.includes(sf))concept.subfields.push(sf);
      if(!concept.sources.includes(item.source||'OpenAlex'))concept.sources.push(item.source||'OpenAlex');
    }
    for(const a of item.aliases||[])if(!concept.aliases.includes(a))concept.aliases.push(a);
    for(const r of item.related||[])if(!concept.related.includes(r))concept.related.push(r);
  }
  for(const concept of allConcepts){
    for(const variant of [concept.label,...concept.aliases]){
      const phrase=norm(variant),tokens=wordTokens(variant);
      if(!phrase||tokens.length>9||!tokens.length)continue;
      if(!variantMap.has(phrase)||variantMap.get(phrase).label!==phrase)variantMap.set(phrase,concept);
    }
  }
  for(const [phrase,concept] of variantMap){
    const tokens=wordTokens(phrase);
    const first=tokens[0];
    if(!wordIndex.has(first))wordIndex.set(first,[]);
    wordIndex.get(first).push({tokens,concept});
  }
  for(const choices of wordIndex.values())choices.sort((a,b)=>b.tokens.length-a.tokens.length||b.concept.label.length-a.concept.label.length);
  const set=new Set();
  for(const phrase of variantMap.keys())for(const part of wordTokens(phrase))if(part.length>=7)set.add(part);
  vocabularyWords=[...set];
  suggestionIndex=[...variantMap.entries()].map(([phrase,concept])=>({phrase,concept}));
  meta={seedCount:RESEARCH_SEED.length,externalCount:externalConcepts.length,externalSource:externalConcepts.length?'OpenAlex imported local snapshot':'none'};
}
rebuild();

export function configureOpenAlexTaxonomy(input){
  const data=typeof input==='object'&&input!==null?input:{};
  if(data.schema_version!==1||!Array.isArray(data.concepts))return false;
  // Reject unbounded/untrusted payloads and malformed entries before indexing.
  externalConcepts=data.concepts.slice(0,LIMIT_EXTERNAL).filter(x=>x&&typeof x==='object'&&typeof x.label==='string'&&x.label.length<130).map(x=>({
    id:String(x.id||'').slice(0,80),label:x.label.slice(0,120),fields:Array.isArray(x.fields)?x.fields.filter(s=>typeof s==='string').slice(0,3):[],
    subfields:Array.isArray(x.subfields)?x.subfields.filter(s=>typeof s==='string').slice(0,3):[],
    aliases:Array.isArray(x.aliases)?x.aliases.filter(s=>typeof s==='string').slice(0,12):[],related:[],source:'OpenAlex'
  }));
  rebuild();return true;
}
export function taxonomyStats(){return {...meta,conceptCount:allConcepts.length,distinctVariants:variantMap.size};}
export function canonicalConcept(value){return variantMap.get(norm(value))||null;}
export function canonicalLabel(value){return canonicalConcept(value)?.label||String(value||'').trim();}
export function equivalentTerms(value){
  const concept=canonicalConcept(value);
  return concept?[...new Set([concept.label,...concept.aliases])]:[];
}
export function relatedTerms(value,{limit=5}={}){
  const concept=canonicalConcept(value);if(!concept)return [];
  return concept.related.map(name=>canonicalLabel(name)).filter(Boolean).slice(0,limit);
}
export function termVocabularyWords(){return vocabularyWords;}
export function vocabularyFields(){
  return [...new Set(allConcepts.flatMap(item=>item.fields).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
/** Browse the locally installed vocabulary; no research text leaves the browser. */
export function browseResearchConcepts({field='',query='',limit=12}={}){
  const needle=norm(query).slice(0,100),selectedField=norm(field),maximum=Math.min(Math.max(Number(limit)||12,1),40);
  const found=allConcepts.filter(item=>{
    if(selectedField&&!item.fields.some(value=>norm(value)===selectedField))return false;
    return !needle||norm(item.label).includes(needle)||item.aliases.some(value=>norm(value).includes(needle))||item.subfields.some(value=>norm(value).includes(needle));
  }).sort((a,b)=>{
    const ax=norm(a.label),bx=norm(b.label);
    const ar=needle?(ax===needle?0:ax.startsWith(needle)?1:2):0;
    const br=needle?(bx===needle?0:bx.startsWith(needle)?1:2):0;
    return ar-br||a.label.localeCompare(b.label);
  });
  return {total:found.length,items:found.slice(0,maximum).map(item=>({label:item.label,fields:item.fields,source:item.sources[0]}))};
}
/**
 * Dictionary-backed suggestions for the profile keyword picker.
 * Returns only existing concepts. Synonyms, partial strings and close typos
 * rank below exact/prefix matches; never auto-accepts an ambiguous correction.
 */
function editDistanceBounded(a,b,max){
  if(Math.abs(a.length-b.length)>max)return max+1;
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];let smallest=i;
    for(let j=1;j<=b.length;j++){
      next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
      if(next[j]<smallest)smallest=next[j];
    }
    if(smallest>max)return max+1;
    row=next;
  }
  return row[b.length];
}
export function searchResearchConcepts(query,{limit=8}={}){
  const needle=norm(query).slice(0,100);
  if(needle.length<2)return [];
  const maxResults=Math.min(12,Math.max(1,Number(limit)||8));
  const byConcept=new Map();
  // Short inputs can only match prefixes/substrings; do not fuzzy-match acronyms.
  const tolerance=needle.length>=17?3:needle.length>=7?2:needle.length>=5?1:0;
  for(const {phrase,concept} of suggestionIndex){
    let score=Infinity,reason='';
    if(phrase===needle){score=0;reason='Exact term or synonym';}
    else if(phrase.startsWith(needle)){score=2+Math.min(phrase.length-needle.length,30)/100;reason='Starts with your input';}
    else if(phrase.split(' ').some(word=>word.startsWith(needle))){score=9;reason='Word prefix';}
    else if(phrase.includes(needle)){score=14;reason='Related text';}
    else if(tolerance>0 && Math.abs(phrase.length-needle.length)<=tolerance){
      const distance=editDistanceBounded(needle,phrase,tolerance);
      if(distance<=tolerance){score=28+distance*3;reason='Possible spelling correction';}
    }
    if(!Number.isFinite(score))continue;
    const key=norm(concept.label),existing=byConcept.get(key);
    if(!existing||score<existing.score)byConcept.set(key,{label:concept.label,fields:concept.fields,reason,score});
  }
  return [...byConcept.values()].sort((a,b)=>a.score-b.score||a.label.localeCompare(b.label))
    .slice(0,maxResults).map(({score,...item})=>item);
}
export function extractTaxonomyTerms(text,{limit=20}={}){
  const tokens=wordTokens(text),output=[],seen=new Set();
  for(let i=0;i<tokens.length&&output.length<limit;i++){
    let found=null;
    for(const possibility of wordIndex.get(tokens[i])||[]){
      if(i+possibility.tokens.length>tokens.length)continue;
      if(possibility.tokens.every((t,j)=>t===tokens[i+j])){found=possibility;break;}
    }
    if(!found)continue;
    const label=found.concept.label,key=norm(label);
    if(!seen.has(key)){
      output.push({term:label,conceptId:found.concept.id,fields:found.concept.fields,source:found.concept.sources[0]});
      seen.add(key);
    }
    i+=found.tokens.length-1;
  }
  return output;
}
// The term index powers a spelling checker but never overrides unfamiliar
// nomenclature when a correction is ambiguous.
export const normalizeResearchTerm=norm;
