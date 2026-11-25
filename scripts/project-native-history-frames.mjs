// Keep a portable frame regression after the independent full-interval replay.
// Exclusion is explicit: frame/clock/input/rule/mover observations stay intact.
import fs from 'node:fs';import assert from 'node:assert/strict';import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {readNativeHistoryCapture,NativeHistoryPagedArray} from './native-history-pages.mjs';
import {packNativeHistoryState} from './native-history-state-package.mjs';
import {nativeBallAllocationInputs} from './native-ball-allocation-inputs.mjs';
const [input,output]=process.argv.slice(2);assert.ok(input&&output,'Usage: INPUT-PAGES-OR-BUNDLE NEW-FIXTURE.json.gz');assert.equal(fs.existsSync(output),false,'Preserve prior fixtures');
const raw=fs.readFileSync(input),document=JSON.parse(raw[0]===31&&raw[1]===139?gunzipSync(raw):raw),manifest=document.manifest??document;assert.equal(manifest.format,'native-history-paged-v1');
const capture=readNativeHistoryCapture(input),excludedRows=capture.startup.boundaries.length;assert.ok(excludedRows>0);
if(process.argv.includes('--retain-allocation-inputs'))capture.allocationInputs=nativeBallAllocationInputs(capture);
capture.startup.boundaries=[];
assert.ok(capture.frames instanceof NativeHistoryPagedArray);assert.ok(capture.clock.preparedFrames instanceof NativeHistoryPagedArray);capture.frames=[...capture.frames];capture.clock.preparedFrames=[...capture.clock.preparedFrames];
capture.projection={sourceLogicalJSONBytes:manifest.logicalJSONBytes,sourceLogicalJSONSHA256:manifest.logicalJSONSHA256,excludedArray:{path:'startup.boundaries',rows:excludedRows}};
capture.scope+=' Portable frame projection excludes only per-millisecond startup.boundaries; it retains every prepared/submitted frame, external input, clock, timer, rule checkpoint and mover observation. The full source retains those boundaries for separate replay.';
const bytes=gzipSync(JSON.stringify(packNativeHistoryState(Buffer.from(JSON.stringify(capture)))));fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({output,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),frames:capture.frames.length,projection:capture.projection}));
