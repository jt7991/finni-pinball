import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeAudioWorkerHost} from '../native-audio-worker-host.js';import {createNativeVorbisCodec} from '../native-vorbis.js';import {decodePCM16Wave} from '../audio-pcm.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url))),wasm=fs.readFileSync(new URL('../public/native-audio/vorbis.wasm',import.meta.url)),packed=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)))),mixes=packed('vpx-main-pcm-mixes-native.json.gz'),music=packed('vpx-main-music-loop-native.json.gz');
const context={createBuffer(numberOfChannels,length,sampleRate){const data=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>data[c]};}};
function source(name){const entry=manifest[name],bytes=fs.readFileSync(new URL('../public/audio/'+entry.fallbackFile,import.meta.url)),buffer=decodePCM16Wave(context,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));return{key:entry.file,frames:buffer.length,rate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c))};}
function host(overrides={}){
 const replies=new Map(),notifications=[],h=createNativeAudioWorkerHost(data=>{if(data.id!==undefined)replies.set(data.id,data);else notifications.push(data);},{loadCodec:()=>createNativeVorbisCodec(wasm),loadMusicSource:url=>fs.readFileSync(new URL('../public/'+new URL(url).pathname.slice('/three/'.length),import.meta.url)),...overrides});let id=0;
 return{notifications,async command(message){const ticket=++id;await h.receive({...message,id:ticket});const result=replies.get(ticket);replies.delete(ticket);return result;}};
}
const initialize=h=>h.command({type:'audio-init',manifest,base:'http://test/three/',sampleRate:48000}),compare=(block,expected,label)=>{assert.equal(block.status,'pcm');assert.deepEqual(block.warnings,[]);for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(block.pcm[i*2+c],expected.pcm[c][i],label+' channel '+c+' frame '+i);};

test('shared worker protocol preserves every original multi-source device sample and source deduplication',async()=>{
 for(const capture of mixes.observations){const h=host();try{
  await initialize(h);compare(await h.command({type:'render'}),capture.frames[0],'Silent prepared block');
  const registered=new Set();
  for(const layer of capture.layers){const data=source(layer.name);if(!registered.has(data.key)){assert.equal((await h.command({type:'register-effect',source:data})).status,'registered');registered.add(data.key);}assert.equal((await h.command({type:'play-effect',name:layer.name,key:data.key,settings:{...layer,loop:layer.loopCount}})).status,'queued');}
  for(let n=1;n<capture.frames.length;n++)compare(await h.command({type:'render'}),capture.frames[n],capture.mixCase+' worker '+n);
  const stats=await h.command({type:'stats'});assert.equal(stats.active,capture.layers.length);assert.equal(stats.players,capture.layers.length);assert.ok(stats.pcmBytes<=16*1024*1024);
 }finally{await h.command({type:'dispose'});}}
});

test('music preparation creates no players; original Vorbis reaches the same shared native mixer',async()=>{
 const h=host();try{
  await initialize(h);assert.equal((await h.command({type:'prepare-music',name:'mu_discoloops'})).status,'prepared');const prepared=await h.command({type:'stats'});assert.equal(prepared.players,0);assert.equal(prepared.frames,0);assert.ok(prepared.codecBytes<=64*1024*1024);
  assert.equal((await h.command({type:'play-music',name:'mu_discoloops',settings:{loop:-1,volume:.04,pan:0}})).status,'queued');
  for(let n=0;n<4;n++)compare(await h.command({type:'render'}),music.frames[n],'Original music worker '+n);
  const id=(await h.command({type:'stats'})).players;await h.command({type:'mute',value:true});assert.ok((await h.command({type:'render'})).pcm.every(x=>x===0));assert.equal((await h.command({type:'stats'})).players,id);assert.equal((await h.command({type:'stats'})).active,1);
 }finally{await h.command({type:'dispose'});}
});

test('queued sources survive LRU eviction and a cache miss remains retryable without creating a player',async()=>{
 const a=source('fx_flipperup'),b=source('fx_flipperdown'),h=host({pcmBudget:Math.max(a.channels[0].byteLength,b.channels[0].byteLength)});try{
  await initialize(h);assert.equal((await h.command({type:'register-effect',source:a})).status,'registered');await h.command({type:'play-effect',name:'fx_flipperup',key:a.key,settings:{volume:.04,loop:-1}});assert.equal((await h.command({type:'register-effect',source:b})).status,'registered');assert.ok(h.notifications.some(n=>n.keys?.includes(a.key)));
  const first=await h.command({type:'render'});assert.deepEqual(first.warnings,[]);assert.ok(first.pcm.some(x=>x!==0),'Already queued source remains alive outside the cache');
  assert.equal((await h.command({type:'play-effect',name:'fx_flipperup',key:a.key,settings:{useExisting:true}})).status,'need-source');assert.equal((await h.command({type:'stats'})).queued,0);
  assert.equal((await h.command({type:'play-effect',name:'fx_flipperup',source:a,settings:{useExisting:true,loop:-1,volume:.04}})).status,'queued');await h.command({type:'render'});assert.equal((await h.command({type:'stats'})).players,1,'Re-registration updates the same existing named player');
 }finally{await h.command({type:'dispose'});}
});
