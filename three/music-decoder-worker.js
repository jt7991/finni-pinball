import {createNativeVorbisCodec} from './native-vorbis.js';
import {createMusicDecoderHost} from './music-decoder-host.js';

let base;
const sources=new Map(),budget=24*1024*1024;let bytes=0;
async function loadSource(url,{signal}={}){
 if(sources.has(url)){const data=sources.get(url);sources.delete(url);sources.set(url,data);return data;}
 const response=await fetch(url,{signal});if(!response.ok)throw Error('Native music source unavailable: '+response.status);
 const data=await response.arrayBuffer();signal?.throwIfAborted();
 if(data.byteLength>budget)throw Error('Native music source exceeds compressed cache budget');
 if(sources.has(url)){bytes-=sources.get(url).byteLength;sources.delete(url);}
 while(bytes+data.byteLength>budget&&sources.size){const key=sources.keys().next().value;bytes-=sources.get(key).byteLength;sources.delete(key);}
 sources.set(url,data);bytes+=data.byteLength;return data;
}
const host=createMusicDecoderHost((data,transfer)=>self.postMessage(data,transfer),{
 async loadCodec(){const response=await fetch(new URL('native-audio/vorbis.wasm',base));if(!response.ok)throw Error('Native music codec unavailable: '+response.status);return createNativeVorbisCodec(await response.arrayBuffer());},loadSource,
});
self.addEventListener('message',({data})=>{
 if(data.base)base??=data.base;
 if(data.type==='prefetch'){
  // Compressed bytes only, sequential requests and no decoded track cache.
  void(async()=>{const failed=[];for(const url of data.urls)try{await loadSource(url);}catch{failed.push(url);}self.postMessage({type:'response',id:data.id,status:'prefetched',failed});})();return;
 }
 void host.receive(data);
});
