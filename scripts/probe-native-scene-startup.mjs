import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from 'node:crypto';
import{installNativeStartupObserver}from './native-startup-observer.mjs';
import{installNativeSceneClockObserver}from './native-scene-clock-observer.mjs';
import{nativeFrameClockLayout}from './native-frame-clock-layout.mjs';
const [debug,base,output]=process.argv.slice(2),name=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??'native-scene-startup-r1.json',file=output+'/'+name;
assert.match(name,/^[a-z0-9.-]+\.json$/i);assert.equal(fs.existsSync(file),false,'Preserve earlier observations');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let i=0;i<900;i++){if(await evaluate('document.body.classList.contains("engine-error")'))throw Error('Native engine failed');if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timed out '+expression);};
const native=code=>evaluate('finni.evaluate('+JSON.stringify(code)+')');
const specs=JSON.parse(fs.readFileSync('three/public/objects.json')).objects;
const fields={Light:['Visible','State','Color','ColorFull','Intensity','IntensityScale','BlinkInterval','BlinkPattern','GetInPlayIntensity','GetInPlayStateBool'],Primitive:['Visible','RotX','RotY','RotZ'],Flasher:['Visible','ImageA','ImageB','Color','Opacity','Height'],HitTarget:['Visible','IsDropped']};
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeStartupObserver.toString()+')(2000);('+installNativeSceneClockObserver.toString()+')();'});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('nativeStartup.done');
 await call('Emulation.setFocusEmulationEnabled',{enabled:false});
 await evaluate('document.getElementById("controls-panel").showPopover();document.querySelector("#controls-panel button").focus();window.dispatchEvent(new Event("blur"))');
 const before=await evaluate('nativeStartup.read()');await evaluate('(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame)})()');const after=await evaluate('nativeStartup.read()');assert.equal(before.ms,after.ms,'Normal focus loss pauses native physics before readback');
 await evaluate('nativeSceneClock.armed=false');
 const clock=await evaluate('nativeSceneClock'),startup=await evaluate('(()=>{const {read,...data}=nativeStartup;return data})()');
 const requested=specs.filter(spec=>fields[spec.kind]).flatMap(spec=>fields[spec.kind].map(field=>({name:spec.name,kind:spec.kind,field}))),lines=new Set();
 await native('Dim SceneObj,SceneValue,SceneText:On Error Resume Next');
 for(let offset=0;offset<requested.length;offset+=8){
  const code=['On Error Resume Next'];
  for(const {name,field}of requested.slice(offset,offset+8)){
   const text=['ImageA','ImageB','BlinkPattern'].includes(field)||['Visible','IsDropped','GetInPlayStateBool'].includes(field)?'CStr(SceneValue)':'FormatNumber(SceneValue,12,-1,0,0)';
   code.push('Err.Clear','Set SceneObj=GetElementByName("'+name+'")','SceneValue=SceneObj.'+field,'SceneText='+text,'If Err.Number=0 Then Debug.Print "SCENE_PROP|'+name+'|'+field+'|" & SceneText Else Debug.Print "SCENE_MISSING|'+name+'|'+field+'|" & Err.Description');
  }
  await native(code.join('\n'));
  for(const line of(await evaluate('document.getElementById("log").textContent')).split(/\r?\n/))if(/SCENE_(PROP|MISSING)\|/.test(line))lines.add(line.slice(line.indexOf('SCENE_')));
 }
 const engine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(engine).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(reference.sourceSha256,reference.controlledSha256);assert.deepEqual(reference.controlledOverrides,{});
 const clockABI=nativeFrameClockLayout(engine),browserAppSHA256=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/app.js',base))).arrayBuffer())).digest('hex');
 const result={reference,engineSHA256,browserAppSHA256,clockABI,startup,clock,freeze:{before,after},requested,lines:[...lines],errors,scope:'Ordinary native Start from the unmodified authored table and original WASM initializer. Read-only physical and RAF/first-draw clock observations. Normal Controls/focus-loss input pauses the scene for property readback; timers, sequences, lamps, poses, random state and clock returns are never replaced. This is scene-state evidence, not uninterrupted pixel parity.'};
 fs.writeFileSync(file,JSON.stringify(result));assert.deepEqual(errors,[]);assert.deepEqual(clock.errors,[]);assert.deepEqual(startup.errors,[]);assert.equal(lines.size,requested.length);assert.ok(clock.frames.length>0);console.log(JSON.stringify({file,ms:after.ms,frames:clock.frames.length,properties:lines.size,missing:[...lines].filter(line=>line.startsWith('SCENE_MISSING')).length}));
}catch(error){let observed;try{observed=await evaluate('({clock:nativeSceneClock,startup:{records:nativeStartup.records.length,done:nativeStartup.done,errors:nativeStartup.errors},log:document.getElementById("log")?.textContent?.slice(-2000)})');}catch{}fs.writeFileSync(file+'.partial',JSON.stringify({error:String(error),observed,errors}));throw error;}finally{socket.close();}
