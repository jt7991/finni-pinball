// The same ordinary UI-event sequence on original VPX and production Three.
// Observe outgoing authored key calls/worker packets and physical time only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {installNativeStartupObserver} from './native-startup-observer.mjs';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-player'),sha=b=>createHash('sha256').update(b).digest('hex');
const cameraFocus=process.argv.includes('--camera-focus');
const nativeBytes=fs.readFileSync(new URL('../three/tests/fixtures/'+(cameraFocus?'vpx-native-player-camera-focus.json.gz':'vpx-native-player-control-transitions-v2.json.gz'),import.meta.url)),nativeFixtureSHA256=sha(nativeBytes);
assert.equal(nativeFixtureSHA256,cameraFocus?'7abe644197913cbd0bb3ef0e90a2693077c61df1a7a9e8f9a965b4dbc7685452':'2729299f8be4ba380d6ee15228996edfacd0f956abcfe4cae415bdee307f1be4');
const nativeBaseline=JSON.parse(gunzipSync(nativeBytes)).observation;
assert.equal(nativeBaseline.native,true);assert.deepEqual(nativeBaseline.errors,[]);assert.ok(nativeBaseline.observations.every(row=>row.pass));
let reference,engineSHA256,playerSHA256;
if(native){
  reference=await(await fetch(new URL('/reference-metadata.json',base))).json();engineSHA256=sha(Buffer.from(await(await fetch(new URL('/engine/vpinball.wasm',base))).arrayBuffer()));playerSHA256=sha(Buffer.from(await(await fetch(new URL('/app.js',base))).arrayBuffer()));
  assert.equal(engineSHA256,'c9f81fc78eff4ae994ac06272870e4572aa4fce00adf7194a78ef65c1b04e4d8');assert.equal(reference.sourceSha256,'6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5');assert.equal(reference.controlledSha256,reference.sourceSha256);assert.deepEqual(reference.controlledOverrides,{});
  assert.equal(playerSHA256,nativeBaseline.playerSHA256);assert.equal(playerSHA256,reference.browserAppSHA256);
}
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let serial=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;},wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('UI transition wait '+expression);},delay=ms=>new Promise(r=>setTimeout(r,ms));
const observations=[];
const key=(code,down)=>call('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code==='ShiftLeft'?'Shift':' ',windowsVirtualKeyCode:code==='ShiftLeft'?16:32});
const held=()=>evaluate('({left:!!controlTransitions.held.left,right:!!controlTransitions.held.right})');
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Emulation.setDeviceMetricsOverride',{width:cameraFocus?1440:390,height:cameraFocus?900:844,deviceScaleFactor:1,mobile:!cameraFocus});
  if(process.argv.includes('--touch-emulation'))await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:(native?'('+installNativeStartupObserver.toString()+')(1);':'')+`(()=>{
    const s=window.controlTransitions={held:{},inputs:[],latest:null,fatal:[],fullscreenRequests:[]},NativeWorker=window.Worker;
    if(${cameraFocus})for(const name of ['requestFullscreen','webkitRequestFullscreen']){const prototype=[Element.prototype,HTMLElement.prototype].find(p=>Object.hasOwn(p,name)),original=prototype?.[name];if(typeof original==='function')prototype[name]=function(...args){s.fullscreenRequests.push({name,args});return original.apply(this,args);};}
    window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='snapshot')s.latest={time:data.snapshot.time,paused:data.paused};if(data.type==='fatal')s.fatal.push(data.message);});}postMessage(message,...args){if(message.type==='input'){s.inputs.push({action:message.action,down:message.down});s.held[message.action]=message.down;}if(message.type==='release')for(const action of Object.keys(s.held))s.held[action]=false;return super.postMessage(message,...args);}};
  })();`});
  await call('Page.navigate',{url:base});await wait('!!document.getElementById("play")&&!document.getElementById("play").disabled');
  if(process.argv.includes('--trusted-start')){
    const position=await evaluate('(()=>{const r=document.getElementById("play").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
    for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...position,button:'left',clickCount:1});
  }else await evaluate('document.getElementById("play").click()');
  await wait('document.body.classList.contains("ball-in-plunger")');
  const fullscreenAtStart=await evaluate('({active:!!(document.fullscreenElement||document.webkitFullscreenElement),enabled:document.fullscreenEnabled,note:document.getElementById("screen-message").textContent,noteHidden:document.getElementById("screen-message").hidden})');
  if(native)await evaluate(`(()=>{const s=controlTransitions,engine=finni.engine,ccall=engine.ccall;engine.ccall=function(name,...args){const result=ccall.call(this,name,...args);if(name==='vpinball_wasm_eval_script'){const statement=args[2]?.[0],match=typeof statement==='string'&&statement.match(/^Table1_Key(Down|Up) (LeftFlipperKey|RightFlipperKey|RightTiltKey)$/);if(match){const action={LeftFlipperKey:'left',RightFlipperKey:'right',RightTiltKey:'nudgeRight'}[match[2]],down=match[1]==='Down';s.inputs.push({action,down});s.held[action]=down;}}return result;};})()`);
  const focus=()=>evaluate('document.getElementById("canvas").focus()');
  const clock=()=>evaluate(native?'nativeStartup.read().ms':'controlTransitions.latest.time*1000');
  await focus();await key('ShiftLeft',true);await delay(50);assert.equal((await held()).left,true);
  await evaluate('document.getElementById("touch-help").focus();document.getElementById("touch-help").click()');await delay(50);
  observations.push({name:'help releases held flipper',pass:!(await held()).left});await key('ShiftLeft',false);
  await evaluate('document.getElementById("dismiss-touch-guide").focus();document.getElementById("dismiss-touch-guide").click()');await delay(50);
  observations.push({name:'closing help returns keyboard focus to playfield',pass:await evaluate('document.activeElement===document.getElementById("canvas")')});
  await focus();await key('ShiftLeft',true);await delay(50);assert.equal((await held()).left,true);
  await evaluate('window.dispatchEvent(new Event("pagehide"))');await delay(50);
  observations.push({name:'pagehide releases held flipper',pass:!(await held()).left});await key('ShiftLeft',false);
  await evaluate('document.querySelector("nav [popovertarget=leaderboard-panel]").click()');await wait('document.getElementById("leaderboard-panel").matches(":popover-open")');
  const before=await evaluate('controlTransitions.inputs.length');
  await evaluate(`(()=>{const b=document.querySelector('[data-action=left]');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'touch',button:0,bubbles:true,cancelable:true}));b.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch',button:0,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft',bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft',bubbles:true,cancelable:true}));})()`);await delay(50);
  observations.push({name:'high scores block new flipper input',pass:await evaluate(`!controlTransitions.inputs.slice(${before}).some(row=>row.down)`)});
  await evaluate('document.querySelector("#leaderboard-panel .close").focus();document.getElementById("leaderboard-panel").hidePopover()');await delay(50);
  observations.push({name:'closing high scores returns keyboard focus to playfield',pass:await evaluate('document.activeElement===document.getElementById("canvas")')});
  await evaluate('document.querySelector("nav [popovertarget=controls-panel]").click()');await wait('document.getElementById("controls-panel").matches(":popover-open")');
  const first=await clock();await delay(250);const last=await clock();
  observations.push({name:'physical time during controls popover',elapsedMilliseconds:last-first,pass:last>first});
  await evaluate('document.getElementById("controls-panel").hidePopover()');await delay(50);await focus();await key('ShiftLeft',true);await delay(50);
  observations.push({name:'pressed flipper publishes its accessible pressed state',pass:await evaluate('document.querySelector("[data-action=left]").getAttribute("aria-pressed")==="true"')});
  await key('ShiftLeft',false);await delay(50);
  observations.push({name:'released flipper clears its accessible pressed state',pass:await evaluate('document.querySelector("[data-action=left]").getAttribute("aria-pressed")==="false"')});
  const nudgeStart=await evaluate('controlTransitions.inputs.length');
  await evaluate(`(()=>{
    const latch=document.getElementById('latch'),button=document.querySelector('[data-action=left]');latch.checked=true;latch.dispatchEvent(new Event('change'));
    const pointer=(type,id,x)=>button.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:200,bubbles:true,cancelable:true}));
    pointer('pointerdown',92,100);pointer('pointerup',92,100);pointer('pointerdown',93,100);pointer('pointermove',93,180);pointer('pointerup',93,180);
    latch.checked=false;latch.dispatchEvent(new Event('change'));
  })()`);await delay(50);
  observations.push({name:'sliding a toggle-off press does not nudge a released flipper',pass:await evaluate(`!controlTransitions.inputs.slice(${nudgeStart}).some(row=>row.action==='nudgeRight'&&row.down)`)});
  let focusClocks;
  if(cameraFocus){
    observations.push({name:'Start requests fullscreen',pass:await evaluate('controlTransitions.fullscreenRequests.length>0')});
    await focus();await key('ShiftLeft',true);await delay(50);assert.equal((await held()).left,true);
    await evaluate('(()=>{const select=document.getElementById("camera-view");select.focus();select.value="topdown";select.dispatchEvent(new Event("change"));})()');await delay(50);
    observations.push({name:'camera change releases held flipper',pass:!(await held()).left});
    observations.push({name:'camera change returns keyboard focus to playfield',pass:await evaluate('document.activeElement===document.getElementById("canvas")')});await key('ShiftLeft',false);
    await evaluate('document.getElementById("portrait").focus();document.getElementById("portrait").click();new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    observations.push({name:'portrait rotation returns keyboard focus to playfield',pass:await evaluate('document.activeElement===document.getElementById("canvas")')});
    await evaluate('window.dispatchEvent(new Event("blur"))');const blurred=await clock();await delay(250);const afterBlur=await clock();
    await evaluate('window.dispatchEvent(new Event("focus"))');const focused=await clock();await delay(250);const afterFocus=await clock();
    focusClocks={blur:{beforeMilliseconds:blurred,afterMilliseconds:afterBlur,elapsedMilliseconds:afterBlur-blurred,paused:afterBlur===blurred},focus:{beforeMilliseconds:focused,afterMilliseconds:afterFocus,elapsedMilliseconds:afterFocus-focused,advances:afterFocus>focused}};
  }
  const traffic=await evaluate('({inputs:controlTransitions.inputs,fatal:controlTransitions.fatal})');
  const report={scope:'Identical ordinary UI-event sequence. Physical CDP Shift keys, explicit pointer events, normal Help/popover/camera controls and pagehide/blur/focus dispatch are inputs. Original native authored key calls or Three worker packets and fullscreen API attempts are observed without changing their arguments/results. Clock/body/RNG/native instructions are never replaced. This is finite player-transition coverage, not a full gameplay trajectory.',native,base,cameraFocus,trustedStart:process.argv.includes('--trusted-start'),touchEmulation:process.argv.includes('--touch-emulation'),nativeFixtureSHA256,reference,engineSHA256,playerSHA256,observations,focusClocks,fullscreenAtStart,fullscreenRequests:await evaluate('controlTransitions.fullscreenRequests'),traffic,errors};
  fs.writeFileSync(path.join(output,'player-control-transitions.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({native,observations,focusClocks,errors}));
  assert.deepEqual(errors,[]);assert.deepEqual(traffic.fatal,[]);
  if(!process.argv.includes('--observe-only')){
    assert.deepEqual(observations.map(({name,pass})=>({name,pass})),nativeBaseline.observations.map(({name,pass})=>({name,pass})),'Original main-player transition behavior');
    if(cameraFocus){assert.equal(focusClocks.blur.paused,nativeBaseline.focusClocks.blur.paused);assert.equal(focusClocks.focus.advances,nativeBaseline.focusClocks.focus.advances);}
  }
}finally{socket.close();}
