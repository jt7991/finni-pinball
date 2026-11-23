// Read original native PCM after its SDL callback and native mix-node fields.
// No native sound inputs, audio buffers, clock values or RNG results replaced.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2);
const filename=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??'native-audio-mix-observation.json';
assert.match(filename,/^[a-z0-9.-]+\.json$/i);assert.equal(fs.existsSync(output+'/'+filename),false,'Preserve earlier independent audio observations');
const component=process.argv.includes('--mix-component');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map();
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(!message.id)return;const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression,userGesture=false)=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let i=0;i<1000;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out '+expression);};
const stopNames=Object.keys(JSON.parse(fs.readFileSync('three/public/audio.json')));
try{
 const wasm=Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()),engineSHA256=createHash('sha256').update(wasm).digest('hex');
 assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 let componentFunction;
 if(component){
  const imports=WebAssembly.Module.imports(new WebAssembly.Module(wasm)).filter(item=>item.kind==='function').length;
  let p=8,body;const u=()=>{let n=0,s=0,b;do{b=wasm[p++];n+=(b&127)*2**s;s+=7;}while(b&128);return n;};
  while(p<wasm.length){const section=wasm[p++],size=u(),end=p+size;if(section===10){const count=u();for(let i=0;i<count;i++){const size=u();if(i+imports===869)body=wasm.subarray(p,p+size);p+=size;}break;}p=end;}
  assert.ok(body);const sha256=createHash('sha256').update(body).digest('hex');assert.equal(sha256,'8b5683243e118376664f31c1f458f5caf27c9d71080462ff7dc3c43702f96b2a');
  componentFunction={index:869,sha256,volumeOffset:256,modeOffset:268,scope:'Original vpx_node_process_pcm_frames. Five pointer arguments and native node/bus fields validated before invocation. Inputs/outputs occupy separately allocated diagnostic scratch memory. Existing native node data and both MWC64X words remain unchanged.'};
 }
 await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.audioMixObservation={nodes:[],contexts:[],memories:[],tables:[],armed:false,frames:[]};
  for(const method of ['instantiate','instantiateStreaming']){
   const original=WebAssembly[method];WebAssembly[method]=async function(...args){const result=await original.apply(this,args),instance=result.instance??result;for(const value of Object.values(instance.exports??{})){if(value instanceof WebAssembly.Memory&&!audioMixObservation.memories.includes(value))audioMixObservation.memories.push(value);if(value instanceof WebAssembly.Table&&!audioMixObservation.tables.includes(value))audioMixObservation.tables.push(value);}return result;};
  }
  const create=AudioContext.prototype.createScriptProcessor;
  AudioContext.prototype.createScriptProcessor=function(...args){const node=create.apply(this,args),id=audioMixObservation.nodes.length;audioMixObservation.nodes.push({id,args,rate:this.sampleRate});
   if(!audioMixObservation.contexts.includes(this))audioMixObservation.contexts.push(this);
   const descriptor=Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype,'onaudioprocess');let callback;
   Object.defineProperty(node,'onaudioprocess',{get(){return callback;},set(value){callback=value;descriptor.set.call(node,value?function(event){const result=value.call(this,event);
    if(audioMixObservation.armed&&audioMixObservation.frames.length<16){
    const channels=Array.from({length:event.outputBuffer.numberOfChannels},(_,i)=>Array.from(event.outputBuffer.getChannelData(i)));
    audioMixObservation.frames.push({id,channels});
    }return result;}:value);}});return node;
  };
 `});
 await call('Page.navigate',{url:base});await wait('!!window.finni && !document.getElementById("play").disabled');await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
 await evaluate('Promise.all(audioMixObservation.contexts.map(context=>context.resume()))',true);
 await evaluate('finni.evaluate("RollingTimer.Enabled=False:DMDFlush")');
 for(let i=0;i<stopNames.length;i+=40)await evaluate('finni.evaluate('+JSON.stringify(stopNames.slice(i,i+40).map(name=>'StopSound "'+name+'"').join(':'))+')');
 const results=[];
 for(const [name,target]of [['fx_ballrolling3','playfield'],['fx_enter','backglass']]){
  for(const [volume,pan]of [[.37,.03125],[.37,-.03125],[.37,0],[.37,1],[.37,-1],[.09,.03125]]){
   await evaluate('finni.evaluate('+JSON.stringify(`PlaySound "${name}",-1,${volume},${pan},0,0,1,0,-.125`)+')');
   await new Promise(resolve=>setTimeout(resolve,200));
   const observed=await evaluate(`(()=>{
    const memory=audioMixObservation.memories.find(m=>m.buffer.byteLength>7661272),data=new Float32Array(memory.buffer),words=new Uint32Array(memory.buffer),matches=[];
    const expectedVolume=Math.fround(Math.sqrt(Math.fround(${volume})))*${target==='backglass'?2:1},expectedPan=Math.fround(Math.sign(${pan})*Math.pow(Math.abs(Math.fround(${pan})),Math.fround(.1)));
    for(let i=0;i<data.length-4;i++)if(Math.abs(data[i]-expectedVolume)<.000002&&Math.abs(data[i+1]-expectedPan)<.000002&&words[i+3]===${target==='backglass'?2:0})matches.push({address:i*4,volume:data[i],pan:data[i+1],fade:data[i+2],mode:words[i+3]});
    let component;
    if(${component}){
     if(matches.length!==1)throw Error('Unique native mix node required');
     const view=new DataView(memory.buffer),node=matches[0].address-256,inputBus=view.getUint32(node+16,true),outputBus=view.getUint32(node+20,true),inputChannels=view.getUint8(inputBus+48),outputChannels=view.getUint8(outputBus+5);
     if(view.getUint32(node+8,true)!==1||view.getUint32(node+12,true)!==1||inputChannels!==${target==='backglass'?2:1}||outputChannels!==2)throw Error('Compiled mixer node/bus ABI did not validate');
     const table=audioMixObservation.tables.find(table=>{for(let i=0;i<table.length;i++)if(table.get(i)?.name==='869')return true;return false;});
     if(!table)throw Error('Pinned original compiled callback not found');
     let callbackIndex=-1;for(let i=0;i<table.length;i++)if(table.get(i)?.name==='869')callbackIndex=i;
     const callback=table.get(callbackIndex);if(callback.length!==5)throw Error('Compiled callback signature changed');
     const count=256,size=32+count*(inputChannels+outputChannels)*4,scratch=finni.engine._SDL_malloc(size);if(!scratch)throw Error('Native scratch allocation failed');
     try{
      const input=scratch+32,out=input+count*inputChannels*4,floats=new Float32Array(memory.buffer),words=new Uint32Array(memory.buffer);
      for(let i=0;i<count;i++){floats[input/4+i*inputChannels]=Math.fround(Math.sin(i*.13)*.4);if(inputChannels===2)floats[input/4+i*inputChannels+1]=Math.fround(Math.cos(i*.19)*.25);}
      words[scratch/4]=input;words[scratch/4+1]=count;words[scratch/4+2]=out;words[scratch/4+3]=count;
      const before=new Uint8Array(memory.buffer).slice(node,node+272),random=Array.from(words.slice(7661264/4,7661264/4+2));
      callback(node,scratch,scratch+4,scratch+8,scratch+12);
      const unchangedNode=before.every((v,i)=>v===new Uint8Array(memory.buffer)[node+i]),unchangedRNG=random.every((v,i)=>v===words[7661264/4+i]);
      if(!unchangedNode||!unchangedRNG)throw Error('Component invocation changed native node or RNG');
      component={node,callbackIndex,functionIndex:869,inputChannels,outputChannels,inputs:Array.from(floats.slice(input/4,input/4+count*inputChannels)),output:Array.from(floats.slice(out/4,out/4+count*outputChannels)),unchangedNode,unchangedRNG};
     }finally{finni.engine._SDL_free(scratch);}
    }
    audioMixObservation.frames=[];audioMixObservation.armed=true;return{matches,tables:audioMixObservation.tables.map(table=>table.length),component};
   })()`);
   await wait('audioMixObservation.frames.length>=8');
   observed.frames=await evaluate('audioMixObservation.armed=false;audioMixObservation.frames');
   const row={name,target,volume,pan,...observed};results.push(row);
   fs.writeFileSync(output+'/'+filename,JSON.stringify({results}));console.log(JSON.stringify({...row,component:row.component?{...row.component,inputs:row.component.inputs.length,output:row.component.output.length}:undefined,frames:row.frames.map(frame=>({id:frame.id,channels:frame.channels.map(channel=>({count:channel.length,peak:Math.max(...channel.map(Math.abs))}))}))}));
  }
  await evaluate('finni.evaluate('+JSON.stringify(`StopSound "${name}"`)+')');
 }
 const reference=await(await fetch(new URL('/reference-metadata.json',base))).json(),nodes=await evaluate('audioMixObservation.nodes');
 fs.writeFileSync(output+'/'+filename,JSON.stringify({engineSHA256,sourceSha256:reference.sourceSha256,componentFunction,nodes,results,scope:'Original VPX table/engine, explicit diagnostic PlaySound calls after stopping other sounds and the rolling timer. Source PCM remains untouched. PCM read after original SDL callback; native mix-node parameters read from unchanged WASM memory. Optional direct original compiled mixer invocation uses controlled scratch inputs/outputs and leaves existing node/RNG state unchanged. Whole-device PCM may contain other table sounds; only the direct component output is isolated expected PCM. This does not establish source decoding/startup or uninterrupted audio parity.'}));
}catch(error){
 fs.writeFileSync(output+'/'+filename+'.failure',JSON.stringify({error:String(error),state:await evaluate('({body:document.body.className,log:document.getElementById("log")?.textContent.slice(-6000),nodes:audioMixObservation?.nodes,contexts:audioMixObservation?.contexts.map(context=>context.state)})')},null,2));throw error;
}finally{socket.close();}
