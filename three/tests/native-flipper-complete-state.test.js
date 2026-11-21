import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

for(const [side,frames]of [['left',167],['right',185]])test(`native ${side} tip shot preserves sampled flipper angles and every recorded ball state`,()=>{
  const path=`three/tests/fixtures/vpx-${side}-tip-complete-state.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url));
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.cases[0].actualDelay,40);assert.equal(fixture.inputScheduling.kind,'native-flipper-timer');
  assert.ok(fixture.flipperAngleScalarEncoding);assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
  const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs',path,'--check','--json',`--report=.work/three-review/flipper-${side}-complete-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024}));
  assert.equal(report.samples.length,12);assert.equal(report.maxFlipperAngleError,0);
  assert.equal(report.nativeBodySummary.frames,frames);assert.equal(report.nativeBodySummary.bodies,frames*4);
  for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(report.nativeBodySummary[key],0,key);
  assert.equal(report.nativeRandomAudit.length,frames);assert.ok(report.nativeRandomAudit.every(row=>row.agrees));
  assert.equal(report.nativeScriptRandomAudit.length,frames);assert.ok(report.nativeScriptRandomAudit.every(row=>row.agrees));
  assert.equal(report.nativePlungerSummary.frames,frames);
  for(const [key,value]of Object.entries(report.nativePlungerSummary.errors)){assert.equal(value,0,key);assert.equal(report.nativePlungerSummary.observations[key],frames,key+' coverage');}
});
