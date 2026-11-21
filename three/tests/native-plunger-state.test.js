import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readReferenceFixture} from '../../scripts/reference-physics.mjs';
import {nativeRampSurface,nativeRampContacts} from '../native-ramp.js';
import {Plunger} from '../plunger.js';

test('ramp height interpolation preserves the native compiled reciprocal and captured support normals',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-ramp064-contact-geometry.json',import.meta.url));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  const surface=nativeRampSurface(fixture.ramp),mesh=nativeRampContacts(surface,fixture.ramp),triangles=mesh.shapes.filter(shape=>shape.kind==='triangle');
  assert.equal(surface.native.heights.at(-1),3.999999761581421,'native endpoint preserves reciprocal multiplication rounding');
  for(const expected of fixture.triangles){
    const actual=triangles.find(shape=>JSON.stringify(shape.native.points.flatMap(point=>[point.x,point.y,point.z]))===JSON.stringify(expected.vertices));
    assert.ok(actual,'captured native triangle vertices exist');assert.deepEqual([actual.native.n.x,actual.native.n.y,actual.native.n.z],expected.normal,'captured native contact normal');
  }
});

test('plunger impulse and reverse recoil match the pinned compiled engine across ball masses',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-plunger-compiled-impulses.json',import.meta.url));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,16);
  for(const [index,c]of fixture.cases.entries()){
    let state=structuredClone(c.state);const plunger={mass:30,fireBounce:c.bounce,reverseImpulse:c.reverse,spec:{scatter_velocity:0}};
    Plunger.prototype.collide.call(plunger,{native:{snapshot:()=>structuredClone(c.state),commit:value=>state=value}},{normal:{x:c.normal.x,y:-c.normal.y,z:0},gap:c.gap*.01,tipVelocity:-c.tip},()=>.5,.5);
    assert.deepEqual({p:state.p,v:state.v,bounce:plunger.fireBounce,reverse:plunger.reverseImpulse},c.expected,`unchanged native function case ${index}`);
  }
});

test('manual plunger release matches the pinned compiled Fire function across recorded pull distances',()=>{
  const fixture=readReferenceFixture(new URL('fixtures/vpx-plunger-compiled-fire.json',import.meta.url));
  assert.equal(fixture.engineSha256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.cases.length,16);
  for(const [index,c]of fixture.cases.entries()){
    const input=c.input,plunger={mass:30,pos:input.pos,end:input.end,rest:input.rest,spec:{stroke:input.stroke,speed_fire:input.speedFire}};
    Object.defineProperty(plunger,'fraction',{get:()=>Math.fround(Math.fround(plunger.pos-plunger.end)/Math.fround(plunger.spec.stroke))});
    Plunger.prototype.fire.call(plunger);
    assert.deepEqual({pos:plunger.pos,speed:plunger.fireSpeed,bounce:plunger.fireBounce,force:plunger.pullForce,timer:plunger.fireTimer},c.expected,`unchanged native Fire case ${index}`);
  }
});

for(const [delay,frames]of [[600,1585],[583,1635]])test(`native ${delay}ms launch retains every ball state and observed random state through ${frames} physics frames`,()=>{
  const path=`three/tests/fixtures/vpx-plunger-${delay}-complete-state.json.gz`,fixture=readReferenceFixture(new URL(`../../${path}`,import.meta.url));
  assert.equal(fixture.cases[0].actualDelay,delay);assert.equal(fixture.nativeRandom.continuityThroughMilliseconds,frames);
  const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-plunger.mjs',path,'--check','--json',`--report=.work/three-review/plunger-${delay}-complete-regression.json`],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:4*1024*1024}));
  assert.equal(report.samples.length,100);assert.equal(report.nativeBodySummary.frames,frames);assert.equal(report.nativeBodySummary.bodies,frames*4);
  for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(report.nativeBodySummary[key],0,key+' for every body at every recorded native frame');
  assert.equal(report.nativeRandomAudit.length,frames);assert.ok(report.nativeRandomAudit.every(row=>row.agrees));
});
