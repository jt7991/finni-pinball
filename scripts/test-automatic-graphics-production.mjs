// A declared slow RAF cadence exercises real rendered-frame sampling and both
// startup retries. It supplies no FPS result, game state, rule clock or rescue.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}
  if(data.method==='Runtime.exceptionThrown')errors.push(data.params);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
});
const evaluate=async expression=>{
  const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){
  for(let i=0;i<1600;i++){
    try{if(await evaluate(expression))return;}catch(error){if(!/context.*destroyed|Cannot find context|Inspected target navigated/i.test(String(error)))throw error;}
    await sleep(50);
  }
  throw Error('Automatic graphics timed out: '+expression);
}
const read=()=>evaluate(`(()=>{
  const s=window.automaticGraphicsQA,canvas=document.getElementById('canvas'),rect=canvas?.getBoundingClientRect();
  return{trace:JSON.parse(sessionStorage.getItem('qa-automatic-graphics-trace')||'[]'),
    cached:JSON.parse(sessionStorage.getItem('finni-three-automatic-graphics-v1')),
    quality:document.getElementById('graphics')?.value,players:document.getElementById('player-count')?.value,
    play:document.getElementById('play')?.textContent,disabled:document.getElementById('play')?.disabled,
    status:document.getElementById('loading')?.textContent,latest:s?.latest,fatal:s?.fatal,
    canvas:canvas?{width:canvas.width,height:canvas.height,cssWidth:rect.width,cssHeight:rect.height}:null};
})()`);
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const traceKey='qa-automatic-graphics-trace',cacheKey='finni-three-automatic-graphics-v1';
    const set=Storage.prototype.setItem;
    const trace=JSON.parse(sessionStorage.getItem(traceKey)||'[]');
    trace.push({kind:'boot',cached:JSON.parse(sessionStorage.getItem(cacheKey)),quality:localStorage.getItem('finni-three-quality')});
    set.call(sessionStorage,traceKey,JSON.stringify(trace));
    Storage.prototype.setItem=function(key,value){
      if(this===sessionStorage&&key===cacheKey){
        const rows=JSON.parse(sessionStorage.getItem(traceKey)||'[]');rows.push({kind:'retry',...JSON.parse(value)});
        set.call(sessionStorage,traceKey,JSON.stringify(rows));
      }
      return set.call(this,key,value);
    };
    const raf=window.requestAnimationFrame;
    window.requestAnimationFrame=callback=>setTimeout(()=>raf.call(window,callback),75);
    const NativeWorker=window.Worker,s=window.automaticGraphicsQA={latest:null,fatal:[]};
    window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{
      if(data.type==='snapshot')s.latest={time:data.snapshot.time,paused:data.paused,ticks:data.stats?.ticks,state:data.snapshot.state};
      if(data.type==='fatal')s.fatal.push(data.message);
    });}};
  })()`});
  await call('Page.navigate',{url:base});
  await wait('!!document.getElementById("player-count")');
  await evaluate('document.getElementById("player-count").value="4"');
  await wait('document.getElementById("loading")?.textContent.includes("Checking graphics")');
  const checking=await read();assert.equal(checking.disabled,true,'Start waits for the rendered table check');
  await wait('document.getElementById("play")?.textContent==="Start game"');
  const automatic=await read(),retries=automatic.trace.filter(row=>row.kind==='retry');
  assert.equal(automatic.quality,'auto');assert.equal(automatic.cached.quality,'performance');
  assert.deepEqual(retries.map(row=>row.quality),['reduced','performance']);
  assert.ok(retries.every(row=>row.players==='4'));assert.equal(automatic.players,'4');
  assert.equal(automatic.trace.filter(row=>row.kind==='boot').length,3,'Automatic has a bounded pair of retries');
  assert.equal(automatic.latest.paused,true);assert.equal(automatic.latest.time,0,'final Performance initializes on Start');
  assert.deepEqual(automatic.fatal,[]);assert.equal(await evaluate('!!window.finniThree'),false);
  assert.ok(automatic.canvas.width*automatic.canvas.height<=360000,'Performance uses the current main portrait render budget');
  await evaluate('document.getElementById("settings").click()');
  await wait('document.getElementById("controls-panel").matches(":popover-open")');
  await evaluate('document.getElementById("graphics").value="detailed";document.getElementById("apply-graphics").click()');
  await wait('JSON.parse(sessionStorage.getItem("qa-automatic-graphics-trace")||"[]").filter(row=>row.kind==="boot").length===4&&document.getElementById("play")?.textContent==="Start game"&&document.getElementById("graphics")?.value==="detailed"&&!!window.automaticGraphicsQA?.latest');
  const explicit=await read();assert.equal(explicit.cached,null,'Apply clears the automatic retry preference');
  assert.equal(explicit.trace.filter(row=>row.kind==='retry').length,2,'explicit graphics does not run Automatic');
  assert.equal(explicit.trace.filter(row=>row.kind==='boot').length,4);
  assert.equal(explicit.latest.paused,true);assert.equal(explicit.latest.time,0);assert.deepEqual(explicit.fatal,[]);
  const context=await read();assert.deepEqual(errors,[]);
  const report={base,scope:'Production UI under a declared 75ms delay before each real RAF callback. The app counts its own completed renders and uses its real clock. No FPS value, frame result, game rule, physical state, timer or random output is supplied. Both automatic retries, preserved UI player choice, final buffer budget, explicit selection and cache reset are asserted. This is a startup policy regression, not a performance benchmark or native trajectory comparison.',checking,automatic,explicit,context,errors};
  fs.writeFileSync(path.join(output,'automatic-graphics-production.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({retries,automatic:automatic.cached,explicit:explicit.quality,buffer:automatic.canvas,errors}));
}catch(error){
  fs.writeFileSync(path.join(output,'automatic-graphics-failure.json'),JSON.stringify({base,error:String(error),observed:await read().catch(String),errors},null,2),{flag:'wx'});throw error;
}finally{socket.close();}
