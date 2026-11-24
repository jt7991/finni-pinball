import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from 'node:zlib';
import{flipperSin,flipperCos}from '../flipper-float-math.js';
test('flipper sine/cosine retain every original compiled Float32 result across the stroke domain',()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-flipper-trig-native.json.gz',import.meta.url))));
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.functions,{sin:18857,cos:18714});
 assert.deepEqual(fixture.functionSHA256,{'18714':'9584d95e98b71d8b96afe3e0487bbc145d448dac93efcd3364dcbd5828f718e3','18857':'9e5297c94136b2d5bf1437aa26b33edfa36c1bc8a640d7da084c168c8fd30ba0'});
 assert.equal(fixture.cases.length,18247);
 for(const [angle,sine,cosine]of fixture.cases){assert.equal(flipperSin(angle),sine,'sinf '+angle);assert.equal(flipperCos(angle),cosine,'cosf '+angle);}
 const angle=2.026184320449829;assert.notEqual(flipperSin(angle),Math.fround(Math.sin(angle)),'independently observed contact-normal rounding difference');
 assert.ok(Object.is(flipperSin(-0),-0));
 const layout=JSON.parse(fs.readFileSync(new URL('../public/layout.json',import.meta.url)));
 for(const flipper of layout.items.filter(item=>item.kind==='Flipper'))for(const angle of [flipper.start_angle,flipper.end_angle]){const radians=Math.fround(angle*Math.fround(Math.PI/180));assert.ok(Number.isFinite(flipperSin(radians)));assert.ok(Number.isFinite(flipperCos(radians)));}
});
