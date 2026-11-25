import fs from 'node:fs';import assert from 'node:assert/strict';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-continuous-music'),production=process.argv.includes('--production-continuous-music');
assert.ok(!native||!production);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;
const pending=new Map(),errors=[],stages=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const task=pending.get(data.id);pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression,userGesture=false)=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture});assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));return result.result.value;};
const wait=async expression=>{for(let n=0;n<1800;n++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Continuous music wait: '+expression);};
function observe(){
 const qa=window.continuousMusicQA={elements:0,requests:[],urls:{},events:[],pauses:{},starts:{},failures:[],gain:null};
 const blobs=new WeakMap(),fetchOriginal=window.fetch,createURL=URL.createObjectURL.bind(URL),AudioOriginal=window.Audio;
 window.fetch=async(...args)=>{const path=new URL(args[0]?.url??String(args[0]),location.href).pathname,response=await fetchOriginal(...args);if(!/\/music\/[^/]+\.mp3$/.test(path))return response;
  const row={path,status:response.status,at:performance.now()},read=response.blob.bind(response);qa.requests.push(row);response.blob=async()=>{const blob=await read();row.bytes=blob.size;row.loadedAt=performance.now();blobs.set(blob,path.split('/').at(-1).slice(0,-4));return blob;};return response;};
 URL.createObjectURL=blob=>{const url=createURL(blob);if(blobs.has(blob))qa.urls[url]=blobs.get(blob);return url;};
 window.Audio=new Proxy(AudioOriginal,{construct(target,args){const audio=new target(...args);qa.elements++;qa.audio=audio;
  audio.play=function(){qa.starts[this.src]=this.currentTime;qa.events.push({kind:'play',src:this.src,track:qa.urls[this.src],time:this.currentTime,at:performance.now()});return target.prototype.play.call(this);};
  audio.pause=function(){if(!this.paused)qa.pauses[this.src]=this.currentTime;qa.events.push({kind:'pause',src:this.src,track:qa.urls[this.src],time:this.currentTime,at:performance.now()});return target.prototype.pause.call(this);};
  audio.addEventListener('error',()=>qa.failures.push({src:audio.src,code:audio.error?.code,message:audio.error?.message}));return audio;}});
 const context=window.AudioContext??window.webkitAudioContext;
 if(context){const create=context.prototype.createMediaElementSource,gain=context.prototype.createGain;
  context.prototype.createMediaElementSource=function(element){if(element===qa.audio)qa.context=this;return create.call(this,element);};
  context.prototype.createGain=function(...args){const node=gain.apply(this,args);qa.gain=node;return node;};}
 qa.state=()=>{const audio=qa.audio;return audio?{src:audio.src,track:qa.urls[audio.src],paused:audio.paused,currentTime:audio.currentTime,duration:audio.duration,loop:audio.loop,volume:qa.gain?.gain.value??audio.volume,contextState:qa.context?.state,elements:qa.elements}:null;};
}
const state=()=>evaluate('continuousMusicQA.state()');
async function playing(track){await wait('continuousMusicQA.state()?.track==='+JSON.stringify(track)+'&&!continuousMusicQA.state().paused&&continuousMusicQA.state().currentTime>0');const value=await state();stages.push({track,...value});return value;}
const script=text=>evaluate(native?'(()=>{const result=finni.evaluate('+JSON.stringify(text)+');if(result!==1)throw Error("Native script rejected");})()':'finniThree.game.rules.execute('+JSON.stringify(text)+')');
let result;
try{
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:'('+observe.toString()+')()'});await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
 const before=await evaluate('({elements:continuousMusicQA.elements,requests:continuousMusicQA.requests})');assert.equal(before.elements,0,'Preparation does not create or activate the music element');
 if(production)assert.equal(await evaluate('!!window.finniThree'),false);
 await evaluate('document.getElementById("play").click()',true);const title=await playing('mu_hellhouse1');assert.equal(title.loop,true);assert.equal(title.elements,1);assert.ok(title.volume>0);await wait('document.body.classList.contains("ball-in-plunger")');
 await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await new Promise(resolve=>setTimeout(resolve,650));await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});await wait('!document.body.classList.contains("ball-in-plunger")');
 const launched=await state();assert.equal(launched.src,title.src);assert.ok(launched.currentTime>title.currentTime,'Physical launch does not restart the regular track');stages.push({stage:'launch',...launched});
 if(production){
  await evaluate('document.getElementById("sound").click()',true);await wait('continuousMusicQA.state().volume===0');const muted=await state();await new Promise(resolve=>setTimeout(resolve,250));assert.ok((await state()).currentTime>muted.currentTime);await evaluate('document.getElementById("sound").click()',true);await wait('continuousMusicQA.state().volume>0');assert.equal((await state()).src,title.src);stages.push({stage:'unmute',...await state()});
 }else{
  await script('bMechSuitMBStarted=True:bBerserker=True:ChangeSong');assert.equal((await state()).src,title.src);assert.equal((await state()).paused,false);
  await script('bMechSuitMBStarted=False:bBerserker=False:Battle(CurrentPlayer,0)=1:ChangeSong');const task=await playing('mu_juggernaut');
  await script('Battle(CurrentPlayer,0)=2:ChangeSong');assert.equal((await state()).src,task.src);
  await script('bLilDPMB=True:bNinjaMB=True:ChangeSong');await playing('mu_ninjamb');await script('bNinjaMB=False:ChangeSong');await playing('mu_multiball');
  await script('bLilDPMB=False:ChangeSong');const resumedTask=await playing('mu_juggernaut');assert.equal(resumedTask.src,task.src);
  const taskTimes=await evaluate('({paused:continuousMusicQA.pauses['+JSON.stringify(task.src)+'],started:continuousMusicQA.starts['+JSON.stringify(task.src)+']})');assert.ok(taskTimes.paused>0);assert.ok(Math.abs(taskTimes.started-taskTimes.paused)<.01);
  await script('Battle(CurrentPlayer,0)=0:ChangeSong');const resumed=await playing('mu_hellhouse1');assert.equal(resumed.src,title.src);
  const titleTimes=await evaluate('({paused:continuousMusicQA.pauses['+JSON.stringify(title.src)+'],started:continuousMusicQA.starts['+JSON.stringify(title.src)+']})');assert.ok(titleTimes.paused>=launched.currentTime);assert.ok(Math.abs(titleTimes.started-titleTimes.paused)<.01);
  await script('FinniMusicPaused=True:ChangeSong');const paused=await state();assert.equal(paused.paused,true);await new Promise(resolve=>setTimeout(resolve,250));assert.equal((await state()).paused,true);
  await script('FinniMusicPaused=False:ChangeSong');await playing('mu_hellhouse1');const bonus=await evaluate('({paused:continuousMusicQA.pauses['+JSON.stringify(title.src)+'],started:continuousMusicQA.starts['+JSON.stringify(title.src)+']})');assert.ok(Math.abs(bonus.started-bonus.paused)<.01);
  // Declared media-only seek checks the actual HTML player's end-of-track loop.
  await evaluate('continuousMusicQA.audio.currentTime=continuousMusicQA.audio.duration-.15');await wait('!continuousMusicQA.audio.paused&&continuousMusicQA.audio.currentTime<1');stages.push({stage:'loop',...await state()});
 }
 result=await evaluate('({state:continuousMusicQA.state(),requests:continuousMusicQA.requests,events:continuousMusicQA.events,failures:continuousMusicQA.failures})');
 fs.writeFileSync(output+'/continuous-music-browser.json',JSON.stringify({base,native,production,before,stages,...result,errors,scope:production?'Actual production Start, 650ms launch and Sound toggle. No game hook, VBS calls, clock/RNG/body overrides or online score writes.':'Actual native or dev-port UI, physical launch and the same declared VBS mode changes as master\'s music regression. HTML pause/resume positions are observed. One declared media-only EOF seek tests looping. This is a routing/player component comparison, not natural mission completion or physical-speaker PCM equivalence.'},null,2),{flag:'wx'});
 assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);assert.equal(result.state.elements,1);assert.ok(result.requests.every(row=>row.status===200));console.log(JSON.stringify({native,production,stages:stages.map(row=>row.stage??row.track),musicFiles:result.requests.length,oneElement:true,errors}));
}catch(error){fs.writeFileSync(output+'/continuous-music-failure.json',JSON.stringify({base,native,production,error:String(error),stages,result,errors,observed:await evaluate('({state:window.continuousMusicQA?.state(),requests:window.continuousMusicQA?.requests,events:window.continuousMusicQA?.events,failures:window.continuousMusicQA?.failures})')},null,2),{flag:'wx'});throw error;}finally{socket.close();}
