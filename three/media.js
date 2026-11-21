export function createAudio(manifest,base) {
  let context,muted=false,primed=false;
  const musicElement=new Audio();
  const cache=new Map(),decodedBytes=new Map(),playing=new Map(),music=new Map(),loops=new Map();
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
  async function buffer(name){
    if(!cache.has(name))cache.set(name,(async()=>{
      const response=await fetch(`${base}audio/${manifest[name].file}`);
      if(!response.ok)throw Error(`Audio ${name} unavailable`);
      const data=await context.decodeAudioData(await response.arrayBuffer());
      // Bound the retained effect/voice buffers; music streams separately.
      decodedBytes.set(name,data.length*data.numberOfChannels*4);
      let bytes=[...decodedBytes.values()].reduce((a,b)=>a+b,0);
      for(const [key,size]of decodedBytes){if(bytes<=16*1024*1024)break;if(key!==name){cache.delete(key);decodedBytes.delete(key);bytes-=size;}}
      return data;
    })());
    return cache.get(name);
  }
  function stop(name){
    if(name===undefined){for(const sources of playing.values())for(const s of sources)s.stop();playing.clear();loops.clear();for(const element of music.values()){element.pause();element.removeAttribute('src');element.load();}music.clear();return;}
    loops.delete(String(name).toLowerCase());
    const element=music.get(String(name).toLowerCase());if(element){element.pause();element.removeAttribute('src');element.load();music.delete(String(name).toLowerCase());}
    for(const s of playing.get(String(name).toLowerCase())??[])s.stop();playing.delete(String(name).toLowerCase());
  }
  async function play(name,{loop=0,volume=1,pan=0,rate=1}={}){
    name=String(name).toLowerCase();if(muted||!context||!manifest[name])return;
    try{
      if(manifest[name].music){
        for(const old of [...music.keys()])stop(old);
        const element=musicElement;element.src=`${base}audio/${manifest[name].file}`;element.loop=loop===-1;
        element.volume=Math.max(0,Math.min(1,Number(volume)));element.preload='none';music.set(name,element);await element.play();return;
      }
      let loopState;
      if(loop===-1){
        loopState=loops.get(name);
        if(loopState){
          Object.assign(loopState,{volume,pan,rate});
          if(loopState.gain){loopState.gain.gain.value=volume;loopState.panner.pan.value=Math.max(-1,Math.min(1,pan));loopState.source.playbackRate.value=rate;}
          return;
        }
        loopState={volume,pan,rate};loops.set(name,loopState);
      }
      const requested=context.currentTime,data=await buffer(name);
      if(muted||context.currentTime-requested>2&&!loopState||loopState&&loops.get(name)!==loopState)return;
      const source=context.createBufferSource(),gain=context.createGain(),panner=context.createStereoPanner();
      source.buffer=data;source.loop=loop===-1;gain.gain.value=Math.max(0,Math.min(1,Number(loopState?.volume??volume)));
      panner.pan.value=Math.max(-1,Math.min(1,Number(loopState?.pan??pan)));source.playbackRate.value=loopState?.rate??rate;
      if(loopState)Object.assign(loopState,{source,gain,panner});source.connect(gain).connect(panner).connect(context.destination);
      const set=playing.get(name)??new Set();playing.set(name,set);set.add(source);
      source.onended=()=>set.delete(source);source.start();
    }catch(error){console.warn(error.message);}
  }
  return {unlock,play,stop,setMuted(value){muted=value;if(value)stop();},get muted(){return muted;}};
}

export async function createDisplay(canvas,objects,base) {
  const [atlas,sprite]=await Promise.all([
    fetch(`${base}dmd-atlas.json`).then(r=>{if(!r.ok)throw Error('DMD atlas unavailable');return r.json();}),
    new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=`${base}dmd-atlas.png`;}),
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
  return {draw};
}
