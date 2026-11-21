import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {createImpulsePlunger} from '../impulse-plunger.js';
import {createFullGame} from '../full-game.js';

test('the impulse coil shares one scripted random impulse across its own ball dictionary',()=>{
  let draws=0;const sounds=[],coil=createImpulsePlunger({random:()=>{draws++;return .25;},sound:name=>sounds.push(name)});
  const trigger={x:906.8096,y:1904.0642,radius:44},a={x:905,velx:3,vely:2,velz:.5},b={x:906,velx:-2,vely:4,velz:-.3},outside={x:907,vely:7};
  coil.InitImpulseP(trigger,45,.5);coil.Random(1.5);coil.InitExitSnd('with-ball','empty');coil.AddBall(a);coil.AddBall(b);
  coil.AutoFire();
  assert.equal(draws,1,'one script Rnd draw per coil fire');
  assert.equal(a.vely,-44.625);assert.equal(b.vely,-44.625);assert.equal(outside.vely,7);
  assert.deepEqual([a.velx,a.velz,b.velx,b.velz],[3,.5,-2,-.3]);
  assert.deepEqual(sounds,['with-ball']);assert.equal(coil.Size,44);
});

test('the source coil retains duplicate trigger entries until their last UnHit and charges on its 10ms timer',()=>{
  let update;const coil=createImpulsePlunger({random:()=>.5,initTimer:(_trigger,handler)=>{update=handler;}}),trigger={x:0,y:0,radius:44},ball={x:1,vely:0};
  coil.InitImpulseP(trigger,45,.5);coil.AddBall(ball);coil.AddBall(ball);coil.RemoveBall(ball);
  assert.deepEqual(coil.Balls,[ball]);assert.equal(trigger.timerinterval,10);
  coil.PullBack();for(let i=0;i<25;i++)update();coil.Fire();assert.equal(ball.vely,-22.5);
  coil.RemoveBall(ball);assert.deepEqual(coil.Balls,[]);ball.vely=3;coil.AutoFire();assert.equal(ball.vely,3);
});

test('the full rules auto-launch a coil member outside the rest switch without moving the manual rod or drawing physics randomness',async()=>{
  const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url)));
  const game=await createFullGame(json('layout'),json('objects'),fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8'),()=>{});
  try{
    game.start();for(let ms=0;ms<2000;ms++)game.step();
    const record=game.records[0],coil=game.rules.objects.get('hostplunger');assert.ok(coil.balls.includes(record.proxy),'generated swPlunger_Hit registered the actual ball');
    record.inLane=false;record.body.setLinvel({x:2,y:3,z:.4},true);const rod=game.plunger.pos;
    game.random=()=>{throw Error('automatic coil consumed the physics RNG');};
    game.rules.execute('PlungerIM.Random 0:PlungerIM.AutoFire');
    const v=record.body.linvel();assert.equal(v.y,45);assert.equal(v.x,2);assert.ok(Math.abs(v.z-.4)<1e-6);assert.equal(game.plunger.pos,rod);
    game.rules.hit('swPlunger','UnHit',record.proxy);record.inLane=true;record.body.setLinvel({x:0,y:-3,z:0},true);
    game.autofire();assert.equal(record.body.linvel().y,-3,'the rest switch alone does not authorize a coil strike');
  }finally{game.dispose();}
});

test('three native impulse-plunger recordings retain launches, misses, ball dictionaries and independent physics randomness',()=>{
  const reports=JSON.parse(execFileSync(process.execPath,['scripts/compare-vpx-autofire.mjs','--check','--json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',maxBuffer:2*1024*1024}));
  assert.equal(reports.length,3);assert.equal(reports.reduce((sum,r)=>sum+r.samples.length,0),72);
  for(const report of reports.filter(r=>r.name!=='coil-miss')){
    assert.ok(report.maxVelocityError<.00001);
    assert.ok(report.nativeRandomAudit.every(row=>row.agrees),'all observed physics random states match for '+report.name);
  }
  const edge=reports.find(r=>r.name==='coil-edge');assert.ok(edge.samples.some(s=>s.actual[5]<-40),'the source coil launches the ball outside the rest switch');
  const miss=reports.find(r=>r.name==='coil-miss');assert.ok(miss.samples.every(s=>Math.hypot(s.actual[4],s.actual[5])<10),'an empty coil does not launch a later entrant');
});
