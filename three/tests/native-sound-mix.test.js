import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeSoundMix} from '../native-sound-mix.js';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-native-audio-parameters.json',import.meta.url)));

test('the current table retains every authored sound output and signed-percent setting',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url)));
 const values=Object.values(manifest);assert.equal(values.length,376);
 assert.equal(values.filter(value=>value.outputTarget==='playfield').length,62);
 assert.equal(values.filter(value=>value.outputTarget==='backglass').length,314);
 for(const sound of values)for(const name of ['volumePercent','panPercent','frontRearFadePercent'])assert.equal(sound[name],0,name);
 assert.equal(manifest.fx_ballrolling3.outputTarget,'playfield');assert.equal(manifest.fx_enter.outputTarget,'backglass');
});

test('native stereo level and pan curves match twelve actual compiled-engine observations',()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(fixture.sourceSHA256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(fixture.cases.length,12);
 for(const row of fixture.cases){const actual=nativeSoundMix({outputTarget:row.outputTarget},row);
  assert.equal(actual.level,row.observed.level);assert.equal(actual.balance,row.observed.balance);
 }
});

test('native signed sound offsets add before clamping, square-root volume and pan inversion',()=>{
 const sound={outputTarget:'playfield',volumePercent:-25,panPercent:25};
 const actual=nativeSoundMix(sound,{volume:.5,pan:-.25});assert.deepEqual(actual,{level:.5,balance:0,left:.25,right:.25});
 assert.equal(nativeSoundMix(sound,{volume:0}).level,0);assert.equal(nativeSoundMix(sound,{volume:9}).level,1);
 const right=nativeSoundMix({outputTarget:'playfield'},{pan:1});assert.equal(right.left,0);assert.equal(right.right,1);
 const mirrored=nativeSoundMix({outputTarget:'playfield'},{pan:1,mirrored:true});assert.equal(mirrored.left,1);assert.equal(mirrored.right,0);
 assert.deepEqual(nativeSoundMix({outputTarget:'backglass'},{volume:.25,pan:1}),{level:1,balance:1,left:0,right:1});
});

test('every controlled PCM sample matches the original compiled native mixer callback',()=>{
 const native=readReferenceFixture(new URL('fixtures/vpx-main-native-audio-mix.json.gz',import.meta.url));
 assert.equal(native.engineSHA256,fixture.engineSHA256);assert.equal(native.sourceSHA256,fixture.sourceSHA256);
 assert.equal(native.componentFunction.index,869);assert.equal(native.componentFunction.sha256,'8b5683243e118376664f31c1f458f5caf27c9d71080462ff7dc3c43702f96b2a');
 assert.equal(native.cases.length,12);let samples=0;
 for(const row of native.cases){
  assert.equal(row.unchangedNode,true);assert.equal(row.unchangedRNG,true);assert.equal(row.functionIndex,869);
  assert.equal(row.inputChannels,row.outputTarget==='backglass'?2:1);assert.equal(row.outputChannels,2);assert.equal(row.output.length,512);
  const mix=nativeSoundMix({outputTarget:row.outputTarget},row);assert.equal(mix.level,row.parameters.volume);assert.equal(mix.balance,row.parameters.pan);
  for(let i=0;i<256;i++)for(let channel=0;channel<2;channel++){
   const input=row.inputs[i*row.inputChannels+(row.inputChannels===1?0:channel)];
   // JSON normalizes either sign of zero; retain exact finite numeric values
   // without claiming signed-zero bit preservation across that transport.
   const actual=Math.fround(input*(channel?mix.right:mix.left));
   assert.ok(Number.isFinite(actual));assert.ok(actual===row.output[i*2+channel]);samples++;
  }
 }
 assert.equal(samples,6144);
});
