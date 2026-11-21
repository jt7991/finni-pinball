import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
const fixture=JSON.parse(fs.readFileSync('three/tests/fixtures/vpx-heel-milliseconds.json'));
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');Object.assign(layout.physics,fixture.controlledOverrides);
const scenario=fixture.cases[0],g=await createFullGame(layout,objects,source,()=>{}),samples=[];
try{
  g.start();for(let i=0;i<2/STEP;i++)g.step();const r=g.records[0];
  const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
  r.body.setTranslation({x:scenario.x*.01,y:(2115-scenario.y)*.01,z:.25},true);r.body.setLinvel({x:0,y:-6,z:0},true);r.body.setAngvel({x:0,y:0,z:0},true);
  g.rules.schedule(scenario.actualDelay,'SolRFlipper 1');
  // Native STATE is recorded in the timer before that millisecond's physics
  // update; it observes the ball after the previous millisecond's displacement.
  for(let ms=0;ms<70;ms++){
    const native=scenario.timerTrace.find(row=>row[0]==='STATE'&&row[1]===ms+1)?.slice(2);assert.ok(native,`native state at ${ms+1}ms`);
    for(let i=3;i<9;i++)native[i]/=1e6;
    const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();
    const actual=[p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100,90-g.flippers[1].angle*180/Math.PI];
    samples.push({ms,native,actual,positionError:Math.hypot(...actual.slice(0,3).map((x,i)=>x-native[i])),velocityError:Math.hypot(...actual.slice(3,6).map((x,i)=>x-native[i+3])),angleError:Math.abs(actual[9]-native[9])});g.step();
  }
  const firstDivergence=samples.find(s=>s.velocityError>.01)?.ms;
  const report={firstDivergence,physicsStats:g.physicsStats,samples};
  fs.writeFileSync('.work/three-review/vpx-heel-milliseconds-comparison.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(process.argv.includes('--json')?report:{firstDivergence,physicsStats:g.physicsStats}));
  if(process.argv.includes('--check')){
    assert.deepEqual(scenario.timerTrace.filter(([name,ms])=>name==='ROLL'&&ms<=70).map(([,ms])=>ms),[10,20,30,40,50,60,70],'observed native rolling phase');
    for(const s of samples){assert.ok(s.positionError<.005,`position at ${s.ms}ms`);assert.ok(s.velocityError<.004,`velocity at ${s.ms}ms`);assert.ok(s.angleError<.0003,`angle at ${s.ms}ms`);}
    assert.equal(g.physicsStats.substepBudgetExceeded,0);
  }
}finally{g.dispose();}
