// SPDX-License-Identifier: GPL-3.0-or-later
// Authored SoundPlayer reuse and native ma_node/SDL stereo mixing order.
import {nativeSoundMix} from './native-sound-mix.js';
const f=Math.fround,clip=x=>Math.max(-1,Math.min(1,x));

export function createNativeSoundEngine({sampleRate,channels=2,createVoice}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||![1,2].includes(channels)||typeof createVoice!=='function')throw Error('Invalid native sound engine configuration');
 const players=[],names=new Map();let muted=false,frames=0;
 function stop(name){
  const selected=name===undefined?players:names.get(String(name).toLowerCase())??[];
  for(const player of selected){player.active=false;player.voice=null;}
 }
 function play(name,sound,settings={}){
  name=String(name).toLowerCase();if(settings.restart)stop(name);
  const pool=names.get(name)??[];names.set(name,pool);
  let player=pool.find(p=>settings.useExisting||settings.restart||!p.active);
  if(!player){player={id:players.length+1,name,active:false,state:undefined};players.push(player);pool.push(player);}
  player.sound=sound;player.settings={loop:0,volume:1,pan:0,pitch:0,pitchFactor:1,...settings};
  if(player.active)player.voice.update(player.settings);
  else{player.voice=createVoice(name,sound,player.settings,player.state);player.active=true;}
  return player.id;
 }
 function render(){
  const playfield=new Float32Array(2048*channels),backglass=new Float32Array(2048*channels),ended=[];
  // ma_node attaches each new player's output at the head. Reusing a player
  // keeps its original attachment position rather than moving it to the end.
  for(let n=players.length-1;n>=0;n--){
   const player=players[n];if(!player.active)continue;
   const voice=player.voice,block=voice.read(),gain=nativeSoundMix(player.sound,{...player.settings,mainVolume:muted?0:1},channels),target=player.sound.outputTarget==='backglass'?backglass:playfield;
   if(block.frames!==2048||block.pcm.length!==2048*voice.channels)throw Error('Native voice returned a different device quantum');
   for(let i=0;i<2048;i++){
    const left=block.pcm[i*voice.channels],right=block.pcm[i*voice.channels+(voice.channels===1?0:1)];
    if(channels===1){const value=voice.channels===1?f(left*gain.left):f(f(left*gain.left)+f(right*gain.right));target[i]=f(target[i]+value);}
    else{target[i*2]=f(target[i*2]+f(left*gain.left));target[i*2+1]=f(target[i*2+1]+f(right*gain.right));}
   }
   player.state=block.state;if(block.ended){player.active=false;player.voice=null;ended.push({id:player.id,name:player.name,loops:block.loops});}
  }
  // The shared SDL device mixes its playfield stream first, clipping that
  // accumulated stream, then adds backglass and clips the resulting device
  // samples. Clipping backglass before this sum loses audible cancellation.
  const pcm=new Float32Array(2048*channels);for(let i=0;i<pcm.length;i++)pcm[i]=clip(f(clip(playfield[i])+backglass[i]));frames+=2048;
  return{pcm,frames:2048,channels,active:players.filter(p=>p.active).length,ended};
 }
 return{play,stop,render,setMuted(value){muted=!!value;},get stats(){return{players:players.length,active:players.filter(p=>p.active).length,frames};}};
}
