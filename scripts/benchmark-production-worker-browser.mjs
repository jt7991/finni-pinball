// Read-only observation of real production Worker traffic. Controls use the
// ordinary UI; no debug hooks, injected physics state or clock/RNG overrides.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2),option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3),seconds=Number(option('seconds')??15),baseline=option('baseline');
assert.ok(seconds>=5&&seconds<=20);
const tabs=await(await fetch(`${debug}/json/list`)).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let seq=0;const pending=new Map(),errors=[],reports=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let n=0;n<400;n++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out: '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
  const NativeWorker=window.Worker,stats=window.workerObservation={latest:null,first:null,submittedFrames:0,inputs:[],inputLatency:[],fatal:[],longTasks:[],maxBalls:0,active:false};
  new PerformanceObserver(list=>{if(stats.active)for(const entry of list.getEntries())stats.longTasks.push(entry.duration);}).observe({entryTypes:['longtask']});
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);this.addEventListener('message',({data})=>{
    if(data.type==='fatal')stats.fatal.push(data.message);
    if(data.type!=='snapshot')return;
    stats.latest={time:data.snapshot.time,stats:data.stats,state:data.snapshot.state,held:data.snapshot.held,inLane:data.snapshot.inLane,charge:data.snapshot.charge,physicsStats:data.snapshot.physicsStats};
    if(!stats.active)return;stats.maxBalls=Math.max(stats.maxBalls,data.snapshot.records.length);
    const input=stats.inputs[0];if(input&&!!data.snapshot.held[input.action]===input.down){stats.inputLatency.push(performance.now()-input.started);stats.inputs.shift();}
   });}
   postMessage(message,...args){if(stats.active){if(message.type==='submission')stats.submittedFrames++;if(message.type==='input')stats.inputs.push({action:message.action,down:message.down,started:performance.now()});}return super.postMessage(message,...args);}
  };
 })();`});
 const builds=baseline?[['baseline',baseline],['candidate',base]]:[['candidate',base]];
 if(process.argv.includes('--candidate-first'))builds.reverse();
 for(const cpuRate of [1,4])for(const [name,url]of builds){
  await call('Emulation.setCPUThrottlingRate',{rate:cpuRate});await call('Page.navigate',{url});
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
   return {wallMs,simulatedMs:(b.time-a.time)*1000,simulationRatio:(b.time-a.time)*1000/wallMs,submittedFrames:s.submittedFrames,submittedFramesPerSecond:s.submittedFrames*1000/wallMs,publications,snapshotMs:delta('snapshotMs'),snapshotMsPerPublication:delta('snapshotMs')/publications,physicsMs:delta('physicsMs'),objectFields:delta('snapshotObjectFields'),p95InputPublicationMs:latency[Math.floor(latency.length*.95)],inputSamples:latency.length,pendingInputs:s.inputs.length,maxBalls:s.maxBalls,longTasks:s.longTasks,fatal:s.fatal,physicsStats:b.physicsStats};
  })()`);
  const record={name,url,cpuRate,environment:'desktop headless Edge; main-target throttle; worker throttle coverage unverified',...report};reports.push(record);console.log(JSON.stringify(record));
  assert.deepEqual(report.fatal,[]);assert.equal(report.physicsStats.substepBudgetExceeded,0);assert.ok(report.inputSamples>20);assert.ok(report.publications>100);assert.ok(report.simulationRatio>.95,'physics keeps up with active wall time');
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/production-worker-timing.json`,JSON.stringify({scope:'Independent ordinary production games with real clocks and RNG. Traffic observer leaves packets unchanged. Submitted frames are worker submission requests, not GPU completion measurements. No physical-phone claim.',reports},null,2));
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});socket.close();}
