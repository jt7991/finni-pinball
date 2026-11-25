// SPDX-License-Identifier: GPL-3.0-or-later
// Sound player selection/repeat semantics follow VPX AudioPlayer/SoundPlayer.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {nativeSoundRate} from './native-sound.js';
import {createNativeSoundMixer} from './native-sound-mix.js';
import {loadDmdAtlasDisplayBitmap,DMD_ATLAS_FILE} from './dmd-atlas.js';
import {createAudioBufferCache} from './audio-buffer-cache.js';
import {createEffectDecoder} from './audio-pcm.js';
import {createNativeMusicPlayer} from './native-music-player.js';

export function createAudio(manifest,base) {
  let context,decodeEffect,nativeMusic,unlocked=false,muted=false,prefetched=false,stopEpoch=0;
  const playing=new Map(),stops=new Map(),songs=Object.values(manifest).filter(sound=>sound.music&&sound.nativeSource);
  function musicPlayer(){context??=new AudioContext();if(!nativeMusic){nativeMusic=createNativeMusicPlayer(context,base);nativeMusic.setMuted(muted);}return nativeMusic;}
  const buffers=createAudioBufferCache(async name=>{
    const load=async file=>{const response=await fetch(`${base}audio/${file}`);if(!response.ok)throw Error(`Audio ${name} unavailable`);return response.arrayBuffer();};
    const bytes=await load(manifest[name].file);context??=new AudioContext();decodeEffect??=createEffectDecoder(context);
    return decodeEffect(bytes,manifest[name],()=>load(manifest[name].fallbackFile));
  });
  // Decode during loading without resuming audio or reserving a sound player.
  // A failed preparation remains retryable through the normal playback path.
  const prepare=names=>Promise.allSettled([
    ...names.map(name=>String(name).toLowerCase()).filter(name=>manifest[name]&&!manifest[name].music).map(name=>buffers.get(name)),
    ...(songs.length?[musicPlayer().prepare(),musicPlayer().prefetch(songs.filter(sound=>sound.nativeSource.nativeFrames===32000))]:[]),
  ]);
  async function unlock(){
    context??=new AudioContext();unlocked=true;const resumed=context.resume();
    if(songs.length&&!prefetched){prefetched=true;void musicPlayer().prefetch(songs).catch(()=>{prefetched=false;});}
    await resumed;
  }
  function stopPlayer(player){
    player.active=false;
    if(player.source){player.source.onended=null;player.source.stop();player.source.disconnect?.();player.source=null;}
    player.mixer?.disconnect();
  }
  function stop(name){
    if(name===undefined){stopEpoch++;for(const players of playing.values())for(const player of players)stopPlayer(player);playing.clear();nativeMusic?.stop();return;}
    name=String(name).toLowerCase();stops.set(name,(stops.get(name)??0)+1);
    nativeMusic?.stop(name);
    for(const player of playing.get(name)??[])stopPlayer(player);playing.delete(name);
  }
  function updatePlayer(player,name){
    const {source,mixer,settings}=player;if(!source)return;
    source.loop=settings.loop<0;
    mixer.set(settings);
    source.playbackRate.value=settings.rate*nativeSoundRate(manifest[name].sampleRate??source.buffer.sampleRate,settings.pitch,settings.pitchFactor);
  }
  function startPlayer(player,name,data){
    const source=context.createBufferSource(),mixer=createNativeSoundMixer(context,source,manifest[name],Math.min(context.destination.maxChannelCount??2,2));
    Object.assign(player,{source,mixer});source.buffer=data;updatePlayer(player,name);
    source.onended=()=>{
      if(!player.active||player.source!==source)return;
      source.onended=null;source.disconnect?.();mixer.disconnect();player.source=null;
      if(player.remaining>0){player.remaining--;startPlayer(player,name,data);}else player.active=false;
    };
    source.start();
  }
  async function play(name,{loop=0,volume=1,pan=0,rate=1,pitch=0,pitchFactor=1,useExisting=false,restart=false}={}){
    name=String(name).toLowerCase();if(!unlocked||!context||!manifest[name]||muted&&!manifest[name].music)return;
    let player;
    try{
      if(manifest[name].music){
        if(!manifest[name].nativeSource)throw Error('Original music source metadata unavailable');
        await musicPlayer().play(name,manifest[name],{loop,volume,pan});return;
      }
      // Native AudioPlayer selects the first player for useSame, or the first
      // idle one otherwise. Looping alone does not request reuse. Reserve the
      // player before decoding so rapid useSame calls update one pending voice.
      if(restart)stop(name);
      const players=playing.get(name)??[];playing.set(name,players);
      player=players.find(candidate=>useExisting||!candidate.active);
      if(!player){player={active:false};players.push(player);}
      player.settings={loop,volume,pan,rate,pitch,pitchFactor};player.remaining=Math.max(0,Math.trunc(loop)-1);
      if(player.active){buffers.touch(name);updatePlayer(player,name);await player.pending;return;}
      player.active=true;
      const requested=context.currentTime,epoch=stopEpoch,stopped=stops.get(name)??0;
      const selected=player,loading=(async()=>{
       const data=await buffers.get(name);
      // Native stop applies to requests already issued, even if this web
      // buffer is still fetching/decoding. Later requests remain playable.
       if(!selected.active||muted||epoch!==stopEpoch||stopped!==(stops.get(name)??0)||context.currentTime-requested>2&&selected.settings.loop>=0){selected.active=false;return;}
       startPlayer(selected,name,data);
      })();
      player.pending=loading;await loading;player.pending=null;
    }catch(error){if(player)stopPlayer(player);console.warn(error.message);}
  }
  return {prepare,unlock,play,stop,setMuted(value){muted=value;nativeMusic?.setMuted(value);if(value){stopEpoch++;for(const players of playing.values())for(const player of players)stopPlayer(player);playing.clear();}},get muted(){return muted;}};
}

export async function createDisplay(canvas,objects,base) {
  const [atlas,sprite]=await Promise.all([
    fetch(`${base}dmd-atlas.json`).then(r=>{if(!r.ok)throw Error('DMD atlas unavailable');return r.json();}),
    loadDmdAtlasDisplayBitmap(`${base}${DMD_ATLAS_FILE}`),
  ]);
  canvas.width=1024;canvas.height=256;
  const context=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let last='';
  function draw(){
    const names=Array.from({length:41},(_,i)=>String(objects.get(`digit${String(i+1).padStart(3,'0')}`)?.imagea||'d_empty').toLowerCase()
      .replace(reduced.matches?/_anim\d{2}/g:/$^/,''));
    const state=names.join('|');if(state===last)return;last=state;
    context.fillStyle='#100a04';context.clearRect(0,0,1024,256);context.fillRect(0,0,1024,256);context.imageSmoothingEnabled=false;
    function paint(name,x,y,w,h){const rect=atlas[name];if(rect)context.drawImage(sprite,...rect,x*4,y*4,w*4,h*4);}
    paint(names[40]==='d_empty'?'bkempty':names[40],0,0,256,64);
    for(let i=0;i<40;i++)paint(names[i],8+i%20*12,i<20?6:34,12,22);
  }
  return {draw,dispose(){sprite.close();}};
}
