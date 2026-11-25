import fs from'node:fs';import assert from'node:assert/strict';import test from'node:test';import{createHash}from'node:crypto';
import{readNativeHistoryCapture}from'../../scripts/native-history-pages.mjs';import{compareNativeHistoryState}from'../../scripts/compare-native-history-state.mjs';
import{createNativeAudioPlayer}from'../native-audio-player.js';import{decodePCM16Wave}from'../audio-pcm.js';
import{openEffectBank}from'../effect-bank.js';
const file=new URL('fixtures/vpx-main-natural-audio-native.json.gz',import.meta.url),bytes=fs.readFileSync(file);
assert.equal(createHash('sha256').update(bytes).digest('hex'),'57ae1a05618e8d8b372d2c02f31699e68fccdd3b57380a4709fc35e612cc2f3e');
const fixture=readNativeHistoryCapture(file),root=new URL('../public/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('audio.json',root)));

async function outputComparison(calls,indexed=false){
 const originalFetch=globalThis.fetch,errors=[];let output;
 const context={sampleRate:48000,currentTime:0,destination:{},createBuffer(numberOfChannels,length,sampleRate){const channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));return{numberOfChannels,length,sampleRate,getChannelData:c=>channels[c]};},createScriptProcessor(){return output={connect(){},disconnect(){}};}};
 globalThis.fetch=async url=>{const b=fs.readFileSync(new URL(new URL(String(url),'http://test/').pathname.slice('/three/'.length),root));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
 const metadata=indexed?JSON.parse(fs.readFileSync(new URL('native-audio/effects.json',root))):null,bank=indexed?openEffectBank(manifest,metadata,fs.readFileSync(new URL('native-audio/'+metadata.file,root))):null;
 const loadBuffer=async name=>{if(bank)return bank.get(name);const b=fs.readFileSync(new URL('audio/'+manifest[name].fallbackFile,root));return decodePCM16Wave(context,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
 const player=createNativeAudioPlayer(context,'http://test/three/',manifest,{loadBuffer,onError:e=>errors.push(e.message)});
 try{
  const names=[...new Set(calls.filter(e=>e.type==='play').map(e=>e.name))];
  // Sources are available before replay. Native callback ordering is an
  // external input; native PCM/cursors/random words are never player inputs.
  await player.prepare(names.filter(n=>!manifest[n].music));await player.prepareMusic(names.filter(n=>manifest[n].music));await player.activate();
  const timeline=[...fixture.soundTimeline.events.map((e,i)=>({kind:'event',order:e.order,actual:calls[i]})),...fixture.soundTimeline.callbacks.map((e,i)=>({kind:'callback',...e,index:i}))].sort((a,b)=>a.order-b.order);
  let differences=0,blocks=0;
  for(const row of timeline){
   if(row.kind==='event'){const event=row.actual;if(event.type==='stop')player.stop(event.name);else await player.play(event.name,event.settings);continue;}
   const channels=[new Float32Array(2048),new Float32Array(2048)];output.onaudioprocess({outputBuffer:{getChannelData:c=>channels[c]}});
   for(let c=0;c<2;c++)for(let i=0;i<2048;i++)if(channels[c][i]!==row.pcm[c][i])differences++;
   blocks++;context.currentTime+=2048/48000;
  }
  assert.deepEqual(errors,[]);return{differences,blocks,samples:blocks*4096};
 }finally{player.dispose();globalThis.fetch=originalFetch;}
}

test('ordinary native play retains every sound call/time/COM argument and every recorded device sample',async()=>{
 assert.equal(fixture.engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(fixture.reference.sourceSha256,'3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14');assert.deepEqual(fixture.reference.controlledOverrides,{});
 assert.equal(fixture.soundTimeline.events.length,33348);assert.equal(fixture.soundTimeline.callbacks.length,604);assert.deepEqual(fixture.soundTimeline.errors,[]);
 const calls=[],result=await compareNativeHistoryState(fixture,{soundAudit:calls});
 assert.equal(result.intervalsChecked,20016);assert.equal(result.framesChecked,1165);assert.equal(result.soundCallsChecked,33348);
 const output=await outputComparison(calls);assert.deepEqual(output,{differences:0,blocks:604,samples:2473984});
 const encodedOutput=await outputComparison(calls,true);assert.deepEqual(encodedOutput,output,'Indexed lossless source pulls retain every native gameplay device sample');
 // Restore only the preceding wrong restart behavior in generated commands.
 // Original observations, source samples and callback schedule stay unchanged.
 const negative=calls.map(e=>e.type==='play'?{...e,settings:{...e.settings,restart:false}}:e),wrong=await outputComparison(negative);
 assert.ok(wrong.differences>0,'The preceding overlap default must fail actual native device samples');
});
