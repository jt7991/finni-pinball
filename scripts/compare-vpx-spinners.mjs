import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-spinners.json'));
assert.equal(fixture.probeKind,'spinners');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});g.random=referenceRandom();
  try{
    g.start();for(let i=0;i<2/STEP;i++)g.step();g.launch();let r=g.records[0];
    for(const [path,value]of Object.entries(fixture.runtimeOverrides)){
      const dot=path.lastIndexOf('.'),name=path.slice(0,dot).toLowerCase(),property=path.slice(dot+1).toLowerCase();
      if(!['collidable','enabled'].includes(property))continue;
      const state=g.rules.objects.get(name);assert.ok(state,name);state[property]=value;
      if(property==='enabled')g.mechanisms.get(name)?.setEnabled(value);
    }
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    const reset=(x,y,z,vx=0,vy=0)=>placeReferenceBall(g,r,{x,y,z,vx,vy});
    reset(c.x,c.y,c.z,c.vx,c.vy);
    r=restoreReferenceBalls(g,fixture,c,r);
    const spinner=g.spinners.find(s=>s.spec.name===c.spinner);assert.ok(spinner,c.spinner);
    let elapsed=0;const samples=[];
    for(const [index,expected]of c.samples.entries()){
      for(let ms=elapsed;ms<expected[0];ms++)g.step();elapsed=expected[0];
      if(index>=c.parkFromSample)reset(430,1500,25);
      const p=r.body.translation(),v=r.body.linvel(),angle=spinner.currentAngle,score=g.rules.value('Score(CurrentPlayer)'),count=g.rules.value('LeftSpinnerCount(CurrentPlayer)');
      samples.push({ms:elapsed,expectedAngle:expected[12],angle,angleError:Math.abs(((angle-expected[12]+540)%360)-180),expectedScore:expected[13],score,expectedCount:expected[14],count,positionError:Math.hypot(p.x*100-expected[1],2115-p.y*100-expected[2],p.z*100-expected[3]),velocityError:Math.hypot(v.x-expected[4],-v.y-expected[5],v.z-expected[6])});
    }
    const report={name:c.name,maxAngleError:Math.max(...samples.map(s=>s.angleError)),maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),scoreMismatches:samples.filter(s=>s.score!==s.expectedScore).length,countMismatches:samples.filter(s=>s.count!==s.expectedCount).length,spins:spinner.spins,physicsStats:g.physicsStats,samples};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync('.work/three-review/vpx-spinners-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  const limit=fixture.regressionLimits[r.name];assert.ok(limit,r.name+' explicit gate');
  assert.ok(r.maxAngleError<limit.angle,r.name+' angle '+r.maxAngleError);assert.ok(r.maxPositionError<limit.position,r.name+' ball position '+r.maxPositionError);
  assert.equal(r.scoreMismatches,0,r.name+' scored rotations');assert.equal(r.countMismatches,0,r.name+' authored spinner count');assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
