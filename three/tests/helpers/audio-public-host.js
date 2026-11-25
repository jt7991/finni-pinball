import {createAudio} from '../../media.js';import {createNativeAudioWorkerHost} from '../../native-audio-worker-host.js';
export const settle=()=>new Promise(resolve=>setImmediate(resolve));
export function pcmBuffer(length=6301,sampleRate=22050,numberOfChannels=1){const data=Array.from({length:numberOfChannels},(_,c)=>Float32Array.from({length},(_,i)=>Math.fround(Math.sin(i*.037+c)*.5)));return{length,sampleRate,numberOfChannels,getChannelData:c=>data[c]};}
export async function withAudio(run,{deferred=false}={}){
 const originals={AudioContext:globalThis.AudioContext,fetch:globalThis.fetch},decoded=Promise.withResolvers(),decoding=Promise.withResolvers(),workers=[],nodes=[],responses=[],errors=[],ended=[],requests=[];let context;
 class Worker extends EventTarget{
  constructor(){super();workers.push(this);this.host=createNativeAudioWorkerHost(data=>{responses.push(data);queueMicrotask(()=>{if(!this.terminated)this.dispatchEvent(new MessageEvent('message',{data}));});},{loadCodec:()=>{throw Error('No authored music in this effect-only fixture');},loadMusicSource:()=>{throw Error('No music source requested');}});}
  postMessage(message){requests.push(message);queueMicrotask(()=>{if(!this.terminated)void this.host.receive(message);});}
  terminate(){this.terminated=true;void this.host.receive({type:'dispose'});}
 }
 globalThis.AudioContext=class{
  constructor(){context=this;}sampleRate=48000;currentTime=0;state='suspended';destination={};
  resume(){this.state='running';return Promise.resolve();}
  decodeAudioData(){decoding.resolve();return deferred?decoded.promise:Promise.resolve(pcmBuffer());}
  createBuffer(channels,length,rate){return pcmBuffer(length,rate,channels);}
  createScriptProcessor(...args){const node={args,connect(){this.connected=true;},disconnect(){this.connected=false;}};nodes.push(node);return node;}
 };
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
 const audio=createAudio({effect:{file:'effect.m4a',sampleRate:22050}},'/three/',{workerFactory:()=>new Worker(),onError:e=>errors.push(e.message),onEnded:event=>ended.push(event)});let diagnosticID=900000;
 const stats=async()=>{await settle();const id=++diagnosticID;await workers[0].host.receive({type:'stats',id});return responses.find(r=>r.id===id);};
 const tick=async(count=1)=>{let output;for(let n=0;n<count;n++){const node=nodes[0],channels=[new Float32Array(2048),new Float32Array(2048)];if(node?.connected)node.onaudioprocess?.({outputBuffer:{getChannelData:c=>channels[c]}});context.currentTime+=2048/48000;await settle();output=channels;}return output;};
 try{await audio.unlock();await run({audio,workers,nodes,responses,requests,errors,ended,decoded,decoding,tick,stats,context,buffer:pcmBuffer});}
 finally{audio.dispose();decoded.resolve(pcmBuffer());await settle();Object.assign(globalThis,originals);}
}
