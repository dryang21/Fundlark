import test from 'node:test';
import assert from 'node:assert/strict';
import {readLibrary,mergeLibrary,trackerBackup} from '../docs/demo/personal-library.mjs';
import {restoreShortlist} from '../docs/demo/matching.mjs';
const record={title:'Synthetic Research Award',funder:'Example University',url:'https://example.edu/official-award',round:'2027',
  deadline:'2027-01-02',status:'open',last_verified_at:'2026-11-14'};
const library=r=>readLibrary({schema_version:1,kind:'fundlark-library',entries:[r]});
test('refresh uses the same round after a headline and deadline change, retaining private tracker state',()=>{
  const first=mergeLibrary([],library({...record,note:'Untrusted injected note'})).entries;
  assert.equal(first[0].note,'');
  first[0]={...first[0],note:'Talk to mentor',state:'Preparing',targetDate:'2026-12-20'};
  const result=mergeLibrary(first,library({...record,title:'Updated Research Award',deadline:'2026-12-28',last_verified_at:'2026-11-15',url:record.url+'?utm_source=example'}));
  assert.equal(result.counts.updated,1);
  assert.equal(result.entries.length,1);
  const [item]=restoreShortlist([record],result.entries);
  assert.equal(item.deadline,'2026-12-28');
  assert.equal(result.entries[0].note,'Talk to mentor');
  assert.equal(result.entries[0].state,'Preparing');
  assert.equal(result.entries[0].targetDate,'2026-12-20');
  assert.equal(mergeLibrary(result.entries,library(record)).counts.stale,1);
  assert.equal(mergeLibrary(result.entries,library({...record,round:'2028'})).counts.added,1);
  const backup=readLibrary(trackerBackup(result.entries));
  assert.equal(mergeLibrary([],backup).entries[0].note,'Talk to mentor');
});
test('declines unsafe links and treats unchecked application statuses as unconfirmed',()=>{
  assert.throws(()=>library({...record,url:'javascript:alert(1)'}),/HTTPS/);
  assert.equal(library({...record,last_verified_at:'2026-02-30'})[0].record.status,'verify');
});
