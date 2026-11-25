import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createHash}from'node:crypto';
import{nativeBallHit,collideNativeBalls}from'../native-ball-collision.js';
import{nativeBallAllocationInputs,installNativeBallAllocationInputs}from'../../scripts/native-ball-allocation-inputs.mjs';
const vector=values=>Object.fromEntries(['x','y','z'].map((key,i)=>[key,values[i]]));

test('both reciprocal collision selections match the original compiled HitBall with reversed allocation addresses',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-main-6f8116d-ball-allocation-order.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'77d3a138a1c1b895cd6f29b5879c4068aef020ec7d4751905627dc995def1e6d');
 const fixture=JSON.parse(bytes);assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.deepEqual(fixture.errors,[]);
 assert.deepEqual(fixture.abi,{vtable:1434700,hitTest:4455,collide:4456,ballState:128,collision:72,normal:88});assert.notDeepEqual(fixture.rows[0].outputs,fixture.rows[1].outputs,'The original algorithm itself depends on allocation order');
 for(const row of fixture.rows){
  const balls=fixture.inputs.map((input,i)=>{let value={p:vector(input.p),v:vector(input.v),m:{x:0,y:0,z:0},mass:1};return{order:row.addresses[i],snapshot:()=>structuredClone(value),commit:state=>{value=state;}};});
  const hits=fixture.inputs.map((input,i)=>nativeBallHit({p:vector(input.p),v:vector(input.v),r:25},{p:vector(fixture.inputs[1-i].p),v:vector(fixture.inputs[1-i].v)},.25,.001));
  hits.forEach((hit,i)=>{assert.equal(Math.fround(hit.time*100),row.queries[i].time);assert.equal(Math.fround(hit.gap*100),row.queries[i].gap);assert.deepEqual([hit.normal.x,-hit.normal.y,hit.normal.z],row.queries[i].normal);});
  balls.forEach((ball,i)=>{const s=ball.snapshot(),dt=row.queries[0].time;for(const key of ['x','y','z'])s.p[key]=Math.fround(s.p[key]+Math.fround(s.v[key]*dt));ball.commit(s);ball.collisionGap=row.queries[i].gap;});
  const resolved=balls.map((ball,i)=>collideNativeBalls(ball,balls[1-i],hits[i],false,row.swapped,()=>{}));assert.equal(resolved.filter(Boolean).length,1,'One reciprocal event resolves the pair');
  assert.deepEqual(balls.map(ball=>{const s=ball.snapshot();return{p:Object.values(s.p),v:Object.values(s.v)};}),row.outputs);
 }
});

test('allocation replay inputs contain only identity and reject a changed identity or another source',()=>{
 const ball={id:3,address:65536};for(const key of ['position','velocity','momentum','orientation','locked'])Object.defineProperty(ball,key,{get:()=>{throw Error('Physical outcomes cannot be read as allocation inputs');}});
 const fixture={engineSHA256:'engine',reference:{sourceSha256:'table'},startup:{records:[{balls:[ball]}],boundaries:[{balls:[ball]}]}};
 const inputs=nativeBallAllocationInputs(fixture);assert.deepEqual(inputs.identities,[{id:3,address:65536}]);
 assert.throws(()=>nativeBallAllocationInputs({...fixture,startup:{records:[{balls:[ball]}],boundaries:[{balls:[{id:3,address:65540}]}]}}),/identity stays fixed/);
 assert.throws(()=>installNativeBallAllocationInputs({},fixture,{...inputs,sourceTableSHA256:'another-table'}));
});
