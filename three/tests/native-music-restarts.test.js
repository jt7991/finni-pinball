import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import test from 'node:test';import assert from 'node:assert/strict';
import {createMusicDecoderHost} from '../music-decoder-host.js';import {createNativeVorbisCodec} from '../native-vorbis.js';import {nativeSoundMix} from '../native-sound-mix.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-music-restarts-native.json.gz',import.meta.url)))),clips=JSON.parse(fs.readFileSync(new URL('fixtures/vpx-main-vorbis-native.json',import.meta.url))).clips;

test('same-name stops retain only played native cache and phase, matching two independent original restarts exactly',async()=>{
 for(const observation of fixture.observations){
  assert.equal(observation.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');
  const clip=clips.find(c=>c.name===observation.name),source=fs.readFileSync(new URL('../public/native-audio/music/'+clip.file,import.meta.url)),codec=await createNativeVorbisCodec(fs.readFileSync(new URL('../public/native-audio/vorbis.wasm',import.meta.url))),replies=new Map(),host=createMusicDecoderHost(data=>replies.set(data.id,data),{loadCodec:()=>codec,loadSource:()=>source});let id=0;
  const command=async message=>{await host.receive({id:++id,...message});const r=replies.get(id);replies.delete(id);assert.notEqual(r.status,'error',r.error);return r;},nonzero=b=>b.pcm.some(c=>c.some(x=>x!==0)),initial=observation.restart.initial.filter(nonzero),restarted=observation.restart.restarted.filter(nonzero),gain=nativeSoundMix({outputTarget:'backglass'},{volume:observation.volume,pan:observation.pan}),open=generation=>command({type:'open',name:clip.name,generation,url:clip.file,loop:true,outputSampleRate:48000,expected:{channels:clip.channels,sampleRate:clip.sampleRate,nativeFrames:clip.frames,granuleFrames:clip.sourceGranuleFrames}}),read=generation=>command({type:'read',generation,frames:2048});
  const compare=(block,expected,label)=>{for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(Math.fround(block.pcm[i*2+c]*(c?gain.right:gain.left)),expected.pcm[c][i],label+' channel '+c+' frame '+i);};
  try{
   for(const block of observation.restart.stopped)assert.equal(nonzero(block),false);
   assert.ok(observation.restart.initial.slice(-1).every(b=>!nonzero(b)),'Continuous capture reaches actual native silence after Stop');
   await open(1);let last;
   for(let n=0;n<initial.length;n++){last=await read(1);compare(last,initial[n],'Initial block '+n);}
   const playedState=last.state;
   for(let n=0;n<8;n++)await read(1); // Worker prefetch is deliberately ahead.
   await command({type:'close',generation:1,state:playedState});await open(2);
   for(let n=0;n<restarted.length;n++)compare(await read(2),restarted[n],'Restart block '+n);
   // A fresh named voice is independently initialized even for identical bytes.
   await command({type:'close',generation:2});await command({type:'open',name:'other-alias',generation:3,url:clip.file,loop:true,outputSampleRate:48000});const fresh=await read(3);compare(fresh,initial[0],'Fresh alias');let differences=0;for(let c=0;c<2;c++)for(let i=0;i<2048;i++)if(Math.fround(fresh.pcm[i*2+c]*(c?gain.right:gain.left))!==restarted[0].pcm[c][i])differences++;assert.ok(differences>1000,'A fresh-voice negative control fails the retained original restart on over 1000 samples');
  }finally{await command({type:'dispose'});}
 }
});
