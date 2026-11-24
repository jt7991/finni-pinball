import test from 'node:test';import assert from 'node:assert/strict';import{readNativeFrameHistory}from '../../scripts/native-frame-history-package.mjs';
import fs from 'node:fs';import{gunzipSync}from 'node:zlib';import{createHash}from 'node:crypto';
test('six original native frames begin with both pre-physics draws and retain every preceding HDR frame',()=>{
 const {capture,blobs}=readNativeFrameHistory(new URL('./fixtures/vpx-main-initial-frame-history-native.json.gz',import.meta.url));
 assert.equal(capture.clockABI.frameIndex,334768);assert.equal(capture.clockABI.frameIndexGetter.functionSHA256,'4ef4fbc3ce44d7e6e327504e5329ee64bc7011d0a69d20bb07e2f23eeb35be90');
 assert.deepEqual(capture.frames.slice(0,2).map(frame=>({ms:frame.snapshot.ms,playing:frame.playing})),[{ms:0,playing:false},{ms:0,playing:false}]);
 assert.ok(capture.frames.slice(2).every(frame=>frame.playing));
 const first=capture.frames[0],initial=blobs.get(first.images.previousHDR.file);assert.ok(initial.every(byte=>byte===0),'new native history storage starts at zero');
 for(let i=1;i<capture.frames.length;i++)assert.deepEqual(blobs.get(capture.frames[i].images.previousHDR.file),blobs.get(capture.frames[i-1].images.hdr.file),'frame'+(i+1)+' consumes the entire preceding HDR, including the startup camera change');
});
test('an independent native startup retains zero initial bloom exposure and the preceding tonemap state',()=>{
 const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/vpx-main-initial-exposure-native.json.gz',import.meta.url)))),bytes=Buffer.from(packet.bytes,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sourceSHA256);const capture=JSON.parse(bytes);
 assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(capture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.deepEqual(capture.reference.controlledOverrides,{});assert.deepEqual(capture.errors,[]);
 let priorExposure=[0,0,0,0];for(const [i,frame]of capture.frames.entries()){
  assert.equal(frame.frameIndex,i+1);assert.deepEqual(frame.errors,[]);const bloom=frame.draws.find(row=>row.name==='fb_bloom'),tone=frame.draws.find(row=>row.name.startsWith('fb_rhtonemap'));
  assert.deepEqual(bloom.uniforms.exposure_wcg,priorExposure,'frame'+(i+1)+' bloom uses the preceding FB shader state');assert.deepEqual(tone.uniforms.exposure_wcg,[1,1,Math.fround(.035),0]);priorExposure=tone.uniforms.exposure_wcg;
 }
 assert.equal(capture.frames.length,6);
});
