// SPDX-License-Identifier: GPL-3.0-or-later
// ma_decoder's PCM16 channel mapping and ma_sound's conversion-cache behavior.
// Source samples have already retained the original signed /32768 mapping.
import {createNativeMusicStream} from './native-music-stream.js';
import {nativeSoundRate} from './native-sound.js';

export function createNativePCMVoice(source,sound,outputRate,settings={},state){
 const channels=sound.outputTarget==='backglass'?2:1,inputChannels=source.numberOfChannels;
 if(![1,2].includes(inputChannels)||channels===1&&inputChannels!==1||source.sampleRate!==sound.sampleRate||source.length!==sound.frames)throw Error('PCM voice differs from authored source format');
 let cursor=0;const input=Array.from({length:inputChannels},(_,c)=>source.getChannelData(c));
 const codec={
  read(requested){
   const frames=Math.min(requested,source.length-cursor),pcm=new Float32Array(frames*channels);
   for(let c=0;c<channels;c++){const samples=input[Math.min(c,inputChannels-1)];for(let i=0;i<frames;i++)pcm[i*channels+c]=samples[cursor+i];}
   cursor+=frames;
   // The native S16-to-F32 cache refill reads until its device-sized cache is
   // full. EOF is reported during a partial refill, leaving that partial tail
   // cached but unplayed until a subsequent loop or named-player restart.
   return{frames,pcm,eof:frames<requested};
  },seek(frame){cursor=frame;},
 };
 const rate=options=>Math.fround((options.rate??1)*nativeSoundRate(sound.sampleRate,options.pitch??0,options.pitchFactor??1)),stream=createNativeMusicStream(codec,{channels,sampleRate:sound.sampleRate,outputRate,nativeFrames:source.length,state,pitch:state?.pitch??1});
 let pending=settings,dirty=true;
 function update(options){pending=options;dirty=true;}
 function read(){if(dirty){stream.setPitch(rate(pending));stream.setLoopCount(pending.loop??0);dirty=false;}return stream.read();}
 return{read,update,channels};
}
