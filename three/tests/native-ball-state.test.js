import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{compareNativeBallState}from'../../scripts/compare-native-ball-state.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('native creation, individual Ball setters and ejection retain every stored and public Float32 word',async()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-ball-state-native.json.gz',import.meta.url));assert.equal(sha(bytes),'d2673b994b90aacdd882ed68695e9971c3905eb2bd556c5f107136211c2e5451');const fixture=JSON.parse(gunzipSync(bytes));
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.equal(fixture.reference.sourceSha256,fixture.reference.controlledSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 assert.equal(fixture.probeSHA256,sha(fs.readFileSync(new URL('../../scripts/probe-native-ball-state.mjs',import.meta.url))));assert.equal(fixture.scenarioSHA256,sha(fs.readFileSync(new URL('../../scripts/ball-state-scenarios.mjs',import.meta.url))));assert.deepEqual(fixture.errors,[]);assert.equal(fixture.observerMemoryWrites,0);
 const result=await compareNativeBallState(fixture);assert.deepEqual(result,{framesChecked:87,intervalsChecked:1849,ticks:1850,randomizeClockSamples:2,timerClockSamples:0,componentResult:{cases:27,stagesChecked:351}});
});
