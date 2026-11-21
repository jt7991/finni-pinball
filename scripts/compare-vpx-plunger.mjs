import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-plunger.json'));
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');
applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const scenario of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});
  g.random=referenceRandom();
  try{
    g.start();for(let i=0;i<2/STEP;i++)g.step();let r=g.records[0];
    placeReferenceBall(g,r,{...scenario,vx:0,vy:0,vz:0});
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    r=restoreReferenceBalls(g,fixture,scenario,r);
    if(scenario.initialPlungerPosition!==undefined){
      // The public native position is Float32; converting it back identifies
      // the rod's VPU coordinate at this snapshot, before PullBack zeros speed.
      g.plunger.pos=Math.fround(g.plunger.end+Math.fround(Math.fround(scenario.initialPlungerPosition/25)*Math.fround(g.plunger.spec.stroke)));
      assert.equal(g.plunger.position,Math.fround(scenario.initialPlungerPosition),'observed native rod position round trip');
      g.plunger.updateNativeShapes();
    }
    g.rules.execute('Plunger.PullBack');g.rules.schedule(scenario.actualDelay,'Plunger.Fire');
    let elapsed=0;const samples=[];
    for(const expected of scenario.samples){
      const ms=expected[0];for(let i=0;i<Math.round((ms-elapsed)/1000/STEP);i++)g.step();elapsed=ms;
      const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();
      const actual=[ms,p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100,...g.flippers.map(f=>90-f.angle*180/Math.PI),g.plunger.position];
      samples.push({expected,actual,positionError:Math.hypot(...actual.slice(1,4).map((n,i)=>n-expected[i+1])),velocityError:Math.hypot(...actual.slice(4,7).map((n,i)=>n-expected[i+4])),plungerError:Math.abs(actual[12]-expected[12])});
    }
    const report={name:scenario.name,actualDelay:scenario.actualDelay,maxPositionError:Math.max(...samples.map(r=>r.positionError)),maxVelocityError:Math.max(...samples.map(r=>r.velocityError)),maxPlungerError:Math.max(...samples.map(r=>r.plungerError)),maxNativeSpeed:Math.max(...samples.map(r=>Math.hypot(...r.expected.slice(4,6)))),maxModelSpeed:Math.max(...samples.map(r=>Math.hypot(...r.actual.slice(4,6)))),physicsStats:g.physicsStats,samples,...(g.nativeRandomAudit?{nativeRandomAudit:g.nativeRandomAudit}:{})};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeRandomAudit:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-plunger-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
// These gates cover rod movement and initial launch energy. Downstream shooter
// deflector/ramp contacts still diverge and are retained in the full report.
if(process.argv.includes('--check'))for(const r of reports){
  assert.ok(r.maxPlungerError<.08,`${r.name} native plunger scale error: ${r.maxPlungerError}`);
  const first=r.samples.find(s=>Math.abs(s.expected[5])>1);
  if(first){assert.ok(Math.abs(r.maxNativeSpeed-r.maxModelSpeed)<.03,`${r.name} peak launch speed`);assert.ok(first.positionError<2.2,`${r.name} first launch position`);assert.ok(first.velocityError<.6,`${r.name} first launch velocity`);}
  else assert.ok(r.maxModelSpeed<.1,`${r.name} weak pull must not launch`);
  if(fixture.initialTrajectory){
    const limit=fixture.initialTrajectory;
    for(const sample of r.samples.filter(s=>s.expected[0]<=limit.throughMilliseconds)){
      assert.ok(sample.positionError<limit.position,`${r.name} initial native path at ${sample.expected[0]}ms`);
      assert.ok(sample.velocityError<limit.velocity,`${r.name} initial native velocity at ${sample.expected[0]}ms`);
      assert.ok(sample.plungerError<limit.plunger,`${r.name} initial native rod at ${sample.expected[0]}ms`);
    }
  }
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
