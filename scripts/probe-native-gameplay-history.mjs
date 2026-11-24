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

function installGameplayFrames(through){
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
    if(tone){const frameIndex=nativeStartup.frameIndex();if(data.frames.at(-1)?.frameIndex===frameIndex)throw Error('Duplicate native tonemap');if(frameIndex===1&&window.nativeCollisionGeometry)nativeCollisionGeometry.read();const snapshot=nativeStartup.read();data.frames.push({frameIndex,snapshot});if(snapshot.ms>=through){data.done=true;nativeSceneClock.armed=false;nativeTimerDispatch.armed=false;}}
   }catch(error){data.errors.push(error.message);data.done=true;}
   return result;
  };
 }
}

const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--capture-name='))?.slice(15)??'sustained-controls-r1',through=Number(process.argv.find(arg=>arg.startsWith('--through-ms='))?.slice(13)??30000);
const cadence=Number(process.argv.find(arg=>arg.startsWith('--cadence-ms='))?.slice(13)??180),nudgeEvery=Number(process.argv.find(arg=>arg.startsWith('--nudge-every-ms='))?.slice(17)??0),replay=process.argv.includes('--replay');
assert.match(name,/^[a-z0-9-]+$/);assert.ok(Number.isInteger(through)&&through>=10000&&through<=120000);
assert.ok(Number.isInteger(cadence)&&cadence>=50&&cadence<=1000);assert.ok(nudgeEvery===0||Number.isInteger(nudgeEvery)&&nudgeEvery>=3000);
const directory=path.join(output,'native-gameplay-history-'+name);assert.equal(fs.existsSync(directory),false,'Preserve previous captures');fs.mkdirSync(directory,{recursive:true});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
const wait=async expression=>{for(let i=0;i<5000;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
 const source="if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-graphics-v1','detailed');"+(process.argv.includes('--flipper-motion')?'('+installNativeFlipperMotionObserver.toString()+')();':'')+(process.argv.includes('--collision-geometry')?'('+installNativeCollisionGeometryObserver.toString()+')();':'')+'('+installNativeRandomizeClockObserver.toString()+')();('+installNativeStartupObserver.toString()+')('+(through+2000)+');('+installNativeSceneClockObserver.toString()+')({maxFrames:10000});('+installNativeTimerDispatchObserver.toString()+')();('+installGameplayFrames.toString()+')('+through+');';
 await call('Page.addScriptToEvaluateOnNewDocument',{source});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');
 await evaluate(`(()=>{nativeRandomizeClocks.install();window.nativePlayerInputs=[];const engine=finni.engine,raw=engine.ccall;engine.ccall=function(...args){let row;if(args[0]==='vpinball_wasm_eval_script')nativePlayerInputs.push(row={frameIndex:nativeStartup.frameIndex(),ms:nativeStartup.read()?.ms,script:args[3][0]});const result=raw.apply(this,args);if(row?.script.startsWith('Debug.Print "FINNI_STATE|'))row.uiState={score:Number(document.getElementById('score').textContent.replace(/,/g,'')),ball:document.getElementById('ball').textContent,playing:document.body.classList.contains('game-in-play'),plunger:document.body.classList.contains('ball-in-plunger')};return result;};})()`);
 await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 // The controller dispatches ordinary player keyboard events. Its actual UI
 // calls/times are recorded independently, rather than imposed on physics.
 await evaluate(`(()=>{document.activeElement?.blur();let origin=nativeStartup.read().ms,held=new Set(),pullAt=null,lastLaunch=-Infinity,lastNudge=origin,lastReplay=-Infinity;const key=(code,down)=>{if(held.has(code)===down)return;down?held.add(code):held.delete(code);window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code.startsWith('Shift')?'Shift':code==='KeyX'?'x':'Enter',bubbles:true}));nativeGameplay.actions.push({code,down,ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()});};const timer=setInterval(()=>{if(nativeGameplay.done){clearInterval(timer);return;}const ms=nativeStartup.read().ms,phase=Math.floor((ms-origin)/${cadence})%4;key('ShiftLeft',phase===0||phase===1);key('ShiftRight',phase===1||phase===2);if(${nudgeEvery}&&ms-lastNudge>=${nudgeEvery}){key('KeyX',true);key('KeyX',false);lastNudge=ms;}if(pullAt!==null&&ms-pullAt>=600){key('Enter',false);pullAt=null;lastLaunch=ms;}else if(pullAt===null&&ms-lastLaunch>=3000&&document.body.classList.contains('ball-in-plunger')){key('Enter',true);pullAt=ms;}if(${replay}){if(document.getElementById('initials-dialog').open)document.getElementById('skip-score').click();const play=document.getElementById('play');if(!play.disabled&&play.textContent==='Play again'&&ms-lastReplay>=3000){lastReplay=ms;play.click();nativeGameplay.actions.push({action:'replay',ms,frameIndex:nativeStartup.frameIndex()});}}},16);})()`);
 await wait('nativeGameplay.done');
 const meta=await evaluate('({flipperMotion:window.nativeFlipperMotion,collisionGeometry:window.nativeCollisionGeometry,frames:nativeGameplay.frames,actions:nativeGameplay.actions,errors:nativeGameplay.errors,clock:nativeSceneClock,timers:nativeTimerDispatch,startup:nativeStartup,randomizeClocks:nativeRandomizeClocks,playerInputs:nativePlayerInputs})');
 meta.engineSHA256=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())).digest('hex');assert.equal(meta.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');meta.clockABI=nativeFrameClockLayout(fs.readFileSync('.work/three-review/reference-engine.wasm'));
 meta.reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(meta.reference.sourceSha256,meta.reference.controlledSha256);assert.deepEqual(meta.reference.controlledOverrides,{});meta.browserErrors=errors;
 meta.scope='Uninterrupted original initialization and full-table gameplay. Only ordinary UI keyboard events; all actual UI calls, script clocks, timer delivery and frame preparation recorded. Native bodies/RNG are expectations, never replay inputs. No image or native state restoration.';
 meta.controller={cadenceMilliseconds:cadence,nudgeEveryMilliseconds:nudgeEvery,replay};
 fs.writeFileSync(path.join(directory,'capture.json'),JSON.stringify(meta));assert.deepEqual(errors,[]);for(const key of ['errors'])assert.deepEqual(meta[key],[]);for(const key of ['clock','timers','startup','randomizeClocks'])assert.deepEqual(meta[key].errors,[]);
 for(const key of ['flipperMotion','collisionGeometry'])if(meta[key])assert.deepEqual(meta[key].errors,[]);
 assert.deepEqual(meta.frames.map(row=>row.frameIndex),Array.from({length:meta.frames.length},(_,i)=>i+1));assert.ok(meta.frames.at(-1).snapshot.ms>=through);console.log(JSON.stringify({directory,frames:meta.frames.length,boundaries:meta.startup.boundaries.length,milliseconds:meta.frames.at(-1).snapshot.ms,actions:meta.actions.length}));
}catch(error){fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:String(error),errors}));throw error;}finally{socket.close();}
