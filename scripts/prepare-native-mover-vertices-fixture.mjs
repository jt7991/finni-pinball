import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {nativeMoverVertices} from './native-mover-vertices-compiled-harness.mjs';
import {nativeTrig} from './native-trig-compiled-harness.mjs';

const output=process.argv[2];assert.ok(output,'Supply a new fixture path');assert.equal(fs.existsSync(output),false,'Preserve existing native fixtures');
const n=await nativeMoverVertices(),trig=await nativeTrig(),f=Math.fround,sha=x=>createHash('sha256').update(x).digest('hex');
const metadata=JSON.parse(fs.readFileSync('three/public/mechanism-templates.json')),geometry=fs.readFileSync('three/public/'+metadata.file);assert.equal(sha(geometry),metadata.sha256);
const allParts=JSON.parse(fs.readFileSync('three/public/native-table/native-table.json')).parts,parts=[],sampling=[];
for(const kind of ['spinner','gate']){
  const max=kind==='spinner'?2*Math.PI:Math.PI/2,selected=[];let seed=0x257176;
  for(let sample=0;sample<1000000;sample++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const angle=f(seed/2**32*max);
    if(trig.sin(-angle)!==f(Math.sin(-angle))||trig.cos(-angle)!==f(Math.cos(-angle)))selected.push({sample,angle});
  }
  const angles=[...Array.from({length:1025},(_,i)=>f(i/1024*max)),...selected.map(row=>row.angle)];
  sampling.push({kind,seed:0x257176,samples:1000000,scalarDifferences:selected.length,selected});
  const specs=[...new Map(allParts.filter(p=>p.spec.kind===(kind==='spinner'?'Spinner':'Gate')).map(p=>[p.spec.name,p.spec])).values()];
  const templatePart=metadata.parts.find(p=>p.name===(kind==='spinner'?'spinner-plate':'gate-wire')),template=new Float32Array(geometry.buffer,geometry.byteOffset+templatePart.byteOffset,templatePart.vertices*8);
  if(kind==='spinner')assert.equal(sha(n.spinnerTemplate()),templatePart.sha256,'Embedded original spinner template matches the source resource');
  for(const spec of specs){
    const surface=spec.surface_height??0;n.reset(kind,spec,template,surface);
    const frames=angles.map(angle=>({angle,vertexSHA256:sha(n.vertices(kind,angle))}));
    parts.push({kind,spec,surface,template:templatePart.name,vertices:templatePart.vertices,frames});
  }
}
const fixture={format:'native-mover-vertices-v1',engineSHA256:n.engineSHA256,functions:n.functions,functionHashes:n.hashes,gpuStubs:n.gpuStubs,upstreamCommit:'195f214dd4849b8ef6113fd377258b78d0dec3bf',templateSHA256:metadata.sha256,sampling,parts,scope:'Explicit component angles for both authored spinners and visible wire gates. Complete original Spinner::UpdatePlate and Gate::Render vertex/matrix/trigonometry instructions produce every expected vertex hash. Spinner uses its supported output argument; gate GPU Lock uses a scratch output pointer, Unlock and DrawMesh are no-ops. The gate output starts at zero and its unmodified UV fields are preserved. This does not restore native gameplay state or certify a full trajectory. A uniform grid and every native-versus-rounded-double scalar discrepancy in each declared million-sample set are checked.'};
const bytes=gzipSync(JSON.stringify(fixture),{level:9,mtime:0});fs.writeFileSync(output,bytes,{flag:'wx'});console.log(JSON.stringify({output,bytes:bytes.length,sha256:sha(bytes),samples:sampling.map(s=>({kind:s.kind,samples:s.samples,differences:s.scalarDifferences})),parts:parts.map(p=>({name:p.spec.name,frames:p.frames.length}))}));
