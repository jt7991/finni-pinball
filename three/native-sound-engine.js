// SPDX-License-Identifier: GPL-3.0-or-later
// Authored SoundPlayer reuse and native ma_node/SDL stereo mixing order.
import {nativeSoundMix} from './native-sound-mix.js';
const f=Math.fround,clip=x=>Math.max(-1,Math.min(1,x));

export function createNativeSoundEngine({sampleRate,channels=2,createVoice}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||![1,2].includes(channels)||typeof createVoice!=='function')throw Error('Invalid native sound engine configuration');
 const players=[],names=new Map();let muted=false,frames=0,sequence=0;
 // Native selection/attachment happens at the script call. Audible voices
 // start at the device boundary; asynchronous source readiness must not
 // reorder their slots or make a pending overlap look like an idle player.
 const selected=name=>name===undefined?players:names.get(String(name).toLowerCase())??[];
 const pending=player=>[...player.pending].some(sequence=>sequence>player.stopSequence);
 function noteStop(name){for(const player of selected(name)){player.requested=false;player.stopSequence=player.requestSequence=++sequence;}}
 function applyStop(name){for(const player of selected(name)){player.active=false;player.voice=null;}}
 function stop(name){noteStop(name);applyStop(name);}
 function reserve(name,settings={}){
  name=String(name).toLowerCase();if(settings.restart)noteStop(name);
  const pool=names.get(name)??[];names.set(name,pool);
  let player=pool.find(p=>settings.useExisting||settings.restart||!p.requested);
  if(!player){player={id:players.length+1,name,active:false,requested:false,initialized:false,state:undefined,pending:new Set(),stopSequence:0};players.push(player);pool.push(player);}
  player.requested=true;player.requestSequence=++sequence;
  player.pending.add(player.requestSequence);
  return{id:player.id,sequence:player.requestSequence};
 }
 function cancel(reservation){const player=players[reservation.id-1];if(!player)return;player.pending.delete(reservation.sequence);if(player.requestSequence===reservation.sequence)player.requested=!!(player.active&&player.appliedSequence>player.stopSequence)||pending(player);}
 function playReserved(reservation,sound,settings={}){
  const player=players[reservation.id-1];if(!player)throw Error('Native sound reservation unavailable');
  player.pending.delete(reservation.sequence);
  const name=player.name;if(settings.restart)applyStop(name);
  player.sound=sound;player.settings={loop:0,volume:1,pan:0,pitch:0,pitchFactor:1,...settings};
  if(player.active)player.voice.update(player.settings);
  else{player.voice=createVoice(name,sound,player.settings,player.state);player.active=true;}
  player.initialized=true;player.appliedSequence=reservation.sequence;
  return player.id;
 }
 function play(name,sound,settings={}){return playReserved(reserve(name,settings),sound,settings);}
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
   player.state=block.state;if(block.ended){player.active=false;player.voice=null;player.requested=pending(player);ended.push({id:player.id,name:player.name,loops:block.loops});}
  }
  // The shared SDL device mixes its playfield stream first, clipping that
  // accumulated stream, then adds backglass and clips the resulting device
  // samples. Clipping backglass before this sum loses audible cancellation.
  const pcm=new Float32Array(2048*channels);for(let i=0;i<pcm.length;i++)pcm[i]=clip(f(clip(playfield[i])+backglass[i]));frames+=2048;
  return{pcm,frames:2048,channels,active:players.filter(p=>p.active).length,ended};
 }
 return{play,reserve,playReserved,cancel,noteStop,applyStop,stop,render,setMuted(value){muted=!!value;},get stats(){return{players:players.filter(p=>p.initialized).length,reserved:players.filter(p=>!p.initialized).length,active:players.filter(p=>p.active).length,frames};}};
}
