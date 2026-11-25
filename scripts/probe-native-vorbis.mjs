// Isolated original decoder inspection, not an uninterrupted gameplay capture.
// Decode a stopped SoundPlayer through its original ma_decoder vtable while
// SDL is suspended. No native body/RNG/clock values are restored or replaced.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readOggVorbis} from './music-packets.mjs';
const[debug,base,output]=process.argv.slice(2),manifest=JSON.parse(fs.readFileSync('three/public/audio.json')),option=n=>process.argv.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3),names=(option('sounds')??'mu_beserkerrage,mu_juggernaut').split(',');
const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(wasm).digest('hex');assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error('Native Vorbis wait: '+expression);},execute=statement=>evaluate('finni.evaluate('+JSON.stringify(statement)+')');
const wave=process.argv.includes('--wave');
const rows=[];
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const s=window.nativeVorbisQA={memories:[],tables:[],contexts:[]};for(const name of ['instantiate','instantiateStreaming']){const original=WebAssembly[name];WebAssembly[name]=async function(...args){const result=await original.apply(this,args),instance=result.instance??result;for(const v of Object.values(instance.exports??{})){if(v instanceof WebAssembly.Memory&&!s.memories.includes(v))s.memories.push(v);if(v instanceof WebAssembly.Table&&!s.tables.includes(v))s.tables.push(v);}return result;};}const create=AudioContext.prototype.createScriptProcessor;AudioContext.prototype.createScriptProcessor=function(...args){if(!s.contexts.includes(this))s.contexts.push(this);return create.apply(this,args);};})()`});
 await call('Page.navigate',{url:base});await wait('!!window.finni&&document.getElementById("play")?.textContent==="Start game"');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');await evaluate('Promise.all(nativeVorbisQA.contexts.map(c=>c.resume()))');await execute('RollingTimer.Enabled=False:DMDFlush');
 const all=Object.keys(manifest);for(let i=0;i<all.length;i+=40)await execute(all.slice(i,i+40).map(n=>'StopSound "'+n+'"').join(':'));
 for(const name of names){
  const source=fs.readFileSync('.work/main-99eff88-assets/sounds/'+name+(wave?'.wav':'.ogg'));assert.equal(createHash('sha256').update(source).digest('hex'),manifest[name].sourceSHA256);const info=wave?{sampleRate:manifest[name].sampleRate,channels:manifest[name].outputTarget==='backglass'?2:1,granuleFrames:manifest[name].frames}:readOggVorbis(source);
  await execute('PlaySound "'+name+'",0,0.0001369,0.03125,0,0,1,1');await new Promise(r=>setTimeout(r,220));await execute('StopSound "'+name+'"');await new Promise(r=>setTimeout(r,220));await evaluate('Promise.all(nativeVorbisQA.contexts.map(c=>c.suspend()))');
  const result=await evaluate(`(async()=>{
   const memory=nativeVorbisQA.memories.find(m=>m.buffer.byteLength>7661272),table=nativeVorbisQA.tables.find(t=>t.length>1000),words=new Uint32Array(memory.buffer),view=new DataView(memory.buffer),candidates=[],scratch=finni.engine._SDL_malloc(64),sourceRate=${info.sampleRate},sourceChannels=${info.channels};
   if(!scratch||!table)throw Error('Native inspection ABI unavailable');
   const callback=(vtable,index)=>{const slot=view.getUint32(vtable+index*4,true);return slot>0&&slot<table.length?table.get(slot):null;};
   try{
    for(let i=0;i<words.length-3;i++)if((words[i]===5||words[i]===2)&&words[i+1]===sourceChannels&&words[i+2]===sourceRate){
     for(const[kind,offset]of [['decoder',96],['vorbis',88]]){
      const ds=i*4-offset;if(ds<0||ds%8||view.getUint32(ds+16,true)!==0xffffffff||view.getUint32(ds+20,true)!==0xffffffff)continue;
      const vtable=view.getUint32(ds,true);if(!vtable||vtable%4||vtable+28>=memory.buffer.byteLength)continue;
      const funcs=Array.from({length:5},(_,n)=>callback(vtable,n));if(funcs.some((f,n)=>!f||f.length!==[4,2,6,2,2][n]))continue;
      if(funcs[2](ds,scratch,scratch+4,scratch+8,0,0)!==0)continue;
      if(![2,5].includes(view.getUint32(scratch,true))||view.getUint32(scratch+4,true)!==sourceChannels||view.getUint32(scratch+8,true)!==sourceRate)continue;
      view.setBigUint64(scratch+24,0n,true);view.setBigUint64(scratch+32,0n,true);const lengthStatus=funcs[4](ds,scratch+24),cursorStatus=funcs[3](ds,scratch+32);
      candidates.push({kind,ds,vtable,format:words[i],lengthStatus,cursorStatus,length:Number(view.getBigUint64(scratch+24,true)),cursor:Number(view.getBigUint64(scratch+32,true)),callbacks:funcs.map(f=>({index:Number(f.name),arguments:f.length}))});
     }
    }
    const matches=candidates.filter(c=>c.kind==='decoder'&&c.length===${info.granuleFrames});if(!matches.length)return{candidates,error:'No original decoder with source length'};
    const chosen=matches[0];if(callback(chosen.vtable,1)(chosen.ds,0n)!==0)throw Error('Original decoder seek-to-start failed');callback(chosen.vtable,3)(chosen.ds,scratch+32);if(view.getBigUint64(scratch+32,true)!==0n)throw Error('Native seek did not reset cursor');const backendVtable=view.getUint32(chosen.ds+60,true),backendCallbacks=Array.from({length:5},(_,i)=>{const index=view.getUint32(backendVtable+i*4,true),f=index>0&&index<table.length?table.get(index):null;return{slot:index,index:f?Number(f.name):null,arguments:f?.length};}),allocator={mallocName:finni.engine._SDL_malloc.name,freeName:finni.engine._SDL_free.name};const read=callback(chosen.vtable,0),capacity=chosen.length+8192,bytes=new Uint8Array(capacity*sourceChannels*4),pcm=finni.engine._SDL_malloc(4096*sourceChannels*4),random=Array.from(words.slice(7661264/4,7661264/4+2));let frames=0,lastStatus=0;const readBlocks=[];
    if(!pcm)throw Error('Native PCM scratch allocation failed');
    try{
     for(;;){view.setBigUint64(scratch+40,0n,true);lastStatus=read(chosen.ds,pcm,2048n,scratch+40);const count=Number(view.getBigUint64(scratch+40,true));if(count>4096||frames+count>capacity)throw Error('Native frame count outside expected bounds');if(lastStatus!==0&&lastStatus!==-17)throw Error('Native decode status '+lastStatus);readBlocks.push({count,status:lastStatus});if(chosen.format===2){const f32=new Float32Array(bytes.buffer);for(let i=0;i<count*sourceChannels;i++)f32[frames*sourceChannels+i]=view.getInt16(pcm+i*2,true)/32768;}else bytes.set(new Uint8Array(memory.buffer,pcm,count*sourceChannels*4),frames*sourceChannels*4);frames+=count;if(!count)break;}
     if(random.some((v,i)=>v!==words[7661264/4+i]))throw Error('Native audio inspection changed physics RNG');
     const data=bytes.subarray(0,frames*sourceChannels*4),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
     return{chosen,backendVtable,backendCallbacks,allocator,candidates,frames,channels:sourceChannels,sampleRate:sourceRate,bytes:data.length,pcmSHA256:sha256,lastStatus,readBlocks,unchangedPhysicsRNG:true};
    }finally{finni.engine._SDL_free(pcm);}
   }finally{finni.engine._SDL_free(scratch);}
  })()`);rows.push({name,sourceSHA256:manifest[name].sourceSHA256,sourceGranuleFrames:info.granuleFrames,...result});console.log(JSON.stringify({...rows.at(-1),candidates:result.candidates?.length,readBlocks:result.readBlocks?.slice(-5)}));assert.equal(result.error,undefined);await evaluate('Promise.all(nativeVorbisQA.contexts.map(c=>c.resume()))');
 }
 const reference=await(await fetch(new URL('/reference-metadata.json',base))).json();assert.deepEqual(errors,[]);fs.writeFileSync(output+'/native-vorbis.json',JSON.stringify({engineSHA256,sourceTableSHA256:reference.sourceSha256,scope:'Original compiled decoder callbacks, reached through validated ma_decoder vtables of explicitly played/stopped native sound players. SDL audio is suspended for complete source-rate decoding. An explicit original decoder seek establishes sample zero and its cursor is consumed by inspection; this is an isolated codec observation, not uninterrupted playback or game-state parity. No native body, clock or RNG values are replaced.',rows,errors},null,2),{flag:'wx'});
}catch(error){fs.writeFileSync(output+'/native-vorbis-failure.json',JSON.stringify({error:String(error),rows,errors},null,2),{flag:'wx'});throw error;}finally{socket.close();}
