import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {readReferenceFixture} from '../../scripts/reference-physics.mjs';import {TriggerAnimation,BumperAnimation} from '../mechanism-animation.js';import {nativeBumperSkirtVertices} from '../native-mechanism-vertices.js';import {nativeFloatAtan} from '../native-float-math.js';
const fixture=readReferenceFixture(new URL('fixtures/vpx-mechanism-motion-native.json.gz',import.meta.url));
test('trigger and bumper animation states and skirt vertices match original compiled native updates',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.bodyHashes[4332],'e1473de5ad8f30d9c3e297e0b24728dd8cd20fcd0eb9279a3a4241e392b3fece');assert.equal(fixture.bodyHashes[2568],'f9f5613fcd4c8e76e2047220a6c7be8ab9a0bd823fba5c63cd3f39d04e6e6863');
 const meta=JSON.parse(fs.readFileSync(new URL('../public/mechanism-templates.json',import.meta.url))),bytes=fs.readFileSync(new URL('../public/'+meta.file,import.meta.url)),part=meta.parts.find(p=>p.name==='bumper-skirt'),template=new Float32Array(bytes.buffer,bytes.byteOffset+part.byteOffset,part.vertices*8);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);let frames=0,fields=0;
 for(const scenario of fixture.cases){const model=scenario.kind==='Trigger'?new TriggerAnimation(scenario.spec,{},()=>{}):new BumperAnimation(scenario.spec,{},()=>{});
  for(const entry of scenario.actions){if(entry.action==='hit')model.hit(scenario.kind==='Trigger'?false:entry.value);else if(entry.action==='unhit')model.hit(true);else if(entry.action==='enable')model.setSkirtEnabled(entry.value);else{model.update(entry.value);frames++;assert.deepEqual(Object.fromEntries(Object.keys(entry.expected).map(k=>[k,model[k]])),entry.expected,scenario.kind+' frame'+frames);if(entry.vertexSHA256){const vertices=nativeBumperSkirtVertices(scenario.spec,template,model.rotx,model.roty);assert.equal(createHash('sha256').update(Buffer.from(vertices.buffer)).digest('hex'),entry.vertexSHA256,'every original native skirt vertex/normal/UV byte at frame'+frames);fields+=vertices.length;}}}
 }
 assert.equal(frames,89);assert.equal(fields,154240);
});
test('Float32 atan retains original libc argument reduction and polynomial results',()=>{
 assert.equal(fixture.bodyHashes[18695],'7984f5dbcdfcbf8e0181a341cca7d34063c192a7f591598e9fa5a35ba1fb0738');assert.equal(fixture.scalarCases.length,269);const f=new Float32Array(1),bits=new Uint32Array(f.buffer);
 for(const sample of fixture.scalarCases){bits[0]=sample.inputBits;f[0]=nativeFloatAtan(f[0]);assert.equal(bits[0],sample.outputBits,'native atanf input bits'+sample.inputBits);}
});
