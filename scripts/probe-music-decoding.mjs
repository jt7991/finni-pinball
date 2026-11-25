// Source-stream comparison. This does not use ffmpeg PCM as native-engine PCM.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const[debug,base,output]=process.argv.slice(2),clips=await(await fetch(new URL('music-probe.json',base))).json();
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map();
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(!d.id)return;const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const rows=[];
try{
 await call('Page.enable');await call('Page.navigate',{url:base});
 for(const clip of clips){
  const original=fs.readFileSync('.work/main-99eff88-assets/sounds/'+clip.name+'.ogg');assert.equal(createHash('sha256').update(original).digest('hex'),clip.sourceSHA256);
  const row=await evaluate(`(async()=>{
   const clip=${JSON.stringify(clip)},context=new OfflineAudioContext(clip.channels,1,clip.rate),decode=async file=>{const response=await fetch(new URL(file,location.href));if(!response.ok)throw Error('Missing music asset');return context.decodeAudioData(await response.arrayBuffer());};
   const hash=async buffer=>{const pcm=new Float32Array(buffer.length*buffer.numberOfChannels);for(let c=0;c<buffer.numberOfChannels;c++){const samples=buffer.getChannelData(c);for(let i=0;i<buffer.length;i++)pcm[i*buffer.numberOfChannels+c]=samples[i];}return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pcm.buffer)),v=>v.toString(16).padStart(2,'0')).join('');};
   const original=await decode(clip.original),originalPCMHash=await hash(original),variants=[];
   for(const variant of clip.variants){const actual=await decode(variant.file);let different=0,peak=0,square=0;const frames=Math.min(original.length,actual.length),channels=Math.min(original.numberOfChannels,actual.numberOfChannels);for(let c=0;c<channels;c++){const a=actual.getChannelData(c),r=original.getChannelData(c);for(let i=0;i<frames;i++){const d=a[i]-r[i];if(d!==0)different++;peak=Math.max(peak,Math.abs(d));square+=d*d;}}variants.push({...variant,frames:actual.length,channels:actual.numberOfChannels,rate:actual.sampleRate,pcmSHA256:await hash(actual),different,peakDifference:peak,rmsDifference:Math.sqrt(square/(frames*channels))});}
   return{name:clip.name,sourceSHA256:clip.sourceSHA256,sourceGranuleFrames:clip.granuleFrames,original:{frames:original.length,rate:original.sampleRate,channels:original.numberOfChannels,pcmSHA256:originalPCMHash},variants};
  })()`);rows.push(row);console.log(JSON.stringify(row));
 }
 fs.writeFileSync(output+'/music-decoding.json',JSON.stringify({scope:'Original Vorbis source streams versus their packet-copy WebM remux and prior AAC encoding, decoded by the same browser at authored sample rates. This is a container/encoding comparison, not native stb_vorbis, destination resampling or uninterrupted playback equivalence.',base,rows},null,2),{flag:'wx'});
}finally{socket.close();}
