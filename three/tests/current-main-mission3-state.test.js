import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

test('current main mission 3 gate progress and ensuing ball lifecycles match thirty seconds of VPX',()=>{
 const path='three/tests/fixtures/vpx-main-99eff88-mission3-30000-native.json.gz';
 const fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),scenario=fixture.cases[0];
 const prior=readReferenceFixture(new URL('fixtures/vpx-main-99eff88-qualified-mission6-native.json.gz',import.meta.url));
 assert.equal(fixture.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(fixture.controlledSha256,fixture.sourceSha256);assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});assert.equal(fixture.allScatterZero,undefined);assert.equal(fixture.runtimeRngSites,undefined);
 assert.equal(fixture.startingProgress,undefined,'Mission 3 is available without injected qualification');
 assert.deepEqual(scenario.controlledShot,{ms:1800,id:3,inLane:0});assert.equal(scenario.inputSequence.length,32);
 assert.deepEqual(fixture.runtimeInputSequence.originalHandlers,prior.runtimeInputSequence.originalHandlers);
 assert.deepEqual(fixture.runtimeInitialTimerClocks.handlers,prior.runtimeInitialTimerClocks.handlers);
 assert.deepEqual(fixture.runtimeInitialTimerClocks.soundHandlers,prior.runtimeInitialTimerClocks.soundHandlers);
 assert.equal(fixture.packedNativeCapture.samples,95);assert.equal(fixture.packedNativeCapture.leaves,11700);
 const index=Object.fromEntries(fixture.gameStateRegression.fields.map((name,i)=>[name,i+1]));assert.equal(fixture.gameStateRegression.fields.length,49);
 assert.deepEqual([...new Set(scenario.missionFrames.map(row=>row[index.active]))],[0,3]);
 assert.deepEqual([...new Set(scenario.missionFrames.map(row=>row[index.life3]))],[10,9.5,9,8.5,8,7.5,7]);
 const report='.work/three-review/current-main-mission3-30000-regression.json';
 execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs',path,'--check','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024});
 const [result]=JSON.parse(fs.readFileSync(new URL('../../'+report,import.meta.url)));
 assert.equal(result.nativeBodySummary.frames,30000);assert.equal(result.nativeBodySummary.bodies,112973);
 for(const field of ['positionError','velocityError','momentumError','orientationError','identityMismatches','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(result.nativeBodySummary[field],0,field);
 assert.deepEqual(result.nativeBodySummary.lifecycles,fixture.lifecycleRegression);assert.equal(result.nativeBodySummary.lifecycles.length,6);
 for(const audit of [result.nativeRandomAudit,result.nativeScriptRandomAudit]){assert.equal(audit.length,30000);assert.ok(audit.every(row=>row.agrees));}
 assert.deepEqual(result.nativeFlipperSummary.angleErrors,[0,0]);assert.equal(result.nativeFlipperSummary.inputs,32);
 assert.deepEqual(result.flipperContacts,scenario.flipperContacts);assert.equal(result.flipperContacts.length,7);assert.deepEqual(result.controlledShots,[scenario.controlledShot]);
 assert.equal(result.missionSummary.frames,1798);assert.equal(result.missionSummary.mismatches,0);assert.equal(result.missionSummary.nonFiniteFields,0);
 assert.equal(result.animationSummary.frames,1798);assert.equal(result.animationSummary.offsetError,0);assert.equal(result.animationSummary.stateMismatches,0);assert.equal(result.scriptClockInputs,6);
 const last=Object.fromEntries(result.missionSummary.fields.map((name,i)=>[name,result.missionSummary.last.actual[i]]));
 for(const [field,value]of Object.entries({active:0,selected:3,choices:3,ballsOnPlayfield:0,multiball:0,battlesWon:0,life3:7,score:151010,playing:1}))assert.equal(last[field],value,field);
 assert.equal(result.physicsStats.substepBudgetExceeded,0);
});
