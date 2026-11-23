import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls,readReferenceFixture,summarizeNativePlunger,readReferenceAssets} from './reference-physics.mjs';
const path=process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-triggers.json',fixture=readReferenceFixture(path);
assert.equal(fixture.probeKind,'triggers');
const {layout,objects,source}=readReferenceAssets(fixture);applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});g.random=referenceRandom();
  try{
    g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();let r=g.records[0];
    for(const [path,value]of Object.entries({...fixture.runtimeOverrides,...c.runtimeOverrides})){
      const i=path.lastIndexOf('.'),name=path.slice(0,i).toLowerCase(),property=path.slice(i+1).toLowerCase();
      if(['enabled','collidable'].includes(property))g.rules.objects.get(name)[property]=value;
    }
    const trigger=g.triggers.find(t=>t.spec.name===c.trigger);assert.ok(trigger);
    // Native capture parks the existing ball before teleporting to the shot.
    // This deliberately does not clear volume memberships outside broadphase.
    placeReferenceBall(g,r,{x:430,y:1400,z:25});for(let ms=0;ms<400;ms++)g.step();
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    placeReferenceBall(g,r,c);
    r=restoreReferenceBalls(g,fixture,c,r);
    const events=[],emit=trigger.emit;trigger.emit=(event,record)=>{events.push({ms:Math.round(g.time*1000)-2400,event});emit(event,record);};
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      for(let ms=elapsed;ms<expected[0];ms++)g.step();elapsed=expected[0];const p=r.body.translation(),v=r.body.linvel(),count=trigger.members.get(g.nativeBall(r.body).body)??0;
      samples.push({ms:elapsed,count,expectedCount:expected[12],position:[p.x*100,2115-p.y*100,p.z*100],positionError:Math.hypot(p.x*100-expected[1],2115-p.y*100-expected[2],p.z*100-expected[3]),velocityError:Math.hypot(v.x-expected[4],-v.y-expected[5],v.z-expected[6])});
    }
    const bodies=(g.nativeBodyAudit??[]).flatMap(frame=>frame.bodies),nativeBodySummary={frames:g.nativeBodyAudit?.length??0,bodies:bodies.length};
    for(const key of ['positionError','velocityError','momentumError','orientationError'])nativeBodySummary[key]=Math.max(0,...bodies.map(body=>body[key]??0));
    const nativePlungerSummary=summarizeNativePlunger(g.nativePlungerAudit);
    const report={name:c.name,events,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),membershipMismatches:samples.filter(s=>s.count!==s.expectedCount).length,physicsStats:g.physicsStats,samples,...(g.nativeRandomAudit?{nativeRandomAudit:g.nativeRandomAudit,nativeBodySummary}:{}),...(nativePlungerSummary?{nativePlungerSummary}:{}),...(process.argv.includes('--body-audit')?{nativeBodyAudit:g.nativeBodyAudit,nativePlungerAudit:g.nativePlungerAudit}:{})};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeRandomAudit:undefined,nativeBodyAudit:undefined,nativePlungerAudit:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-triggers-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  const limit=fixture.regressionLimits[r.name];assert.ok(limit,'explicit trigger limit '+r.name);
  assert.ok(r.maxPositionError<limit.position,r.name+' position '+r.maxPositionError);assert.ok(r.maxVelocityError<limit.velocity,r.name+' speed '+r.maxVelocityError);
  for(const s of r.samples.filter(s=>s.ms<=limit.earlyMs)){
    assert.ok(s.positionError<limit.earlyPosition,r.name+' initial switch position '+s.positionError);assert.ok(s.velocityError<limit.earlyVelocity,r.name+' initial switch velocity '+s.velocityError);
  }
  assert.equal(r.membershipMismatches,0,r.name+' native volume membership');assert.equal(r.physicsStats.substepBudgetExceeded,0);
  if(fixture.nativeBodyRegression){
    const limit=fixture.nativeBodyRegression;assert.ok(r.nativeBodySummary.frames>=limit.frames,'complete native body-frame coverage');
    for(const key of ['positionError','velocityError','momentumError','orientationError'])if(limit[key]!==undefined)assert.ok(r.nativeBodySummary[key]<=limit[key],`${r.name} native body ${key}`);
  }
  if(fixture.nativePlungerRegression){
    const limit=fixture.nativePlungerRegression;assert.ok(r.nativePlungerSummary?.frames>=limit.frames,'complete native plunger-frame coverage');
    for(const [key,value]of Object.entries(limit.observations??{}))assert.ok(r.nativePlungerSummary.observations[key]>=value,`${r.name} native plunger ${key} observation coverage`);
    for(const [key,value]of Object.entries(limit.errors))assert.ok(r.nativePlungerSummary.errors[key]<=value,`${r.name} native plunger ${key}`);
  }
}
