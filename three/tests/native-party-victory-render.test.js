import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{readNativeFrameHistoryDigests}from'../../scripts/native-frame-history-package.mjs';
import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';
import{partyChooserScript}from'../../browser/party-chooser.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('native seventh victory, round reset and jackpot retain the complete physical history and explicit post-victory image window',async()=>{
 const file=new URL('fixtures/vpx-main-6f8116d-party-victory-render-digests-native.json.gz',import.meta.url);
 assert.equal(sha(fs.readFileSync(file)),'9c889678efdac9262708ce9e95663550f68b4a984d542782a47811d2f6f3392d');
 const{capture:f,packet}=readNativeFrameHistoryDigests(file),c=f.physicalController.result;
 assert.equal(packet.blobs,undefined);assert.equal(f.allocationInputs,undefined);assert.equal(f.physicalController.kind,'physical-party-finale');assert.equal(f.physicalController.sourceSHA256,'fd97ecfe4d08cb3734ac3126c6c33a85ea0162183c9878347c11f762a0f4e275');assert.equal(f.physicalController.finaleVictoryRequired,true);
 assert.equal(f.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.deepEqual(c.errors,[]);assert.equal(c.completed,true);assert.equal(c.completedAt,90922);
 assert.equal(c.finale.enteredAt,87693);assert.equal(c.finale.wonAt,87794);assert.equal(c.finale.entry.finaleInterval,120);assert.equal(c.finale.entry.won,6);assert.equal(c.finale.outcome,'native-victory');assert.equal(c.finale.win.won,7);assert.equal(c.finale.win.firstBattle,0);assert.equal(c.finale.win.finaleEnabled,0);assert.equal(c.finale.win.special,2);assert.equal(c.finale.win.endJackpot,1);assert.equal(c.last.endJackpot,0);assert.equal(c.last.score,33549110);
 for(let mission=1;mission<=7;mission++){assert.equal(c.finale.win['life'+mission],10);assert.equal(c.finale.win['mission'+mission],0);}
 assert.deepEqual(c.completions.map(row=>row.mission),[1,2,3,4,5,6,7]);assert.deepEqual(c.finale.physicalExits.map(row=>row.life),[8,6,4,2]);
 assert.equal(f.playerCorrections.partyChooserSHA256,sha(partyChooserScript));assert.ok(f.playerInputs.some(input=>input.script===partyChooserScript));
 assert.equal(f.frames.length,5344);assert.deepEqual(f.imageTrigger,{kind:'party-finale-victory',firstFrame:5217,maxHistoryFrames:8192});assert.deepEqual(f.imageWindow,{warmupFrames:5216,imageFrames:128});assert.equal(f.frames[5216].snapshot.ms,87805);assert.equal(f.frames.at(-1).snapshot.ms,91339);assert.equal(Math.max(...f.frames.map(frame=>frame.snapshot.balls.length)),7);
 assert.equal(f.imageEncoding.beforeReadbacks.reads,1024);assert.equal(f.imageEncoding.beforeReadbacks.encodes,0);assert.equal(f.imageEncoding.beforeReadbacks.completed,0);assert.equal(f.imageEncoding.beforeExport.completed,1024);assert.equal(f.imageEncoding.beforeExport.encodes,0);assert.equal(f.imageEncoding.afterExport.encodes,1024);
 for(const[index,frame]of f.frames.entries()){
  if(index<5216){assert.deepEqual(frame.images,{});continue;}
  assert.equal(Object.keys(frame.images).length,8);if(index>5216)assert.equal(frame.images.previousHDR.sha256,f.frames[index-1].images.hdr.sha256);
 }
 // The window begins after the original victory. It does not claim image
 // coverage inside the 120ms challenge; all earlier physics still replays.
 assert.deepEqual(await compareNativeHistoryState(f),{framesChecked:5344,intervalsChecked:91339,ticks:91340,randomizeClockSamples:2,timerClockSamples:63,ruleObservationsChecked:849,ruleVariantFieldsChecked:46695,scriptRandomStatesChecked:849});
});
