import test from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{readReferenceFixture}from'../../scripts/reference-physics.mjs';

for(const [name,frames,delay,trailing]of [['left-105-40',185,21,0],['left-35-0',202,0,35]])test(`native raw flipper ${name} retains all body states and both RNG streams`,()=>{
  const path=`three/tests/fixtures/vpx-raw-${name}-complete-native-state.json.gz`,fixture=readReferenceFixture(new URL('../../'+path,import.meta.url)),c=fixture.cases[0];
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
  assert.equal(c.actualDelay,delay);assert.equal(c.nativeRandomFrames.length,frames);assert.equal(c.nativeRandomFrames.at(-1)[0],frames);assert.equal(frames-c.samples.at(-1)[0],trailing);assert.equal(fixture.nativeBodyRegression.throughMilliseconds,frames);
  const [r]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs',path,'--check','--json',`--report=.work/three-review/raw-${name}-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024}));
  assert.equal(r.nativeBodySummary.frames,frames);assert.equal(r.nativeBodySummary.bodies,frames*4);
  for(const field of ['positionError','velocityError','momentumError','orientationError'])assert.equal(r.nativeBodySummary[field],0);
  assert.equal(r.nativeRandomAudit.length,frames);assert.ok(r.nativeRandomAudit.every(row=>row.agrees));assert.equal(r.nativeScriptRandomAudit.length,frames);assert.ok(r.nativeScriptRandomAudit.every(row=>row.agrees));
  for(const [field,value]of Object.entries(r.nativePlungerSummary.errors)){assert.equal(value,0);assert.equal(r.nativePlungerSummary.observations[field],frames);}
  assert.equal(r.maxFlipperAngleError,0);assert.equal(r.physicsStats.substepBudgetExceeded,0);
});
