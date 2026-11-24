import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

const profile='three/tests/fixtures/vpx-contact.json';
const bytes=fs.readFileSync(new URL('../../'+profile,import.meta.url));
const historical=JSON.parse(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
assert.equal(historical.cases.length,11);
assert.equal(historical.nativeRuleState.selectionBallCount,3);

for(const exactClock of [false,true])for(const old of historical.cases){
 if(exactClock&&!old.actualDelay)continue;
 const label=old.name+(exactClock?'-historical-input-clock':'-original-raw');
 test('complete native raw contact '+old.name+(exactClock?' at original observed input delay':''),()=>{
  const file='three/tests/fixtures/vpx-'+label+'-native.json.gz';
  const fixture=readReferenceFixture(new URL('../../'+file,import.meta.url)),c=fixture.cases[0],expected=fixture.nativeBodyRegression;
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.sourceSha256,historical.sourceSha256);
  assert.equal(fixture.comparisonProfile.sha256,sha256);
  assert.deepEqual(fixture.runtimeOverrides,historical.runtimeOverrides);
  assert.deepEqual(fixture.controlledOverrides,historical.controlledOverrides);
  for(const key of ['name','side','delay','startRaised','press','x','y','z','vx','vy','vz','sampleCount'])assert.equal(c[key],old[key],'Original declared '+key);
  for(const key of ['measuredBallIndex','measuredBallRole','rollingTimerEnabled','lockedBallOffset'])assert.equal(fixture.nativeRuleState[key],historical.nativeRuleState[key]);
  // The old selector saw three bodies; it did not observe the full set at reset.
  // Preserve the selected animation body and compare the independently observed
  // four live bodies, including the subsequently created playable ball.
  assert.equal(fixture.nativeRuleState.ballCount,4);
  assert.equal(c.initialBallStates.length,4);
  assert.equal(c.initialMeasuredBallID,c.initialBallStates[2][fixture.initialBallStateColumns.indexOf('ID')]);
  assert.equal(old.initialBallStates,undefined);
  assert.equal(old.initialNativeRandom,undefined);
  assert.ok(c.samples.length>=old.samples.length);
  assert.ok(expected.throughMilliseconds>=old.samples.at(-1)[0]);
  assert.equal(fixture.nativeRandom.requireContinuity,true);
  assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
  if(exactClock){
   assert.equal(fixture.comparisonProfile.historicalExecutedInputDelay,old.actualDelay);
   assert.deepEqual(fixture.inputScheduling,{kind:'native-flipper-timer',requestedDelay:old.actualDelay});
   assert.equal(c.actualDelay,old.actualDelay);
  }else assert.deepEqual(fixture.inputScheduling,{kind:'vpmtimer'});
  const report='.work/three-review/'+label+'-regression.json';
  const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs',file,'--check','--json','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(r.nativeBodySummary.frames,expected.frames);
  assert.equal(r.nativeBodySummary.bodies,expected.bodies);
  assert.equal(expected.bodies,4*expected.frames);
  for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches','identityMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
  for(const key of ['nativeRandomAudit','nativeScriptRandomAudit']){assert.equal(r[key].length,expected.frames);assert.ok(r[key].every(row=>row.agrees));}
  assert.equal(r.scriptClockInputs,fixture.scriptClockRegression.calls);
  assert.deepEqual(r.animationSummary,{frames:fixture.animationRegression.frames,offsetError:0,stateMismatches:0});
  assert.equal(r.nativePlungerSummary.frames,expected.frames);
  for(const key of Object.keys(fixture.nativePlungerRegression.errors)){assert.equal(r.nativePlungerSummary.observations[key],expected.frames);assert.equal(r.nativePlungerSummary.errors[key],0,key);}
  assert.equal(r.maxFlipperAngleError,0);
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
 });
}
