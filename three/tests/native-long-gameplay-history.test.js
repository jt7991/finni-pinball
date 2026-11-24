import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {unpackNativeHistoryState} from '../../scripts/native-history-state-package.mjs';
import {compareNativeHistoryState} from '../../scripts/compare-native-history-state.mjs';

test('ninety seconds of ordinary native play retain every physical boundary, mover and score poll',async()=>{
  const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-long-gameplay-native.json.gz',import.meta.url))));
  assert.equal(packet.sourceSHA256,'af7518fafec900d47ce3a7c2022083d4f3a761bf619ec9f6006c59f6d67451d0');
  const fixture=unpackNativeHistoryState(packet);
  assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
  assert.equal(fixture.reference.controlledSha256,fixture.reference.sourceSha256);
  assert.deepEqual(fixture.reference.controlledOverrides,{});
  for(const observed of [fixture,fixture.startup,fixture.clock,fixture.timers,fixture.randomizeClocks,fixture.flipperMotion,fixture.moverMotion])assert.deepEqual(observed.errors,[]);
  assert.deepEqual(fixture.browserErrors,[]);
  assert.equal(fixture.frames.length,5358);
  assert.equal(fixture.frames.at(-1).snapshot.ms,90000);
  assert.equal(fixture.controller.cadenceMilliseconds,223);
  assert.equal(fixture.controller.nudgeEveryMilliseconds,11000);

  // Ordinary source drains/replacements change the physical roster. These
  // native observations are expectations only, never restored into the port.
  const lifecycles=[];
  let previous;
  for(const row of fixture.startup.boundaries){
    const ids=row.balls.map(ball=>ball.id).join(',');
    if(ids!==previous){lifecycles.push({ms:row.ms,ids});previous=ids;}
  }
  assert.deepEqual(lifecycles,[
    {ms:1,ids:'0,1,2'},
    {ms:1841,ids:'0,1,2,3'},
    {ms:5195,ids:'0,1,2,4'},
    {ms:10506,ids:'0,1,2,5'},
    {ms:36649,ids:'0,1,2'},
    {ms:44841,ids:'0,1,2,6'},
    {ms:57141,ids:'0,1,2'},
  ]);
  const polls=fixture.playerInputs.filter(input=>input.uiState);
  assert.equal(new Set(polls.map(input=>input.uiState.score)).size,53);
  assert.equal(polls.at(-1).uiState.score,1660220);
  // Replay was enabled but this particular run did not reach a UI replay.
  // It certifies only the lifecycle transitions actually recorded above.
  assert.deepEqual(fixture.actions.filter(action=>action.action==='replay'),[]);
  assert.deepEqual(await compareNativeHistoryState(fixture),{
    framesChecked:5358,intervalsChecked:90001,ticks:90001,
    randomizeClockSamples:2,timerClockSamples:20,
    moverStatesChecked:604302,moverFieldsChecked:4632982,
  });
});
