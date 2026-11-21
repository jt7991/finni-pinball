import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createFullGame} from '../three/full-game.js';
const json=name=>JSON.parse(fs.readFileSync('three/public/'+name+'.json'));
const g=await createFullGame(json('layout'),json('objects'),fs.readFileSync('three/public/rules.vbs','utf8'),()=>{});
let seed=225;g.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const queries=[],boxes=new WeakMap();
try{
  g.start();g.step();const tree=g.nativeTree,original=tree.query.bind(tree);
  tree.query=(q,visit)=>{
    let box=boxes.get(q.box);if(!box){box={...q.box};boxes.set(q.box,box);}
    const owner=g.physicalRecords.findIndex(r=>r.nativeFrameQuery?.box===q.box);
    queries.push({p:{...q.p},box,radiusSquared:q.radiusSquared,owner});original(q,visit);
  };
  for(let ms=1;ms<=6000;ms++){
    if(g.inLane&&ms<3000&&!g.plunger.fireTimer){g.input('launch',true);if(g.charge>=1.05)g.input('launch',false);}
    if(ms%140===0){g.input('left',!g.held.left);g.input('right',!g.held.right);}
    g.step();
  }
  const ids=new Map(tree.entries.map((entry,i)=>[entry,i])),caches=[];
  const cached=(q,visit)=>original(q,visit,caches[q.owner]??={});
  const run=fn=>{let count=0,hash=0;const visit=e=>{count++;hash=(Math.imul(hash,33)+ids.get(e))|0;};const start=performance.now();for(const q of queries)fn(q,visit);return {ms:performance.now()-start,count,hash};};
  for(let round=0;round<5;round++){
    const baseline=run(original),candidate=run(cached);
    if(baseline.count!==candidate.count||baseline.hash!==candidate.hash)throw Error('Contact order mismatch');
    console.log(JSON.stringify({round,queries:queries.length,entries:tree.entries.length,baseline,candidate,speedup:baseline.ms/candidate.ms}));
  }
}finally{g.dispose();}
