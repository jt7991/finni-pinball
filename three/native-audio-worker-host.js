// One device timeline for native PCM effects and original Vorbis music.
import {createNativePCMVoice} from './native-pcm-voice.js';
import {createNativeMusicStream} from './native-music-stream.js';
import {createNativeSoundEngine} from './native-sound-engine.js';
import {nativeSoundRate} from './native-sound.js';

export function createNativeAudioWorkerHost(send,{loadCodec,loadMusicSource,pcmBudget=16*1024*1024,musicBudget=24*1024*1024}){
 let manifest,base,engine,sampleRate,codec,codecPromise,disposed=false,currentSource,currentMusic,pcmBytes=0,musicBytes=0,sourceSerial=0;
 const pcm=new Map(),music=new Map(),commands=[];
 const touch=(cache,key)=>{const value=cache.get(key);if(value){cache.delete(key);cache.set(key,value);}return value;};
 async function ensureCodec(){
  if(codec)return codec;if(!codecPromise){const task=Promise.resolve().then(loadCodec).then(value=>{if(disposed){value.close();throw Error('Audio worker disposed');}return codec=value;});codecPromise=task;task.catch(()=>{if(codecPromise===task)codecPromise=null;});}return codecPromise;
 }
 function sound(name){const entry=manifest?.[name];if(!entry)throw Error('Unknown authored sound: '+name);return entry;}
 async function prepareMusic(name){
  const entry=sound(name);if(!entry.music||!entry.nativeSource)throw Error('Original music source unavailable');const key=entry.nativeSource.file,cached=touch(music,key);
  const [,bytes]=await Promise.all([ensureCodec(),cached?cached.bytes:loadMusicSource(new URL(key,base).href)]);if(disposed)throw Error('Audio worker disposed');
  if(cached)return cached;if(bytes.byteLength>musicBudget)throw Error('Music source exceeds compressed cache budget');
  const existing=touch(music,key);if(existing)return existing;
  while(musicBytes+bytes.byteLength>musicBudget&&music.size){const oldest=music.keys().next().value;musicBytes-=music.get(oldest).bytes.byteLength;music.delete(oldest);}
  const result={key,bytes};music.set(key,result);musicBytes+=bytes.byteLength;return result;
 }
 function register(data){
  const existing=touch(pcm,data.key);if(existing)return existing;
  const {channels,frames,rate}=data;if(!Array.isArray(channels)||![1,2].includes(channels.length)||!Number.isInteger(frames)||frames<1||!Number.isInteger(rate)||rate<8000||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('Invalid original PCM registration');
  const bytes=channels.reduce((n,c)=>n+c.byteLength,0);if(bytes>pcmBudget)throw Error('PCM source exceeds decoded cache budget');
  const evicted=[];while(pcmBytes+bytes>pcmBudget&&pcm.size){const key=pcm.keys().next().value;pcmBytes-=pcm.get(key).bytes;pcm.delete(key);evicted.push(key);}
  const result={key:data.key,id:++sourceSerial,bytes,source:{numberOfChannels:channels.length,length:frames,sampleRate:rate,getChannelData:c=>channels[c]}};pcm.set(data.key,result);pcmBytes+=bytes;
  if(evicted.length&&!disposed)send({type:'evicted',keys:evicted});return result;
 }
 function makeVoice(name,entry,settings,state){
  if(!entry.music){const source=currentSource.source;return createNativePCMVoice(source,{...entry,sampleRate:entry.sampleRate??source.sampleRate,frames:entry.frames??source.length},sampleRate,settings,state);}
  const info=entry.nativeSource,format=codec.open(new Uint8Array(currentSource.bytes));
  for(const key of ['channels','sampleRate','granuleFrames'])if(format[key]!==info[key])throw Error('Music format differs from original: '+key);
  const pitch=options=>Math.fround((options.rate??1)*nativeSoundRate(format.sampleRate,options.pitch??0,options.pitchFactor??1)),stream=createNativeMusicStream(codec,{...format,outputRate:sampleRate,nativeFrames:info.nativeFrames,state,pitch:state?.pitch??1});let pending=settings,dirty=true;
  const update=options=>{pending=options;dirty=true;},read=()=>{if(dirty){stream.setPitch(pitch(pending));stream.setLoopCount(pending.loop??0);dirty=false;}return stream.read();};return{channels:format.channels,read,update};
 }
 async function receive(message,reply=send){
  const {id,type}=message;
  const respond=(id,fields,transfer=[])=>{if(!disposed)reply({type:'response',id,requestType:type,name:message.name,...fields},transfer);};
  try{
   if(disposed)throw Error('Audio worker disposed');
   if(type==='audio-init'){
    if(engine)throw Error('Audio worker already initialized');manifest=message.manifest;base=message.base;sampleRate=message.sampleRate;engine=createNativeSoundEngine({sampleRate,channels:2,createVoice:makeVoice});respond(id,{status:'initialized'});return;
   }
   if(!engine)throw Error('Audio worker not initialized');
   if(type==='register-effect'){const source=register(message.source);respond(id,{status:'registered',key:source.key,sourceID:source.id});return;}
   if(type==='play-effect'){
    const entry=sound(message.name);if(entry.music)throw Error('Music requires original source preparation');const source=message.source?register(message.source):touch(pcm,message.key);
    if(!source){respond(id,{status:'need-source'});return;}
    commands.push({type:'play',name:message.name,entry,settings:message.settings,source});respond(id,{status:'queued',key:source.key,sourceID:source.id});return;
   }
   if(type==='prepare-music'){await prepareMusic(message.name);respond(id,{status:'prepared'});return;}
   if(type==='prefetch-music'){const failed=[];for(const name of message.names)try{await prepareMusic(name);}catch{failed.push(name);}respond(id,{status:'prefetched',failed});return;}
   if(type==='play-music'){
    const entry=sound(message.name),source=touch(music,entry.nativeSource?.file);if(!codec||!source){respond(id,{status:'need-source'});return;}
    commands.push({type:'play',name:message.name,entry,settings:message.settings,source});respond(id,{status:'queued'});return;
   }
   if(type==='stop'||type==='mute'){commands.push(message);respond(id,{status:'queued'});return;}
   if(type==='render'){
    const applied=[],warnings=[];
    for(const command of commands.splice(0))try{
     if(command.type==='stop'){engine.stop(command.name);if(command.name===undefined||command.name===currentMusic)currentMusic=undefined;applied.push({type:'stop',name:command.name});}
     else if(command.type==='mute'){engine.setMuted(command.value);applied.push({type:'mute',value:command.value});}
     else{
      currentSource=command.source;
      if(command.entry.music&&currentMusic&&!(command.settings?.useExisting&&currentMusic===command.name))engine.stop(currentMusic);
      const playerID=engine.play(command.name,command.entry,command.settings);if(command.entry.music)currentMusic=command.name;
      applied.push({type:'play',name:command.name,playerID,sourceID:command.source.id,key:command.source.key});
     }
    }catch(error){if(command.entry?.music){musicBytes-=music.get(command.source.key)?.bytes.byteLength??0;music.delete(command.source.key);}warnings.push({name:command.name,error:String(error.message??error)});}
    currentSource=undefined;const block=engine.render();respond(id,{status:'pcm',...block,applied,warnings},[block.pcm.buffer]);return;
   }
   if(type==='stats'){respond(id,{status:'stats',...engine.stats,pcmBytes,musicBytes,queued:commands.length,codecBytes:codec?.memoryBytes??0});return;}
   if(type==='dispose'){commands.length=0;engine.stop();codec?.close();respond(id,{status:'disposed'});disposed=true;return;}
   throw Error('Unknown native audio worker command');
  }catch(error){respond(id,{status:'error',error:String(error.message??error)});}
 }
 return{receive};
}
