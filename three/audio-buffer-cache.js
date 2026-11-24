// Retain decoded effects/voices within the existing budget. In-flight loads
// are shared; failed loads must not permanently silence subsequent requests.
export function createAudioBufferCache(load,limitBytes=16*1024*1024){
 const entries=new Map(),sizes=new Map();let retainedBytes=0;
 function touch(name){const size=sizes.get(name);if(size===undefined)return;sizes.delete(name);sizes.set(name,size);}
 function get(name){
  if(entries.has(name)){touch(name);return entries.get(name);}
  let request;
  request=(async()=>{
   const data=await load(name),size=data.length*data.numberOfChannels*4;sizes.set(name,size);retainedBytes+=size;
   for(const[key,bytes]of sizes){if(retainedBytes<=limitBytes)break;if(key!==name){entries.delete(key);sizes.delete(key);retainedBytes-=bytes;}}
   return data;
  })().catch(error=>{if(entries.get(name)===request)entries.delete(name);throw error;});
  entries.set(name,request);return request;
 }
 return{get,touch};
}
