// Compare browser-decoded delivery assets with the original PCM16 samples.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),option=n=>process.argv.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);
const sourceRoot=option('source-root')??'.work/main-99eff88-assets/sounds',required=process.argv.includes('--require-lossless');
const decoderModule=option('decoder-module'),forceFallback=process.argv.includes('--force-pcm-fallback');if(forceFallback)assert.ok(decoderModule);
const manifest=await(await fetch(new URL('audio.json',base))).json();
const names=process.argv.includes('--all-effects')?Object.keys(manifest).filter(n=>!manifest[n].music):(option('sounds')??'fx_flipperup,fx_flipperdown,fx_bumper,fx_sensor,vo_chooseyourbattle,vo_jackpot').split(',');
const filename=option('output-name')??'audio-decoding.json';assert.match(filename,/^[a-z0-9.-]+\.json$/i);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(!d.id)return;const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});socket.send(JSON.stringify({id:request,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const rows=[];
try{
 await call('Page.enable');await call('Page.navigate',{url:new URL('audio.json',base).href});await evaluate('window.audioDecodeContexts=new Map()');
 if(decoderModule)await evaluate(`(async()=>{window.audioEffectContext=new OfflineAudioContext(2,1,48000);window.audioEffectDecoder=(await import(${JSON.stringify(new URL(decoderModule,base).href)})).createEffectDecoder(audioEffectContext);${forceFallback?'window.OfflineAudioContext=class{constructor(){throw Error("Declared unsupported lossless codec");}};':''}})()`);
 for(const name of names){
  const entry=manifest[name],source=fs.readFileSync(path.join(sourceRoot,(entry.sourceName??name)+'.wav'));
  assert.equal(sha(source),entry.sourceSHA256,name+' canonical source bytes');let format,data;
  for(let at=12;at+8<=source.length;){
   const tag=source.toString('ascii',at,at+4),size=source.readUInt32LE(at+4);assert.ok(at+8+size<=source.length,'Complete RIFF chunk');
   if(tag==='fmt ')format={codec:source.readUInt16LE(at+8),channels:source.readUInt16LE(at+10),rate:source.readUInt32LE(at+12),bits:source.readUInt16LE(at+22)};
   if(tag==='data')data=source.subarray(at+8,at+8+size);at+=8+size+(size%2);
  }
  assert.equal(format.codec,1);assert.equal(format.bits,16);assert.ok(data);
  const expected=Buffer.alloc(data.length*2);for(let i=0;i<data.length/2;i++)expected.writeFloatLE(data.readInt16LE(i*2)/32768,i*4);
  const expectedHash=sha(expected),frames=data.length/2/format.channels;
  const result=await evaluate(`(async()=>{
   const rate=${format.rate},channels=${format.channels},frames=${frames};
   let context=audioDecodeContexts.get(rate);if(!context){context=window.audioEffectContext??new OfflineAudioContext(channels,128,rate);audioDecodeContexts.set(rate,context);}
   const bytesFrom64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
   const expected=new Float32Array(bytesFrom64(${JSON.stringify(expected.toString('base64'))}).buffer);
   const response=await fetch(${JSON.stringify(new URL('audio/'+entry.file,base).href)});if(!response.ok)throw Error('Delivery asset unavailable');
   const bytes=await response.arrayBuffer(),encodedBytes=bytes.byteLength;let fallbackRequests=0;
   const actual=window.audioEffectDecoder?await audioEffectDecoder(bytes,${JSON.stringify(entry)},async()=>{fallbackRequests++;const r=await fetch(${JSON.stringify(new URL('audio/'+entry.fallbackFile,base).href)});if(!r.ok)throw Error('Original WAV fallback unavailable');return r.arrayBuffer();}):await context.decodeAudioData(bytes);
   const pcm=new Float32Array(actual.length*actual.numberOfChannels);
   for(let c=0;c<actual.numberOfChannels;c++){const samples=actual.getChannelData(c);for(let i=0;i<actual.length;i++)pcm[i*actual.numberOfChannels+c]=samples[i];}
   let mismatches=0,square=0,peak=0;const count=Math.min(frames,actual.length),commonChannels=Math.min(channels,actual.numberOfChannels);
   for(let c=0;c<commonChannels;c++){const samples=actual.getChannelData(c);for(let i=0;i<count;i++){const d=samples[i]-expected[i*channels+c];if(d!==0)mismatches++;square+=d*d;peak=Math.max(peak,Math.abs(d));}}
   const actualPCMHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pcm.buffer)),v=>v.toString(16).padStart(2,'0')).join('');
   return{encodedBytes,fallbackRequests,sampleRate:actual.sampleRate,actualFrames:actual.length,actualChannels:actual.numberOfChannels,actualPCMHash,mismatches,rmsDifference:Math.sqrt(square/(count*commonChannels)),peakDifference:peak};
  })()`);
  rows.push({name,file:entry.file,sourceSHA256:entry.sourceSHA256,sourceFrames:frames,sourceChannels:format.channels,sourceRate:format.rate,sourcePCMHash:expectedHash,...result});
  if(decoderModule)assert.equal(result.fallbackRequests,forceFallback?1:0,name+' expected decoder path');
  if(required){assert.equal(result.actualFrames,frames,name+' frame count');assert.equal(result.actualChannels,format.channels,name+' channel count');assert.equal(result.actualPCMHash,expectedHash,name+' original PCM samples');}
 }
 const result={scope:'Real browser decoding at each original WAV sample rate. Expectations are original PCM16 samples independently converted to Float32 by division by 32768, not another browser codec decode. Checks source content/frame preservation, not destination-device resampling, mixer output or speaker latency.',base,decoderModule,forceFallback,requiredLossless:required,rows};
 fs.writeFileSync(output+'/'+filename,JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({sounds:rows.length,exact:rows.filter(r=>r.actualPCMHash===r.sourcePCMHash).length,frameCountDifferences:rows.filter(r=>r.actualFrames!==r.sourceFrames).length,maxPeakDifference:Math.max(...rows.map(r=>r.peakDifference)),output:filename}));
}catch(error){fs.writeFileSync(output+'/audio-decoding-failure.json',JSON.stringify({error:String(error),rows},null,2),{flag:'wx'});throw error;}finally{socket.close();}
