import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBulkArchive} from '../docs/demo/bulk-archive.mjs';
import {exploreFunding} from '../docs/demo/workspace.mjs';

const read=name=>JSON.parse(readFileSync(new URL(`../docs/demo/${name}`,import.meta.url),'utf8'));
test('bulk inventory keeps more than 10,000 searchable past rounds out of current search',()=>{
  const manifest=read('bulk-calls.json'), raw=read('bulk-archive.json');
  const archive=readBulkArchive(raw,manifest.archive_revision,manifest.archive_count);
  assert.ok(archive.length>10000);
  assert.equal(new Set([...archive,...manifest.opportunities].map(r=>r.url)).size,archive.length+manifest.opportunities.length);
  const example=archive.find(record=>record.opportunity_number?.includes('-'));
  assert.ok(example);
  const found=exploreFunding(archive,{description:example.opportunity_number,availability:'closed'});
  assert.ok(found.some(record=>record.id===example.id&&record.url.startsWith('https://www.grants.gov/search-results-detail/')));
  assert.equal(exploreFunding(archive,{availability:'active'}).length,0);
  assert.ok(manifest.opportunities.every(record=>record.review_needed&&record.status!=='closed'));
  assert.throws(()=>readBulkArchive(raw,'stale',archive.length),/does not match/);
});
