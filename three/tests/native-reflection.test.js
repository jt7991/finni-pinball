import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {computeNativeCamera} from '../native-camera.js';import {nativePrimitiveMatrices} from '../primitive-transform.js';import {nativeReflectionCamera,nativeMirrorNormalFactor,nativeProbeArea,nativeProbeScissor} from '../native-reflection.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-reflection-native.json.gz',import.meta.url)))),bounds=JSON.parse(fs.readFileSync(new URL('../public/camera-bounds.json',import.meta.url)));
test('reflection camera and all reflected primitive packet fields match independent native GPU uploads',()=>{
  assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.samples.length,116);assert.deepEqual(fixture.excluded,['Screw013','Screw018']);
  const camera=nativeReflectionCamera(computeNativeCamera(bounds,fixture.viewport.width/fixture.viewport.height,fixture.preset),fixture.probe.plane);
  for(const sample of fixture.samples){const actual=nativePrimitiveMatrices(sample.spec,sample.pose,camera);assert.deepEqual(Array.from(new Uint32Array(actual.buffer)),sample.matrixBits,sample.spec.name);}
});
test('playfield mirror normal and authored byte-decoded strength match native GPU values',()=>{
  const camera=computeNativeCamera(bounds,fixture.viewport.width/fixture.viewport.height,fixture.preset),world=new Float32Array(new Uint32Array(fixture.playfield.worldBits).buffer),actual=nativeMirrorNormalFactor(world,camera,fixture.probe.plane,fixture.strength);
  assert.deepEqual(Array.from(new Uint32Array(actual.buffer)),fixture.playfield.mirrorBits);
});

test('projected local playfield bounds match independent native reflection scissor',()=>{
  const camera=computeNativeCamera(bounds,fixture.viewport.width/fixture.viewport.height,fixture.preset),world=new Float32Array(new Uint32Array(fixture.playfield.worldBits).buffer);
  assert.deepEqual(nativeProbeScissor(nativeProbeArea(fixture.playfield.bounds,world,camera),fixture.viewport.width,fixture.viewport.height),fixture.reflectionScissor);
});
