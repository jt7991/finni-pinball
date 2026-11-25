// Isolated calls to the original HitBall vtable on scratch copies. Allocation
// order is deliberately varied; no live ball, physics clock or RNG is restored.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{installNativeStartupObserver}from'./native-startup-observer.mjs';
const[debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1800;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Native ball identity wait: '+expression);};
// An oblique encounter from the long second-round investigation. These are
// declared component inputs, not a substituted state in a full-game replay.
const inputs=[
 {p:[540.0999755859375,1698.6160888671875,25.005931854248047],v:[5.241272449493408,-7.171041011810303,0.0000016391277313232422]},
 {p:[502.62554931640625,1664.804443359375,25.014907836914062],v:[2.363985061645508,18.868452072143555,-0.0000013262033462524414]},
];
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+installNativeStartupObserver.toString()+')(1);'+`(()=>{const s=window.nativeBallIdentityQA={memories:[],tables:[]};for(const name of ['instantiate','instantiateStreaming']){const raw=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await raw.apply(this,args);for(const v of Object.values((result.instance??result).exports)){if(v instanceof WebAssembly.Memory&&!s.memories.includes(v))s.memories.push(v);if(v instanceof WebAssembly.Table&&!s.tables.includes(v))s.tables.push(v);}return result;};}})();`});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("playing")&&nativeStartup.read()?.balls.length>=3');
 const observed=await evaluate(`(()=>{
  const memory=nativeBallIdentityQA.memories.find(m=>m.buffer.byteLength>9191332),table=nativeBallIdentityQA.tables.find(t=>t.length>1000),live=nativeStartup.read();if(!memory||!table||live.balls.length<3)throw Error('Original ball ABI unavailable');
  const scratch=finni.engine._SDL_malloc(2048);if(!scratch)throw Error('Scratch allocation failed');
  try{
   const view=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer),template=live.balls[0].address,vtable=view.getUint32(template,true),callback=offset=>table.get(view.getUint32(vtable+offset,true)),hit=callback(8),type=callback(12),collide=callback(16);
   if(type(template)!==9||hit.length!==4||collide.length!==2||view.getUint32(template+72,true)!==template||view.getUint32(template+124,true)!==template||view.getFloat32(template+152,true)!==25)throw Error('HitBall ABI validation failed');
   const physics=view.getUint32(live.player+333740,true),swapped=!!view.getUint8(physics+84),vector=at=>[0,4,8].map(n=>view.getFloat32(at+n,true)),wordState=()=>[view.getUint32(7661264,true),view.getUint32(7661268,true)],rows=[];
   const setVector=(at,values)=>values.forEach((value,i)=>view.setFloat32(at+i*4,value,true)),inputs=${JSON.stringify(inputs)};
   for(const reverse of [false,true]){
    const addresses=reverse?[scratch+512,scratch+64]:[scratch+64,scratch+512];
    for(const[i,address]of addresses.entries()){
     bytes.copyWithin(address,template,template+384);view.setUint32(address+72,address,true);view.setUint32(address+124,address,true);setVector(address+128,inputs[i].p);setVector(address+140,inputs[i].v);view.setUint8(address+164,0);view.setFloat32(address+156,1,true);view.setFloat32(address+84,0,true);
    }
    const queries=addresses.map((address,i)=>{const other=addresses[1-i],time=hit(other,address+128,Math.fround(.1),address+72);if(!(time>=0&&time<=Math.fround(.1)))throw Error('Declared encounter did not hit');view.setUint32(address+76,other,true);view.setFloat32(address+80,time,true);return{time,gap:view.getFloat32(address+84,true),normal:vector(address+88)};});
    if(queries[0].time!==queries[1].time)throw Error('Reciprocal encounter times differ');
    const time=queries[0].time;
    addresses.forEach((address,i)=>setVector(address+128,inputs[i].p.map((p,n)=>Math.fround(p+Math.fround(inputs[i].v[n]*time)))));
    const randomBefore=wordState();for(const[i,address]of addresses.entries())collide(addresses[1-i],address+72);
    rows.push({name:reverse?'a-higher-address':'a-lower-address',addresses,swapped,queries,outputs:addresses.map(address=>({p:vector(address+128),v:vector(address+140)})),randomBefore,randomAfter:wordState()});
   }
   return{abi:{vtable,hitTest:Number(hit.name),collide:Number(collide.name),ballState:128,collision:72,normal:88},rows};
  }finally{finni.engine._SDL_free(scratch);}
 })()`);
 const reference=await(await fetch(new URL('/reference-metadata.json',base))).json(),engine=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer());assert.deepEqual(errors,[]);
 const fixture={scope:'Isolated original HitBall::HitTest and Collide calls on two allocated scratch copies with declared inputs. The two cases reverse their actual address order. Live balls and clocks are untouched; the original impact callback may emit sound and advance sound RNG. This is a component observation, not uninterrupted gameplay.',reference,engineSHA256:createHash('sha256').update(engine).digest('hex'),inputs,...observed,errors};assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 fs.writeFileSync(output+'/native-ball-identity.json',JSON.stringify(fixture,null,2),{flag:'wx'});console.log(JSON.stringify({cases:observed.rows.length,abi:observed.abi,velocities:observed.rows.map(row=>row.outputs.map(ball=>ball.v))}));
}catch(error){const observed=await evaluate('({classes:document.body.className,play:document.getElementById("play")?.textContent,loading:document.getElementById("loading")?.textContent,log:document.getElementById("log")?.textContent.slice(-6000),startupErrors:nativeStartup?.errors})');fs.writeFileSync(output+'/native-ball-identity-failure.json',JSON.stringify({error:String(error),errors,observed},null,2),{flag:'wx'});throw error;}finally{socket.close();}
