import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [nativePath,portPath,output]=process.argv.slice(2),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.ok(nativePath&&portPath&&output,'Supply native/port traces and a new audit path');assert.equal(fs.existsSync(output),false,'Preserve earlier evidence');
const records=[nativePath,portPath].map(file=>{const bytes=fs.readFileSync(file);return{file,sha256:sha(bytes),data:JSON.parse(bytes)};});
const summaries=[];
for(const [index,{data:r}]of records.entries()){
  assert.equal(r.playerRuntime,index?'threejs':'vpx');assert.equal(r.fixtureSHA256,'7ef6f9dadd494e8c1f13594038d0e8a06178abb747558d477449c6cb20068695');assert.deepEqual(r.errors,[]);assert.deepEqual(r.state.errors,[]);assert.deepEqual(r.state.restoreErrors,[]);
  assert.equal(sha(Buffer.from(r.instrumentation.sourceBase64,'base64')),r.instrumentation.sourceSHA256);for(const flag of ['observeDrawState','pairedDraws','verifyInput','repeatReadback'])assert.equal(r.diagnostics[flag],true);
  assert.equal(r.rows.length,r.state.rows);assert.equal(r.diagnostics.imagesPerFrame,4);assert.deepEqual(r.state.encoding,{reads:r.rows.length*4,deferred:r.rows.length*4,encodes:0,queued:r.rows.length*4,completed:r.rows.length*4});
  const pairs=[],outputs=new Map();
  for(const row of r.rows){assert.equal(row.inputSHA256,'251bbba395c4a25a62fc3628f8210e9b3fde58a92e781c6c39c8ad61ded1a10f');assert.equal(row.sha256,row.repeatSHA256,'Same output snapshot before any intervening draw');assert.equal(row.stateSHA256,sha(JSON.stringify(row.stateBefore)));assert.equal(row.pairedStateSHA256,sha(JSON.stringify(row.statePaired)));assert.equal(row.stateSHA256,row.pairedStateSHA256,'Recorded GL state around consecutive draws');for(const hash of [row.sha256,row.pairedSHA256])outputs.set(hash,(outputs.get(hash)??0)+1);if(row.sha256!==row.pairedSHA256)pairs.push(row.sample);}
  summaries.push({runtime:r.playerRuntime,scenes:r.rows.length,draws:r.rows.length*2,snapshots:r.rows.length*4,sameInput:r.rows.length,repeatedReadbacksMatch:r.rows.length,recordedStatePairsMatch:r.rows.length,differentOutputPairs:pairs,outputCounts:Object.fromEntries(outputs),priorErrors:r.state.priorErrors,restoreErrors:r.state.restoreErrors});
}
const report={scope:'Fixed-input owned GPU component under two live player workloads. Each first output is snapshotted twice before a second draw; the input texture is independently read back; recorded GL state matches across both draws. Different paired output hashes therefore survive repeat-readback and recorded-state controls in both players. This does not identify an internal driver cause, prove equal occurrence rates or certify full-scene parity. Historical image references and production are unchanged.',sources:records.map(({data,...row})=>row),summaries};fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
