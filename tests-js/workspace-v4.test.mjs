import test from 'node:test';
import assert from 'node:assert/strict';
import {stageFields, yearsSincePhdForStage, filterDashboard, exploreFunding, sourceCounts} from '../docs/demo/workspace.mjs';
import {normalizeProfile} from '../docs/demo/matching.mjs';

const records=[
 {id:'u',status:'rolling',title:'AI undergraduate travel support',funder:'Society X',description:'artificial intelligence and robotics',category:'Society',eligible_stages:['undergrad'],topics:['artificial intelligence'],eligibility_rules:{application_route:'direct'}},
 {id:'p',status:'rolling',title:'Medical physics resident research award',funder:'Research Society',description:'medical physics',category:'Society',eligible_stages:['resident'],topics:['medical physics'],eligibility_rules:{application_route:'direct'}},
 {id:'f',status:'rolling',title:'Trustworthy AI faculty collaboration',funder:'Example University',description:'AI for healthcare',category:'Institution',eligible_stages:['faculty'],topics:['artificial intelligence'],eligibility_rules:{application_route:'partner'}},
 {id:'a',status:'rolling',title:'Cultural heritage digital humanities',funder:'Heritage Council',description:'archaeology research',category:'Government',eligible_stages:['phd','postdoc'],topics:['archaeology'],field_ids:['humanities']},
 {id:'old',status:'closed',title:'AI past round',funder:'Private Foundation',description:'AI',category:'Foundation',eligible_stages:['resident'],topics:['artificial intelligence']}
];
test('stage-dependent fields never ask students how many years since PhD',()=>{
 for(const stage of ['undergrad','masters','phd']){
   assert.equal(stageFields(stage).phdCompletion,false);assert.equal(stageFields(stage).studyYear,true);
   assert.equal(yearsSincePhdForStage(stage,2020,2026),null);
 }
 assert.equal(stageFields('resident').expectedCompletion,true);
 assert.equal(stageFields('faculty').facultyRank,true);
 assert.equal(yearsSincePhdForStage('postdoc',2024,2026),2);
 assert.equal(yearsSincePhdForStage('postdoc',2028,2026),null);
});
test('dashboard shows ALL plausible personalized leads and source filters preserve counts',()=>{
 const p={stage:'resident',topics:['artificial intelligence','medical physics']};
 const all=filterDashboard(records,p,{availability:'active'});
 assert.deepEqual(new Set(all.map(r=>r.id)),new Set(['p','f']));
 assert.equal(filterDashboard(records,p,{availability:'active',category:'Society'}).length,1);
 assert.equal(filterDashboard(records,p,{availability:'active',route:'partner'}).length,1);
});
test('explore is independent of profile and supports natural-language, discipline, sources and stage',()=>{
 assert.deepEqual(exploreFunding(records,{description:'I study archaeology and cultural heritage',fields:['humanities'],availability:'active'}).map(r=>r.id),['a']);
 assert.deepEqual(exploreFunding(records,{keywords:'medical physics',category:'Society',availability:'active'}).map(r=>r.id),['p']);
 assert.deepEqual(exploreFunding(records,{keywords:'robotics',stage:'undergrad',availability:'active'}).map(r=>r.id),['u','f']);
 assert.equal(exploreFunding(records,{availability:'active'}).length,4);
 assert.equal(exploreFunding(records,{availability:'all'}).length,5);
});
test('source breakdown counts only indexed records, not directory entries',()=>{
 assert.equal(sourceCounts(records).Society,2);assert.equal(sourceCounts(records).Government,1);
});

test('switching to a student stage clears hidden post-PhD eligibility facts',()=>{
 const student=normalizeProfile({stage:'masters',yearsSincePhd:5,phdCompletionYear:2021,appointment:'research_postdoc',piPrivileges:true,researchEffortPercent:70,academicYear:2});
 assert.equal(student.yearsSincePhd,null);assert.equal(student.phdCompletionYear,null);
 assert.equal(student.piPrivileges,null);assert.equal(student.researchEffortPercent,null);assert.equal(student.appointment,'');
 assert.equal(student.academicYear,2);
});
