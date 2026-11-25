import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readNativeFrameHistoryDigests} from '../../scripts/native-frame-history-package.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';

test('current-master ordinary launch and flipper play retain the complete native history and exact physical boundaries', async()=>{
  const file=new URL('fixtures/vpx-main-6f8116d-natural-play-render-digests-native.json.gz',import.meta.url);
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),'7165ab73e5dc692ee510ac053e9397bddc5fb1663a311bd386180d3e464129b8');
  const {packet,capture}=readNativeFrameHistoryDigests(file);
  assert.equal(capture.reference.sourceCommit,'6f8116d0964429db0e2da41d583566784114fc5f');
  assert.equal(capture.reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');
  assert.equal(packet.blobs,undefined,'reference image uploads are unavailable in the portable replay');
  assert.equal(capture.frames.length,964);
  assert.deepEqual(capture.imageWindow,{warmupFrames:900,imageFrames:64});
  assert.equal(capture.frames[900].snapshot.ms,15968);
  assert.equal(capture.frames.at(-1).snapshot.ms,28839);
  assert.equal(capture.startup.boundaries.length,28839);
  assert.equal(capture.actions.length,140);
  assert.ok(capture.actions.every(action=>['ShiftLeft','ShiftRight','Enter'].includes(action.code)&&typeof action.down==='boolean'));
  assert.equal(capture.scenario,undefined);
  assert.equal(capture.missionController,undefined);
  assert.equal(capture.allocationInputs,undefined);
  assert.deepEqual(capture.flipperMotion.errors,[]);
  assert.deepEqual(capture.presentation.errors,[]);
  let images=0;
  for(const [index,frame] of capture.frames.entries()){
    if(index<900){assert.deepEqual(frame.images,{});continue;}
    assert.deepEqual(Object.keys(frame.images).sort(),['ao','bloom','depth','final','hdr','previousHDR','priorAO','priorTransmissionFiltered'].sort());
    images+=Object.keys(frame.images).length;
    if(index>900)assert.equal(frame.images.previousHDR.sha256,capture.frames[index-1].images.hdr.sha256);
  }
  assert.equal(images,512);
  // These are original external UI and clock inputs. Our own full model must
  // generate every native physical state; no body or allocator identity is set.
  assert.deepEqual(await compareNativeHistoryState(capture),{
    framesChecked:964,intervalsChecked:28839,ticks:28840,
    randomizeClockSamples:2,timerClockSamples:9,
  });
});
