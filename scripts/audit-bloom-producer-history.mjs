import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [controlPath,producerPath,queuedPath,output]=process.argv.slice(2);
assert.ok(controlPath&&producerPath&&queuedPath&&output,'Supply uploaded-input control, GPU producer, queued-readback producer and new audit paths');
assert.equal(fs.existsSync(output),false,'Preserve previous evidence');
const sources=[controlPath,producerPath,queuedPath].map(file=>{const bytes=fs.readFileSync(file);return{file,sha256:createHash('sha256').update(bytes).digest('hex'),data:JSON.parse(bytes)};});
for(const {data}of sources){assert.equal(data.fixtureSHA256,'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');assert.equal(data.source.captureSHA256,'4f3d3a8424e4f6b721401cf115d196bd07af150c27ab5fc3a50b8169c759601d');assert.deepEqual(data.errors,[]);}
const control=sources[0].data.result.results.filter(row=>row.ulps===0);
assert.equal(control.length,128);assert.equal(new Set(control.map(row=>row.frame)).size,128);
let comparedOutputs=0;
for(const {data}of sources.slice(1)){
  assert.equal(data.results.length,128);assert.equal(data.state.glError,0);assert.equal(data.state.programs,2);assert.equal(data.state.samplers,2);
  assert.deepEqual(data.state.history,{frames:128,hdrUpdates:128,cutoffDraws:128,horizontalDraws:128,cutoffCPUUploads:0});
  for(const [i,row]of data.results.entries()){assert.equal(row.frame,control[i].frame);assert.match(row.cutSHA256,/^[a-f0-9]{64}$/);assert.equal(row.outputSHA256,control[i].outputSHA256,'Complete output bytes at frame '+row.frame);comparedOutputs++;}
}
assert.equal(sources[1].data.observeReadbacks,false);assert.equal(sources[2].data.observeReadbacks,true);
assert.deepEqual(sources[2].data.beforeTransfer.readbacks,{reads:512,deferred:512,encodes:0,queued:512,completed:512});
assert.deepEqual(sources[2].data.state.readbacks,{reads:512,deferred:512,encodes:512,queued:512,completed:512});
assert.deepEqual(sources[2].data.state.observerErrors,[]);assert.deepEqual(sources[2].data.state.priorErrors,[]);
const failures=sources[1].data.results.filter(row=>row.different);assert.equal(failures.length,1);assert.equal(failures[0].frame,6297);assert.equal(failures[0].different,170);
const report={scope:'Within the complete retained 128-frame component window, all GPU-produced cutoff inputs match the original. Persistent GPU production with synchronous final-pass reads, and the original observer with 512 queued before/after snapshots, both produce exactly the uploaded-input control output on every frame. This excludes these finite producer/readback histories as the retained horizontal mismatch cause. It does not reconstruct preceding whole-table GPU history, establish all driver behavior, alter production or make the failing native frame pass.',sources:sources.map(({data,...source})=>source),gpuCutoffMatches:256,comparedOutputs,queuedSnapshots:512,nativePassingFrames:127,unresolved:failures};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
