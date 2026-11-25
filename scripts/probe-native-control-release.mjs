// Original player UI events and read-only plunger observations. No body,
// mechanism, clock, random state or compiled instruction is replaced.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installNativeStartupObserver} from './native-startup-observer.mjs';
import {nativePlungerMemoryObserver} from './native-plunger-memory-observer.mjs';
const [debug,base,output]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
const reference=await(await fetch(new URL('/reference-metadata.json',base))).json(),engineSHA256=sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()));
const playerResponse=await fetch(new URL('/app.js',base));assert.equal(playerResponse.status,200);const playerSHA256=sha(Buffer.from(await playerResponse.arrayBuffer()));
assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(reference.controlledSha256,reference.sourceSha256);assert.deepEqual(reference.controlledOverrides,{});
const spec=JSON.parse(fs.readFileSync('three/public/layout.json')).items.find(i=>i.kind==='Plunger');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Native release wait '+expression);};
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("finni-graphics-v1","detailed");('+installNativeStartupObserver.toString()+')(1);'+`window.releaseMemories=[];for(const name of ['instantiate','instantiateStreaming']){const original=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await original.apply(this,args);for(const value of Object.values((result.instance??result).exports))if(value instanceof WebAssembly.Memory)releaseMemories.push(value);return result;};}`});
  await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  const identity=await evaluate(`(()=>{const memory=releaseMemories.find(m=>m.buffer.byteLength>9191332);window.releaseRod=(${nativePlungerMemoryObserver.toString()})(memory,${JSON.stringify(spec)});return releaseRod.scan();})()`);
  await evaluate('document.getElementById("canvas").focus()');await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await wait('releaseRod.read().pullForce>0');await new Promise(r=>setTimeout(r,500));
  const rows=await evaluate(`(()=>{const before={rod:releaseRod.read(),state:nativeStartup.read()};window.dispatchEvent(new Event('blur'));const released={rod:releaseRod.read(),state:nativeStartup.read()};window.dispatchEvent(new Event('blur'));const repeated={rod:releaseRod.read(),state:nativeStartup.read()};return{before,released,repeated};})()`);
  assert.ok(rows.before.rod.pullForce>0);assert.equal(rows.released.rod.pullForce,0);assert.equal(rows.released.rod.fireTimer,200);assert.ok(rows.released.rod.fireSpeed<0);assert.equal(rows.released.rod.pos,rows.before.rod.pos);assert.equal(rows.released.state.ms,rows.before.state.ms);assert.deepEqual(rows.repeated.rod,rows.released.rod);assert.deepEqual(errors,[]);
  const report={scope:'Original current-master player receives a physical Enter key-down through CDP, then its ordinary blur handler releases the held key. Read-only native ABI observations before and after the synchronous UI events show the authored Fire command. No native state/clock/RNG correction or direct rule/mechanism call is used. This finite UI-event probe does not certify a complete trajectory.',engineSHA256,playerSHA256,reference,spec,identity,rows,errors};fs.writeFileSync(path.join(output,'native-control-release.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({before:rows.before.rod,released:rows.released.rod,repeatUnchanged:true,errors}));
}catch(error){
  const state=await evaluate('({play:document.getElementById("play")?.textContent,disabled:document.getElementById("play")?.disabled,loading:document.getElementById("loading")?.textContent,log:document.getElementById("log")?.textContent?.slice(-3000),memories:window.releaseMemories?.length})').catch(e=>({observationError:String(e)}));
  fs.writeFileSync(path.join(output,'native-control-release-failure.json'),JSON.stringify({error:String(error),state,errors},null,2),{flag:'wx'});throw error;
}finally{socket.close();}
