import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{readNativeFrameHistoryDigests}from'../../scripts/native-frame-history-package.mjs';
import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('original native asynchronous readbacks retain eager bytes, frozen physics and a snapshot preceding GPU mutation',()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-native-image-readback-r1.json',import.meta.url));assert.equal(sha(bytes),'4b0ece928e58b9ae06299aef4c1847e96de8f39507403cdd3eb0df7c01243a34');const f=JSON.parse(bytes);
 assert.equal(f.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(f.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(f.reference.sourceSha256,f.reference.controlledSha256);assert.deepEqual(f.reference.controlledOverrides,{});
 assert.deepEqual(f.errors,[]);assert.equal(f.glError,0);assert.equal(f.ownedError,0);assert.equal(f.initial.ms,f.after.ms);assert.deepEqual(f.initial.balls,f.after.balls);assert.deepEqual(f.initial.random,f.after.random);
 assert.equal(f.rows.length,11);assert.ok(f.rows.some(row=>row.depth));assert.ok(f.rows.some(row=>row.eager.arrayType==='Float32Array'&&!row.depth));assert.ok(f.rows.some(row=>row.eager.arrayType==='Uint8Array'));
 for(const row of f.rows){assert.equal(row.eager.sha256,row.deferred.sha256);assert.equal(row.eager.arrayType,row.deferred.arrayType);assert.equal(row.eager.width,row.deferred.width);assert.equal(row.eager.height,row.deferred.height);}
 assert.equal(f.savedBefore.queued,12);assert.equal(f.savedBefore.completed,0);assert.equal(f.savedBefore.encodes,11);assert.equal(f.afterReadbacks.completed,12);assert.equal(f.afterReadbacks.encodes,11);assert.equal(f.afterEncoding.encodes,24);
 const floats=image=>{const b=Buffer.from(image.bytes,'base64');return Array.from({length:b.length/4},(_,index)=>b.readFloatLE(index*4));};
 assert.deepEqual(floats(f.owned.saved),Array.from({length:64},(_,index)=>[.125,.25,.5,.75][index%4]));assert.deepEqual(floats(f.owned.current),Array.from({length:64},(_,index)=>[1,0,0,1][index%4]));
});

test('asynchronous native frame history exports every buffer after its window and retains exact own-model physical boundaries',async()=>{
 const file=new URL('fixtures/vpx-main-6f8116d-async-render-digests-native.json.gz',import.meta.url);assert.equal(sha(fs.readFileSync(file)),'3637f3e41cce0b282d0a87a9a6eab8a5ce363a03fc877147ea6dbbd0f0c5f5fe');const{capture,packet}=readNativeFrameHistoryDigests(file);
 assert.equal(packet.blobs,undefined);assert.equal(capture.frames.length,332);assert.deepEqual(capture.imageWindow,{warmupFrames:300,imageFrames:32});assert.equal(capture.frames[300].snapshot.ms,5852);assert.equal(capture.frames.at(-1).snapshot.ms,6619);assert.equal(capture.allocationInputs,undefined);assert.equal(capture.physicalController,undefined);
 assert.equal(capture.imageEncoding.deferred,true);assert.equal(capture.imageEncoding.asyncReadback,true);assert.deepEqual(capture.imageEncoding.beforeReadbacks,{reads:256,deferred:256,encodes:0,queued:256,completed:0});assert.deepEqual(capture.imageEncoding.beforeExport,{reads:256,deferred:256,encodes:0,queued:256,completed:256});assert.deepEqual(capture.imageEncoding.afterExport,{reads:256,deferred:256,encodes:256,queued:256,completed:256});
 for(const[index,frame]of capture.frames.entries()){if(index<300){assert.deepEqual(frame.images,{});continue;}assert.equal(Object.keys(frame.images).length,8);if(index>300)assert.equal(frame.images.previousHDR.sha256,capture.frames[index-1].images.hdr.sha256);}
 assert.deepEqual(await compareNativeHistoryState(capture),{framesChecked:332,intervalsChecked:6619,ticks:6620,randomizeClockSamples:2,timerClockSamples:2});
});
