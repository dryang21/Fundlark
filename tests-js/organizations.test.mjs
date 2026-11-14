import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {organizationLabel,localInstitutions,resolveOrganization,searchOrganizations,registryOrganizations,societyOptions} from '../docs/demo/organizations.mjs';
import {configureSocietyAliases,normalizeProfile,selectRecords,membershipMatches} from '../docs/demo/matching.mjs';
const coverage=JSON.parse(readFileSync(new URL('../docs/demo/coverage.json',import.meta.url),'utf8'));

test('search by full name or abbreviation displays a single canonical society and finds its programs',()=>{
  const options=societyOptions(coverage.sources);
  assert.ok(options.length>=95);
  for(const query of ['IOP','Institute of Physics']){
    assert.equal(organizationLabel(searchOrganizations(query,options)[0]),'Institute of Physics (IOP)');
  }
  assert.equal(organizationLabel(searchOrganizations('APS',options)[0]),'American Physical Society (APS)');
  assert.equal(resolveOrganization('An Unlisted Society',options),'An Unlisted Society');
  configureSocietyAliases(coverage.sources);
  const record=coverage.opportunities.find(item=>item.id==='coverage:iop-early-career-researchers-fund');
  assert.deepEqual(membershipMatches(record,['Institute of Physics']),['IOP']);
  assert.deepEqual(membershipMatches({affiliation_tags:{societies:['APS']}},['Association for Psychological Science']),[]);
});

test('registry results expose canonical names, aliases and places; an MIT alias matches its internal programs',()=>{
  const results=registryOrganizations({items:[
    {id:'https://ror.org/042nb2s44',status:'active',names:[{value:'Example University',types:['ror_display']},{value:'EU',types:['acronym']}],locations:[{geonames_details:{name:'Example City',country_name:'Canada'}}]},
    {id:'https://ror.org/123',status:'inactive',names:[{value:'Former University',types:['ror_display']}]},
  ]});
  assert.deepEqual(searchOrganizations('EU',results).map(entry=>[entry.name,entry.location]),[['Example University','Example City, Canada']]);
  assert.equal(resolveOrganization('MIT',localInstitutions),'Massachusetts Institute of Technology');
  const rows=[{id:'internal',title:'Internal grant',status:'open',affiliation_tags:{institution:'Massachusetts Institute of Technology'}}];
  assert.equal(selectRecords(rows,normalizeProfile({institutions:['MIT']}),{matchedOnly:true})[0].id,'internal');
});

test('career stage alone can start a search without including opportunities with no known stage fit',()=>{
  const rows=[
    {id:'faculty',title:'Seed grant',status:'open',eligible_stages:['faculty']},
    {id:'resident',title:'Clinical grant',status:'open',eligible_stages:['resident']},
    {id:'unknown',title:'Research funding',status:'open'},
  ];
  assert.deepEqual(selectRecords(rows,normalizeProfile({stage:'resident'}),{matchedOnly:true}).map(o=>o.id),['resident']);
});
