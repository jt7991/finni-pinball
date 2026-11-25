import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeAudioResampler} from '../native-audio-resampler.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-audio-rate-changes-native.json',import.meta.url)));

test('live pitch changes retain every native rate, integer phase, consumed frame and Float32 output in twelve cases',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.unchangedPhysicsRNG,true);assert.equal(fixture.cases.length,12);
 for(const c of fixture.cases){let r=createNativeAudioResampler(c.inputRate,c.outputRate,c.channels),consumed=0;const input=Float32Array.from(c.input);
  for(const block of c.blocks){
   if(block.rateChange)assert.equal(r.setRateRatio(block.rateChange.ratio),true);
   const actual=r.process(input.subarray(consumed*c.channels),block.capacity);consumed+=actual.inputFrames;
   assert.equal(actual.inputFrames,block.inputFrames);assert.equal(actual.outputFrames,block.outputFrames);assert.deepEqual([...actual.pcm],block.pcm);
   const state=r.snapshot();for(const key of ['inputRate','outputRate','timeInt','timeFrac'])assert.equal(state[key],block.phase[key],c.inputRate+'→'+c.outputRate+' pitch '+block.pitch+' '+key);
   // Recreate at each boundary, as a stopped named voice does. The following
   // block must keep the modified rate and phase rather than the initial rate.
   r=createNativeAudioResampler(c.inputRate,c.outputRate,c.channels,state);
  }
 }
});
