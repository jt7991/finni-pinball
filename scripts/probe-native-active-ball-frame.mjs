// Isolated unchanged native animation call with read-only ActiveBall observers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {installNativeMechanismPoseObserver} from './native-mechanism-pose-observer.mjs';
const [debug,base,output]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
const metadata=await(await fetch(new URL('/reference-metadata.json',base))).json(),source=JSON.parse(fs.readFileSync('three/public/source-table.json','utf8'));
assert.equal(metadata.sourceSha256,source.sourceTableSHA256);assert.equal(sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())),source.engineSHA256);
const spec=JSON.parse(fs.readFileSync('three/public/native-table/native-table.json')).parts.find(p=>p.spec.name==='Bumper1').spec;
const instrumentation=`Dim FrameActiveBefore,FrameActiveInside,FrameActiveAfter,FrameActiveCalls
FrameActiveCalls=0
Sub Bumper1_Animate()
 FrameActiveInside=ActiveBall.ID
 FrameActiveCalls=FrameActiveCalls+1
End Sub`;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Native frame ActiveBall wait '+expression);};
const execute=statement=>evaluate('finni.evaluate('+JSON.stringify(statement)+')');
async function read(stage){await execute('Debug.Print "FRAME_ACTIVE_QA|'+stage+'|" & GameTime & "|" & CStr(ActiveBall.ID) & "|" & CStr(FrameActiveBefore) & "|" & CStr(FrameActiveInside) & "|" & CStr(FrameActiveAfter) & "|" & CStr(FrameActiveCalls)');return evaluate(`(()=>{const text=document.getElementById('log').textContent,marker=${JSON.stringify('FRAME_ACTIVE_QA|'+stage+'|')},at=text.lastIndexOf(marker);if(at<0)throw Error('Missing frame observation');const v=text.slice(at+marker.length).split(String.fromCharCode(10))[0].split(String.fromCharCode(13))[0].split("'")[0].trim().split('|').map(x=>x===''?null:Number(x));return{ms:v[0],active:v[1],before:v[2],inside:v[3],after:v[4],calls:v[5]};})()`);}
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeMechanismPoseObserver.toString()+')();('+function(){window.activeFrameTables=[];for(const name of ['instantiate','instantiateStreaming']){const original=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await original.apply(this,args);for(const item of Object.values((result.instance??result).exports))if(item instanceof WebAssembly.Table&&!activeFrameTables.includes(item))activeFrameTables.push(item);return result;};}}.toString()+')();'});
  await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  await call('Emulation.setFocusEmulationEnabled',{enabled:false});await evaluate('document.getElementById("controls-panel").showPopover();document.querySelector("#controls-panel button").focus();window.dispatchEvent(new Event("blur"))');
  await execute(instrumentation);const frozen=await read('frozen');await evaluate('(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);})()');const freezeAfter=await read('freeze-after');assert.equal(frozen.ms,freezeAfter.ms);
  const pose=await evaluate('nativeMechanismPoses.snapshot('+JSON.stringify([spec])+')');assert.deepEqual(pose.errors,[]);
  await evaluate('(()=>{if(activeFrameTables.length!==1)throw Error("One native table required");const table=activeFrameTables[0];for(let i=0;i<table.length;i++){const fn=table.get(i);if(fn?.name==="2568"){window.activeFrameUpdate=ms=>fn('+pose.latest.Bumper1.object+',ms);return;}}throw Error("Original animation function missing");})()');
  await evaluate('activeFrameUpdate(2000);activeFrameUpdate(2000)');await execute('FrameActiveCalls=0:FrameActiveInside=-1:FrameActiveAfter=-1:FrameActiveBefore=ActiveBall.ID');const before=await read('before');
  await execute('Bumper1.PlayHit');await evaluate('activeFrameUpdate(16)');await execute('FrameActiveAfter=ActiveBall.ID');const after=await read('after');
  const report={scope:'Isolated original Bumper1.UpdateAnimation component, function 2568 in the pinned engine. Ordinary Start reaches the shooter lane; browser focus pauses physical GameTime. Two 2000ms updates settle the original startup animation, then public PlayHit and a 16ms native update invoke a read-only Bumper1_Animate observer. No ball/global ActiveBall value, body, RNG, expected animation state or timer deadline is supplied. This is component evidence, not an uninterrupted gameplay reference.',metadata,engineBytesVerified:true,probeSHA256:sha(fs.readFileSync(new URL(import.meta.url))),spec,instrumentation,freeze:{before:frozen,after:freezeAfter},before,after,errors};
  fs.writeFileSync(output+'/active-ball-frame.json',JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({before,after,errors}));assert.deepEqual(errors,[]);assert.equal(after.ms,before.ms);assert.ok(after.calls>0);assert.equal(after.active,before.active);assert.equal(after.inside,before.active);assert.equal(after.after,before.active);
}finally{socket.close();}
