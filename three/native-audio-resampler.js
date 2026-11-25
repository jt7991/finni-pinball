// SPDX-License-Identifier: GPL-3.0-or-later
// VPX ma_linear_resampler with its engine pitch path's zero LPF order.
// Integer phase and every Float32 interpolation boundary follow miniaudio.
const f=Math.fround;
export function createNativeAudioResampler(inputRate,outputRate,channels,state){
 if(!Number.isInteger(inputRate)||inputRate<1||!Number.isInteger(outputRate)||outputRate<1||![1,2].includes(channels))throw Error('Invalid native audio resampler format');
 let a=inputRate,b=outputRate;while(b){const c=a%b;a=b;b=c;}const denominator=outputRate/a,numerator=inputRate/a,advanceInt=Math.floor(numerator/denominator),advanceFrac=numerator%denominator;
 let timeInt=1,timeFrac=0;const previous=new Float32Array(channels),next=new Float32Array(channels);
 if(state){
  if(!Number.isInteger(state.timeInt)||state.timeInt<0||state.timeInt>advanceInt+1||!Number.isInteger(state.timeFrac)||state.timeFrac<0||state.timeFrac>=denominator||state.previous?.length!==channels||state.next?.length!==channels)throw Error('Invalid retained music converter state');
  timeInt=state.timeInt;timeFrac=state.timeFrac;previous.set(state.previous);next.set(state.next);
 }
 function requiredInputFrames(frames){if(!Number.isSafeInteger(frames)||frames<0)throw Error('Invalid output frame count');return frames===0?0:timeInt+(frames-1)*advanceInt+Math.floor((timeFrac+(frames-1)*advanceFrac)/denominator);}
 function process(input,capacity){
  if(!(input instanceof Float32Array)||input.length%channels||!Number.isSafeInteger(capacity)||capacity<0)throw Error('Invalid resampler input');
  const pcm=new Float32Array(capacity*channels),available=input.length/channels;let consumed=0,produced=0;
  while(produced<capacity){
   while(timeInt>0&&consumed<available){for(let c=0;c<channels;c++){previous[c]=next[c];next[c]=input[consumed*channels+c];}consumed++;timeInt--;}
   if(timeInt>0)break;
   const weight=f(f(timeFrac)/f(denominator));for(let c=0;c<channels;c++)pcm[produced*channels+c]=f(previous[c]+f(f(next[c]-previous[c])*weight));produced++;
   timeInt+=advanceInt;timeFrac+=advanceFrac;if(timeFrac>=denominator){timeFrac-=denominator;timeInt++;}
  }
  return{inputFrames:consumed,outputFrames:produced,pcm:produced===capacity?pcm:pcm.slice(0,produced*channels)};
 }
 return{process,requiredInputFrames,snapshot:()=>({timeInt,timeFrac,previous:[...previous],next:[...next]})};
}
