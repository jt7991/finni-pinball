// Original native frames beginning with the first tonemap. Readbacks preserve
// all native clocks, state and rendering; their cost remains part of the run.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{installNativeStartupObserver}from './native-startup-observer.mjs';
import{installNativeSceneClockObserver}from './native-scene-clock-observer.mjs';
import{installNativeTimerDispatchObserver}from './native-timer-dispatch-observer.mjs';
import{installNativePostprocessObserver}from './native-postprocess-observer.mjs';
import{installNativeWholeFrameObserver}from './native-whole-frame-observer.mjs';
import{nativeFrameClockLayout}from './native-frame-clock-layout.mjs';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--capture-name='))?.slice(15)??'initial-history-r1';
assert.match(name,/^[a-z0-9-]+$/);const directory=path.join(output,'native-frame-history-'+name);assert.equal(fs.existsSync(directory),false,'Preserve previous captures');fs.mkdirSync(directory,{recursive:true});
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
const wait=async expression=>{for(let i=0;i<1500;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out '+expression);};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
 const source="if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('finni-graphics-v1','detailed');"+'('+installNativeStartupObserver.toString()+')(10000);('+installNativeSceneClockObserver.toString()+')();('+installNativeTimerDispatchObserver.toString()+')();('+installNativePostprocessObserver.toString()+')({highPrecisionDepth:true});('+installNativeWholeFrameObserver.toString()+')({fromInitialization:true,imagesOnly:true,frames:6});';
 await call('Page.addScriptToEvaluateOnNewDocument',{source});await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('nativeWholeFrame.frames.length===6||nativeWholeFrame.errors.length>0');
 const meta=await evaluate('({frames:nativeWholeFrame.frames.map(({images,...frame})=>({...frame,images:Object.fromEntries(Object.entries(images).map(([name,{bytes,...image}])=>[name,image]))})),clock:nativeSceneClock,timers:nativeTimerDispatch,errors:nativeWholeFrame.errors})');
 assert.deepEqual(meta.errors,[]);assert.equal(meta.frames.length,6);
 for(let i=0;i<meta.frames.length;i++){
  const frame=meta.frames[i];assert.deepEqual(frame.errors,[]);
  for(const [key,image]of Object.entries(frame.images)){
   const bytes=Buffer.from(await evaluate(`nativeWholeFrame.frames[${i}].images[${JSON.stringify(key)}].bytes`),'base64'),file=`frame-${i}-${key}.bin`;
   fs.writeFileSync(path.join(directory,file),bytes);image.file=file;image.sha256=createHash('sha256').update(bytes).digest('hex');
  }
 }
 const engine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());meta.engineSHA256=createHash('sha256').update(engine).digest('hex');assert.equal(meta.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 meta.clockABI=nativeFrameClockLayout(engine);meta.reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(meta.reference.sourceSha256,meta.reference.controlledSha256);assert.deepEqual(meta.reference.controlledOverrides,{});meta.errors=errors;
 assert.deepEqual(meta.frames.map(frame=>frame.frameIndex),[1,2,3,4,5,6],'No initialization frames omitted');
 meta.scope='Six consecutive native tonemapped frames, beginning with original initialization. Ordinary UI Start only. Original WASM/table/clocks/state/draws unchanged; image readback overhead is part of the observed timing. Outputs and prior images are expectations, never model inputs.';
 fs.writeFileSync(path.join(directory,'capture.json'),JSON.stringify(meta));
 console.log(JSON.stringify({directory,frames:meta.frames.map(frame=>({index:frame.frameIndex,ms:frame.snapshot?.ms,playing:frame.playing,canvas:frame.canvas,images:Object.keys(frame.images)})),errors}));assert.deepEqual(errors,[]);
}catch(error){fs.writeFileSync(path.join(directory,'failure.json'),JSON.stringify({error:String(error),errors,observed:await evaluate('({errors:nativeWholeFrame?.errors,frames:nativeWholeFrame?.frames?.length,log:document.getElementById("log")?.textContent?.slice(-3000)})').catch(()=>null)}));throw error;}finally{socket.close();}
