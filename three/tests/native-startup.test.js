import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import{gunzipSync}from 'node:zlib';
import{createFullGame}from '../full-game.js';import{NATIVE_INITIAL_RANDOM_STATE,runtimeNativeRandom}from '../native-random.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-startup-2000-native.json.gz',import.meta.url))));
// Native JSON transport does not distinguish signed zero. All other finite
// values remain exact, with no tolerance or pose adjustment.
const jsonZeros=values=>values.map(value=>value===0?0:value);
const states=game=>game.physicalRecords.map(record=>{const native=game.nativeBall(record.body),state=native.snapshot();return{id:record.proxy.getProperty('ID').value,position:jsonZeros(Object.values(state.p)),velocity:jsonZeros(Object.values(state.v)),momentum:jsonZeros(Object.values(state.m)),orientation:jsonZeros([...native.orientation.matrix]),locked:!!record.held};});
const observed=rows=>rows.map(({id,position,velocity,momentum,orientation,locked})=>({id,position,velocity,momentum,orientation,locked}));
test('the original compiled initializer and zero-ms first step reproduce native startup without snapshot restoration',async()=>{
 assert.equal(fixture.initializer.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.initializer.bytes,'0500d3e9e1af9538');assert.deepEqual(NATIVE_INITIAL_RANDOM_STATE,fixture.initializer.words);assert.deepEqual(runtimeNativeRandom().getState(),fixture.initializer.words);
 const game=await createFullGame(JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url))),JSON.parse(fs.readFileSync(new URL('../public/objects.json',import.meta.url))),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
 try{
  assert.equal(game.time,0);assert.equal(game.random.calls,2);const beforeRelease=game.random.getState();game.release();assert.deepEqual(game.random.getState(),beforeRelease,'initial focus cleanup does not invent unpressed flipper releases or sound RNG draws');
  game.start();assert.equal(game.time,0);assert.equal(game.random.calls,4);assert.deepEqual(game.random.getState(),fixture.beforePhysics.random);assert.deepEqual(states(game),observed(fixture.beforePhysics.balls));
  game.release();assert.deepEqual(game.random.getState(),fixture.beforePhysics.random,'unpressed flippers also produce no release sounds while a game is active');
  assert.equal(fixture.observed.boundaries.length,2000);
  for(const row of fixture.observed.boundaries){game.step();assert.equal(Math.round(game.time*1000),row.ms-1,'the first physical interval is processed at native GameTime0');assert.deepEqual(states(game),observed(row.balls),'every native body at boundary '+row.ms);assert.deepEqual(game.random.getState(),row.random,'native random progression at boundary '+row.ms);}
  assert.equal(game.physicalRecords.length,4);assert.equal(game.records.length,1);assert.equal(game.physicsStats.substepBudgetExceeded,0);
 }finally{game.dispose();}
});
