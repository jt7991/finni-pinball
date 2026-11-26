// Original compiled HitBall calls on normally created, independently sized
// native balls. Public VBS inputs are the only ball-state writes.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash}from'node:crypto';
import {installNativeStartupObserver}from'./native-startup-observer.mjs';
import {ballParameterScenarios}from'./ball-parameter-scenarios.mjs';
const [debug,base,output]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex'),scenarios=ballParameterScenarios();
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
async function wait(expression){for(let i=0;i<1800;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Native ball-parameter wait: '+expression);}
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeStartupObserver.toString()+')(1,{ballRadii:[12.5,25,37.5,17.25],maximumBalls:256});'+`(()=>{const q=window.nativeBallParameterQA={memories:[],tables:[],scripts:[],rows:[]};for(const name of ['instantiate','instantiateStreaming']){const raw=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await raw.apply(this,args);for(const value of Object.values((result.instance??result).exports)){if(value instanceof WebAssembly.Memory&&!q.memories.includes(value))q.memories.push(value);if(value instanceof WebAssembly.Table&&!q.tables.includes(value))q.tables.push(value);}return result;};}})();`});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await call('Emulation.setFocusEmulationEnabled',{enabled:false});await evaluate('document.getElementById("controls-panel").showPopover();document.querySelector("#controls-panel button").focus();window.dispatchEvent(new Event("blur"))');
 const before=await evaluate('nativeStartup.read()');await evaluate('(async()=>{for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);})()');assert.equal((await evaluate('nativeStartup.read()')).ms,before.ms);
 const observed=await evaluate(`(()=>{
  const q=nativeBallParameterQA,memory=q.memories.find(m=>m.buffer.byteLength>9191332),table=q.tables.find(t=>t.length>1000);if(!memory||!table)throw Error('Original native memory/table unavailable');
  const view=()=>new DataView(memory.buffer),vector=(v,at)=>[0,4,8].map(i=>v.getFloat32(at+i,true)),exec=script=>{q.scripts.push({ms:nativeStartup.read().ms,script});if(finni.evaluate(script)!==1)throw Error('Declared native input failed');};
  const initial=nativeStartup.read(),scenarios=${JSON.stringify(scenarios)};exec('Dim RefParamA,RefParamB');
  for(const scenario of scenarios){
   const known=new Set(nativeStartup.read().balls.map(b=>b.id));
   exec(scenario.balls.map((b,i)=>'Set '+(i?'RefParamB':'RefParamA')+'=HellHouse.'+b.method+(b.method==='CreateBall'?'':'('+[b.createRadius??b.radius,...b.method==='CreateSizedBallWithMass'?[b.createMass??b.mass]:[]].join(',')+')')+':HellHouse.Kick 0,0').join(':'));
   const created=nativeStartup.read().balls.filter(b=>!known.has(b.id));if(created.length!==2||created.some(b=>b.locked))throw Error('Normal kicker creation did not produce two free balls');
   const creation=created.map(b=>{const v=view();return{radius:v.getFloat32(b.address+152,true),mass:v.getFloat32(b.address+156,true),p:vector(v,b.address+128),v:vector(v,b.address+140),locked:b.locked};});
   exec(scenario.balls.flatMap((b,i)=>{const name=i?'RefParamB':'RefParamA';return ['Radius='+b.radius,'Mass='+b.mass,...['X','Y','Z'].map((axis,j)=>axis+'='+b.p[j]),...['VelX','VelY','VelZ'].map((axis,j)=>axis+'='+b.v[j]),...['AngMomX','AngMomY','AngMomZ'].map((axis,j)=>axis+'='+b.momentum[j])].map(s=>name+'.'+s);}).join(':'));
   const v=view(),addresses=created.map(b=>b.address),vtable=v.getUint32(addresses[0],true),hit=table.get(v.getUint32(vtable+8,true)),collide=table.get(v.getUint32(vtable+16,true));
   if(Number(hit.name)!==4455||Number(collide.name)!==4456)throw Error('Original HitBall ABI differs');
   const inputs=addresses.map(address=>({radius:v.getFloat32(address+152,true),mass:v.getFloat32(address+156,true),p:vector(v,address+128),v:vector(v,address+140)}));
   for(const [i,input]of inputs.entries())if(input.radius!==Math.fround(scenario.balls[i].radius)||input.mass!==Math.fround(scenario.balls[i].mass)||input.p.some((x,j)=>x!==scenario.balls[i].p[j])||input.v.some((x,j)=>x!==scenario.balls[i].v[j]))throw Error('Declared input differs');
   exec('Debug.Print "BALL_PARAMETER_ANGULAR|" & CDbl(RefParamA.AngVelX) & "|" & CDbl(RefParamA.AngVelY) & "|" & CDbl(RefParamA.AngVelZ) & "|" & CDbl(RefParamB.AngVelX) & "|" & CDbl(RefParamB.AngVelY) & "|" & CDbl(RefParamB.AngVelZ) & "|" & VarType(RefParamA.Radius) & "|" & VarType(RefParamA.Mass) & "|" & VarType(RefParamB.Radius) & "|" & VarType(RefParamB.Mass)');
   const text=document.getElementById('log').textContent,at=text.lastIndexOf('BALL_PARAMETER_ANGULAR|'),line=text.slice(at+'BALL_PARAMETER_ANGULAR|'.length).split(String.fromCharCode(10))[0].split(String.fromCharCode(13))[0].split("'")[0].trim(),values=line.split('|').map(Number),angular=values.slice(0,6),types=values.slice(6);if(values.length!==10||values.some(x=>!Number.isFinite(x)))throw Error('Invalid angular observation');
   const queries=addresses.map((address,i)=>{const time=hit(addresses[1-i],address+128,Math.fround(scenario.duration),address+72);return{time,...time>=0?{gap:v.getFloat32(address+84,true),normal:vector(v,address+88)}:{}};});
   const physics=v.getUint32(initial.player+333740,true),swapped=!!v.getUint8(physics+84),states=()=>addresses.map(address=>({p:vector(view(),address+128),v:vector(view(),address+140)}));
   const stages=[];if(queries.every(h=>h.time>=0)){
    if(queries[0].time!==queries[1].time)throw Error('Reciprocal hit times differ');
    exec(scenario.balls.flatMap((b,i)=>['X','Y','Z'].map((axis,j)=>(i?'RefParamB':'RefParamA')+'.'+axis+'='+Math.fround(b.p[j]+Math.fround(b.v[j]*queries[0].time)))).join(':'));
    stages.push(states());for(const [i,address]of addresses.entries()){collide(addresses[1-i],address+72);stages.push(states());}
   }
   if(nativeStartup.read().ms!==initial.ms)throw Error('Paused native physics clock advanced');
   q.rows.push({index:scenario.index,ids:created.map(b=>b.id),addresses,creation,inputs,angular,types,swapped,queries,stages});
  }
  return{initial,after:nativeStartup.read(),scripts:q.scripts,rows:q.rows,abi:{hitTest:4455,collide:4456,ballState:128,collision:72,normal:88},observerMemoryWrites:0};
 })()`);
 assert.deepEqual(errors,[]);assert.equal(observed.rows.length,scenarios.length);assert.equal(observed.initial.ms,observed.after.ms);
 for(const ball of observed.initial.balls)assert.deepEqual(observed.after.balls.find(b=>b.id===ball.id),ball);
 const engineSHA256=sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()));assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.equal(reference.sourceSha256,reference.controlledSha256);assert.deepEqual(reference.controlledOverrides,{});
 const fixture={engineSHA256,reference,scenarios,scenarioSHA256:sha(fs.readFileSync(new URL('./ball-parameter-scenarios.mjs',import.meta.url))),probeSHA256:sha(fs.readFileSync(new URL(import.meta.url))),...observed,errors,scope:'Public CreateSizedBallWithMass and Ball setters declare mass/radius/pose/velocity/momentum inputs for normally allocated live balls. Original HitBall functions perform each query and reciprocal collision. Normal UI focus loss pauses physics. No observer WASM memory writes, allocator assignment, body/RNG restoration or recorded output rescue. Unrelated native bodies remain unchanged. This is isolated API/physics coverage, not natural shot reachability.'};
 fs.writeFileSync(output+'/native-ball-parameters.json',JSON.stringify(fixture,null,2),{flag:'wx'});console.log(JSON.stringify({cases:observed.rows.length,hits:observed.rows.filter(r=>r.stages.length).length,errors}));
}catch(error){fs.writeFileSync(output+'/native-ball-parameters-failure.json',JSON.stringify({error:String(error),errors,observed:await evaluate('({rows:window.nativeBallParameterQA?.rows,log:document.getElementById("log")?.textContent.slice(-3000)})')},null,2),{flag:'wx'});throw error;}finally{socket.close();}
