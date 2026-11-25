// Real production play with automatic clocks/budgets. No debug game hook,
// clock/RNG/state overrides, pose setters or online score writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import{installNativeAudioObservation}from'./native-audio-observation.mjs';
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let serial=0;const pending=new Map(),errors=[],actions=[];
const observeAudio=process.argv.includes('--observe-audio');
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression,userGesture=false)=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out '+expression);};
const key=(code,type)=>call('Input.dispatchKeyEvent',{type,code,key:code==='Enter'?'Enter':code==='Space'?' ':'Shift',windowsVirtualKeyCode:code==='Enter'?13:code==='Space'?32:16,nativeVirtualKeyCode:code==='Enter'?13:code==='Space'?32:16});
let result;
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 if(observeAudio)await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeAudioObservation.toString()+')()'});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeWorker=window.Worker,s=window.automaticGameplay={latest:null,transitions:[],fatal:[],samples:[],tickMismatches:0,firstOver:null};let previous;
  window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='fatal')s.fatal.push(data.message);if(data.type!=='snapshot')return;const v=data.snapshot,queries=new Map(v.values);s.latest={time:v.time,state:v.state,score:v.score,ballNumber:v.ballNumber,inLane:v.inLane,held:v.held,gameState:v.gameState,choosing:!!queries.get('bChooseBattle'),scriptStats:v.scriptStats,physicsStats:v.physicsStats,ticks:data.stats.ticks};if(data.stats.ticks&&Math.round(v.time*1000)+1!==data.stats.ticks)s.tickMismatches++;const state=JSON.stringify([v.state,v.ballNumber,v.inLane,!!queries.get('bChooseBattle'),v.gameState?.entering]);if(state!==previous){s.transitions.push(s.latest);previous=state;}if(!s.samples.length||v.time-s.samples.at(-1).time>=1)s.samples.push(s.latest);for(const effect of data.effects)if(effect.type==='event'&&effect.event.type==='over')s.firstOver??=s.latest;});}};})()`});
 await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');assert.equal(await evaluate('typeof window.finniThree'),'undefined');await evaluate('document.getElementById("play").click()',observeAudio);
 const started=Date.now();let charging=false,releaseAt=0,lastLaunch=0,lastChoice=0,lastReport=0,over=false;
 while(Date.now()-started<220000){
  const state=await evaluate('({latest:automaticGameplay.latest,over:automaticGameplay.firstOver,dialog:document.getElementById("initials-dialog").open,play:document.getElementById("play").textContent,fatal:automaticGameplay.fatal})');assert.deepEqual(state.fatal,[]);
  if(state.dialog){await evaluate('document.getElementById("skip-score").click()');actions.push({type:'skip-score',time:state.latest?.time});}
  if(state.over&&state.play==='Play again'){over=true;break;}
  const now=Date.now(),latest=state.latest;
  if(charging&&now>=releaseAt){await key('Enter','keyUp');charging=false;lastLaunch=now;actions.push({type:'launch-release',time:latest.time});}
  if(!charging&&latest?.inLane&&now-lastLaunch>1800){await key('Enter','keyDown');charging=true;releaseAt=now+600;actions.push({type:'launch-press',time:latest.time});}
  if(latest?.choosing&&now-lastChoice>1000){await key('Space','keyDown');await key('Space','keyUp');lastChoice=now;actions.push({type:'confirm-mission',time:latest.time});}
  if(now-lastReport>15000){console.log(JSON.stringify({elapsedMilliseconds:now-started,time:latest?.time,ball:latest?.ballNumber,state:latest?.state,score:latest?.score,deferrals:latest?.scriptStats?.timerDeferrals}));lastReport=now;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(charging)await key('Enter','keyUp');result=await evaluate('automaticGameplay');result={base,actions,errors,...result,completedGame:over,scope:'Production ordinary Start,600ms physical launch inputs, authored Action when choosing, and Skip for score dialogs. Automatic wall-clock script budget and real rendered frames. No debug hook, rule calls, clock/RNG/pose/state replacement or online score submission.'};
 assert.equal(over,true,'ordinary play must reach native game-over flow');await evaluate('document.getElementById("play").click()');await wait('automaticGameplay.latest.gameState?.playing&&automaticGameplay.latest.inLane');result.replay=await evaluate('automaticGameplay.latest');assert.equal(result.replay.ballNumber,1);assert.equal(result.tickMismatches,0);assert.deepEqual(result.fatal,[]);assert.deepEqual(errors,[]);assert.equal(result.latest.physicsStats.substepBudgetExceeded,0);assert.equal(result.latest.scriptStats.videoSyncMode,2);console.log('PASS production automatic-budget full game, score skipping and physical replay');
 if(observeAudio){
  result.audio=await evaluate('({...nativeAudioQA,packetQueue:undefined,pending:undefined,worker:undefined,contexts:nativeAudioQA.contexts.map(c=>({initialState:c.initialState,state:c.readState(),resumes:c.resumes}))})');
  const audio=result.audio;assert.equal(audio.nodes,1);assert.equal(audio.audioElements,0);assert.ok(audio.callbacks.length>1000);assert.equal(audio.underruns,0);assert.deepEqual(audio.hashMismatches,[]);assert.deepEqual(audio.fatal,[]);assert.deepEqual(audio.warnings,[]);assert.ok(audio.presented.some(p=>p.name.startsWith('vo_')),'An authored voice reaches actual device output');assert.ok(audio.presented.some(p=>p.name==='mu_shooterlane'));assert.ok(audio.presented.some(p=>p.name==='mu_hellhouse1'));assert.ok(audio.callbacks.some(c=>c.peak>0));assert.ok(audio.contexts.every(c=>c.state==='running'));
  result.scope+=' Audio observation grants browser activation only to Start, reads actual output callbacks and matches prepared hashes through the complete game and replay. It does not compare natural first-use loading times to VPX or measure physical speakers.';
  console.log(JSON.stringify({audio:true,callbacks:audio.callbacks.length,authoredPlays:audio.effects.length,presentedPlays:audio.presented.length,underruns:audio.underruns,hashMismatches:audio.hashMismatches.length,voices:new Set(audio.presented.filter(p=>p.name.startsWith('vo_')).map(p=>p.name)).size}));
 }
}finally{if(!result)try{result={base,actions,errors,...await evaluate('automaticGameplay'),completedGame:false};}catch{}fs.writeFileSync(output+'/automatic-budget-production-gameplay.json',JSON.stringify(result,null,2));socket.close();}
