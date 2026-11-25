// SPDX-License-Identifier: GPL-3.0-or-later
// Independent source-rate codec subset; no VPX player initialization.
export async function createNativeVorbisCodec(bytes,{maxMemoryBytes=64*1024*1024}={}){
 let instance,state;
 const result=await WebAssembly.instantiate(bytes,{env:{emscripten_resize_heap(requested){
  const wanted=requested>>>0,memory=instance.exports.memory;
  if(wanted>maxMemoryBytes)return 0;
  try{const pages=Math.ceil((wanted-memory.buffer.byteLength)/65536);if(pages>0)memory.grow(pages);return 1;}catch{return 0;}
 }}});
 instance=result.instance??result;const api=instance.exports,memory=api.memory;
 if(memory.buffer.byteLength>maxMemoryBytes)throw Error('Native audio exceeds memory budget');
 function close(){
  if(!state)return;const old=state;state=null;
  if(old.decoder)api.close(0,old.decoder,0);
  for(const pointer of [old.input,old.scratch,old.pcm])if(pointer)api.free(pointer);
 }
 function allocate(bytes){const pointer=api.malloc(bytes);if(!pointer)throw Error('Native audio allocation failed');return pointer;}
 function active(){if(!state?.decoder)throw Error('No native music stream is open');return state;}
 function open(bytes){
  close();if(!(bytes instanceof Uint8Array)||!bytes.length)throw Error('Music source bytes are required');
  state={};
  try{
   state.input=allocate(bytes.length);new Uint8Array(memory.buffer,state.input,bytes.length).set(bytes);state.scratch=allocate(64);
   const status=api.open(0,state.input,bytes.length,0,0,state.scratch);if(status!==0)throw Error('Native music decoder rejected source: '+status);
   state.decoder=new DataView(memory.buffer).getUint32(state.scratch,true);if(!state.decoder)throw Error('Native music decoder returned no stream');
   if(api.format(state.decoder,state.scratch,state.scratch+4,state.scratch+8,0,0)!==0)throw Error('Native music format unavailable');
   const view=new DataView(memory.buffer),format=view.getUint32(state.scratch,true),channels=view.getUint32(state.scratch+4,true),sampleRate=view.getUint32(state.scratch+8,true);
   if(format!==5||channels<1||channels>2||sampleRate<8000||sampleRate>192000)throw Error('Unsupported native music format');
   if(api.length(state.decoder,state.scratch+16)!==0)throw Error('Native music length unavailable');
   const granuleFrames=Number(new DataView(memory.buffer).getBigUint64(state.scratch+16,true));
   state.format={channels,sampleRate,granuleFrames};return{...state.format};
  }catch(error){close();throw error;}
 }
 function read(frames){
  if(!Number.isSafeInteger(frames)||frames<1||frames>65536)throw Error('Invalid native music read size');
  const stream=active(),bytes=frames*stream.format.channels*4;
  if((stream.capacity??0)<bytes){if(stream.pcm){api.free(stream.pcm);stream.pcm=0;}stream.pcm=allocate(bytes);stream.capacity=bytes;}
  new DataView(memory.buffer).setBigUint64(stream.scratch+16,0n,true);
  const status=api.read(stream.decoder,stream.pcm,BigInt(frames),stream.scratch+16),count=Number(new DataView(memory.buffer).getBigUint64(stream.scratch+16,true));
  if((status!==0&&status!==-17)||count>frames)throw Error('Native music read failed: '+status);
  // Copy before the next decode/grow can replace the reusable native buffer.
  return{frames:count,eof:count===0,pcm:new Float32Array(new Float32Array(memory.buffer,stream.pcm,count*stream.format.channels))};
 }
 function seek(frame){
  const stream=active();if(!Number.isSafeInteger(frame)||frame<0||frame>stream.format.granuleFrames)throw Error('Invalid native music seek');
  if(api.seek(stream.decoder,BigInt(frame))!==0)throw Error('Native music seek failed');
 }
 return{open,read,seek,close,get memoryBytes(){return memory.buffer.byteLength;},get opened(){return!!state?.decoder;}};
}
