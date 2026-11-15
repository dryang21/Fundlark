import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationPath, fundingPriority, selectRecords, normalizeProfile} from '../docs/demo/matching.mjs';
import {cvReview} from '../docs/demo/cv-profile.mjs';

const resident = normalizeProfile({stage:'resident',institutions:['Stanford University'],societies:['AAPM'],
  topics:['radiotherapy','foundation model agents'],appointment:'clinical_resident'});
const grant = {
  id:'therapy-2027',title:'Radiotherapy medical physics resident research seed grant',
  topics:['radiotherapy'],status:'open',last_verified_at:'2026-11-14',
  eligible_stages:['resident'],eligibility_rules:{application_route:'direct',membership_required:['AAPM'],minimum_research_effort_percent:50}
};

test('a stage or topic match alone cannot establish a direct application',()=>{
  const weak={...grant,eligibility_rules:undefined};
  assert.equal(applicationPath(weak,resident).kind,'check');
  assert.match(applicationPath(weak,resident).label,/not verified/);
  assert.equal(applicationPath({...weak,eligible_stages:[]},resident).kind,'check');
});

test('the applicant sees protected effort and membership blockers independently',()=>{
  const unknown=applicationPath(grant,resident);
  assert.equal(unknown.kind,'check');
  assert.match(unknown.checks.join(' '),/50% protected/);
  const insufficient=applicationPath(grant,normalizeProfile({...resident,researchEffortPercent:20}));
  assert.equal(insufficient.kind,'check');
  assert.match(insufficient.blockers.join(' '),/20%/);
  const sufficient=applicationPath(grant,normalizeProfile({...resident,researchEffortPercent:50}));
  assert.equal(sufficient.kind,'direct');
  assert.match(sufficient.label,/verify official rules/);
  const noMembership=applicationPath(grant,normalizeProfile({...resident,societies:[],researchEffortPercent:50}));
  assert.equal(noMembership.kind,'check');
  assert.match(noMembership.checks.join(' '),/AAPM/);
});

test('faculty, years-since-PhD, citizenship and PI rules are unknown unless entered',()=>{
  const call={...grant,eligible_stages:['faculty'],eligibility_rules:{application_route:'direct',pi_privileges_required:true,
    citizenship_required:['us_citizen','us_permanent_resident'],max_years_since_phd:8,eligible_faculty_ranks:['assistant','associate']}};
  assert.equal(applicationPath(call,resident).kind,'ineligible');
  const faculty=normalizeProfile({stage:'faculty',facultyRank:'assistant',yearsSincePhd:2,piPrivileges:true,citizenship:'us_citizen'});
  assert.equal(applicationPath(call,faculty).kind,'direct');
  const undetermined=applicationPath(call,normalizeProfile({stage:'faculty'}));
  assert.equal(undetermined.kind,'check');
  assert.match(undetermined.checks.join(' '),/citizenship|permanent-residence/);
  assert.equal(applicationPath({...call,faculty_sponsor_possible:true},resident).kind,'partner');
});

test('profile validation rejects nonsensical eligibility values',()=>{
  const broken=normalizeProfile({yearsSincePhd:-1,researchEffortPercent:110,facultyRank:'senior',piPrivileges:'true',citizenship:'secret'});
  assert.equal(broken.yearsSincePhd,null);
  assert.equal(broken.researchEffortPercent,null);
  assert.equal(broken.piPrivileges,null);
  assert.equal(broken.facultyRank,'');
  assert.equal(broken.citizenship,'unknown');
});

test('resident program outranks broad imported AI grants with only a keyword match',()=>{
  const generic={id:'imported',title:'Artificial intelligence funding',topics:['radiotherapy'],
    status:'open',origin:'grantsgov_api'};
  const results=selectRecords([generic,grant],resident,{matchedOnly:true});
  assert.equal(results[0].id,'therapy-2027');
  assert.ok(fundingPriority(results[0],resident)>fundingPriority(results[1],resident));
});

test('explicit professional service memberships survive teaching/journal lines',()=>{
  const cv=`EDUCATION & TRAINING
Example University       Example, CA
Department of Radiation Oncology       07/2026-07/2028
Role: CAMPEP Medical Physics Resident
RESEARCH EXPERIENCE
Alignment and Robustness of Foundation Model Agents for Physician-Guided Radiotherapy Planning
Developing agents to safely follow patient-specific clinical preferences.
Fully Automated Treatment Planning with Deep Reinforcement Learning
Foresight Planning via Model Predictive Control
CLINICAL EXPERIENCE
Independently generated treatment plans.
PROFESSIONAL SERVICE & AFFILIATIONS
1. Teaching Assistant for medical physics
2. Reviewer for journals: Medical Physics, Scientific Reports
Journal of Applied Clinical Medical Physics
3. Reviewer for conferences/workshops: AI for Science
4. American Association of Physicists in Medicine (AAPM) Student Member
5. American College of Radiology (ACR) Student Member
6. American Society for Radiation Oncology (ASTRO) Student Member
7. SIGMA XI Associate Member
LEADERSHIP & VOLUNTEER EXPERIENCE`;
  const {result}=cvReview(cv,[],[],new Date('2026-11-14T12:00:00Z'));
  assert.equal(result.stage,'resident');
  assert.deepEqual(result.societies,['AAPM','ACR','ASTRO','Sigma Xi']);
  assert.deepEqual(result.institutions,['Example University']);
  assert.ok(result.topics.includes('foundation model agents'));
  assert.ok(result.topics.includes('reinforcement learning'));
  assert.ok(result.topics.includes('model predictive control'));
  assert.ok(!result.topics.includes('department'));
});
