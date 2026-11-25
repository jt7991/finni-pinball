import fs from 'node:fs';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {nativeSoundMix} from '../three/native-sound-mix.js';
const [debug,base,output]=process.argv.slice(2),tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
const restart=JSON.parse(gunzipSync(fs.readFileSync('three/tests/fixtures/vpx-main-music-restarts-native.json.gz'))).observations[0],nonzero=block=>block.pcm.some(c=>c.some(x=>x!==0)),stopAt=restart.restart.initial.filter(nonzero).length;
await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(!d.id)return;const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Page.navigate',{url:new URL('audio.json',base).href});
 const r=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,userGesture:true,expression:`(async()=>{
  const {createNativeMusicPlayer}=await import('/three/native-music-player.js'),manifest=await(await fetch('/three/audio.json')).json(),context=new AudioContext({sampleRate:48000}),create=context.createScriptProcessor.bind(context),gain=context.createGain.bind(context),nodes=[],gains=[],errors=[];let playerRef;
  context.createGain=()=>{const node=gain();gains.push(node);return node;};
  context.createScriptProcessor=(...args)=>{const node=create(...args),record={args,frames:[],callbacks:0,disconnects:0};nodes.push(record);const disconnect=node.disconnect.bind(node);node.disconnect=(...args)=>{record.disconnects++;return disconnect(...args);};let callback;Object.defineProperty(node,'onaudioprocess',{set(value){callback=value;node.addEventListener('audioprocess',event=>{if(callback!==value||!value)return;value(event);record.callbacks++;if(record.frames.length<8)record.frames.push(Array.from({length:event.outputBuffer.numberOfChannels},(_,c)=>[...event.outputBuffer.getChannelData(c)]));if(record===nodes[0]&&record.callbacks===${stopAt})playerRef.stop('mu_discoloops');});},get(){return callback;}});return node;};
  const player=createNativeMusicPlayer(context,'/three/',{onError:error=>errors.push(error.message)}),wait=async condition=>{for(let i=0;i<600;i++){if(condition())return;await new Promise(r=>setTimeout(r,10));}throw Error('Music callback wait timed out');};
  playerRef=player;try{
   await context.suspend();await player.prepare();const prepared={state:context.state,nodes:nodes.length};await context.resume();
   await player.play('mu_discoloops',manifest.mu_discoloops,{loop:-1,volume:.04,pan:0});await wait(()=>nodes[0]?.callbacks>=8);
   const beforeMute=nodes[0].callbacks;player.setMuted(true);const mutedGains=gains.map(n=>n.gain.value);await wait(()=>nodes[0].callbacks>=beforeMute+3);const duringMute=nodes[0].callbacks;player.setMuted(false);const resumedGains=gains.map(n=>n.gain.value);
   await wait(()=>nodes[0].callbacks===${stopAt});await player.play('mu_discoloops',manifest.mu_discoloops,{loop:-1,volume:.04,pan:0});await wait(()=>nodes[1]?.callbacks>=8);
   // Named aliases share compressed bytes, but each song starts at sample zero.
   const aliases=Object.keys(manifest).filter(n=>manifest[n].music&&manifest[n].nativeSource.file===manifest.mu_juggernaut.nativeSource.file);
   await player.play(aliases[0],manifest[aliases[0]],{loop:-1,volume:.04});await wait(()=>nodes[2]?.callbacks>=2);
   await player.play(aliases[1],manifest[aliases[1]],{loop:-1,volume:.04});await wait(()=>nodes[3]?.callbacks>=2);
   const beforeStop=nodes[3].callbacks;player.stop(aliases[0]);await wait(()=>nodes[3].callbacks>=beforeStop+2);player.stop(aliases[1]);
   const stopped=nodes[3].callbacks;await new Promise(r=>setTimeout(r,150));
   return{prepared,rate:context.sampleRate,nodes,mutedGains,resumedGains,beforeMute,duringMute,stopped,afterStop:nodes[3].callbacks,aliases,errors};
  }finally{player.dispose();await context.close();}
 })()`});
 assert.equal(r.exceptionDetails,undefined,JSON.stringify(r.exceptionDetails));const result=r.result.value;
 assert.deepEqual(result.prepared,{state:'suspended',nodes:0});assert.deepEqual(result.errors,[]);assert.equal(result.rate,48000);assert.equal(result.nodes.length,4);assert.equal(result.afterStop,result.stopped);assert.ok(result.duringMute>result.beforeMute);assert.equal(result.nodes[0].callbacks,stopAt);
 assert.deepEqual(result.mutedGains,[1,0,0]);assert.deepEqual(result.resumedGains,[1,Math.fround(.4),Math.fround(.4)]);
 for(const node of result.nodes){assert.deepEqual(node.args,[2048,0,2]);assert.ok(node.disconnects>=1);}
 const native=JSON.parse(gunzipSync(fs.readFileSync('three/tests/fixtures/vpx-main-music-loop-native.json.gz'))),mix=nativeSoundMix({outputTarget:'backglass'},{volume:.04});
 for(let b=0;b<4;b++)for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(Math.fround(result.nodes[0].frames[b][c][i]*(c?mix.right:mix.left)),native.frames[b].pcm[c][i],'Original native callback '+b+' channel '+c+' frame '+i);
 const expectedRestart=restart.restart.restarted.filter(nonzero);for(let b=0;b<8;b++)for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(Math.fround(result.nodes[1].frames[b][c][i]*(c?mix.right:mix.left)),expectedRestart[b].pcm[c][i],'Native retained restart callback '+b+' channel '+c+' frame '+i);
 for(let b=0;b<2;b++)assert.deepEqual(result.nodes[2].frames[b],result.nodes[3].frames[b],'A distinct named alias rewinds instead of reusing prior playback position');
 fs.writeFileSync(output+'/native-music-browser.json',JSON.stringify({scope:'Actual separate worker, source decoding, bounded producer and real ScriptProcessor callbacks at 48kHz. First four callbacks compared bit-for-bit to original native SDL capture after native gain. Name ownership, mute continuity and stop verified. No physical phone certification.',base,...result},null,2),{flag:'wx'});
 console.log(JSON.stringify({prepared:result.prepared,nodes:result.nodes.map(n=>({callbacks:n.callbacks,disconnects:n.disconnects})),nativeCallbackFramesChecked:8192,nativeRestartFramesChecked:16384,aliases:result.aliases,mutedClockContinues:true,errors:result.errors}));
}finally{socket.close();}
