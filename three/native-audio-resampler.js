// SPDX-License-Identifier: GPL-3.0-or-later
// VPX ma_linear_resampler with its engine pitch path's zero LPF order.
// Integer phase and every Float32 interpolation boundary follow miniaudio.
const f=Math.fround;
export function createNativeAudioResampler(inputRate,outputRate,channels,state){
 if(!Number.isInteger(inputRate)||inputRate<1||!Number.isInteger(outputRate)||outputRate<1||![1,2].includes(channels))throw Error('Invalid native audio resampler format');
 const reduced=(input,output)=>{let a=input,b=output;while(b){const c=a%b;a=b;b=c;}return[input/a,output/a];};
 let[numerator,denominator]=reduced(state?.inputRate??inputRate,state?.outputRate??outputRate),advanceInt=Math.floor(numerator/denominator),advanceFrac=numerator%denominator;
 let timeInt=1,timeFrac=0;const previous=new Float32Array(channels),next=new Float32Array(channels);
 if(state){
  if(!Number.isInteger(state.timeInt)||state.timeInt<0||state.timeInt>0xffffffff||!Number.isInteger(state.timeFrac)||state.timeFrac<0||state.timeFrac>=denominator||state.previous?.length!==channels||state.next?.length!==channels)throw Error('Invalid retained music converter state');
  timeInt=state.timeInt;timeFrac=state.timeFrac;previous.set(state.previous);next.set(state.next);
 }
 function setRate(input,output){
  if(!Number.isInteger(input)||input<1||input>0xffffffff||!Number.isInteger(output)||output<1||output>0xffffffff)throw Error('Invalid native audio rate change');
  const oldDenominator=denominator;[numerator,denominator]=reduced(input,output);advanceInt=Math.floor(numerator/denominator);advanceFrac=numerator%denominator;
  // The original integer timer rescales its fractional phase with uint32
  // multiplication, including its wrap before division at large rates.
  const whole=Math.floor(timeFrac/oldDenominator),fraction=timeFrac%oldDenominator;
  timeFrac=((Math.imul(whole,denominator)>>>0)+Math.floor((Math.imul(fraction,denominator)>>>0)/oldDenominator))>>>0;
  timeInt=(timeInt+Math.floor(timeFrac/denominator))>>>0;timeFrac%=denominator;
 }
 function setRateRatio(value){
  const ratio=f(value),input=Math.trunc(f(ratio*1000));if(!Number.isFinite(ratio)||ratio<=0||input<1||input>0xffffffff)return false;
  // ma_resampler's public ratio path quantizes to 1000 (the backend's own
  // separate ratio helper uses a different denominator and is not this path).
  setRate(input,1000);return true;
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
 return{process,requiredInputFrames,setRate,setRateRatio,snapshot:()=>({inputRate:numerator,outputRate:denominator,timeInt,timeFrac,previous:[...previous],next:[...next]})};
}
