import {createNativeSoundMixer} from './native-sound-mix.js';

// The original browser player uses a 2048-frame ScriptProcessor output too.
// It also works on the plain HTTP tailnet URL, without an AudioWorklet gate.
export function createNativeMusicPlayer(context,base,{onError=error=>console.warn(error.message)}={}){
 const quantum=2048,maximum=8,prefill=4,pending=new Map();let worker,serial=0,generation=0,current,muted=false,disposed=false;
 base=new URL(base,location.href).href;
 function request(message){
  if(disposed)return Promise.reject(Error('Native music player disposed'));
  if(!worker){
   worker=new Worker(new URL('./music-decoder-worker.js',import.meta.url),{type:'module'});
   worker.addEventListener('message',({data})=>{if(data.type!=='response')return;const p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.status==='error'?p.reject(Error(data.error)):p.resolve(data);});
   worker.addEventListener('error',()=>{const error=Error('Native music worker failed');for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();if(current){release(current);current=null;}worker.terminate();worker=null;onError(error);});
  }
  return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Native music worker timed out'));},30000);pending.set(id,{resolve,reject,timer});worker.postMessage({...message,id,base});});
 }
 function release(player){player.active=false;player.node&&(player.node.onaudioprocess=null);player.node?.disconnect();player.mixer?.disconnect();player.queue.length=0;}
 function stop(name){
  if(!current||name!==undefined&&current.name!==name)return;
  const old=current;current=null;release(old);void request({type:'close',generation:old.generation,state:old.lastState}).catch(onError);
 }
 function settings(player){player.mixer?.set({...player.settings,mainVolume:muted?0:1});}
 async function fill(player){
  if(player.filling||!player.active||player.ended)return;player.filling=true;
  try{while(player.active&&!player.ended&&player.queue.length<maximum){const block=await request({type:'read',generation:player.generation,frames:quantum});if(current!==player||!player.active)return;if(block.status!=='pcm')throw Error('Native music stream lost ownership');player.queue.push(block);player.ended=block.ended;}}
  catch(error){if(current===player){stop(player.name);onError(error);}}
  finally{player.filling=false;}
 }
 async function play(name,sound,options={}){
  stop();const player={name,generation:++generation,active:true,queue:[],settings:options,ended:false,filling:false};current=player;
  try{
   const info=sound.nativeSource,opened=await request({type:'open',name,generation:player.generation,url:new URL(info.file,base).href,expected:info,loop:options.loop<0,repeats:Math.max(0,Math.trunc(options.loop??0)-1),outputSampleRate:context.sampleRate,quantum});
   if(current!==player)return;if(opened.status!=='opened')throw Error('Native music source did not open');
   // Prefill before connecting; all later reads are bounded by eight blocks.
   while(player.queue.length<prefill&&!player.ended){const block=await request({type:'read',generation:player.generation,frames:quantum});if(current!==player)return;if(block.status!=='pcm')throw Error('Native music prefill lost ownership');player.queue.push(block);player.ended=block.ended;}
   const node=context.createScriptProcessor(quantum,0,info.channels);player.node=node;
   player.mixer=createNativeSoundMixer(context,node,sound,Math.min(context.destination.maxChannelCount??2,2));settings(player);
   node.onaudioprocess=event=>{
    for(let c=0;c<event.outputBuffer.numberOfChannels;c++)event.outputBuffer.getChannelData(c).fill(0);
    if(current!==player||!player.active)return;
    const block=player.queue.shift();
    if(block)player.lastState=block.state;
    if(block)for(let c=0;c<info.channels;c++){const output=event.outputBuffer.getChannelData(c);for(let i=0;i<quantum;i++)output[i]=block.pcm[i*info.channels+c];}
    if(!player.queue.length&&player.ended){stop(name);return;}
    void fill(player);
   };
   void fill(player);
  }catch(error){if(current===player){stop(name);onError(error);}}
 }
 return{play,stop,prepare(){return request({type:'prepare'});},prefetch(sounds){return request({type:'prefetch',urls:[...new Set(sounds.map(sound=>new URL(sound.nativeSource.file,base).href))]});},setMuted(value){muted=value;if(current)settings(current);},dispose(){if(current){release(current);current=null;}disposed=true;worker?.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Native music player disposed'));}pending.clear();}};
}
