// Offline geometry timing only. Recorded native body observations become
// declared query inputs here; no playing body, RNG or clock is restored.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createFullGame} from '../three/full-game.js';
import {nativeMeshNarrowHit,nativeMeshQuery} from '../three/native-mesh-contact.js';
import {readNativeFrameHistoryDigests} from './native-frame-history-package.mjs';
const option=(key,fallback)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)??fallback;
const output=option('output'),baselineCommit=option('baseline','45a68c1');
assert.ok(output&&!fs.existsSync(output),'Choose a fresh report path');assert.match(baselineCommit,/^[a-f0-9]{7,40}$/);
const sha=data=>createHash('sha256').update(data).digest('hex');
const before=execFileSync('git',['show',baselineCommit+':three/native-mesh-contact.js'],{encoding:'utf8'});
const source=before.replace("'./native-vector.js'",JSON.stringify(new URL('../three/native-vector.js',import.meta.url).href));
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const file='three/tests/fixtures/vpx-main-6f8116d-natural-play-render-digests-native.json.gz';
const {capture}=readNativeFrameHistoryDigests(file);
const read=n=>JSON.parse(fs.readFileSync('three/public/'+n+'.json'));
const game=await createFullGame(read('layout'),read('objects'),fs.readFileSync('three/public/rules.vbs','utf8'),()=>{});
try{
  game.buildNativeTree();const inputs=[];
  for(const frame of capture.startup.boundaries)for(const ball of frame.balls){
    if(ball.locked||ball.id<3)continue;
    const p=ball.position,v=ball.velocity;
    const query=nativeMeshQuery({x:p[0]*.01,y:(2115-p[1])*.01,z:p[2]*.01},{x:v[0],y:-v[1],z:v[2]},.25,.001);
    inputs.push(query);
  }
  assert.ok(inputs.length>10000);
  const run=(hit,verify=false)=>{
    const cache={},words=[],bits=new DataView(new ArrayBuffer(8));let hits=0,queries=0,sum=0;
    const start=performance.now();
    for(const query of inputs)game.nativeTree.query(query,entry=>{
      if(!entry.mesh||!entry.mesh.collider.isEnabled())return;queries++;
      const result=hit(entry.shape,query);if(verify)words.push(queries,result?1:0);if(!result)return;hits++;sum+=result.time;
      if(verify){
        words.push(entry.shape.id??0,Number(result.contact));
        for(const value of [result.time,result.gap,result.vn,result.normal.x,result.normal.y,result.normal.z]){bits.setFloat64(0,value,true);words.push(bits.getUint32(0,true),bits.getUint32(4,true));}
      }
    },cache);
    return{milliseconds:performance.now()-start,queries,hits,sum,...verify?{sha256:sha(new Uint32Array(words))}:{}};
  };
  const old=run(baseline.nativeMeshNarrowHit,true),current=run(nativeMeshNarrowHit,true);
  for(const field of ['queries','hits','sum','sha256'])assert.equal(current[field],old[field],field);
  for(let i=0;i<3;i++){run(baseline.nativeMeshNarrowHit);run(nativeMeshNarrowHit);}
  const samples=[];
  for(const variant of ['baseline','candidate','candidate','baseline','candidate','baseline','baseline','candidate'])samples.push({variant,...run(variant==='baseline'?baseline.nativeMeshNarrowHit:nativeMeshNarrowHit)});
  const averages=Object.fromEntries(['baseline','candidate'].map(name=>[name,samples.filter(s=>s.variant===name).reduce((sum,s)=>sum+s.milliseconds,0)/4]));
  const report={scope:'Offline mesh contact benchmark using the ordinary-play recording as declared position/velocity query inputs. Static initialized table geometry only; independent complete-game and renderer regressions remain required. Every non-null result, contact Boolean and ordered shape ID matches the prior implementation at Float64 bits. Timings exclude initialization and correctness hashing, follow three warmup pairs and use balanced variant order. This is desktop Node CPU timing, not phone performance.',baselineCommit,baselineSHA256:sha(before),candidateSHA256:sha(fs.readFileSync('three/native-mesh-contact.js')),fixture:file,fixtureSHA256:sha(fs.readFileSync(file)),inputs:inputs.length,treeEntries:game.nativeTree.entries.length,correctness:{baseline:old,candidate:current},samples,averages};
  fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({inputs:inputs.length,correctness:report.correctness,samples,averages}));
}finally{game.dispose();}
