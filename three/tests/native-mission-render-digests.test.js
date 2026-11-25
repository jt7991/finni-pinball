import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
import{readNativeFrameHistory,readNativeFrameHistoryDigests,packNativeFrameHistoryDigests}from'../../scripts/native-frame-history-package.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

for(const mission of[1,2,3,4,5,6,7])test('current-master mission'+mission+' retains every original frame and image-byte digest',()=>{
 const {packet,capture,source}=readNativeFrameHistoryDigests(new URL('fixtures/vpx-main-6f8116d-mission'+mission+'-render-digests-native.json.gz',import.meta.url));
 assert.equal(sha(source),packet.capture.sha256);assert.equal(capture.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(capture.reference.sourceCommit,'6f8116d0964429db0e2da41d583566784114fc5f');
 assert.equal(capture.frames.length,96);assert.equal(capture.requestedFrames,96);assert.equal(capture.missionController.mission,mission);assert.equal(capture.actions.filter(a=>a.kind==='approach').length,1);assert.equal(capture.actions.filter(a=>a.kind==='confirm').length,1);assert.ok(capture.scenarioLog.some(line=>new RegExp('RENDER_MODE\\|\\d+\\|'+mission+'\\|').test(line)));
 assert.equal(packet.blobs,undefined);assert.equal(capture.frames[0].images.previousHDR.sha256,sha(Buffer.alloc(230*424*16)),'native temporal storage starts at zero');
 for(const [i,frame]of capture.frames.entries()){
  const transmission=frame.draws.some(draw=>draw.name==='fb_blur_horiz19x19');
  assert.deepEqual(Object.keys(frame.images).sort(),['ao','bloom','depth','final','hdr','previousHDR','priorAO',...(transmission?['priorTransmissionFiltered']:[])].sort(),'the original transmission pass supplies its history observation only when it actually runs');
  if(i)assert.equal(frame.images.previousHDR.sha256,capture.frames[i-1].images.hdr.sha256,'every full previous HDR belongs to the preceding original frame');
 }
 assert.equal(capture.startup.boundaries.length,capture.frames.at(-1).snapshot.ms);assert.deepEqual(capture.presentation.errors,[]);assert.deepEqual(capture.flipperMotion.errors,[]);
 if(mission===6)assert.equal(Math.max(...capture.frames.map(f=>f.snapshot.balls.length)),6,'native delayed multiball launches actually create all additional bodies');
});

test('digest publication verifies actual independent pixel bytes and rejects a changed byte',()=>{
 const {packet,capture,source,blobs}=readNativeFrameHistory(new URL('fixtures/vpx-main-initial-frame-history-native.json.gz',import.meta.url)),workRoot=fileURLToPath(new URL('../../.work/',import.meta.url));fs.mkdirSync(workRoot,{recursive:true});const directory=fs.mkdtempSync(path.join(workRoot,'frame-digests-test-'));
 try{
  fs.writeFileSync(path.join(directory,'capture.json'),source);fs.writeFileSync(path.join(directory,'authored-camera.json'),JSON.stringify(packet.authoredCamera));for(const [name,bytes]of blobs)fs.writeFileSync(path.join(directory,name),bytes);
  const output=path.join(directory,'verified.json.gz'),result=packNativeFrameHistoryDigests(directory,output);assert.ok(result.source.equals(source));assert.equal(result.packet.blobs,undefined);
  assert.throws(()=>packNativeFrameHistoryDigests(directory,output),'existing observations are preserved');
  const first=capture.frames[0].images.hdr,data=Buffer.from(blobs.get(first.file));data[0]^=1;fs.writeFileSync(path.join(directory,first.file),data);const rejected=path.join(directory,'corrupted.json.gz');assert.throws(()=>packNativeFrameHistoryDigests(directory,rejected),/Every digest must first match/);assert.equal(fs.existsSync(rejected),false);
 }finally{assert.ok(path.resolve(directory).startsWith(path.resolve(workRoot)+path.sep));fs.rmSync(directory,{recursive:true,force:true});}
});
