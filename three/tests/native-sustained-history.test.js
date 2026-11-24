import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';
import {unpackNativeHistoryState} from '../../scripts/native-history-state-package.mjs';

for(const [name,hash,frames,ticks,timerSamples,contacts]of [
 ['mixed-history','9688d678bfed33bf1674e69adc5daaf494bbc376baa9400729ea2d460151622e',3559,60007,14,23],
 ['flipper-motion','e23526efff81add65ae9cb92f7cf8a2f546f2bf578a3e1291a0ef67730acd8c3',1761,30005,11,3],
])test('uninterrupted native sustained '+name+' retains every physical boundary and prepared/submitted state',async()=>{
 const packaged=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-sustained-'+name+'-native.json.gz',import.meta.url))));
 assert.equal(packaged.sourceSHA256,hash);
 const fixture=unpackNativeHistoryState(packaged),contactAudit=[];
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);
 assert.deepEqual(fixture.reference.controlledOverrides,{});
 assert.deepEqual(fixture.errors,[]);assert.deepEqual(fixture.browserErrors,[]);
 for(const key of ['clock','timers','startup','randomizeClocks'])assert.deepEqual(fixture[key].errors,[]);
 assert.deepEqual(fixture.frames.map(row=>row.frameIndex),Array.from({length:frames},(_,i)=>i+1));
 assert.ok(fixture.actions.filter(row=>row.code==='Enter'&&!row.down).length>=1);
 assert.ok(fixture.actions.some(row=>row.code==='KeyX'));
 if(name==='flipper-motion'){assert.deepEqual(fixture.flipperMotion.errors,[]);assert.ok(fixture.frames.every(row=>row.snapshot.flippers.length===2));}
 // Source initialization, recorded UI/clock inputs and the production game
 // produce every body/RNG expectation. No native state is restored here.
 assert.deepEqual(await compareNativeHistoryState(fixture,{contactAudit}),{framesChecked:frames,intervalsChecked:ticks,ticks,randomizeClockSamples:2,timerClockSamples:timerSamples});
 assert.equal(contactAudit.length,contacts);assert.ok(contactAudit.some(row=>row.name==='leftFlipper'));assert.ok(contactAudit.some(row=>row.name==='rightFlipper'));
 if(name==='mixed-history')assert.ok(fixture.playerInputs.filter(row=>row.uiState).length>200,'ordinary player score/ball/plunger polls also retain their native state');
});
