import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{execFileSync}from 'node:child_process';import{createHash}from 'node:crypto';
import{readReferenceFixture}from '../../scripts/reference-physics.mjs';
const profiles=[{file:'vpx-geometry.json',rotated:false},{file:'vpx-camera-animation.json',rotated:true}];
for(const profile of profiles){
 const bytes=fs.readFileSync(new URL('fixtures/'+profile.file,import.meta.url)),historical=JSON.parse(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(historical.cases.length,profile.rotated?1:6);
 for(const old of historical.cases)test('complete original geometry retains '+old.name+(profile.rotated?' with Camera1.RotY=90':''),()=>{
  const label=old.name+(profile.rotated?'-rotated':'')+'-original-geometry',file='three/tests/fixtures/vpx-'+label+'-native.json.gz',fixture=readReferenceFixture(new URL('../../'+file,import.meta.url)),c=fixture.cases[0],expected=fixture.nativeBodyRegression,frames=expected.frames;
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.comparisonProfile.sha256,sha256);assert.equal(fixture.sourceSha256,historical.sourceSha256);assert.deepEqual(fixture.runtimeOverrides,historical.runtimeOverrides);assert.deepEqual(fixture.controlledOverrides,historical.controlledOverrides);assert.deepEqual(fixture.nativeRuleState,historical.nativeRuleState);
  for(const key of ['name','x','y','z','vx','vy','vz','sampleCount'])assert.equal(c[key],old[key],'Original declared '+key);
  assert.ok(c.samples.length>=old.samples.length);assert.ok(frames>=old.samples.at(-1)[0],'Entire original path retained');assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);assert.equal(old.initialBallStates,undefined);assert.equal(old.initialNativeRandom,undefined);
  if(profile.rotated)assert.equal(fixture.runtimeOverrides['Camera1.RotY'],90);
  const report='.work/three-review/'+label+'-regression.json';
  const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs',file,'--check','--json','--report='+report],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(r.nativeBodySummary.frames,frames);assert.equal(r.nativeBodySummary.bodies,expected.bodies);assert.equal(expected.bodies,4*frames);
  for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches','identityMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
  assert.equal(r.nativeRandomAudit.length,frames);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));assert.equal(r.nativeScriptRandomAudit.length,frames);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));
  assert.equal(r.scriptClockInputs,fixture.scriptClockRegression.calls);assert.deepEqual(r.animationSummary,{frames:fixture.animationRegression.frames,offsetError:0,stateMismatches:0});assert.equal(r.nativePlungerSummary.frames,frames);
  for(const key of Object.keys(fixture.nativePlungerRegression.errors)){assert.equal(r.nativePlungerSummary.observations[key],frames);assert.equal(r.nativePlungerSummary.errors[key],0,key);}
  assert.equal(r.physicsStats.substepBudgetExceeded,0);assert.equal(r.maxFlipperAngleError,0);
 });
}
