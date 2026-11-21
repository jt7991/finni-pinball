import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {collideNativeTarget} from '../native-target-event.js';
import {NativeBall} from '../native-ball.js';

test('target faces arm animation before Hit filtering; points dispatch without arming animation',()=>{
  let ball={p:{x:0,y:0,z:25},v:{x:-6,y:0,z:0},m:{x:0,y:0,z:0},mass:1,inertia:250},animations=0,events=0;
  const native={sync:()=>ball.p,snapshot:()=>structuredClone(ball),commit:value=>{ball=value;},eventPosition:{x:0,y:0,z:25},eventDistance:0,acceptHitEvent:NativeBall.prototype.acceptHitEvent};
  const body={native,linvel:()=>({x:ball.v.x,y:-ball.v.y,z:ball.v.z})},target={threshold:2,currentHitThreshold:0,collider:{isEnabled:()=>true},dropped:()=>false,animate:()=>animations++};
  const hit={normal:{x:1,y:0,z:0},gap:0},record={target,fireEvents:true},material={elasticity:.3,elasticity_falloff:0,friction:0,scatter:0,difficulty:1};
  const collide=shape=>{ball.v={x:-6,y:0,z:0};return collideNativeTarget(body,hit,{kind:shape},record,material,.25,()=>{throw Error('zero scatter drew randomness');},()=>events++);};
  assert.equal(collide('triangle'),false);assert.equal(animations,1);assert.equal(events,0);assert.equal(target.currentHitThreshold,6);
  ball.p.x=.1;assert.equal(collide('triangle'),true,'targets require only a different position, unlike the .25 squared-distance wall filter');assert.equal(events,1);
  ball.p.x=.2;assert.equal(collide('point'),true);assert.equal(animations,2);assert.equal(events,2);
  record.fireEvents=false;ball.p.x=.3;assert.equal(collide('triangle'),false);assert.equal(animations,2);assert.ok(ball.v.x>0,'silent target still reflects');
  record.fireEvents=true;target.dropped=()=>true;assert.equal(collide('triangle'),false);assert.equal(animations,2);
});

test('thirteen native target recordings preserve exact impact events, scores and uninterrupted physical RNG',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-target-events.mjs','--check','--json','--body-audit','--report=.work/three-review/target-events-regression-comparison.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(reports.length,13);
  for(const report of reports){
    assert.ok(report.nativeRandomAudit.every(row=>row.agrees),report.name+' native physical stream');
    for(const frame of report.nativeBodyAudit)for(const body of frame.bodies){assert.equal(body.positionError,0,report.name+' all-body position');assert.ok(body.velocityError<2e-9,report.name+' all-body velocity');}
  }
  for(const name of ['Target001-front-8','Target001-baked-flags','Target005-front-8','Target005-baked-flags'])assert.equal(reports.find(r=>r.name===name).samples.at(-1).actual[12],1000);
  for(const report of reports.filter(r=>/disabled|back|0\.5/.test(r.name)))assert.equal(report.events.length,0);
  assert.ok(reports.find(r=>r.name==='Target010-front-8').events[0].hitThreshold>7);
});

test('native HasHitEvent changes keep the baked impact callback but silence completed-drop rules',()=>{
  const [report]=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-target-events.mjs','three/tests/fixtures/vpx-target-silent-completion.json','--check','--json','--body-audit','--report=.work/three-review/target-silent-completion-regression.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:3*1024*1024}));
  assert.equal(report.events.length,1,'the collider event flag was baked before the setter');assert.ok(report.samples.at(-1).expected[0]>=130);
  assert.ok(report.samples.every(sample=>sample.actual[12]===0),'no authored Dropped award after HasHitEvent=False');
  assert.ok(report.nativeRandomAudit.every(row=>row.agrees));
  for(const frame of report.nativeBodyAudit)for(const body of frame.bodies){assert.equal(body.positionError,0);assert.ok(body.velocityError<2e-9);}
});
