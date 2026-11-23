// Read-only Android Chrome profiling. Open/start the game with agent-device.
// adb forward tcp:9223 localabstract:chrome_devtools_remote
// node scripts/profile-android-player.mjs <label|status> [seconds] [port] [origin]
import {mkdir,writeFile} from 'node:fs/promises';

const [label='status',duration='12',port='9223',origin='http://10.0.2.2:8765']=process.argv.slice(2);
const seconds=Number(duration);
if(!Number.isFinite(seconds)||seconds<3||seconds>30)throw Error('Sample duration must be between 3 and 30 seconds.');
const targetOrigin=new URL(origin).origin;
let socket,sequence=0;
const pending=new Map();
function disconnected(error){for(const request of pending.values()){clearTimeout(request.timer);request.reject(error)}pending.clear()}
const call=(method,params={},timeout=45000)=>new Promise((resolve,reject)=>{
  const id=++sequence;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(`${method} timed out; the Android sample is incomplete.`))},timeout);
  pending.set(id,{resolve,reject,timer});
  socket.send(JSON.stringify({id,method,params}));
});
async function evaluate(expression){
  const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
function inspect(){
  const canvas=document.getElementById('canvas'),playing=document.body.classList.contains('playing');
  // Never create a GL context before the engine does: that changes its attributes.
  const gl=playing?canvas?.getContext('webgl2'):null;
  const debug=gl?.getExtension('WEBGL_debug_renderer_info');
  return {url:location.href,visible:document.visibilityState,playing,waiting:!document.getElementById('waiting')?.hidden,
    loading:document.getElementById('loading')?.textContent,graphics:document.getElementById('graphics')?.value,
    canvas:canvas?[canvas.width,canvas.height]:null,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
    userAgent:navigator.userAgent,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
    contextLost:gl?.isContextLost()??false,attributes:gl?.getContextAttributes()??null};
}
async function collect(milliseconds){
  const canvas=document.getElementById('canvas'),gl=canvas.getContext('webgl2');
  const prototype=WebGL2RenderingContext.prototype,originalDraws=new Map(),spans=[],calls={},longTasks=[];
  const native=finni.engine.ccall;
  let drawCalls=0,previousDraws=0,renderFrames=0,rafFrames=0,last,frame,observer,stopped=false;
  const start=performance.now();
  function restore(){
    stopped=true;cancelAnimationFrame(frame);observer?.disconnect();
    finni.engine.ccall=native;
    for(const [name,method] of originalDraws)prototype[name]=method;
  }
  try{
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const method=prototype[name];originalDraws.set(name,method);
      prototype[name]=function(...args){if(this===gl)drawCalls++;return method.apply(this,args)};
    }
    finni.engine.ccall=function(...args){
      const script=typeof args[3]?.[0]==='string'?args[3][0]:'';
      const kind=script.startsWith('FinniDmdState=')?'dmd':script.includes('FINNI_STATE|')?'state':/Table1_Key(?:Down|Up)/.test(script)?'input':'other';
      const before=performance.now();
      try{return native.apply(this,args)}finally{const elapsed=performance.now()-before,bucket=calls[kind]??={count:0,totalMs:0,maxMs:0};bucket.count++;bucket.totalMs+=elapsed;bucket.maxMs=Math.max(bucket.maxMs,elapsed)}
    };
    try{observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask',buffered:false})}catch{}
    return await new Promise(resolve=>{
      function tick(t){
        if(stopped)return;
        if(last!==undefined){spans.push(t-last);rafFrames++;if(drawCalls>previousDraws)renderFrames++}
        last=t;previousDraws=drawCalls;frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
      setTimeout(()=>{
        const elapsedMs=performance.now()-start;spans.sort((a,b)=>a-b);
        const percentile=p=>spans[Math.min(spans.length-1,Math.floor(spans.length*p))]||0;
        resolve({elapsedMs,rafFrames,renderFrames,drawCalls,rafFps:rafFrames*1000/elapsedMs,renderFps:renderFrames*1000/elapsedMs,
          p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:spans.at(-1)||0,over33ms:spans.filter(t=>t>33.4).length,
          longTasks:{count:longTasks.length,totalMs:longTasks.reduce((a,b)=>a+b,0),maxMs:Math.max(0,...longTasks)},calls});
      },milliseconds);
    });
  }finally{restore()}
}

try{
  const endpoint=`http://127.0.0.1:${port}/json/list`;
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error(`Chrome debugging returned HTTP ${response.status}.`);
  const tabs=(await response.json()).filter(tab=>tab.type==='page'&&(()=>{try{return new URL(tab.url).origin===targetOrigin}catch{return false}})());
  if(tabs.length!==1)throw Error(`Expected one game tab for ${targetOrigin}; found ${tabs.length}. Close duplicate test tabs using agent-device before measuring.`);
  socket=new WebSocket(tabs[0].webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{
    const data=JSON.parse(event.data),request=pending.get(data.id);if(!request)return;
    pending.delete(data.id);clearTimeout(request.timer);
    if(data.error)request.reject(Error(data.error.message));else request.resolve(data.result);
  });
  socket.addEventListener('close',()=>disconnected(Error('Android Chrome disconnected; no complete performance sample was recorded.')));
  socket.addEventListener('error',()=>disconnected(Error('Android Chrome debugging connection failed.')));
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Chrome debugging connection timed out.')),5000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Could not connect to Android Chrome.'))},{once:true});
  });
  let status=await evaluate(`(${inspect})()`);
  if(label==='status'){console.log(JSON.stringify(status,null,2))}
  else{
    if(status.visible!=='visible'||!status.playing||status.waiting||status.contextLost)throw Error('Bring the running game to the foreground with agent-device before measuring.');
    // Let initial camera-cache invalidation finish. This does not drive the UI.
    await evaluate('new Promise(resolve=>setTimeout(resolve,1500))');
    status=await evaluate(`(${inspect})()`);
    await call('Performance.enable');
    const before=await call('Performance.getMetrics');
    const sample=await evaluate(`(${collect})(${seconds*1000})`);
    const after=await call('Performance.getMetrics'),heap=await call('Runtime.getHeapUsage');
    const finalStatus=await evaluate(`(${inspect})()`);
    if(!sample.renderFrames||finalStatus.contextLost||finalStatus.visible!=='visible'||!finalStatus.playing||finalStatus.waiting)throw Error('The game stopped rendering or left the foreground; this sample is invalid.');
    const warnings=['Verify visible table rendering in the Device panel; frame counts alone cannot establish correct presentation.','JS heap figures exclude native WebAssembly and GPU allocations.'];
    if(/emulator/i.test(status.renderer||''))warnings.push('Host-GPU Android emulator: this measures the Android browser path, not physical-phone GPU speed.');
    if(/swiftshader|lavapipe|software/i.test(status.renderer||''))warnings.push('Software-rendered emulator: these frame rates do not establish physical-phone performance.');
    if(JSON.stringify(status.canvas)!==JSON.stringify(finalStatus.canvas)||JSON.stringify(status.viewport)!==JSON.stringify(finalStatus.viewport))warnings.push('Viewport changed during the sample; repeat before comparing profiles.');
    const output=new URL('../.work/android-perf/',import.meta.url);await mkdir(output,{recursive:true});
    const file=new URL(`${label.replace(/[^a-z0-9_-]/gi,'_')||'sample'}.json`,output);
    await writeFile(file,JSON.stringify({label,status,finalStatus,sample,heap,before,after,warnings},null,2));
    console.log(JSON.stringify({label,file:file.pathname,sample,warnings},null,2));
  }
}catch(error){console.error(`Android profile unavailable: ${error.message}`);process.exitCode=1}
finally{socket?.close()}
