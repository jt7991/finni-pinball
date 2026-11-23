import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';

test('ordinary native controls reproduce a complete three-ball game, high-score entry and replay at every boundary',()=>{
 const root=new URL('../../',import.meta.url),path='three/tests/fixtures/vpx-main-99eff88-natural-game-replay-120000-native.json.gz';
 // Keep the verified dense transport intact; the comparator decodes the
 // original reader shape before observing any model state.
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL(path,root)))),scenario=fixture.cases[0];
 assert.equal(fixture.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');
 assert.equal(fixture.controlledSha256,fixture.sourceSha256);assert.equal(fixture.runtimeMarkers.tableSHA256,fixture.sourceSha256);
 assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(fixture.gameLifecycleControl.initialPoseReset,false);assert.equal(fixture.gameLifecycleControl.laterPoseResets,false);
 assert.equal(fixture.startingProgress,undefined);assert.equal(fixture.runtimeControlledShot,undefined);assert.equal(fixture.allScatterZero,undefined);
 assert.deepEqual(fixture.controlledOverrides,{});assert.deepEqual(fixture.runtimeOverrides,{});
 assert.equal(fixture.nativeBodyRegression.frames,120000);assert.equal(fixture.gameStateRegression.fields.length,68);
 assert.equal(fixture.fullGameRegression.gameOverMilliseconds,108943);assert.equal(fixture.fullGameRegression.replayMilliseconds,109944);
 assert.equal(fixture.lifecycleRegression.length,12);assert.equal(scenario.inputSequence.length,26);assert.equal(scenario.flipperContacts.length,13);
 assert.ok(scenario.inputSequence.every(row=>['launch','start','action'].includes(row.action)));
 const output='.work/three-review/natural-game-replay-120000-regression.json';
 execFileSync(process.execPath,['--max-old-space-size=8192','scripts/compare-vpx-contact.mjs',path,'--check','--report='+output],{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
 const [report]=JSON.parse(fs.readFileSync(new URL(output,root)));
 assert.equal(report.nativeBodySummary.frames,120000);assert.equal(report.nativeBodySummary.bodies,452355);
 for(const key of ['positionError','velocityError','momentumError','orientationError','identityMismatches','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(report.nativeBodySummary[key],0,key);
 assert.deepEqual(report.nativeBodySummary.lifecycles,fixture.lifecycleRegression);
 assert.deepEqual(report.fullGameTransitions,fixture.fullGameRegression.stateTransitions);
 for(const rows of [report.nativeRandomAudit,report.nativeScriptRandomAudit]){assert.equal(rows.length,120000);assert.ok(rows.every(row=>row.agrees));}
 assert.equal(report.nativePlungerSummary.frames,120000);assert.ok(Object.values(report.nativePlungerSummary.errors).every(error=>error===0));
 assert.equal(report.missionSummary.frames,7192);assert.equal(report.missionSummary.mismatches,0);assert.equal(report.missionSummary.nonFiniteFields,0);
 assert.equal(report.animationSummary.frames,7192);assert.equal(report.animationSummary.offsetError,0);assert.equal(report.animationSummary.stateMismatches,0);
 assert.deepEqual(report.flipperContacts,scenario.flipperContacts);assert.equal(report.inputCount,26);assert.equal(report.scriptClockInputs,39);
 assert.equal(report.soundCalls.length,173);assert.deepEqual(report.soundCalls,scenario.soundCalls);
 assert.equal(report.maxFlipperAngleError,0);assert.equal(report.physicsStats.substepBudgetExceeded,0);
});
