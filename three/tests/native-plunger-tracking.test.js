import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {Plunger} from '../plunger.js';

test('plunger tracking spring matches unchanged native UpdateVelocities and GetPosition outputs',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-plunger-compiled-tracking.json',import.meta.url));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,20);
  for(const [index,c]of fixture.cases.entries()){
    const input=c.input,state={pos:input.pos,end:input.end,start:input.start,rest:input.rest,speed:input.speed,pullForce:input.force,reverseImpulse:input.reverse,mass:30,fireTimer:input.timer,fireSpeed:input.fireSpeed,spec:{is_mech_plunger:true,mech_strength:input.strength,stroke:input.stroke}};
    Object.defineProperty(state,'fraction',{get:()=>Math.fround(Math.fround(state.pos-state.end)/Math.fround(state.spec.stroke))});Plunger.prototype.updateVelocity.call(state);
    assert.deepEqual({pos:state.pos,speed:state.speed,reverse:state.reverseImpulse,timer:state.fireTimer},c.expected,`native tracking state ${index}`);
  }
});

for(const [name,kind,frames]of [['plunger-200','plunger',1637],['shooter-rebound','triggers',634]])test(`${name} preserves native rod mechanics and all four ball states at every physics frame`,()=>{
  const path=`three/tests/fixtures/vpx-${name}-complete-mechanism.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url));
  assert.equal(fixture.nativePlungerMemory.validation.agrees,true);assert.equal(fixture.nativePlungerMemory.layout.fields.travelLimit,736);
  assert.equal(fixture.nativeRandom.requireContinuity,true);assert.equal(fixture.nativeRandom.continuityThroughMilliseconds,frames);
  const [report]=JSON.parse(execFileSync(process.execPath,[`scripts/compare-vpx-${kind}.mjs`,path,'--check','--json',`--report=.work/three-review/${name}-mechanism-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:4*1024*1024}));
  assert.equal(report.nativeBodySummary.frames,frames);assert.equal(report.nativeBodySummary.bodies,frames*4);
  for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(report.nativeBodySummary[key],0,key);
  assert.equal(report.nativePlungerSummary.frames,frames);
  for(const key of Object.keys(fixture.nativePlungerRegression.errors)){
    assert.equal(report.nativePlungerSummary.observations[key],frames,`${key} observed at every frame`);
    assert.equal(report.nativePlungerSummary.errors[key],0,`${key} exactly matches native`);
  }
  assert.equal(report.nativeRandomAudit.length,frames);assert.ok(report.nativeRandomAudit.every(frame=>frame.agrees));
});
