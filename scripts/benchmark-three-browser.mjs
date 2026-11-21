// Sustained real-browser timing, with/without the static frame candidate cache.
// Desktop headless and CPU throttling are diagnostics, not physical-phone FPS.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2),seconds=Number(process.argv.find(a=>a.startsWith('--seconds='))?.split('=')[1]??10);
const withoutRapier=process.argv.includes('--without-rapier');
const profile=process.argv.includes('--profile'),cpuFilter=Number(process.argv.find(a=>a.startsWith('--cpu-rate='))?.split('=')[1]??0);
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
  for(const cpuRate of [1,4].filter(rate=>!cpuFilter||cpuFilter===rate))for(const cached of [false,true].filter(value=>!process.argv.includes('--cached-only')||value)){
    await call('Emulation.setCPUThrottlingRate',{rate:cpuRate});
    await call('Page.navigate',{url:base});await wait('!!window.finniThree && document.getElementById("play")?.textContent==="Start game"');
    await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
    if(profile){await call('Profiler.enable');await call('Profiler.start');}
    await evaluate(`(()=>{
      const {game,view}=window.finniThree,query=game.nativeTree.query.bind(game.nativeTree);
      // Diagnostic cost bound only: native displacement continues, but this
      // omits Rapier's orientation/sensor pass. Never enables a release mode.
      if(${withoutRapier}){if(!game.nativeBallContacts)throw Error('native ball contacts required');game.world.step=()=>{};}
      if(!${cached})game.nativeTree.query=(q,visit)=>query(q,visit);
      let randomState=98765;game.random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
      game.rules.objects.get('hostplunger').random(0);
      const stats=window.playTiming={started:performance.now(),initialTime:game.time,steps:0,stepMs:0,frames:0,renderMs:0,maxFrameMs:0,frameIntervals:[],maxBalls:0};
      const step=game.step.bind(game),render=view.render.bind(view);let lastFrame=performance.now(),qualified=false;
      game.step=()=>{
        const start=performance.now();
        if(game.state==='over'){game.start();qualified=false;}
        if(game.inLane&&!game.plunger.fireTimer){game.input('launch',true);if(game.charge>=1.05)game.input('launch',false);}
        if(!qualified&&game.records.some(r=>!r.held&&r.body.translation().y>10)){game.rules.run('AddMultiball',2);qualified=true;}
        for(const [index,side]of ['left','right'].entries()){const held=Math.floor((game.time+index*.09)/.12)%2===0;if(game.held[side]!==held)game.input(side,held);}
        if(stats.steps%120===0&&game.rules.value('bChooseBattle')){game.input('action',true);game.input('action',false);}
        step();stats.stepMs+=performance.now()-start;stats.steps++;stats.maxBalls=Math.max(stats.maxBalls,game.records.length);
      };
      view.render=(...args)=>{const now=performance.now(),interval=now-lastFrame;lastFrame=now;stats.maxFrameMs=Math.max(stats.maxFrameMs,interval);stats.frameIntervals.push(interval);render(...args);stats.renderMs+=performance.now()-now;stats.frames++;};
    })()`);
    await new Promise(resolve=>setTimeout(resolve,seconds*1000));
    const report=await evaluate(`(()=>{const s=window.playTiming,wallMs=performance.now()-s.started,game=window.finniThree.game,sorted=s.frameIntervals.slice().sort((a,b)=>a-b);return {wallMs,simulatedMs:(game.time-s.initialTime)*1000,simulationRatio:(game.time-s.initialTime)*1000/wallMs,frames:s.frames,fps:s.frames*1000/wallMs,steps:s.steps,physicsMs:s.stepMs,renderMs:s.renderMs,p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:s.maxFrameMs,maxBalls:s.maxBalls,physicsStats:game.physicsStats};})()`);
    const candidates=await evaluate('window.finniThree.game.physicalRecords.map(r=>({broad:r.nativeStaticQueryCache?.broad?.length,exact:r.nativeStaticQueryCache?.entries?.length,position:r.body.translation()}))');
    const nativeDisplacements=await evaluate('!!window.finniThree.game.nativeDisplacements');
    reports.push({cpuRate,cached,withoutRapier,nativeDisplacements,candidates,...report});console.log(JSON.stringify(reports.at(-1)));
    if(profile){const result=await call('Profiler.stop');await writeFile(`${output}/physics-cpu-${cpuRate}-${cached?'cached':'uncached'}-${withoutRapier?'no-rapier':'normal'}.json`,JSON.stringify(result.profile));const counts=new Map();for(const id of result.profile.samples??[])counts.set(id,(counts.get(id)??0)+1);console.log(JSON.stringify({selfSamples:result.profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,count:counts.get(n.id)??0})).sort((a,b)=>b.count-a.count).slice(0,25)}));}
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/sustained-browser-timing.json`,JSON.stringify(reports,null,2));
}finally{await call('Emulation.setCPUThrottlingRate',{rate:1});socket.close();}
