import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{nativeBallHit,collideNativeBalls}from'../native-ball-collision.js';
const vector=a=>Object.fromEntries(['x','y','z'].map((axis,i)=>[axis,a[i]])),f=Math.fround;
const fixtures=[['r1','155a2f75de0275a1204c8b9cf920cd93382efd9d507bd472704dad90bb3d210a'],['r2','1748f02d8b01cddb1d9d698459f11885fe8feef76a56311349c7d0e4a304791a']];
for(const[name,expectedSHA]of fixtures)test('normally created native balls retain both allocation-dependent collision results: '+name,()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-native-live-ball-identity-'+name+'.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),expectedSHA);const fixture=JSON.parse(bytes);
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(fixture.reference.sourceSha256,fixture.reference.controlledSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});assert.deepEqual(fixture.errors,[]);assert.equal(fixture.observerMemoryWrites,0);assert.equal(fixture.initial.ms,fixture.after.ms);assert.equal(fixture.rows.length,12);
 assert.equal(fixture.after.balls.length,fixture.initial.balls.length+24,'every component ball was normally created and stays live');
 for(const ball of fixture.initial.balls)assert.deepEqual(fixture.after.balls.find(b=>b.id===ball.id),ball,'unrelated native bodies are untouched');
 assert.deepEqual([...new Set(fixture.rows.map(r=>Math.sign(r.addresses[0]-r.addresses[1])))].sort(),[-1,1]);assert.equal(new Set(fixture.rows.map(r=>JSON.stringify(r.outputs))).size,2,'identical declared input states produce two actual native results');
 assert.equal(new Set(fixture.rows.map(r=>r.swapped)).size,1,'the native reciprocal-event direction is constant throughout each paused experiment');
 assert.equal(new Set(fixture.rows.map(r=>JSON.stringify(r.queries))).size,1,'every original time, gap and normal query starts from the same physical input');
 const identities=new Set();
 for(const row of fixture.rows){
  assert.ok(row.ids[0]<row.ids[1],'native creation order remains the same for both address selections');for(const address of row.addresses){assert.ok(!identities.has(address),'all created native objects coexist without address reuse');identities.add(address);}
  const hits=fixture.inputs.map((input,i)=>nativeBallHit({p:vector(input.p),v:vector(input.v),r:25},{p:vector(fixture.inputs[1-i].p),v:vector(fixture.inputs[1-i].v)},.25,.001));
  for(const [i,hit]of hits.entries()){assert.equal(f(hit.time*100),row.queries[i].time);assert.equal(f(hit.gap*100),row.queries[i].gap);assert.deepEqual([hit.normal.x,-hit.normal.y,hit.normal.z],row.queries[i].normal);}
  // Absolute native addresses and their monotone ranks must choose the same
  // original reciprocal event. Neither run restores a physical output.
  for(const orders of[row.addresses,row.addresses.map(address=>row.addresses.filter(a=>a<address).length)]){
   const time=f(hits[0].time*100),balls=fixture.inputs.map((input,i)=>{let state={p:vector(input.p.map((p,j)=>f(p+f(input.v[j]*time)))),v:vector(input.v),m:{x:0,y:0,z:0},mass:1};return{order:orders[i],collisionGap:f(hits[i].gap*100),snapshot:()=>structuredClone(state),commit:value=>{state=value;}};}),states=()=>balls.map(b=>{const s=b.snapshot();return{p:Object.values(s.p),v:Object.values(s.v)};});
   assert.deepEqual(states(),row.stages[0]);let impacts=0,resolved=0;
   for(const [i,ball]of balls.entries()){resolved+=Number(collideNativeBalls(ball,balls[1-i],hits[i],false,row.swapped,()=>impacts++));assert.deepEqual(states(),row.stages[i+1],'every original native collision stage remains exact');}
   assert.equal(resolved,1);assert.equal(impacts,1);assert.deepEqual(states(),row.outputs);
  }
 }
});
