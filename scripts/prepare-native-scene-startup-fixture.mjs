import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';import{gzipSync}from 'node:zlib';
import{nativeFrameClockLayout}from './native-frame-clock-layout.mjs';
const [input,output]=process.argv.slice(2);assert.ok(input&&output);assert.equal(fs.existsSync(output),false,'Preserve retained native evidence');
const bytes=fs.readFileSync(input),capture=JSON.parse(bytes),clockABI=nativeFrameClockLayout(fs.readFileSync('.work/three-review/reference-engine.wasm'));
assert.equal(capture.engineSHA256,clockABI.engineSHA256);assert.equal(capture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.equal(capture.reference.controlledSha256,capture.reference.sourceSha256);assert.deepEqual(capture.reference.controlledOverrides,{});assert.deepEqual(capture.errors,[]);assert.deepEqual(capture.clock.errors,[]);assert.deepEqual(capture.startup.errors,[]);
if(capture.clockABI)assert.deepEqual(capture.clockABI,clockABI);
assert.equal(capture.freeze.before.ms,capture.freeze.after.ms);assert.ok(capture.freeze.after.ms>=2000&&capture.freeze.after.ms<10000);assert.equal(capture.lines.length,2482);assert.equal(capture.requested.length,2482);
let previous=0;
for(const row of capture.clock.animationFrames){assert.ok(Number.isInteger(row.ms)&&row.ms>previous);assert.equal(row.observedAtMilliseconds,row.ms);assert.equal(Number((BigInt(row.physicsClock.current)-BigInt(row.physicsClock.start))/1000n),row.ms+1);previous=row.ms;}
assert.equal(capture.clock.animationFrames.at(-1).ms,capture.freeze.after.lastAnimationMilliseconds);assert.ok(capture.clock.animationFrames.length>=2);
const fixture={...capture,clockABI,clockABIVerification:'Verified independently from the retained original WASM; not inferred from native timings or model output.',captureSource:{file:input,sha256:createHash('sha256').update(bytes).digest('hex')}};
fs.writeFileSync(output,gzipSync(Buffer.from(JSON.stringify(fixture)),{level:9}));console.log(JSON.stringify({output,bytes:fs.statSync(output).size,sourceSHA256:fixture.captureSource.sha256,animationFrames:capture.clock.animationFrames.length,ms:capture.freeze.after.ms}));
