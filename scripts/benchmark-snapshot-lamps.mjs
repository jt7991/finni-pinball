// Compare complete publication deltas against the previous uncached lamp path
// on the same running authored game. The two independent consumers see exactly
// the same physical/rule/frame states; neither supplies game state or timing.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFullGame} from '../three/full-game.js';
import {snapshotGame} from '../three/game-snapshot.js';

const count=Number(process.argv.find(arg=>arg.startsWith('--samples='))?.slice(10)??2000);
assert.ok(Number.isInteger(count)&&count>=100&&count<=10000);
const report=process.argv.find(arg=>arg.startsWith('--report='))?.slice(9)??'.work/three-review/snapshot-lamp-benchmark.json';
const json=name=>JSON.parse(fs.readFileSync(new URL('../three/public/'+name+'.json',import.meta.url)));
const game=await createFullGame(json('layout'),json('objects'),fs.readFileSync(new URL('../three/public/rules.vbs',import.meta.url),'utf8'),()=>{},undefined,{frameAnimations:true});
const revision=game.rules.snapshotRevision,names=new Set(game.rules.objects.keys()),queries=new Set(['bChooseBattle']);
const lamps=new Set([...game.rules.lamps.keys()].map(name=>game.rules.objects.get(name)));
const oldRevision=(object,keys)=>lamps.has(object)?undefined:revision(object,keys);
const states={cached:new Map(),previous:new Map()},times={cached:[],previous:[]};
try{
 game.start();for(let tick=0;tick<2100;tick++)game.step();game.prepareFrame();game.launch();
 for(let sample=0;sample<count;sample++){
  if(sample%4===0){for(let tick=0;tick<17;tick++)game.step();game.prepareFrame();}
  if(sample%120===0){game.input('left',!(sample%240));game.input('right',!!(sample%240));}
  const snapshots={};
  for(const mode of sample%2?['cached','previous']:['previous','cached']){
   game.rules.snapshotRevision=mode==='cached'?revision:oldRevision;
   const start=performance.now(),snapshot=snapshotGame(game,names,queries,states[mode]);
   times[mode].push(performance.now()-start);
   snapshots[mode]=structuredClone(snapshot);
  }
  assert.deepEqual(snapshots.cached,snapshots.previous,'Every published field and delta at sample '+sample);
 }
 const summary=values=>{const sorted=values.slice(100).sort((a,b)=>a-b);return{samples:sorted.length,totalMilliseconds:sorted.reduce((a,b)=>a+b,0),medianMilliseconds:sorted[Math.floor(sorted.length*.5)],p95Milliseconds:sorted[Math.floor(sorted.length*.95)]};};
 const result={scope:'Same-game complete publication-delta comparison. Alternating order, independent consumer caches, 100 warmup samples excluded from timing. Measures construction only, without structured clone or postMessage. Desktop Node; not phone performance.',publicationsCompared:count,objects:names.size,lamps:lamps.size,cached:summary(times.cached),previous:summary(times.previous),differences:0};
 fs.writeFileSync(report,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{game.rules.snapshotRevision=revision;game.dispose();}
