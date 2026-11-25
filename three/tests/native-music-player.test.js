import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeMusicPlayer} from '../native-music-player.js';import {createMusicDecoderHost} from '../music-decoder-host.js';import {createNativeVorbisCodec} from '../native-vorbis.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url))),short=manifest.mu_beserkerrage,source=fs.readFileSync(new URL('../public/'+short.nativeSource.file,import.meta.url)),wasm=fs.readFileSync(new URL('../public/native-audio/vorbis.wasm',import.meta.url));
const settle=()=>new Promise(r=>setImmediate(r));

test('bounded playback ignores stale loads and stops, cancels pending starts, retries errors and releases output',async()=>{
 const originalWorker=globalThis.Worker,originalLocation=globalThis.location,requests=[],responses=[],workers=[],errors=[],held=new Map();let codec;
 class FakeWorker extends EventTarget{
  constructor(){super();workers.push(this);this.host=createMusicDecoderHost(data=>{responses.push(data);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data})));},{loadCodec:async()=>codec??=await createNativeVorbisCodec(wasm),loadSource:async url=>{if(url.includes('held')){const p=Promise.withResolvers();held.set(url,p);return p.promise;}if(url.includes('fail'))throw Error('Declared HTTP 503');return source;}});}
  postMessage(message){requests.push(message);void this.host.receive(message);}
  terminate(){this.terminated=true;void this.host.receive({type:'dispose'});}
 }
 globalThis.Worker=FakeWorker;globalThis.location={href:'http://test/three/'};
 const node=()=>({gain:{value:1},connect(){},disconnect(){this.disconnected=true;}}),outputs=[],context={sampleRate:48000,destination:{maxChannelCount:2},createGain:node,createChannelSplitter:node,createChannelMerger:node,createScriptProcessor(...args){const n={...node(),args};outputs.push(n);return n;}};
 const player=createNativeMusicPlayer(context,'/three/',{onError:error=>errors.push(error.message)}),sound=file=>({...short,nativeSource:{...short.nativeSource,file}}),wait=async condition=>{for(let i=0;i<1000;i++){if(condition())return;await settle();}throw Error('Test did not settle');},callback=async n=>{const channels=[new Float32Array(2048),new Float32Array(2048)];n.onaudioprocess({outputBuffer:{numberOfChannels:2,getChannelData:c=>channels[c]}});await settle();return channels;};
 try{
  await player.prepare();assert.equal(outputs.length,0);
  const old=player.play('old',sound('held-old'),{loop:-1});await wait(()=>held.size===1);
  await player.play('new',short,{loop:-1});await settle();assert.equal(outputs.length,1);assert.equal(requests.filter(m=>m.type==='read').length,8,'Four prefilled and four buffered device blocks');
  held.get('http://test/three/held-old').resolve(source);await old;assert.equal(outputs.length,1);
  player.stop('old');assert.equal(outputs[0].disconnected,undefined);
  await callback(outputs[0]);await settle();assert.equal(requests.filter(m=>m.type==='read').length,9,'Consumed output requests only one replacement block');
  player.stop('new');await settle();assert.equal(outputs[0].disconnected,true);assert.equal(outputs[0].onaudioprocess,null);assert.deepEqual(requests.find(m=>m.type==='close'&&m.generation===2).state,responses.find(m=>m.status==='pcm'&&m.generation===2).state,'Stop commits the block actually consumed by the audio callback rather than the latest prefetched block');
  const cancelled=player.play('cancelled',sound('held-cancelled'),{loop:-1});await wait(()=>held.size===2);player.stop('cancelled');held.get('http://test/three/held-cancelled').resolve(source);await cancelled;assert.equal(outputs.length,1,'Stopped loading never attaches an output node');
  await player.play('failure',sound('fail'),{loop:-1});assert.deepEqual(errors,['Declared HTTP 503']);await player.play('retry',short,{loop:-1});assert.equal(outputs.length,2);
  player.dispose();await settle();assert.equal(outputs[1].disconnected,true);assert.equal(workers[0].terminated,true);assert.deepEqual(errors,['Declared HTTP 503']);
 }finally{for(const p of held.values())p.resolve(source);player.dispose();codec?.close();globalThis.Worker=originalWorker;globalThis.location=originalLocation;}
});
