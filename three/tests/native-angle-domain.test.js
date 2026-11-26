import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {nativeAngleSin,nativeAngleCos} from '../native-angle-math.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('full Float32 angle domain and reduction boundaries retain original compiled sine/cosine bits',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-angle-domain-native.json.gz',import.meta.url));assert.equal(sha(bytes),'32541b090390865922fc12e3b1380ab4bf2513c552695194fe545d272f801cb7');
 const fixture=JSON.parse(gunzipSync(bytes));assert.equal(fixture.cases.length,20033);
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.functions,{sin:18857,cos:18714});
 assert.deepEqual(fixture.functionSHA256,{'18714':'9584d95e98b71d8b96afe3e0487bbc145d448dac93efcd3364dcbd5828f718e3','18857':'9e5297c94136b2d5bf1437aa26b33edfa36c1bc8a640d7da084c168c8fd30ba0'});
 assert.equal(fixture.generatorSHA256,sha(fs.readFileSync(new URL('../../scripts/capture-native-angle-domain.mjs',import.meta.url))));assert.equal(fixture.harnessSHA256,sha(fs.readFileSync(new URL('../../scripts/native-trig-compiled-harness.mjs',import.meta.url))));
 const words=new Uint32Array(1),floats=new Float32Array(words.buffer),bits=x=>{floats[0]=x;return words[0];};
 for(const [input,sine,cosine]of fixture.cases){words[0]=input;const angle=floats[0];assert.equal(bits(nativeAngleSin(angle)),sine,'sine input bits '+input);assert.equal(bits(nativeAngleCos(angle)),cosine,'cosine input bits '+input);}
 for(const angle of [Infinity,-Infinity,NaN]){assert.ok(Number.isNaN(nativeAngleSin(angle)));assert.ok(Number.isNaN(nativeAngleCos(angle)));}
});
