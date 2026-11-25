import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAudioPlayer} from '../native-audio-player.js';
import {decodePCM16Wave} from '../audio-pcm.js';

test('queued device callbacks consume every native mixed block without asynchronous handoff silence',async()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('fixtures/vpx-main-pcm-mixes-native.json.gz',import.meta.url))));
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/audio.json',import.meta.url)));
 for(const capture of fixture.observations){
  let output;const errors=[],context={sampleRate:48000,currentTime:0,destination:{},createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>channels[c]};},createScriptProcessor(){return output={connect(){},disconnect(){}};}};
  const loadBuffer=async name=>{const bytes=fs.readFileSync(new URL('../public/audio/'+manifest[name].fallbackFile,import.meta.url));return decodePCM16Wave(context,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};
  const player=createNativeAudioPlayer(context,'http://localhost/three/',Object.fromEntries(capture.layers.map(l=>[l.name,manifest[l.name]])),{loadBuffer,onError:e=>errors.push(e.message)});
  try{
   await Promise.all(capture.layers.map(layer=>player.play(layer.name,{...layer,loop:layer.loopCount})));
   // Deliberately run the complete callback burst without a single promise or
   // timer yield. A worker round trip cannot supply any of these next blocks.
   for(let b=0;b<capture.frames.length;b++){
    const channels=[new Float32Array(2048),new Float32Array(2048)];output.onaudioprocess({outputBuffer:{getChannelData:c=>channels[c]}});
    for(let c=0;c<2;c++)assert.deepEqual(channels[c],Float32Array.from(capture.frames[b].pcm[c]),capture.mixCase+' callback '+b+' channel '+c);
   }
   assert.deepEqual(errors,[]);assert.equal((await player.stats()).players,capture.layers.length);
  }finally{player.dispose();}
 }
});
