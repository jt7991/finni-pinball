// Unmodified full-table physics from initialization, through ordinary UI play.
// Body/RNG reads are expectations only; the replay consumes external inputs.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{installNativeStartupObserver}from './native-startup-observer.mjs';
import{installNativeSceneClockObserver}from './native-scene-clock-observer.mjs';
import{installNativeTimerDispatchObserver}from './native-timer-dispatch-observer.mjs';
import{installNativeRandomizeClockObserver}from './native-randomize-clock-observer.mjs';
import{nativeFrameClockLayout}from './native-frame-clock-layout.mjs';
import{installNativeCollisionGeometryObserver}from './native-collision-geometry-observer.mjs';
import{installNativeFlipperMotionObserver}from './native-flipper-motion-observer.mjs';
import{installNativeMoverMotionObserver}from './native-mover-motion-observer.mjs';
import{missionCompletionScenario,partyFinaleScenario,installMissionCompletionController}from './native-mission-completion-controller.mjs';
import{partyChooserScript}from'../browser/party-chooser.js';
import{playerStateFields,installPlayerStateObserver}from'./native-player-state-observer.mjs';
import{NativeHistoryPageWriter,hydrateNativeHistoryPages,nativeHistoryArrayPaths}from'./native-history-pages.mjs';

function installGameplayFrames(through,paged=false,stopAfterReplay=0){
 const data=window.nativeGameplay={frames:[],errors:[],done:false,actions:[]},programs=new WeakMap();
 for(const method of ['drawElements','drawElementsInstanced','drawRangeElements','drawArrays','drawArraysInstanced']){
  const raw=WebGL2RenderingContext.prototype[method];
  WebGL2RenderingContext.prototype[method]=function(...args){
   const result=raw.apply(this,args);if(data.done||this.canvas.id!=='canvas')return result;
   try{
    const program=this.getParameter(this.CURRENT_PROGRAM);let tone=programs.get(program);
    // Native detaches shaders after linking. These three live uniforms are
    // the pinned FBShader tonemap interface; no image readback is needed.
    if(tone===undefined){tone=['exposure_wcg','bloom_dither_colorgrade','tex_bloom'].every(name=>this.getUniformLocation(program,name)!==null);programs.set(program,tone);}
    if(tone){const frameIndex=nativeStartup.frameIndex();if(data.frames.at(-1)?.frameIndex===frameIndex)throw Error('Duplicate native tonemap');if(frameIndex===1&&window.nativeCollisionGeometry)nativeCollisionGeometry.read();const snapshot=nativeStartup.read();data.frames.push({frameIndex,snapshot});if(snapshot.ms>=through||(stopAfterReplay&&data.lastReplayAt!==undefined&&snapshot.ms>=data.lastReplayAt+stopAfterReplay)){data.done=true;nativeSceneClock.armed=false;nativeTimerDispatch.armed=false;if(paged){nativeStartup.done=true;nativeRandomizeClocks.stopped=true;}}}
   }catch(error){data.errors.push(error.message);data.done=true;}
   return result;
  };
 }
}

const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--capture-name='))?.slice(15)??'sustained-controls-r1',through=Number(process.argv.find(arg=>arg.startsWith('--through-ms='))?.slice(13)??30000);
const paged=process.argv.includes('--paged-history'),stopAfterReplay=Number(process.argv.find(arg=>arg.startsWith('--stop-after-replay-ms='))?.split('=')[1]??0);assert.ok(stopAfterReplay===0||paged&&Number.isInteger(stopAfterReplay)&&stopAfterReplay>=1000);
const cadence=Number(process.argv.find(arg=>arg.startsWith('--cadence-ms='))?.slice(13)??180),nudgeEvery=Number(process.argv.find(arg=>arg.startsWith('--nudge-every-ms='))?.slice(17)??0),replay=process.argv.includes('--replay');
const actionEvery=Number(process.argv.find(arg=>arg.startsWith('--action-every-ms='))?.slice(18)??0);
const playersText=process.argv.find(arg=>arg.startsWith('--players='))?.slice(10),players=Number(playersText??1),observePlayerState=process.argv.includes('--observe-player-state'),releasedFlippers=process.argv.includes('--release-flippers');assert.ok(Number.isInteger(players)&&players>=1&&players<=4);
const completionText=process.argv.find(arg=>arg.startsWith('--complete-mission='))?.slice('--complete-mission='.length),legacyCompletion=process.argv.includes('--complete-mission1');assert.ok(!(legacyCompletion&&completionText!==undefined));
const reachFinale=process.argv.includes('--reach-party-finale');assert.ok(!(reachFinale&&(legacyCompletion||completionText!==undefined)),'Finale entry and full-counter requests are distinct');
const completeMission=legacyCompletion||completionText!==undefined||reachFinale,completionObjects=completeMission?JSON.parse(fs.readFileSync('three/public/objects.json')).objects:null,completionScenario=reachFinale?partyFinaleScenario(completionObjects):completeMission?missionCompletionScenario(completionObjects,legacyCompletion?1:Number(completionText)):null;
const guardPartyChooser=process.argv.includes('--guard-party-chooser');
if(completeMission)assert.ok(!nudgeEvery&&!actionEvery&&!replay&&!process.argv.some(arg=>arg.startsWith('--cadence-ms=')),'Completion and ordinary gameplay controllers are separate input modes');
if(completeMission)assert.ok(players===1&&!observePlayerState&&!releasedFlippers,'Multiplayer observations and passive controls use the ordinary input controller');
assert.ok(actionEvery===0||Number.isInteger(actionEvery)&&actionEvery>=500&&actionEvery<=10000);
assert.match(name,/^[a-z0-9-]+$/);assert.ok(Number.isInteger(through)&&through>=10000&&through<=(paged?900000:120000));assert.ok(!stopAfterReplay||replay);
assert.ok(Number.isInteger(cadence)&&cadence>=50&&cadence<=1000);assert.ok(nudgeEvery===0||Number.isInteger(nudgeEvery)&&nudgeEvery>=3000);
const directory=path.join(output,'native-gameplay-history-'+name);assert.equal(fs.existsSync(directory),false,'Preserve previous captures');fs.mkdirSync(directory,{recursive:true});
const pageWriter=paged?new NativeHistoryPageWriter(directory):null;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
const wait=async expression=>{for(let i=0;i<5000;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out '+expression);};
const captureExpression='({playerStateObserver:window.nativePlayerStateObserver,completionController:window.nativeMissionCompletionController,moverMotion:window.nativeMoverMotion,flipperMotion:window.nativeFlipperMotion,collisionGeometry:window.nativeCollisionGeometry,frames:nativeGameplay.frames,actions:nativeGameplay.actions,errors:nativeGameplay.errors,clock:nativeSceneClock,timers:nativeTimerDispatch,startup:nativeStartup,randomizeClocks:nativeRandomizeClocks,playerInputs:nativePlayerInputs})';
async function transferJSON(expression){
 const length=await evaluate('window.nativeGameplayCaptureJSON=JSON.stringify('+expression+');nativeGameplayCaptureJSON.length');assert.ok(Number.isInteger(length)&&length>0);const chunks=[],chunkSize=1024*1024;
 for(let offset=0;offset<length;offset+=chunkSize){const chunk=await evaluate(`nativeGameplayCaptureJSON.slice(${offset},${offset+chunkSize})`);assert.equal(chunk.length,Math.min(chunkSize,length-offset));chunks.push(chunk);}
 const serialized=chunks.join('');assert.equal(serialized.length,length);await evaluate('delete window.nativeGameplayCaptureJSON');return Buffer.from(serialized);
}
async function drainPages(final=false){
 for(const keys of nativeHistoryArrayPaths){const expression=captureExpression+keys.map(key=>'?.['+JSON.stringify(key)+']').join(''),length=await evaluate('(()=>{const rows='+expression+';return rows?.length??0;})()');let remaining=length-(final?0:1);
  while(remaining>=(final?1:512)){const count=Math.min(512,remaining),bytes=await transferJSON(expression+'.slice(0,'+count+')');pageWriter.add(keys,bytes);assert.equal(await evaluate(expression+'.splice(0,'+count+').length'),count);remaining-=count;}
 }
}
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
 const moverSpecs=JSON.parse(fs.readFileSync('three/public/objects.json')).objects.filter(s=>['Gate','Spinner'].includes(s.kind)).map(({name,kind})=>({name,kind}));
 const source="if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-graphics-v1','detailed');"+(process.argv.includes('--mover-motion')?'('+installNativeMoverMotionObserver.toString()+')('+JSON.stringify(moverSpecs)+');':'')+(process.argv.includes('--flipper-motion')?'('+installNativeFlipperMotionObserver.toString()+')();':'')+(process.argv.includes('--collision-geometry')?'('+installNativeCollisionGeometryObserver.toString()+')();':'')+'('+installNativeRandomizeClockObserver.toString()+')();('+installNativeStartupObserver.toString()+')('+(through+2000)+');('+installNativeSceneClockObserver.toString()+')({maxFrames:'+(paged?Math.ceil(through/10)+1000:10000)+'});('+installNativeTimerDispatchObserver.toString()+')();('+installGameplayFrames.toString()+')('+[through,paged,stopAfterReplay].join(',')+');';
 await call('Page.addScriptToEvaluateOnNewDocument',{source});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');
 await evaluate(`(()=>{nativeRandomizeClocks.install();window.nativePlayerInputs=[];const engine=finni.engine,raw=engine.ccall;engine.ccall=function(...args){let row;if(args[0]==='vpinball_wasm_eval_script'&&!(${paged}&&nativeGameplay.done))nativePlayerInputs.push(row={frameIndex:nativeStartup.frameIndex(),ms:nativeStartup.read()?.ms,script:args[3][0]});const result=raw.apply(this,args);if(row?.script.startsWith('Debug.Print "FINNI_STATE|'))row.uiState={score:Number(document.getElementById('score').textContent.replace(/,/g,'')),ball:document.getElementById('ball').textContent,playing:document.body.classList.contains('game-in-play'),plunger:document.body.classList.contains('ball-in-plunger')};return result;};})()`);
 if(playersText!==undefined)await evaluate('(()=>{const select=document.getElementById("player-count");select.value='+JSON.stringify(String(players))+';select.dispatchEvent(new Event("change",{bubbles:true}));})()');
 await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 if(guardPartyChooser)await evaluate('finni.evaluate('+JSON.stringify(partyChooserScript)+')');
 if(observePlayerState)await evaluate('('+installPlayerStateObserver.toString()+')('+JSON.stringify(playerStateFields)+')');
 // The controller dispatches ordinary player keyboard events. Its actual UI
 // calls/times are recorded independently, rather than imposed on physics.
 if(completeMission)await evaluate('('+installMissionCompletionController.toString()+')('+JSON.stringify(completionScenario)+')');
 else await evaluate(`(()=>{document.activeElement?.blur();let origin=nativeStartup.read().ms,held=new Set(),pullAt=null,lastLaunch=-Infinity,lastNudge=origin,lastAction=origin,lastReplay=-Infinity;const key=(code,down)=>{if(held.has(code)===down)return;down?held.add(code):held.delete(code);window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code.startsWith('Shift')?'Shift':code==='KeyX'?'x':code==='Space'?' ':'Enter',bubbles:true}));nativeGameplay.actions.push({code,down,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()});};const timer=setInterval(()=>{if(nativeGameplay.done){clearInterval(timer);return;}const ms=nativeStartup.read().ms,phase=${releasedFlippers?'-1':`Math.floor((ms-origin)/${cadence})%4`};key('ShiftLeft',phase===0||phase===1);key('ShiftRight',phase===1||phase===2);if(${nudgeEvery}&&ms-lastNudge>=${nudgeEvery}){key('KeyX',true);key('KeyX',false);lastNudge=ms;}if(${actionEvery}&&ms-lastAction>=${actionEvery}){key('Space',true);key('Space',false);lastAction=ms;}if(pullAt!==null&&ms-pullAt>=600){key('Enter',false);pullAt=null;lastLaunch=ms;}else if(pullAt===null&&ms-lastLaunch>=3000&&document.body.classList.contains('ball-in-plunger')){key('Enter',true);pullAt=ms;}if(${replay}){if(document.getElementById('initials-dialog').open)document.getElementById('skip-score').click();const play=document.getElementById('play');if(!play.disabled&&play.textContent==='Play again'&&ms-lastReplay>=3000){lastReplay=ms;nativeGameplay.lastReplayAt=ms;play.click();nativeGameplay.actions.push({action:'replay',ms,frameIndex:nativeStartup.frameIndex()});}}},16);})()`);
 if(paged){
  const deadline=Date.now()+through*2+120000;let lastProgress=-Infinity;
  while(true){const status=await evaluate('({done:nativeGameplay.done,ms:nativeStartup.read()?.ms,errors:nativeGameplay.errors})');assert.deepEqual(status.errors,[]);if(status.done)break;assert.ok(Date.now()<deadline,'Paged capture timed out');await drainPages();if(status.ms-lastProgress>=10000){lastProgress=status.ms;console.log(JSON.stringify({recordingMilliseconds:status.ms,pages:[...pageWriter.arrays.values()].reduce((n,a)=>n+a.pages.length,0)}));}await new Promise(resolve=>setTimeout(resolve,100));}
  await drainPages(true);
 }else await wait('nativeGameplay.done');
 const meta=JSON.parse(await transferJSON(captureExpression));
 if(paged)meta.endConditions={throughMilliseconds:through,stopAfterReplayMilliseconds:stopAfterReplay,lastReplayMilliseconds:await evaluate('nativeGameplay.lastReplayAt??null')};
 meta.engineSHA256=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())).digest('hex');assert.equal(meta.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');meta.clockABI=nativeFrameClockLayout(fs.readFileSync('.work/three-review/reference-engine.wasm'));
 meta.reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(meta.reference.sourceSha256,meta.reference.controlledSha256);assert.deepEqual(meta.reference.controlledOverrides,{});meta.browserErrors=errors;
 meta.scope='Uninterrupted original initialization and full-table gameplay. Only ordinary UI keyboard events; all actual UI calls, script clocks, timer delivery and frame preparation recorded. Native bodies/RNG are expectations, never replay inputs. No image or native state restoration.';
 if(completeMission){meta.scope=completionScenario.scope;meta.completionControllerSourceSHA256=createHash('sha256').update(fs.readFileSync('scripts/native-mission-completion-controller.mjs')).digest('hex');}
 if(playersText!==undefined)meta.selectedPlayers=players;if(observePlayerState){meta.playerStateObserverSourceSHA256=createHash('sha256').update(fs.readFileSync('scripts/native-player-state-observer.mjs')).digest('hex');meta.scope+=' Read-only per-player arrays and Variant types are observed without changing progress; Rnd(0) observes the script random word without advancing it.';}
 meta.controller=reachFinale?{kind:'controlled-physical-final-party-entry',completedCounters:[1,2,3,4,5,6],missionSequence:[1,2,3,4,5,6,7]}:completeMission?{kind:'controlled-physical-mission-completion',mission:completionScenario.mission,...(completionScenario.mission>=4?{missionSequence:Array.from({length:completionScenario.mission},(_,i)=>i+1)}:{})}:{cadenceMilliseconds:cadence,nudgeEveryMilliseconds:nudgeEvery,actionEveryMilliseconds:actionEvery,replay,...(releasedFlippers?{flippers:'released'}:{})};
 if(guardPartyChooser){meta.playerCorrections={partyChooserSHA256:createHash('sha256').update(partyChooserScript).digest('hex')};meta.scope+=' The shared player chooser correction is installed before the first chooser through the ordinary script channel and retained verbatim among the external inputs. No table bytes, native physics algorithm, clock result or random word is replaced.';}
 let observed=meta;if(paged)observed=hydrateNativeHistoryPages(pageWriter.finish(meta),directory);else fs.writeFileSync(path.join(directory,'capture.json'),JSON.stringify(meta));assert.deepEqual(errors,[]);for(const key of ['errors'])assert.deepEqual(meta[key],[]);for(const key of ['clock','timers','startup','randomizeClocks'])assert.deepEqual(meta[key].errors,[]);
 for(const key of ['flipperMotion','collisionGeometry','moverMotion'])if(meta[key])assert.deepEqual(meta[key].errors,[]);
 if(observePlayerState){assert.deepEqual(meta.playerStateObserver.errors,[]);assert.ok(observed.playerStateObserver.observations.length>0);}
 if(completeMission){assert.deepEqual(meta.completionController.errors,[]);assert.equal(meta.completionController.completed,true,reachFinale?'Native six-win progression, physical finale entry and original round reset observed':'Native full-counter mission and physical scoop jackpot complete within the recorded window');}
 let frameIndex=0;for(const row of observed.frames)assert.equal(row.frameIndex,++frameIndex);const lastFrame=observed.frames.at(-1);assert.ok(lastFrame.snapshot.ms>=through||(stopAfterReplay&&observed.endConditions.lastReplayMilliseconds!==null&&lastFrame.snapshot.ms>=observed.endConditions.lastReplayMilliseconds+stopAfterReplay));console.log(JSON.stringify({directory,frames:observed.frames.length,boundaries:observed.startup.boundaries.length,milliseconds:lastFrame.snapshot.ms,actions:observed.actions.length,...(paged?{manifest:'capture-pages.json',endConditions:observed.endConditions}:{})}));
}catch(error){fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:String(error),errors}));throw error;}finally{socket.close();}
