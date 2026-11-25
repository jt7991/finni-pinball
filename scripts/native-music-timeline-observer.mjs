// Read-only authored state; string comparisons retain the existing numeric
// checkpoint transport without inventing song IDs in the rules runtime.
export const nativeMusicStateFields={
 ...Object.fromEntries(['','mu_hellhouse1','mu_juggernaut','mu_ninjamb','mu_multiball','mu_discomb','mu_discoloops'].map((song,i)=>['musicSong'+i,`Abs(CLng(Song="${song}"))`])),
 musicBrowser:'Abs(CLng(FinniBrowserMusic))',musicPaused:'Abs(CLng(FinniMusicPaused))',musicEnabled:'Abs(CLng(bMusicOn))',musicVolume:'SongVolume',musicLastVolume:'FinniSongVolume',
};

// Observe original stdout bytes before passing fd_write through unchanged.
// No script callback, table byte, clock result, body or RNG is replaced.
export function installNativeMusicTimelineObserver(){
 const data=window.nativeMusicTimeline={events:[],errors:[],imports:[],notReady:0},memories=[],decoders=new Map(),tails=new Map();
 const remember=values=>{for(const value of values)if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);};
 const observe=(fd,iov,count)=>{
  if(window.nativeGameplay?.done||fd!==1&&fd!==2)return;
  const memory=memories.find(m=>m.buffer.byteLength>9191332);if(!memory){data.notReady++;return;}
  const view=new DataView(memory.buffer),decoder=decoders.get(fd)??new TextDecoder();decoders.set(fd,decoder);let text=tails.get(fd)??'';
  for(let i=0;i<count;i++){const address=view.getUint32(iov+i*8,true),size=view.getUint32(iov+i*8+4,true);text+=decoder.decode(new Uint8Array(memory.buffer,address,size),{stream:true});}
  const lines=text.split('\n');tails.set(fd,lines.pop());
  for(const line of lines){
   const ready=line.includes('FINNI_MUSIC_READY'),cue=line.match(/FINNI_MUSIC\|(mu_[a-z0-9]+)?\|(\d+(?:\.\d+)?)/);if(!ready&&!cue)continue;
   const player=view.getUint32(9191328,true);if(player<65536||player+334772>view.byteLength)throw Error('Native music cue has no valid player clock');const physics=view.getUint32(player+333740,true);if(physics<65536||physics+128>view.byteLength)throw Error('Native music cue has no valid physics clock');
   data.events.push({ms:view.getUint32(player+40,true),frameIndex:view.getUint32(player+334768,true),cursor:String((view.getBigUint64(physics+112,true)-view.getBigUint64(physics+104,true))/1000n),type:ready?'ready':'cue',...(cue?{track:cue[1]??'',volumeText:cue[2]}:{}),line});
  }
 };
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];WebAssembly[method]=async function(...args){
  for(const[name,group]of Object.entries(args[1]??{})){
   remember(Object.values(group));const raw=group.fd_write;if(typeof raw!=='function'||raw.nativeMusicTimelineObserver)continue;
   const wrapped=function(...values){try{observe(...values);}catch(error){data.errors.push(String(error));}return raw.apply(this,values);};wrapped.nativeMusicTimelineObserver=true;group.fd_write=wrapped;data.imports.push(name+'.fd_write');
  }
  const result=await original.apply(this,args);remember(Object.values((result.instance??result).exports??{}));return result;
 };}
}
