import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{execFileSync}from 'node:child_process';import{createHash}from 'node:crypto';
import{readReferenceFixture}from '../../scripts/reference-physics.mjs';
const historicalBytes=fs.readFileSync(new URL('fixtures/vpx-spinners.json',import.meta.url)),historical=JSON.parse(historicalBytes),profileSHA256=createHash('sha256').update(historicalBytes).digest('hex');
assert.equal(historical.cases.length,10);assert.equal(historical.cases.reduce((n,c)=>n+c.sampleCount,0),1560);
for(const old of historical.cases)test('complete original spinner controls retain '+old.name,()=>{
 const label=old.name.toLowerCase()+'-original-controls',file='three/tests/fixtures/vpx-'+label+'-native.json.gz',fixture=readReferenceFixture(new URL('../../'+file,import.meta.url)),c=fixture.cases[0],expected=fixture.nativeBodyRegression,frames=expected.frames;
 assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceSha256,historical.sourceSha256);assert.equal(fixture.isolationControlSource.sha256,profileSHA256);assert.deepEqual(fixture.runtimeOverrides,historical.runtimeOverrides);assert.deepEqual(fixture.controlledOverrides,historical.controlledOverrides);
 assert.deepEqual(fixture.nativeRuleState,historical.nativeRuleState);assert.deepEqual(fixture.nativeSpinnerProperties,historical.nativeSpinnerProperties);
 for(const key of ['name','spinner','x','y','z','vx','vy','vz','direction','speed','sampleCount','parkFromSample'])assert.equal(c[key],old[key],'Original declared '+key);
 assert.equal(c.samples.length,old.sampleCount);assert.equal(old.initialBallStates,undefined);assert.equal(old.initialNativeRandom,undefined);assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
 const report='.work/three-review/'+label+'-regression.json';
 const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-spinners.mjs',file,'--check','--json','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.equal(r.samples.length,old.sampleCount);assert.equal(r.nativeBodySummary.frames,frames);assert.equal(r.nativeBodySummary.bodies,expected.bodies);assert.equal(expected.bodies,4*frames);
 for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
 assert.equal(r.nativeRandomAudit.length,frames);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));assert.equal(r.nativeScriptRandomAudit.length,frames);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));
 assert.equal(r.scriptClockInputs.consumed,fixture.clockRegression.scriptCalls);assert.equal(r.animationClockInputs.consumed,fixture.clockRegression.animationFrames);
 assert.equal(r.nativePlungerSummary.frames,frames);for(const [key,count]of Object.entries(fixture.nativePlungerRegression.observations)){assert.equal(r.nativePlungerSummary.observations[key],count);assert.equal(r.nativePlungerSummary.errors[key],0,key);}
 assert.equal(r.scoreMismatches,0);assert.equal(r.countMismatches,0);if(old.name.includes('overhead'))assert.equal(r.spins,0);if(old.name.includes('forward-24'))assert.equal(r.spins,9);assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
