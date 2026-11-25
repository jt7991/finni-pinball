// Desktop headless diagnostics. CDP's main-target CPU throttle is not a
// physical-phone measurement and may not apply equally to worker threads.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2),seconds=Number(process.argv.find(a=>a.startsWith('--seconds='))?.split('=')[1]??15);
const profile=process.argv.includes('--profile');
assert.ok(seconds>=5&&seconds<=30);
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
  for(const cpuRate of [1,4]){
    await call('Emulation.setCPUThrottlingRate',{rate:cpuRate});
    await call('Page.navigate',{url:base});await wait('!!window.finniThree && document.getElementById("play")?.textContent==="Start game"');
    await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
    if(profile){await call('Profiler.enable');await call('Profiler.start');}
    await evaluate(`(()=>{
      const {game,view}=finniThree;if(!game.workerSimulation)throw Error('Expected full simulation worker');
      const stats=window.playTiming={started:performance.now(),initialTime:game.time,initialStats:{...game.runtimeStats},frames:0,renderMs:0,frameIntervals:[],maxBalls:0,maxFreeBalls:0,multiballRequests:0,multiballCompleted:0,roundTrips:[],inputToDraw:[],supersededInputs:0,errors:[],longTasks:[]};
      const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())stats.longTasks.push(entry.duration);});observer.observe({entryTypes:['longtask']});
      const render=view.render.bind(view),input=game.input.bind(game),pending=new Map(),drawn=new Map();let lastFrame=performance.now(),qualified=false,busy=false;const held={};
      const flipper=side=>game.flippers.find(f=>f.spec.name.toLowerCase().startsWith(side));
      for(const side of ['left','right'])drawn.set(side,flipper(side).angle);
      game.input=(side,down)=>{if(drawn.has(side)){if(pending.has(side))stats.supersededInputs++;pending.set(side,{side,down,started:performance.now(),angle:drawn.get(side)});}return input(side,down);};
      view.render=(...args)=>{
        const now=performance.now();stats.frameIntervals.push(now-lastFrame);lastFrame=now;render(...args);const finished=performance.now();stats.renderMs+=finished-now;stats.frames++;
        for(const side of ['left','right']){const angle=flipper(side).angle,request=pending.get(side);if(request&&game.held[side]===request.down&&angle!==request.angle){stats.inputToDraw.push({side,down:request.down,milliseconds:finished-request.started});pending.delete(side);}drawn.set(side,angle);}
      };
      stats.controller=setInterval(()=>{
        if(game.error){stats.errors.push(game.error.message);return;}
        if(game.state==='over'){game.start();qualified=false;}
        if(game.inLane){if(!game.held.launch)game.input('launch',true);else if(game.charge>=1.05)game.input('launch',false);}
        if(!qualified&&game.records.some(r=>!r.held&&r.body.translation().y>10)){qualified=true;stats.multiballRequests++;game.debug({action:'run',name:'AddMultiball',args:[2]}).then(()=>stats.multiballCompleted++).catch(e=>stats.errors.push(e.message));}
        for(const [index,side]of ['left','right'].entries()){const down=Math.floor((game.time+index*.09)/.12)%2===0;if(held[side]!==down){held[side]=down;game.input(side,down);}}
        if(game.rules.value('bChooseBattle')){game.input('action',true);game.input('action',false);}
        stats.maxBalls=Math.max(stats.maxBalls,game.records.length);
        stats.maxFreeBalls=Math.max(stats.maxFreeBalls,game.records.filter(r=>!r.held).length);
      },20);
      stats.barriers=setInterval(async()=>{if(busy)return;busy=true;const start=performance.now();try{await game.flush();stats.roundTrips.push(performance.now()-start);}catch(e){stats.errors.push(e.message);}finally{busy=false;}},200);
    })()`);
    await new Promise(resolve=>setTimeout(resolve,seconds*1000));
    const report=await evaluate(`(async()=>{const s=playTiming,{game}=finniThree;clearInterval(s.controller);clearInterval(s.barriers);game.release();await game.flush();const wallMs=performance.now()-s.started,sorted=s.frameIntervals.slice().sort((a,b)=>a-b),rpc=s.roundTrips.slice().sort((a,b)=>a-b),draw=s.inputToDraw.map(r=>r.milliseconds).sort((a,b)=>a-b),runtime=game.runtimeStats;return {wallMs,simulatedMs:(game.time-s.initialTime)*1000,simulationRatio:(game.time-s.initialTime)*1000/wallMs,frames:s.frames,fps:s.frames*1000/wallMs,renderMs:s.renderMs,p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:Math.max(...sorted),p95CommandMs:rpc[Math.floor(rpc.length*.95)],maxCommandMs:Math.max(...rpc),inputToDraw:{scope:'Control command to completed WebGL draw call with matching held state and a changed flipper angle; includes frame scheduling, not physical display scanout.',samples:draw.length,p50Ms:draw[Math.floor(draw.length*.5)],p95Ms:draw[Math.floor(draw.length*.95)],maxMs:draw.at(-1),superseded:s.supersededInputs},maxBalls:s.maxBalls,maxFreeBalls:s.maxFreeBalls,multiballRequests:s.multiballRequests,multiballCompleted:s.multiballCompleted,longTasks:s.longTasks,errors:s.errors,worker:{ticks:runtime.ticks-s.initialStats.ticks,physicsMs:runtime.physicsMs-s.initialStats.physicsMs,snapshotMs:runtime.snapshotMs-s.initialStats.snapshotMs,initialLifetimeMaxChunkMs:s.initialStats.maxChunkMs,lifetimeMaxChunkMs:runtime.maxChunkMs,lagMs:runtime.lagMs},physicsStats:game.physicsStats};})()`);
    if(profile){const recording=await call('Profiler.stop');await writeFile(`${output}/worker-main-cpu-${cpuRate}.json`,JSON.stringify(recording.profile));}
    reports.push({cpuRate,profiled:profile,environment:'desktop headless Edge; main-target throttle; worker throttle coverage unverified',...report});console.log(JSON.stringify(reports.at(-1)));
    assert.deepEqual(report.errors,[]);assert.equal(report.physicsStats.substepBudgetExceeded,0);assert.ok(report.maxBalls>=3&&report.maxFreeBalls>=2&&report.multiballCompleted>0,'authored multiball request completed with multiple free game balls; parked toy balls are excluded');assert.ok(report.inputToDraw.samples>20,'flipper commands reached changed drawn angles');
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/worker-browser-timing.json`,JSON.stringify(reports,null,2));
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});socket.close();}
