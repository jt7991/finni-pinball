import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const production=process.argv.includes('--production');
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0,transferred=0;const pending=new Map(),errors=[],requests=[];
socket.addEventListener('message',event=>{
  const d=JSON.parse(event.data);
  if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}
  if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails);
  if(d.method==='Network.requestWillBeSent')requests.push(d.params.request.url);
  if(d.method==='Network.loadingFinished')transferred+=d.params.encodedDataLength;
});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
const center=selector=>evaluate(`(()=>{let r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const touch=async(points,type=points.length?'touchStart':'touchEnd')=>call('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:4,radiusY:4,force:1}))});
try{
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Network.setCacheDisabled',{cacheDisabled:true});
  if(production)await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.testDraws=0;for(const Context of [WebGLRenderingContext,WebGL2RenderingContext]){const draw=Context.prototype.drawElements;Context.prototype.drawElements=function(...args){window.testDraws++;return draw.apply(this,args);};}`});
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  for(const [width,height,name] of [[390,844,'phone'],[320,568,'small-phone'],[844,390,'landscape'],[1440,900,'desktop']]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:name!=='desktop'});
    await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    transferred=0;
    await call('Page.navigate',{url:base});
    if(production){
      await wait('document.getElementById("play")?.textContent==="Start game"');
      await wait('window.testDraws>0');
      await evaluate('document.fonts.ready.then(()=>true)');
      console.log(name,'production startup transfer bytes',transferred);
      await evaluate('document.getElementById("play").click()');
      await wait('!document.getElementById("launch").disabled');
      const left=await center('.flips [data-input=left]'),right=await center('.flips [data-input=right]'),launch=await center('#launch');
      await touch([left]);await touch([left,right]);
      assert.equal(await evaluate('document.querySelectorAll(".flips .pressed").length'),2);
      await touch([],'touchCancel');
      assert.equal(await evaluate('document.querySelectorAll(".flips .pressed").length'),0);
      await touch([launch]);await new Promise(r=>setTimeout(r,400));await touch([]);
      await wait('document.getElementById("launch").disabled');
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true);
      await writeFile(`${output}/production-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
      continue;
    }
    await wait('!!window.finniThree');
    await evaluate('document.fonts.ready.then(()=>true)');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${name}: no overflow`);
    await wait('finniThree.view.renderer.info.render.calls>0');
    await evaluate('document.getElementById("play").click()');
    await wait('finniThree.game.inLane');
    const left=await center('.flips [data-input=left]'),right=await center('.flips [data-input=right]');
    await touch([left]);await touch([left,right]);
    assert.equal(await evaluate('finniThree.game.held.left&&finniThree.game.held.right'),true,'simultaneous touch');
    await touch([]);assert.equal(await evaluate('finniThree.game.held.left||finniThree.game.held.right'),false,'touch release');
    await touch([left,right]);await touch([],'touchCancel');
    assert.equal(await evaluate('finniThree.game.held.left||finniThree.game.held.right'),false,'touch cancellation');
    const launch=await center('#launch');await touch([launch]);
    await wait('finniThree.game.charge>.2');await touch([]);
    assert.equal(await evaluate('finniThree.game.inLane'),false,'launch release shoots physical ball');
    await touch([left]);await evaluate('window.dispatchEvent(new Event("blur"))');await touch([]);
    assert.equal(await evaluate('finniThree.game.held.left'),false,'focus loss releases');
    await evaluate('window.dispatchEvent(new Event("focus"))');
    if(name==='phone'){
      await evaluate(`(()=>{const g=finniThree.game,r=g.records.find(r=>!r.held);r.body.setTranslation({x:g.scoop.x,y:g.scoop.y,z:.27},true);r.body.setLinvel({x:0,y:0,z:0},true);})()`);
      await wait('finniThree.game.rules.value("bChooseBattle")');
      const before=await evaluate('finniThree.game.rules.value("Battlenr")');
      await touch([right]);await touch([]);
      assert.notEqual(await evaluate('finniThree.game.rules.value("Battlenr")'),before,'touch chooses original mission');
      const action=await center('[data-input=action]');await touch([action]);await touch([]);
      assert.ok(await evaluate('finniThree.game.rules.value("Battle(CurrentPlayer,0)")')>0,'Action starts original mission');
      await wait('finniThree.game.records.some(r=>!r.held)');
    }
    await evaluate('document.getElementById("settings").click()');
    assert.equal(await evaluate('document.getElementById("controls-panel").open'),true);
    await evaluate('document.getElementById("camera").value="overhead";document.getElementById("camera").dispatchEvent(new Event("change"));document.getElementById("controls-panel").close()');
    if(name==='desktop'){
      await evaluate('document.getElementById("settings").click();document.getElementById("latch").checked=true;document.getElementById("latch").dispatchEvent(new Event("change"));document.getElementById("controls-panel").close()');
      await touch([left]);await touch([]);assert.equal(await evaluate('finniThree.game.held.left'),true,'toggle stays held');
      await touch([left]);await touch([]);assert.equal(await evaluate('finniThree.game.held.left'),false,'toggle releases');
      await evaluate('document.getElementById("settings").click();document.getElementById("reset-bindings").click();document.getElementById("portrait").click();document.getElementById("controls-panel").close()');
      await wait('document.getElementById("table").width>0');
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,'rotated viewport fits');
      await evaluate('document.getElementById("settings").click();document.getElementById("portrait").click();document.getElementById("controls-panel").close()');
    }
    await wait('finniThree.view.renderer.info.render.frame>30');
    const metrics=await evaluate('({calls:finniThree.view.renderer.info.render.calls,triangles:finniThree.view.renderer.info.render.triangles,buffer:[document.getElementById("table").width,document.getElementById("table").height],ready:document.getElementById("load-status").textContent})');
    console.log(name,JSON.stringify(metrics));
    await writeFile(`${output}/${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.equal(requests.some(url=>/table\.vpx|vpinball/.test(url)),false,'no VPX requests');
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log('PASS: WebGL, responsive layout, simultaneous touches, cancellation, launch, focus release, camera and no VPX download.');
}finally{socket.close();}
