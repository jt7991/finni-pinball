// Exercise the actual WebAudio decoder, source completion and cancellation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(debug+'/json/list')).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map();
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(!data.id)return;const request=pending.get(data.id);pending.delete(data.id);data.error?request.reject(Error(data.error.message)):request.resolve(data.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Page.navigate',{url:new URL('audio.json',base).href});
 const {result,exceptionDetails}=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,userGesture:true,expression:`(async()=>{
  const {createAudio}=await import('/three/media.js');
  const OriginalContext=window.AudioContext,originalFetch=window.fetch,sources=[],contexts=[];
  const wav=new ArrayBuffer(8044),v=new DataView(wav),label=(at,text)=>{for(let i=0;i<text.length;i++)v.setUint8(at+i,text.charCodeAt(i));};
  label(0,'RIFF');v.setUint32(4,8036,true);label(8,'WAVE');label(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);label(36,'data');v.setUint32(40,8000,true);
  for(let i=0;i<4000;i++)v.setInt16(44+i*2,Math.round(Math.sin(i*Math.PI*.1)*1000),true);
  window.AudioContext=class extends OriginalContext{constructor(){super();contexts.push(this);const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const source=create(),start=source.start.bind(source),stop=source.stop.bind(source),record={source,starts:0,stops:0};sources.push(record);source.start=(...args)=>{record.starts++;return start(...args);};source.stop=(...args)=>{record.stops++;return stop(...args);};return source;};}};
  window.fetch=(url,...args)=>String(url)==='/three/audio/native-player-test.wav'?Promise.resolve(new Response(wav,{headers:{'Content-Type':'audio/wav'}})):originalFetch(url,...args);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),audio=createAudio({effect:{file:'native-player-test.wav',sampleRate:8000}},'/three/');
  try{
   await audio.unlock();
   await Promise.all([audio.play('effect',{useExisting:true}),audio.play('effect',{useExisting:true,pitch:4000})]);
   const pendingReuse={sources:sources.length,starts:sources[0].starts,rate:sources[0].source.playbackRate.value,decodedRate:sources[0].source.buffer.sampleRate};
   await audio.play('effect',{useExisting:true,pitch:0});const liveReuse={sources:sources.length,rate:sources[0].source.playbackRate.value};
   await audio.play('effect');await audio.play('effect');
   const overlap=sources.length;await audio.play('effect',{restart:true});
   const restart={sources:sources.length,previousStops:sources.slice(0,-1).map(row=>row.stops),newStarts:sources.at(-1).starts};audio.stop();
   let at=sources.length;await audio.play('effect',{loop:3});
   for(let i=0;i<100&&sources.length<at+3;i++)await wait(25);
   await wait(600);const finite={sources:sources.length-at,loopFlags:sources.slice(at).map(row=>row.source.loop)};
   at=sources.length;await audio.play('effect',{loop:3});audio.stop('effect');await wait(600);const stoppedRepeat=sources.length-at;
   return{contextState:contexts[0].state,pendingReuse,liveReuse,overlap,restart,finite,stoppedRepeat};
  }finally{audio.stop();await Promise.all(contexts.map(context=>context.close()));window.AudioContext=OriginalContext;window.fetch=originalFetch;}
 })()`});
 assert.equal(exceptionDetails,undefined,JSON.stringify(exceptionDetails));
 const r=result.value;fs.writeFileSync(output+'/native-audio-players-browser.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));
 assert.equal(r.contextState,'running');assert.equal(r.pendingReuse.sources,1);assert.equal(r.pendingReuse.starts,1);assert.equal(r.pendingReuse.rate,1.5);
 assert.equal(r.liveReuse.sources,1);assert.equal(r.liveReuse.rate,1);assert.equal(r.overlap,3);
 assert.deepEqual(r.restart,{sources:4,previousStops:[1,1,1],newStarts:1});assert.deepEqual(r.finite,{sources:3,loopFlags:[false,false,false]});assert.equal(r.stoppedRepeat,1);
}finally{socket.close();}
