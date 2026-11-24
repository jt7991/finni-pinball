// SPDX-License-Identifier: GPL-3.0-or-later
// Sound player selection/repeat semantics follow VPX AudioPlayer/SoundPlayer.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {nativeSoundRate} from './native-sound.js';
import {createNativeSoundMixer} from './native-sound-mix.js';
import {loadDmdAtlasDisplayBitmap,DMD_ATLAS_FILE} from './dmd-atlas.js';
import {createAudioBufferCache} from './audio-buffer-cache.js';

export function createAudio(manifest,base) {
  let context,muted=false,primed=false,stopEpoch=0,musicSource,musicMixer;
  const musicElement=new Audio();
  const playing=new Map(),music=new Map(),stops=new Map();
  const buffers=createAudioBufferCache(async name=>{
    const response=await fetch(`${base}audio/${manifest[name].file}`);
    if(!response.ok)throw Error(`Audio ${name} unavailable`);
    return context.decodeAudioData(await response.arrayBuffer());
  });
  async function unlock(){
    context??=new AudioContext();const resumed=context.resume();
    // Reuse one gesture-unlocked media element for streamed music on iOS.
    if(!primed){
      primed=true;const bytes=new Uint8Array(1644),view=new DataView(bytes.buffer);
      const text=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
      text(0,'RIFF');view.setUint32(4,1636,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
      view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);
      view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,1600,true);
      const url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));musicElement.src=url;musicElement.volume=0;
      musicElement.play().then(()=>{if(musicElement.src===url)musicElement.pause();URL.revokeObjectURL(url);}).catch(()=>URL.revokeObjectURL(url));
    }
    await resumed;
  }
  function stopPlayer(player){
    player.active=false;
    if(player.source){player.source.onended=null;player.source.stop();player.source.disconnect?.();player.source=null;}
    player.mixer?.disconnect();
  }
  function stop(name){
    if(name===undefined){stopEpoch++;for(const players of playing.values())for(const player of players)stopPlayer(player);playing.clear();for(const element of music.values()){element.pause();element.removeAttribute('src');element.load();}music.clear();musicMixer?.disconnect();musicSource?.disconnect();musicMixer=null;return;}
    name=String(name).toLowerCase();stops.set(name,(stops.get(name)??0)+1);
    const element=music.get(String(name).toLowerCase());if(element){element.pause();element.removeAttribute('src');element.load();music.delete(String(name).toLowerCase());musicMixer?.disconnect();musicSource?.disconnect();musicMixer=null;}
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
    name=String(name).toLowerCase();if(muted||!context||!manifest[name])return;
    let player;
    try{
      if(manifest[name].music){
        for(const old of [...music.keys()])stop(old);
        musicSource??=context.createMediaElementSource(musicElement);
        musicMixer?.disconnect();musicSource.disconnect();
        musicMixer=createNativeSoundMixer(context,musicSource,manifest[name],Math.min(context.destination.maxChannelCount??2,2));musicMixer.set({volume,pan});
        const element=musicElement;element.src=`${base}audio/${manifest[name].file}`;element.loop=loop<0;
        element.volume=1;element.preload='none';music.set(name,element);await element.play();return;
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
  return {unlock,play,stop,setMuted(value){muted=value;if(value)stop();},get muted(){return muted;}};
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
