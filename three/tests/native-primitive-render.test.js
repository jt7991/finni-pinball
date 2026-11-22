import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {nativePrimitiveMatrices} from '../primitive-transform.js';import {computeNativeCamera} from '../native-camera.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-primitive-render-native.json.gz',import.meta.url)))),bounds=JSON.parse(fs.readFileSync(new URL('../public/camera-bounds.json',import.meta.url)));
test('all original primitive matrix fields match independent native GPU uploads, including three held native fox poses',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.samples.length,118);const camera=computeNativeCamera(bounds,fixture.viewport.width/fixture.viewport.height,fixture.preset);
 for(const sample of fixture.samples){const actual=nativePrimitiveMatrices(sample.spec,sample.pose,camera);assert.deepEqual(Array.from(new Uint32Array(actual.buffer)),sample.matrixBits,sample.spec.name);}
 assert.deepEqual(fixture.samples.filter(s=>s.pose).map(s=>s.spec.name).sort(),['LilHead','LilLeftArm','LilRightArm']);
});
