// Observation-only wrappers for the pinned ScriptGlobalTable COM entries.
// Original function bodies, arguments, return values and device callbacks run
// unchanged. Captured PCM and native state are expectations, never inputs.
export function installNativeSoundTimelineObserver(){
 const data=window.nativeSoundTimeline={events:[],callbacks:[],hooks:[],errors:[],done:false},memories=[];
 let serial=0;
 const clock=()=>{
  const memory=memories.find(m=>m.buffer.byteLength>9191332);if(!memory)return null;
  const v=new DataView(memory.buffer),player=v.getUint32(9191328,true);if(player<65536||player+334772>v.byteLength)return null;
  const physics=v.getUint32(player+333740,true),valid=physics>=65536&&physics+128<=v.byteLength;
  return{ms:v.getUint32(player+40,true),frameIndex:v.getUint32(player+334768,true),cursor:valid?String((v.getBigUint64(physics+112,true)-v.getBigUint64(physics+104,true))/1000n):null,random:[v.getUint32(7661264,true),v.getUint32(7661268,true)]};
 };
 const string=address=>{
  if(!address)return '';
  const memory=memories.find(m=>m.buffer.byteLength>address+512);if(!memory)throw Error('Native BSTR unavailable');
  // This pinned standalone/Wine build uses 32-bit OLECHAR, unlike Windows.
  const v=new DataView(memory.buffer);let text='';for(let i=0;i<256;i++){const code=v.getUint32(address+i*4,true);if(!code)return text;if(code>0x10ffff)throw Error('Invalid native OLECHAR');text+=String.fromCodePoint(code);}throw Error('Unexpected native sound name');
 };
 // Re-exporting an imported function gives Table.set the original Wasm type.
 const leb=n=>{const bytes=[];do{let b=n&127;n>>>=7;if(n)b|=128;bytes.push(b);}while(n);return bytes;},text=s=>[...leb(s.length),...Array.from(s,c=>c.charCodeAt(0))],section=(id,bytes)=>[id,...leb(bytes.length),...bytes];
 const wrapper=(signature,observe,original)=>{
  const binary=new Uint8Array([0,97,115,109,1,0,0,0,...section(1,[1,96,...leb(signature.length),...signature,1,127]),...section(2,[1,...text('env'),...text('call'),0,0]),...section(7,[1,...text('call'),0,0])]);
  return new WebAssembly.Instance(new WebAssembly.Module(binary),{env:{call:(...args)=>{
   let row;if(!data.done)try{row={order:++serial,at:performance.now(),before:clock(),...observe(args)};data.events.push(row);}catch(e){data.errors.push(e.message);}
   const result=original(...args);if(row)row.after=clock();return result;
  }}}).exports.call;
 };
 const hooked=new WeakSet();
 for(const method of ['instantiate','instantiateStreaming']){
  const original=WebAssembly[method];WebAssembly[method]=async function(...args){
   const result=await original.apply(this,args),exports=(result.instance??result).exports??{};
   for(const value of Object.values(exports))if(value instanceof WebAssembly.Memory&&!memories.includes(value))memories.push(value);
   for(const table of Object.values(exports))if(table instanceof WebAssembly.Table&&!hooked.has(table)){
    hooked.add(table);
    for(let i=0;i<table.length;i++){
     const fn=table.get(i),index=Number(fn?.name);if(index!==1304&&index!==1307)continue;
     const play=index===1304,signature=play?[127,127,127,125,125,125,127,127,127,125]:[127,127];
     if(fn.length!==signature.length)throw Error('Native sound entry signature changed');
     table.set(i,wrapper(signature,args=>play?{type:'play',name:string(args[1]).toLowerCase(),settings:{loop:args[2],volume:args[3],pan:args[4],randomPitch:args[5],pitch:args[6],useExisting:!!args[7],restart:!!args[8],frontRearFade:args[9]}}:{type:'stop',name:string(args[1]).toLowerCase()},fn));
     data.hooks.push({functionIndex:index,tableIndex:i,arguments:fn.length});
    }
   }
   return result;
  };
 }
 const create=AudioContext.prototype.createScriptProcessor;
 AudioContext.prototype.createScriptProcessor=function(...args){
  const node=create.apply(this,args),descriptor=Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype,'onaudioprocess');
  Object.defineProperty(node,'onaudioprocess',{set(value){descriptor.set.call(node,value?function(event){
   const before=clock(),order=++serial,result=value.call(this,event);
   if(!data.done){if(data.callbacks.length>=1600){data.errors.push('Native sound callback capture overflow');data.done=true;}else data.callbacks.push({order,before,after:clock(),at:performance.now(),sampleRate:event.outputBuffer.sampleRate,playbackTime:event.playbackTime,pcm:Array.from({length:event.outputBuffer.numberOfChannels},(_,c)=>Array.from(event.outputBuffer.getChannelData(c)))});}
   return result;
  }:value);}});return node;
 };
}
