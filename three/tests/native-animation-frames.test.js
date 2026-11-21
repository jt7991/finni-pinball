import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

for(const [name,stem,physicsFrames,renderFrames]of [['face','target010-face',984,59],['corner','target010-corner',885,53],['pocket hold','target011-pocket-hold',18021,1080]])test(`native target ${name} preserves observed frame timing, all body states and both random streams`,()=>{
  const path=`three/tests/fixtures/vpx-${stem}-animation-frames.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url));
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
  const report=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-animation-frames.mjs',path,'--check',`--report=.work/three-review/animation-${name}-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024}));
  assert.equal(report.bodyFrames,physicsFrames);assert.equal(report.bodies,physicsFrames*4);assert.equal(report.frames,renderFrames);
  assert.equal(report.animationError,0);assert.equal(report.stateMismatches,0);assert.equal(report.scriptFrames,physicsFrames);
  assert.equal(report.firstRandomMismatch,null);assert.equal(report.firstScriptRandomMismatch,null);
  for(const error of Object.values(report.bodyErrors))assert.equal(error,0);
  if(fixture.holdEvidence){
    const scenario=fixture.cases[0],dropped=scenario.samples.find(row=>row[14]),travel=scenario.samples.find(row=>Math.hypot(row[1]-scenario.x,row[2]-scenario.y)>35);
    assert.equal(dropped[0],fixture.holdEvidence.firstPublicDroppedMilliseconds);
    assert.equal(travel[0],fixture.holdEvidence.firstPublicTravelOver35VPUMilliseconds);
    assert.ok(dropped[0]>=16000,'native hold remains present until the authored hurry-up expires');
  }
});
