// Explicit isolated event component, not a whole-game fidelity reference.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{installNativeMechanismPoseObserver}from'./native-mechanism-pose-observer.mjs';
const[debug,base,output]=process.argv.slice(2),spec=JSON.parse(fs.readFileSync('three/public/native-table/native-table.json')).parts.find(p=>p.spec.name==='Bumper1').spec;
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const row=JSON.parse(event.data);if(row.id){const p=pending.get(row.id);pending.delete(row.id);row.error?p.reject(Error(row.error.message)):p.resolve(row.result);}if(row.method==='Runtime.exceptionThrown')errors.push(row.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Native bumper component wait '+expression);};
const execute=statement=>evaluate('finni.evaluate('+JSON.stringify(statement)+')');
const read=async()=>{await execute('Debug.Print "BUMPER_EVENT_COUNT|" & GameTime & "|" & FinniRefBumperAnimCount');return evaluate('(()=>{const row=Array.from(document.getElementById("log").textContent.matchAll(/BUMPER_EVENT_COUNT\\|(\\d+)\\|(\\d+)/g)).at(-1);return{ms:Number(row[1]),count:Number(row[2])};})()');};
const rows=[];
try{
 const engineSHA256=createHash('sha256').update(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer())).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:230,height:480,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeMechanismPoseObserver.toString()+')();('+function(){
  window.nativeBumperEventTables=[];for(const method of['instantiate','instantiateStreaming']){const raw=WebAssembly[method];WebAssembly[method]=async function(...args){const result=await raw.apply(this,args);for(const v of Object.values((result.instance??result).exports))if(v instanceof WebAssembly.Table&&!nativeBumperEventTables.includes(v))nativeBumperEventTables.push(v);return result;};}
 }.toString()+')();'});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&!document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await call('Emulation.setFocusEmulationEnabled',{enabled:false});await evaluate('document.getElementById("controls-panel").showPopover();document.querySelector("#controls-panel button").focus();window.dispatchEvent(new Event("blur"))');
 await execute('Dim FinniRefBumperAnimCount\nFinniRefBumperAnimCount=0\nSub Bumper1_Animate()\nFinniRefBumperAnimCount=FinniRefBumperAnimCount+1\nEnd Sub');
 const before=await read();await evaluate('(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);})()');const after=await read();assert.equal(after.ms,before.ms,'Original physical engine is actually paused');
 const pose=await evaluate('nativeMechanismPoses.snapshot('+JSON.stringify([spec])+')');assert.deepEqual(pose.errors,[]);
 await evaluate('(()=>{if(nativeBumperEventTables.length!==1)throw Error("One native table required");const table=nativeBumperEventTables[0];for(let i=0;i<table.length;i++){const fn=table.get(i);if(fn?.name==="2568"){window.nativeBumperComponentUpdate=ms=>fn('+pose.latest.Bumper1.object+',ms);return;}}throw Error("Original UpdateAnimation function is unavailable");})()');
 // Settle the existing startup animation, then independently test idle frames.
 await evaluate('nativeBumperComponentUpdate(2000);nativeBumperComponentUpdate(2000)');await execute('FinniRefBumperAnimCount=0');rows.push({kind:'settled',...await read()});
 for(const ms of[16,33,1000]){await evaluate('nativeBumperComponentUpdate('+ms+')');rows.push({kind:'idle',delta:ms,...await read()});assert.equal(rows.at(-1).count,0,'Idle native bumpers do not fire Animate');}
 await execute('Bumper1.PlayHit');
 for(const ms of[16,100,100,100,100]){await evaluate('nativeBumperComponentUpdate('+ms+')');rows.push({kind:'hit-update',delta:ms,...await read()});}
 assert.ok(rows.some(row=>row.count>0),'A moving native bumper must reach the instrumented handler');assert.ok(rows.every(row=>row.ms===before.ms),'Controlled component calls do not advance physics');assert.deepEqual(errors,[]);
 const result={scope:'Isolated original-engine event component. Declared added Bumper1_Animate counter, PlayHit and direct unchanged native UpdateAnimation calls execute while native GameTime remains paused. This modifies the component and is not a clean whole-game fidelity reference.',engineSHA256,functionIndex:2568,spec,rows,freeze:{before,after},errors};fs.writeFileSync(output+'/native-bumper-events.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({rows,errors}));
}catch(error){fs.writeFileSync(output+'/native-bumper-events-failure.json',JSON.stringify({error:String(error),rows,errors},null,2),{flag:'wx'});throw error;}finally{socket.close();}
