import test from 'node:test';
import assert from 'node:assert/strict';
import {paginateRecords,pageSequence,PAGE_SIZE} from '../docs/demo/pagination.mjs';
const data=Array.from({length:47},(_,i)=>({id:i+1}));

test('pages show disjoint stable slices, all records reachable with no duplicates',()=>{
  const seen=[];
  for(let p=1;p<=5;p++){
    const res=paginateRecords(data,p);
    seen.push(...res.items.map(x=>x.id));
    assert.equal(res.page,p);
    assert.equal(res.first,1+(p-1)*10);
    assert.equal(res.last,Math.min(47,p*10));
    assert.equal(res.totalPages,5);
  }
  assert.deepEqual(seen,data.map(x=>x.id));
});
test('pagination clamps out-of-range pages after filtering, and handles empty',()=>{
  assert.deepEqual(paginateRecords(data,999).items.map(x=>x.id),[41,42,43,44,45,46,47]);
  assert.equal(paginateRecords(data,-100).page,1);
  const empty=paginateRecords([],2);
  assert.equal(empty.count,0);assert.equal(empty.first,0);assert.equal(empty.last,0);assert.equal(empty.page,1);assert.equal(empty.totalPages,1);
});
test('page size remains fixed at 10 and malformed page input is safe',()=>{
  assert.equal(PAGE_SIZE,10);
  assert.equal(paginateRecords(data,2).items.length,10);
  assert.equal(paginateRecords(data,5).items.length,7);
  assert.equal(paginateRecords(data,Infinity).page,1);
});
test('page navigation is compact and includes current and endpoints',()=>{
  assert.deepEqual(pageSequence(1,3),[1,2,3]);
  assert.deepEqual(pageSequence(1,30),[1,2,null,29,30]);
  assert.deepEqual(pageSequence(15,30),[1,2,null,14,15,16,null,29,30]);
  assert.deepEqual(pageSequence(29,30),[1,2,null,28,29,30]);
});
