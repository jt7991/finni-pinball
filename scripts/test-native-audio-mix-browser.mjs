// Render the actual production mixer graph through WebAudio, using original
// native level/pan parameters as independent inputs to the source mix formula.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {readReferenceFixture} from './reference-physics.mjs';
const [debug,base,output]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync('three/tests/fixtures/vpx-main-native-audio-parameters.json'));
const compiled=readReferenceFixture('three/tests/fixtures/vpx-main-native-audio-mix.json.gz');
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(!message.id)return;const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Page.navigate',{url:new URL('audio.json',base).href});
 const result=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,userGesture:true,expression:`(async()=>{
  const {createNativeSoundMixer}=await import('/three/native-sound-mix.js'),f=Math.fround,results=[];
  for(const row of ${JSON.stringify(fixture.cases)})for(const sourceChannels of [1,2]){
   const context=new OfflineAudioContext(2,256,48000),buffer=context.createBuffer(sourceChannels,256,48000);
   for(let i=0;i<256;i++){buffer.getChannelData(0)[i]=f(Math.sin(i*.13)*.4);if(sourceChannels===2)buffer.getChannelData(1)[i]=f(Math.cos(i*.19)*.25);}
   const source=context.createBufferSource();source.buffer=buffer;const mixer=createNativeSoundMixer(context,source,{outputTarget:row.outputTarget});mixer.set(row);source.start();
   const audio=await context.startRendering(),native=row.observed,backglass=row.outputTarget==='backglass';
   const left=backglass?f(native.level*(native.balance<0?1:f(1-native.balance))):f(f(native.level*.5)*f(1-native.balance));
   const right=backglass?f(native.level*(native.balance>0?1:f(1+native.balance))):f(f(native.level*.5)*f(1+native.balance));
   let different=0,maxError=0;
   for(let i=0;i<256;i++)for(let channel=0;channel<2;channel++){
    const input=backglass?buffer.getChannelData(sourceChannels===1?0:channel)[i]:sourceChannels===1?buffer.getChannelData(0)[i]:f(f(buffer.getChannelData(0)[i]*.5)+f(buffer.getChannelData(1)[i]*.5));
    const expected=f(input*(channel?right:left)),actual=audio.getChannelData(channel)[i];if(expected!==actual)different++;maxError=Math.max(maxError,Math.abs(expected-actual));
   }
   mixer.disconnect();results.push({target:row.outputTarget,volume:row.volume,pan:row.pan,sourceChannels,samples:512,different,maxError});
  }
  const compiled=[];
  for(const row of ${JSON.stringify(compiled.cases)}){
   const context=new OfflineAudioContext(2,256,48000),buffer=context.createBuffer(row.inputChannels,256,48000),source=context.createBufferSource();
   for(let i=0;i<256;i++)for(let channel=0;channel<row.inputChannels;channel++)buffer.getChannelData(channel)[i]=row.inputs[i*row.inputChannels+channel];
   source.buffer=buffer;const mixer=createNativeSoundMixer(context,source,{outputTarget:row.outputTarget});mixer.set(row);source.start();
   const audio=await context.startRendering();let different=0,maxError=0;
   for(let i=0;i<256;i++)for(let channel=0;channel<2;channel++){const actual=audio.getChannelData(channel)[i],expected=row.output[i*2+channel];if(actual!==expected)different++;maxError=Math.max(maxError,Math.abs(actual-expected));}
   mixer.disconnect();compiled.push({target:row.outputTarget,volume:row.volume,pan:row.pan,samples:512,different,maxError});
  }
  const {createAudio}=await import('/three/media.js'),manifest=await(await fetch('/three/audio.json')).json(),name=Object.keys(manifest).find(name=>manifest[name].music),OriginalContext=window.AudioContext,contexts=[],gains=[],elements=[];
  window.AudioContext=class extends OriginalContext{constructor(){super();contexts.push(this);const gain=this.createGain.bind(this),media=this.createMediaElementSource.bind(this);this.createGain=()=>{const node=gain();gains.push(node);return node;};this.createMediaElementSource=element=>{elements.push(element);return media(element);};}};
  const audio=createAudio(manifest,'/three/');let music;
  try{await audio.unlock();await audio.play(name,{volume:.37,pan:.03125,loop:-1});music={name,sources:elements.length,elementVolume:elements[0].volume,elementLoop:elements[0].loop,playing:!elements[0].paused,left:gains.at(-2).gain.value,right:gains.at(-1).gain.value};}
  finally{audio.stop();await Promise.all(contexts.map(context=>context.close()));window.AudioContext=OriginalContext;}
  return{results,compiled,music};
 })()`});
 assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));const r=result.result.value;
 fs.writeFileSync(output+'/native-audio-mix-browser.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));
 assert.equal(r.results.length,24);for(const row of r.results){assert.equal(row.different,0,JSON.stringify(row));assert.equal(row.maxError,0);}
 assert.equal(r.compiled.length,12);for(const row of r.compiled){assert.equal(row.different,0,JSON.stringify(row));assert.equal(row.maxError,0);}
 const native=fixture.cases.find(row=>row.outputTarget==='backglass'&&row.volume===.37&&row.pan===.03125).observed;
 assert.equal(r.music.sources,1);assert.equal(r.music.elementVolume,1);assert.equal(r.music.elementLoop,true);assert.equal(r.music.playing,true);
 assert.equal(r.music.left,Math.fround(native.level*Math.fround(1-native.balance)));assert.equal(r.music.right,native.level);
}finally{socket.close();}
