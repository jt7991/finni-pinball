import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';
test('ordinary native launch, flippers and nudge retain all 10000 physical boundaries and 64 prepared/submitted frames',async()=>{
 const bytes=gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-launched-controls-state-native.json.gz',import.meta.url)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'607cd21e81a1df7c6de4363dada3ed2a1b3016f51fa116332f5ab298c7783161');
 const fixture=JSON.parse(bytes);assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});assert.deepEqual(fixture.errors,[]);
 assert.deepEqual(fixture.frames.map(row=>row.frameIndex),Array.from({length:64},(_,i)=>i+1));assert.equal(fixture.startup.boundaries.length,10000);assert.deepEqual(fixture.startup.errors,[]);
 assert.deepEqual(fixture.actions.map(row=>[row.code,row.down]),[['ShiftLeft',true],['ShiftRight',true],['Enter',true],['Enter',false],['KeyX',true],['KeyX',false],['ShiftLeft',false],['ShiftRight',false]]);
 assert.deepEqual(await compareNativeHistoryState(fixture),{framesChecked:64,intervalsChecked:10000,ticks:10230,randomizeClockSamples:2,timerClockSamples:4});
});
