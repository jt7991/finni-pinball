import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createGame,STEP,RADIUS,rampSurface} from '../physics.js';

const layout=JSON.parse(await readFile(new URL('../public/layout.json',import.meta.url)));
const ticks=(g,seconds)=>{for(let i=0;i<seconds/STEP;i++)g.step();};
const position=(g,p,v={x:0,y:0,z:0})=>{g.ball.setTranslation(p,true);g.ball.setLinvel(v,true);};

test('a charged physical launch leaves the lane and stays finite',async()=>{
  const g=await createGame(layout);
  try{
    g.start();g.input('launch',true);ticks(g,1.2);g.input('launch',false);
    assert.equal(g.inLane,false);assert.ok(g.ball.linvel().y>=36);
    let maxY=0,entered=false;
    for(let i=0;i<5/STEP;i++){g.step();const p=g.ball.translation();maxY=Math.max(maxY,p.y);if(p.y>10&&p.x<8.5)entered=true;assert.ok(Number.isFinite(p.x+p.y+p.z));}
    assert.ok(maxY>18,`launch reached y=${maxY}`);assert.ok(entered,'ball feeds onto the table');
  }finally{g.dispose();}
});

test('cancellation releases both flippers without launching',async()=>{
  const g=await createGame(layout);
  try{
    g.start();g.input('left',true);g.input('right',true);g.input('launch',true);ticks(g,.2);
    assert.ok(g.flippers.every(f=>Math.abs(f.angle-f.raised)<.01));
    g.release();ticks(g,.35);assert.equal(g.inLane,true);
    assert.ok(g.flippers.every(f=>Math.abs(f.angle-f.rest)<.01));
  }finally{g.dispose();}
});

test('a moving flipper transfers energy into the ball',async()=>{
  const g=await createGame(layout);
  try{
    g.start();g.input('launch',true);g.input('launch',false);
    const f=g.flippers.find(f=>f.side==='left');
    position(g,{x:f.p.x+.8,y:f.p.y-.13,z:RADIUS+.02});
    g.input('left',true);ticks(g,.08);
    assert.ok(g.ball.linvel().y>5,`upfield ball velocity ${g.ball.linvel().y}`);
  }finally{g.dispose();}
});

test('scoop captures, awards and physically ejects',async()=>{
  const events=[],g=await createGame(layout,e=>events.push(e.type));
  try{
    g.start();g.input('launch',true);g.input('launch',false);
    position(g,{...g.scoop,z:RADIUS});g.step();
    assert.ok(g.capturedUntil>0);assert.equal(g.score,500);ticks(g,1.05);
    assert.equal(g.capturedUntil,0);assert.ok(g.ball.linvel().y<0);assert.ok(events.includes('eject'));
  }finally{g.dispose();}
});

test('draining advances three balls, then replay resets state',async()=>{
  const g=await createGame(layout);
  try{
    g.start();
    for(let i=0;i<3;i++){g.input('launch',true);g.input('launch',false);position(g,{x:4.76,y:.5,z:RADIUS});g.step();}
    assert.equal(g.state,'over');assert.equal(g.ballNumber,3);g.start();
    assert.equal(g.state,'playing');assert.equal(g.ballNumber,1);assert.equal(g.score,0);assert.equal(g.inLane,true);
  }finally{g.dispose();}
});

test('ramp geometry supports an elevated ball and quick nudges tilt',async()=>{
  const g=await createGame(layout);
  try{
    g.start();g.input('launch',true);g.input('launch',false);
    const ramp=g.ramps.find(r=>r.name==='Ramp008'),i=Math.floor(ramp.edges[0].length/2);
    const a=ramp.edges[0][i],b=ramp.edges[1][i];
    position(g,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:a.z+RADIUS+.02});
    ticks(g,.15);assert.ok(g.ball.translation().z>1.6,'ball supported by elevated ramp');
    assert.ok(g.score>=1000);
    for(let j=0;j<4;j++)g.input('nudgeForward',true);
    assert.equal(g.tilted,true);g.input('left',true);ticks(g,.1);
    assert.ok(g.flippers.every(f=>Math.abs(f.angle-f.rest)<.01));
  }finally{g.dispose();}
});

test('previous rollover and wire-end jams let balls leave',async()=>{
  for(const p of [{x:5.08,y:18.79,z:RADIUS},{x:8.105,y:6.77,z:RADIUS}]){
    const g=await createGame(layout);
    try{
      g.start();g.launch();position(g,p,{x:0,y:-5,z:0});ticks(g,2);
      const q=g.ball.translation();
      assert.ok(Math.hypot(q.x-p.x,q.y-p.y)>1,`escaped ${JSON.stringify(p)} to ${JSON.stringify(q)}`);
    }finally{g.dispose();}
  }
});

test('wire ends reach the playfield and zero-wall ramps have no invented sidewalls',async()=>{
  const wire=rampSurface(layout.items.find(i=>i.name==='Ramp7'));
  assert.ok(Math.abs(wire.edges[0][0].z)<1e-9);assert.ok(Math.abs(wire.edges[0].at(-1).z)<1e-9);
  const g=await createGame(layout);
  try{
    for(const item of layout.items.filter(i=>i.kind==='Ramp'&&i.ramp_type==='flat'&&i.left_wall_height===0&&i.right_wall_height===0)){
      assert.equal(g.ramps.find(r=>r.name===item.name).vertices.length,rampSurface(item).vertices.length,item.name);
    }
  }finally{g.dispose();}
});

test('unloaded flippers lift symmetrically, ease off EOS and return after short taps',async()=>{
  const g=await createGame(layout),degrees=180/Math.PI;
  try{
    g.start();g.input('left',true);g.input('right',true);
    let liftedAt=0;
    for(let i=0;i<.1/STEP;i++){
      g.step();const [l,r]=g.flippers;
      assert.ok(Math.abs(Math.abs(l.angle-l.rest)-Math.abs(r.angle-r.rest))<.0001,'matching stroke');
      if(!liftedAt&&l.body.angvel().z*Math.sign(l.raised-l.rest)<0)liftedAt=g.time;
      for(const f of g.flippers)assert.ok(Math.abs(f.angle-f.rest)*degrees<52.2,'no stop overshoot');
    }
    assert.ok(liftedAt>=.02&&liftedAt<=.03,`first stop contact ${liftedAt}s`);
    g.release();ticks(g,.032);
    assert.ok(Math.abs(g.flippers[0].angle-g.flippers[0].raised)*degrees<5,'soft initial return');
    ticks(g,.32);assert.ok(g.flippers.every(f=>Math.abs(f.angle-f.rest)*degrees<.2));
    for(const duration of [.008,.016,.025]){
      g.input('left',true);g.input('right',true);ticks(g,duration);g.release();ticks(g,.35);
      assert.ok(g.flippers.every(f=>Math.abs(f.angle-f.rest)*degrees<.2),`tap ${duration}s returns`);
    }
  }finally{g.dispose();}
});

test('isolated heel/tip shots on a flat, zero-scatter playfield remain symmetric',async()=>{
  const controlled={...layout,playfield:null,physics:{...layout.physics,scatter:0}};
  for(const offset of [.35,.6,.85,1.05])for(const delay of [0,.02,.04,.06]){
    const shots=[];
    for(const side of ['left','right']){
      const g=await createGame(controlled);g.start();g.launch();
      try{
        const f=g.flippers.find(f=>f.side===side),sign=side==='left'?1:-1;
        position(g,{x:f.p.x+sign*offset,y:f.p.y+.5,z:RADIUS+.005},{x:0,y:-6,z:0});
        let maximum=0,height=0,shot=false;
        for(let i=0;i<.18/STEP;i++){
          if(i*STEP>=delay)g.input(side,true);g.step();const v=g.ball.linvel();
          maximum=Math.max(maximum,Math.hypot(v.x,v.y));height=Math.max(height,g.ball.translation().z);shot||=v.y>2;
        }
        assert.ok(shot,`${side} ${offset}/${delay} shoots upfield`);
        assert.ok(maximum<65,`finite shot speed ${maximum}`);assert.ok(height<.3,`vertical kick ${height}`);
        shots.push(maximum);
      }finally{g.dispose();}
    }
    assert.ok(Math.abs(shots[0]-shots[1])<.05,`mirror shots ${offset}/${delay}: ${shots}`);
  }
});

test('a held cradle releases downfield on either flipper',async()=>{
  for(const side of ['left','right']){
    const g=await createGame(layout);
    try{
      g.start();g.launch();g.input(side,true);ticks(g,.1);
      const f=g.flippers.find(f=>f.side===side),a=f.angle,x=.35,y=side==='left'?.43:-.43;
      position(g,{x:f.p.x+x*Math.cos(a)-y*Math.sin(a),y:f.p.y+x*Math.sin(a)+y*Math.cos(a),z:RADIUS+.001});
      ticks(g,1);const held={...g.ball.translation()};
      assert.ok(held.y>f.p.y+.4,'ball can be cradled');
      g.release();ticks(g,.5);const released=g.ball.translation();
      assert.ok(released.y<held.y-.3,'release lets the ball roll downfield');
      assert.ok(g.ball.linvel().y<-.5,'ball keeps moving');
    }finally{g.dispose();}
  }
});
test('the return guide cannot wedge a ball against the post at its upper junction',async()=>{
  const g=await createGame(layout);
  try{
    g.start();g.launch();position(g,{x:8.1,y:11.052,z:RADIUS});
    ticks(g,2);const p=g.ball.translation();
    assert.ok(p.y<10.5||p.x<7.7,`junction escapes toward the infield: ${JSON.stringify(p)}`);
  }finally{g.dispose();}
});
