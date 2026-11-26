// Observe real production Worker traffic. Default controls use the ordinary UI.
// Optional earned multiball supplies declared physical Lock approaches before
// timing; qualification, creation and subsequent play remain authored behavior.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {earnedScoopPose} from './earned-multiball-scoop-scenario.mjs';
const [debug,base,output]=process.argv.slice(2),option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3),seconds=Number(option('seconds')??15),baseline=option('baseline');
const observeWorkerInput=process.argv.includes('--observe-worker-input'),profileWorker=process.argv.includes('--profile-worker'),cpuRates=(option('cpu-rates')??'1,4').split(',').map(Number);
const earnedMultiball=process.argv.includes('--earned-multiball');
const measurementScope='Production worker traffic and real clocks/RNG. Optional physical Lock approaches are recorded per run; timed controls use the ordinary UI. Submitted frames are requests, not GPU completion measurements. No physical-phone claim.';
const outputPrefix=option('output-prefix')??'production-worker';assert.match(outputPrefix,/^[a-z0-9.-]+$/i);
assert.ok(seconds>=5&&seconds<=20);
assert.ok(cpuRates.length>0&&cpuRates.every(rate=>Number.isFinite(rate)&&rate>=1&&rate<=8));
const tabs=await(await fetch(`${debug}/json/list`)).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0,workerSession;const pending=new Map(),errors=[],reports=[],inputTraces=[];
socket.addEventListener('message',async event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
 if(data.method==='Target.attachedToTarget'){
  const session=data.params.sessionId;
  try{if(data.params.targetInfo.type==='worker'&&data.params.targetInfo.url.includes('simulation-worker')){
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
const multiballQueries=['BallsInLock(CurrentPlayer)','bNinjaMB','bMultiBallMode','CLng(mBalls2Eject)','bBallInPlungerLane'];
async function qualifyMultiball(){
 await evaluate('workerObservation.command('+JSON.stringify({type:'subscribe',names:[],queries:multiballQueries})+')');
 for(const type of ['keyDown','keyUp']){
  await call('Input.dispatchKeyEvent',{type,code:'Enter',key:'Enter'});
  if(type==='keyDown')await new Promise(resolve=>setTimeout(resolve,650));
 }
 await wait('!workerObservation.latest.inLane');
 const id=await evaluate('(()=>{const s=workerObservation.latest,r=s.records.find(r=>!r.held);return s.renderBalls.find(b=>b.id===r.id).scriptId;})()');
 assert.ok(Number.isInteger(id)&&id>=3,'Choose the ordinarily launched game ball');
 const approaches=[];
 for(let i=1;i<=3;i++){
  const statement=earnedScoopPose(id,'lock');approaches.push({lock:i,statement});
  await evaluate('workerObservation.command('+JSON.stringify({type:'execute',statement})+')');
  await wait(i===3?'workerObservation.values.bNinjaMB':'workerObservation.values["BallsInLock(CurrentPlayer)"]==='+i);
  await wait('!workerObservation.latest.records.some(r=>r.held==="lock")');
 }
 await wait('workerObservation.latest.records.length===3&&workerObservation.values["CLng(mBalls2Eject)"]===0&&!workerObservation.latest.inLane');
 const state=await evaluate('({time:workerObservation.latest.time,values:workerObservation.values,records:workerObservation.latest.records})');
 assert.equal(state.values.bNinjaMB,true);assert.equal(state.values.bMultiBallMode,true);
 return{scope:'Three declared physical approaches of the ordinarily launched ball to the original Lock collider, followed by authored releases, queued creation and autoplunger. No rule qualification/counter setters, direct hit handlers, RNG, clock, timer deadline or expected body input. Timing starts after setup; all timed controls use the ordinary player UI.',approaches,state};
}
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 if(observeWorkerInput||profileWorker)await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const NativeWorker=window.Worker,stats=window.workerObservation={latest:null,first:null,submittedFrames:0,inputs:[],inputLatency:[],inputTraffic:[],trackInputs:${observeWorkerInput},fatal:[],longTasks:[],maxBalls:0,maxFreeBalls:0,ballWindows:[],motion:new Map(),active:false,requests:new Map(),id:970000};
  stats.command=message=>new Promise((resolve,reject)=>{const id=++stats.id;stats.requests.set(id,{resolve,reject});stats.worker.postMessage({...message,id});});
  stats.observeBalls=()=>{const now=performance.now();if(stats.ballAt!==undefined)stats.ballWindows.push({milliseconds:now-stats.ballAt,balls:stats.ballCount,freeBalls:stats.freeBallCount});stats.ballAt=now;stats.ballCount=stats.latest.records.length;stats.freeBallCount=stats.latest.records.filter(r=>!r.held).length;
   const present=new Set();for(const record of stats.latest.records){present.add(record.id);let row=stats.motion.get(record.id);if(!row){row={id:record.id,scriptId:stats.latest.renderBalls.find(b=>b.id===record.id)?.scriptId,samples:0,pathWorldUnits:0};stats.motion.set(record.id,row);}if(!record.held){if(row.previous)row.pathWorldUnits+=Math.hypot(record.p.x-row.previous.x,record.p.y-row.previous.y,record.p.z-row.previous.z);row.previous={...record.p};row.samples++;}else row.previous=null;}
   for(const row of stats.motion.values())if(!present.has(row.id))row.previous=null;
  };
  new PerformanceObserver(list=>{if(stats.active)for(const entry of list.getEntries())stats.longTasks.push(entry.duration);}).observe({entryTypes:['longtask']});
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);this.addEventListener('message',({data})=>{
    if(data.type==='response'&&stats.requests.has(data.id)){const task=stats.requests.get(data.id);stats.requests.delete(data.id);data.error?task.reject(Error(data.error)):task.resolve(data.result);}
    if(data.type==='fatal')stats.fatal.push(data.message);
    if(data.type!=='snapshot')return;
    stats.latest={time:data.snapshot.time,stats:data.stats,state:data.snapshot.state,held:data.snapshot.held,inLane:data.snapshot.inLane,charge:data.snapshot.charge,physicsStats:data.snapshot.physicsStats,records:data.snapshot.records,renderBalls:data.snapshot.renderBalls};stats.values=Object.fromEntries(data.snapshot.values);
    if(!stats.active)return;stats.observeBalls();stats.maxBalls=Math.max(stats.maxBalls,data.snapshot.records.length);stats.maxFreeBalls=Math.max(stats.maxFreeBalls,data.snapshot.records.filter(r=>!r.held).length);
    const input=stats.inputs[0];if(input&&!!data.snapshot.held[input.action]===input.down){input.observed=performance.timeOrigin+performance.now();stats.inputLatency.push(performance.now()-input.started);stats.inputs.shift();}
   });}
   postMessage(message,...args){if(message.type==='init')stats.worker=this;if(stats.active&&message.type==='submission')stats.submittedFrames++;if(message.type==='input'){const input={index:stats.inputTraffic.length,action:message.action,down:message.down,started:performance.now(),sent:performance.timeOrigin+performance.now(),active:stats.active};if(stats.trackInputs)stats.inputTraffic.push(input);if(stats.active)stats.inputs.push(input);}return super.postMessage(message,...args);}
  };
 })();`});
 const builds=baseline?[['baseline',baseline],['candidate',base]]:[['candidate',base]];
 if(process.argv.includes('--candidate-first'))builds.reverse();
 for(const cpuRate of cpuRates)for(const [name,url]of builds){
  workerSession=undefined;await call('Emulation.setCPUThrottlingRate',{rate:cpuRate});await call('Page.navigate',{url});
  await wait('document.getElementById("play")?.textContent==="Start game"&&workerObservation.latest');
  assert.equal(await evaluate('!!window.finniThree'),false,'production build without development game hook');
  await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  const qualification=earnedMultiball?await qualifyMultiball():undefined;
  if(profileWorker){assert.ok(workerSession,'Actual simulation worker attached');await call('Profiler.enable',{},workerSession);await call('Profiler.setSamplingInterval',{interval:1000},workerSession);await call('Profiler.start',{},workerSession);}
  await evaluate('workerObservation.command({type:"barrier"})');
  await evaluate(`(()=>{
   const s=workerObservation;s.first=structuredClone(s.latest);s.started=performance.now();s.active=true;s.observeBalls();s.maxBalls=s.latest.records.length;s.maxFreeBalls=s.latest.records.filter(r=>!r.held).length;
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
   const s=workerObservation;clearInterval(s.controller);s.observeBalls();s.active=false;for(const code of ['ShiftLeft','ShiftRight','Enter'])window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
   const wallMs=performance.now()-s.started,a=s.first,b=s.latest,delta=key=>b.stats[key]-a.stats[key],latency=s.inputLatency.slice().sort((a,b)=>a-b),publications=delta('snapshots');
   const windows=s.ballWindows,observedMs=windows.reduce((n,w)=>n+w.milliseconds,0),freeMultiballMs=windows.filter(w=>w.freeBalls>=2).reduce((n,w)=>n+w.milliseconds,0),threeFreeBallsMs=windows.filter(w=>w.freeBalls>=3).reduce((n,w)=>n+w.milliseconds,0);
   return {wallMs,simulatedMs:(b.time-a.time)*1000,simulationRatio:(b.time-a.time)*1000/wallMs,submittedFrames:s.submittedFrames,submittedFramesPerSecond:s.submittedFrames*1000/wallMs,publications,snapshotMs:delta('snapshotMs'),snapshotMsPerPublication:delta('snapshotMs')/publications,physicsMs:delta('physicsMs'),runtimeMaxChunkMs:b.stats.maxChunkMs,objectFields:delta('snapshotObjectFields'),p95InputPublicationMs:latency[Math.floor(latency.length*.95)],inputSamples:latency.length,pendingInputs:s.inputs.length,maxBalls:s.maxBalls,maxFreeBalls:s.maxFreeBalls,ballLoad:{scope:'Main-thread observation of genuine live/free game-ball counts between unmodified production snapshots; held balls and decorative toys do not count as free multiball. Free-motion paths accumulate observed positions only during the timed interval; held or removed intervals break the path.',observedMs,freeMultiballMs,threeFreeBallsMs,meanFreeBalls:windows.reduce((n,w)=>n+w.milliseconds*w.freeBalls,0)/observedMs,motion:[...s.motion.values()].map(({previous,...row})=>row)},longTasks:s.longTasks,fatal:s.fatal,physicsStats:b.physicsStats};
  })()`);
  const record={name,url,cpuRate,environment:'desktop headless Edge; page-target throttle only; no physical-phone claim',...qualification?{qualification}:{},...report};
  if(profileWorker){const {profile}=await call('Profiler.stop',{},workerSession);record.workerProfile=outputPrefix+'-'+name+'-'+cpuRate+'.cpuprofile';await writeFile(output+'/'+record.workerProfile,JSON.stringify(profile));record.profilingOverhead='V8 sampling profiler enabled during this run; timing is diagnostic.';}
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
  await writeFile(`${output}/${outputPrefix}-timing.json`,JSON.stringify({scope:measurementScope,reports},null,2));
  if(observeWorkerInput)await writeFile(`${output}/${outputPrefix}-input-traces.json`,JSON.stringify({scope:'Read-only main/worker clock observations. Original packets remain unchanged; anchor bounds bracket the actual unpause handler without fitting a phase.',inputTraces},null,2));
  assert.deepEqual(report.fatal,[]);assert.equal(report.physicsStats.substepBudgetExceeded,0);assert.ok(report.inputSamples>20);assert.ok(report.publications>100);assert.ok(report.simulationRatio>.95,'physics keeps up with active wall time');
  if(earnedMultiball){assert.ok(report.maxFreeBalls>=3,'Authored multiball produces three actual free balls');assert.ok(report.ballLoad.freeMultiballMs>=1000,'At least one second of the measured interval contains multiple free balls');assert.ok(report.ballLoad.motion.filter(row=>row.pathWorldUnits>=1).length>=3,'Three game balls each move at least 100 authored units during measurement');}
  if(name==='candidate'&&process.argv.includes('--require-caught-up')){assert.ok(record.frameClocks?.frame.boundedSamples>100);assert.equal(record.frameClocks.frame.framesWithOverdueTicks,0,'prepared frames contain every tick already due when requested');}
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/${outputPrefix}-timing.json`,JSON.stringify({scope:measurementScope,reports},null,2));
 if(observeWorkerInput)await writeFile(`${output}/${outputPrefix}-input-traces.json`,JSON.stringify({scope:'Read-only main/worker observers use performance.timeOrigin + performance.now. Worker arrival is observed before the original command handler; publication is observed after input handling. Packets, clocks, input order, physics and rules remain unchanged. Return-to-main includes main-thread scheduling and is not worker application latency.',inputTraces},null,2));
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});socket.close();}
