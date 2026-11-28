import {nativeSourceAssets} from '../../scripts/native-source-assets.mjs';
import fs from'node:fs';import{gunzipSync}from'node:zlib';import test from'node:test';import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{createNativeAudioPlayer}from'../native-audio-player.js';import{decodePCM16Wave}from'../audio-pcm.js';import{createNativeSoundEngine}from'../native-sound-engine.js';
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)))),mixes=load('vpx-main-pcm-mixes-native.json.gz'),voices=load('vpx-main-pcm-voices-native.json.gz'),manifest=nativeSourceAssets('a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3').json('audio.json');
const interleavedBytes=fs.readFileSync(new URL('fixtures/vpx-main-audio-interleaved-native.json.gz',import.meta.url));assert.equal(createHash('sha256').update(interleavedBytes).digest('hex'),'9df0b695f197f5e1d6adef4fe1336986c2eea92fa6235d50a4edf6bb373738f6');const interleaved=JSON.parse(gunzipSync(interleavedBytes));
async function withPlayer(names,cold,run){
 let output;const errors=[],gates=new Map(cold.map(n=>[n,Promise.withResolvers()])),context={sampleRate:48000,currentTime:0,destination:{},createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>channels[c]};},createScriptProcessor(){return output={connect(){},disconnect(){}};}};
 const source=name=>{const b=fs.readFileSync(new URL('../public/audio/'+manifest[name].fallbackFile,import.meta.url));return decodePCM16Wave(context,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
 const player=createNativeAudioPlayer(context,'http://test/three/',Object.fromEntries(names.map(n=>[n,manifest[n]])),{loadBuffer:name=>gates.get(name)?.promise??Promise.resolve(source(name)),onError:e=>errors.push(e.message)});
 const render=()=>{const channels=[new Float32Array(2048),new Float32Array(2048)];output.onaudioprocess({outputBuffer:{getChannelData:c=>channels[c]}});context.currentTime+=2048/48000;return channels;};
 try{await player.activate();render();await run({player,render,release:name=>gates.get(name).resolve(source(name))});assert.deepEqual(errors,[]);}finally{for(const[name,gate]of gates)gate.resolve(source(name));player.dispose();}
}
function compare(channels,frame,label){for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(channels[c][i],frame.pcm[c][i],label+' channel '+c+' sample '+i);}

for(const name of ['pf-trio','cross-saturated','pf-interleaved'])test('cold '+name+' retains native player order when every source finishes in reverse order',async()=>{
 const capture=name==='pf-interleaved'?interleaved:mixes.observations.find(c=>c.mixCase===name),names=capture.layers.map(l=>l.name);assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');for(const layer of capture.layers)assert.equal(manifest[layer.name].sourceSHA256,layer.sourceSHA256);
 await withPlayer(names,names,async({player,render,release})=>{
  const playing=capture.layers.map(l=>player.play(l.name,{...l,loop:l.loopCount}));
  for(let i=names.length-1;i>=0;i--){release(names[i]);await playing[i];}
  for(const[index,frame]of capture.frames.entries())compare(render(),frame,name+' native callback '+index);
  const stats=await player.stats();assert.equal(stats.players,names.length);assert.equal(stats.pendingReservations,0);assert.equal(stats.reserved,0);
 });
});

test('a ready clip retains native device samples while an unrelated cold clip remains unavailable',async()=>{
 const capture=voices.observations.find(c=>c.name==='fx_flipperup');
 await withPlayer(['fx_collide','fx_flipperup'],['fx_collide'],async({player,render,release})=>{
  const cold=player.play('fx_collide',{loop:-1});await player.play('fx_flipperup',{loop:-1,volume:.04});
  for(const[index,frame]of capture.frames.entries())compare(render(),frame,'Ready flipper while cold source waits '+index);
  const waiting=await player.stats();assert.equal(waiting.pendingReservations,1);assert.equal(waiting.active,1);assert.equal(waiting.players,1);
  player.stop('fx_collide');release('fx_collide');await cold;render();assert.equal((await player.stats()).pendingReservations,0);assert.equal((await player.stats()).active,1,'Stop cannot resurrect the cold request');
 });
});

test('canceling a later pending update retains an earlier request and still releases its slot at native EOF',()=>{
 const engine=createNativeSoundEngine({sampleRate:48000,createVoice:()=>({channels:1,update(){},read:()=>({pcm:new Float32Array(2048),frames:2048,ended:true,loops:0,state:{}})})}),sound=manifest.fx_flipperup;
 const first=engine.reserve('fx_flipperup'),update=engine.reserve('fx_flipperup',{useExisting:true});assert.equal(first.id,update.id);engine.cancel(update);engine.playReserved(first,sound);engine.render();
 const next=engine.reserve('fx_flipperup');assert.equal(next.id,first.id,'A canceled update cannot leave the ended player logically occupied');engine.cancel(next);
});
