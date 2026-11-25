import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createFullGame} from '../full-game.js';

const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
const bytes=fs.readFileSync(new URL('fixtures/vpx-native-control-release.json.gz',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'c8c87a4163091f14ae3f91b1db9144e6ca6df1985ba9c9808a5fbf2bcc076e47');
const native=JSON.parse(gunzipSync(bytes)).observation;
const assets=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name+'.json',import.meta.url)));
const step=(game,ticks)=>{for(let i=0;i<ticks;i++)game.step();};
const rod=game=>Object.fromEntries(['pos','speed','pullForce','fireTimer','fireSpeed','fireBounce','reverseImpulse','travelLimit'].map(key=>[key,game.plunger[key]]));
async function game(){return createFullGame(assets('layout'),assets('objects'),source,()=>{},undefined,{scriptRandomClock:()=>1234567890,scriptTimerSeconds:()=>123.5});}

test('original native main-player blur fires the held plunger without advancing physics or moving its position',()=>{
  assert.equal(native.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(native.reference.sourceCommit,'6f8116d0964429db0e2da41d583566784114fc5f');assert.equal(native.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(native.reference.controlledSha256,native.reference.sourceSha256);assert.deepEqual(native.reference.controlledOverrides,{});assert.deepEqual(native.errors,[]);
  const {before,released,repeated}=native.rows;assert.ok(before.rod.pullForce>0);assert.equal(released.rod.pullForce,0);assert.equal(released.rod.fireTimer,200);assert.ok(released.rod.fireSpeed<0);assert.equal(released.rod.pos,before.rod.pos);assert.equal(released.state.ms,before.state.ms);assert.deepEqual(repeated.rod,released.rod);
});

test('UI release retains the main player’s authored plunger key-up instead of cancelling its stroke',async()=>{
  const a=await game(),b=await game();
  try{
    for(const g of[a,b]){g.start();step(g,2100);g.input('left',true);g.input('launch',true);step(g,500);}
    a.release();
    // Main's send() emits only changes from its applied set, in action order.
    // Its native Table1_KeyUp handler calls Plunger.Fire and its sound event.
    b.input('left',false);b.input('launch',false);
    assert.deepEqual(rod(a),rod(b));assert.equal(a.held.left,false);assert.equal(a.held.launch,false);
    assert.equal(a.plunger.fireTimer,native.rows.released.rod.fireTimer);
    for(let i=0;i<250;i++){step(a,1);step(b,1);assert.deepEqual(rod(a),rod(b),'authored rod motion at '+i);}
  }finally{a.dispose();b.dispose();}
});

test('UI release without a held launch key preserves a mechanical stroke already in flight',async()=>{
  const g=await game();
  try{
    g.start();step(g,2100);g.input('launch',true);step(g,500);g.input('launch',false);step(g,10);
    assert.equal(g.held.launch,false);assert.ok(g.plunger.fireTimer>0);const before=rod(g);
    g.release();assert.deepEqual(rod(g),before,'main sends no additional plunger event when no key is held');
  }finally{g.dispose();}
});
