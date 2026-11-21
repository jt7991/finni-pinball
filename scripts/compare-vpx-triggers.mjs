import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,referenceRandom} from './reference-physics.mjs';
const path=process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-triggers.json',fixture=JSON.parse(fs.readFileSync(path));
assert.equal(fixture.probeKind,'triggers');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});g.random=referenceRandom();
  try{
    g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();const r=g.records[0];
    for(const [path,value]of Object.entries({...fixture.runtimeOverrides,...c.runtimeOverrides})){
      const i=path.lastIndexOf('.'),name=path.slice(0,i).toLowerCase(),property=path.slice(i+1).toLowerCase();
      if(['enabled','collidable'].includes(property))g.rules.objects.get(name)[property]=value;
    }
    const trigger=g.triggers.find(t=>t.spec.name===c.trigger);assert.ok(trigger);
    // Native capture parks the existing ball before teleporting to the shot.
    // This deliberately does not clear volume memberships outside broadphase.
    r.body.setTranslation({x:4.3,y:7.15,z:.25},true);r.body.setLinvel({x:0,y:0,z:0},true);for(let ms=0;ms<400;ms++)g.step();
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    r.body.setTranslation({x:c.x*.01,y:(2115-c.y)*.01,z:c.z*.01},true);r.body.setLinvel({x:c.vx,y:-c.vy,z:c.vz??0},true);r.body.setAngvel({x:0,y:0,z:0},true);
    const events=[],emit=trigger.emit;trigger.emit=(event,record)=>{events.push({ms:Math.round(g.time*1000)-2400,event});emit(event,record);};
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      for(let ms=elapsed;ms<expected[0];ms++)g.step();elapsed=expected[0];const p=r.body.translation(),v=r.body.linvel(),count=trigger.members.get(g.nativeBall(r.body).body)??0;
      samples.push({ms:elapsed,count,expectedCount:expected[12],position:[p.x*100,2115-p.y*100,p.z*100],positionError:Math.hypot(p.x*100-expected[1],2115-p.y*100-expected[2],p.z*100-expected[3]),velocityError:Math.hypot(v.x-expected[4],-v.y-expected[5],v.z-expected[6])});
    }
    const report={name:c.name,events,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),membershipMismatches:samples.filter(s=>s.count!==s.expectedCount).length,physicsStats:g.physicsStats,samples};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync('.work/three-review/vpx-triggers-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  const limit=fixture.regressionLimits[r.name];assert.ok(limit,'explicit trigger limit '+r.name);
  assert.ok(r.maxPositionError<limit.position,r.name+' position '+r.maxPositionError);assert.ok(r.maxVelocityError<limit.velocity,r.name+' speed '+r.maxVelocityError);
  for(const s of r.samples.filter(s=>s.ms<=limit.earlyMs)){
    assert.ok(s.positionError<limit.earlyPosition,r.name+' initial switch position '+s.positionError);assert.ok(s.velocityError<limit.earlyVelocity,r.name+' initial switch velocity '+s.velocityError);
  }
  assert.equal(r.membershipMismatches,0,r.name+' native volume membership');assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
