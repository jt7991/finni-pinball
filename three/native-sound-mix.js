// SPDX-License-Identifier: GPL-3.0-or-later
// VPX SoundPlayer::Play/ApplyVolume and vpx_node_process_pcm_frames at
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See VPX-Physics-NOTICE.txt.
const f=Math.fround,clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const percent=value=>clamp(f(f(value??0)/100),-1,1);

export function nativeSoundMix(sound,{volume=1,pan=0,mainVolume=1,mirrored=false}={},channels=2){
 const backglass=sound.outputTarget==='backglass';
 const total=clamp(f(f(percent(sound.volumePercent)+f(volume))*f(mainVolume)),0,1);
 const level=f((backglass?2:1)*f(Math.sqrt(total)));
 const offset=f(percent(sound.panPercent)+f(pan));
 const position=clamp(mirrored?-offset:offset,-1,1);
 const balance=position<0?-f(Math.pow(-position,f(.1))):f(Math.pow(position,f(.1)));
 if(channels===1)return {level,balance,left:backglass?f(level*.5):level,right:backglass?f(level*.5):0};
 return backglass?{level,balance,left:f(level*(balance<0?1:f(1-balance))),right:f(level*(balance>0?1:f(1+balance)))}:
  {level,balance,left:f(f(level*.5)*f(1-balance)),right:f(f(level*.5)*f(1+balance))};
}

// Channel mixing is explicit: native PF decoding is mono; BG decoding is
// stereo with mono duplicated. StereoPanner's constant-power curve differs
// from both original paths. Gain nodes perform the original per-channel
// multiplication without blending stereo backglass channels together.
export function createNativeSoundMixer(context,source,sound,channels=2){
 const backglass=sound.outputTarget==='backglass';
 const input=context.createGain(),splitter=context.createChannelSplitter(backglass?2:1);
 input.channelCount=backglass?2:1;input.channelCountMode='explicit';input.channelInterpretation='speakers';
 const left=context.createGain(),right=context.createGain(),merger=context.createChannelMerger(channels);
 source.connect(input);input.connect(splitter);splitter.connect(left,0);
 if(backglass||channels!==1)splitter.connect(right,backglass?1:0);
 left.connect(merger,0,0);if(backglass||channels!==1)right.connect(merger,0,channels===1?0:1);
 merger.connect(context.destination);
 return {set(settings){const mix=nativeSoundMix(sound,settings,channels);left.gain.value=mix.left;right.gain.value=mix.right;return mix;},
  disconnect(){for(const node of [input,splitter,left,right,merger])node.disconnect();}};
}
