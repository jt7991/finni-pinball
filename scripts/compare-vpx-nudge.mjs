import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-nudge.json'));
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');Object.assign(layout.physics,fixture.controlledOverrides);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});
  try{
    g.start();for(let i=0;i<2/STEP;i++)g.step();const r=g.records[0];
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    r.body.setTranslation({x:c.x*.01,y:(2115-c.y)*.01,z:c.z*.01},true);r.body.setLinvel({x:0,y:0,z:0},true);r.body.setAngvel({x:0,y:0,z:0},true);
    if(c.actualDelay)g.rules.schedule(c.actualDelay,`Nudge ${c.nudgeAngle},${c.force}`);else g.rules.execute(`Nudge ${c.nudgeAngle},${c.force}`);
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      for(let ms=elapsed;ms<expected[0];ms++)g.step();elapsed=expected[0];
      const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel(),actual=[elapsed,p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100];
      samples.push({expected,actual,positionError:Math.hypot(...actual.slice(1,4).map((x,i)=>x-expected[i+1])),velocityError:Math.hypot(...actual.slice(4,7).map((x,i)=>x-expected[i+4])),xyVelocityError:Math.hypot(v.x-expected[4],-v.y-expected[5])});
    }
    const report={name:c.name,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxXYVelocityError:Math.max(...samples.map(s=>s.xyVelocityError)),physicsStats:g.physicsStats,samples};reports.push(report);if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync('.work/three-review/vpx-nudge-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  const limit=fixture.regressionLimits?.[r.name]??{position:.06,velocity:.005};
  assert.ok(r.maxPositionError<limit.position,`${r.name} position ${r.maxPositionError} VPU`);
  assert.ok(r.maxVelocityError<limit.velocity,`${r.name} velocity ${r.maxVelocityError}`);
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
