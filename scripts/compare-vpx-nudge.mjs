import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls,readReferenceFixture,summarizeNativePlunger} from './reference-physics.mjs';
const fixture=readReferenceFixture(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-nudge.json');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});
  g.random=referenceRandom();
  try{
    g.start();for(let i=0;i<2/STEP;i++)g.step();let r=g.records[0];
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    placeReferenceBall(g,r,{...c,vx:0,vy:0,vz:0});
    r=restoreReferenceBalls(g,fixture,c,r);
    const origin=Math.round(g.time*1000);let clockInputs=0;
    if(c.scriptClocks)g.rules.engine._registerFunction('Timer',()=>{
      const clock=c.scriptClocks[clockInputs++];assert.ok(clock,'independently observed native Timer input exists');assert.equal(clock.type,4);assert.equal(Math.round(g.time*1000)-origin,clock.ms);return {type:'Single',value:clock.value};
    });
    const frameClocks=new Map((c.animationFrames??[]).map(row=>[row[0],row])),animationAudit=[];
    if(frameClocks.size){g.frameAnimations=true;g.lastAnimationTime=origin+c.animationFrames[0][0]-c.animationFrames[0][1];for(let i=1;i<c.animationFrames.length;i++)assert.equal(c.animationFrames[i][0]-c.animationFrames[i-1][0],c.animationFrames[i][1]);}
    if(c.actualDelay)g.rules.schedule(c.actualDelay,`Nudge ${c.nudgeAngle},${c.force}`);else g.rules.execute(`Nudge ${c.nudgeAngle},${c.force}`);
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      advance(expected[0]);
      let actual;if(fixture.nativeBodyRegression){const b=r.proxy;actual=[elapsed,b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz];}else{const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();actual=[elapsed,p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100];}
      samples.push({expected,actual,...(fixture.nativeBodyRegression?{active:g.physicalRecords.includes(r)}:{}),positionError:Math.hypot(...actual.slice(1,4).map((x,i)=>x-expected[i+1])),velocityError:Math.hypot(...actual.slice(4,7).map((x,i)=>x-expected[i+4])),angularError:Math.hypot(...actual.slice(7,10).map((x,i)=>x-expected[i+7])),xyVelocityError:Math.hypot(actual[4]-expected[4],actual[5]-expected[5])});
    }
    function advance(to){for(let ms=elapsed;ms<to;ms++){
      g.step();const expected=frameClocks.get(ms+1);if(!expected)continue;g.prepareFrame();const targets=(fixture.instrumentation.animationFrameTrace.targets??['Target009','Target010','Target011']).map(name=>g.targetMotions.get(name.toLowerCase())),actual=[ms+1,expected[1],...targets.map(t=>t.offset),...targets.map(t=>Number(t.dropped)),g.rules.value('Score(CurrentPlayer)')];animationAudit.push({ms:ms+1,errors:actual.slice(2).map((v,i)=>v-(i<3?Math.fround(expected[i+2]):expected[i+2]))});
    }elapsed=to;}
    if(fixture.nativeBodyRegression?.throughMilliseconds>elapsed)advance(fixture.nativeBodyRegression.throughMilliseconds);
    let nativeProof;if(fixture.nativeBodyRegression){
      const bodies=g.nativeBodyAudit.flatMap(row=>row.bodies),summary={frames:g.nativeBodyAudit.length,bodies:bodies.length,...Object.fromEntries(['positionError','velocityError','momentumError','orientationError'].map(key=>[key,Math.max(0,...bodies.map(b=>b[key]??0))])),identityMismatches:g.nativeBodyAudit.filter(r=>r.missingIDs?.length||r.unexpectedIDs?.length).length};
      const publicGetters=Object.fromEntries(['active','removed'].map(kind=>{const rows=samples.filter(s=>s.active===(kind==='active'));return [kind,{samples:rows.length,positionError:Math.max(0,...rows.map(s=>s.positionError)),velocityError:Math.max(0,...rows.map(s=>s.velocityError)),angularError:Math.max(0,...rows.map(s=>s.angularError))}];}));
      nativeProof={summary,publicGetters,nativeRandomAudit:g.nativeRandomAudit,nativeScriptRandomAudit:g.nativeScriptRandomAudit,plunger:summarizeNativePlunger(g.nativePlungerAudit),animationFrames:animationAudit.length,animationErrors:Math.max(0,...animationAudit.flatMap(r=>r.errors.map(Math.abs))),clockInputs,...(process.argv.includes('--body-audit')?{bodyAudit:g.nativeBodyAudit}:{}),scope:'Complete observed initial live bodies/history/rod/RNG and actual starting timer deadlines restored once; original native frame and Timer inputs replayed. Every live body and both streams are strict gates. Retained removed-object public getters are compared separately at their original text precision, including contacts completed after removal.'};
    }
    const report={name:c.name,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxXYVelocityError:Math.max(...samples.map(s=>s.xyVelocityError)),physicsStats:g.physicsStats,samples,...(nativeProof?{nativeProof}:{})};reports.push(report);if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeProof:nativeProof?{...nativeProof,nativeRandomAudit:undefined,nativeScriptRandomAudit:undefined,bodyAudit:undefined}:undefined}));
  }catch(error){
    if(fixture.nativeBodyRegression)fs.writeFileSync((process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-nudge-comparison.json')+'.partial',JSON.stringify({error:String(error),stack:error.stack,time:g.time,bodyAudit:g.nativeBodyAudit,randomAudit:g.nativeRandomAudit,scriptRandomAudit:g.nativeScriptRandomAudit,actualRandom:g.random.getState(),timers:[...g.rules.timers.values()].map(t=>({name:t.handler,at:t.at,interval:t.object.interval}))},null,2));throw error;
  }finally{g.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-nudge-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  if(fixture.nativeBodyRegression){
    const p=r.nativeProof,limit=fixture.nativeBodyRegression;assert.equal(p.summary.frames,limit.frames);for(const key of ['positionError','velocityError','momentumError','orientationError'])assert.equal(p.summary[key],0,key);assert.equal(p.summary.identityMismatches,0);assert.ok(p.nativeRandomAudit.every(row=>row.agrees));assert.ok(p.nativeScriptRandomAudit.every(row=>row.agrees));assert.equal(p.nativeScriptRandomAudit.length,limit.frames);assert.equal(p.clockInputs,fixture.cases.find(c=>c.name===r.name).scriptClocks.length);assert.equal(p.animationFrames,fixture.animationRegression.frames);assert.equal(p.animationErrors,0);for(const value of Object.values(p.plunger.errors))assert.equal(value,0);assert.equal(p.plunger.frames,limit.frames);for(const [kind,getters]of Object.entries(p.publicGetters)){assert.ok(getters.positionError<.001,`${kind} retained public position`);assert.ok(getters.velocityError<.000001,`${kind} retained public velocity`);assert.ok(getters.angularError<.000001,`${kind} retained public angular velocity`);}
  }else{
    const limit=fixture.regressionLimits?.[r.name]??{position:.06,velocity:.005};
    assert.ok(r.maxPositionError<limit.position,`${r.name} position ${r.maxPositionError} VPU`);
    assert.ok(r.maxVelocityError<limit.velocity,`${r.name} velocity ${r.maxVelocityError}`);
  }
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
