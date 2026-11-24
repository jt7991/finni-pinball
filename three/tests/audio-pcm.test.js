import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePCM16Wave,createEffectDecoder} from '../audio-pcm.js';
function wav(samples,channels=1,rate=22050){
 const b=new ArrayBuffer(46+samples.length*2),v=new DataView(b),tag=(at,s)=>{for(let i=0;i<4;i++)v.setUint8(at+i,s.charCodeAt(i));};
 tag(0,'RIFF');v.setUint32(4,b.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,18,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);tag(38,'data');v.setUint32(42,samples.length*2,true);samples.forEach((s,i)=>v.setInt16(46+i*2,s,true));return b;
}
const context={createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>channels[c]};}};
test('source WAV fallback preserves signed PCM endpoints, channel order and authored frame count',()=>{
 const values=[-32768,32767,-1,1,0,16384],b=decodePCM16Wave(context,wav(values,2,32000));
 assert.equal(b.numberOfChannels,2);assert.equal(b.sampleRate,32000);assert.equal(b.length,3);
 assert.deepEqual([...b.getChannelData(0)],[-1,-1/32768,0]);assert.deepEqual([...b.getChannelData(1)],[32767/32768,1/32768,.5]);
});
test('invalid or truncated source WAV cannot produce a partially decoded effect',()=>{
 const valid=wav([0,1]);assert.throws(()=>decodePCM16Wave(context,valid.slice(0,-1)),/Truncated/);
 const bad=valid.slice(0);new DataView(bad).setUint16(34,8,true);assert.throws(()=>decodePCM16Wave(context,bad),/Unsupported/);
});
test('unsupported lossless codec falls back to original PCM without changing samples',async()=>{
 const original=globalThis.OfflineAudioContext;globalThis.OfflineAudioContext=class{decodeAudioData(){throw Error('Codec unavailable');}};
 let reads=0;try{
  const decode=createEffectDecoder(context),entry={encoding:'flac-pcm24',channels:1,sampleRate:22050,frames:2};
  const b=await decode(new ArrayBuffer(1),entry,async()=>{reads++;return wav([-32768,32767]);});assert.equal(reads,1);assert.deepEqual([...b.getChannelData(0)],[-1,32767/32768]);
  await assert.rejects(decode(new ArrayBuffer(1),{...entry,frames:3},async()=>wav([0,1])),/differs from source/);
 }finally{if(original===undefined)delete globalThis.OfflineAudioContext;else globalThis.OfflineAudioContext=original;}
});
