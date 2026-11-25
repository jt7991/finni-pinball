// Ordered ownership around an independently loaded native codec. Decode
// requests remain bounded; original EOF and seek operations define loops.
import {createNativeMusicStream} from './native-music-stream.js';
export function createMusicDecoderHost(send,{loadCodec,loadSource}){
 let epoch=0,owner,codec,codecPromise,disposed=false;const voices=new Map();
 function ensureCodec(){
  if(codec)return Promise.resolve(codec);
  if(!codecPromise){const request=Promise.resolve().then(loadCodec).then(value=>(codec=value));codecPromise=request;request.catch(()=>{if(codecPromise===request)codecPromise=null;});}
  return codecPromise;
 }
 const respond=(id,result,transfer=[])=>{if(!disposed)send({type:'response',id,...result},transfer);};
 function clear(){owner?.abort.abort();owner=null;codec?.close();}
 async function receive(message){
  const{id,type,generation}=message;let started;
  try{
   if(disposed)throw Error('Music decoder disposed');
   if(type==='prepare'){await ensureCodec();respond(id,{status:'prepared'});return;}
   if(type==='open'){
    if(!Number.isSafeInteger(generation)||generation<1)throw Error('Invalid music generation');
    const ticket=++epoch;clear();const pending={generation,ticket,abort:new AbortController(),opened:false};owner=pending;started=pending;
    // Begin both requests together, but observe both outcomes even if one
    // fails before the other. Old completions never touch the current codec.
    const loaded=await Promise.all([ensureCodec(),Promise.resolve().then(()=>loadSource(message.url,{signal:pending.abort.signal}))]);
    if(disposed||owner!==pending||epoch!==ticket){respond(id,{status:'stale'});return;}
    const format=loaded[0].open(new Uint8Array(loaded[1]));
    for(const field of ['channels','sampleRate','granuleFrames'])if(message.expected?.[field]!==undefined&&message.expected[field]!==format[field])throw Error('Music format differs from source: '+field);
    Object.assign(pending,{opened:true,format,loop:message.loop===true,sourceFrames:0,loops:0,nativeFrames:message.expected?.nativeFrames});
    if(message.outputSampleRate!==undefined){pending.name=message.name;pending.stream=createNativeMusicStream(loaded[0],{...format,outputRate:message.outputSampleRate,quantum:message.quantum,loop:pending.loop,repeats:message.repeats,nativeFrames:pending.nativeFrames,state:voices.get(message.name)});}
    respond(id,{status:'opened',generation,format});return;
   }
   if(type==='close'){
    if(!owner||owner.generation!==generation){respond(id,{status:'stale'});return;}
    if(owner.name&&message.state)voices.set(owner.name,message.state);
    ++epoch;clear();respond(id,{status:'closed',generation});return;
   }
   if(type==='read'){
    if(!owner||owner.generation!==generation){respond(id,{status:'stale'});return;}
    if(!owner.opened){respond(id,{status:'pending',generation});return;}
    const requested=message.frames;if(!Number.isSafeInteger(requested)||requested<1||requested>65536)throw Error('Invalid streamed music read size');
    if(owner.stream){
     if(requested!==(message.quantum??2048))throw Error('Music output reads must match the device quantum');
     const block=owner.stream.read();respond(id,{status:'pcm',generation,channels:owner.format.channels,...block},[block.pcm.buffer,block.state.cache.buffer]);return;
    }
    const current=owner,channels=current.format.channels,pcm=new Float32Array(requested*channels);let written=0,ended=false;
    while(written<requested){
     const block=codec.read(requested-written);
     if(block.frames){pcm.set(block.pcm,written*channels);written+=block.frames;current.sourceFrames+=block.frames;}
     if(block.eof){
      if(current.nativeFrames!==undefined&&current.sourceFrames!==current.nativeFrames)throw Error('Native music EOF differs from source');
      if(!current.loop){ended=true;break;}
      if(!current.sourceFrames)throw Error('Empty native music cannot loop');
      codec.seek(0);current.sourceFrames=0;current.loops++;
     }
    }
    const data=written===requested?pcm:pcm.slice(0,written*channels);
    respond(id,{status:'pcm',generation,frames:written,channels,pcm:data,ended,loops:current.loops},[data.buffer]);return;
   }
   if(type==='dispose'){++epoch;clear();respond(id,{status:'disposed'});disposed=true;return;}
   throw Error('Unknown music decoder command');
  }catch(error){
   if(started&&(disposed||owner!==started)){respond(id,{status:'stale'});return;}
   if(started){++epoch;clear();}
   respond(id,{status:'error',generation,error:String(error.message??error)});
  }
 }
 return{receive};
}
