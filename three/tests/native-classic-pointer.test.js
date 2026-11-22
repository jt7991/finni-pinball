import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {nativeClassicLightState} from '../native-classic-state.js';
const source=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-classic-pointer-native.json',import.meta.url))),bits=array=>Array.from(new Uint32Array(array.buffer,array.byteOffset,array.length));
test('all native classic light vectors match original unaligned WASM pointer bytes before the broken WebGL upload',()=>{
 assert.equal(source.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(source.cases.length,25);let fields=0;
 for(const item of source.cases){const actual=nativeClassicLightState(item.spec,item.state);for(const [name,expected]of Object.entries(item.expected)){assert.deepEqual(bits(actual[name]),expected,item.name+' '+name);fields+=expected.length;}for(const upload of item.uploads){assert.equal(upload.pointer%4,1);assert.equal(upload.byteAddressSent,upload.pointer-1);assert.deepEqual(upload.uploadedBits,upload.sentBits);assert.notDeepEqual(upload.uploadedBits,upload.intendedBits);}}
 assert.equal(fields,300);assert.equal(source.unalignedUploads,75);assert.equal(source.alignedBulbUploads,525);
});
