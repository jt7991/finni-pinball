import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {collideNativeSlingshot} from '../native-slingshot.js';
import {createFullGame} from '../full-game.js';

test('eighteen native slingshot recordings retain force profiles, disabled wall rebounds, thresholds, scores and callback clocks',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-slingshots.mjs','--check','--json','--report=.work/three-review/slingshot-regression-comparison.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:4*1024*1024}));
  assert.equal(reports.length,18);assert.ok(reports.reduce((sum,r)=>sum+r.nativeRandomAudit.length,0)>1800);
  for(const report of reports){
    assert.ok(report.nativeRandomAudit.every(row=>row.agrees),report.name+' physics RNG');
    const active=report.name.endsWith('-6');assert.equal(report.events.length,active?1:0);assert.equal(report.samples.at(-1).actual[12],active?530:0);
  }
});

test('the slingshot boosts inward before reflection, preserves wall response while disabled, and filters repeated event positions',()=>{
  const run=(mass,disabled=false)=>{
    let ball={p:{x:25,y:50,z:25},v:{x:-6,y:0,z:0},m:{x:0,y:0,z:0},inertia:250*mass,mass},events=0;
    const native={snapshot:()=>structuredClone(ball),commit:value=>{ball=value;},sync:()=>ball.p,eventPosition:{x:-10000,y:-10000,z:-10000},eventDistance:7};
    const body={native},shape={points:[{x:0,y:21.15},{x:0,y:20.15}]},sling={force:200,threshold:3,disabled},hit={normal:{x:1,y:0,z:0},gap:0},material={elasticity:.8,elasticity_falloff:0,friction:0,scatter:0,difficulty:1};
    const collide=()=>collideNativeSlingshot(body,hit,shape,sling,material,.25,()=>{throw Error('zero scatter should not draw');},()=>events++);
    collide();const first=ball.v.x;ball.v={x:-6,y:0,z:0};collide();assert.equal(events,disabled?0:1,'same position does not repeat the callback');assert.equal(native.eventDistance,7,'slingshot events do not reset generic Hit travel');
    if(!disabled){ball.p.y+=1;ball.v={x:-6,y:0,z:0};collide();assert.equal(events,2,'another position fires immediately');}
    return first;
  };
  assert.equal(run(1),run(2));assert.equal(run(1),84.79998779296875,'Float32 inward boost followed by .8 restitution');assert.ok(Math.abs(run(1,true)-4.8)<.00001);
});

test('the authored table disable routine reaches both live slingshots and re-enables them without changing source geometry',async()=>{
  const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url))),layout=json('layout'),before=JSON.stringify(layout);
  const game=await createFullGame(layout,json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    assert.equal(game.rules.value('Leftslingshot.SlingshotThreshold'),3);
    game.rules.run('DisableTable',true);assert.ok([...game.nativeSlingshots.values()].every(s=>s.disabled));
    game.rules.run('DisableTable',false);assert.ok([...game.nativeSlingshots.values()].every(s=>!s.disabled));
    game.rules.execute('Leftslingshot.SlingshotThreshold=100');assert.equal(game.nativeSlingshots.get('leftslingshot').threshold,100);assert.equal(JSON.stringify(layout),before);
  }finally{game.dispose();}
});
