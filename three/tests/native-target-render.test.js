import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {readReferenceFixture} from '../../scripts/reference-physics.mjs';import {nativeStandupRenderVertices} from '../native-target-render.js';
test('original standup template reproduces independent native initial GPU buffers and all compiled animated vertex values',()=>{
 const fixture=readReferenceFixture(new URL('fixtures/vpx-standup-render-vertices.json.gz',import.meta.url)),meta=JSON.parse(fs.readFileSync(new URL('../public/standup-render-template.json',import.meta.url))),bytes=fs.readFileSync(new URL('../public/'+meta.file,import.meta.url)),template=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),bits=value=>value===0?0:new Uint32Array(new Float32Array([value]).buffer)[0];
 assert.equal(meta.upstreamCommit,fixture.upstreamCommit);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);assert.equal(fixture.cases.length,11);
 for(const target of fixture.cases){const spec={...target,rot_z:target.rotZ};
  // This native fixture calls UpdateTarget even at offset0. JSON discarded
  // signed zeros; every nonzero Float32 bit remains an exact comparison.
  for(const pose of [{offset:0,expected:target.rest},...target.poses]){
   const actual=nativeStandupRenderVertices(spec,template,pose.offset,{initial:pose.initial});assert.equal(actual.length,161*8);
   for(let v=0;v<161;v++)for(let c=0;c<6;c++)assert.equal(bits(actual[v*8+c]),bits(pose.expected[v][c]),target.name+' offset'+pose.offset+' vertex'+v+' component'+c);
  }
 }
 const initial=readReferenceFixture(new URL('fixtures/vpx-target-rest-gpu.json.gz',import.meta.url));assert.equal(initial.engineSHA256,fixture.engineSha256);assert.equal(initial.parts.length,11);
 for(const part of initial.parts){const vertices=nativeStandupRenderVertices(part.spec,template,0,{initial:true});assert.equal(vertices.length,part.vertices*8);assert.equal(createHash('sha256').update(Buffer.from(vertices.buffer)).digest('hex'),part.vertexSHA256,part.spec.name+' initial GPU bytes including signed zeros and UVs');}
});
