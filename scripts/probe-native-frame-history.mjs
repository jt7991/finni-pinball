// Original native frames beginning with the first tonemap. Readbacks preserve
// all native clocks, state and rendering; their cost remains part of the run.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{installNativeStartupObserver}from './native-startup-observer.mjs';
import{installNativeSceneClockObserver}from './native-scene-clock-observer.mjs';
import{installNativeTimerDispatchObserver}from './native-timer-dispatch-observer.mjs';
import{installNativePostprocessObserver}from './native-postprocess-observer.mjs';
import{installNativeWholeFrameObserver}from './native-whole-frame-observer.mjs';
import{nativeFrameClockLayout}from './native-frame-clock-layout.mjs';
import{installNativeBallPresentationObserver}from './native-ball-presentation-observer.mjs';
import{installNativeRandomizeClockObserver}from './native-randomize-clock-observer.mjs';
import{installNativeTextureAuditObserver}from './native-texture-audit-observer.mjs';
import{nativeTextureCacheLayout}from './native-texture-cache-layout.mjs';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--capture-name='))?.slice(15)??'initial-history-r1';
const frameCount=Number(process.argv.find(arg=>arg.startsWith('--frames='))?.slice(9)??6),launchControls=process.argv.includes('--launch-controls');assert.ok(Number.isInteger(frameCount)&&frameCount>=2&&frameCount<=64);if(launchControls)assert.ok(frameCount>=32);
const tracePixel=process.argv.find(arg=>arg.startsWith('--trace-first-pixel='))?.slice(20).split(',').map(Number);if(tracePixel)assert.ok(tracePixel.length===2&&tracePixel.every(Number.isInteger));
const geometryFrames=process.argv.find(arg=>arg.startsWith('--geometry-frames='))?.slice(18).split(',').map(Number)??(tracePixel?[1]:undefined);if(geometryFrames)assert.ok(geometryFrames.every(frame=>Number.isInteger(frame)&&frame>=1&&frame<=frameCount));
const postprocessFrames=process.argv.find(arg=>arg.startsWith('--postprocess-frames='))?.slice(21).split(',').map(Number);if(postprocessFrames)assert.ok(postprocessFrames.every(frame=>Number.isInteger(frame)&&frame>=1&&frame<=frameCount));
assert.match(name,/^[a-z0-9-]+$/);const directory=path.join(output,'native-frame-history-'+name);assert.equal(fs.existsSync(directory),false,'Preserve previous captures');fs.mkdirSync(directory,{recursive:true});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
const wait=async expression=>{for(let i=0;i<1500;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
 const source="if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-graphics-v1','detailed');"+'('+installNativeRandomizeClockObserver.toString()+')();('+installNativeStartupObserver.toString()+')(10000);('+installNativeSceneClockObserver.toString()+')();('+installNativeTimerDispatchObserver.toString()+')();('+installNativeBallPresentationObserver.toString()+')();('+installNativePostprocessObserver.toString()+')({highPrecisionDepth:true});'+(process.argv.includes('--texture-audit')?'('+installNativeTextureAuditObserver.toString()+')();':'')+'('+installNativeWholeFrameObserver.toString()+')('+JSON.stringify({fromInitialization:true,imagesOnly:true,frames:frameCount,captureFlasherGeometry:process.argv.includes('--flasher-geometry'),...postprocessFrames?{postprocessFrames}:{},...geometryFrames?{geometryFrames}:{},...tracePixel?{tracePixel}:{}})+');';
 await call('Page.addScriptToEvaluateOnNewDocument',{source});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');
 await evaluate(`(()=>{nativeBallPresentation.install();nativeRandomizeClocks.install();nativeBallPresentation.maxRecords=1024;nativeBallPresentation.armed=true;window.nativePlayerInputs=[];const engine=finni.engine,raw=engine.ccall;engine.ccall=function(...args){if(args[0]==='vpinball_wasm_eval_script')nativePlayerInputs.push({frameIndex:nativeStartup.frameIndex(),ms:nativeStartup.read()?.ms,script:args[3][0]});return raw.apply(this,args);};})()`);
 if(process.argv.includes('--texture-audit')){const layout=nativeTextureCacheLayout(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()));await evaluate('nativeTextureAudit.layout='+JSON.stringify(layout)+';nativeTextureAudit.getterFunctions=nativeTextureAudit.layout.indices');}
 await evaluate('document.getElementById("play").click()');
 const actions=[];
 if(launchControls){
  await wait('document.body.classList.contains("ball-in-plunger")');
  const key=async(code,down)=>{await call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.startsWith('Shift')?'Shift':code==='Enter'?'Enter':'x'});actions.push({code,down,...await evaluate('({ms:nativeStartup.read().ms,frameIndex:nativeStartup.frameIndex()})')});};
  for(const code of ['ShiftLeft','ShiftRight','Enter'])await key(code,true);
  await new Promise(resolve=>setTimeout(resolve,600));await key('Enter',false);await key('KeyX',true);await key('KeyX',false);
  await new Promise(resolve=>setTimeout(resolve,300));await key('ShiftLeft',false);await key('ShiftRight',false);
 }
 await wait('nativeWholeFrame.frames.length==='+frameCount+'||nativeWholeFrame.errors.length>0');
 if(process.argv.includes('--texture-audit')){await evaluate('Promise.all(nativeTextureAudit.pending)');await evaluate('nativeTextureAudit.textureObjects=nativeTextureAudit.inspectTextureHashes()');}
 const meta=await evaluate('({textureAudit:window.nativeTextureAudit?{layout:nativeTextureAudit.layout,uploads:nativeTextureAudit.uploads,textureObjects:nativeTextureAudit.textureObjects,bindings:nativeTextureAudit.bindings}:undefined,frames:nativeWholeFrame.frames.map(({images,...frame})=>({...frame,images:Object.fromEntries(Object.entries(images).map(([name,{bytes,...image}])=>[name,image]))})),clock:nativeSceneClock,timers:nativeTimerDispatch,startup:nativeStartup,randomizeClocks:nativeRandomizeClocks,playerInputs:nativePlayerInputs,presentation:{records:nativeBallPresentation.records,errors:nativeBallPresentation.errors,layout:nativeBallPresentation.layout},errors:nativeWholeFrame.errors})');
 assert.deepEqual(meta.errors,[]);assert.equal(meta.frames.length,frameCount);
 for(let i=0;i<meta.frames.length;i++){
  const frame=meta.frames[i];assert.deepEqual(frame.errors,[]);
  for(const [key,image]of Object.entries(frame.images)){
   const bytes=Buffer.from(await evaluate(`nativeWholeFrame.frames[${i}].images[${JSON.stringify(key)}].bytes`),'base64'),file=`frame-${i}-${key}.bin`;
   fs.writeFileSync(path.join(directory,file),bytes);image.file=file;image.sha256=createHash('sha256').update(bytes).digest('hex');
  }
 }
 const engine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());meta.engineSHA256=createHash('sha256').update(engine).digest('hex');assert.equal(meta.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 meta.clockABI=nativeFrameClockLayout(engine);meta.reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(meta.reference.sourceSha256,meta.reference.controlledSha256);assert.deepEqual(meta.reference.controlledOverrides,{});meta.errors=errors;
 meta.playerSource={};for(const file of ['app.js','views.js'])meta.playerSource[file]=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/'+file,base))).arrayBuffer())).digest('hex');
 assert.deepEqual(meta.frames.map(frame=>frame.frameIndex),Array.from({length:frameCount},(_,i)=>i+1),'No initialization frames omitted');meta.requestedFrames=frameCount;meta.actions=actions;
 if(launchControls){assert.ok(actions.every(action=>action.frameIndex<=frameCount),'Every ordinary input must occur inside the uninterrupted capture');assert.ok(meta.frames.some(frame=>frame.snapshot.balls.length>=4),'Normal Start creates the play ball');}
 meta.scope=frameCount+' consecutive native tonemapped frames, beginning with original initialization. Ordinary UI Start'+(launchControls?', launch, flipper and nudge keys':' only')+'. Original WASM/table/clocks/state/draws unchanged; image readback overhead is part of the observed timing. Outputs and prior images are expectations, never model inputs.';
 fs.writeFileSync(path.join(directory,'capture.json'),JSON.stringify(meta));
 console.log(JSON.stringify({directory,frames:meta.frames.map(frame=>({index:frame.frameIndex,ms:frame.snapshot?.ms,playing:frame.playing,canvas:frame.canvas,images:Object.keys(frame.images)})),errors}));assert.deepEqual(errors,[]);
}catch(error){fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:String(error),errors,observed:await evaluate('({errors:nativeWholeFrame?.errors,frames:nativeWholeFrame?.frames?.length,log:document.getElementById("log")?.textContent?.slice(-3000)})').catch(()=>null)}));throw error;}finally{socket.close();}
