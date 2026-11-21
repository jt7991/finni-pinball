import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

for(const [direction,frames]of [['forward',3604],['reverse',1969]])test(`complete native Gate002 ${direction} recording preserves flap motion and every body's state`,()=>{
  const path=`three/tests/fixtures/vpx-gate002-${direction}-native-state.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url));
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.nativeRandom.continuityThroughMilliseconds,frames);
  const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-gates.mjs',path,'--check','--json',`--report=.work/three-review/gate002-${direction}-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024}));
  assert.equal(report.samples.length,120);assert.equal(report.nativeBodySummary.frames,frames);assert.equal(report.nativeBodySummary.bodies,4*frames);
  for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(report.nativeBodySummary[key],0,key+' at every native physics frame');
  assert.equal(report.nativeRandomAudit.length,frames);assert.ok(report.nativeRandomAudit.every(row=>row.agrees));
  if(direction==='reverse')assert.ok(report.samples.some(sample=>sample.angle>80),'the flap crosses EOS and coasts through repeated source rebounds');
});
