import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls,readReferenceFixture,summarizeNativePlunger} from './reference-physics.mjs';
const fixture=readReferenceFixture(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-contact.json');
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
    const frameClocks=new Set((scenario.animationFrames??[]).map(row=>row[0]));
    if(scenario.animationFrames?.length){
      const first=scenario.animationFrames[0];g.frameAnimations=true;g.lastAnimationTime=Math.round(g.time*1000)+first[0]-first[1];
      for(let i=1;i<scenario.animationFrames.length;i++)assert.equal(scenario.animationFrames[i][0]-scenario.animationFrames[i-1][0],scenario.animationFrames[i][1],'uninterrupted native frame clocks');
    }
    if(scenario.side){const command=`Sol${scenario.side==='left'?'L':'R'}Flipper`;
      const pressed=scenario.press===false?0:1;
      if(scenario.actualDelay??scenario.delay)g.rules.schedule(scenario.actualDelay??scenario.delay,`${command} ${pressed}`);else g.rules.run(command,!!pressed);
    }
    let elapsed=0;const samples=[],traceSamples=[];
    const traceRows=new Map((fixture.traceRegression?scenario.timerTrace:[]).filter(r=>r[0]==='STATE').map(row=>[row[1]-1,row]));
    const observeTrace=ms=>{
      const row=traceRows.get(ms);if(!row)return;
      const expected=row.slice(2,11);for(let i=3;i<9;i++)expected[i]/=1e6;
      const b=r.proxy,actual=[b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));
      traceSamples.push({ms,expected,actual,positionError:error(0),velocityError:error(3),angularError:error(6)});
    };
    if(fixture.traceRegression)observeTrace(0);
    for(const expected of scenario.samples){
      const ms=expected[0];for(let i=0;i<Math.round((ms-elapsed)/1000/STEP);i++){g.step();if(frameClocks.has(elapsed+i+1))g.prepareFrame();if(fixture.traceRegression)observeTrace(elapsed+i+1);}elapsed=ms;
      const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();
      const actual=[ms,p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100,...g.flippers.map(f=>90-f.angle*180/Math.PI)];
      const positionError=Math.hypot(...actual.slice(1,4).map((n,i)=>n-expected[i+1]));
      const velocityError=Math.hypot(...actual.slice(4,7).map((n,i)=>n-expected[i+4]));
      const flipperAngleError=Math.max(...['leftflipper','rightflipper'].map((name,i)=>Math.abs(g.rules.objects.get(name).currentangle-(fixture.flipperAngleScalarEncoding?Math.fround(expected[10+i]):expected[10+i]))));
      samples.push({expected,actual,positionError,velocityError,flipperAngleError});
    }
    const bodies=(g.nativeBodyAudit??[]).flatMap(row=>row.bodies),nativeBodySummary={frames:g.nativeBodyAudit?.length??0,bodies:bodies.length};
    for(const key of ['positionError','velocityError','momentumError','orientationError'])nativeBodySummary[key]=Math.max(0,...bodies.map(body=>body[key]??0));
    const report={name:scenario.name,maxPositionError:Math.max(...samples.map(r=>r.positionError)),maxVelocityError:Math.max(...samples.map(r=>r.velocityError)),maxFlipperAngleError:Math.max(...samples.map(r=>r.flipperAngleError)),physicsStats:g.physicsStats,samples,...(fixture.traceRegression?{traceSamples}:{}),...(g.nativeRandomAudit?{nativeRandomAudit:g.nativeRandomAudit,nativeBodySummary,nativePlungerSummary:summarizeNativePlunger(g.nativePlungerAudit)}:{}),...(g.nativeScriptRandomAudit?{nativeScriptRandomAudit:g.nativeScriptRandomAudit}:{}),...(process.argv.includes('--body-audit')?{nativeBodyAudit:g.nativeBodyAudit,nativePlungerAudit:g.nativePlungerAudit}:{})};reports.push(report);
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
  if(limit.flipperAngle!==undefined)assert.ok(report.maxFlipperAngleError<=limit.flipperAngle,`${report.name} native flipper angle ${report.maxFlipperAngleError}`);
  assert.equal(report.physicsStats.substepBudgetExceeded,0,'collision iteration budget');
  if(fixture.nativeBodyRegression){
    const limit=fixture.nativeBodyRegression;assert.equal(report.nativeBodySummary.frames,limit.frames,'complete native body-frame coverage');
    for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.ok(report.nativeBodySummary[key]<=limit[key],`${report.name} every native body ${key}`);
  }
  if(fixture.nativePlungerRegression){
    const limit=fixture.nativePlungerRegression;assert.equal(report.nativePlungerSummary.frames,limit.frames,'complete native rod-frame coverage');
    for(const [key,value]of Object.entries(limit.errors)){assert.ok(report.nativePlungerSummary.errors[key]<=value,`${report.name} native rod ${key}`);assert.equal(report.nativePlungerSummary.observations[key],limit.frames,`${key} per-frame coverage`);}
  }
  if(fixture.nativeScriptRandom?.requireContinuity){assert.equal(report.nativeScriptRandomAudit.length,fixture.nativeBodyRegression.frames,'complete native script RNG coverage');assert.ok(report.nativeScriptRandomAudit.every(row=>row.agrees));}
  if(fixture.traceRegression){
    const limit=fixture.traceRegression,rows=report.traceSamples.filter(s=>s.ms<=limit.throughMilliseconds);assert.equal(rows.length,limit.throughMilliseconds+1,'every native millisecond is covered');
    for(const row of rows){assert.ok(row.positionError<limit.position,`${report.name} trace position at ${row.ms}ms`);assert.ok(row.velocityError<limit.velocity,`${report.name} trace speed at ${row.ms}ms`);assert.ok(row.angularError<limit.angular,`${report.name} trace spin at ${row.ms}ms`);}
  }
}
