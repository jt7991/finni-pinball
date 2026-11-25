// Browser-sized image expectations after a separately retained, lossless full
// physical history. The only excluded observations are explicitly declared.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{readNativeHistoryCapture,NativeHistoryPagedArray}from'./native-history-pages.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function projectNativeFrameHistory(input,output){
 assert.equal(fs.existsSync(output),false,'Preserve every existing capture');const bytes=fs.readFileSync(input),manifest=JSON.parse(bytes);assert.equal(manifest.format,'native-history-paged-v1');
 const capture=readNativeHistoryCapture(input);assert.notEqual(capture.experimentalHotBlurComponent,true,'An experimental component cannot become a clean native reference');assert.ok(capture.startup.boundaries instanceof NativeHistoryPagedArray);const rows=capture.startup.boundaries.length;assert.ok(rows>0);capture.startup.boundaries=[];
 if(capture.frames instanceof NativeHistoryPagedArray)capture.frames=[...capture.frames];if(capture.clock.preparedFrames instanceof NativeHistoryPagedArray)capture.clock.preparedFrames=[...capture.clock.preparedFrames];
 assert.deepEqual(capture.frames.map(x=>x.frameIndex),Array.from({length:capture.frames.length},(_,i)=>i+1));assert.ok(capture.frames.at(-1).snapshot.ms<=capture.startup.throughMilliseconds,'The complete source must observe every retained physical interval');
 capture.projection={sourceManifestSHA256:sha(bytes),sourceLogicalJSONBytes:manifest.logicalJSONBytes,sourceLogicalJSONSHA256:manifest.logicalJSONSHA256,excludedArray:{path:'startup.boundaries',rows}};
 capture.scope=(capture.scope??'')+' Portable renderer projection excludes only per-millisecond startup.boundaries. Every native frame, prepared/submitted body, rule observation, input, clock, timer, presentation sample and image digest remains. The full source pages retain all omitted boundaries and require a separate physical replay.';
 const outputBytes=Buffer.from(JSON.stringify(capture));fs.writeFileSync(output,outputBytes,{flag:'wx'});return{output,bytes:outputBytes.length,sha256:sha(outputBytes),frames:capture.frames.length,projection:capture.projection};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[input,output]=process.argv.slice(2);assert.ok(input&&output,'Usage: INPUT-MANIFEST NEW-CAPTURE.json');console.log(JSON.stringify(projectNativeFrameHistory(input,output)));}
