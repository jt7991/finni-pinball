// VPX's HTTP browser player fills ScriptProcessor buffers synchronously.
// Keep that property: queued callbacks after a long render cannot wait for
// asynchronous worker round trips without inserting additional silent blocks.
import {createNativeAudioWorkerHost} from './native-audio-worker-host.js';
import {createNativeVorbisCodec} from './native-vorbis.js';

export function createNativeAudioLocalTransport(base){
 const transport=new EventTarget();transport.nativeAudioTransport=true;let disposed=false,renderID=0;
 const send=data=>{if(!disposed)transport.dispatchEvent(new MessageEvent('message',{data}));};
 async function bytes(url){const response=await fetch(url);if(!response.ok)throw Error('Native audio unavailable: '+response.status);return response.arrayBuffer();}
 const host=createNativeAudioWorkerHost(send,{loadCodec:async()=>createNativeVorbisCodec(await bytes(new URL('native-audio/vorbis.wasm',base))),loadMusicSource:bytes});
 transport.postMessage=message=>{if(!disposed)void host.receive(message);};
 transport.renderSync=()=>{
  let result;void host.receive({type:'render',id:--renderID},data=>{result=data;});
  if(!result||result.status!=='pcm')throw Error(result?.error??'Native synchronous render did not finish');
  send({...result,type:'audio-render'});return result;
 };
 transport.terminate=()=>{if(disposed)return;void host.receive({type:'dispose'});disposed=true;};
 return transport;
}
