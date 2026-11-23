import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,placeReferenceBall,restoreReferenceBalls,readReferenceAssets} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-flipper-events-native-state.json'));
assert.equal(fixture.probeKind,'flipper-events');
const {layout,objects,source}=readReferenceAssets(fixture);
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
    // Native executes this initial command before the first observed RNG frame.
    // Its solenoid sound draws must precede restoring that observed state.
    if(scenario.side)game.rules.run(`Sol${scenario.side==='left'?'L':'R'}Flipper`,true);
    placeReferenceBall(game,record,scenario);record=restoreReferenceBalls(game,fixture,scenario,record);
    const origin=Math.round(game.time*1000),events=[],expectedEvents=scenario.timerTrace.filter(row=>row[0]==='FLIP_COLLIDE'||row[0]==='FLIP_HIT');
    const hit=game.rules.hit.bind(game.rules);
    game.rules.hit=(name,event,ball,...parameters)=>{
      if(/^(Left|Right)Flipper$/i.test(name)&&(event==='Collide'||event==='Hit'))events.push({ms:Math.round(game.time*1000)-origin,index:/^Left/i.test(name)?1:2,event,parameters,velocity:[ball.velx,ball.vely,ball.velz]});
      return hit(name,event,ball,...parameters);
    };
    if(scenario.repeatFlipperReset){
      game.rules.engine.addCode('Dim HostFlipperProbeBall');game.rules.engine.addObject('HostFlipperProbeBall',record.proxy);
      const body='HostFlipperProbeBall';game.rules.schedule(scenario.actualDelay,`${body}.X=${scenario.x}:${body}.Y=${scenario.y}:${body}.Z=${scenario.z}:${body}.VelX=${scenario.vx}:${body}.VelY=${scenario.vy}:${body}.VelZ=0:${body}.AngMomX=0:${body}.AngMomY=0:${body}.AngMomZ=0`);
    }
    let elapsed=0;const samples=[];
    for(const expected of scenario.samples){
      for(let ms=elapsed;ms<expected[0];ms++)game.step();elapsed=expected[0];const b=record.proxy;
      const actual=[elapsed,b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz,...game.flippers.map(f=>90-f.angle*180/Math.PI)];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));samples.push({expected,actual,positionError:error(1),velocityError:error(4),angularError:error(7)});
    }
    const report={name:scenario.name,events,expectedEvents,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxAngularError:Math.max(...samples.map(s=>s.angularError)),physicsStats:game.physicsStats,samples,nativeRandomAudit:game.nativeRandomAudit,...(process.argv.includes('--body-audit')?{nativeBodyAudit:game.nativeBodyAudit}:{})};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeRandomAudit:undefined,nativeBodyAudit:undefined}));
  }finally{game.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-flipper-events-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const report of reports){
  const limit=fixture.regressionLimits;
  assert.ok(report.maxPositionError<limit.position,report.name+' position '+report.maxPositionError);assert.ok(report.maxVelocityError<limit.velocity,report.name+' velocity '+report.maxVelocityError);assert.ok(report.maxAngularError<limit.angular,report.name+' angular '+report.maxAngularError);
  assert.equal(report.events.length,report.expectedEvents.length,report.name+' event count');
  report.events.forEach((event,index)=>{
    const [kind,ms,side,...values]=report.expectedEvents[index];assert.equal(event.ms,ms,report.name+' callback clock');assert.equal(event.index,side);assert.equal(event.event,kind==='FLIP_COLLIDE'?'Collide':'Hit');
    if(kind==='FLIP_COLLIDE'){assert.equal(event.parameters.length,1);assert.ok(Math.abs(event.parameters[0]-values[0])<limit.velocity,report.name+' callback speed');assert.ok(Math.hypot(...event.velocity.map((n,i)=>n-values[i+1]))<limit.velocity,report.name+' callback velocity');}
    else assert.equal(event.parameters.length,0);
  });
  assert.equal(report.physicsStats.substepBudgetExceeded,0);
}
