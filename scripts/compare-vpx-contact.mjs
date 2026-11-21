import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-contact.json'));
assert.ok(!fixture.probeKind||fixture.probeKind==='contacts','Use the dedicated plunger or nudge comparator for those measurements');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');
applyReferencePhysics(layout,objects,fixture);
if(process.argv.includes('--native-contact-solver'))layout.physics.native_flipper_contacts=true;
const reports=[];
for(const scenario of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});
  g.random=referenceRandom();
  try{
    g.start();for(let i=0;i<2/STEP;i++)g.step();g.launch();let r=g.records[0];
    if(fixture.nativeRuleState?.measuredBallRole==='animation'){
      // The old raw recordings selected an animation ball before the playable
      // ball existed. Preserve that role and physical ball count in the replay.
      if(!scenario.initialBallStates)for(const playable of [...g.records])g.remove('BallRelease',playable.proxy);
      r=g.toyRecords[fixture.nativeRuleState.measuredBallIndex];assert.ok(r,'recorded native animation ball index');
    }
    for(const [key,value]of Object.entries(fixture.runtimeOverrides??{}))if(key.endsWith('.Collidable')){
      const name=key.slice(0,-11).toLowerCase();
      for(const m of g.nativeMeshes)if(g.colliderLabels.get(m.collider.handle)?.toLowerCase()===name)m.collider.setEnabled(value);
    }
    for(const [key,value]of Object.entries(fixture.runtimeOverrides??{}))if(/\.Rot[XYZ]$/.test(key)){
      const [name,property]=key.toLowerCase().split('.');g.rules.objects.get(name)[property]=value;
    }
    if(scenario.startRaised){g.rules.run(`Sol${scenario.side==='left'?'L':'R'}Flipper`,true);for(let i=0;i<.2/STEP;i++)g.step();}
    if(fixture.timerSynchronization){const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;}
    placeReferenceBall(g,r,scenario);
    r=restoreReferenceBalls(g,fixture,scenario,r);
    if(scenario.side){const command=`Sol${scenario.side==='left'?'L':'R'}Flipper`;
      const pressed=scenario.press===false?0:1;
      if(scenario.actualDelay??scenario.delay)g.rules.schedule(scenario.actualDelay??scenario.delay,`${command} ${pressed}`);else g.rules.run(command,!!pressed);
    }
    let elapsed=0;const samples=[];
    for(const expected of scenario.samples){
      const ms=expected[0];for(let i=0;i<Math.round((ms-elapsed)/1000/STEP);i++)g.step();elapsed=ms;
      const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();
      const actual=[ms,p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100,...g.flippers.map(f=>90-f.angle*180/Math.PI)];
      const positionError=Math.hypot(...actual.slice(1,4).map((n,i)=>n-expected[i+1]));
      const velocityError=Math.hypot(...actual.slice(4,7).map((n,i)=>n-expected[i+4]));
      samples.push({expected,actual,positionError,velocityError});
    }
    const report={name:scenario.name,maxPositionError:Math.max(...samples.map(r=>r.positionError)),maxVelocityError:Math.max(...samples.map(r=>r.velocityError)),physicsStats:g.physicsStats,samples};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({name:report.name,position:report.maxPositionError,velocity:report.maxVelocityError,end:samples.at(-1).actual}));
  }finally{g.dispose();}
}
const reportPath=process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-contact-comparison.json';
fs.writeFileSync(reportPath,JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const report of reports){
  const limit=fixture.regressionLimits[report.name];assert.ok(limit,`Missing explicit regression limit: ${report.name}`);
  assert.ok(report.maxPositionError<limit.position,`${report.name} position ${report.maxPositionError} VPU`);
  assert.ok(report.maxVelocityError<limit.velocity,`${report.name} speed ${report.maxVelocityError}`);
  assert.equal(report.physicsStats.substepBudgetExceeded,0,'collision iteration budget');
}
