import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{BumperAnimation}from'../mechanism-animation.js';

test('bumper Animate callbacks match the original native event handler through hit, settling and idle frames',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-native-bumper-animation-events.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'72e0f4c8c58f0d12175265f0e0c64b693fce664d3e6121274b151cf0522c8e1c');const f=JSON.parse(bytes);assert.equal(f.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(f.functionIndex,2568);assert.deepEqual(f.errors,[]);assert.equal(f.freeze.before.ms,f.freeze.after.ms);assert.ok(f.rows.every(row=>row.ms===f.freeze.before.ms));
 let calls=0;const model=new BumperAnimation(f.spec,{},()=>calls++);model.update(2000);model.update(2000);calls=0;let hit=false;
 for(const row of f.rows){if(row.kind==='hit-update'&&!hit){model.hit();hit=true;}if(row.delta!==undefined)model.update(row.delta);assert.equal(calls,row.count,'Original event count after '+row.kind+' '+(row.delta??''));}assert.equal(hit,true);assert.equal(calls,6);
});
