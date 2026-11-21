import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls,readReferenceFixture} from './reference-physics.mjs';
const fixture=readReferenceFixture(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-plunger.json');
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
    let elapsed=0;const samples=[],traceSamples=[];
    const traceRows=new Map((process.argv.includes('--trace')||fixture.traceRegression?scenario.timerTrace??[]:[]).filter(r=>r[0]==='STATE').map(row=>[row[1]-1,row]));
    const observeTrace=ms=>{
      const row=traceRows.get(ms);if(!row)return;
      const expected=row.slice(2,11);for(let i=3;i<9;i++)expected[i]/=1e6;
      const b=r.proxy,actual=[b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));
      traceSamples.push({ms,expected,actual,positionError:error(0),velocityError:error(3),angularError:error(6)});
    };
    observeTrace(0);
    for(const expected of scenario.samples){
      const ms=expected[0];for(let i=0;i<Math.round((ms-elapsed)/1000/STEP);i++){g.step();observeTrace(elapsed+i+1);}elapsed=ms;
      const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();
      const actual=[ms,p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100,...g.flippers.map(f=>90-f.angle*180/Math.PI),g.plunger.position];
      samples.push({expected,actual,positionError:Math.hypot(...actual.slice(1,4).map((n,i)=>n-expected[i+1])),velocityError:Math.hypot(...actual.slice(4,7).map((n,i)=>n-expected[i+4])),plungerError:Math.abs(actual[12]-expected[12])});
    }
    const bodies=(g.nativeBodyAudit??[]).flatMap(frame=>frame.bodies),nativeBodySummary={frames:g.nativeBodyAudit?.length??0,bodies:bodies.length};
    for(const key of ['positionError','velocityError','momentumError','orientationError'])nativeBodySummary[key]=Math.max(0,...bodies.map(body=>body[key]??0));
    const report={name:scenario.name,actualDelay:scenario.actualDelay,maxPositionError:Math.max(...samples.map(r=>r.positionError)),maxVelocityError:Math.max(...samples.map(r=>r.velocityError)),maxPlungerError:Math.max(...samples.map(r=>r.plungerError)),maxNativeSpeed:Math.max(...samples.map(r=>Math.hypot(...r.expected.slice(4,6)))),maxModelSpeed:Math.max(...samples.map(r=>Math.hypot(...r.actual.slice(4,6)))),physicsStats:g.physicsStats,samples,...(traceRows.size?{traceSamples}:{}),...(g.nativeRandomAudit?{nativeRandomAudit:g.nativeRandomAudit,nativeBodySummary}:{}),...(process.argv.includes('--body-audit')?{nativeBodyAudit:g.nativeBodyAudit}:{})};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,traceSamples:undefined,nativeRandomAudit:undefined,nativeBodyAudit:undefined}));
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
  if(fixture.nativeBodyRegression){
    const limit=fixture.nativeBodyRegression;assert.ok(r.nativeBodySummary.frames>=limit.frames,'complete native physics-frame coverage');
    for(const key of ['positionError','velocityError','momentumError','orientationError'])if(limit[key]!==undefined)assert.ok(r.nativeBodySummary[key]<=limit[key],`${r.name} every native body ${key}: ${r.nativeBodySummary[key]}`);
  }
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
