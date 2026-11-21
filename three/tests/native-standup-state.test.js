import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';

for(const [name,frames,renderFrames]of [['left-point',984,59],['left-face',984,59],['right-face',1002,60],['angled-face',1000,60]])test(`native stand-up ${name} preserves every retained frame, ball state and both random streams`,()=>{
  const path=`three/tests/fixtures/vpx-standup-${name}-native-state.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url)),scenario=fixture.cases[0];
  assert.equal(fixture.nativeRandom.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeScriptRandom.requireContinuity,true);
  assert.equal(fixture.animationRegression.endMilliseconds,scenario.nativeRandomFrames.at(-1)[0]);assert.equal(scenario.nativeRandomFrames.length,frames);
  const target=fixture.instrumentation.animationFrameTrace.targets.indexOf(scenario.target);assert.ok(target>=0);
  const offsets=scenario.animationFrames.map(row=>row[2+target]);
  if(name==='left-point'){assert.ok(offsets.every(offset=>offset===0));assert.ok(scenario.animationFrames.some(row=>row[8]>0),'native vertex hit scores without a bounce');}
  else{assert.equal(Math.max(...offsets),13);assert.ok(offsets.some(offset=>offset>0&&offset<13));assert.equal(offsets.at(-1),0);}
  const report=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-animation-frames.mjs',path,'--check',`--report=.work/three-review/standup-${name}-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024}));
  assert.equal(report.bodyFrames,frames);assert.equal(report.bodies,frames*4);assert.equal(report.frames,renderFrames);
  assert.equal(report.animationError,0);assert.equal(report.stateMismatches,0);assert.equal(report.scriptFrames,frames);
  assert.equal(report.firstRandomMismatch,null);assert.equal(report.firstScriptRandomMismatch,null);
  for(const error of Object.values(report.bodyErrors))assert.equal(error,0);
});
