import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../media.js';

// AudioPlayer::PlaySound selects the first player for useSame, otherwise the
// first idle player. SoundPlayer::Play updates a live player without seeking.
// Test the public host with deferred decoding and explicit source completion.
async function withAudio(run,{deferred=false}={}){
 const originals={Audio:globalThis.Audio,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
 const decoded=Promise.withResolvers(),decoding=Promise.withResolvers(),sources=[];
 const chain={connect(){return this;},disconnect(){}};
 globalThis.Audio=class{play(){return Promise.resolve();}pause(){}load(){}};
 globalThis.AudioContext=class{
  currentTime=0;destination={};resume(){return Promise.resolve();}
  decodeAudioData(){decoding.resolve();return deferred?decoded.promise:Promise.resolve({sampleRate:48000,length:480,numberOfChannels:1});}
  createBufferSource(){const source={...chain,playbackRate:{value:1},start(){source.starts=(source.starts??0)+1;},stop(){source.stops=(source.stops??0)+1;},finish(){source.onended?.();}};sources.push(source);return source;}
  createGain(){return {...chain,gain:{value:1}};}createStereoPanner(){return {...chain,pan:{value:0}};}
 };
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
 try{const audio=createAudio({effect:{file:'effect.m4a',sampleRate:22050}},'/three/');await audio.unlock();await run({audio,sources,decoded,decoding});audio.stop();}
 finally{Object.assign(globalThis,originals);}
}

test('a repeated ball-drop request updates the first playing source without a new attack',()=>withAudio(async({audio,sources})=>{
 await audio.play('effect',{useExisting:true});
 await audio.play('effect',{useExisting:true,pitch:11025});
 assert.equal(sources.length,1);assert.equal(sources[0].starts,1);assert.equal(sources[0].playbackRate.value,1.5);
 sources[0].finish();await audio.play('effect',{useExisting:true});
 assert.equal(sources.length,2,'An ended player can start the next request');assert.equal(sources[1].starts,1);
}));

test('same-sound updates coalesce while their first decode is pending',()=>withAudio(async({audio,sources,decoded,decoding})=>{
 const first=audio.play('effect',{useExisting:true});await decoding.promise;
 const second=audio.play('effect',{useExisting:true,pitch:11025});
 decoded.resolve({sampleRate:48000,length:480,numberOfChannels:1});await Promise.all([first,second]);
 assert.equal(sources.length,1);assert.equal(sources[0].playbackRate.value,1.5);
},{deferred:true}));

test('independent effects overlap and restart stops every prior voice before starting once',()=>withAudio(async({audio,sources})=>{
 await audio.play('effect');await audio.play('effect');assert.equal(sources.length,2);
 await audio.play('effect',{restart:true});
 assert.equal(sources.length,3);assert.equal(sources[0].stops,1);assert.equal(sources[1].stops,1);assert.equal(sources[2].starts,1);
}));

test('independent infinite loops overlap when useExisting is false',()=>withAudio(async({audio,sources})=>{
 await audio.play('effect',{loop:-1,useExisting:false});await audio.play('effect',{loop:-1,useExisting:false});
 assert.equal(sources.length,2);assert.ok(sources.every(source=>source.loop));
}));

test('restart during decoding cancels every older pending voice',()=>withAudio(async({audio,sources,decoded,decoding})=>{
 const first=audio.play('effect'),second=audio.play('effect');await decoding.promise;
 const replacement=audio.play('effect',{restart:true,pitch:11025});
 decoded.resolve({sampleRate:48000,length:480,numberOfChannels:1});await Promise.all([first,second,replacement]);
 assert.equal(sources.length,1);assert.equal(sources[0].starts,1);assert.equal(sources[0].playbackRate.value,1.5);
},{deferred:true}));

test('a failed shared decode is handled for every pending request',()=>withAudio(async({audio,sources,decoded,decoding})=>{
 const warn=console.warn;console.warn=()=>{};
 try{
  const first=audio.play('effect',{useExisting:true});await decoding.promise;
  const second=audio.play('effect',{useExisting:true});decoded.reject(Error('Decoder failed'));
  const results=await Promise.allSettled([first,second]);assert.ok(results.every(result=>result.status==='fulfilled'));assert.equal(sources.length,0);
 }finally{console.warn=warn;}
},{deferred:true}));

for(const [loop,count]of [[0,1],[1,1],[3,3]])test(`native loop count ${loop} plays ${count} complete iterations`,()=>withAudio(async({audio,sources})=>{
 await audio.play('effect',{loop});
 for(let i=0;i<count;i++){assert.equal(sources.length,i+1);assert.equal(sources[i].loop,false);sources[i].finish();}
 assert.equal(sources.length,count);
}));

test('stopping a finite repeat prevents its queued completion from resurrecting playback',()=>withAudio(async({audio,sources})=>{
 await audio.play('effect',{loop:3});const completion=sources[0].onended;audio.stop('effect');completion?.();assert.equal(sources.length,1);
}));
