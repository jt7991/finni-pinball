import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeAudioResampler} from '../native-audio-resampler.js';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-audio-resampler-native.json',import.meta.url)));
test('rate conversion retains every original native Float32 sample and input/output count across twelve cases',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,12);assert.equal(fixture.unchangedPhysicsRNG,true);
 for(const c of fixture.cases){const r=createNativeAudioResampler(c.inputRate,c.outputRate,c.channels),input=Float32Array.from(c.input);let offset=0;
  for(const block of c.blocks){const actual=r.process(input.subarray(offset*c.channels),block.capacity);offset+=actual.inputFrames;assert.equal(actual.inputFrames,block.inputFrames);assert.equal(actual.outputFrames,block.outputFrames);assert.deepEqual([...actual.pcm],block.pcm);}
 }
});
test('bounded source chunks preserve the same continuous resampling phase',()=>{
 for(const c of fixture.cases){const whole=createNativeAudioResampler(c.inputRate,c.outputRate,c.channels),small=createNativeAudioResampler(c.inputRate,c.outputRate,c.channels),input=Float32Array.from(c.input),a=whole.process(input,10000);let consumed=0,outputs=[];
  while(consumed<input.length/c.channels){const chunk=input.subarray(consumed*c.channels,Math.min(input.length,(consumed+17)*c.channels)),result=small.process(chunk,10000);consumed+=result.inputFrames;outputs.push(...result.pcm);assert.ok(result.inputFrames||result.outputFrames);}
  outputs.push(...small.process(new Float32Array(),10000).pcm);assert.equal(outputs.length,a.pcm.length);for(let i=0;i<outputs.length;i++)assert.equal(outputs[i],a.pcm[i],c.inputRate+' -> '+c.outputRate+' sample '+i);
 }
});
