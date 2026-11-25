// Shared browser device output. A single prepared block keeps effects and
// music on the same native timeline while controls enter the following block.
import {createNativeAudioLocalTransport} from './native-audio-local-transport.js';
export function createNativeAudioPlayer(context,base,manifest,{loadBuffer,onError=error=>console.warn(error.message),onEnded=()=>{},workerFactory}={}){
 base=new URL(base,globalThis.location?.href??'http://localhost/').href;
 const factory=workerFactory??(()=>createNativeAudioLocalTransport(base));
 let worker,initializing,node,nextBlock,inFlight=false,serial=0,epoch=0,musicTicket=0,musicName,muted=false,disposed=false,prefetching,outputGeneration=0;
 const pending=new Map(),registered=new Set(),stops=new Map(),songs=[...new Map(Object.entries(manifest).filter(([,e])=>e.music&&e.nativeSource).map(([name,e])=>[e.nativeSource.file,name])).values()];
 function detach(){if(node){node.onaudioprocess=null;node.disconnect();node=null;}nextBlock=undefined;inFlight=false;outputGeneration++;}
 function spawn(){
  if(worker)return;worker=factory();const active=worker;
  active.addEventListener('message',({data})=>{
   if(worker!==active)return;if(data.type==='evicted'){for(const key of data.keys)registered.delete(key);return;}
   if(data.type==='audio-render'){for(const warning of data.warnings??[])onError(Error(warning.error));for(const event of data.ended??[])onEnded(event);return;}
   if(data.type!=='response')return;const task=pending.get(data.id);if(!task)return;pending.delete(data.id);clearTimeout(task.timer);data.status==='error'?task.reject(Error(data.error)):task.resolve(data);
  });
  active.addEventListener('error',()=>{if(worker!==active)return;const error=Error('Native audio worker failed');detach();active.terminate();worker=undefined;initializing=undefined;registered.clear();for(const task of pending.values()){clearTimeout(task.timer);task.reject(error);}pending.clear();onError(error);});
 }
 function request(message,transfer=[]){
  if(disposed)return Promise.reject(Error('Native audio disposed'));spawn();
  return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Native audio worker timed out'));},30000);pending.set(id,{resolve,reject,timer});worker.postMessage({...message,id,base},transfer);});
 }
 function ready(){
  if(!initializing){const task=request({type:'audio-init',manifest,sampleRate:context.sampleRate}).then(async()=>{if(muted)await request({type:'mute',value:true});});initializing=task;task.catch(()=>{if(initializing===task)initializing=undefined;});}return initializing;
 }
 function source(name,buffer){return{key:manifest[name].file??name,frames:buffer.length,rate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c).slice())};}
 function sendSource(type,name,buffer,settings){const data=source(name,buffer);return request({type,name,source:data,settings},data.channels.map(c=>c.buffer));}
 async function pump(){
  if(inFlight||disposed||!node)return;inFlight=true;const generation=outputGeneration;
  try{const block=await request({type:'render'});if(generation!==outputGeneration)return;if(block.status!=='pcm'||block.frames!==2048||block.channels!==2)throw Error('Native audio output format differs');nextBlock=block;for(const warning of block.warnings??[])onError(Error(warning.error));for(const event of block.ended??[])onEnded(event);}
  catch(error){if(!disposed&&generation===outputGeneration)onError(error);}
  finally{if(generation===outputGeneration)inFlight=false;}
 }
 function output(){
  if(node)return;node=context.createScriptProcessor(2048,0,2);let first=true;
  node.onaudioprocess=event=>{
   let block=nextBlock;nextBlock=undefined;
   // SDL fills the first device callback from already queued startup sounds,
   // then retains the following block. There is no initial silent quantum.
   if(first&&worker?.renderSync)try{block=worker.renderSync();}catch(error){onError(error);}first=false;
   for(let c=0;c<2;c++){const destination=event.outputBuffer.getChannelData(c);if(block)for(let i=0;i<2048;i++)destination[i]=block.pcm[i*2+c];else destination.fill(0);}
   if(worker?.renderSync){try{nextBlock=worker.renderSync();}catch(error){onError(error);}}else void pump();
  };
  node.connect(context.destination);
 }
 async function play(name,settings={}){
  name=String(name).toLowerCase();const entry=manifest[name];if(!entry||disposed)return;
  if(entry.music){
   if(musicName)stop(musicName);const ticket=++musicTicket;musicName=name;
   try{await ready();await request({type:'prepare-music',name});if(ticket!==musicTicket||disposed)return;const result=await request({type:'play-music',name,settings});if(result.status!=='queued')throw Error('Prepared music source was evicted');output();}catch(error){if(!disposed&&ticket===musicTicket)onError(error);}return;
  }
  if(settings.restart)stop(name);
  const started=context.currentTime,version=epoch,stopped=stops.get(name)??0,valid=()=>!disposed&&version===epoch&&stopped===(stops.get(name)??0)&&!(context.currentTime-started>2&&(settings.loop??0)>=0);
  try{
   const [,buffer]=await Promise.all([ready(),loadBuffer(name)]);if(!valid())return;
   const key=entry.file??name;let result=registered.has(key)?await request({type:'play-effect',name,key,settings}):await sendSource('play-effect',name,buffer,settings);
   if(result.status==='need-source'){if(!valid())return;result=await sendSource('play-effect',name,buffer,settings);}
   if(result.status!=='queued')throw Error('Native effect was not queued');registered.add(key);output();
  }catch(error){if(valid())onError(error);}
 }
 function stop(name){
  if(name===undefined){epoch++;musicTicket++;musicName=undefined;}
  else{name=String(name).toLowerCase();stops.set(name,(stops.get(name)??0)+1);if(musicName===name){musicName=undefined;musicTicket++;}}
  if(worker&&!disposed)void request({type:'stop',name}).catch(error=>{if(!disposed)onError(error);});
 }
 function prepare(names){
  const effects=names.map(n=>String(n).toLowerCase()).filter(n=>manifest[n]&&!manifest[n].music).map(async name=>{const [,buffer]=await Promise.all([ready(),loadBuffer(name)]),result=await sendSource('register-effect',name,buffer);if(result.status!=='registered')throw Error('Native effect preparation failed');registered.add(result.key);return result;});
  const initial=songs.filter(name=>manifest[name].nativeSource.nativeFrames===32000).map(async name=>{await ready();return request({type:'prepare-music',name});});return Promise.allSettled([...effects,...initial]);
 }
 function prefetchMusic(){if(!songs.length||prefetching)return;prefetching=ready().then(()=>request({type:'prefetch-music',names:songs}));prefetching.catch(()=>{prefetching=undefined;});}
 const prepareMusic=names=>Promise.allSettled(names.map(async name=>{await ready();return request({type:'prepare-music',name:String(name).toLowerCase()});}));
 return{play,stop,prepare,prepareMusic,prefetchMusic,async activate(){await ready();output();},setMuted(value){muted=!!value;if(worker&&!disposed)void request({type:'mute',value:muted}).catch(error=>{if(!disposed)onError(error);});},async stats(){await ready();return request({type:'stats'});},dispose(){disposed=true;epoch++;musicTicket++;detach();worker?.terminate();worker=undefined;for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Native audio disposed'));}pending.clear();}};
}
