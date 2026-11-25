// SPDX-License-Identifier: GPL-3.0-or-later
// Source-rate decoding and the zero-LPF pitch converter used by VPX music.
// SoundPlayer restarts at the next device block, preserving converter phase.
import {createNativeAudioResampler} from './native-audio-resampler.js';

export function createNativeMusicStream(codec,{channels,sampleRate,outputRate,quantum=2048,loop=false,repeats=0,nativeFrames,state,pitch=1}){
 if(!Number.isInteger(quantum)||quantum<1||quantum>65536)throw Error('Invalid music device quantum');
 if(state&&(state.channels!==channels||state.sampleRate!==sampleRate||state.outputRate!==outputRate||state.quantum!==quantum||!(state.cache instanceof Float32Array)||state.cache.length%channels||state.cache.length>quantum*channels))throw Error('Retained music stream format differs');
 const converter=createNativeAudioResampler(sampleRate,outputRate,channels,state?.converter);
 let sourceFrames=0,loops=0,ended=false,endPending=false,cache=state?.cache.slice()??new Float32Array(),oldPitch=state?.pitch??1;
 function setPitch(value){value=Math.fround(value);if(!(value>0)||value===oldPitch)return;oldPitch=value;converter.setRateRatio(Math.fround(Math.fround(sampleRate/outputRate)*value));}
 setPitch(pitch);
 const snapshot=()=>({channels,sampleRate,outputRate,quantum,pitch:oldPitch,converter:converter.snapshot(),cache:cache.slice()});
 function finish(){
  if(loop||repeats>0){if(!sourceFrames)throw Error('Empty native music cannot loop');codec.seek(0);sourceFrames=0;loops++;repeats--;}
  else ended=true;
 }
 function read(){
  const pcm=new Float32Array(quantum*channels);let written=0;
  if(ended)return{pcm,frames:quantum,ended,loops,state:snapshot()};
  // A source returning zero frames cannot be visited again by the graph in
  // the same device block. Its end callback runs in the following block.
  if(endPending){endPending=false;finish();return{pcm,frames:quantum,ended,loops,state:snapshot()};}
  while(written<quantum){
   // Native ma_sound fills a source cache in device-sized chunks, then keeps
   // unused source frames across Stop/seek-to-zero. Decoder EOF is separate.
   const block=cache.length?null:codec.read(quantum);
   if(block){sourceFrames+=block.frames;cache=block.pcm;}
   if(block?.eof){
    if(nativeFrames!==undefined&&sourceFrames!==nativeFrames)throw Error('Native music EOF differs from source');
    if(written===0)endPending=true;else finish();
    // The native end callback queues a restart. Its remaining device frames
    // stay silent; the next callback retains the converter's prior samples.
    break;
   }
   const result=converter.process(cache,quantum-written);
   cache=cache.subarray(result.inputFrames*channels);
   pcm.set(result.pcm,written*channels);written+=result.outputFrames;
   if(!result.inputFrames&&!result.outputFrames&&!block?.frames)throw Error('Native music converter made no progress');
  }
  return{pcm,frames:quantum,ended,loops,state:snapshot()};
 }
 return{read,setPitch,setLoopCount(count){loop=count<0;repeats=Math.max(0,Math.trunc(count)-1);}};
}
