// Paired static-pass timing and exact half-float output comparisons. This is
// one render component on desktop Edge, not a phone FPS or startup claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.navigate',{url:base});let ready=false;
 for(let i=0;i<1200;i++){if(await evaluate('!!window.finniThree&&document.getElementById("play")?.textContent==="Start game"')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready,'development table is ready');
 const result=await evaluate(`(async()=>{
  const {view}=window.finniThree,{renderer,nativeStatic,cameraBounds}=view,gl=renderer.getContext(),names=['main','reflection'],width=230,height=424,preset=view.camera.userData.nativeCamera.preset;
  const original=Object.fromEntries(names.map(name=>[name,{width:nativeStatic.passes[name].target.width,height:nativeStatic.passes[name].target.height}]));
  const visibility=new Map(names.flatMap(name=>nativeStatic.passes[name].parts.map(part=>[part.source,part.source.mesh.visible])));
  const counters={},saved=[],correctness=[],samples=[];let result;
  const build=(name,enabled)=>{nativeStatic.setBatchingEnabled(enabled);return nativeStatic.build(name,cameraBounds,width,height,preset,{visible:part=>visibility.get(part)});};
  function restoreMethods(){for(const {name,descriptor}of saved){if(descriptor)Object.defineProperty(gl,name,descriptor);else delete gl[name];}saved.length=0;}
  try{
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
    const descriptor=Object.getOwnPropertyDescriptor(gl,name),method=gl[name];saved.push({name,descriptor});
    gl[name]=function(...args){counters[name]=(counters[name]??0)+1;return method.apply(this,args);};
   }
   for(const name of names){
    const rows=[];
    for(const enabled of [false,true]){
     for(const key of Object.keys(counters))counters[key]=0;const target=build(name,enabled);gl.finish();
     const pixels=new Uint16Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
     rows.push({enabled,pixels,draws:{...counters},activeGroups:nativeStatic.passes[name].batches.groups.filter(group=>group.mesh.visible).map(group=>group.members.length)});
    }
    const baseline=rows[0].pixels,candidate=rows[1].pixels;let differences=0;for(let i=0;i<baseline.length;i++)if(baseline[i]!==candidate[i])differences++;
    correctness.push({name,differences,rows});
   }
   restoreMethods();
   const run=enabled=>{gl.finish();const start=performance.now();for(const name of names)build(name,enabled);gl.finish();return performance.now()-start;};
   for(let i=0;i<2;i++){run(false);run(true);}
   for(const enabled of [false,true,true,false,true,false,false,true])samples.push({variant:enabled?'candidate':'baseline',milliseconds:run(enabled)});
   const geometryBytes=names.reduce((sum,name)=>sum+nativeStatic.passes[name].batches.groups.reduce((n,group)=>n+group.mesh.geometry.getAttribute('vPosition').data.array.byteLength+group.mesh.geometry.index.array.byteLength,0),0);
   const error=gl.getError();
   result={width,height,preset,samples,geometryBytes,glError:error};
  }finally{
   restoreMethods();nativeStatic.setBatchingEnabled(true);
   for(const name of names)nativeStatic.build(name,cameraBounds,original[name].width,original[name].height,preset);
  }
  // Restore the normal render targets before hashing yields to the page loop.
  const comparisons=await Promise.all(correctness.map(async entry=>({name:entry.name,differences:entry.differences,rows:await Promise.all(entry.rows.map(async({pixels,...row})=>({...row,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels.buffer))),byteLength:pixels.byteLength})))})));
  for(const entry of comparisons)for(const row of entry.rows)row.sha256=row.sha256.map(v=>v.toString(16).padStart(2,'0')).join('');
  return{...result,comparisons};
 })()`);
 const sources=Object.fromEntries(['three/native-static-render.js','three/native-static-batches.js','scripts/benchmark-native-static-batches.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
 const report={scope:'One ready development scene, frozen source visibility, paired static main/reflection builds at a declared 230x424 viewport. Every RGBA16F word is compared before timing. Timings exclude counter instrumentation, image hashing and first-upload warmup, and include GPU completion. This measures a static render component on desktop headless Edge; it does not measure physical phones or claim whole-game FPS/startup gains.',base,...result,sources,errors};
 fs.writeFileSync(output+'/native-static-batch-benchmark.json',JSON.stringify(report,null,2),{flag:'wx'});
 assert.deepEqual(errors,[]);assert.equal(result.glError,0);
 for(const comparison of result.comparisons){assert.equal(comparison.differences,0,comparison.name+' exact half-float words');assert.equal(comparison.rows[0].sha256,comparison.rows[1].sha256);}
 const means=Object.fromEntries(['baseline','candidate'].map(name=>[name,result.samples.filter(s=>s.variant===name).reduce((sum,s)=>sum+s.milliseconds,0)/4]));
 console.log(JSON.stringify({comparisons:result.comparisons,samples:result.samples,means,geometryBytes:result.geometryBytes,errors}));
}finally{socket.close();}
