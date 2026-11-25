import fs from 'node:fs';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const [debug,base,output]=process.argv.slice(2),bytes=fs.readFileSync('three/tests/fixtures/vpx-main-6f8116d-cold-audio-native.json.gz');assert.equal(createHash('sha256').update(bytes).digest('hex'),'dc4d73c8a2a026795d9659d76791d001f759b629e177186e35b13160cac14d5d');const fixture=JSON.parse(gunzipSync(bytes));
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map();
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(!data.id)return;const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await call('Page.enable');await call('Page.navigate',{url:new URL('audio.json',base).href});
 const result=await call('Runtime.evaluate',{awaitPromise:true,returnByValue:true,userGesture:true,expression:`(async()=>{
  const {createAudio}=await import('/three/media.js'),{createRuntimeGame}=await import('/three/game-runtime.js'),[manifest,source]=await Promise.all(['audio.json','source-table.json'].map(name=>fetch('/three/'+name).then(response=>response.json())));
  const NativeContext=window.AudioContext,context=new NativeContext({sampleRate:48000}),captures=[],logs=[],warnings=[];let outputs=0,game;
  await context.suspend();window.AudioContext=class{constructor(){return context;}};const create=context.createScriptProcessor.bind(context);
  context.createScriptProcessor=(...args)=>{const node=create(...args),descriptor=Object.getOwnPropertyDescriptor(ScriptProcessorNode.prototype,'onaudioprocess');outputs++;Object.defineProperty(node,'onaudioprocess',{set(value){descriptor.set.call(node,value?function(event){value(event);if(captures.length<96)captures.push(Array.from({length:2},(_,channel)=>[...event.outputBuffer.getChannelData(channel)]));}:null);}});return node;};
  const audio=createAudio(manifest,'/three/',{deferInitialization:true,sourceBank:true,prepareAllMusic:false,onError:error=>warnings.push(error.message)});
  try{
   game=await createRuntimeGame('/three/',()=>{},{...audio,log:text=>logs.push(text)});await Promise.all([audio.prepareSources(),audio.whenInitialized()]);const before={state:context.state,outputs,time:game.time};
   await audio.unlock();await game.prepareStart(1,{browserMusic:true});await audio.start();await game.flush();
   for(let n=0;n<1200&&captures.length<96;n++)await new Promise(resolve=>setTimeout(resolve,10));if(captures.length!==96)throw Error('Incomplete actual startup output');
   return{source,before,outputs,time:game.time,logs,warnings,captures};
  }finally{await game?.dispose();audio.dispose();await context.close();window.AudioContext=NativeContext;}
 })()`});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));const report=result.result.value;
 fs.writeFileSync(output+'/current-startup-audio-browser.json',JSON.stringify({base,...report,scope:'Actual simulation worker, complete current authored rules, public source-bank audio and real ScriptProcessor output. Initialization and the ordinary Start key are staged before device activation. Physics deliberately stays paused at zero, matching the separately observed native startup phase. Browser music is handed off in the rules; its separate HTML output is outside this SDL-only sample comparison. No native PCM, cursors, bodies or RNG are supplied as inputs.'},null,2),{flag:'wx'});
 assert.equal(report.source.sourceTableSHA256,fixture.sourceSHA256);assert.equal(report.before.outputs,0);assert.equal(report.before.state,'suspended');assert.equal(report.before.time,0);assert.equal(report.outputs,1);assert.equal(report.time,0);assert.deepEqual(report.warnings,[]);assert.ok(report.logs.some(line=>line.startsWith('FINNI_MUSIC|mu_hellhouse1|')));
 for(let n=0;n<96;n++)for(let c=0;c<2;c++)for(let i=0;i<2048;i++)assert.equal(report.captures[n][c][i],fixture.frames[n].pcm[c][i],'Current native browser startup block '+n+' channel '+c+' sample '+i);
 console.log(JSON.stringify({pass:true,actualWorker:true,scalarSamples:393216,physicsTime:report.time,warnings:report.warnings}));
}finally{socket.close();}
