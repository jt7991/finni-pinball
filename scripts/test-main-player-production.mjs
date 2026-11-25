// Ordinary production controls, with read-only observation of worker traffic.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
  if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out '+expression);};
const key=(code,type)=>call('Input.dispatchKeyEvent',{type,code,key:code==='ShiftLeft'?'Shift':'x',windowsVirtualKeyCode:code==='ShiftLeft'?16:88,nativeVirtualKeyCode:code==='ShiftLeft'?16:88});
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const NativeWorker=window.Worker,s=window.productionMainPlayer={latest:null,firstTilt:null,firstNudge:null,nudges:0,samples:[],fatal:[]};
    window.Worker=class extends NativeWorker{
      constructor(...args){super(...args);this.addEventListener('message',({data})=>{
        if(data.type==='fatal')s.fatal.push(data.message);
        if(data.type!=='snapshot')return;
        const v=data.snapshot;s.latest={time:v.time,tilted:v.tilted,held:v.held,state:v.state,physicsStats:v.physicsStats,scriptStats:v.scriptStats,ticks:data.stats.ticks};
        if(s.firstNudge){s.samples.push(s.latest);if(v.tilted&&!s.firstTilt)s.firstTilt=s.latest;}
      });}
      postMessage(message,...args){
        if(message.type==='input'&&message.action==='nudgeForward'&&message.down){s.nudges++;s.firstNudge??={time:s.latest.time,held:s.latest.held};}
        return super.postMessage(message,...args);
      }
    };
  })()`});
  await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
  assert.equal(await evaluate('typeof window.finniThree'),'undefined');
  await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  await key('ShiftLeft','keyDown');await wait('productionMainPlayer.latest.held.left');
  for(let i=0;i<6;i++){await key('KeyX','keyDown');await key('KeyX','keyUp');await new Promise(resolve=>setTimeout(resolve,250));}
  await new Promise(resolve=>setTimeout(resolve,500));
  const result=await evaluate('productionMainPlayer');
  fs.writeFileSync(output+'/main-player-production.json',JSON.stringify({base,...result,errors,scope:'Production Start, held left flipper and six real forward nudge key presses. Read-only worker observation; no game debug hook, rule calls, injected clocks, state or RNG.'},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(result.fatal,[]);
  assert.equal(result.nudges,6);assert.equal(result.firstNudge.held.left,true);
  assert.equal(result.firstTilt,null,'main player disables tilt penalties');
  assert.equal(result.latest.held.left,true,'repeated nudges keep the held flipper enabled');
  assert.equal(result.latest.state,'playing');
  assert.equal(result.latest.scriptStats.videoSyncMode,2);assert.equal(result.latest.scriptStats.budgetMicroseconds,5000);assert.equal(Math.round(result.latest.time*1000)+1,result.latest.ticks);
  assert.ok(result.latest.time-result.firstNudge.time>1.5);
  assert.equal(result.latest.physicsStats.substepBudgetExceeded,0);
  await key('ShiftLeft','keyUp');await wait('!productionMainPlayer.latest.held.left');
  console.log(JSON.stringify({nudges:result.nudges,tilted:false,flipperRemainedHeld:true,physicsBudgetExceeded:0}));
}finally{socket.close();}
