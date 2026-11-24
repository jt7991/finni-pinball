import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';
import{unpackNativeHistoryState}from '../../scripts/native-history-state-package.mjs';
import{compareNativeHistoryState}from '../../scripts/compare-native-history-state.mjs';

test('near-simultaneous native flipper stops rebound before the remaining substep, retaining all 128 frame states',async()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-simultaneous-flipper-stops-native.json.gz',import.meta.url))));
 assert.equal(packet.sourceSHA256,'d128817d0554a45cda4537b1dfd5b351b7f688cad79365c759d862aff2d6fd30');
 const fixture=unpackNativeHistoryState(packet),contacts=[];
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.flipperMotion.errors,[]);
 const boundary=fixture.startup.boundaries.find(row=>row.ms===18361),right=boundary.flippers.find(row=>row.name==='right');
 assert.equal(right.angle,5.093563079833984);assert.equal(right.momentum,-132.15127563476562);assert.equal(right.speed,-0.030134623870253563);
 assert.equal(fixture.startup.boundaries.length,20346);assert.equal(fixture.frames.length,128);
 // The full initialization, every recorded body/flipper/RNG observation and
 // both prepared/submitted states are regenerated. Native state is never
 // restored to reach the nearly coincident stops at 18.361 seconds.
 assert.deepEqual(await compareNativeHistoryState(fixture,{contactAudit:contacts}),{framesChecked:128,intervalsChecked:20346,ticks:20347,randomizeClockSamples:2,timerClockSamples:9});
 assert.deepEqual(contacts.map(row=>[row.ms,row.name]),[[5506,'leftFlipper'],[6816,'rightFlipper'],[11367,'rightFlipper']]);
});
