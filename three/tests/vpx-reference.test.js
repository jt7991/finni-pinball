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
test('free rolling reaches the native horizontal speed without artificial drag',async()=>{
  const g=await createGame(json('layout'));
  try{
    g.start();g.launch();g.ball.setTranslation({x:4.3,y:6.15,z:.25},true);g.ball.setLinvel({x:10,y:0,z:0},true);g.ball.setAngvel({x:0,y:0,z:0},true);
    for(let i=0;i<.1/STEP;i++)g.step();const a=g.ball.linvel().x;
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
