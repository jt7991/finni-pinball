import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readReferenceFixture} from '../../scripts/reference-physics.mjs';import {nativeFlasherVertices} from '../native-flasher-mesh.js';
test('all 63 authored flasher buffers reproduce every native position, normal and UV bit',()=>{
 const fixture=readReferenceFixture(new URL('fixtures/vpx-flasher-mesh-native.json.gz',import.meta.url));assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,63);let fields=0;
 for(const sample of fixture.cases){const actual=nativeFlasherVertices(sample.spec);assert.equal(actual.length,sample.vertices*8,sample.spec.name);assert.equal(createHash('sha256').update(Buffer.from(actual.buffer)).digest('hex'),sample.vertexSHA256,sample.spec.name+' complete native GPU buffer');fields+=actual.length;}
 assert.equal(fields,2016);assert.equal(fixture.cases.filter(c=>c.spec.image_alignment==='world').length,1);
});
