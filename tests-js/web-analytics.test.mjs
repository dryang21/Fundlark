import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const loader=readFileSync(new URL('../docs/demo/analytics.js',import.meta.url),'utf8');
const host='https://dryang21.github.io';
function load(url,{referrer='',navigator={}}={}){
  const beacons=[];
  const document={
    referrer,currentScript:{dataset:{siteToken:'public-test-identifier'}},
    createElement:()=>({dataset:{}}),
    head:{append:beacon=>beacons.push(beacon)},
  };
  runInNewContext(loader,{window:{location:new URL(url)},document,navigator,URL});
  return beacons;
}

test('the public demo counts a standard referral without sending application data',()=>{
  const [beacon]=load(host+'/Fundlark/#dashboard',{referrer:'https://www.linkedin.com/'});
  assert.equal(beacon.src,'https://static.cloudflareinsights.com/beacon.min.js');
  assert.deepEqual(JSON.parse(beacon.dataset.cfBeacon),{token:'public-test-identifier',spa:false});
});

test('analytics skips search URLs, private fragments, opted-out browsers, and other hosts',()=>{
  assert.deepEqual(load(host+'/Fundlark/?q=unpublished+idea'),[]);
  assert.deepEqual(load(host+'/Fundlark/#private-notes'),[]);
  assert.deepEqual(load(host+'/Fundlark/',{referrer:host+'/Fundlark/?q=private'}),[]);
  assert.deepEqual(load(host+'/Fundlark/',{navigator:{globalPrivacyControl:true}}),[]);
  assert.deepEqual(load(host+'/Fundlark/',{navigator:{doNotTrack:'1'}}),[]);
  assert.deepEqual(load(host+'/OtherProject/'),[]);
  assert.deepEqual(load('http://localhost:8059/Fundlark/'),[]);
});
