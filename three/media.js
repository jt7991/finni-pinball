// SPDX-License-Identifier: GPL-3.0-or-later
// Sound player selection/repeat semantics follow VPX AudioPlayer/SoundPlayer.
// See public/licenses/VPX-Physics-NOTICE.txt.
import {loadDmdAtlasDisplayBitmap,DMD_ATLAS_FILE} from './dmd-atlas.js';
import {createAudioBufferCache} from './audio-buffer-cache.js';
import {createEffectDecoder} from './audio-pcm.js';
import {createNativeAudioPlayer} from './native-audio-player.js';

export function createAudio(manifest,base,options={}) {
  let context,decodeEffect,player,unlocked=false,starting=false,muted=false,disposed=false,initialEvents=[],initialReady=Promise.resolve(),initialPlayback,stopEpoch=0;
  const stopped=new Map();
  const sources=new Map();
  for(const[name,entry]of Object.entries(manifest))if(!entry.music&&!sources.has(entry.file??name))sources.set(entry.file??name,{name,entry});
  const buffers=createAudioBufferCache(async key=>{
    const{name,entry}=sources.get(key),load=async file=>{const response=await fetch(base+'audio/'+file);if(!response.ok)throw Error('Audio '+name+' unavailable');return response.arrayBuffer();};
    const bytes=await load(entry.file);context??=new AudioContext();decodeEffect??=createEffectDecoder(context);
    return decodeEffect(bytes,entry,()=>load(entry.fallbackFile));
  });
  function nativePlayer(){
    context??=new AudioContext();
    if(!player){player=createNativeAudioPlayer(context,base,manifest,{...options,loadBuffer:name=>buffers.get(manifest[name].file??name)});player.setMuted(muted);}
    return player;
  }
  async function unlock(start=false){
    if(disposed)return;starting||=start;context??=new AudioContext();const resumed=context.resume();
    // Early controls may satisfy browser activation while the table is still
    // loading. Its initialization sounds belong to the actual Start action.
    if(options.deferInitialization&&!starting){await resumed;return;}
    unlocked=true;const active=nativePlayer();
    if(!initialPlayback)initialPlayback=(async()=>{await initialReady;for(const event of initialEvents){if(disposed)break;if(event.type==='stop')active.stop(event.name);else if(event.epoch===stopEpoch&&event.stopped===(stopped.get(event.name)??0))await active.play(event.name,event.settings);}initialEvents=[];if(!disposed)await active.activate();})();
    active.prefetchMusic();await Promise.all([resumed,initialPlayback]);
  }
  return {
    prepare:names=>nativePlayer().prepare(names),
    initialize(events){
      if(unlocked||initialPlayback)throw Error('Audio initialization must precede unlock');
      initialEvents=events.filter(e=>e.type==='play'||e.type==='stop').map(e=>({...e,name:e.name===undefined?undefined:String(e.name).toLowerCase(),settings:{...e.settings},epoch:stopEpoch,stopped:stopped.get(String(e.name).toLowerCase())??0}));
      const names=initialEvents.filter(e=>e.type==='play'&&manifest[e.name]).map(e=>e.name);
      initialReady=Promise.all([nativePlayer().prepare(names.filter(n=>!manifest[n].music)),nativePlayer().prepareMusic(names.filter(n=>manifest[n].music))]);return initialReady;
    },
    whenInitialized:()=>initialReady,
    unlock:()=>unlock(),start:()=>unlock(true),
    async play(name,settings={}){name=String(name).toLowerCase();if(!unlocked||disposed||!manifest[name])return;const epoch=stopEpoch,version=stopped.get(name)??0;await initialPlayback;if(!disposed&&epoch===stopEpoch&&version===(stopped.get(name)??0))await nativePlayer().play(name,settings);},
    stop(name){if(name===undefined)stopEpoch++;else{name=String(name).toLowerCase();stopped.set(name,(stopped.get(name)??0)+1);}player?.stop(name);},
    setMuted(value){muted=!!value;player?.setMuted(muted);},get muted(){return muted;},
    dispose(){disposed=true;stopEpoch++;initialEvents=[];player?.dispose();},
  };
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
