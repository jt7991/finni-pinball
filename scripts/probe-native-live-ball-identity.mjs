// Original HitBall calls on normally created native balls. The observer never
// writes WASM memory, assigns addresses, or restores a recorded outcome.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{installNativeStartupObserver}from'./native-startup-observer.mjs';
const[debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1800;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Native live identity wait: '+expression);};
const inputs=[
 {p:[540.0999755859375,1698.6160888671875,25.005931854248047],v:[5.241272449493408,-7.171041011810303,0.0000016391277313232422]},
 {p:[502.62554931640625,1664.804443359375,25.014907836914062],v:[2.363985061645508,18.868452072143555,-0.0000013262033462524414]},
];
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeStartupObserver.toString()+')(1);'+`(()=>{const q=window.nativeLiveIdentityQA={memories:[],tables:[],scripts:[],rows:[]};for(const name of ['instantiate','instantiateStreaming']){const raw=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await raw.apply(this,args);for(const value of Object.values((result.instance??result).exports)){if(value instanceof WebAssembly.Memory&&!q.memories.includes(value))q.memories.push(value);if(value instanceof WebAssembly.Table&&!q.tables.includes(value))q.tables.push(value);}return result;};}})();`});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await call('Emulation.setFocusEmulationEnabled',{enabled:false});await evaluate('document.getElementById("controls-panel").showPopover();document.querySelector("#controls-panel button").focus();window.dispatchEvent(new Event("blur"))');
 const before=await evaluate('nativeStartup.read()');await evaluate('(async()=>{for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);})()');const paused=await evaluate('nativeStartup.read()');assert.equal(paused.ms,before.ms,'Normal native focus loss must pause before declared component inputs');
 const observed=await evaluate(`(()=>{
  const q=nativeLiveIdentityQA,memory=q.memories.find(m=>m.buffer.byteLength>9191332),table=q.tables.find(t=>t.length>1000);if(!memory||!table)throw Error('Original native memory/table unavailable');
  const view=()=>new DataView(memory.buffer),vector=(v,at)=>[0,4,8].map(i=>v.getFloat32(at+i,true)),exec=script=>{q.scripts.push({ms:nativeStartup.read().ms,script});if(finni.evaluate(script)!==1)throw Error('Declared native input failed');};
  const initial=nativeStartup.read(),inputs=${JSON.stringify(inputs)};exec('Dim RefIdentityA,RefIdentityB');
  for(let index=0;index<12;index++){
   const known=new Set(nativeStartup.read().balls.map(b=>b.id));exec('Set RefIdentityA=HellHouse.CreateBall:HellHouse.Kick 0,0:Set RefIdentityB=HellHouse.CreateBall:HellHouse.Kick 0,0');
   const created=nativeStartup.read().balls.filter(b=>!known.has(b.id));if(created.length!==2||created.some(b=>b.locked))throw Error('Normal CreateBall/Kick did not create two free native balls');
   exec(inputs.flatMap((input,i)=>{const name=i?'RefIdentityB':'RefIdentityA';return ['X','Y','Z'].map((axis,j)=>name+'.'+axis+'='+input.p[j]).concat(['VelX','VelY','VelZ'].map((axis,j)=>name+'.'+axis+'='+input.v[j]),['AngMomX','AngMomY','AngMomZ'].map(axis=>name+'.'+axis+'=0'));}).join(':'));
   const v=view(),addresses=created.map(b=>b.address),vtable=v.getUint32(addresses[0],true),hit=table.get(v.getUint32(vtable+8,true)),collide=table.get(v.getUint32(vtable+16,true)),getType=table.get(v.getUint32(vtable+12,true));
   if(Number(hit.name)!==4455||Number(collide.name)!==4456)throw Error('Original HitBall ABI differs');
   for(const [i,address]of addresses.entries()){if(getType(address)!==9||v.getUint32(address+72,true)!==address||v.getUint32(address+124,true)!==address||v.getFloat32(address+152,true)!==25||v.getFloat32(address+156,true)!==1||v.getUint8(address+164)!==0)throw Error('Normal live ball ABI differs');if(vector(v,address+128).some((n,j)=>n!==inputs[i].p[j])||vector(v,address+140).some((n,j)=>n!==inputs[i].v[j]))throw Error('Declared live input differs');}
   const queries=addresses.map((address,i)=>{const time=hit(addresses[1-i],address+128,Math.fround(.1),address+72);if(!(time>=0&&time<=Math.fround(.1)))throw Error('Declared encounter did not hit');return{time,gap:v.getFloat32(address+84,true),normal:vector(v,address+88)};});if(queries[0].time!==queries[1].time)throw Error('Reciprocal native times differ');
   exec(inputs.flatMap((input,i)=>['X','Y','Z'].map((axis,j)=>(i?'RefIdentityB':'RefIdentityA')+'.'+axis+'='+Math.fround(input.p[j]+Math.fround(input.v[j]*queries[0].time)))).join(':'));
   const physics=v.getUint32(initial.player+333740,true),swapped=!!v.getUint8(physics+84),states=()=>addresses.map(address=>({p:vector(v,address+128),v:vector(v,address+140)})),stages=[states()];
   for(const [i,address]of addresses.entries()){collide(addresses[1-i],address+72);stages.push(states());}
   const snapshot=nativeStartup.read();if(snapshot.ms!==initial.ms)throw Error('Paused native physics clock advanced');
   q.rows.push({index,ids:created.map(b=>b.id),addresses,swapped,queries,stages,outputs:states()});
  }
  return{initial,after:nativeStartup.read(),scripts:q.scripts,rows:q.rows,abi:{hitTest:4455,collide:4456,ballState:128,collision:72,normal:88},observerMemoryWrites:0};
 })()`);
 assert.deepEqual(errors,[]);assert.equal(observed.rows.length,12);assert.equal(observed.initial.ms,observed.after.ms);
 for(const original of observed.initial.balls){const after=observed.after.balls.find(b=>b.id===original.id);assert.deepEqual(after,original,'Unrelated native balls remain unchanged');}
 const engine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(engine).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();
 const fixture={engineSHA256,reference,inputs,...observed,errors,scope:'Twelve normally created native live-ball pairs under unchanged original functions. Normal UI focus loss pauses physics; declared VBS component inputs set pose/velocity and move to the solved contact. The observer performs no WASM memory writes, address assignment or outcome restoration. Original HitTest/Collide mutate only the created component balls. This is component/allocator evidence, not uninterrupted gameplay.'};
 fs.writeFileSync(output+'/native-live-ball-identity.json',JSON.stringify(fixture,null,2),{flag:'wx'});console.log(JSON.stringify({pairs:observed.rows.length,orders:observed.rows.map(r=>Math.sign(r.addresses[0]-r.addresses[1])),velocities:observed.rows.map(r=>r.outputs.map(b=>b.v)),errors}));
}catch(error){fs.writeFileSync(output+'/native-live-ball-identity-failure.json',JSON.stringify({error:String(error),errors,observed:await evaluate('({classes:document.body.className,log:document.getElementById("log")?.textContent.slice(-6000),rows:window.nativeLiveIdentityQA?.rows,scripts:window.nativeLiveIdentityQA?.scripts})')},null,2),{flag:'wx'});throw error;}finally{socket.close();}
