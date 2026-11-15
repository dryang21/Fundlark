/** Run the live demo's matching functions against fictional researchers. */
import {readFileSync, existsSync} from 'node:fs';
import {buildResearchKeywords} from '../docs/demo/manual-profile.mjs';
import {normalizeHostRegion} from '../docs/demo/host-regions.mjs';
import {recordFields} from '../docs/demo/explorer.mjs';
import {mergeCatalog, configureSocietyAliases, normalizeProfile, statusOf} from '../docs/demo/matching.mjs?v=personal-2';
import {configureOpenAlexTaxonomy} from '../docs/demo/taxonomy.mjs?v=personal-2';
import {filterDashboard, sourceCounts} from '../docs/demo/workspace.mjs';
import {evaluateEligibility} from '../docs/demo/eligibility.mjs';

const read=name=>JSON.parse(readFileSync(new URL(`../docs/demo/${name}.json`,import.meta.url),'utf8'));
if(existsSync(new URL('../docs/demo/openalex-topics.json',import.meta.url)))configureOpenAlexTaxonomy(read('openalex-topics'));
configureSocietyAliases(read('coverage').sources);
const bundleNames=['data','coverage','supplemental','crossdisciplinary','global-programs','ukri-calls','bulk-calls'];
const records=bundleNames.map(name=>read(name).opportunities).reduce(mergeCatalog)
  .map(record=>({...record,field_ids:recordFields(record)}));
const known=records.flatMap(record=>record.topics||[]);

const ai={description:'I am a doctoral researcher developing computer vision and machine learning methods for efficient multimodal models and robotics.',stage:'phd'};
const cases=[
  {id:'stanford-medical-physics',description:'I am a medical physics resident researching machine learning for radiation therapy treatment planning, image-guided radiotherapy, and medical imaging.',stage:'resident',researchRegion:'United States',institutions:['Stanford University'],societies:['AAPM','ASTRO'],researchEffortPercent:40,mentorConfirmed:true},
  {id:'us-ai-phd',...ai,researchRegion:'United States',institutions:['University of Michigan'],societies:['ACM']},
  {id:'india-ai-phd',...ai,researchRegion:'India',institutions:['Indian Institute of Technology Delhi'],societies:['IEEE']},
  {id:'uk-humanities-postdoc',description:'I study migration and labor history using digital humanities, oral history, and digitized archives.',stage:'postdoc',researchRegion:'United Kingdom',institutions:['University of Bristol'],societies:['Royal Historical Society']},
  {id:'canadian-engineering-undergrad',description:'I study mechanical engineering and test low-cost robotics and automation for manufacturing.',stage:'undergrad',researchRegion:'Canada',institutions:['University of British Columbia'],societies:['ASME']},
  {id:'german-robotics-faculty',description:'I am a university investigator researching human–robot interaction, industrial automation, and safe collaborative robots.',stage:'faculty',researchRegion:'Germany',institutions:['Technical University of Munich'],societies:['IEEE'],piPrivileges:true},
  {id:'nigerian-agriculture',description:'I research agroecology, climate change adaptation, crop yields and food security for smallholder farms.',stage:'faculty',researchRegion:'Other',institutions:['University of Ibadan'],piPrivileges:true,regionNote:'Nigeria is not in the location picker; entered Other.'}
];
const coreFields=['medical physics','computing','computing','humanities','engineering','robotics','agriculture'];
const regionalPicker=country=>normalizeHostRegion(country);
const core=cases.map(({regionNote,...c},i)=>{
  const country=c.id==='nigerian-agriculture'?'Nigeria':c.researchRegion;
  return {...c,field:coreFields[i],country,researchRegion:regionalPicker(country)};
});
const expanded=readFileSync(new URL('../evals/diverse-profiles.tsv',import.meta.url),'utf8').trimEnd().split(/\r?\n/).slice(1)
  .map(line=>{
    const [id,country,stage,field,institution,societies,description]=line.split('\t');
    if(!id||!country||!field||!description)throw new Error(`Invalid synthetic case: ${id}`);
    return {id,country,stage,field,institutions:institution?[institution]:[],societies:societies?societies.split(';'):[],description,researchRegion:regionalPicker(country)};
  });
const suite=process.argv.includes('--expanded')?[...core,...expanded]:core;
if(new Set(suite.map(c=>c.id)).size!==suite.length)throw new Error('Duplicate synthetic case IDs');
const items=suite.map(({id,description,regionNote,field,country,...fields})=>{
  const {topics}=buildResearchKeywords({description},known);
  const profile=normalizeProfile({...fields,researchBackground:description,topics});
  const visible=filterDashboard(records,profile);
  const inclusive=filterDashboard(records,profile,{eligibility:'all'});
  const top=visible.slice(0,5).map(row=>{
    const fit=evaluateEligibility(row,profile);
    return {id:row.id,title:row.title,funder:row.funder,category:row.category,url:row.url,status:statusOf(row),
      deadline:row.deadline??null,eligibility:row.eligibility??null,assessment:fit.kind,
      blockers:fit.checks.filter(c=>c.state==='fail').map(c=>c.text),
      fieldOnly:row.matching.topicEvidence.length>0&&row.matching.topicEvidence.every(e=>e.matched.startsWith('field: ')),
      affiliationEvidence:row.matching.affiliations,
      evidence:row.matching.topicEvidence.slice(0,3).map(e=>e.matched)};
  });
  const adobe=inclusive.find(x=>x.id==='curated:program-adobe-india');
  const manualControl=id==='german-robotics-faculty'?filterDashboard(records,{
    ...profile,topics:buildResearchKeywords({description,keywords:'robotics'},known).topics
  }):null;
  return {id,field,country,description,profile:fields,regionNote,keywords:topics,total:visible.length,
    listedOpen:visible.filter(row=>['open','rolling'].includes(statusOf(row))).length,
    knownConflicts:visible.filter(row=>evaluateEligibility(row,profile).kind==='ineligible').length,
    heldOutByHostFilter:inclusive.length-visible.length,bySource:sourceCounts(visible),top,
    ...(adobe?{adobe:{rank:visible.findIndex(x=>x.id===adobe.id)+1,assessment:evaluateEligibility(adobe,profile).kind}}:{}),
    ...(manualControl?{manualKeywordControl:{keyword:'robotics',total:manualControl.length,
      horizon:manualControl.filter(r=>r.origin==='horizon_feed'&&/robotics/i.test(r.title)).map(r=>({title:r.title,url:r.url,status:statusOf(r)}))}}:{})};
});
console.log(JSON.stringify({snapshot:records.length,scope:'active default recommendations; synthetic profiles only',cases:items},null,2));
