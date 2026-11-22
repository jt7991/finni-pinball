// Read-only observation of real production Worker traffic. Controls use the
// ordinary UI; no debug hooks, injected physics state or clock/RNG overrides.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2),option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3),seconds=Number(option('seconds')??15),baseline=option('baseline');
const observeWorkerInput=process.argv.includes('--observe-worker-input'),cpuRates=(option('cpu-rates')??'1,4').split(',').map(Number);
assert.ok(seconds>=5&&seconds<=20);
assert.ok(cpuRates.length>0&&cpuRates.every(rate=>Number.isFinite(rate)&&rate>=1&&rate<=8));
const tabs=await(await fetch(`${debug}/json/list`)).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0,workerSession;const pending=new Map(),errors=[],reports=[],inputTraces=[];
socket.addEventListener('message',async event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
 if(data.method==='Target.attachedToTarget'){
  const session=data.params.sessionId;
  try{if(data.params.targetInfo.type==='worker'){
   workerSession=session;
   const result=await call('Runtime.evaluate',{expression:`(()=>{
    const nativePost=globalThis.postMessage.bind(globalThis),s=globalThis.productionInputObservation={inputs:[],pending:[],requests:new Map(),frames:[],snapshot:null,anchor:null,pendingAnchor:null},clock=()=>performance.timeOrigin+performance.now();
    addEventListener('message',({data})=>{if(data.type==='input'){const input={index:s.inputs.length,action:data.action,down:data.down,arrived:clock()};s.inputs.push(input);s.pending.push(input);}else if(data.type==='pause'&&!data.value&&s.snapshot?.paused)s.pendingAnchor={earliest:clock()};else if(data.id&&['frame','submission'].includes(data.type))s.requests.set(data.id,{id:data.id,type:data.type,arrived:clock(),anchor:s.anchor});});
    globalThis.postMessage=(message,...args)=>{
     if(message.type==='snapshot'){s.snapshot={paused:message.paused,time:message.snapshot.time,presentationClock:message.presentationClock,stats:message.stats};if(s.pendingAnchor&&!message.paused){s.anchor={...s.pendingAnchor,latest:clock(),tick:message.stats.ticks};s.pendingAnchor=null;}const input=s.pending[0];if(input&&!!message.snapshot.held[input.action]===input.down){input.published=clock();input.gameTime=message.snapshot.time;s.pending.shift();}}
     if(message.type==='response'&&s.requests.has(message.id)){const request=s.requests.get(message.id);s.requests.delete(message.id);const snapshot=s.snapshot,presentationClock=message.result?.presentationClock??snapshot?.presentationClock,overdueTicksLowerBound=request.type==='frame'&&request.anchor?Math.max(0,request.anchor.tick+Math.floor(request.arrived-request.anchor.latest)-snapshot.stats.ticks):undefined;s.frames.push({...request,responded:clock(),paused:snapshot?.paused,time:snapshot?.time,tick:snapshot?.stats.ticks,lagMs:snapshot?.stats.lagMs,overdueTicksLowerBound,physicsStepAgeMs:presentationClock?Date.now()-presentationClock.lastPhysicsMilliseconds:null});}
     return nativePost(message,...args);
    };
   })()`},session);
   if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  }}catch(error){errors.push({workerObserver:error.message});}finally{await call('Runtime.runIfWaitingForDebugger',{},session);}
 }
});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let n=0;n<400;n++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out: '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 if(observeWorkerInput)await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const NativeWorker=window.Worker,stats=window.workerObservation={latest:null,first:null,submittedFrames:0,inputs:[],inputLatency:[],inputTraffic:[],trackInputs:${observeWorkerInput},fatal:[],longTasks:[],maxBalls:0,active:false};
  new PerformanceObserver(list=>{if(stats.active)for(const entry of list.getEntries())stats.longTasks.push(entry.duration);}).observe({entryTypes:['longtask']});
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);this.addEventListener('message',({data})=>{
    if(data.type==='fatal')stats.fatal.push(data.message);
    if(data.type!=='snapshot')return;
    stats.latest={time:data.snapshot.time,stats:data.stats,state:data.snapshot.state,held:data.snapshot.held,inLane:data.snapshot.inLane,charge:data.snapshot.charge,physicsStats:data.snapshot.physicsStats};
    if(!stats.active)return;stats.maxBalls=Math.max(stats.maxBalls,data.snapshot.records.length);
    const input=stats.inputs[0];if(input&&!!data.snapshot.held[input.action]===input.down){input.observed=performance.timeOrigin+performance.now();stats.inputLatency.push(performance.now()-input.started);stats.inputs.shift();}
   });}
   postMessage(message,...args){if(stats.active&&message.type==='submission')stats.submittedFrames++;if(message.type==='input'){const input={index:stats.inputTraffic.length,action:message.action,down:message.down,started:performance.now(),sent:performance.timeOrigin+performance.now(),active:stats.active};if(stats.trackInputs)stats.inputTraffic.push(input);if(stats.active)stats.inputs.push(input);}return super.postMessage(message,...args);}
  };
 })();`});
 const builds=baseline?[['baseline',baseline],['candidate',base]]:[['candidate',base]];
 if(process.argv.includes('--candidate-first'))builds.reverse();
 for(const cpuRate of cpuRates)for(const [name,url]of builds){
  workerSession=undefined;await call('Emulation.setCPUThrottlingRate',{rate:cpuRate});await call('Page.navigate',{url});
  await wait('document.getElementById("play")?.textContent==="Start game"&&workerObservation.latest');
  assert.equal(await evaluate('!!window.finniThree'),false,'production build without development game hook');
  await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  await evaluate(`(()=>{
   const s=workerObservation;s.first=structuredClone(s.latest);s.started=performance.now();s.active=true;
   const held={},key=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));
   s.controller=setInterval(()=>{
    if(s.latest.state==='over'){document.getElementById('play').click();return;}
    if(s.latest.inLane){if(!s.latest.held.launch)key('Enter',true);else if(s.latest.charge>=1.05)key('Enter',false);}
    for(const [i,code]of ['ShiftLeft','ShiftRight'].entries()){const down=Math.floor((s.latest.time+i*.09)/.12)%2===0;if(held[code]!==down){held[code]=down;key(code,down);}}
    if(document.body.classList.contains('choosing-battle')){key('Space',true);key('Space',false);}
   },20);
  })()`);
  await new Promise(resolve=>setTimeout(resolve,seconds*1000));
  const report=await evaluate(`(()=>{
   const s=workerObservation;clearInterval(s.controller);s.active=false;for(const code of ['ShiftLeft','ShiftRight','Enter'])window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
   const wallMs=performance.now()-s.started,a=s.first,b=s.latest,delta=key=>b.stats[key]-a.stats[key],latency=s.inputLatency.slice().sort((a,b)=>a-b),publications=delta('snapshots');
   return {wallMs,simulatedMs:(b.time-a.time)*1000,simulationRatio:(b.time-a.time)*1000/wallMs,submittedFrames:s.submittedFrames,submittedFramesPerSecond:s.submittedFrames*1000/wallMs,publications,snapshotMs:delta('snapshotMs'),snapshotMsPerPublication:delta('snapshotMs')/publications,physicsMs:delta('physicsMs'),runtimeMaxChunkMs:b.stats.maxChunkMs,objectFields:delta('snapshotObjectFields'),p95InputPublicationMs:latency[Math.floor(latency.length*.95)],inputSamples:latency.length,pendingInputs:s.inputs.length,maxBalls:s.maxBalls,longTasks:s.longTasks,fatal:s.fatal,physicsStats:b.physicsStats};
  })()`);
  const record={name,url,cpuRate,environment:'desktop headless Edge; main-target throttle; worker throttle coverage unverified',...report};
  if(observeWorkerInput){
   assert.ok(workerSession,'simulation worker attached');
   const result=await call('Runtime.evaluate',{expression:'({inputs:productionInputObservation.inputs,frames:productionInputObservation.frames})',returnByValue:true},workerSession);assert.ok(!result.exceptionDetails);const workerInputs=result.result.value.inputs,mainInputs=await evaluate('workerObservation.inputTraffic'),trace=[];
   for(const input of mainInputs.filter(input=>input.active&&input.observed!==undefined)){
    const worker=workerInputs[input.index];assert.ok(worker);assert.equal(worker.action,input.action);assert.equal(worker.down,input.down);assert.ok(Number.isFinite(worker.published));
    trace.push({...input,...worker,deliveryToWorkerMs:worker.arrived-input.sent,workerHandlingMs:worker.published-worker.arrived,returnToMainMs:input.observed-worker.published});
   }
   assert.ok(trace.length>20);const summary=key=>{const values=trace.map(row=>row[key]).sort((a,b)=>a-b);return {samples:values.length,min:values[0],p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};};
   record.inputStages=Object.fromEntries(['deliveryToWorkerMs','workerHandlingMs','returnToMainMs'].map(key=>[key,summary(key)]));
   const frameTrace=result.result.value.frames.filter(frame=>!frame.paused&&frame.arrived>=trace[0].arrived&&frame.arrived<=trace.at(-1).arrived);
   record.frameClocks=Object.fromEntries(['frame','submission'].map(type=>{const frames=frameTrace.filter(frame=>frame.type===type),ages=frames.map(frame=>frame.physicsStepAgeMs).sort((a,b)=>a-b),bounded=frames.filter(frame=>frame.overdueTicksLowerBound!==undefined);return [type,{samples:frames.length,p50AgeMs:ages[Math.floor(ages.length*.5)],p95AgeMs:ages[Math.floor(ages.length*.95)],maxAgeMs:ages.at(-1),maxReportedLagMs:Math.max(...frames.map(frame=>frame.lagMs)),...(bounded.length?{boundedSamples:bounded.length,framesWithOverdueTicks:bounded.filter(frame=>frame.overdueTicksLowerBound>0).length,maxOverdueTicksLowerBound:Math.max(...bounded.map(frame=>frame.overdueTicksLowerBound))}:{})}];}));inputTraces.push({name,url,cpuRate,trace,frameTrace});
  }
  reports.push(record);console.log(JSON.stringify(record));
  if(observeWorkerInput)await writeFile(`${output}/production-worker-input-traces.json`,JSON.stringify({scope:'Read-only main/worker clock observations. Original packets remain unchanged; anchor bounds bracket the actual unpause handler without fitting a phase.',inputTraces},null,2));
  assert.deepEqual(report.fatal,[]);assert.equal(report.physicsStats.substepBudgetExceeded,0);assert.ok(report.inputSamples>20);assert.ok(report.publications>100);assert.ok(report.simulationRatio>.95,'physics keeps up with active wall time');
  if(name==='candidate'&&process.argv.includes('--require-caught-up')){assert.ok(record.frameClocks?.frame.boundedSamples>100);assert.equal(record.frameClocks.frame.framesWithOverdueTicks,0,'prepared frames contain every tick already due when requested');}
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/production-worker-timing.json`,JSON.stringify({scope:'Independent ordinary production games with real clocks and RNG. Traffic observer leaves packets unchanged. Submitted frames are worker submission requests, not GPU completion measurements. No physical-phone claim.',reports},null,2));
 if(observeWorkerInput)await writeFile(`${output}/production-worker-input-traces.json`,JSON.stringify({scope:'Read-only main/worker observers use performance.timeOrigin + performance.now. Worker arrival is observed before the original command handler; publication is observed after input handling. Packets, clocks, input order, physics and rules remain unchanged. Return-to-main includes main-thread scheduling and is not worker application latency.',inputTraces},null,2));
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});socket.close();}
