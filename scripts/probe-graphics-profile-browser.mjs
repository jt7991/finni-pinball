import fs from 'node:fs';
import assert from 'node:assert/strict';
import {installGraphicsProfileObserver} from './graphics-profile-observer.mjs';
import {readReferenceFixture} from './reference-physics.mjs';
const [debug,base,output]=process.argv.slice(2),native=process.argv.includes('--native-profile');
const quality=process.argv.includes('--detailed')?'detailed':'performance';
const filename=process.argv.find(arg=>arg.startsWith('--output-name='))?.slice(14)??`graphics-${native?'native':'port'}-${quality}.json`;
assert.match(filename,/^[a-z0-9.-]+\.json$/i);
const tabs=await(await fetch(debug+'/json/list')).json(),socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let id=0;const pending=new Map(),errors=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<1200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out '+expression);};
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.protocol==='http:'||location.protocol==='https:'){localStorage.setItem('finni-graphics-v1',${JSON.stringify(quality)});localStorage.setItem('finni-three-quality',${JSON.stringify(quality)});}(${installGraphicsProfileObserver.toString()})();`});
  await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
  await evaluate('document.getElementById("play").click()');await wait('document.body.classList.contains("ball-in-plunger")');
  await evaluate('graphicsProfile.armed=true');await wait('graphicsProfile.frames.length>=graphicsProfile.maxFrames');
  const capture=await evaluate(`({profile:graphicsProfile,canvas:{width:document.querySelector('canvas#canvas,canvas#table').width,height:document.querySelector('canvas#canvas,canvas#table').height},pixelRatio:devicePixelRatio,layout:Object.fromEntries(['#player','.toolbar','.dmd-strip','#dmd','.stage','.screen','.player-footer','#touch'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return[selector,{width:r.width,height:r.height,display:getComputedStyle(e).display,style:e.getAttribute('style'),canvas:e.tagName==='CANVAS'?{width:e.width,height:e.height}:null}]})),bodyClass:document.body.className,fullscreen:document.fullscreenElement?.id??null})`);
  capture.dmdError=await evaluate(`(()=>{const e=document.getElementById('dmd-error');return e?{hidden:e.hidden,text:e.textContent}:null;})()`);
  if(!native)capture.portAssets=await evaluate(`window.finniThree?{tableTextures:[...finniThree.view.nativeTable.textures].map(([id,t])=>({id,width:t.image.width,height:t.image.height})),lightInserts:finniThree.view.nativeFlashers.parts.filter(p=>p.spec.name==='LightInserts').map(p=>({sourceVisible:p.spec.is_visible,stateVisible:p.state?.visible,meshVisible:p.mesh.visible})),flashers:[...finniThree.view.nativeFlashers.textures.values()].map(t=>({width:t.image.width,height:t.image.height}))}:null`);
  Object.assign(capture,{native,quality,base,errors});fs.writeFileSync(output+'/'+filename,JSON.stringify(capture,null,2));
  assert.ok(!capture.dmdError||capture.dmdError.hidden,JSON.stringify(capture.dmdError));
  assert.deepEqual(errors,[]);assert.deepEqual(capture.profile.errors,[]);
  if(process.argv.includes('--verify-native-profile')){
    const fixture=readReferenceFixture('three/tests/fixtures/vpx-main-graphics-profiles-native.json.gz'),expected=fixture.captures.find(c=>c.quality===quality&&!c.nudgeInput);
    assert.deepEqual([capture.canvas.width,capture.canvas.height],expected.stages.at(-1).viewport.slice(2));
    for(const frame of capture.profile.frames.slice(2)){assert.deepEqual(frame.post,expected.stages.map(s=>({name:s.name,viewport:s.viewport})));assert.equal(frame.ballDraws,quality==='performance'?4:8);assert.equal(frame.reflectedBalls,quality==='performance'?0:4);}
    const large=capture.profile.textureAllocations.filter(t=>t.width===2048&&t.height===4550);assert.equal(large.length,quality==='performance'?0:4);
  }
  console.log(JSON.stringify({native,quality,canvas:capture.canvas,pixelRatio:capture.pixelRatio,frames:capture.profile.frames.slice(2).map(frame=>({draws:frame.draws,balls:frame.ballDraws,reflected:frame.reflectedBalls,post:frame.post}))}));
}finally{socket.close();}
