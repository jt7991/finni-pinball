import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';
import{nativeFlipperHit}from '../native-flipper-contact.js';
test('flipper tip contact preserves original compiled velocity rounding across nearby positions and speeds',()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-flipper-hit-order-native.json.gz',import.meta.url))));
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.functions,{hit:4464,face:4465});
 assert.deepEqual(fixture.functionSHA256,{'4464':'251d816cfacecbfddd9542e2c9377c79dd29f6dd4c8f1019f29b40cd6474211b','4465':'41d18a43450c7f437e32010f0335dca5e9adb6ec70f37ae68acebd7ab0d10a49'});
 assert.equal(fixture.cases.length,126);assert.equal(fixture.cases.filter(row=>row.expected?.contact).length,17);assert.equal(fixture.cases[0].expected.vn,-0.019361644983291626);
 for(const [i,{input,expected}]of fixture.cases.entries()){
  const hit=nativeFlipperHit({translation:()=>input.position,linvel:()=>input.velocity},structuredClone(input.flipper),input.radius,input.duration);
  const actual=hit?{time:hit.time,gap:hit.gap,normal:hit.normal,contact:hit.contact,hitMomentBit:hit.profile.hitMomentBit,...hit.contact?{vn:hit.vn}:{}}:null;
  assert.deepEqual(actual,expected,'Original HitFlipper case '+i);
 }
});
