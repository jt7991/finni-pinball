// Observe first-visit startup in the production page and its actual worker.
// Sampling/counters add diagnostic overhead; no input, clock or state changes.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {SourceMap} from 'node:module';
const [debug,base,output]=process.argv.slice(2),option=name=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const prefix=option('output-prefix')??'startup-profile',directory=option('artifact-directory');assert.match(prefix,/^[a-z0-9.-]+$/i);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),workers=new Map(),errors=[],requests=[];
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
socket.addEventListener('message',async event=>{
 const data=JSON.parse(event.data);
 if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
 if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
 if(data.method==='Network.requestWillBeSent')requests.push(data.params.request.url);
 if(data.method==='Target.attachedToTarget'){
  const {sessionId,targetInfo}=data.params;
  try{if(targetInfo.type==='worker'){
   workers.set(sessionId,{url:targetInfo.url});
   await call('Runtime.enable',{},sessionId);await call('Profiler.enable',{},sessionId);await call('Profiler.setSamplingInterval',{interval:1000},sessionId);await call('Profiler.start',{},sessionId);
  }}catch(error){errors.push({workerProfiler:error.message});}finally{await call('Runtime.runIfWaitingForDebugger',{},sessionId);}
 }
});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
const mapCache=new Map();
async function summarize(profile){
 const nodes=new Map(profile.nodes.map(node=>[node.id,{frame:node.callFrame,microseconds:0}]));
 profile.samples.forEach((id,index)=>nodes.get(id).microseconds+=profile.timeDeltas[index]);
 const functions=[];
 for(const node of nodes.values()){
  if(!node.microseconds)continue;const frame=node.frame;let location;
  if(directory&&frame.url.startsWith(new URL('/three/',base).href)){
   const file=path.resolve(directory,decodeURIComponent(new URL(frame.url).pathname.slice('/three/'.length))+'.map');
   if(file.startsWith(path.resolve(directory)+path.sep)){
    if(!mapCache.has(file)){try{mapCache.set(file,new SourceMap(JSON.parse(await fs.readFile(file,'utf8'))));}catch{mapCache.set(file,null);}}
    const entry=mapCache.get(file)?.findEntry(frame.lineNumber,frame.columnNumber);
    if(entry?.originalSource)location={source:entry.originalSource,line:entry.originalLine+1,column:entry.originalColumn+1,name:entry.name};
   }
  }
  functions.push({function:frame.functionName||'(anonymous)',url:frame.url,line:frame.lineNumber+1,column:frame.columnNumber+1,...location?{original:location}:{},milliseconds:node.microseconds/1000});
 }
 const groups=new Map();for(const row of functions){const key=row.original?.source||row.url||row.function;groups.set(key,(groups.get(key)??0)+row.milliseconds);}
 return{durationMilliseconds:(profile.endTime-profile.startTime)/1000,samples:profile.samples.length,topFunctions:functions.sort((a,b)=>b.milliseconds-a.milliseconds).slice(0,35),sources:[...groups].map(([source,milliseconds])=>({source,milliseconds})).sort((a,b)=>b.milliseconds-a.milliseconds)};
}
try{
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});
 await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const s=window.startupProfile={counts:{},progress:[],snapshot:null},observer=new MutationObserver(()=>{const text=(document.getElementById('load-status')??document.getElementById('loading'))?.textContent;if(text&&text!==s.progress.at(-1)?.text)s.progress.push({milliseconds:performance.now(),text});});observer.observe(document,{childList:true,subtree:true,characterData:true});
  const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='snapshot')s.snapshot={time:data.snapshot.time,paused:data.paused,ticks:data.stats.ticks};});}};
  for(const Context of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','texImage2D','texSubImage2D','compileShader','linkProgram','getProgramParameter','getParameter','readPixels']){const original=Context.prototype[name];if(!original||original.startupCounter)continue;const wrapped=function(...args){s.counts[name]=(s.counts[name]??0)+1;return original.apply(this,args);};wrapped.startupCounter=true;Context.prototype[name]=wrapped;}
 })()`});
 await call('Profiler.enable');await call('Profiler.setSamplingInterval',{interval:1000});await call('Profiler.start');
 const started=Date.now();await call('Page.navigate',{url:base});let ready=false;
 for(let i=0;i<600;i++){if(await evaluate('document.getElementById("play")?.textContent==="Start game"&&((startupProfile.counts.drawElements??0)+(startupProfile.counts.drawArrays??0)>0)')){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(ready,'Production startup reaches an enabled Start and actual draws');
 const elapsed=Date.now()-started,{profile:main}=await call('Profiler.stop'),captures=[{target:'page',file:prefix+'-page.cpuprofile',profile:main}],profiles=[];
 for(const [sessionId,worker]of workers){const {profile}=await call('Profiler.stop',{},sessionId);captures.push({target:'worker',url:worker.url,file:prefix+'-worker-'+captures.length+'.cpuprofile',profile});}
 for(const {profile,...capture}of captures){await fs.writeFile(output+'/'+capture.file,JSON.stringify(profile),{flag:'wx'});profiles.push({...capture,summary:await summarize(profile)});}
 const observed=await evaluate('startupProfile');assert.deepEqual(observed.snapshot,{time:0,paused:true,ticks:0});assert.equal(await evaluate('!!window.finniThree'),false);assert.deepEqual(errors,[]);assert.equal(requests.filter(url=>/\.map(?:\?|$)/.test(url)).length,0,'Source maps do not add startup network traffic');
 const hardware=await evaluate(`(()=>{const canvas=document.querySelector('canvas#canvas,canvas#table'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl'),extension=gl.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:extension?gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};})()`);
 const result={scope:'First browser visit with page/worker V8 sampling and read-only GL/progress counters. Diagnostic overhead is included. The production simulation stays paused at zero; no input, clock, RNG or body is replaced. Phone-sized desktop browser, not phone performance.',base,artifactDirectory:directory,elapsedMilliseconds:elapsed,observed,hardware,profiles,errors};
 await fs.writeFile(output+'/'+prefix+'.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({elapsedMilliseconds:elapsed,observed,hardware,profiles:profiles.map(p=>({target:p.target,top:p.summary.sources.slice(0,8)}))}));
}finally{socket.close();}
