import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {nativeSpinnerRenderVertices,nativeGateRenderVertices} from '../native-mechanism-vertices.js';

test('both spinners and wire gates retain every original vertex byte across grid and Float32 precision cases',()=>{
  const sha=x=>createHash('sha256').update(x).digest('hex'),bytes=fs.readFileSync(new URL('fixtures/vpx-native-mover-vertices.json.gz',import.meta.url));assert.equal(sha(bytes),'f53195fadc1055b97bcd446b1c4ff3c2ea3543049f4025870575ba4b15e87c94');
  const fixture=JSON.parse(gunzipSync(bytes));assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.deepEqual(fixture.functions,{spinner:4116,gate:3051});assert.equal(fixture.functionHashes[4116],'3cfb1f53edd8269eb306a417674ff23a06a92ca4322db149e2b21c3d45f69b20');assert.equal(fixture.functionHashes[3051],'36d0348811ac39bc7955c1178f6f199b53dba3b1b573a939d2312a3a53ca9521');
  assert.deepEqual(fixture.parts.map(p=>p.spec.name),['Spinner001','Spinner002','Gate001','Gate002']);assert.ok(fixture.sampling.every(s=>s.samples===1000000&&s.selected.length===s.scalarDifferences));
  const meta=JSON.parse(fs.readFileSync(new URL('../public/mechanism-templates.json',import.meta.url))),geometry=fs.readFileSync(new URL('../public/'+meta.file,import.meta.url));assert.equal(sha(geometry),fixture.templateSHA256);
  for(const part of fixture.parts){
    const templatePart=meta.parts.find(p=>p.name===part.template),template=new Float32Array(geometry.buffer,geometry.byteOffset+templatePart.byteOffset,templatePart.vertices*8),output=new Float32Array(template.length),render=part.kind==='spinner'?nativeSpinnerRenderVertices:nativeGateRenderVertices;
    assert.equal(part.frames.length,1025+fixture.sampling.find(s=>s.kind===part.kind).scalarDifferences);
    for(const [i,frame]of part.frames.entries()){render(part.spec,template,frame.angle,part.surface,output);assert.equal(sha(output),frame.vertexSHA256,part.spec.name+' original vertex bytes at component frame '+i+' angle '+frame.angle);}
  }
});
