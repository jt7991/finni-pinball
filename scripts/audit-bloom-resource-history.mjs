// Compare complete output-byte digests, rather than just mismatch counts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [controlPath,reusePath,bindingsPath,output]=process.argv.slice(2);
assert.ok(controlPath&&reusePath&&bindingsPath&&output,'Supply control, reuse, native-bindings and new audit paths');assert.equal(fs.existsSync(output),false,'Preserve previous audit evidence');
const reports=[controlPath,reusePath,bindingsPath].map(file=>{const bytes=fs.readFileSync(file);return {file,sha256:createHash('sha256').update(bytes).digest('hex'),data:JSON.parse(bytes)};});
for(const {data}of reports){
  assert.equal(data.fixtureSHA256,'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');
  assert.deepEqual(data.errors,[]);assert.equal(data.result.glError,0);assert.equal(data.diagnostics.windowMode,true);assert.equal(data.diagnostics.outputDigests,true);assert.equal(data.diagnostics.pairedReadbacks,true);
}
const [control,reuse,bindings]=reports.map(r=>r.data),baseline=control.result.results.filter(r=>r.ulps===0),histories=reports.map(r=>r.data.result.resourceHistory);
assert.equal(baseline.length,128);assert.equal(new Set(baseline.map(r=>r.frame)).size,128);
assert.equal(control.diagnostics.reuseResources,false);assert.equal(histories[0].programs,128);assert.equal(histories[0].createdInputTextures,128);assert.equal(histories[0].inputTextureUpdates,0);
let comparedFrames=0;
for(const data of [reuse,bindings]){
  assert.equal(data.result.results.length,128);assert.equal(data.diagnostics.reuseResources,true);
  assert.equal(data.result.resourceHistory.programs,1);assert.equal(data.result.resourceHistory.createdInputTextures,1);assert.equal(data.result.resourceHistory.inputTextureUpdates,127);
  assert.deepEqual(data.source,control.source);
  for(const row of data.result.results){const original=baseline.find(r=>r.frame===row.frame);assert.ok(original);assert.match(row.outputSHA256,/^[a-f0-9]{64}$/);assert.equal(row.outputSHA256,original.outputSHA256,'All output bytes at frame '+row.frame);comparedFrames++;}
}
assert.equal(bindings.diagnostics.nativeUnits,true);assert.equal(bindings.diagnostics.nativeSampler,true);assert.equal(histories[2].units.length,14);
const failures=baseline.filter(r=>r.different);assert.equal(failures.length,1);assert.equal(failures[0].frame,6297);assert.equal(failures[0].different,170);
const report={scope:'Explicit cutoff-image component replay over the pinned 128-frame native window. Fresh resources, persistent resources, and persistent resources with recorded sampler-unit history produce identical complete output bytes. This excludes these resource-lifetime/binding differences in this finite component window. It does not reconstruct the preceding 6260 native frames, replace GPU-produced input history, prove driver-wide determinism, or fix the retained native mismatch. No production shader, tolerance or reference image is changed.',sources:reports.map(({data,...source})=>source),histories,comparedFrames,pairedReadbacks:reports.reduce((n,r)=>n+r.data.result.results.length,0),nativePassingFrames:127,unresolved:failures.map(({frame,different,columns,maxAbsolute,outputSHA256})=>({frame,different,columns,maxAbsolute,outputSHA256}))};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
