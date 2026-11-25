import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createMusicDecoderHost} from '../music-decoder-host.js';import {createNativeVorbisCodec} from '../native-vorbis.js';
const wasm=fs.readFileSync(new URL('../public/native-audio/vorbis.wasm',import.meta.url)),fixture=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-vorbis-native.json',import.meta.url))),source=clip=>fs.readFileSync(new URL('../public/native-audio/music/'+clip.file,import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function host(overrides={}){
 const replies=new Map(),decoder=createMusicDecoderHost(data=>replies.set(data.id,data),{loadCodec:()=>createNativeVorbisCodec(wasm),loadSource:url=>source(fixture.clips.find(c=>c.name===url)),...overrides});let serial=0;
 return{async command(message){const id=++serial;await decoder.receive({...message,id});return replies.get(id);},dispose:()=>decoder.receive({type:'dispose'})};
}
test('native EOF defines looping with no fabricated granule padding or per-chunk tail silence',async()=>{
 const h=host();try{
  for(const clip of [fixture.clips[0],fixture.clips.find(c=>c.name==='mu_juggernaut')]){
   const generation=clip.name===fixture.clips[0].name?1:2,opened=await h.command({type:'open',generation,url:clip.name,loop:true,expected:{channels:clip.channels,sampleRate:clip.sampleRate,granuleFrames:clip.sourceGranuleFrames,nativeFrames:clip.frames}});assert.equal(opened.status,'opened');
   const needed=clip.frames+128,bytes=Buffer.alloc(needed*clip.channels*4);let frames=0;
   while(frames<needed){const block=await h.command({type:'read',generation,frames:Math.min(65536,needed-frames)});assert.equal(block.status,'pcm');assert.equal(block.ended,false);assert.equal(block.pcm.length,block.frames*clip.channels);Buffer.from(block.pcm.buffer).copy(bytes,frames*clip.channels*4);frames+=block.frames;}
   assert.equal(sha(bytes.subarray(0,clip.frames*clip.channels*4)),clip.pcmSHA256,'Entire first loop matches original compiled PCM');
   const baseline=await createNativeVorbisCodec(wasm);try{baseline.open(source(clip));assert.deepEqual(bytes.subarray(clip.frames*clip.channels*4),Buffer.from(baseline.read(128).pcm.buffer),'Next loop begins immediately at original sample zero');}finally{baseline.close();}
  }
 }finally{await h.dispose();}
});
test('a late old source completion and stale stop cannot replace or stop the newer song',async()=>{
 const delayed=Promise.withResolvers(),short=fixture.clips[0],long=fixture.clips.find(c=>c.name==='mu_juggernaut'),h=host({loadSource:url=>url===long.name?delayed.promise:source(short)});
 try{
  const old=h.command({type:'open',generation:1,url:long.name});const current=await h.command({type:'open',generation:2,url:short.name});assert.equal(current.status,'opened');assert.equal((await h.command({type:'close',generation:1})).status,'stale');delayed.resolve(source(long));assert.equal((await old).status,'stale');
  const block=await h.command({type:'read',generation:2,frames:65536});assert.equal(block.status,'pcm');assert.equal(block.ended,true);assert.equal(block.frames,short.frames);assert.equal(block.pcm.byteLength,short.frames*short.channels*4);assert.equal(sha(new Uint8Array(block.pcm.buffer)),short.pcmSHA256);
 }finally{delayed.resolve(source(long));await h.dispose();}
});
test('failed loading remains retryable, and stop during loading cannot resurrect playback',async()=>{
 const delayed=Promise.withResolvers(),clip=fixture.clips[0];let attempts=0;const h=host({loadSource:()=>{attempts++;if(attempts===1)throw Error('Declared HTTP 503');if(attempts===2)return delayed.promise;return source(clip);}});
 try{
  assert.equal((await h.command({type:'open',generation:1,url:clip.name})).status,'error');const pending=h.command({type:'open',generation:2,url:clip.name});await Promise.resolve();assert.equal((await h.command({type:'close',generation:2})).status,'closed');delayed.resolve(source(clip));assert.equal((await pending).status,'stale');assert.equal((await h.command({type:'read',generation:2,frames:128})).status,'stale');
  assert.equal((await h.command({type:'open',generation:3,url:clip.name})).status,'opened');assert.equal((await h.command({type:'read',generation:3,frames:128})).frames,128);
 }finally{delayed.resolve(source(clip));await h.dispose();}
});
