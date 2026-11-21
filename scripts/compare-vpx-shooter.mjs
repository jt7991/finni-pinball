import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {applyReferencePhysics,referenceRandom,placeReferenceBall} from './reference-physics.mjs';

// Independently captured native states are observed at the end of the flipper
// timer, immediately before that millisecond's physics update.
const fixture=JSON.parse(fs.readFileSync('three/tests/fixtures/vpx-shooter-guide.json'));
const layout=JSON.parse(fs.readFileSync('three/public/layout.json')),objects=JSON.parse(fs.readFileSync('three/public/objects.json'));
applyReferencePhysics(layout,objects,fixture);
const g=await createFullGame(layout,objects,fs.readFileSync('three/public/rules.vbs','utf8'),()=>{});
g.random=referenceRandom();
try{
  g.start();for(let ms=0;ms<2000;ms++)g.step();g.launch();
  const c=fixture.cases[0],r=g.records[0],timer=g.rules.objects.get('rollingtimer');timer.enabled=false;timer.enabled=true;
  placeReferenceBall(g,r,c);
  let elapsed=0;const samples=[];
  for(const row of c.timerTrace.filter(row=>row[0]==='STATE')){
    const ms=row[1]-1;while(elapsed<ms){g.step();elapsed++;}
    const expected=row.slice(2,11);for(let i=3;i<9;i++)expected[i]/=1e6;
    const p=r.body.translation(),v=r.body.linvel(),w=r.body.angvel();
    const actual=[p.x*100,2115-p.y*100,p.z*100,v.x,-v.y,v.z,-w.x/100,w.y/100,-w.z/100];
    const error=offset=>Math.hypot(...actual.slice(offset,offset+3).map((value,i)=>value-expected[offset+i]));
    samples.push({ms,expected,actual,positionError:error(0),velocityError:error(3),angularError:error(6)});
  }
  const limit=fixture.traceRegression,checked=samples.filter(s=>s.ms<=limit.throughMilliseconds);
  const maxima=rows=>Object.fromEntries(['positionError','velocityError','angularError'].map(key=>[key,Math.max(...rows.map(row=>row[key]))]));
  const report={checkedThrough:limit.throughMilliseconds,checked: maxima(checked),full:maxima(samples),physicsStats:g.physicsStats,samples};
  fs.mkdirSync('.work/three-review',{recursive:true});
  fs.writeFileSync('.work/three-review/vpx-shooter-guide-comparison.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,samples:undefined}));
  if(process.argv.includes('--check')){
    assert.equal(checked.length,limit.throughMilliseconds+1,'every millisecond is measured');
    for(const s of checked){
      assert.ok(s.positionError<limit.position,`shooter position at ${s.ms}ms`);
      assert.ok(s.velocityError<limit.velocity,`shooter speed at ${s.ms}ms`);
      assert.ok(s.angularError<limit.angular,`shooter spin at ${s.ms}ms`);
    }
    assert.equal(g.physicsStats.substepBudgetExceeded,0);
  }
}finally{g.dispose();}
