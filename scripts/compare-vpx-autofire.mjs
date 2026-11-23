import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,placeReferenceBall,restoreReferenceBalls,readReferenceAssets} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-autofire.json'));
assert.equal(fixture.probeKind,'autofire');
const {layout,objects,source}=readReferenceAssets(fixture);
applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const scenario of fixture.cases){
  const game=await createFullGame(layout,objects,source,()=>{});
  try{
    game.start();for(let ms=0;ms<2000;ms++)game.step();let record=game.records[0];
    const rolling=game.rules.objects.get('rollingtimer');rolling.enabled=false;rolling.enabled=true;
    placeReferenceBall(game,record,scenario);record=restoreReferenceBalls(game,fixture,scenario,record);
    const initial=scenario.initialCoilState,coil=game.rules.objects.get('hostplunger'),nativeBody=game.nativeBall(record.body).body;
    for(const [name,count]of [['swPlunger',initial.coilCount],['swPlungerRest',initial.restCount]])game.triggers.find(t=>t.spec.name===name).members.set(nativeBody,count);
    record.inLane=initial.restCount>0;game.rules.execute(`bBallInPlungerLane=${initial.inLane?'True':'False'}`);
    for(const ball of coil.balls)while(coil.balls.includes(ball))coil.removeball(ball);
    const idColumn=fixture.initialBallStateColumns.indexOf('ID');
    for(const id of initial.ballIDs){const index=scenario.initialBallStates.findIndex(row=>row[idColumn]===id);assert.ok(index>=0);coil.addball(game.physicalRecords[index].proxy);}
    coil.random(fixture.impulseOverrides.randomOut);
    if(scenario.actualDelay)game.rules.schedule(scenario.actualDelay,'PlungerIM.AutoFire');else game.rules.execute('PlungerIM.AutoFire');
    let elapsed=0;const samples=[];
    for(const expected of scenario.samples){
      for(let ms=elapsed;ms<expected[0];ms++)game.step();elapsed=expected[0];
      const b=record.proxy,actual=[elapsed,b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz,...game.flippers.map(f=>90-f.angle*180/Math.PI),game.plunger.position,coil.balls.length];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));
      samples.push({expected,actual,positionError:error(1),velocityError:error(4),angularError:error(7)});
    }
    const report={name:scenario.name,actualDelay:scenario.actualDelay,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxAngularError:Math.max(...samples.map(s=>s.angularError)),membershipMismatches:samples.filter(s=>s.actual[13]!==s.expected[13]).length,physicsStats:game.physicsStats,samples,nativeRandomAudit:game.nativeRandomAudit};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeRandomAudit:undefined}));
  }finally{game.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-autofire-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const report of reports){
  const limit=fixture.regressionLimits;assert.ok(report.maxPositionError<limit.position,report.name+' position '+report.maxPositionError);
  assert.ok(report.maxVelocityError<limit.velocity,report.name+' velocity '+report.maxVelocityError);
  assert.ok(report.maxAngularError<limit.angular,report.name+' angular '+report.maxAngularError);
  assert.equal(report.membershipMismatches,0,report.name+' native coil dictionary');assert.equal(report.physicsStats.substepBudgetExceeded,0);
}
