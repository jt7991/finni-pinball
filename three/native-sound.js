// SPDX-License-Identifier: GPL-3.0-or-later
// SoundPlayer::Play pitch math, Visual Pinball contributors, audio/SoundPlayer.cpp
// at 195f214dd4849b8ef6113fd377258b78d0dec3bf. See licenses/VPX-Physics-NOTICE.txt.
const f=Math.fround;
export function nativePitchFactor(randomPitch,random){
  const amount=f(randomPitch);if(amount<=0)return 1;
  const high=f(random()),low=f(random());
  return f(f(1+f(f(amount*high)*high))-f(f(f(amount*low)*low)*f(.5)));
}
export function nativeSoundRate(sampleRate,pitch=0,factor=1){
  // Script PlaySound receives a LONG pitch offset through COM (ties to even).
  const value=Number(pitch),floor=Math.floor(value),offset=value-floor===.5?floor%2===0?floor:floor+1:Math.round(value);
  return f(f(f(f(sampleRate)+f(offset))*f(factor))/f(sampleRate));
}
