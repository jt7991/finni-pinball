// Preserve a complete native launch capture and its externally observed clocks.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2);assert.ok(input&&output,'Supply raw capture and new fixture path');const bytes=fs.readFileSync(input),fixture=JSON.parse(bytes),scenario=fixture.cases[0],frames=fixture.recordThroughMilliseconds;
assert.equal(fs.existsSync(output),false,'Preserve existing native recordings');
const requestedSource=process.argv.find(arg=>arg.startsWith('--source-sha256='))?.slice(16);
if(requestedSource)assert.equal(requestedSource,JSON.parse(fs.readFileSync('three/public/source-table.json')).sourceTableSHA256,'Explicit current-table source provenance');
assert.equal(fixture.cases.length,1);
if(fixture.runtimeMarkers){
 assert.equal(fixture.controlledSha256,requestedSource??'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a');
 assert.equal(fixture.sourceSha256,fixture.controlledSha256);
 assert.equal(fixture.runtimeMarkers.tableSHA256,fixture.sourceSha256);
 assert.equal(fixture.allScatterZero,undefined);
 assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});
}else assert.equal(fixture.controlledSha256,'b6652d58e47924a6ae1652963123b1b95e147167f27df330c302b6da2ba209af');
assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(scenario.actualDelay,600);assert.ok(Number.isInteger(frames)&&frames>=3000);assert.ok(fixture.runtimeScriptClockObserver);assert.ok(scenario.initialNativeInternals.plunger);assert.equal(scenario.initialNativeInternals.balls.length,4);assert.equal(scenario.initialBallTrails.length,10);assert.ok(Number.isInteger(scenario.initialScriptRandom));
for(let i=0;i<=frames;i++){const row=scenario.nativeRandomFrames[i];assert.equal(row[0],i+1);if(!fixture.liveBodyState)assert.equal(row[3].balls.length,4);assert.ok(Number.isInteger(row[3].scriptRandom));assert.ok(row[3].plunger);}
scenario.samples=scenario.samples.filter(row=>row[0]<=frames);scenario.rawSamples=scenario.rawSamples.slice(0,scenario.samples.length);scenario.nativeRandomFrames=scenario.nativeRandomFrames.slice(0,frames+1);scenario.animationFrames=scenario.animationFrames.filter(row=>row[0]<=frames);scenario.scriptClocks=scenario.scriptClocks.filter(row=>row.ms<=frames);
if(scenario.missionFrames){
 scenario.missionFrames=scenario.missionFrames.filter(row=>row[0]<=frames);
 assert.deepEqual(scenario.missionFrames.map(row=>row[0]),scenario.animationFrames.map(row=>row[0]),'All observed game-state frames share the native animation clock');
 fixture.gameStateRegression={frames:scenario.missionFrames.length,fields:Object.keys(fixture.runtimeMissionFrames.fields)};
}
if(scenario.inputSequence){
 assert.ok(fixture.liveBodyState&&fixture.nativeMemoryLayout.liveABI);assert.ok(scenario.inputSequence.every(input=>input.ms<=frames));assert.ok(scenario.flipperContacts.some(row=>row.side==='left')&&scenario.flipperContacts.some(row=>row.side==='right'));scenario.flipperContacts=scenario.flipperContacts.filter(row=>row.ms<=frames);
 scenario.pulseTimerClocks=scenario.pulseTimerClocks.filter(ms=>ms<=frames);assert.ok(scenario.pulseTimerClocks.length>100);for(let i=1;i<scenario.pulseTimerClocks.length;i++)assert.equal(scenario.pulseTimerClocks[i]-scenario.pulseTimerClocks[i-1],40);
 fixture.inputSequenceRegression={inputs:scenario.inputSequence.length,angleFrames:scenario.samples.length};fixture.lifecycleRegression=scenario.nativeRandomFrames.filter((row,i,a)=>i===0||String(row[3].balls.map(b=>b.id))!==String(a[i-1][3].balls.map(b=>b.id))).map(row=>({ms:row[0],ids:row[3].balls.map(b=>b.id)}));assert.ok(fixture.lifecycleRegression.length>1,'actual native body replacement observed');
}
if(scenario.initialTimerClocks){
 scenario.initialTimerClocks=scenario.initialTimerClocks.filter(row=>row.ms<=frames);
 assert.deepEqual(fixture.runtimeInitialTimerClocks.periods,{GIUpdateTimer:50,FinniDmdAnimationTimer:160,PulseTimer:40});
 for(const [name,period]of Object.entries(fixture.runtimeInitialTimerClocks.periods)){
  const rows=scenario.initialTimerClocks.filter(row=>row.name===name);assert.ok(rows[0].ms>0&&rows[0].ms<=period);assert.ok(rows.every((row,i)=>row.enabled===1&&row.interval===period&&(!i||row.ms-rows[i-1].ms===period)));assert.equal(rows.length,Math.floor((frames-rows[0].ms)/period)+1);if(name==='PulseTimer'&&scenario.pulseTimerClocks)assert.equal(rows[0].ms,scenario.pulseTimerClocks[0]);
 }
}
assert.ok(scenario.scriptClocks.length>=2);for(const clock of scenario.scriptClocks){assert.equal(clock.type,4);assert.ok(Number.isFinite(clock.value));assert.equal(Math.fround(clock.value),clock.value);}
for(let i=1;i<scenario.animationFrames.length;i++)assert.equal(scenario.animationFrames[i][0]-scenario.animationFrames[i-1][0],scenario.animationFrames[i][1]);
const lastScore=scenario.animationFrames.at(-1)[8];assert.ok(lastScore>0,'capture reaches real scoring contacts');
fixture.nativeRandom.requireContinuity=true;fixture.nativeRandom.continuityThroughMilliseconds=frames;fixture.nativeScriptRandom={requireContinuity:true};fixture.nativeBodyRegression={throughMilliseconds:frames,frames,positionError:0,velocityError:0,momentumError:0,orientationError:0};fixture.nativePlungerRegression={frames,observations:Object.fromEntries(['pos','speed','travelLimit','pullForce','reverseImpulse','fireTimer','fireSpeed','fireBounce'].map(key=>[key,frames])),errors:Object.fromEntries(['pos','speed','travelLimit','pullForce','reverseImpulse','fireTimer','fireSpeed','fireBounce'].map(key=>[key,0]))};fixture.animationRegression={frames:scenario.animationFrames.length,lastScore};fixture.scriptClockRegression={calls:scenario.scriptClocks.length};
fixture.captureSource={file:input,sha256:createHash('sha256').update(bytes).digest('hex'),scope:'Extended controlled launch on the full authored geometry with scatter explicitly zeroed. Every initial body, history, rod and both RNG states restored once. The original native Timer inputs and animation clocks are replayed as external inputs; no subsequent pose/RNG correction or fitted phase. The diagnostic RndNbr declaration retains its sole original Timer read, native Single type, Randomize and Rnd. This covers the recorded post-initialization launch, scoring contacts and frame events; it does not establish complete startup or uninterrupted whole-game parity.'};
if(fixture.runtimeMarkers)fixture.captureSource.scope='Extended controlled launch on the original authored table with all source scatter retained. The original VPX file and engine bytes are unchanged. Diagnostic callbacks are installed after startup through the native evaluator, retaining every authored flipper/rolling timer statement. Every observed initial live body, history, rod and both RNG states is restored once. Original Timer inputs and animation clocks are replayed as external inputs; no subsequent body/RNG correction or fitted phase. This covers the recorded post-initialization launch, scoring and ball lifecycle; it does not establish complete startup or uninterrupted rendering parity.';
if(fixture.liveBodyState)fixture.captureSource.scope+=' Live Player::m_vball identities and addresses are validated against initial public GetBalls, original compiled getters and self pointers, then read afresh at each native boundary. The recorded named table actions run at their observed clocks before the authored LeftFlipper_Timer body, matching the native input driver. Actual Collide callbacks are retained. Only starting timer deadlines are restored from independently observed callbacks; subsequent deadlines and native queue callbacks are never forced. Replay body/RNG observations use the same end-of-LeftFlipper_Timer phase as the native marker, before later RollingTimer controls. Every recorded downstream body and random-state comparison remains an exact gate.';
fs.writeFileSync(output,gzipSync(Buffer.from(JSON.stringify(fixture)),{level:9}));console.log(JSON.stringify({output,frames,bodyObservations:scenario.nativeRandomFrames.slice(0,frames).reduce((n,row)=>n+row[3].balls.length,0),animationFrames:fixture.animationRegression.frames,clockInputs:fixture.scriptClockRegression.calls,lastScore,captureSHA256:fixture.captureSource.sha256}));
