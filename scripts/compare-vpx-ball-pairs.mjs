import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,referenceRandom,restoreReferenceBalls} from './reference-physics.mjs';
const path=process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-ball-pairs.json',fixture=JSON.parse(fs.readFileSync(path));
assert.equal(fixture.probeKind,'ball-pairs');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});g.random=referenceRandom();
  try{
    g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();
    for(const [path,value]of Object.entries(fixture.runtimeOverrides)){
      const dot=path.lastIndexOf('.'),name=path.slice(0,dot).toLowerCase(),property=path.slice(dot+1).toLowerCase();
      if(['collidable','enabled'].includes(property))g.rules.objects.get(name)[property]=value;
    }
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    if(c.otherBall.spawn)g.spawn(c.otherBall.spawn);
    const r=restoreReferenceBalls(g,fixture,c),other=g.physicalRecords[c.otherBall.index],impacts=[],run=g.rules.run;
    g.rules.run=(name,...args)=>{if(name==='OnBallBallCollision')impacts.push({ms:Math.round(g.time*1000)-2000,speed:args[2]});return run(name,...args);};
    const values=record=>{const b=record.proxy;return [b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz];};
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      while(elapsed<expected[0]){g.step();elapsed++;}
      const actual=[...values(r),...values(other)],native=[...expected.slice(1,10),...expected.slice(12,21)];
      const error=(offset,n)=>Math.hypot(...actual.slice(offset,offset+n).map((v,i)=>v-native[offset+i]));
      samples.push({ms:elapsed,actual,expected:native,positionError:Math.max(error(0,3),error(9,3)),velocityError:Math.max(error(3,3),error(12,3)),angularError:Math.max(error(6,3),error(15,3))});
    }
    const report={name:c.name,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxAngularError:Math.max(...samples.map(s=>s.angularError)),impacts,physicsStats:g.physicsStats,samples};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync('.work/three-review/vpx-ball-pairs-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  const limit=fixture.regressionLimits[r.name];assert.ok(limit,'explicit pair gate '+r.name);
  assert.ok(r.maxPositionError<limit.position,r.name+' position');assert.ok(r.maxVelocityError<limit.velocity,r.name+' velocity');assert.ok(r.maxAngularError<limit.angular,r.name+' angular momentum');assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
