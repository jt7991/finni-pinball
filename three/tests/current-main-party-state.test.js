import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

test('current main party selection, short native timeout and ensuing multiball match thirty seconds of VPX',()=>{
 const path='three/tests/fixtures/vpx-main-99eff88-qualified-mission7-30000-native.json.gz';
 const fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),scenario=fixture.cases[0];
 const qualified=readReferenceFixture(new URL('fixtures/vpx-main-99eff88-qualified-mission6-native.json.gz',import.meta.url));
 assert.equal(fixture.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(fixture.controlledSha256,fixture.sourceSha256);assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});assert.equal(fixture.allScatterZero,undefined);assert.equal(fixture.runtimeRngSites,undefined);
 assert.equal(fixture.startingProgress.battlesWon,6,'Declared initial chooser qualification; not natural mission progression');
 assert.deepEqual(scenario.controlledShot,{ms:1800,id:3,inLane:0});assert.equal(scenario.inputSequence.length,30);
 // The independently audited current-table handlers are unchanged. The new
 // capture adds read-only state fields; it does not replace authored bodies.
 assert.deepEqual(fixture.runtimeInputSequence.originalHandlers,qualified.runtimeInputSequence.originalHandlers);
 assert.deepEqual(fixture.runtimeInitialTimerClocks.handlers,qualified.runtimeInitialTimerClocks.handlers);
 assert.deepEqual(fixture.runtimeInitialTimerClocks.soundHandlers,qualified.runtimeInitialTimerClocks.soundHandlers);
 assert.equal(fixture.packedNativeCapture.samples,107);assert.equal(fixture.packedNativeCapture.leaves,14706);
 const fields=fixture.gameStateRegression.fields,index=Object.fromEntries(fields.map((name,i)=>[name,i+1]));assert.equal(fields.length,49);
 const active=scenario.missionFrames.filter(row=>row[index.active]===7);
 assert.equal(active.length,7);assert.equal(active[0][0],2516);assert.equal(active.at(-1)[0],2616);
 for(const row of active){assert.equal(row[index.partyTimerEnabled],1);assert.equal(row[index.partyTimerInterval],120);}
 const expired=scenario.missionFrames.find(row=>row[0]>2616);assert.equal(expired[0],2633);assert.equal(expired[index.active],0);assert.equal(expired[index.partyTimerEnabled],0);
 const report='.work/three-review/current-main-party-30000-regression.json';
 execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs',path,'--check','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024});
 const [result]=JSON.parse(fs.readFileSync(new URL('../../'+report,import.meta.url)));
 assert.equal(result.nativeBodySummary.frames,30000);assert.equal(result.nativeBodySummary.bodies,135803);
 for(const field of ['positionError','velocityError','momentumError','orientationError','identityMismatches','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(result.nativeBodySummary[field],0,field);
 assert.deepEqual(result.nativeBodySummary.lifecycles,fixture.lifecycleRegression);assert.equal(result.nativeBodySummary.lifecycles.length,9);
 for(const audit of [result.nativeRandomAudit,result.nativeScriptRandomAudit]){assert.equal(audit.length,30000);assert.ok(audit.every(row=>row.agrees));}
 assert.deepEqual(result.nativeFlipperSummary.angleErrors,[0,0]);assert.equal(result.nativeFlipperSummary.inputs,30);
 assert.deepEqual(result.flipperContacts,scenario.flipperContacts);assert.equal(result.flipperContacts.length,9);assert.deepEqual(result.controlledShots,[scenario.controlledShot]);
 assert.equal(result.missionSummary.frames,1798);assert.equal(result.missionSummary.mismatches,0);assert.equal(result.missionSummary.nonFiniteFields,0);
 assert.equal(result.animationSummary.frames,1798);assert.equal(result.animationSummary.offsetError,0);assert.equal(result.animationSummary.stateMismatches,0);assert.equal(result.scriptClockInputs,18);
 const last=Object.fromEntries(result.missionSummary.fields.map((name,i)=>[name,result.missionSummary.last.actual[i]]));
 for(const [field,value]of Object.entries({active:0,selected:7,choices:7,ballsOnPlayfield:1,multiball:0,partyTimerEnabled:0,partyTimerInterval:120,life7:10,score:132760}))assert.equal(last[field],value,field);
 assert.equal(result.physicsStats.substepBudgetExceeded,0);
});
