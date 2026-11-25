// Original linear-resampler callbacks with controlled scratch input/output.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const[debug,base,output]=process.argv.slice(2),wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(wasm).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(!d.id)return;const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Native resampler wait: '+expression);};
try{
 await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const s=window.resamplerQA={memories:[],tables:[]};for(const name of ['instantiate','instantiateStreaming']){const original=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await original.apply(this,args),instance=result.instance??result;for(const v of Object.values(instance.exports??{})){if(v instanceof WebAssembly.Memory&&!s.memories.includes(v))s.memories.push(v);if(v instanceof WebAssembly.Table&&!s.tables.includes(v))s.tables.push(v);}return result;};}})()`});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');
 const result=await evaluate(`(()=>{
  const memory=resamplerQA.memories.find(m=>m.buffer.byteLength>7661272),table=resamplerQA.tables.find(t=>t.length>1000),words=new Uint32Array(memory.buffer),view=new DataView(memory.buffer),lengths=Array.from({length:table.length},(_,i)=>table.get(i)?.length),pattern=[3,4,3,6,4,2,2,4,4,2],matches=[];
  for(let at=1024;at<7661264-40;at+=4){if(pattern.every((n,i)=>{const slot=words[at/4+i];return slot>0&&slot<lengths.length&&lengths[slot]===n;}))matches.push(at);}
  if(matches.length!==1)return{error:'Unique original linear-resampler vtable required',matches};
  const vtable=matches[0],slots=Array.from(words.slice(vtable/4,vtable/4+10)),fns=slots.map(i=>table.get(i)),callbacks=fns.map((f,i)=>({slot:slots[i],index:Number(f.name),arguments:f.length})),cases=[];
  const scratch=finni.engine._SDL_malloc(24576);if(!scratch)throw Error('Scratch allocation failed');
  const config=scratch,counts=scratch+64,user=scratch+256,input=scratch+8192;
  // Allocate output separately; scratch includes config, wrapper and input.
  const output=finni.engine._SDL_malloc(2048*2*4);if(!output)throw Error('Output allocation failed');
  const random=Array.from(words.slice(7661264/4,7661264/4+2));
  try{for(const[inputRate,outputRate]of [[32000,48000],[32000,44100],[44100,48000],[48000,32000],[32000,32000],[32000,96000]])for(const channels of [1,2]){
   new Uint8Array(memory.buffer,scratch,8192).fill(0);const floats=new Float32Array(memory.buffer);view.setUint32(config,5,true);view.setUint32(config+4,channels,true);view.setUint32(config+8,inputRate,true);view.setUint32(config+12,outputRate,true);view.setUint32(config+28,0,true);
   if(fns[0](0,config,counts)!==0)throw Error('Native heap-size query failed');const heapBytes=view.getUint32(counts,true),heap=finni.engine._SDL_malloc(Math.max(heapBytes,16));
   try{if(fns[1](user,config,heap,counts+8)!==0)throw Error('Native resampler initialization failed');const backend=view.getUint32(counts+8,true);if(backend<user||backend>=user+4096)throw Error('Native wrapper ABI changed');
    const values=Array.from({length:1024*channels},(_,i)=>Math.fround(Math.sin(i*.137)*.4+.12345));floats.set(values,input/4);let consumed=0;const blocks=[];
    for(const capacity of [17,127,256,511]){view.setBigUint64(counts+16,BigInt(1024-consumed),true);view.setBigUint64(counts+24,BigInt(capacity),true);if(fns[3](user,backend,input+consumed*channels*4,counts+16,output,counts+24)!==0)throw Error('Native resampler process failed');const inputFrames=Number(view.getBigUint64(counts+16,true)),outputFrames=Number(view.getBigUint64(counts+24,true));blocks.push({capacity,inputFrames,outputFrames,pcm:Array.from(floats.slice(output/4,output/4+outputFrames*channels))});consumed+=inputFrames;}
    cases.push({inputRate,outputRate,channels,lpfOrder:0,input:values,blocks});fns[2](user,backend,0);
   }finally{finni.engine._SDL_free(heap);}
  }if(random.some((v,i)=>v!==words[7661264/4+i]))throw Error('Native component changed physics RNG');return{vtable,callbacks,cases,unchangedPhysicsRNG:true};
  }finally{finni.engine._SDL_free(output);finni.engine._SDL_free(scratch);}
 })()`);assert.equal(result.error,undefined,JSON.stringify(result));assert.equal(result.cases.length,12);const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();fs.writeFileSync(output+'/native-audio-resampler.json',JSON.stringify({engineSHA256,sourceTableSHA256:reference.sourceSha256,scope:'Original compiled linear-resampler backend, zero low-pass order as used by VPX engine pitch resampling. Controlled source samples and scratch configuration/state; no original sound, clock, body or RNG state restored. This isolates resampling, not complete engine playback timing.',...result},null,2),{flag:'wx'});console.log(JSON.stringify({cases:result.cases.length,callbacks:result.callbacks,unchangedPhysicsRNG:result.unchangedPhysicsRNG}));
}finally{socket.close();}
