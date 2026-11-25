import fs from 'node:fs';
import assert from 'node:assert/strict';
import {installNativeAudioObservation} from './native-audio-observation.mjs';

const [debug,base,output]=process.argv.slice(2),baseline=process.argv.includes('--baseline-music-readiness'),failMusic=process.argv.includes('--fail-music-until-reload');
const holdMS=Number(process.argv.find(arg=>arg.startsWith('--music-hold-ms='))?.split('=')[1]??1000);
assert.ok(Number.isSafeInteger(holdMS)&&holdMS>=1000&&holdMS<=60000);
const manifest=await(await fetch(new URL('audio.json',base))).json();
const songs=[...new Set(Object.values(manifest).filter(s=>s.music).map(s=>new URL(s.nativeSource.file,base).pathname))];
const heldPath=new URL(manifest.mu_discoloops.nativeSource.file,base).pathname;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression,userGesture=false)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let n=0;n<1200;n++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Music readiness wait: '+expression);};
const key=(code,type)=>call('Input.dispatchKeyEvent',{type,code,key:code==='Enter'?'Enter':code==='Digit1'?'1':'Shift'});

function observe({paths,heldPath,failMusic}){
 const qa=window.musicReadinessQA={requests:[],late:[],latest:null,readyAt:null,release:null};
 const failedPage=failMusic&&!sessionStorage.getItem('music-readiness-fault');
 if(failMusic)sessionStorage.setItem('music-readiness-fault','1');
 const held=new Promise(resolve=>qa.release=resolve),original=window.fetch;
 window.fetch=async(...args)=>{
  const path=new URL(args[0]?.url??String(args[0]),location.href).pathname;
  if(!paths.includes(path))return original(...args);
  const row={path,at:performance.now()};qa.requests.push(row);
  if(qa.readyAt!==null){qa.late.push(row);throw Error('Declared test: music network unavailable after Ready');}
  if(path===heldPath){row.heldAt=performance.now();if(failedPage){row.status=503;return new Response('',{status:503});}await held;row.releasedAt=performance.now();}
  const response=await original(...args),read=response.arrayBuffer.bind(response);row.status=response.status;
  response.arrayBuffer=async()=>{const bytes=await read();row.bodyAt=performance.now();row.bytes=bytes.byteLength;return bytes;};return response;
 };
 const NativeWorker=window.Worker;
 window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='snapshot')qa.latest={time:data.snapshot.time,state:data.snapshot.state,paused:data.paused};});}};
}

try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+observe.toString()+')('+JSON.stringify({paths:songs,heldPath,failMusic})+');('+installNativeAudioObservation.toString()+')()'});
 await call('Page.navigate',{url:base});
 let rejected;
 if(failMusic){
  await wait('document.getElementById("play")?.textContent==="Retry"');
  rejected=await evaluate('({status:document.getElementById("loading").textContent,nodes:nativeAudioQA.nodes,requests:musicReadinessQA.requests,latest:musicReadinessQA.latest})');
  assert.equal(rejected.nodes,0);assert.equal(rejected.latest.time,0);assert.equal(rejected.latest.state,'ready');assert.ok(rejected.requests.some(row=>row.status===503));
  await evaluate('document.getElementById("play").click()',true);
 }
 let held;
 if(baseline){
  await wait('document.getElementById("play")?.textContent==="Start game"');
  held=await evaluate('(async()=>({at:performance.now(),label:document.getElementById("play").textContent,disabled:document.getElementById("play").disabled,requests:musicReadinessQA.requests,stats:await nativeAudioQA.stats(),nodes:nativeAudioQA.nodes,latest:musicReadinessQA.latest}))()');
  const loaded=new Set(held.requests.filter(row=>row.bodyAt).map(row=>row.path));assert.ok(loaded.size<songs.length,'Baseline exposes Ready with absent music sources');
  fs.writeFileSync(output+'/music-readiness-production.json',JSON.stringify({base,baseline,held,missing:songs.filter(path=>!loaded.has(path)),errors,scope:'Read-only baseline of actual Ready state. One future music source is declared held if requested. No game, rule, clock, RNG or body setters.'},null,2),{flag:'wx'});
  console.log(JSON.stringify({baseline,readyWithMissingSources:songs.length-loaded.size,errors}));
 }else{
  await wait('musicReadinessQA.requests.some(row=>row.heldAt)');
  await wait('musicReadinessQA.latest?.state==="ready"');
  await new Promise(resolve=>setTimeout(resolve,holdMS));
  held=await evaluate('(async()=>({at:performance.now(),label:document.getElementById("play").textContent,disabled:document.getElementById("play").disabled,requests:musicReadinessQA.requests,stats:await nativeAudioQA.stats(),nodes:nativeAudioQA.nodes,latest:musicReadinessQA.latest,inputs:nativeAudioQA.inputs}))()');
  fs.writeFileSync(output+'/music-readiness-held.json',JSON.stringify({base,holdMS,held,errors},null,2),{flag:'wx'});
  assert.equal(held.disabled,true);assert.notEqual(held.label,'Start game');assert.equal(held.nodes,0);assert.equal(held.stats.players,0);assert.equal(held.stats.frames,0);assert.equal(held.latest.time,0);assert.equal(held.latest.paused,true);assert.deepEqual(held.inputs,[]);
  await key('Digit1','keyDown');await key('Digit1','keyUp');
  assert.equal(await evaluate('musicReadinessQA.latest.time'),0);assert.deepEqual(await evaluate('nativeAudioQA.inputs'),[]);
  await evaluate('musicReadinessQA.release()');await wait('document.getElementById("play")?.textContent==="Start game"');
  const before=await evaluate('(async()=>{musicReadinessQA.readyAt=performance.now();return{at:musicReadinessQA.readyAt,requests:musicReadinessQA.requests,stats:await nativeAudioQA.stats(),nodes:nativeAudioQA.nodes,latest:musicReadinessQA.latest}})()');
  assert.equal(before.requests.length,songs.length);assert.equal(new Set(before.requests.map(row=>row.path)).size,songs.length);assert.ok(before.requests.every(row=>row.status===200&&row.bodyAt<=before.at));
  assert.equal(before.stats.musicBytes,23791419);assert.equal(before.stats.players,0);assert.equal(before.stats.frames,0);assert.equal(before.nodes,0);assert.equal(before.latest.time,0);
  await evaluate('document.getElementById("play").click()',true);await wait('document.body.classList.contains("ball-in-plunger")');
  await key('Enter','keyDown');await new Promise(resolve=>setTimeout(resolve,650));await key('Enter','keyUp');
  for(const code of ['ShiftLeft','ShiftRight']){await key(code,'keyDown');await new Promise(resolve=>setTimeout(resolve,200));await key(code,'keyUp');}
  await wait('musicReadinessQA.latest.time>=12');
  const result=await evaluate('(async()=>({qa:musicReadinessQA,audio:{...nativeAudioQA,worker:undefined,pending:undefined,packetQueue:undefined,contexts:undefined},stats:await nativeAudioQA.stats()}))()');
  fs.writeFileSync(output+'/music-readiness-production.json',JSON.stringify({base,baseline,failMusic,rejected,held,before,...result,errors,scope:'Actual production boot is held on an unused mode-music source. Keyboard Start cannot advance it. All seven original compressed sources must be ready with no players, output or physical time. All later music fetches are rejected while real Start/Launch/flippers run. Optional first-document music 503 recovers through the real Retry reload. No game, rule, clock, RNG or body setters; physical speaker latency is outside this check.'},null,2),{flag:'wx'});
  assert.deepEqual(result.qa.late,[]);assert.deepEqual(result.audio.warnings,[]);assert.deepEqual(result.audio.fatal,[]);assert.deepEqual(result.audio.hashMismatches,[]);assert.equal(result.audio.underruns,0);assert.equal(result.audio.nodes,1);assert.ok(result.audio.presented.some(row=>row.name==='mu_shooterlane'));assert.ok(result.audio.presented.some(row=>row.name==='mu_hellhouse1'));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({production:true,failMusic,preparedSources:songs.length,musicBytes:before.stats.musicBytes,lateRequests:result.qa.late.length,callbacks:result.audio.callbacks.length,errors}));
 }
}finally{socket.close();}
