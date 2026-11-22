import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeNativeGeometry} from '../native-geometry-codec.js';
import {nativePlungerFrame} from '../native-mechanism-render.js';

test('all 57 plunger meshes retain original native vertex bits and source frame selection',()=>{
 const metadata=JSON.parse(fs.readFileSync(new URL('../public/plunger-render-frames.json',import.meta.url)));
 assert.equal(metadata.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(metadata.frames,57);assert.equal(metadata.verticesPerFrame,1836);
 const encoded=fs.readFileSync(new URL('../public/'+metadata.geometry.file,import.meta.url));
 const raw=Buffer.from(decodeNativeGeometry(encoded,[metadata.geometry]));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 // Independent complete source VBO hash, pinned when observing RenderSetup.
 assert.equal(sha(raw),'90898edf649711831f99f0de3f99be24f79096f5f5e4623987ad668c5b0bf2a4');
 const stride=metadata.verticesPerFrame*32;
 for(let frame=0;frame<57;frame++){
  assert.equal(sha(raw.subarray(frame*stride,(frame+1)*stride)),metadata.frameSHA256[frame]);
  assert.equal(nativePlungerFrame(metadata.spec,raw.readFloatLE(frame*stride+4),57),frame);
 }
 assert.equal(nativePlungerFrame(metadata.spec,metadata.spec.center.y+100,57),0);
 assert.equal(nativePlungerFrame(metadata.spec,metadata.spec.center.y-metadata.spec.stroke-100,57),56);
});
