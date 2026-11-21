import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {createFullGame} from '../full-game.js';
import {STEP,createGame} from '../physics.js';
const root=new URL('../../',import.meta.url);
const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url)));
test('production flipper trajectory matches captured native VPX samples within .01 degrees',()=>{
  const report=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-physics.mjs','--check'],{cwd:root,encoding:'utf8'}));
  assert.ok(report.maxFlipperAngleError<.01);
  assert.equal(report.samples.length,48);
});
test('physics materials retain the actual VPX rubber and metal overrides',()=>{
  const layout=json('layout');
  const peg=layout.items.find(i=>i.name==='rpeg003');
  assert.equal(peg.elasticity,.3);assert.equal(peg.contact_physics.elasticity,.9);assert.equal(peg.contact_physics.friction,.9);
});

test('raw engine heel/tip, sliding and cradle contacts retain their independently measured baseline',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,11);assert.equal(reports.filter(r=>r.name.includes('cradle')).length,2);
});

test('the authored 10ms controller updates every playable ball through real VB arrays and angular momentum',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start();for(let i=0;i<1.7/STEP;i++)g.step();g.spawn('BallRelease');
    assert.equal(g.rules.value('UBound(GetBalls())'),1);
    const [a,b]=g.records;
    for(const r of [a,b]){r.held=null;r.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);}
    a.body.setLinvel({x:60,y:30,z:3},true);b.body.setLinvel({x:-40,y:-70,z:5},true);
    for(const r of [a,b])r.body.setAngvel({x:8,y:10,z:20},true);
    g.rules.tick(.01);
    assert.ok(Math.abs(a.body.linvel().x-52)<1e-5);assert.ok(Math.abs(a.body.linvel().y-26)<1e-5);
    assert.ok(Math.abs(b.body.linvel().x+40*52/70)<1e-5);assert.ok(Math.abs(b.body.linvel().y+52)<1e-5);
    for(const r of [a,b]){assert.ok(Math.abs(r.body.angvel().z-19)<1e-5);assert.equal(r.body.angvel().x,8);assert.equal(r.body.angvel().y,10);}
    assert.equal(a.body.linvel().z,3);assert.equal(b.body.linvel().z,5);
    assert.ok(Math.abs(a.proxy.angmomz+47.5)<1e-5);assert.ok(Math.abs(a.proxy.angvelz+.19)<1e-5);
    a.proxy.angvelz=100;assert.equal(a.body.angvel().z,19,'deprecated AngVel setters remain read-only');
  }finally{g.dispose();}
});

test('target-slot floors, elevated walls and both omitted ramps are present',()=>{
  const layout=json('layout');
  for(const name of ['hole015','hole030','apron','Wall024','Ramp001','Ramp064'])assert.ok(layout.items.some(i=>i.name===name),name);
  const floor=layout.items.find(i=>i.name==='hole015');assert.equal(floor.height_top,0);assert.equal(floor.height_bottom,-20);
  assert.equal(layout.playfield.vertices.length/3,293);assert.equal(layout.playfield.indices.length/3,339);
});

test('the target/wire pocket matches the independently recorded native VPX trap',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-contact.mjs','three/tests/fixtures/vpx-slot-back.json','--check','--json'],{cwd:root,encoding:'utf8'}));
  assert.equal(reports.length,1);assert.equal(reports[0].name,'slot-back');
});
test('free rolling reaches the native horizontal speed without artificial drag',async()=>{
  const layout=json('layout');layout.playfield=null;layout.items=layout.items.filter(i=>i.kind==='Kicker');layout.physics.scatter=0;
  const g=await createGame(layout);
  try{
    g.start();g.launch();g.ball.setTranslation({x:4.3,y:6.15,z:.25},true);g.ball.setLinvel({x:10,y:0,z:0},true);g.ball.setAngvel({x:0,y:0,z:0},true);
    for(let i=0;i<.15/STEP;i++)g.step();const a=g.ball.linvel().x;
    assert.ok(Math.abs(a-50/7)<.01,`native slide-to-roll speed: ${a}`);
    for(let i=0;i<.1/STEP;i++)g.step();assert.ok(Math.abs(g.ball.linvel().x-a)<.005,'no invented rolling drag');
  }finally{g.dispose();}
});
test('physical balls use the native .8 ball-ball coefficient independently of wall response',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    g.start();for(let i=0;i<1.7/STEP;i++)g.step();g.spawn('BallRelease');
    g.world.gravity={x:0,y:0,z:0};
    const [a,b]=g.records;
    for(const [r,x,v]of [[a,4,10],[b,5,-10]]){
      r.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);r.body.setTranslation({x,y:10,z:5},true);r.body.setLinvel({x:v,y:0,z:0},true);r.body.setAngvel({x:0,y:0,z:0},true);
    }
    for(let i=0;i<.05/STEP;i++)g.world.step();
    assert.ok(Math.abs(a.body.linvel().x+8)<.02);assert.ok(Math.abs(b.body.linvel().x-8)<.02);
  }finally{g.dispose();}
});
