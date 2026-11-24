import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{execFileSync}from 'node:child_process';import{createHash}from 'node:crypto';
import{readReferenceFixture}from '../../scripts/reference-physics.mjs';
const historicalBytes=fs.readFileSync(new URL('fixtures/vpx-gates.json',import.meta.url)),historical=JSON.parse(historicalBytes),profileSHA256=createHash('sha256').update(historicalBytes).digest('hex');
assert.equal(historical.cases.length,20);assert.equal(historical.cases.reduce((n,c)=>n+c.sampleCount,0),2400);assert.equal(historical.cases.filter(c=>c.name.endsWith('-overhead')).length,4);assert.equal(historical.cases.filter(c=>c.name.endsWith('-open-close')).length,4);
for(const old of historical.cases)test('complete original gate controls retain '+old.name,()=>{
 const label=old.name.toLowerCase()+'-original-controls',file='three/tests/fixtures/vpx-'+label+'-native.json.gz',fixture=readReferenceFixture(new URL('../../'+file,import.meta.url)),c=fixture.cases[0],expected=fixture.nativeBodyRegression,frames=expected.frames;
 assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceSha256,historical.sourceSha256);assert.equal(fixture.isolationControlSource.sha256,profileSHA256);assert.deepEqual(fixture.runtimeOverrides,historical.runtimeOverrides);assert.deepEqual(fixture.controlledOverrides,historical.controlledOverrides);assert.deepEqual(fixture.nativeRuleState,historical.nativeRuleState);assert.deepEqual(fixture.nativeGateProperties,historical.nativeGateProperties);
 for(const key of ['name','gate','x','y','z','vx','vy','vz','direction','open','closeDelay','sampleCount','parkFromSample'])assert.equal(c[key],old[key],'Original declared '+key);
 assert.deepEqual(c.runtimeOverrides,old.runtimeOverrides);assert.equal(c.samples.length,120);assert.equal(old.initialBallStates,undefined);assert.equal(old.initialNativeRandom,undefined);assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
 const report='.work/three-review/'+label+'-regression.json';
 const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-gates.mjs',file,'--check','--json','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.equal(r.samples.length,120);assert.equal(r.nativeBodySummary.frames,frames);assert.equal(r.nativeBodySummary.bodies,expected.bodies);assert.equal(expected.bodies,4*frames);
 for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
 assert.equal(r.nativeRandomAudit.length,frames);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));assert.deepEqual(r.nativeScriptSummary,{frames,mismatches:0});
 assert.equal(r.scriptClockInputs.consumed,fixture.clockRegression.scriptCalls);assert.equal(r.animationClockInputs.consumed,fixture.clockRegression.animationFrames);
 assert.equal(r.nativePlungerSummary.frames,frames);for(const [key,count]of Object.entries(fixture.nativePlungerRegression.observations)){assert.equal(r.nativePlungerSummary.observations[key],count);assert.equal(r.nativePlungerSummary.errors[key],0,key);}
 assert.equal(r.scoreMismatches,0);assert.equal(r.countMismatches,0);assert.equal(r.physicsStats.substepBudgetExceeded,0);
 if(old.name.endsWith('-open-close')){assert.ok(c.actualCloseDelay>0);assert.ok(r.samples.some(row=>row.expectedAngle>0));assert.equal(r.samples.at(-1).expectedAngle,0,'Original gate closes completely');}
});
