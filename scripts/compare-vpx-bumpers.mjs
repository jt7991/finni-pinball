import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,placeReferenceBall,restoreReferenceBalls} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-bumpers.json'));
assert.equal(fixture.probeKind,'bumpers');
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json')),source=fs.readFileSync('three/public/rules.vbs','utf8');
applyReferencePhysics(layout,objects,fixture);const reports=[];
for(const scenario of fixture.cases){
  const game=await createFullGame(layout,objects,source,()=>{});
  try{
    game.start();for(let ms=0;ms<2000;ms++)game.step();let record=game.records[0];
    for(const [path,value]of Object.entries({...fixture.runtimeOverrides,...scenario.runtimeOverrides})){
      const at=path.lastIndexOf('.'),object=game.rules.objects.get(path.slice(0,at).toLowerCase());assert.ok(object,path);object[path.slice(at+1).toLowerCase()]=value;
    }
    game.rules.execute(fixture.ruleControls);
    const rolling=game.rules.objects.get('rollingtimer');rolling.enabled=false;rolling.enabled=true;
    placeReferenceBall(game,record,scenario);record=restoreReferenceBalls(game,fixture,scenario,record);
    const origin=Math.round(game.time*1000),events=[],randomRows=scenario.timerTrace.filter(row=>row[0]==='SCRIPT_RND'),expectedEvents=scenario.timerTrace.filter(row=>row[0]==='BUMPER');
    let randomAt=0,unexpectedRandom=0;
    const hit=game.rules.hit.bind(game.rules);
    game.rules.hit=(name,event,ball)=>{
      if(!/^Bumper[123]$/i.test(name)||event!=='Hit')return hit(name,event,ball);
      events.push({ms:Math.round(game.time*1000)-origin,index:Number(name.slice(-1)),velocity:[ball.velx,ball.vely,ball.velz]});
      const original=Math.random;
      // These are observed native script RNG OUTPUTS, not fitted seeds. Scope
      // replay to the synchronous callback; physical RNG state is independent.
      Math.random=()=>{const row=randomRows[randomAt++];if(!row){unexpectedRandom++;return original();}return row[2];};
      try{return hit(name,event,ball);}finally{Math.random=original;}
    };
    if(scenario.repeatBumperReset){
      game.rules.engine.addCode('Dim HostBumperProbeBall');
      game.rules.engine.addObject('HostBumperProbeBall',record.proxy);
      const body='HostBumperProbeBall',statement=`${body}.X=${scenario.x}:${body}.Y=${scenario.y}:${body}.Z=${scenario.z}:${body}.VelX=${scenario.vx}:${body}.VelY=${scenario.vy}:${body}.VelZ=0:${body}.AngMomX=0:${body}.AngMomY=0:${body}.AngMomZ=0`;
      game.rules.schedule(scenario.actualDelay,statement);
    }
    let elapsed=0;const samples=[];
    for(const expected of scenario.samples){
      for(let ms=elapsed;ms<expected[0];ms++)game.step();elapsed=expected[0];const b=record.proxy;
      const actual=[elapsed,b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz,...game.flippers.map(f=>90-f.angle*180/Math.PI),game.rules.value('Score(CurrentPlayer)'),game.rules.value('BumperHits(CurrentPlayer)')];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));samples.push({expected,actual,positionError:error(1),velocityError:error(4),angularError:error(7)});
    }
    const report={name:scenario.name,events,expectedEvents,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxAngularError:Math.max(...samples.map(s=>s.angularError)),scoreMismatches:samples.filter(s=>s.actual[12]!==s.expected[12]).length,countMismatches:samples.filter(s=>s.actual[13]!==s.expected[13]).length,scriptRandom:{observed:randomRows.length,consumed:randomAt,unexpected:unexpectedRandom},physicsStats:game.physicsStats,samples,nativeRandomAudit:game.nativeRandomAudit,...(process.argv.includes('--body-audit')?{nativeBodyAudit:game.nativeBodyAudit}:{})};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeRandomAudit:undefined,nativeBodyAudit:undefined}));
  }finally{game.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-bumpers-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const report of reports){
  const limit=fixture.regressionLimits;
  assert.ok(report.maxPositionError<limit.position,report.name+' position '+report.maxPositionError);assert.ok(report.maxVelocityError<limit.velocity,report.name+' velocity '+report.maxVelocityError);assert.ok(report.maxAngularError<limit.angular,report.name+' angular '+report.maxAngularError);
  assert.equal(report.scoreMismatches,0,report.name+' scores');assert.equal(report.countMismatches,0,report.name+' hit counts');assert.equal(report.events.length,report.expectedEvents.length,report.name+' event count');
  report.events.forEach((event,index)=>{const [,ms,bumper,...velocity]=report.expectedEvents[index];assert.equal(event.ms,ms,report.name+' native callback clock');assert.equal(event.index,bumper);assert.ok(Math.hypot(...event.velocity.map((n,i)=>n-velocity[i]))<limit.velocity,report.name+' callback velocity');});
  assert.equal(report.scriptRandom.consumed,report.scriptRandom.observed);assert.equal(report.scriptRandom.unexpected,0);assert.equal(report.physicsStats.substepBudgetExceeded,0);
}
