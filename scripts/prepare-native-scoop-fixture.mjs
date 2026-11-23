import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2),bytes=fs.readFileSync(input),fixture=JSON.parse(bytes),c=fixture.cases[0],frames=fixture.recordThroughMilliseconds;
assert.equal(fs.existsSync(output),false,'Preserve existing fixtures');
assert.equal(fixture.cases.length,1);assert.equal(c.name,'hellhouse-capture');assert.equal(c.actualDelay,0);
assert.equal(fixture.sourceSha256,'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a');
assert.equal(fixture.controlledSha256,fixture.sourceSha256);assert.equal(fixture.runtimeMarkers.tableSHA256,fixture.sourceSha256);
assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});assert.equal(fixture.allScatterZero,undefined);
assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.runtimeRngSites,undefined);
assert.ok(fixture.liveBodyState&&fixture.nativeMemoryLayout.liveABI);assert.equal(c.initialNativeInternals.balls.length,4);assert.equal(c.initialBallTrails.length,10);
assert.ok(frames>=6000);assert.ok(c.inputSequence.some(row=>row.action==='action'&&row.down));
for(let i=0;i<=frames;i++){assert.equal(c.nativeRandomFrames[i][0],i+1);assert.ok(Number.isInteger(c.nativeRandomFrames[i][3].scriptRandom));assert.ok(c.nativeRandomFrames[i][3].plunger);}
c.samples=c.samples.filter(row=>row[0]<=frames);c.rawSamples=c.rawSamples.slice(0,c.samples.length);
c.nativeRandomFrames=c.nativeRandomFrames.slice(0,frames+1);c.animationFrames=c.animationFrames.filter(row=>row[0]<=frames);c.missionFrames=c.missionFrames.filter(row=>row[0]<=frames);c.flipperContacts=c.flipperContacts.filter(row=>row.ms<=frames);c.scriptClocks=c.scriptClocks.filter(row=>row.ms<=frames);c.pulseTimerClocks=c.pulseTimerClocks.filter(ms=>ms<=frames);c.initialTimerClocks=c.initialTimerClocks.filter(row=>row.ms<=frames);
assert.deepEqual(c.missionFrames.map(row=>row[0]),c.animationFrames.map(row=>row[0]),'Mission observations share every real animation frame');
const names=Object.keys(fixture.runtimeMissionFrames.fields),at=name=>names.indexOf(name)+1;
assert.ok(c.missionFrames.some(row=>row[at('choosing')]===1));assert.ok(c.missionFrames.some(row=>row[at('active')]===2));assert.equal(c.missionFrames.at(-1)[at('ballsInHole')],0);
for(const [name,period]of Object.entries(fixture.runtimeInitialTimerClocks.periods)){
  const rows=c.initialTimerClocks.filter(row=>row.name===name);assert.ok(rows[0].ms>0&&rows[0].ms<=period);
  assert.ok(rows.every((row,i)=>row.interval===period&&row.enabled===1&&(!i||row.ms-rows[i-1].ms===period)));
  assert.equal(rows.length,Math.floor((frames-rows[0].ms)/period)+1);
}
fixture.nativeRandom.requireContinuity=true;fixture.nativeRandom.continuityThroughMilliseconds=frames;fixture.nativeScriptRandom={requireContinuity:true};
fixture.nativeBodyRegression={throughMilliseconds:frames,frames,positionError:0,velocityError:0,momentumError:0,orientationError:0};
fixture.nativePlungerRegression={frames,errors:Object.fromEntries(['pos','speed','travelLimit','pullForce','reverseImpulse','fireTimer','fireSpeed','fireBounce'].map(name=>[name,0]))};
fixture.regressionLimits={[c.name]:{position:.001,velocity:.000001,flipperAngle:0}};
fixture.missionRegression={inputs:c.inputSequence.length,frames:c.missionFrames.length,scriptClocks:c.scriptClocks.length};
fixture.lifecycleRegression=c.nativeRandomFrames.filter((row,i,a)=>i===0||String(row[3].balls.map(b=>b.id))!==String(a[i-1][3].balls.map(b=>b.id))).map(row=>({ms:row[0],ids:row[3].balls.map(b=>b.id)}));assert.equal(fixture.lifecycleRegression.length,3);
fixture.captureSource={file:input,sha256:createHash('sha256').update(bytes).digest('hex'),scope:'Physical controlled scoop approach on original authored geometry and scatter. Eight ordinary named key transitions select mission2 and return to play. Every initial live body/history/rod/RNG and actual starting timer deadline is restored once; native Timer inputs and animation clocks remain external inputs. Every subsequent live-body component and RNG boundary is compared strictly, with no fitted phase, native rule-state injection, rescue or per-frame correction. Seventeen independently read mission variables are checked at each native frame. Post-initialization gameplay only; no complete startup or uninterrupted pixel-equivalence claim.'};
fs.writeFileSync(output,gzipSync(Buffer.from(JSON.stringify(fixture)),{level:9}));
console.log(JSON.stringify({output,frames,missionFrames:c.missionFrames.length,bodyObservations:c.nativeRandomFrames.slice(0,frames).reduce((n,row)=>n+row[3].balls.length,0),lifecycle:fixture.lifecycleRegression,captureSHA256:fixture.captureSource.sha256}));
