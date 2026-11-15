import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIELDS,recordFields,fieldStats,filterByField,filterHubs,TRACK_STATES,normalizedTrackerEntry,trackerStats,trackerCSV,trackerICS} from '../docs/demo/explorer.mjs';
const hubs=JSON.parse(readFileSync(new URL('../docs/demo/source-hubs.json',import.meta.url))).sources;
const extras=JSON.parse(readFileSync(new URL('../docs/demo/crossdisciplinary.json',import.meta.url))).opportunities;
test('13 mainstream fields and well-formed sponsor source network',()=>{
  assert.equal(FIELDS.length,13);
  assert.ok(hubs.length>=60);
  assert.ok(new Set(hubs.map(h=>h.id)).size===hubs.length);
  for(const h of hubs){assert.match(h.url,/^https:\/\//);assert.ok(h.fields.every(f=>f==='all'||FIELDS.some(field=>field.id===f)),`unknown field ${h.id}`);}
});
test('funding portals not treated as verified open opportunities',()=>{
  assert.ok(hubs.every(h=>h.listing_type==='official_source_directory'));
  assert.ok(!hubs.some(h=>Object.hasOwn(h,'status')));
});
test('tags apply to all mainstream fields, including specialized humanities & education',()=>{
  assert.ok(recordFields({title:'History of Philosophy',topics:['historical research']}).includes('humanities'));
  assert.ok(recordFields({title:'Chemical engineering energy systems',topics:[]}).includes('engineering'));
  assert.ok(recordFields({title:'Research about nutritional crop science',topics:['agriculture']}).includes('agriculture'));
  assert.ok(recordFields({title:'Explorations of teacher development',topics:['education research']}).includes('education'));
  assert.ok(recordFields({title:'Artificial intelligence and robotics research',topics:[]}).includes('computing'));
  assert.equal(recordFields({title:'Research grant',topics:['research']} ).length,0);
});
test('field statistics and filtering remain inclusive and honest',()=>{
  const records=[{title:'Molecular biology research',topics:[]},{title:'Anthropology of migration',topics:[]},{title:'Unclassified grant',topics:[]}];
  assert.equal(fieldStats(records).find(f=>f.id==='life').records,1);
  assert.equal(filterByField(records,'social').length,1);
  assert.equal(filterByField(records,'').length,3);
});
test('official-source filters can narrow by discipline, region, funder type',()=>{
  const filtered=filterHubs(hubs,{field:'humanities',region:'United States',kind:'Government'});
  assert.ok(filtered.some(h=>h.id==='us-neh'));
  assert.ok(!filtered.some(h=>h.id==='uk-ukri'));
  assert.ok(filterHubs(hubs,{query:'NSF'}).some(h=>h.id==='us-nsf'));
});
test('new reviewed crossdisciplinary opportunities have official links and no invented dates',()=>{
  assert.ok(extras.length>=8);
  const covered=new Set(extras.flatMap(o=>o.field_ids));
  for(const f of ['humanities','education','physical','engineering','social','medicine','agriculture'])assert.ok(covered.has(f),f);
  for(const r of extras){assert.ok(r.last_verified_at);assert.ok(!r.review_needed);assert.match(r.url,/^https:\/\//);assert.ok(['open','rolling','forecast','verify'].includes(r.status));}
  assert.ok(extras.find(r=>r.id==='cross:dfg-walter-benjamin').deadline===null);
});
test('tracker states are constrained, CSV quoting prevents broken rows',()=>{
  assert.equal(normalizedTrackerEntry({state:'deleted'}).state,'Interested');
  assert.equal(normalizedTrackerEntry({state:'Submitted'}).state,'Submitted');
  assert.deepEqual(TRACK_STATES.filter(s=>trackerStats([{state:s}])[s]!==1),[]);
  const csv=trackerCSV([{record:{title:'A, "special" project',funder:'Agency',category:'Government',deadline:'2027-03-12',url:'https://example.org'},state:'Preparing',note:'Ask mentor, review',targetDate:'2027-02-01'}]);
  assert.ok(csv.includes('"A, ""special"" project"'));
  assert.ok(csv.includes('"Ask mentor, review"'));
});
test('deadline calendar is a valid minimal all-day iCalendar and excludes undated records',()=>{
  const ics=trackerICS([{record:{id:'abcd',title:'Science Award',deadline:'2027-02-28',url:'https://example.org'}},{record:{id:'abcd2',title:'Other award',deadline:null,url:'https://example.org'}}]);
  assert.match(ics,/BEGIN:VCALENDAR/);
  assert.match(ics,/DTSTART;VALUE=DATE:20270228/);
  assert.match(ics,/DTEND;VALUE=DATE:20270301/);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
});
