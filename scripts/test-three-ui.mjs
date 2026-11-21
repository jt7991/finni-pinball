import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0,transferred=0;const pending=new Map(),errors=[],requests=[],measurements=[];
socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);if(d.method==='Network.requestWillBeSent')requests.push(d.params.request.url);if(d.method==='Network.loadingFinished')transferred+=d.params.encodedDataLength;});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const touch=points=>call('Input.dispatchTouchEvent',{type:points.length?'touchStart':'touchEnd',touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:4,radiusY:4,force:1}))});
try{
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Network.setCacheDisabled',{cacheDisabled:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.testDraws=0;for(const Context of [WebGLRenderingContext,WebGL2RenderingContext]){const draw=Context.prototype.drawElements;Context.prototype.drawElements=function(...args){window.testDraws++;return draw.apply(this,args);};}`});
  for(const [width,height,name]of [[390,844,'phone'],[320,568,'small-phone'],[844,390,'landscape'],[1440,900,'desktop']]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:name!=='desktop'});
    await call('Emulation.setTouchEmulationEnabled',{enabled:name!=='desktop',maxTouchPoints:5});
    transferred=0;const started=Date.now();
    await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
    await wait('window.testDraws>0');
    const measurement={viewport:name,coldStartupMs:Date.now()-started,transferredBytes:transferred,jsHeapBytes:await evaluate('performance.memory?.usedJSHeapSize??null')};measurements.push(measurement);console.log('STARTUP',JSON.stringify(measurement));
    await evaluate('document.getElementById("play").click()');
    await wait('document.body.classList.contains("ball-in-plunger")');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${name} no overflow`);
    if(name==='phone'||name==='small-phone'){
      const left=await center('#flip-zones [data-input=left]'),right=await center('#flip-zones [data-input=right]');
      await touch([left,right]);assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),2);
      await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),0);
      const launch=await center('#launch');await touch([launch]);await new Promise(r=>setTimeout(r,500));await touch([]);
    }else{
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft',key:'Shift'});
      assert.ok(await evaluate('document.querySelector("[data-input=left]").classList.contains("pressed")'));
      await call('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft',key:'Shift'});
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await new Promise(r=>setTimeout(r,500));await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});
    }
    await wait('!document.body.classList.contains("ball-in-plunger")');
    if(name!=='desktop')await evaluate('document.getElementById("touch-help").click();document.querySelector("#touch-guide [popovertarget=controls-panel]").click()');
    else await evaluate('document.getElementById("settings").click()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    await evaluate('document.getElementById("controls-panel").hidePopover()');
    if(name!=='desktop')await evaluate('document.getElementById("dismiss-touch-guide").click()');
    await writeFile(`${output}/main-ui-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log('PASS',name,'main UI, real controls, launch and settings');
  }
  if(await evaluate('!!window.finniThree')){
    await evaluate('document.getElementById("controls-panel").showPopover()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    const animation=await evaluate(`(()=>{
      const {game,view}=finniThree,render=view.renderer.render;let scene;
      try{view.renderer.render=function(s,c){scene=s;return render.call(this,s,c);};view.render(1);}finally{view.renderer.render=render;}
      const parts=[...game.spinners,...game.gates.filter(g=>g.spec.is_visible)].map(spinner=>{
        const plate=scene.getObjectByName(spinner.spec.name+(spinner.spec.kind==='Gate'?'Wire':'Plate'));if(!plate)return {name:spinner.spec.name,missing:true};
        const saved=spinner.angle,position=plate.position.clone();spinner.angle=0;view.render(1);const start=plate.quaternion.clone();
        spinner.angle=Math.PI/2;view.render(1);const rotation=start.angleTo(plate.quaternion),axleMovement=position.distanceTo(plate.position);
        spinner.angle=saved;view.render(1);return {name:plate.name,rotation,axleMovement};
      });
      const state=game.rules.objects.get('target010'),motion=game.targetMotions.get('target010'),mesh=scene.getObjectByName('Target010'),collidable=motion.collidable;
      state.collidable=false;for(let ms=0;ms<100;ms++)game.step();state.isdropped=0;for(let ms=0;ms<100;ms++)game.step();view.render(1);const up=mesh.position.y;
      state.isdropped=1;for(let ms=0;ms<25;ms++)game.step();view.render(1);const middle={offset:motion.offset,delta:mesh.position.y-up};
      for(let ms=0;ms<40;ms++)game.step();view.render(1);const end={offset:motion.offset,delta:mesh.position.y-up};state.collidable=collidable;
      return {parts,target:{middle,end}};
    })()`);
    const plates=animation.parts;
    assert.equal(plates.length,4);
    for(const plate of plates){assert.equal(plate.missing,undefined);assert.ok(Math.abs(plate.rotation-Math.PI/2)<1e-6);assert.equal(plate.axleMovement,0);}
    await writeFile(`${output}/mechanism-animation.json`,JSON.stringify(plates,null,2));console.log('PASS original spinner plates and gate wires rotate around fixed axles');
    assert.ok(animation.target.middle.offset<0&&animation.target.middle.offset>-52,'visible target moves progressively');
    assert.ok(Math.abs(animation.target.middle.delta-animation.target.middle.offset*.00053975)<1e-8);
    assert.equal(animation.target.end.offset,-52);assert.ok(Math.abs(animation.target.end.delta+52*.00053975)<1e-8,'native 52 VPU target travel');
    await writeFile(`${output}/target-animation.json`,JSON.stringify(animation.target,null,2));console.log('PASS original drop-target mesh follows native animation travel');
  }
  assert.deepEqual(errors,[]);assert.equal(requests.some(url=>/table\.vpx|vpinball\.(wasm|js)/.test(url)),false);
  await writeFile(`${output}/main-ui-startup.json`,JSON.stringify(measurements,null,2));
}finally{socket.close();}
