import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';
import{unpackNativeHistoryState}from '../../scripts/native-history-state-package.mjs';
import{compareNativeHistoryState}from '../../scripts/compare-native-history-state.mjs';
test('mission 3 regenerates every native body and flipper through coupled tip/floor contact from initialization',async()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-mission3-tip-contact-native.json.gz',import.meta.url))));
 assert.equal(packet.sourceSHA256,'a1f078c3e53f2cb1a4b18c3b770b4ef2a5ad3b89f591565230f8862b34fe469c');
 const fixture=unpackNativeHistoryState(packet);
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 for(const observer of [fixture,fixture.startup,fixture.clock,fixture.timers,fixture.flipperMotion])assert.deepEqual(observer.errors,[]);
 assert.equal(fixture.missionController.mission,3);assert.equal(fixture.actions.filter(row=>row.kind==='approach').length,1);assert.ok(fixture.scenarioLog.some(line=>/RENDER_MODE[|][0-9]+[|]3[|]/.test(line)));
 const contact=fixture.startup.boundaries.find(row=>row.ms===9561);assert.equal(contact.balls[3].velocity[0],-0.4822157621383667);
 // Qualification and one scoop approach are declared external scenario
 // inputs. All later physics, rule callbacks and RNG remain regenerated;
 // no recorded body or random state is restored or used for correction.
 assert.deepEqual(await compareNativeHistoryState(fixture),{framesChecked:64,intervalsChecked:13458,ticks:13459,randomizeClockSamples:2,timerClockSamples:5});
});
