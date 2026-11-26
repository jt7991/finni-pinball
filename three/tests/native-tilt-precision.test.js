import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{TiltBob}from'../tilt-bob.js';import{CabinetNudge}from'../cabinet-nudge.js';import{tiltPrecisionScenarios}from'../../scripts/tilt-precision-scenarios.mjs';
const bytes=fs.readFileSync(new URL('fixtures/vpx-native-tilt-precision.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes)),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(bytes),'9d666644d41d55b67b8b679c9e57c5304168d286388ac0b7ad9c87dd4a162d05');
assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.metadata.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.equal(fixture.metadata.controlledSha256,fixture.metadata.sourceSha256);assert.deepEqual(fixture.metadata.controlledOverrides,{});assert.deepEqual(fixture.errors,[]);
assert.equal(fixture.sourceScriptSHA256,sha(fs.readFileSync(new URL('../public/rules.vbs',import.meta.url))));assert.equal(fixture.scenarioSHA256,sha(fs.readFileSync(new URL('../../scripts/tilt-precision-scenarios.mjs',import.meta.url))));assert.equal(fixture.probeSHA256,sha(fs.readFileSync(new URL('../../scripts/probe-native-tilt-precision.mjs',import.meta.url))));
assert.deepEqual(fixture.cases.map(c=>({name:c.name,inputs:c.inputs})),tiltPrecisionScenarios);
for(const scenario of fixture.cases)test('native tilt clamp retains every public reading and key transition: '+scenario.name,()=>{
 let ms=0;const keys=[],cabinet=new CabinetNudge(),bob=new TiltBob(down=>keys.push([ms,Number(down)]));assert.equal(scenario.rows.length,1501);assert.deepEqual(scenario.deliveredInputs,scenario.inputs);
 for(const [index,row]of scenario.rows.entries()){
  ms=row[0];assert.equal(ms,index);
  // The original public FormatNumber transport does not expose zero sign.
  const actual=[bob.position.x,bob.position.y,bob.percent].map(value=>value===0?0:value),expected=row.slice(1).map(value=>Math.fround(value)||0);
  assert.deepEqual(actual,expected,'native public pendulum at '+ms+'ms');
  if(ms===1500)break;
  for(const [at,angle,force]of scenario.inputs)if(at===ms)cabinet.nudge(angle,force);
  cabinet.step(Math.PI/30);bob.step(cabinet.acceleration);
 }
 assert.deepEqual(keys,scenario.keys,'native mechanical key event clocks');
});
