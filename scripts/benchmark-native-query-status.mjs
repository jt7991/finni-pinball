// Offline component comparison. Recorded positions/velocities are declared
// query inputs, never corrections to a playing body, RNG or clock.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{createFullGame}from'../three/full-game.js';import{NativeQueryStatus}from'../three/native-query-status.js';import{nativeMeshNarrowHit,nativeMeshQuery}from'../three/native-mesh-contact.js';
import{readNativeFrameHistoryDigests}from'./native-frame-history-package.mjs';import{nativeSourceAssets}from'./native-source-assets.mjs';
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);assert.ok(output&&!fs.existsSync(output),'Fresh report path required');const sha=b=>createHash('sha256').update(b).digest('hex');
const file='three/tests/fixtures/vpx-main-6f8116d-natural-play-render-digests-native.json.gz',{capture}=readNativeFrameHistoryDigests(file),assets=nativeSourceAssets(capture.reference.sourceSha256),g=await createFullGame(assets.json('layout.json'),assets.json('objects.json'),assets.text('rules.vbs'),()=>{});
try{
 g.buildNativeTree();const inputs=[];for(const frame of capture.startup.boundaries)for(const ball of frame.balls)if(!ball.locked&&ball.id>=3){const p=ball.position,v=ball.velocity;inputs.push(nativeMeshQuery({x:p[0]*.01,y:(2115-p[1])*.01,z:p[2]*.01},{x:v[0],y:-v[1],z:v[2]},.25,.001));}
 assert.ok(inputs.length>10000);const ids=new Map(g.nativeMeshes.map((m,i)=>[m,i])),status=new NativeQueryStatus();
 const run=(cached,verify=false)=>{
  const frameCache={},words=[],bits=new DataView(new ArrayBuffer(8));let candidates=0,hits=0,reads=0,sum=0;
  const enabled=cached?entry=>status.enabled(entry.mesh,entry.meshIndex):verify?entry=>{reads++;return entry.mesh.collider.isEnabled();}:entry=>entry.mesh.collider.isEnabled();
  // Instrument only the correctness run; counters are excluded from timings.
  const originals=[];if(verify&&cached)for(const mesh of g.nativeMeshes){const raw=mesh.collider.isEnabled;if(originals.some(([collider])=>collider===mesh.collider))continue;originals.push([mesh.collider,raw,Object.getOwnPropertyDescriptor(mesh.collider,'isEnabled')]);mesh.collider.isEnabled=function(){reads++;return raw.call(this);};}
  const start=performance.now();
  try{for(const query of inputs){if(cached)status.begin();g.nativeTree.query(query,entry=>{
   if(!entry.mesh)return;candidates++;const active=enabled(entry);if(verify)words.push(ids.get(entry.mesh),entry.shape.id??0,Number(active));if(!active)return;
   const result=nativeMeshNarrowHit(entry.shape,query);if(verify)words.push(result?1:0);if(!result)return;hits++;sum+=result.time;
   if(verify){words.push(Number(result.contact));for(const value of [result.time,result.gap,result.vn,result.normal.x,result.normal.y,result.normal.z]){bits.setFloat64(0,value,true);words.push(bits.getUint32(0,true),bits.getUint32(4,true));}}
  },frameCache);}}
  finally{for(const [collider,_raw,descriptor]of originals){if(descriptor)Object.defineProperty(collider,'isEnabled',descriptor);else delete collider.isEnabled;}}
  return{milliseconds:performance.now()-start,candidates,hits,sum,...verify?{reads,sha256:sha(new Uint32Array(words))}:{}};
 };
 const baseline=run(false,true),candidate=run(true,true);for(const key of ['candidates','hits','sum','sha256'])assert.equal(candidate[key],baseline[key],key);assert.ok(candidate.reads<baseline.reads);
 for(let i=0;i<3;i++){run(false);run(true);}const samples=[];for(const cached of [false,true,true,false,true,false,false,true])samples.push({variant:cached?'candidate':'baseline',...run(cached)});
 const means=Object.fromEntries(['baseline','candidate'].map(name=>[name,samples.filter(s=>s.variant===name).reduce((sum,s)=>sum+s.milliseconds,0)/4]));
 const report={scope:'Desktop offline native mesh status/query component. Complete ordered mesh/shape identities, enabled results, null/hit results, contact Boolean and Float64 result bits agree. No whole-game or phone speed claim.',fixture:file,fixtureSHA256:sha(fs.readFileSync(file)),sourceTableSHA256:capture.reference.sourceSha256,inputs:inputs.length,correctness:{baseline,candidate},samples,means};fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({inputs:inputs.length,correctness:report.correctness,means}));
}finally{g.dispose();}
