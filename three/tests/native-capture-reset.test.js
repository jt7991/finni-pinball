import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';import{captureResetScenarios}from'../../scripts/capture-reset-scenario.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const version of [
 {name:'floor',sha256:'94ba84df5c727a3a61f039f084d72299f51bfe96c04409c48a7475186718ce5b',counts:{framesChecked:114,intervalsChecked:2333,ticks:2334,randomizeClockSamples:2,timerClockSamples:0,ballWordsChecked:14922,retiredBallStatesChecked:106}},
 {name:'airborne',sha256:'860f6d983aaebbf840a418bd435741c23bf89b3e4f3cf2000b1bff265cdd4614',counts:{framesChecked:109,intervalsChecked:2240,ticks:2241,randomizeClockSamples:2,timerClockSamples:0,ballWordsChecked:14688,retiredBallStatesChecked:120}},
])test('original '+version.name+' physical scoop capture retains every live/retired Ball float word through destruction',async()=>{
 const bytes=fs.readFileSync(new URL('fixtures/vpx-capture-reset-'+version.name+'-native.json.gz',import.meta.url));assert.equal(sha(bytes),version.sha256);const fixture=JSON.parse(gunzipSync(bytes));
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997');assert.equal(fixture.reference.sourceSha256,fixture.reference.controlledSha256);assert.deepEqual(fixture.reference.controlledOverrides,{});
 for(const [file,key]of [['probe-native-capture-reset.mjs','probeSHA256'],['native-startup-observer.mjs','observerSHA256'],['capture-reset-scenario.mjs','scenarioSHA256']])assert.equal(sha(fs.readFileSync(new URL('../../scripts/'+file,import.meta.url))),fixture[key]);
 assert.equal(fixture.caseName,version.name);assert.equal(fixture.input,captureResetScenarios[version.name]);assert.equal(fixture.playerInputs.filter(row=>row.script===fixture.input).length,1);assert.equal(fixture.observerMemoryWrites,0);
 for(const observed of [fixture,fixture.startup,fixture.clock,fixture.timers,fixture.randomizeClocks])assert.deepEqual(observed.errors,[]);
 assert.deepEqual(fixture.finalObservation,fixture.frames.at(-1).snapshot);assert.ok(fixture.playerInputs.every(input=>input.frameIndex<=fixture.frames.at(-1).frameIndex));
 const final=fixture.finalObservation.retiredBalls;assert.equal(final.length,1);assert.equal(final[0].id,3);assert.equal(fixture.finalObservation.balls.some(ball=>ball.id===3),false);
 if(version.name==='airborne'){assert.deepEqual(final[0].float32Words.velocity,[0,0,0]);assert.deepEqual(final[0].float32Words.momentum,[0,0,0]);}
 else assert.notDeepEqual(final[0].float32Words.velocity,[0,0,0],'Already-collected floor contact still affects the removed ball');
 const result=await compareNativeHistoryState(fixture,{completeFinalObservation:true,afterReplay:game=>{
  const floats=new Float32Array(3),words=new Uint32Array(floats.buffer);
  for(const [field,prefix]of [['position',''],['velocity','Vel'],['momentum','AngMom']]){
   const names=['X','Y','Z'].map(axis=>'CaptureResetRetained.'+prefix+axis);
   for(const name of names)assert.equal(game.rules.value('VarType('+name+')'),4);
   floats.set(names.map(name=>game.rules.value(name)));assert.deepEqual(Array.from(words),final[0].float32Words[field]);
  }
  return{retainedPublicWordsChecked:9};
 }});
 assert.deepEqual(result,{...version.counts,ballWordsChecked:version.counts.ballWordsChecked+18,retiredBallStatesChecked:version.counts.retiredBallStatesChecked+1,finalPlayerInputsChecked:fixture.playerInputs.filter(input=>input.frameIndex===fixture.frames.at(-1).frameIndex).length,finalObservationChecked:true,componentResult:{retainedPublicWordsChecked:9}});
});
