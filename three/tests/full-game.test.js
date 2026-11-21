import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createFullGame} from '../full-game.js';
import {STEP,RADIUS} from '../physics.js';
const json=name=>JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`,import.meta.url)));
const source=fs.readFileSync(new URL('../public/rules.vbs',import.meta.url),'utf8');
const ticks=(g,s)=>{for(let i=0;i<s/STEP;i++)g.step();};
test('full runtime launches, feeds real switches and creates Friendship balls',async()=>{
  const events=[],g=await createFullGame(json('layout'),json('objects'),source,e=>events.push(e.type));
  try{
    g.start();ticks(g,1.7);assert.equal(g.records.length,1);assert.equal(g.inLane,true);
    g.input('launch',true);ticks(g,1);g.input('launch',false);assert.equal(g.records[0].held,null);
    ticks(g,1);assert.ok(g.records[0].body.translation().y>10,'ball feeds onto main playfield');
    const before=g.score;
    g.rules.hit('Bumper1','Hit',g.records[0].proxy);g.sync();assert.ok(g.score>before);
    let released=1;const spawn=g.spawn.bind(g);g.spawn=name=>{if(name.toLowerCase()==='ballrelease')released++;return spawn(name);};
    for(let i=0;i<3;i++)g.rules.hit('lock','Hit',g.records[0].proxy);
    let maximum=0;for(let i=0;i<15/STEP;i++){g.step();maximum=Math.max(maximum,g.records.length);}
    assert.equal(g.rules.value('bNinjaMB'),true);assert.ok(released>=3,`physical balls released ${released}`);
    assert.ok(maximum>=2,'at least two physical balls overlap in play');
    assert.ok(events.includes('start'));
  }finally{g.dispose();}
});
test('native bonus, game over and replay complete across three physical drains',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),source,()=>{});
  try{
    g.start();ticks(g,1.7);
    for(let ball=1;ball<=3;ball++){
      const rec=g.records.find(r=>r.inLane);assert.ok(rec,`ball ${ball} released`);
      g.rules.execute('bBallSaverActive=False:bBallSaverReady=False');
      g.rules.hit('Drain','Hit',rec.proxy);ticks(g,20);
    }
    assert.equal(g.state,'over');assert.equal(g.records.length,0);
    g.start();ticks(g,1.7);assert.equal(g.state,'playing');assert.equal(g.ballNumber,1);assert.equal(g.records.length,1);
  }finally{g.dispose();}
});
test('weak manual shots roll back dynamically and cancelled pulls never fire',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),source,()=>{});
  try{
    g.start();ticks(g,1.7);const r=g.records[0];
    g.input('launch',true);ticks(g,.19);g.input('launch',false);ticks(g,1.2);
    assert.ok(r.inLane,'weak shot returns to the shooter switch');assert.ok(Math.abs(r.body.linvel().y)<.1);
    assert.equal(r.held,null,'returning ball remains dynamic');
    g.input('launch',true);ticks(g,.55);g.release();ticks(g,.5);
    assert.ok(r.inLane,'focus cancellation keeps the ball in lane');assert.ok(Math.abs(r.body.linvel().y)<.1);
    assert.equal(g.charge,0);assert.ok(Math.abs(g.plunger.position-25*g.plunger.rest)<.001);
  }finally{g.dispose();}
});
test('authored flipper trick timers deliver symmetric shots on a controlled flat playfield',async()=>{
  const layout=json('layout');layout.playfield=null;layout.physics.scatter=0;
  for(const offset of [.35,1.05])for(const delay of [.02,.06]){
    const shots=[];
    for(const side of ['left','right']){
      const g=await createFullGame(layout,json('objects'),source,()=>{});
      try{
        g.start();ticks(g,1.7);g.launch();
        const f=g.flippers.find(f=>f.side===side),ball=g.records[0].body,sign=side==='left'?1:-1;
        ball.setTranslation({x:f.p.x+sign*offset,y:f.p.y+.5,z:RADIUS+.005},true);
        ball.setLinvel({x:0,y:-6,z:0},true);
        ball.setAngvel({x:0,y:0,z:0},true);
        let maximum=0,height=0,shot=false;
        for(let i=0;i<.18/STEP;i++){
          if(i*STEP>=delay&&!g.held[side])g.input(side,true);
          g.step();const v=ball.linvel();
          // Compare the flipper exit, before asymmetric table targets can alter it.
          if(ball.translation().y<6){maximum=Math.max(maximum,Math.hypot(v.x,v.y));height=Math.max(height,ball.translation().z);}
          shot||=v.y>2;
        }
        assert.ok(shot);assert.ok(maximum<65);assert.ok(height<.3);
        shots.push(maximum);
      }finally{g.dispose();}
    }
    assert.ok(Math.abs(shots[0]-shots[1])<.1,`authored flipper response ${offset}/${delay}: ${shots}`);
  }
});

test('the native floor beneath the drop-target slot prevents the wire-entry jam',async()=>{
  const g=await createFullGame(json('layout'),json('objects'),source,()=>{});
  try{
    g.start();ticks(g,1.7);g.launch();const r=g.records[0];
    g.random=()=>.5;
    r.body.setTranslation({x:6.105,y:12.825,z:.207},true);r.body.setLinvel({x:0,y:0,z:0},true);r.body.setAngvel({x:0,y:0,z:0},true);
    let onFloor=false,escaped=false;
    for(let i=0;i<4/STEP&&g.records.includes(r);i++){
      const p=r.body.translation();onFloor||=p.z>.24;
      escaped||=p.z>.24&&Math.hypot(p.x-6.105,p.y-12.825)>.5;
      g.step();
    }
    // A freed ball can drain and be replaced by the authored ball saver within
    // this interval. Never read the old Rapier body after its legitimate removal.
    assert.ok(onFloor,'slot has its authored floor');
    assert.ok(escaped,'slot releases ball onto the playfield');
    assert.equal(g.physicsStats.substepBudgetExceeded,0);
  }finally{g.dispose();}
});
