import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {STEP} from '../three/physics.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall,readReferenceAssets} from './reference-physics.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))??'three/tests/fixtures/vpx-targets.json'));
assert.equal(fixture.probeKind,'targets');
const {layout,objects,source}=readReferenceAssets(fixture);applyReferencePhysics(layout,objects,fixture);
const reports=[];
for(const c of fixture.cases){
  const g=await createFullGame(layout,objects,source,()=>{});g.random=referenceRandom();
  try{
    g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();const r=g.records[0];
    const timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
    if(c.setupCode)g.rules.execute(c.setupCode);
    placeReferenceBall(g,r,c);
    let elapsed=0;const samples=[];
    for(const expected of c.samples){
      for(let ms=elapsed;ms<expected[0];ms++)g.step();elapsed=expected[0];
      const p=r.body.translation(),v=r.body.linvel(),targets=['target009','target010','target011'].map(n=>g.rules.objects.get(n));
      const dropped=targets.map(t=>Number(!!t.isdropped)),offsets=targets.map(t=>Number(t.currentanimoffset)),score=g.rules.value('Score(CurrentPlayer)');
      samples.push({ms:elapsed,expected,dropped,offsets,score,positionError:Math.hypot(p.x*100-expected[1],2115-p.y*100-expected[2],p.z*100-expected[3]),velocityError:Math.hypot(v.x-expected[4],-v.y-expected[5],v.z-expected[6]),animationError:Math.max(...offsets.map((n,i)=>Math.abs(n-expected[15+i])))});
    }
    const stateMismatch=s=>s.dropped.some((n,i)=>n!==Number(!!s.expected[12+i]))||s.score!==s.expected[18];
    const completionErrors=[...new Set(samples.map(s=>s.expected[18]))].filter(n=>n>0).map(score=>{const native=samples.find(s=>s.expected[18]>=score)?.ms,actual=samples.find(s=>s.score>=score)?.ms;return actual===undefined?Infinity:Math.abs(actual-native);});
    const report={name:c.name,maxPositionError:Math.max(...samples.map(s=>s.positionError)),maxVelocityError:Math.max(...samples.map(s=>s.velocityError)),maxAnimationError:Math.max(...samples.map(s=>s.animationError)),maxCompletionTimeError:Math.max(0,...completionErrors),settledStateMismatches:samples.filter(s=>s.ms>=250&&stateMismatch(s)).length,score:samples.at(-1).score,physicsStats:g.physicsStats,samples};reports.push(report);
    if(!process.argv.includes('--json'))console.log(JSON.stringify({...report,samples:undefined}));
  }finally{g.dispose();}
}
fs.mkdirSync('.work/three-review',{recursive:true});fs.writeFileSync('.work/three-review/vpx-targets-comparison.json',JSON.stringify(reports,null,2));
if(process.argv.includes('--json'))console.log(JSON.stringify(reports));
if(process.argv.includes('--check'))for(const r of reports){
  assert.equal(r.settledStateMismatches,0,r.name+' completed drop flags and authored score');
  assert.ok(r.maxAnimationError<16,r.name+' motion within one native render frame');
  assert.ok(r.maxCompletionTimeError<=17,r.name+' completion event within one native render frame');
  assert.equal(r.physicsStats.substepBudgetExceeded,0);
}
