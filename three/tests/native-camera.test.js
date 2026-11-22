import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {nativeCameraBounds} from '../native-camera-bounds.js';import {computeNativeCamera} from '../native-camera.js';import {nativeMultiply,nativeInverse} from '../native-matrix.js';
import * as THREE from 'three';import {applyNativeCamera,nativeViewMatrix} from '../camera-render.js';
import {nativeShaderArray} from '../native-shader-state.js';
const json=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url))),load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)))),fixture=load('vpx-camera-native.json.gz'),bits=m=>Array.from(new Uint32Array(new Float32Array(m).buffer));
test('camera bounds derive only from original part properties and raw mesh bounds',()=>{
 const data=fs.readFileSync(new URL('fixtures/camera-authored-inputs.json.gz',import.meta.url)),source=JSON.parse(gunzipSync(data)),generated=nativeCameraBounds(source),asset=json('camera-bounds.json'),unique=p=>Array.from(new Map(p.map(v=>[JSON.stringify(v),v])).values());
 assert.equal(createHash('sha256').update(data).digest('hex'),asset.authoredInputsSHA256);assert.equal(source.sourceTableSHA256,fixture.reference.controlledSha256);assert.deepEqual(asset.bounds,unique(generated.bounds));assert.deepEqual(asset.legacy,unique(generated.legacy));assert.ok([...asset.bounds,...asset.legacy].flat().every(Number.isFinite));assert.equal(source.parts.length,438);
});
test('Three camera preserves native perspective and shader view through world-unit and handedness conversion',()=>{
 const bounds=json('camera-bounds.json'),points=[[0,0,0],[952,0,400],[0,2115,0],[952,2115,0],[476,1057.5,250],[274.4583,1801.45,40],[592.20245,1801.45,40]];
 for(const sample of fixture.samples){const camera=new THREE.PerspectiveCamera();applyNativeCamera(camera,bounds,sample.width/sample.height,sample.preset);assert.deepEqual(bits(nativeViewMatrix(new THREE.Matrix4(),camera).elements),sample.bits.slice(16,32),sample.label+' lighting');
  const nativeMVP=new THREE.Matrix4().fromArray(sample.block.slice(64,80));for(const [x,y,z] of points){const expected=new THREE.Vector4(x,y,z,1).applyMatrix4(nativeMVP),actual=new THREE.Vector4(x*.01,(2115-y)*.01,z*.01,1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);assert.ok(Math.abs(actual.x/actual.w-expected.x/expected.w)*sample.width/2<.001,sample.label+' pixel X');assert.ok(Math.abs(actual.y/actual.w-expected.y/expected.w)*sample.height/2<.001,sample.label+' pixel Y');assert.ok(Math.abs(actual.z/actual.w-expected.z/expected.w)<.000001,sample.label+' clip depth');}
 }
});
test('all four source camera presets match native geometry view and projection bits at every captured aspect and orientation',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.errors,[]);assert.equal(fixture.samples.length,20);assert.ok(new Set(fixture.samples.map(s=>s.width+'/'+s.height)).size>=4);
 const bounds=json('camera-bounds.json');for(const sample of fixture.samples){const camera=computeNativeCamera(bounds,sample.width/sample.height,sample.preset);assert.deepEqual(bits(camera.view),sample.bits.slice(16,32),sample.label+' view');assert.deepEqual(bits(nativeShaderArray(camera.projection)),bits(sample.projection),sample.label+' separate projection upload');assert.deepEqual(bits(nativeMultiply(camera.view,camera.projection)),sample.bits.slice(64,80),sample.label+' geometry MVP');assert.deepEqual(bits(nativeInverse(camera.view)),bits(nativeInverse(sample.block.slice(16,32))),sample.label+' inverse');}
});
