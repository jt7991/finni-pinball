import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{execFileSync}from 'node:child_process';import{createHash}from 'node:crypto';
import{readReferenceFixture}from '../../scripts/reference-physics.mjs';
const triggerNames=['shooter-circle','wire-crossing','wire-overhead','circle-overhead'];
const cases=[['spinners','spinner002-forward12-complete-clocks'],['spinners','spinner001-forward24-complete-clocks'],['gates','gate001-openclose-complete-clocks'],...triggerNames.map(name=>['triggers',name+'-original-controls'])];
for(const [kind,label]of cases)test('complete native clocks retain every '+kind+' state: '+label,()=>{
 const path='three/tests/fixtures/vpx-'+label+'-native.json.gz',fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),c=fixture.cases[0],expected=fixture.nativeBodyRegression,frames=expected.frames;
 assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.sourceSha256,'6300d64767894aebcf82f378985cb63e8a540fa373365c7a82c189f78dadfd5a');assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);assert.equal(expected.bodies,frames*4);
 if(kind==='triggers'){
  const bytes=fs.readFileSync(new URL('fixtures/vpx-triggers.json',import.meta.url)),historical=JSON.parse(bytes),old=historical.cases.find(row=>row.name===c.name);assert.ok(old);
  assert.equal(fixture.isolationControlSource.sha256,createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(fixture.runtimeOverrides,historical.runtimeOverrides);assert.deepEqual(fixture.controlledOverrides,historical.controlledOverrides);
  for(const key of ['trigger','x','y','z','vx','vy','vz','sampleCount'])assert.equal(c[key],old[key],'Original declared '+key);
  assert.equal(c.samples.length,40);assert.equal(old.initialBallStates,undefined);assert.equal(old.initialNativeRandom,undefined,'Historical capture cannot initialize an exact replay');
 }
 const reportPath='.work/three-review/'+label+'-clock-regression.json';
 const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-'+kind+'.mjs',path,'--check','--json','--report='+reportPath],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.equal(r.nativeBodySummary.frames,frames);assert.equal(r.nativeBodySummary.bodies,expected.bodies);
 for(const key of ['positionError','velocityError','momentumError','orientationError','missingReferences','missingIDs','unexpectedIDs','swapMismatches'])assert.equal(r.nativeBodySummary[key],0,key);
 assert.equal(r.nativeRandomAudit.length,frames);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));
 if(r.nativeScriptRandomAudit){assert.equal(r.nativeScriptRandomAudit.length,frames);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));}else assert.deepEqual(r.nativeScriptSummary,{frames,mismatches:0});
 assert.equal(r.scriptClockInputs.consumed,fixture.clockRegression.scriptCalls);assert.equal(r.animationClockInputs.consumed,fixture.clockRegression.animationFrames);
 assert.equal(r.nativePlungerSummary.frames,frames);for(const [key,count]of Object.entries(fixture.nativePlungerRegression.observations)){assert.equal(r.nativePlungerSummary.observations[key],count);assert.equal(r.nativePlungerSummary.errors[key],0);}
 if(kind==='triggers'){assert.equal(r.membershipMismatches,0);if(c.name==='wire-crossing')assert.deepEqual(r.events.map(row=>row.event),['Hit','UnHit','Hit','UnHit']);}
 else{assert.equal(r.scoreMismatches,0);assert.equal(r.countMismatches,0);}
 assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
