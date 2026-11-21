import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createGame,STEP,RADIUS} from '../physics.js';

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
    g.release();ticks(g,.2);assert.equal(g.inLane,true);
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
