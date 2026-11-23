import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,placeReferenceBall,restoreReferenceBalls,readReferenceAssets} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-material-events-native-state.json'));
assert.equal(fixture.probeKind,'material-events');
const {layout,objects,source}=readReferenceAssets(fixture);
applyReferencePhysics(layout,objects,fixture);const reports=[];
for(const scenario of fixture.cases){
  const sounds=[];let game;
  game=await createFullGame(layout,objects,source,()=>{},{play:(name,settings)=>{if(['fx_rubber_longband','fx_rubber_peg'].includes(name))sounds.push({clock:Math.round((game?.time??0)*1000),name,settings});},stop(){}});
  try{
    game.start();for(let ms=0;ms<2000;ms++)game.step();let record=game.records[0];
    for(const [path,value]of Object.entries({...fixture.runtimeOverrides,...scenario.runtimeOverrides})){
      const at=path.lastIndexOf('.'),object=game.rules.objects.get(path.slice(0,at).toLowerCase());assert.ok(object,path);object[path.slice(at+1).toLowerCase()]=value;
    }
    game.rules.execute(fixture.ruleControls);
    const rolling=game.rules.objects.get('rollingtimer');rolling.enabled=false;rolling.enabled=true;
    placeReferenceBall(game,record,scenario);record=restoreReferenceBalls(game,fixture,scenario,record);
    const origin=Math.round(game.time*1000),events=[],expectedEvents=scenario.timerTrace.filter(row=>row[0]==='MATERIAL');
    sounds.length=0;
    const hit=game.rules.hit.bind(game.rules);
    game.rules.hit=(name,event,ball,...parameters)=>{
      if(event==='Hit'&&game.nativeHitObjects.has(name.toLowerCase()))events.push({ms:Math.round(game.time*1000)-origin,name,velocity:[ball.velx,ball.vely,ball.velz],hitThreshold:/^Camera[12]$/.test(name)?game.rules.value(name+'.HitThreshold'):0});
      return hit(name,event,ball,...parameters);
    };
    let elapsed=0;const samples=[];
    for(const expected of scenario.samples){
      for(let ms=elapsed;ms<expected[0];ms++)game.step();elapsed=expected[0];const b=record.proxy;
      const actual=[elapsed,b.x,b.y,b.z,b.velx,b.vely,b.velz,b.angvelx,b.angvely,b.angvelz,...game.flippers.map(f=>90-f.angle*180/Math.PI),game.rules.value('Score(CurrentPlayer)')];
      const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((n,i)=>n-expected[offset+i]));samples.push({expected,actual,positionError:error(1),velocityError:error(4),angularError:error(7)});
    }
    const report={name:scenario.name,object:scenario.object,events,expectedEvents,sounds:sounds.map(({clock,...sound})=>({ms:clock-origin,...sound})),maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxAngularError:Math.max(...samples.map(s=>s.angularError)),scoreMismatches:samples.filter(s=>s.actual[12]!==s.expected[12]).length,physicsStats:game.physicsStats,samples,nativeRandomAudit:game.nativeRandomAudit,...(process.argv.includes('--body-audit')?{nativeBodyAudit:game.nativeBodyAudit}:{})};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined,nativeRandomAudit:undefined,nativeBodyAudit:undefined}));
  }finally{game.dispose();}
}
fs.writeFileSync(process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'.work/three-review/vpx-material-events-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const report of reports){
  const limit=fixture.regressionLimits;
  assert.ok(report.maxPositionError<limit.position,report.name+' position '+report.maxPositionError);assert.ok(report.maxVelocityError<limit.velocity,report.name+' velocity '+report.maxVelocityError);assert.ok(report.maxAngularError<limit.angular,report.name+' angular '+report.maxAngularError);
  assert.equal(report.scoreMismatches,0,report.name+' scores');assert.equal(report.events.length,report.expectedEvents.length,report.name+' event count');
  report.events.forEach((event,index)=>{const [,ms,name,...velocity]=report.expectedEvents[index];assert.equal(event.ms,ms,report.name+' native callback clock');assert.equal(event.name,name);assert.ok(Math.abs(event.hitThreshold-velocity[3])<limit.velocity,report.name+' primitive HitThreshold');assert.ok(Math.hypot(...event.velocity.map((n,i)=>n-velocity[i]))<limit.velocity,report.name+' callback velocity');});
  const soundName=report.object.startsWith('rlband')?'fx_rubber_longband':report.object==='rpeg003'?'fx_rubber_peg':null;
  assert.equal(report.sounds.length,soundName?report.expectedEvents.length:0,report.name+' authored collection sounds');
  report.sounds.forEach((sound,index)=>{
    const [,ms,,vx,vy]=report.expectedEvents[index],speed=Math.sqrt(vx*vx+vy*vy);assert.equal(sound.ms,ms);assert.equal(sound.name,soundName);assert.equal(sound.settings.randomPitch,0);
    assert.ok(Math.abs(sound.settings.volume-Math.fround(speed*speed/2000))<1e-9,report.name+' sound volume after response');assert.ok(Math.abs(sound.settings.pitch-speed*200)<.000001,report.name+' sound pitch after response');
  });
  assert.equal(report.physicsStats.substepBudgetExceeded,0);
}
