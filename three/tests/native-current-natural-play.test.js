import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readNativeFrameHistoryDigests} from '../../scripts/native-frame-history-package.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';

test('cc6f04f ordinary launch and flipper play retain the complete native history and exact physical boundaries', async()=>{
  const file=new URL('fixtures/vpx-main-cc6f04f-natural-play-render-digests-native.json.gz',import.meta.url);
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),'11fe664b5213f4137797d73b106e8e192d6a4e7e881fba755510f4352bb8f799');
  const {packet,capture}=readNativeFrameHistoryDigests(file);
  assert.equal(capture.reference.sourceCommit,'cc6f04f691e6e762687e2f612800079457b5d98b');
  assert.equal(capture.reference.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');
  assert.equal(packet.blobs,undefined,'reference image uploads are unavailable in the portable replay');
  assert.equal(capture.frames.length,964);
  assert.deepEqual(capture.imageWindow,{warmupFrames:900,imageFrames:64});
  assert.equal(capture.frames[900].snapshot.ms,16641);
  assert.equal(capture.frames.at(-1).snapshot.ms,18588);
  assert.equal(capture.startup.boundaries.length,18588);
  assert.equal(capture.actions.length,93);
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
    framesChecked:964,intervalsChecked:18588,ticks:18589,
    randomizeClockSamples:2,timerClockSamples:3,
  });
});
