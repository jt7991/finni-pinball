import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [debug,base,output]=process.argv.slice(2);
const cacheDisabled=!process.argv.includes('--allow-http-cache');
const tabs=await(await fetch(`${debug}/json/list`)).json();
const socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let seq=0,pageTransferred=0,workerTransferred=0;const pending=new Map(),errors=[],requests=[],measurements=[];
socket.addEventListener('message',async event=>{
  const d=JSON.parse(event.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}
  if(d.method==='Runtime.exceptionThrown')errors.push(d.params);
  if(d.method==='Network.requestWillBeSent')requests.push(d.params.request.url);
  if(d.method==='Network.loadingFinished'){if(d.sessionId)workerTransferred+=d.params.encodedDataLength;else pageTransferred+=d.params.encodedDataLength;}
  if(d.method==='Target.attachedToTarget'){
    const session=d.params.sessionId;
    try{await call('Network.enable',{},session);await call('Network.setCacheDisabled',{cacheDisabled},session);}
    catch(error){errors.push({workerNetwork:error.message});}
    finally{await call('Runtime.runIfWaitingForDebugger',{},session);}
  }
});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}const state=await evaluate('({play:document.getElementById("play")?.textContent,loading:document.getElementById("loading")?.textContent,log:document.getElementById("log")?.textContent?.slice(-1500)})');console.log(JSON.stringify({timeout:expression,state,errors}));throw Error(`Timed out: ${expression}`);};
const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const touch=points=>call('Input.dispatchTouchEvent',{type:points.length?'touchStart':'touchEnd',touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:4,radiusY:4,force:1}))});
try{
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const NativeWorker=window.Worker,s=window.testWorker={starts:[],inputs:[],latest:null,fatal:[],nativeDmd:[]};window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='fatal')s.fatal.push(data.message);if(data.type==='ready')s.nativeDmd=data.description.objects.filter(([name])=>/^digit(?:\\d{3}|grid)$/.test(name)).map(([name,state])=>({name,visible:state.visible}));if(data.type==='snapshot')s.latest={time:data.snapshot.time,tilted:data.snapshot.tilted,held:data.snapshot.held,paused:data.paused,ticks:data.stats.ticks,scriptStats:data.snapshot.scriptStats};});}postMessage(message,...args){if(message.type==='start')s.starts.push(message.players);if(message.type==='input')s.inputs.push({action:message.action,down:message.down});return super.postMessage(message,...args);}};})()`});
  await call('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  await call('Network.setCacheDisabled',{cacheDisabled});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.testDraws=0;window.testShaderErrors=[];for(const Context of [WebGLRenderingContext,WebGL2RenderingContext]){const draw=Context.prototype.drawElements;Context.prototype.drawElements=function(...args){window.testDraws++;return draw.apply(this,args);};const compile=Context.prototype.compileShader;Context.prototype.compileShader=function(shader){compile.call(this,shader);if(!this.getShaderParameter(shader,this.COMPILE_STATUS))window.testShaderErrors.push(this.getShaderInfoLog(shader));};const link=Context.prototype.linkProgram;Context.prototype.linkProgram=function(program){link.call(this,program);if(!this.getProgramParameter(program,this.LINK_STATUS))window.testShaderErrors.push(this.getProgramInfoLog(program));};}`});
  for(const [width,height,name]of [[390,844,'phone'],[320,568,'small-phone'],[844,390,'landscape'],[1440,900,'desktop']]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:name!=='desktop'});
    await call('Emulation.setTouchEmulationEnabled',{enabled:name!=='desktop',maxTouchPoints:5});
    pageTransferred=0;workerTransferred=0;const started=Date.now();
    await call('Page.navigate',{url:base});await wait('document.getElementById("play")?.textContent==="Start game"');
    await wait('window.testDraws>0');
    const elapsed=Date.now()-started,measurement={viewport:name,httpCacheDisabled:cacheDisabled,visit:measurements.length,startupMs:elapsed,...cacheDisabled||!measurements.length?{coldStartupMs:elapsed}:{},transferredBytes:pageTransferred+workerTransferred,pageTargetTransferredBytes:pageTransferred,workerTargetsTransferredBytes:workerTransferred,pageTargetJSHeapBytes:await evaluate('performance.memory?.usedJSHeapSize??null')};measurements.push(measurement);console.log('STARTUP',JSON.stringify(measurement));
    await wait('[...document.querySelectorAll(".start-content img")].every(image=>image.complete&&image.naturalWidth>0)');await evaluate('document.fonts.ready');
    assert.equal(await evaluate('getComputedStyle(document.body).fontFamily.includes("DM Sans")&&getComputedStyle(document.querySelector(".start-content h2")).fontFamily.includes("Pixel")'),true,'main arcade fonts load');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${name} start screen no overflow`);
    measurement.startScreenReadyMs=Date.now()-started;measurement.startScreenTransferredBytes=pageTransferred+workerTransferred;
    await writeFile(`${output}/main-ui-start-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));console.log('START_SCREEN',JSON.stringify({viewport:name,readyMs:measurement.startScreenReadyMs,transferredBytes:measurement.startScreenTransferredBytes}));
    await new Promise(resolve=>setTimeout(resolve,100));
    assert.deepEqual(await evaluate('({paused:testWorker.latest.paused,time:testWorker.latest.time,ticks:testWorker.latest.ticks})'),{paused:true,time:0,ticks:0},'the start preview does not consume native startup physics or RNG');
    assert.equal(await evaluate('testWorker.nativeDmd.length'),42,'main DMD display settings reach the production worker');
    assert.equal(await evaluate('testWorker.nativeDmd.every(row=>row.visible===false)'),true,'native table digits remain hidden beneath the shared DMD');
    assert.equal(await evaluate('testWorker.latest.scriptStats.videoSyncMode'),2,'production uses the native synchronization policy');
    assert.equal(await evaluate('testWorker.latest.scriptStats.budgetMicroseconds'),5000,'automatic script budget reaches the production worker');
    await evaluate(`document.getElementById('player-count').value='${name==='phone'?4:1}';document.getElementById('play').click()`);
    await wait('document.body.classList.contains("ball-in-plunger")');
    assert.equal(await evaluate('testWorker.starts.at(-1)'),name==='phone'?4:1,'main player selector reaches the simulation worker');
    await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Digit1',key:'1'});
    await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Digit1',key:'1'});
    assert.equal(await evaluate('testWorker.starts.length'),1,'Start cannot restart an active game');
    assert.equal(await evaluate('testWorker.inputs.some(input=>input.action==="start")'),false,'Start cannot add players during play');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${name} no overflow`);
    // Desktop CSS can hide touch controls; hidden buttons cannot receive focus.
    for(const code of await evaluate(`document.querySelector('[data-input=left]').checkVisibility()`)?['Enter','Space']:[]){
      await evaluate(`document.querySelector('[data-input=left]').focus()`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',code,key:code==='Space'?' ':'Enter'});
      assert.equal(await evaluate(`document.querySelector('[data-input=left]').classList.contains('pressed')`),true,'focused semantic button holds until key-up');
      await wait('testWorker.latest.held.left');
      const count=await evaluate('testWorker.inputs.length');
      await call('Input.dispatchKeyEvent',{type:'keyDown',code,key:code==='Space'?' ':'Enter',autoRepeat:true});
      assert.equal(await evaluate('testWorker.inputs.length'),count,'button key repeat does not add a second press');
      await call('Input.dispatchKeyEvent',{type:'keyUp',code,key:code==='Space'?' ':'Enter'});
      await wait('!testWorker.latest.held.left');
    }
    await evaluate(`document.getElementById('canvas').focus()`);
    if(name==='phone'||name==='small-phone'){
      const left=await center('#flip-zones [data-input=left]'),right=await center('#flip-zones [data-input=right]');
      await evaluate(`window.controlPointers={};document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-input]');if(b)controlPointers[b.dataset.input]=e.pointerId;},true)`);
      await touch([left,right]);assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),2);
      if(await evaluate('!!window.finniThree?.game.workerSimulation')){
        await evaluate('finniThree.game.flush()');assert.equal(await evaluate('finniThree.game.held.left&&finniThree.game.held.right'),true,'both physical flippers held');
      }
      await evaluate(`document.querySelector('[data-input=left]').dispatchEvent(new PointerEvent('pointercancel',{pointerId:controlPointers.left,pointerType:'touch',bubbles:true}))`);
      assert.equal(await evaluate(`document.querySelector('[data-input=right]').classList.contains('pressed')`),true,'cancelling one pointer preserves the other flipper');
      await wait('!testWorker.latest.held.left&&testWorker.latest.held.right');
      await touch([]);await wait('!testWorker.latest.held.right');
      await touch([left,right]);
      await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await evaluate('document.querySelectorAll("#flip-zones .pressed").length'),0);
      await evaluate(`document.getElementById('latch').checked=true;document.getElementById('latch').dispatchEvent(new Event('change'))`);
      await touch([left,right]);await wait('testWorker.latest.held.left&&testWorker.latest.held.right');
      await evaluate(`document.querySelector('[data-input=left]').dispatchEvent(new PointerEvent('pointercancel',{pointerId:controlPointers.left,pointerType:'touch',bubbles:true}))`);
      await wait('!testWorker.latest.held.left&&testWorker.latest.held.right');
      await touch([]);
      assert.equal(await evaluate(`document.querySelector('[data-input=right]').classList.contains('pressed')`),true,'normal pointer release preserves the remaining toggle');
      await evaluate(`document.getElementById('latch').checked=false;document.getElementById('latch').dispatchEvent(new Event('change'))`);
      await wait('!testWorker.latest.held.left&&!testWorker.latest.held.right');
      await evaluate(`document.getElementById('latch').checked=true;document.getElementById('latch').dispatchEvent(new Event('change'))`);
      await touch([{...left,x:left.x-5},{...left,x:left.x+5}]);
      assert.equal(await evaluate(`document.querySelector('[data-input=left]').classList.contains('pressed')`),false,'two toggle presses leave the flipper released');
      const releasedCount=await evaluate('testWorker.inputs.length');
      await evaluate(`document.querySelector('[data-input=left]').dispatchEvent(new PointerEvent('pointercancel',{pointerId:controlPointers.left,pointerType:'touch',bubbles:true}))`);
      assert.equal(await evaluate('testWorker.inputs.length'),releasedCount,'cancelling an already released toggle does not send a second key-up');
      await touch([]);
      await evaluate(`document.getElementById('latch').checked=false;document.getElementById('latch').dispatchEvent(new Event('change'))`);
      if(name==='phone'){
        await touch([left]);
        await wait('testWorker.latest.held.left');
        await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...left,x:left.x+50,id:1,radiusX:4,radiusY:4,force:1}]});
        await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...left,x:left.x+70,id:1,radiusX:4,radiusY:4,force:1}]});
        await wait('testWorker.inputs.some(input=>input.action==="nudgeRight"&&input.down)');
        await new Promise(resolve=>setTimeout(resolve,350));
        assert.equal(await evaluate('testWorker.inputs.filter(input=>input.action==="nudgeRight"&&input.down).length'),1,'one nudge per swipe');
        assert.equal(await evaluate('testWorker.latest.held.left'),true,'swipe keeps the flipper held');
        assert.equal(await evaluate('testWorker.latest.tilted'),false,'main disables tilt penalties');
        await touch([]);await wait('!testWorker.latest.held.left');
      }
      if(await evaluate('!!window.finniThree?.game.workerSimulation')){
        await evaluate('finniThree.game.flush()');assert.equal(await evaluate('finniThree.game.held.left||finniThree.game.held.right'),false,'physical flippers release after touch cancellation');
        await touch([left]);await evaluate('window.dispatchEvent(new Event("blur"));finniThree.game.flush()');await touch([]);
        assert.equal(await evaluate('finniThree.game.held.left'),false,'focus loss releases physical flipper');
        const pausedAt=await evaluate('finniThree.game.time');await new Promise(r=>setTimeout(r,100));assert.equal(await evaluate('finniThree.game.time'),pausedAt,'worker stops during focus loss');
        await evaluate('window.dispatchEvent(new Event("focus"))');await wait(`finniThree.game.time>${pausedAt}`);
      }
      const launch=await center('#launch');await touch([launch]);await new Promise(r=>setTimeout(r,500));await touch([]);
    }else{
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft',key:'Shift'});
      assert.ok(await evaluate('document.querySelector("[data-input=left]").classList.contains("pressed")'));
      await call('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft',key:'Shift'});
      await call('Input.dispatchKeyEvent',{type:'keyDown',code:'Enter',key:'Enter'});await new Promise(r=>setTimeout(r,500));await call('Input.dispatchKeyEvent',{type:'keyUp',code:'Enter',key:'Enter'});
    }
    await wait('!document.body.classList.contains("ball-in-plunger")');
    if(name==='phone'&&await evaluate('!!window.finniThree?.game.workerSimulation')){
      await evaluate(`(()=>{const g=finniThree.game,r=g.records.find(r=>!r.held);return g.debug({action:'place',ballHandle:r.body.handle,position:{x:g.scoop.x,y:g.scoop.y,z:.27},velocity:{x:0,y:0,z:0}});})()`);
      await wait('finniThree.game.rules.value("bChooseBattle")');
      const before=await evaluate('finniThree.game.debug({action:"value",expression:"Battlenr"})');
      const right=await center('#flip-zones [data-input=right]');await touch([right]);await touch([]);await evaluate('finniThree.game.flush()');
      assert.notEqual(await evaluate('finniThree.game.debug({action:"value",expression:"Battlenr"})'),before,'touch chooses authored mission');
      const action=await center('[data-input=action]');await touch([action]);await touch([]);await evaluate('finniThree.game.flush()');
      assert.ok(await evaluate('finniThree.game.debug({action:"value",expression:"Battle(CurrentPlayer,0)"})')>0,'Action starts authored mission');
      await wait('finniThree.game.records.some(r=>!r.held)');console.log('PASS worker scoop capture, physical mission selection and Action');
    }
    if(name!=='desktop')await evaluate('document.getElementById("touch-help").click();document.querySelector("#touch-guide [popovertarget=controls-panel]").click()');
    else await evaluate('document.getElementById("settings").click()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    await evaluate('document.getElementById("controls-panel").hidePopover()');
    if(name!=='desktop')await evaluate('document.getElementById("dismiss-touch-guide").click()');
    await writeFile(`${output}/main-ui-${name}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.deepEqual(await evaluate('window.testShaderErrors'),[],`${name} all shaders compile and link`);
    measurement.scriptBudget=await evaluate('testWorker.latest.scriptStats');
    assert.equal(await evaluate('Math.round(testWorker.latest.time*1000)+1===testWorker.latest.ticks'),true,'timer deferral never drops a physical interval');
    console.log('PASS',name,'main UI, real controls, launch and settings');
  }
  if(await evaluate('!!window.finniThree')){
    await evaluate('document.getElementById("controls-panel").showPopover()');
    await wait('document.getElementById("controls-panel").matches(":popover-open")');
    const animation=await evaluate(`(async()=>{
      const {game,view}=finniThree,scene=view.scene;
      if(game.workerSimulation){game.setPaused(true);await game.flush();}
      view.render(1);const raw=!!view.nativeMechanisms;
      const read3=(attribute,index)=>[attribute.getX(index),attribute.getY(index),attribute.getZ(index)],dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),subtract=(a,b)=>a.map((v,i)=>v-b[i]),axisFor=rotation=>{const r=rotation*Math.PI/180,a=[Math.cos(r),Math.sin(r),0],length=Math.hypot(...a);return a.map(v=>v/length);},project=(a,axis)=>{const d=dot(a,axis);return a.map((v,i)=>v-axis[i]*d);},angleBetween=(a,b,axis)=>{a=project(a,axis);b=project(b,axis);return Math.acos(Math.min(1,Math.max(-1,dot(a,b)/(Math.hypot(...a)*Math.hypot(...b)))));},farthest=(attribute,pivot,axis)=>{let best=-1,index=0;for(let i=0;i<attribute.count;i++){const radius=Math.hypot(...project(subtract(read3(attribute,i),pivot),axis));if(radius>best){best=radius;index=i;}}return index;};
      const parts=[...game.spinners,...game.gates.filter(g=>g.spec.is_visible)].map(spinner=>{
        const plate=scene.getObjectByName(spinner.spec.name+(spinner.spec.kind==='Gate'?'Wire':'Plate'));if(!plate)return {name:spinner.spec.name,missing:true};
        const saved=spinner.angle,position=plate.position.clone();spinner.angle=0;view.render(1);const start=plate.quaternion.clone(),part=raw?view.nativeMechanisms.parts.find(p=>p.part.mesh===plate).part:null,axis=raw?axisFor(part.spec.rotation):null,pivot=raw?[part.spec.center.x,part.spec.center.y,part.spec.height+part.spec.surface_height]:null,attribute=raw?plate.geometry.getAttribute('vPosition'):null,index=raw?farthest(attribute,pivot,axis):0,startPoint=raw?subtract(read3(attribute,index),pivot):null;
        spinner.angle=Math.PI/2;view.render(1);const endPoint=raw?subtract(read3(attribute,index),pivot):null,rotation=raw?angleBetween(startPoint,endPoint,axis):start.angleTo(plate.quaternion),axleMovement=position.distanceTo(plate.position),axialMovement=raw?Math.abs(dot(startPoint,axis)-dot(endPoint,axis)):0;
        spinner.angle=saved;view.render(1);return {name:plate.name,rotation,axleMovement,axialMovement,raw};
      });
      const state=game.rules.objects.get('target010'),motion=game.targetMotions.get('target010'),mesh=scene.getObjectByName('Target010'),collidable=motion.collidable;
      const advance=async ticks=>{if(game.workerSimulation){await game.debug({action:'advance',ticks});await game.prepareFrame();}else for(let ms=0;ms<ticks;ms++)game.step();};
      const set=async statement=>{await game.rules.execute(statement);};
      await set('Target010.Collidable=False');await advance(100);await set('Target010.IsDropped=False');await advance(100);view.render(1);const readDrop=()=>raw?mesh.geometry.getAttribute('vPosition').getZ(0):mesh.position.y,up=readDrop();
      await set('Target010.IsDropped=True');await advance(25);view.render(1);const middle={offset:motion.offset,delta:readDrop()-up};
      await advance(40);view.render(1);const end={offset:motion.offset,delta:readDrop()-up};await set('Target010.Collidable='+ (collidable?'True':'False'));
      const specs=(await(await fetch(new URL('objects.json',location.href))).json()).objects,standups=[];
      for(const name of ['Target001','Target005','Target013']){
        const spec=specs.find(s=>s.name===name),target=game.targetMotions.get(name.toLowerCase()),node=scene.getObjectByName(name),pivot=node.position.clone(),geometry=node.geometry.uuid;
        await set(name+'.Collidable=False:'+name+'.IsDropped=False');await advance(100);await advance(100);view.render(1);const rest=node.quaternion.clone(),normal=raw?node.geometry.getAttribute('vNormal'):null,axis=raw?axisFor(spec.rot_z):null,normalIndex=raw?farthest(normal,[0,0,0],axis):0,restNormal=raw?read3(normal,normalIndex):null,readAngle=()=>raw?angleBetween(restNormal,read3(normal,normalIndex),axis):rest.angleTo(node.quaternion);
        await set(name+'.Visible=False:'+name+'.Collidable=True');
        const a=spec.rot_z*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)},t={x:Math.cos(a),y:Math.sin(a)},front=Math.max(...spec.collision_mesh.vertices.map(v=>v[1]))*spec.size.y,record=game.records.find(r=>!r.held);
        if(!record)throw Error('Stand-up test requires an active playable ball');
        const place=async(z,tangent)=>game.debug({action:'place',ballHandle:record.body.handle,position:{x:(spec.position.x+n.x*(front+25.01)+t.x*tangent)*.01,y:(2115-(spec.position.y+n.y*(front+25.01)+t.y*tangent))*.01,z:z*.01},velocity:{x:-n.x*8,y:n.y*8,z:0}});
        const before=game.score;await place(45,spec.size.x*.4);await advance(17);view.render(1);const hidden={visible:node.visible,offset:target.offset,scoreDelta:game.score-before};
        await set(name+'.Visible=True');await advance(17);view.render(1);const first={offset:target.offset,angle:readAngle()};
        await advance(17);view.render(1);const peak={offset:target.offset,angle:readAngle()};
        await advance(40);view.render(1);const settled={offset:target.offset,angle:readAngle()};
        let point;
        if(name==='Target001'){const score=game.score;await place(25,0);await advance(17);view.render(1);point={offset:target.offset,angle:readAngle(),scoreDelta:game.score-score};}
        standups.push({name,drop:target.drop,rotZ:target.rotZ,hidden,first,peak,settled,point,pivotMovement:pivot.distanceTo(node.position),sameGeometry:geometry===node.geometry.uuid});
      }
      await set(specs.filter(s=>s.kind==='LightSequencer').map(s=>s.name+'.StopPlay').join(':'));
      const lamp=game.rules.objects.get('li044');
      await set('li044.State=2:LightSeqInserts.Play SeqAllOff');if(game.workerSimulation)await game.flush();view.render(1);
      const sequenceOff={script:lamp.state,locked:lamp.sequenceactive,display:lamp.sequencestate};
      await set('li044.State=1:LightSeqInserts.StopPlay');if(game.workerSimulation)await game.flush();view.render(1);
      const sequenceRestored={script:lamp.state,locked:lamp.sequenceactive};
      await set('LightSeqInserts.UpdateInterval=20:LightSeqInserts.Play SeqBlinking,,2,10');
      await advance(17);await advance(17);await advance(17);view.render(1);
      const sequenceBlink={script:lamp.state,locked:lamp.sequenceactive,display:lamp.sequencestate};
      await set('LightSeqInserts.StopPlay');
      // Explicit component inputs: main's current li044 uses intensity50.4
      // and5.04/.504 fades, while this90-unit handoff check uses9/.9 fades.
      await set('li044.Intensity=90:li044.IntensityScale=1:li044.FadeSpeedUp=9:li044.FadeSpeedDown=0.9:li044.State=0');await advance(1000);view.render(1);
      const index=view.bulbHalos.lamps.findIndex(l=>l.spec.name==='li044'),readLamp=()=>({intensity:lamp.inplayintensity,on:lamp.inplayon,textureIntensity:view.bulbHalos.parts[index].values.lightColor_intensity[3]});
      const off=readLamp();await set('li044.State=1');await advance(17);view.render(1);const full=readLamp();
      await set('li044.State=0');await advance(17);view.render(1);const fading=readLamp();
      await set('li044.BlinkPattern="00101":li044.BlinkInterval=125:li044.State=2');await advance(17);view.render(1);const blinkOff=readLamp();await advance(125);view.render(1);const blinkOn=readLamp();
      // Pool lamps are rewritten by active mission timers; li075 is controlled
      // only by discrete rule events, so this isolates the worker/render handoff.
      const classic=view.classicLights.lamps.findIndex(l=>l.spec.name==='li075'),classicLamp=game.rules.objects.get('li075'),readClassic=()=>({intensity:classicLamp.inplayintensity,texture:view.classicLights.parts[classic].values.lightColor_intensity[3]});
      await set('li075.State=0');await advance(1000);view.render(1);const classicOff=readClassic();await set('li075.State=1');await advance(17);view.render(1);const classicOn=readClassic();await set('li075.State=0');await advance(17);view.render(1);const classicFade=readClassic();
      const flippers=[],pivots=view.flipperVisuals.flippers.map(p=>p.top.position.clone());game.input('left',false);game.input('right',false);await advance(300);
      for(const [down,ticks]of [[true,5],[false,5],[true,17],[false,17],[true,34],[true,100],[false,17],[false,150]]){
        game.input('left',down);game.input('right',down);await advance(ticks);view.render(1);
        view.flipperVisuals.flippers.forEach((part,i)=>{const state=game.rules.objects.get(part.spec.name.toLowerCase()+'top');flippers.push({name:part.spec.name,down,ticks,angle:game.flippers[i].angle,bodyAngle:part.base.rotation.z,topAngle:part.top.rotation.z,scriptTopAngle:state.rotz,pivotMovement:pivots[i].distanceTo(part.top.position)});});
      }
      return {raw,parts,target:{middle,end},standups,sequences:{off:sequenceOff,restored:sequenceRestored,blink:sequenceBlink},lamps:{count:view.bulbHalos.lamps.length,off,full,fading,blinkOff,blinkOn},classic:{count:view.classicLights.lamps.length,draws:view.classicLights.meshes.length,off:classicOff,on:classicOn,fading:classicFade},flippers};
    })()`);
    const plates=animation.parts;
    assert.equal(animation.lamps.count,133);assert.equal(animation.lamps.off.intensity,0);assert.equal(animation.lamps.full.intensity,90);assert.equal(animation.lamps.fading.intensity,Math.fround(90-Math.fround(Math.fround(.9)*17)));assert.equal(animation.lamps.blinkOff.on,false);assert.equal(animation.lamps.blinkOn.on,true);
    for(const sample of ['off','full','fading','blinkOff','blinkOn'])assert.equal(animation.lamps[sample].textureIntensity,animation.lamps[sample].intensity,'worker lamp output reaches the original LightShader uniform');
    await writeFile(`${output}/lamp-render-animation.json`,JSON.stringify(animation.lamps,null,2));console.log('PASS native lamp fades, custom blink patterns and HDR bulb data');
    assert.equal(animation.classic.count,25);assert.equal(animation.classic.draws,25);assert.equal(animation.classic.off.intensity,0);assert.ok(animation.classic.on.intensity>0);assert.ok(animation.classic.fading.intensity<animation.classic.on.intensity);for(const sample of ['off','on','fading'])assert.equal(animation.classic[sample].texture,animation.classic[sample].intensity);assert.deepEqual(await evaluate('window.testShaderErrors'),[]);
    await writeFile(`${output}/classic-render-animation.json`,JSON.stringify(animation.classic,null,2));console.log('PASS all25original classic inserts receive worker fades in their native opaque pass');
    assert.equal(animation.flippers.length,16);for(const sample of animation.flippers){const nativeAngle=Math.fround(Math.PI/2-sample.angle);assert.equal(sample.scriptTopAngle,Math.fround(nativeAngle*Math.fround(180/Math.PI)),'native Animate callback reaches the top');assert.equal(sample.bodyAngle,Math.PI/2-nativeAngle);assert.equal(sample.topAngle,Math.PI/2-Math.fround(Math.fround(sample.scriptTopAngle)*Math.fround(Math.PI/180)));assert.equal(sample.pivotMovement,0);}assert.ok(new Set(animation.flippers.map(s=>s.angle)).size>4);
    await writeFile(`${output}/flipper-render-animation.json`,JSON.stringify(animation.flippers,null,2));console.log('PASS native flipper bases and textured tops follow worker taps, holds and releases at fixed pivots');
    assert.deepEqual(animation.sequences.off,{script:2,locked:true,display:0});
    assert.deepEqual(animation.sequences.restored,{script:1,locked:false});
    assert.deepEqual(animation.sequences.blink,{script:1,locked:true,display:1});
    await writeFile(`${output}/light-sequence-animation.json`,JSON.stringify(animation.sequences,null,2));console.log('PASS native light sequence overrides, saved script state and worker render-frame blinking');
    assert.equal(plates.length,4);
    for(const plate of plates){assert.equal(plate.missing,undefined);assert.ok(Math.abs(plate.rotation-Math.PI/2)<(plate.raw?3e-5:1e-6));assert.equal(plate.axleMovement,0);assert.ok(plate.axialMovement<.001,'actual vertex motion preserves its native axle');}
    await writeFile(`${output}/mechanism-animation.json`,JSON.stringify(plates,null,2));console.log('PASS original spinner plates and gate wires rotate around fixed axles');
    assert.ok(animation.target.middle.offset<0&&animation.target.middle.offset>-52,'visible target moves progressively');
    assert.ok(Math.abs(animation.target.middle.delta-animation.target.middle.offset*(animation.raw?1:.00053975))<(animation.raw?.0001:1e-8));
    assert.equal(animation.target.end.offset,-52);assert.ok(Math.abs(animation.target.end.delta+52*(animation.raw?1:.00053975))<(animation.raw?.0001:1e-8),'native 52 VPU target travel');
    await writeFile(`${output}/target-animation.json`,JSON.stringify(animation.target,null,2));console.log('PASS original drop-target mesh follows native animation travel');
    for(const target of animation.standups){
      assert.equal(target.drop,false);assert.equal(target.hidden.visible,false);assert.equal(target.hidden.offset,0);assert.ok(target.hidden.scoreDelta>0,'hidden physical face still scores');
      assert.equal(target.first.offset,8.5);assert.ok(Math.abs(target.first.angle-8.5*Math.PI/180)<1e-7);
      assert.equal(target.peak.offset,13);assert.ok(Math.abs(target.peak.angle-13*Math.PI/180)<1e-7);
      assert.equal(target.settled.offset,0);assert.ok(target.settled.angle<1e-7);assert.equal(target.pivotMovement,0);assert.equal(target.sameGeometry,true);
      if(target.point){assert.ok(target.point.scoreDelta>0);assert.equal(target.point.offset,0);assert.ok(target.point.angle<1e-7,'vertex hit does not arm a stand-up bounce');}
    }
    await writeFile(`${output}/standup-animation.json`,JSON.stringify(animation.standups,null,2));console.log('PASS original stand-up meshes receive physical face hits, hidden queues and fixed-pivot native bounce');
  }
  assert.deepEqual(errors,[]);assert.equal(requests.some(url=>/table\.vpx|vpinball\.(wasm|js)/.test(url)),false);
  await writeFile(`${output}/main-ui-startup.json`,JSON.stringify(measurements,null,2));
}finally{socket.close();}
