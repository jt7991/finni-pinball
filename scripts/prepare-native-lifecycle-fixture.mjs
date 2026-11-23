// Retain an ordinary-key full-game recording without expanding its dense pool.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {nativePackedFrameDecoder} from './native-packed-frames.mjs';

const [input,output]=process.argv.slice(2);
assert.ok(input&&output,'Supply the raw native capture and a new fixture path');
assert.equal(fs.existsSync(output),false,'Never replace existing native recordings');
const bytes=fs.readFileSync(input),fixture=JSON.parse(bytes),scenario=fixture.cases[0],frames=fixture.recordThroughMilliseconds;
const source=JSON.parse(fs.readFileSync('three/public/source-table.json'));
assert.equal(fixture.cases.length,1);assert.equal(fixture.probeKind,'contacts');
assert.equal(fixture.sourceSha256,source.sourceTableSHA256);assert.equal(fixture.controlledSha256,fixture.sourceSha256);
assert.equal(fixture.runtimeMarkers.tableSHA256,fixture.sourceSha256);
assert.equal(fixture.nativeRandom.engineSha256,source.engineSHA256);
assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});
assert.equal(fixture.allScatterZero,undefined);assert.equal(fixture.startingProgress,undefined);assert.equal(fixture.runtimeControlledShot,undefined);
assert.equal(fixture.gameLifecycleControl.initialPoseReset,false);assert.equal(fixture.gameLifecycleControl.laterPoseResets,false);
assert.deepEqual(fixture.gameLifecycleControl.policy.actions,['launch','start','action']);
const authoredRules=fs.readFileSync('three/public/rules.vbs','utf8').replaceAll('\r','');
for(const handler of fixture.runtimeInputSequence.originalHandlers){
 const authored=authoredRules.match(new RegExp('^Sub '+handler.name+'\\b[\\s\\S]*?^End Sub','mi'));assert.ok(authored);
 const body=handler.code.replaceAll('\r','').replace(/^    If RefDriveAt>0[^\n]*\n[\s\S]*?^    End If\n/m,'').replace(/^    If RefTrailOn Then\n[\s\S]*?^    End If\n/m,'').split('\n').filter(line=>!line.includes('RefTrace')).join('\n');
 assert.equal(body,authored[0],'Every authored statement remains in '+handler.name);
}
assert.ok(Number.isInteger(frames)&&frames>=30000&&frames<=120000);
assert.equal(fixture.liveBodyState,true);assert.ok(fixture.nativeMemoryLayout.liveABI);
assert.ok(fixture.runtimeScriptClockObserver);assert.equal(scenario.actualDelay,0);
assert.equal(scenario.initialBallStates.length,4);assert.equal(scenario.initialNativeInternals.balls.length,4);
assert.equal(scenario.initialBallTrails.length,10);assert.ok(Number.isInteger(scenario.initialScriptRandom));
assert.ok(fixture.packedNativeCapture.samples>=32);assert.ok(fixture.packedNativeCapture.leaves>0);
assert.equal(fixture.nativePackedFrameStorage.pages.length,fixture.packedNativeCapture.pages);
const decode=nativePackedFrameDecoder(fixture.nativePackedFrameStorage),lives=[];let previousIDs,bodyObservations=0;
for(let i=0;i<=frames;i++){
 const row=scenario.nativeRandomFrames[i];assert.equal(row?.[0],i+1,'Every physical boundary is retained');
 for(const word of row.slice(1,3))assert.ok(Number.isInteger(word)&&word>=0&&word<=0xffffffff);
 const state=decode(row[3]);assert.ok(Number.isInteger(state.scriptRandom)&&state.scriptRandom>=0&&state.scriptRandom<16777216);
 for(const key of ['pos','speed','travelLimit','pullForce','reverseImpulse','fireTimer','fireSpeed','fireBounce'])assert.ok(Number.isFinite(state.plunger[key]));
 const ids=state.balls.map(body=>body.id);assert.equal(new Set(ids).size,ids.length);
 for(const body of state.balls)for(const [key,length]of [['position',3],['velocity',3],['momentum',3],['orientation',9]]){assert.equal(body[key].length,length);assert.ok(body[key].every(Number.isFinite));}
 if(i<frames){bodyObservations+=ids.length;if(String(ids)!==String(previousIDs))lives.push({ms:row[0],ids});previousIDs=ids;}
}
scenario.nativeRandomFrames=scenario.nativeRandomFrames.slice(0,frames+1);
scenario.samples=scenario.samples.filter(row=>row[0]<=frames);scenario.rawSamples=scenario.rawSamples.slice(0,scenario.samples.length);
for(const key of ['animationFrames','missionFrames'])scenario[key]=scenario[key].filter(row=>row[0]>0&&row[0]<=frames);
for(const key of ['scriptClocks','flipperContacts','inputSequence','initialTimerClocks','soundCalls'])scenario[key]=scenario[key].filter(row=>row.ms<=frames);
scenario.pulseTimerClocks=scenario.pulseTimerClocks.filter(ms=>ms<=frames);
assert.ok(scenario.samples.length>0);assert.ok(lives.length>=4,'Natural drains and replacement bodies were observed');
assert.deepEqual(scenario.missionFrames.map(row=>row[0]),scenario.animationFrames.map(row=>row[0]));
for(let i=1;i<scenario.animationFrames.length;i++)assert.equal(scenario.animationFrames[i][0]-scenario.animationFrames[i-1][0],scenario.animationFrames[i][1]);
const fields=Object.keys(fixture.runtimeMissionFrames.fields),at=name=>{const index=fields.indexOf(name);assert.ok(index>=0,'Required lifecycle field '+name);return index+1;};
assert.equal(fields.length,68);assert.ok(scenario.missionFrames.every(row=>row.length===fields.length+1&&row.every(Number.isFinite)));
const playing=at('playing'),ball=at('ballNumber'),games=at('games'),score=at('score'),remaining=at('remaining'),highScore=at('highScoreEntry');
assert.equal(scenario.missionFrames[0][playing],1);
const overIndex=scenario.missionFrames.findIndex(row=>row[playing]===0);assert.ok(overIndex>0,'First game reaches native game-over');
const replayIndex=scenario.missionFrames.findIndex((row,i)=>i>overIndex&&row[playing]===1);assert.ok(replayIndex>overIndex,'Ordinary Start begins a second game');
const firstGame=scenario.missionFrames.slice(0,overIndex),replay=scenario.missionFrames[replayIndex];
assert.deepEqual([...new Set(firstGame.map(row=>row[ball]))].sort(),[1,2,3],'First game naturally plays all three balls');
assert.ok(firstGame.some(row=>row[score]>0),'First game contains actual scoring');
assert.equal(replay[ball],1);assert.equal(replay[remaining],3);assert.equal(replay[score],0);
assert.equal(replay[games],scenario.missionFrames[0][games]+1);
const stateTransitions=[];let previous;
for(const row of scenario.missionFrames){const values=[playing,ball,remaining,highScore,games].map(index=>row[index]);if(String(values)!==String(previous))stateTransitions.push({ms:row[0],playing:values[0],ballNumber:values[1],remaining:values[2],highScoreEntry:values[3],games:values[4]});previous=values;}
for(const [i,input]of scenario.inputSequence.entries()){assert.equal(input.index,i);assert.ok(Number.isInteger(input.ms)&&input.ms>0);assert.ok(Number.isInteger(input.key)&&input.key>=0);assert.ok(['launch','start','action'].includes(input.action));assert.equal(typeof input.down,'boolean');if(i)assert.ok(input.ms>=scenario.inputSequence[i-1].ms);}
assert.ok(scenario.inputSequence.some(row=>row.action==='start'&&row.down&&row.ms>=scenario.missionFrames[overIndex][0]&&row.ms<=replay[0]));
assert.deepEqual(fixture.runtimeInitialTimerClocks.periods,{GIUpdateTimer:50,FinniDmdAnimationTimer:160,PulseTimer:40});
for(const [name,period]of Object.entries(fixture.runtimeInitialTimerClocks.periods)){
 const rows=scenario.initialTimerClocks.filter(row=>row.name===name);assert.ok(rows[0].ms>0&&rows[0].ms<=period);
 assert.ok(rows.every((row,i)=>row.enabled===1&&row.interval===period&&(!i||row.ms-rows[i-1].ms===period)));
 assert.equal(rows.length,Math.floor((frames-rows[0].ms)/period)+1);
 if(name==='PulseTimer')assert.deepEqual(rows.map(row=>row.ms),scenario.pulseTimerClocks);
}
for(const clock of scenario.scriptClocks){assert.equal(clock.type,4);assert.ok(Number.isFinite(clock.value));assert.equal(Math.fround(clock.value),clock.value);}
fixture.nativeRandom.requireContinuity=true;fixture.nativeRandom.continuityThroughMilliseconds=frames;fixture.nativeScriptRandom={requireContinuity:true};
fixture.timerSynchronization=true;fixture.flipperAngleScalarEncoding=true;
fixture.nativeBodyRegression={throughMilliseconds:frames,frames,positionError:0,velocityError:0,momentumError:0,orientationError:0};
fixture.nativePlungerRegression={frames,errors:Object.fromEntries(['pos','speed','travelLimit','pullForce','reverseImpulse','fireTimer','fireSpeed','fireBounce'].map(key=>[key,0]))};
fixture.animationRegression={frames:scenario.animationFrames.length};fixture.scriptClockRegression={calls:scenario.scriptClocks.length};
fixture.gameStateRegression={frames:scenario.missionFrames.length,fields};fixture.inputSequenceRegression={inputs:scenario.inputSequence.length};
fixture.lifecycleRegression=lives;fixture.fullGameRegression={gameOverMilliseconds:scenario.missionFrames[overIndex][0],replayMilliseconds:replay[0],stateTransitions,bodyObservations};
fixture.regressionLimits={[scenario.name]:{position:.00002,velocity:.000001,flipperAngle:0}};
fixture.captureSource={file:input,sha256:createHash('sha256').update(bytes).digest('hex'),scope:'Unchanged current native table and engine; ordinary authored launch, Action and Start keys only. No ball resets, qualifications, nudges or rescue calls. Initial complete bodies, trails, rod and random states plus independently observed starting timer deadlines are restored once for replay. External Timer inputs, animation clocks and executed keys are replayed at their observed boundaries; no subsequent body, random result, deadline or rule state is forced. Every native body and both random streams remain exact regression gates. Full game-over and replay are required; this recording does not by itself establish startup or uninterrupted rendered-frame parity.'};
fs.writeFileSync(output,gzipSync(Buffer.from(JSON.stringify(fixture)),{level:9}));
console.log(JSON.stringify({output,frames,bodyObservations,lifecycles:lives.length,inputs:scenario.inputSequence.length,gameOver:fixture.fullGameRegression.gameOverMilliseconds,replay:replay[0],stateTransitions,captureSHA256:fixture.captureSource.sha256}));
