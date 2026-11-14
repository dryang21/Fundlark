// Run after npm run build:cv. Reads local PDFs and reports detection coverage.
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {cvReview} from '../docs/demo/cv-profile.mjs';

const load = async path => JSON.parse(await readFile(path,'utf8'));
const [manifest] = process.argv.slice(2);
if(!manifest)throw new Error('Usage: node scripts/evaluate_cv.mjs cv/public/corpus.json');
const coverage=await load(new URL('../docs/demo/coverage.json',import.meta.url));
const catalog=await load(new URL('../docs/demo/data.json',import.meta.url));
const topics=[...coverage.opportunities,...catalog.opportunities].flatMap(item=>item.topics||[]);
// The browser supplies DOMMatrix; Node needs a placeholder for PDF text extraction.
globalThis.DOMMatrix ??= class {};
const {readCV}=await import('../docs/demo/cv-reader.mjs');
const results=[];
for(const item of await load(manifest)){
  const {file,group}=item;
  try{
    const body=await readCV(new File([await readFile(join(dirname(manifest),file))],file));
    const {result,stages}=cvReview(body,coverage.sources,topics);
    results.push({file,group,readable:true,textLength:body.length,topics:result.topics.length,societies:result.societies.length,institutions:result.institutions.length,stage:result.stage,ambiguousStage:stages.length>1});
  }catch{
    results.push({file,group,readable:false});
  }
}
const readable=results.filter(row=>row.readable);
console.log(JSON.stringify({
  attempted:results.length,readable:readable.length,
  fieldDetected:Object.fromEntries(['topics','societies','institutions','stage','ambiguousStage'].map(key=>[key,readable.filter(row=>row[key]).length])),
  groups:Object.fromEntries([...new Set(results.map(row=>row.group))].sort().map(group=>[group,readable.filter(row=>row.group===group).length])),
  results,
},null,2));
