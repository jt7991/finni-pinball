import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import test from 'node:test';import assert from 'node:assert/strict';
import {createMusicDecoderHost} from '../music-decoder-host.js';
import {createNativeVorbisCodec} from '../native-vorbis.js';
import {nativeSoundMix} from '../native-sound-mix.js';
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-music-loop-native.json.gz',import.meta.url)))),clip=capture.nativeClip;

test('streamed output matches both original SDL channels before and after a complete native music loop',async()=>{
 assert.equal(capture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
 assert.equal(capture.nodes[1].sampleRate,48000);assert.deepEqual(capture.nodes[1].args,[2048,0,2]);
 for(const block of capture.before)for(const channel of block.pcm)assert.ok(channel.every(x=>x===0),'Actual native pre-roll is silent');
 const codec=await createNativeVorbisCodec(fs.readFileSync(new URL('../public/native-audio/vorbis.wasm',import.meta.url)));
 const source=fs.readFileSync(new URL('../public/native-audio/music/'+clip.file,import.meta.url)),replies=new Map(),h=createMusicDecoderHost(data=>replies.set(data.id,data),{loadCodec:()=>codec,loadSource:()=>source});let id=0;
 const command=async message=>{await h.receive({id:++id,...message});const r=replies.get(id);replies.delete(id);assert.notEqual(r.status,'error',r.error);return r;};
 try{
  await command({type:'open',generation:1,url:clip.name,loop:true,outputSampleRate:48000,expected:{channels:clip.channels,sampleRate:clip.sampleRate,nativeFrames:clip.frames,granuleFrames:clip.sourceGranuleFrames}});
  const frames=new Map(capture.frames.map(b=>[b.index,b])),last=capture.frames.at(-1).index,gain=nativeSoundMix({outputTarget:'backglass'},{volume:capture.volume,pan:capture.pan});
  let checked=0,latest;
  for(let index=0;index<=last;index+=2048){
   latest=await command({type:'read',generation:1,frames:2048});assert.equal(latest.frames,2048);assert.equal(latest.ended,false);
   if(!frames.has(index))continue;const expected=frames.get(index);
   for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(Math.fround(latest.pcm[i*2+c]*(c?gain.right:gain.left)),expected.pcm[c][i],'Native device frame '+(index+i)+' channel '+c);
   checked++;
  }
  assert.equal(checked,capture.frames.length);assert.equal(latest.loops,1);
 }finally{await command({type:'dispose'});}
});
