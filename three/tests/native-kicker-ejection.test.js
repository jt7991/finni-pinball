import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {compareKickerEjection} from '../../scripts/compare-kicker-ejection.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('all 72 native public ejections preserve Float32 bits and RNG after independently replaying original startup',async()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-kicker-ejection-native.json.gz',import.meta.url));assert.equal(sha(bytes),'18adfbeaf131e96ba26fbca4e60c16412afe70239552d32aef23aed72f91282e');
 const fixture=JSON.parse(gunzipSync(bytes));
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(fixture.reference.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.equal(fixture.reference.sourceSha256,fixture.reference.controlledSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 assert.equal(fixture.probeSHA256,sha(fs.readFileSync(new URL('../../scripts/probe-native-kicker-ejection.mjs',import.meta.url))));assert.equal(fixture.scenarioSHA256,sha(fs.readFileSync(new URL('../../scripts/kicker-ejection-scenarios.mjs',import.meta.url))));
 assert.equal(fixture.rows.length,72);
 const result=await compareKickerEjection(fixture);
 assert.deepEqual(result,{framesChecked:106,intervalsChecked:2297,ticks:2298,randomizeClockSamples:2,timerClockSamples:0,componentResult:{cases:72}});
});
