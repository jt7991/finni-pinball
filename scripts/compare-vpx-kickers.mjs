import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,restoreReferenceBalls,readReferenceAssets} from './reference-physics.mjs';
const path=process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-kickers.json',fixture=JSON.parse(fs.readFileSync(path));
const {layout,objects,source}=readReferenceAssets(fixture);
applyReferencePhysics(layout,objects,fixture);
assert.deepEqual(fixture.columns.slice(12),['ball_count','score','balls_in_hole']);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});g.random=referenceRandom();
  try{
    g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();let record=g.records[0];
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    placeReferenceBall(g,record,c);record=restoreReferenceBalls(g,fixture,c,record);
    const events=[],hit=g.rules.hit;g.rules.hit=(name,event,ball)=>{if(name===c.kicker&&event==='Hit')events.push(Math.round(g.time*1000)-2000);return hit(name,event,ball);};
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      while(elapsed<expected[0]){g.step();elapsed++;}
      const alive=!record.removed,actual=[g.physicalRecords.length,Number(g.rules.value('Score(CurrentPlayer)')),Number(g.rules.value('BallsInHole'))];
      // A native IBall reference outlives DestroyBall. Its subsequent velocity
      // is irrelevant to the active simulation; compare lifecycle and rules
      // once the scoop handler removes that physical body.
      let positionError=0,velocityError=0;
      if(alive&&expected[12]===4){const b=record.proxy;positionError=Math.hypot(b.x-expected[1],b.y-expected[2],b.z-expected[3]);velocityError=Math.hypot(b.velx-expected[4],b.vely-expected[5],b.velz-expected[6]);}
      samples.push({ms:elapsed,alive,expected:expected.slice(12),actual,positionError,velocityError});
    }
    const report={name:c.name,events,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),lifecycleMismatches:samples.filter(s=>s.actual.some((n,i)=>n!==s.expected[i])).length,physicsStats:g.physicsStats,samples};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined}));
  }finally{g.dispose();}
}
fs.writeFileSync('.work/three-review/vpx-kickers-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  const limit=fixture.regressionLimits[r.name];assert.ok(limit,'explicit kicker limit');
  assert.ok(r.maxPositionError<limit.position,r.name+' approach position');assert.ok(r.maxVelocityError<limit.velocity,r.name+' approach velocity');
  assert.equal(r.lifecycleMismatches,0,r.name+' native ball removal, score and pocket count');assert.equal(r.events.length,1,'one scoop entry');assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
